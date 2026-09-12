/**
 * Server-only helpers: verify that a caller is a real, signed-in Omni Mail user
 * and keep abusive traffic off the AI gateway.
 */

type TokenInfo = {
  sub?: string;
  aud?: string;
  azp?: string;
  email?: string;
  expires_in?: string;
};

export class SessionExpiredError extends Error {
  constructor() {
    super("Your Google session expired. Sign out and sign in again.");
    this.name = "SessionExpiredError";
  }
}


/**
 * Verifies a Google OAuth access token AND that it was issued to this app.
 * Without the audience check any Google token from any app would be accepted.
 */
export async function verifyGoogleCaller(
  accessToken: unknown,
): Promise<{ sub: string; email: string | null }> {
  if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 4096) {
    throw new SessionExpiredError();
  }

  // The client may hold either an OAuth access token or an ID token; accept both.
  const params = [`access_token=${encodeURIComponent(accessToken)}`];
  if (accessToken.split(".").length === 3) params.unshift(`id_token=${encodeURIComponent(accessToken)}`);

  let info: TokenInfo | null = null;
  for (const p of params) {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?${p}`);
    if (!r.ok) continue;
    const parsed = (await r.json()) as TokenInfo;
    if (parsed.sub) {
      info = parsed;
      break;
    }
  }
  // An expired/invalid token is a normal, recoverable state — not a server fault.
  if (!info?.sub) throw new SessionExpiredError();

  const expectedAud = process.env['GOOGLE_OAUTH_CLIENT_ID'];
  if (expectedAud && info.aud !== expectedAud && info.azp !== expectedAud) {
    throw new SessionExpiredError();
  }

  return { sub: info.sub, email: info.email ?? null };
}

/**
 * Sliding-window limiter. Per worker instance, so it blunts abuse rather than
 * eliminating it — a durable limit would need a database table.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new Error("Too many requests. Slow down and try again shortly.");
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t > windowMs)) hits.delete(k);
  }
}
