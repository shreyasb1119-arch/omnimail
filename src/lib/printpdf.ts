/** Open a print window (Save as PDF) for arbitrary HTML content. */
function printHtml(title: string, inner: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;margin:40px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px}
  .meta{color:#666;font-size:12px;margin-bottom:20px}
  img{max-width:100%;height:auto}
  pre{white-space:pre-wrap;font-family:inherit}
</style></head><body>${inner}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 400);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export function printMessageAsPdf(msg: {
  subject: string;
  from: string;
  to: string;
  date: number;
  bodyHtml: string;
  bodyText: string;
}) {
  const body = msg.bodyHtml || `<pre>${escapeHtml(msg.bodyText)}</pre>`;
  printHtml(
    msg.subject || "Email",
    `<h1>${escapeHtml(msg.subject || "(no subject)")}</h1>
     <div class="meta">${escapeHtml(msg.from)} → ${escapeHtml(msg.to)}<br/>${new Date(msg.date).toLocaleString()}</div>
     ${body}`,
  );
}

export function printImageAsPdf(url: string, filename: string) {
  printHtml(filename, `<h1>${escapeHtml(filename)}</h1><img src="${url}" />`);
}

export function printTextAsPdf(title: string, text: string) {
  printHtml(title, `<h1>${escapeHtml(title)}</h1><pre>${escapeHtml(text)}</pre>`);
}
