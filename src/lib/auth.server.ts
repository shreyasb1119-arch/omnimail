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
    throw new Error("Unauthorized");
  }
  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!r.ok) throw new Error("Unauthorized");
  const info = (await r.json()) as TokenInfo;
  if (!info.sub) throw new Error("Unauthorized");

  const expectedAud = process.env['GOOGLE_OAUTH_CLIENT_ID'];
  if (expectedAud && info.aud !== expectedAud) throw new Error("Unauthorized");

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
