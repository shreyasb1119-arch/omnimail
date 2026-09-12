# Security hardening pass

Goal: close the real openings in the app and re-verify that the saved-settings table is locked correctly.

## What I found

**The database side is already locked down.** The `user_settings` table has row-level security on, and a restrictive rule denies every read and write to browsers for all four operations. Only the app's own secure server can touch it. The security scanner reports no issues.

**The genuine weak spot is elsewhere: the AI endpoint is open to anyone.** The address your app calls to run AI features accepts requests from any person on the internet, with no sign-in check and no limits. Someone who finds it could run unlimited AI requests on your account. This is the single highest-value fix.

## What I'll do

1. **Require sign-in on the AI endpoint.** It will verify the caller's Google session before doing anything, exactly the way the settings sync already does. Anonymous requests get rejected.

2. **Confirm requests come from your app, not someone else's.** Right now any Google token would be accepted. I'll check that the token was actually issued to Omni Mail before trusting it.

3. **Add per-person rate limits.** A cap on AI requests per minute so one account (or a stolen token) can't drain credits.

4. **Bound what gets accepted and stored.** Size caps and shape checks on prompts and on the settings blob, so nothing oversized or malformed can be pushed into your database.

5. **Stop errors from leaking internals.** Failures will return a short message instead of raw upstream text.

6. **Protect the personal Gemini key.** Today it sits in plain browser storage. I'll keep it out of anything synced or logged, add a clear warning and a one-click "forget this key" control, and default people toward the built-in AI that needs no key at all.

7. **Re-verify the database.** Re-read the live rules and permissions on the settings table after the changes and confirm, with an actual check, that a browser still cannot read or write it.

## Technical notes

- `lovableAiChat` in `src/lib/ai.functions.ts` gains Google token verification (shared helper extracted from `sync.functions.ts`), an `aud` claim check against `GOOGLE_OAUTH_CLIENT_ID` via Google `tokeninfo`, and an in-memory sliding-window limiter keyed by `sub`.
- `sync.functions.ts`: same `aud` check, a byte cap on `settingsJson`, guarded `JSON.parse`, and a key denylist so credential-shaped fields never persist.
- No schema migration needed; the existing restrictive policy plus revoked grants on `public.user_settings` is correct. Verification is a live read attempt with the anon key.
- Note: the limiter is per worker instance, not global — it blunts abuse rather than eliminating it. A durable limit would need a database table; say the word and I'll add one.
