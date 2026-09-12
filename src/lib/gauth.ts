import { sessionStore, settingsStore, type AuthSession } from "./store";
import { getPublicClientId } from "./config.functions";

let cachedClientId: string | null = null;

/** Uses the user's own Client ID when set, otherwise the app's built-in one. */
export async function resolveClientId(): Promise<string> {
  const own = settingsStore.get().clientId.trim();
  if (own) return own;
  if (cachedClientId) return cachedClientId;
  try {
    const r = await getPublicClientId();
    cachedClientId = r.clientId || "";
  } catch {
    cachedClientId = "";
  }
  return cachedClientId;
}


declare global {
  interface Window {
    google?: any;
    __gisLoaded?: boolean;
    __gisLoading?: Promise<void>;
  }
}

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
].join(" ");

export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__gisLoaded) return Promise.resolve();
  if (window.__gisLoading) return window.__gisLoading;
  window.__gisLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.__gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return window.__gisLoading;
}

async function fetchProfile(accessToken: string) {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("Failed to fetch profile");
  return r.json();
}

/* ------------------------------------------------------------------ *
 * Long-lived sessions
 *
 * With the app's built-in Google credentials we can use the code flow, which
 * gives the server a refresh token. The browser keeps only an opaque device
 * token, so people stay signed in for weeks instead of one hour.
 * Users who bring their own Client ID fall back to the plain browser flow.
 * ------------------------------------------------------------------ */

const DEVICE_KEY = "omni.device";

function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function setDeviceToken(t: string | null) {
  try {
    if (t) localStorage.setItem(DEVICE_KEY, t);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* private mode: sessions just won't persist */
  }
}

/** True when we're on the app's own credentials, which have a server secret. */
function usesBuiltInClient(): boolean {
  return !settingsStore.get().clientId.trim();
}

function sessionFrom(accessToken: string, expiresIn: number, scope: string, profile: any): AuthSession {
  return {
    accessToken,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
    scope,
    profile: {
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || "",
    },
  };
}

/** Popup code flow: the server ends up holding the refresh token. */
async function signInWithCode(clientId: string): Promise<AuthSession> {
  await loadGis();
  const code = await new Promise<string>((resolve, reject) => {
    const codeClient = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      ux_mode: "popup",
      // Required for Google to hand back a refresh token.
      access_type: "offline",
      prompt: "consent",
      callback: (resp: any) => {
        if (resp.error || !resp.code) reject(new Error(resp.error_description || resp.error || "Sign-in cancelled"));
        else resolve(resp.code);
      },
      error_callback: (e: any) => reject(new Error(e?.message || "Sign-in cancelled")),
    });
    codeClient.requestCode();
  });

  const { exchangeGoogleCode } = await import("./goauth.functions");
  const r = await exchangeGoogleCode({ data: { code } });
  setDeviceToken(r.deviceToken);
  const profile = await fetchProfile(r.accessToken);
  const session = sessionFrom(r.accessToken, r.expiresIn, r.scope, profile);
  sessionStore.replace(session);
  return session;
}

/** Classic in-browser token flow, used for user-supplied Client IDs. */
function signInWithToken(clientId: string, interactive: boolean): Promise<AuthSession> {
  return new Promise<AuthSession>((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      prompt: interactive ? "consent" : "",
      callback: async (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        try {
          const profile = await fetchProfile(resp.access_token);
          const session = sessionFrom(resp.access_token, Number(resp.expires_in), resp.scope, profile);
          sessionStore.replace(session);
          resolve(session);
        } catch (e) {
          reject(e);
        }
      },
      error_callback: (e: any) => reject(new Error(e?.message || "Auth failed")),
    });
    tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

export async function signIn(interactive = true): Promise<AuthSession> {
  const clientId = await resolveClientId();
  if (!clientId) throw new Error("No Google OAuth Client ID is configured. Add one in Settings.");
  await loadGis();
  if (interactive && usesBuiltInClient()) return signInWithCode(clientId);
  return signInWithToken(clientId, interactive);
}

/** Renews the session without any popup. */
export async function refreshSilently(): Promise<AuthSession | null> {
  const device = getDeviceToken();
  if (device) {
    try {
      const { refreshGoogleSession } = await import("./goauth.functions");
      const r = await refreshGoogleSession({ data: { deviceToken: device } });
      const prev = sessionStore.get();
      const profile = prev?.profile ?? (await fetchProfile(r.accessToken));
      const session = sessionFrom(r.accessToken, r.expiresIn, r.scope, profile);
      sessionStore.replace(session);
      return session;
    } catch {
      setDeviceToken(null);
    }
  }
  try {
    return await signIn(false);
  } catch {
    return null;
  }
}

export function signOut() {
  const s = sessionStore.get();
  const device = getDeviceToken();
  if (device) {
    import("./goauth.functions")
      .then(({ endGoogleSession }) => endGoogleSession({ data: { deviceToken: device } }))
      .catch(() => {});
    setDeviceToken(null);
  }
  if (s?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(s.accessToken, () => {});
    } catch {}
  }
  sessionStore.replace(null);
}

/** True when a stored session can be restored without user interaction. */
export function hasPersistentSession(): boolean {
  return !!getDeviceToken();
}

// Wraps a Gmail API call, refreshing on 401.
export async function withAuth<T>(fn: (token: string) => Promise<T>): Promise<T> {
  let s = sessionStore.get();
  if (!s) throw new Error("Not signed in");
  if (Date.now() > s.expiresAt) {
    const r = await refreshSilently();
    if (!r) throw new Error("Session expired. Sign in again.");
    s = r;
  }
  try {
    return await fn(s.accessToken);
  } catch (e: any) {
    if (e?.status === 401) {
      const r = await refreshSilently();
      if (!r) throw e;
      return fn(r.accessToken);
    }
    throw e;
  }
}
