import { createServerFn } from "@tanstack/react-start";

/**
 * Cross-device settings sync.
 * The caller proves identity with a Google access token that must have been
 * issued to this app; only then do we touch a row.
 */

const MAX_SETTINGS_BYTES = 256 * 1024;

/** Credential-shaped fields must never be persisted, even if a client sends them. */
const DENY_KEYS = new Set([
  "clientId",
  "geminiKey",
  "accessToken",
  "refreshToken",
  "idToken",
  "apiKey",
  "password",
  "secret",
]);

/** Hard ceiling before parsing, so a huge body never reaches JSON.parse. */
const MAX_RAW_BYTES = 8 * 1024 * 1024;
/** Inline images (data: URLs) are device-local and never worth syncing. */
const MAX_STRING_BYTES = 8 * 1024;

function sanitize(raw: string): Record<string, unknown> {
  if (raw.length > MAX_RAW_BYTES) throw new Error("Your settings are too large to sync.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid settings payload");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid settings payload");
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (DENY_KEYS.has(k)) continue;
    if (typeof v === "function" || typeof v === "symbol") continue;
    // Drop inline images and other oversized strings rather than failing the sync.
    if (typeof v === "string" && (v.startsWith("data:") || v.length > MAX_STRING_BYTES)) continue;
    out[k] = v;
  }
  if (JSON.stringify(out).length > MAX_SETTINGS_BYTES) {
    throw new Error("Your settings are too large to sync across devices.");
  }
  return out;
}

export const pullSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const { verifyGoogleCaller, rateLimit } = await import("./auth.server");
    const { sub } = await verifyGoogleCaller(data.accessToken);
    rateLimit(`pull:${sub}`, 60, 60_000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_settings")
      .select("settings, updated_at")
      .eq("google_sub", sub)
      .maybeSingle();
    if (error) throw new Error("Could not load your synced settings.");
    return {
      settingsJson: row?.settings ? JSON.stringify(row.settings) : null,
      updatedAt: row?.updated_at ?? null,
    };
  });

export const pushSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; settingsJson: string }) => {
    if (typeof d?.settingsJson !== "string") throw new Error("Invalid settings payload");
    return d;
  })
  .handler(async ({ data }) => {
    const { verifyGoogleCaller, rateLimit } = await import("./auth.server");
    const { sub, email } = await verifyGoogleCaller(data.accessToken);
    rateLimit(`push:${sub}`, 60, 60_000);

    const settings = sanitize(data.settingsJson);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("user_settings").upsert(
      { google_sub: sub, email, settings: settings as never, updated_at: updatedAt },
      { onConflict: "google_sub" },
    );
    if (error) throw new Error("Could not save your settings.");
    return { updatedAt };
  });
