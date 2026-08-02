import { createServerFn } from "@tanstack/react-start";

/**
 * Cross-device settings sync.
 * The caller proves identity with their Google access token, which we verify
 * against Google's tokeninfo/userinfo endpoint before touching any row.
 */
async function identify(accessToken: string) {
  if (!accessToken || accessToken.length < 20) throw new Error("Unauthorized");
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("Unauthorized");
  const p = (await r.json()) as { sub?: string; email?: string };
  if (!p.sub) throw new Error("Unauthorized");
  return { sub: p.sub, email: p.email ?? null };
}

export const pullSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const { sub } = await identify(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_settings")
      .select("settings, updated_at")
      .eq("google_sub", sub)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      settingsJson: row?.settings ? JSON.stringify(row.settings) : null,
      updatedAt: row?.updated_at ?? null,
    };
  });

export const pushSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; settingsJson: string }) => d)
  .handler(async ({ data }) => {
    const { sub, email } = await identify(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("user_settings").upsert(
      { google_sub: sub, email, settings: JSON.parse(data.settingsJson) as never, updated_at: updatedAt },
      { onConflict: "google_sub" },
    );
    if (error) throw new Error(error.message);
    return { updatedAt };
  });
