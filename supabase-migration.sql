-- ============================================================
-- stAIrcode — Inspection Jobs Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Creates:
--   inspection_jobs      — project-level records (one per building inspection)
--   inspection_photos    — photo storage index (photos stored in Supabase Storage)
--
-- Also adds subscription columns to profiles if they don't exist.
-- ============================================================

-- ── 1. inspection_jobs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_jobs (
  id                 text        PRIMARY KEY,
  user_id            text,
  client_name        text,
  inspector_name     text,
  inspector_email    text,
  address_street     text,
  address_city       text,
  address_province   text,
  address_country    text,
  building_type      text,
  estimated_age      text,
  status             text        DEFAULT 'active',
  phase_progress     integer     DEFAULT 0,
  active_phase       text,
  permit_number      text,
  inspection_date    text,
  report_url         text,
  job_json           jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Index for quick lookups by user/inspector
CREATE INDEX IF NOT EXISTS inspection_jobs_user_id_idx  ON public.inspection_jobs (user_id);
CREATE INDEX IF NOT EXISTS inspection_jobs_email_idx    ON public.inspection_jobs (inspector_email);
CREATE INDEX IF NOT EXISTS inspection_jobs_updated_idx  ON public.inspection_jobs (updated_at DESC);

-- Row-level security (allow service role full access; users can only see their own)
ALTER TABLE public.inspection_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all"  ON public.inspection_jobs;
DROP POLICY IF EXISTS "user_own_records"  ON public.inspection_jobs;

CREATE POLICY "service_role_all" ON public.inspection_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read/write their own jobs (by user_id or inspector_email)
CREATE POLICY "user_own_records" ON public.inspection_jobs
  FOR ALL USING (
    user_id = auth.uid()::text
    OR inspector_email = auth.email()
  );

-- ── 2. inspection_photos ─────────────────────────────────────────────────────
-- Index table for photos stored in Supabase Storage bucket "inspection-photos"
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id           text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id       text        REFERENCES public.inspection_jobs(id) ON DELETE CASCADE,
  phase_id     text,
  module_id    text,
  storage_path text        NOT NULL,   -- path in Storage bucket: job_id/phase/module/n.jpg
  caption      text,
  ai_analysis  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_photos_job_idx ON public.inspection_photos (job_id);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_photos" ON public.inspection_photos;
CREATE POLICY "service_role_photos" ON public.inspection_photos
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. profiles — add subscription columns if missing ────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership             text        DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_active    boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_start     timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- ── 4. Storage buckets ────────────────────────────────────────────────────────
-- Run these in the Supabase Storage UI or via the management API.
-- They can't be created via SQL in all Supabase tiers.
--
-- Bucket 1: "reports"         — PDF compliance reports (already created)
-- Bucket 2: "inspection-photos" — per-module inspection photos
--
-- Both should be private (not public) unless you want direct CDN links.
-- Use signed URLs (storage.getSignedUrl) for temporary access.

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running this, go to Supabase → Storage → Create Bucket:
--   Name: inspection-photos
--   Public: false (private)
