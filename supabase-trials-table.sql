-- ============================================================
-- stAIrcode — trials table
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trials (
  email        text        PRIMARY KEY,
  code         text        NOT NULL,
  trial_start  timestamptz NOT NULL DEFAULT now(),
  trial_end    timestamptz NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trials DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.trials TO service_role, anon, authenticated;

CREATE INDEX IF NOT EXISTS trials_active_idx ON public.trials (active);
CREATE INDEX IF NOT EXISTS trials_end_idx    ON public.trials (trial_end);

-- Verify:
-- SELECT email, trial_start, trial_end, active FROM public.trials ORDER BY created_at DESC LIMIT 20;
