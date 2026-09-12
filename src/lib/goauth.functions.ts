import { createServerFn } from "@tanstack/react-start";

/**
 * Long-lived Google sessions.
 *
 * Sign-in returns a one-time code; the server swaps it for a refresh token and
 * keeps it. The browser only ever holds a random device token, which it can
 * trade for a fresh access token for as long as the user leaves access granted.
 */

function requireDeviceToken(t: unknown): string {
  if (typeof t !== "string" || t.length < 32 || t.length > 256) {
    throw new Error("Your Google session ended. Sign in again.");
  }
  return t;
}

export const exchangeGoogleCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; redirectUri?: string }) => {
    if (typeof d?.code !== "string" || d.code.length < 10 || d.code.length > 4096) {
      throw new Error("Sign-in could not be completed. Try again.");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const { exchangeCode, sha256Hex, newDeviceToken } = await import("./goauth.server");
    const { verifyGoogleCaller, rateLimit } = await import("./auth.server");

    const tokens = await exchangeCode(data.code, data.redirectUri || "postmessage");
    const { sub, email } = await verifyGoogleCaller(tokens.access_token!);
    rateLimit(`exchange:${sub}`, 20, 60_000);

    let deviceToken: string | null = null;
    if (tokens.refresh_token) {
      deviceToken = newDeviceToken();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("google_sessions").insert({
        token_hash: await sha256Hex(deviceToken),
        google_sub: sub,
        email,
        refresh_token: tokens.refresh_token,
      });
      if (error) deviceToken = null; // Sign-in still works; it just won't persist.
    }

    return {
      deviceToken,
      accessToken: tokens.access_token!,
      expiresIn: Number(tokens.expires_in ?? 3600),
      scope: tokens.scope ?? "",
    };
  });

export const refreshGoogleSession = createServerFn({ method: "POST" })
  .inputValidator((d: { deviceToken: string }) => ({ deviceToken: requireDeviceToken(d?.deviceToken) }))
  .handler(async ({ data }) => {
    const { refreshAccessToken, sha256Hex, ReauthRequiredError } = await import("./goauth.server");
    const { rateLimit } = await import("./auth.server");

    const hash = await sha256Hex(data.deviceToken);
    rateLimit(`refresh:${hash}`, 30, 60_000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("google_sessions")
      .select("refresh_token")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!row?.refresh_token) throw new ReauthRequiredError();

    try {
      const tokens = await refreshAccessToken(row.refresh_token);
      await supabaseAdmin
        .from("google_sessions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("token_hash", hash);
      return {
        accessToken: tokens.access_token!,
        expiresIn: Number(tokens.expires_in ?? 3600),
        scope: tokens.scope ?? "",
      };
    } catch (e) {
      // The user revoked access, or the grant expired: drop the dead row.
      if (e instanceof ReauthRequiredError) {
        await supabaseAdmin.from("google_sessions").delete().eq("token_hash", hash);
      }
      throw e;
    }
  });

export const endGoogleSession = createServerFn({ method: "POST" })
  .inputValidator((d: { deviceToken: string }) => ({ deviceToken: requireDeviceToken(d?.deviceToken) }))
  .handler(async ({ data }) => {
    const { sha256Hex, revokeToken } = await import("./goauth.server");
    const hash = await sha256Hex(data.deviceToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("google_sessions")
      .select("refresh_token")
      .eq("token_hash", hash)
      .maybeSingle();
    if (row?.refresh_token) await revokeToken(row.refresh_token);
    await supabaseAdmin.from("google_sessions").delete().eq("token_hash", hash);
    return { ok: true };
  });
