import { createServerFn } from "@tanstack/react-start";

/** Public Google OAuth Web Client ID — publishable by design. */
export const getPublicClientId = createServerFn({ method: "GET" }).handler(async () => {
  return { clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "" };
});
