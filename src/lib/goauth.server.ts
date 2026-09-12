/**
 * Server-only helpers for the long-lived Google session.
 *
 * The browser never sees a refresh token. It holds an opaque device token; we
 * store only its SHA-256 hash alongside the refresh token, so a database leak
 * alone cannot be replayed against Google without the device token itself.
 */

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newDeviceToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

function credentials() {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Staying signed in isn't available right now.");
  }
  return { clientId, clientSecret };
}

export class ReauthRequiredError extends Error {
  constructor() {
    super("Your Google session ended. Sign in again.");
    this.name = "ReauthRequiredError";
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await r.json().catch(() => ({}))) as TokenResponse;
  if (!r.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new ReauthRequiredError();
    throw new Error("Google refused the sign-in. Try again.");
  }
  return json;
}

/** Trades a one-time authorization code for an access token + refresh token. */
export async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

/** Mints a fresh access token from a stored refresh token. */
export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
}

export async function revokeToken(token: string) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    /* Revocation is best-effort; the row is deleted regardless. */
  }
}
