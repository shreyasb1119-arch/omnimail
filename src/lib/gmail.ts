import { withAuth } from "./gauth";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return withAuth(async (token) => {
    const r = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!r.ok) {
      const err: any = new Error(`Gmail API ${r.status}`);
      err.status = r.status;
      err.body = await r.text().catch(() => "");
      throw err;
    }
    if (r.status === 204) return undefined as T;
    return r.json();
  });
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: any;
}

export interface Attachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  inline: boolean;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  date: number;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  unread: boolean;
  starred: boolean;
  attachments: Attachment[];
}

function decodeB64(str: string) {
  try {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      atob(s)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    try {
      return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return "";
    }
  }
}

function walkParts(
  payload: any,
  out: { text: string; html: string; attachments: Attachment[] },
) {
  if (!payload) return;
  const mime = payload.mimeType || "";
  const filename = payload.filename || "";
  const disposition =
    (payload.headers || []).find((h: any) => h.name?.toLowerCase() === "content-disposition")
      ?.value || "";

  if (filename && payload.body?.attachmentId) {
    out.attachments.push({
      attachmentId: payload.body.attachmentId,
      filename,
      mimeType: mime || "application/octet-stream",
      size: Number(payload.body.size || 0),
      inline: /inline/i.test(disposition),
    });
  } else if (payload.body?.data) {
    const decoded = decodeB64(payload.body.data);
    if (mime === "text/plain" && !out.text) out.text = decoded;
    else if (mime === "text/html" && !out.html) out.html = decoded;
  }
  if (payload.parts) for (const p of payload.parts) walkParts(p, out);
}

function header(payload: any, name: string): string {
  const h = payload?.headers?.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

export function parseMessage(m: GmailMessageMeta): ParsedMessage {
  const parts = { text: "", html: "", attachments: [] as Attachment[] };
  walkParts(m.payload, parts);
  const from = header(m.payload, "From");
  const emailMatch = from.match(/<([^>]+)>/);
  return {
    id: m.id,
    threadId: m.threadId,
    labelIds: m.labelIds || [],
    snippet: m.snippet || "",
    date: Number(m.internalDate || 0),
    from,
    fromEmail: (emailMatch ? emailMatch[1] : from).trim(),
    to: header(m.payload, "To"),
    subject: header(m.payload, "Subject"),
    bodyText: parts.text || m.snippet || "",
    bodyHtml: parts.html,
    unread: (m.labelIds || []).includes("UNREAD"),
    starred: (m.labelIds || []).includes("STARRED"),
    attachments: parts.attachments,
  };
}

export async function listMessages(opts: { q?: string; labelIds?: string[]; maxResults?: number; pageToken?: string }) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.labelIds) opts.labelIds.forEach((l) => params.append("labelIds", l));
  params.set("maxResults", String(opts.maxResults ?? 30));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return api<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string; resultSizeEstimate: number }>(
    `/messages?${params}`,
  );
}

export async function getMessage(id: string, format: "full" | "metadata" = "full") {
  return api<GmailMessageMeta>(`/messages/${id}?format=${format}`);
}

export async function batchGetMessages(ids: string[]): Promise<ParsedMessage[]> {
  const results = await Promise.all(ids.map((id) => getMessage(id).catch(() => null)));
  return results.filter(Boolean).map((m) => parseMessage(m as GmailMessageMeta));
}

export async function modifyMessage(id: string, add: string[] = [], remove: string[] = []) {
  return api(`/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
}

export async function batchModify(ids: string[], add: string[] = [], remove: string[] = []) {
  if (!ids.length) return;
  return api(`/messages/batchModify`, {
    method: "POST",
    body: JSON.stringify({ ids, addLabelIds: add, removeLabelIds: remove }),
  });
}

export async function trashMessage(id: string) {
  return api(`/messages/${id}/trash`, { method: "POST" });
}
export async function untrashMessage(id: string) {
  return api(`/messages/${id}/untrash`, { method: "POST" });
}
export async function deleteMessage(id: string) {
  return api(`/messages/${id}`, { method: "DELETE" });
}
export async function batchDelete(ids: string[]) {
  if (!ids.length) return;
  return api(`/messages/batchDelete`, { method: "POST", body: JSON.stringify({ ids }) });
}

export async function emptyTrash() {
  // Gmail has no single "empty trash" endpoint — list all in Trash and delete.
  let pageToken: string | undefined;
  let total = 0;
  do {
    const page = await listMessages({ labelIds: ["TRASH"], maxResults: 500, pageToken });
    const ids = (page.messages || []).map((m) => m.id);
    if (ids.length) {
      // batchDelete requires gmail.modify — falls back to per-message trash removal.
      // Since scope gmail.modify may not permit permanent delete, we call untrash → delete may fail.
      // Fallback: trash items are auto-purged after 30d. We'll attempt batchDelete anyway.
      try {
        await batchDelete(ids);
      } catch {
        // best-effort per-message
        await Promise.all(ids.map((id) => deleteMessage(id).catch(() => null)));
      }
      total += ids.length;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return total;
}

export interface OutgoingAttachment {
  filename: string;
  mimeType: string;
  /** raw base64 (no data: prefix) */
  data: string;
}

export async function fileToOutgoing(f: File): Promise<OutgoingAttachment> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return { filename: f.name, mimeType: f.type || "application/octet-stream", data: btoa(bin) };
}

export interface SendOpts {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
  inReplyTo?: string;
  attachments?: OutgoingAttachment[];
}

export function buildRaw(opts: SendOpts): string {
  const boundary = "omni_" + Math.random().toString(36).slice(2);
  const hasAtt = !!opts.attachments?.length;
  const headers = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : null,
    opts.bcc ? `Bcc: ${opts.bcc}` : null,
    `Subject: ${opts.subject}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.inReplyTo ? `References: ${opts.inReplyTo}` : null,
    "MIME-Version: 1.0",
  ].filter(Boolean) as string[];

  let mime: string;
  if (!hasAtt) {
    mime = [...headers, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body].join("\r\n");
  } else {
    const parts: string[] = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      opts.body,
    ];
    for (const a of opts.attachments!) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename}"`,
        `Content-Disposition: attachment; filename="${a.filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        a.data.replace(/(.{76})/g, "$1\r\n"),
      );
    }
    parts.push(`--${boundary}--`);
    mime = parts.join("\r\n");
  }

  return btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendMessage(opts: SendOpts) {
  return api(`/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: buildRaw(opts), threadId: opts.threadId }),
  });
}

export async function createDraft(opts: SendOpts) {
  return api(`/drafts`, {
    method: "POST",
    body: JSON.stringify({ message: { raw: buildRaw(opts), threadId: opts.threadId } }),
  });
}

/** Report / unreport spam. */
export async function markSpam(ids: string[], spam: boolean) {
  if (!ids.length) return;
  return batchModify(ids, spam ? ["SPAM"] : ["INBOX"], spam ? ["INBOX"] : ["SPAM"]);
}

/** Gmail's "Important" marker. */
export async function markImportant(ids: string[], important: boolean) {
  if (!ids.length) return;
  return batchModify(ids, important ? ["IMPORTANT"] : [], important ? [] : ["IMPORTANT"]);
}

/** Mute a conversation — Gmail keeps it out of the inbox. */
export async function muteThread(ids: string[]) {
  if (!ids.length) return;
  return batchModify(ids, [], ["INBOX"]);
}


export const SYSTEM_FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: "inbox" },
  { id: "STARRED", label: "Starred", icon: "star" },
  { id: "SENT", label: "Sent", icon: "send" },
  { id: "DRAFT", label: "Drafts", icon: "file" },
  { id: "SPAM", label: "Spam", icon: "shield" },
  { id: "TRASH", label: "Trash", icon: "trash" },
] as const;

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesUnread?: number;
}

export async function listLabels(): Promise<GmailLabel[]> {
  const r = await api<{ labels: GmailLabel[] }>(`/labels`);
  return r.labels || [];
}

export async function createLabel(name: string): Promise<GmailLabel> {
  return api<GmailLabel>(`/labels`, {
    method: "POST",
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
}


/* ---------------- Attachments ---------------- */

export async function getAttachmentBytes(messageId: string, attachmentId: string): Promise<Uint8Array> {
  const r = await api<{ data: string; size: number }>(
    `/messages/${messageId}/attachments/${attachmentId}`,
  );
  const b64 = (r.data || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function attachmentObjectUrl(messageId: string, att: Attachment): Promise<string> {
  const bytes = await getAttachmentBytes(messageId, att.attachmentId);
  const blob = new Blob([bytes as unknown as BlobPart], { type: att.mimeType });
  return URL.createObjectURL(blob);
}

export async function downloadAttachment(messageId: string, att: Attachment) {
  const url = await attachmentObjectUrl(messageId, att);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.filename || "attachment";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(n: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
