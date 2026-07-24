import { sessionStore, settingsStore, type AuthSession } from "./store";

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

export async function signIn(interactive = true): Promise<AuthSession> {
  const { clientId } = settingsStore.get();
  if (!clientId) throw new Error("Add your Google OAuth Client ID in Settings first.");
  await loadGis();

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
          const session: AuthSession = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + (Number(resp.expires_in) - 60) * 1000,
            scope: resp.scope,
            profile: {
              email: profile.email,
              name: profile.name || profile.email,
              picture: profile.picture || "",
            },
          };
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

// Silent refresh: try to renew without a consent popup.
export async function refreshSilently(): Promise<AuthSession | null> {
  try {
    const sess = await signIn(false);
    return sess;
  } catch {
    return null;
  }
}

export function signOut() {
  const s = sessionStore.get();
  if (s?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(s.accessToken, () => {});
    } catch {}
  }
  sessionStore.replace(null);
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
