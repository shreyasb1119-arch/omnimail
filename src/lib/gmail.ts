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

function walkParts(payload: any, out: { text: string; html: string }) {
  if (!payload) return;
  const mime = payload.mimeType || "";
  if (payload.body?.data) {
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
  const parts = { text: "", html: "" };
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

export async function sendMessage(opts: { to: string; subject: string; body: string; cc?: string; bcc?: string; threadId?: string }) {
  const lines = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : null,
    opts.bcc ? `Bcc: ${opts.bcc}` : null,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    opts.body,
  ].filter(Boolean);
  const raw = btoa(unescape(encodeURIComponent(lines.join("\r\n"))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return api(`/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw, threadId: opts.threadId }),
  });
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

