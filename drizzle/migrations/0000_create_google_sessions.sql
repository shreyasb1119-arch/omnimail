CREATE TABLE public.google_sessions (
  token_hash text PRIMARY KEY,
  google_sub text NOT NULL,
  email text,
  refresh_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX google_sessions_sub_idx ON public.google_sessions (google_sub);

-- Server-only table: browsers must never be able to read refresh tokens.
REVOKE ALL ON public.google_sessions FROM anon, authenticated;
GRANT ALL ON public.google_sessions TO service_role;

ALTER TABLE public.google_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to google_sessions"
ON public.google_sessions AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);