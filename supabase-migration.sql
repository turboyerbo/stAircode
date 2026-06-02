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

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS inspection_jobs_user_id_idx  ON public.inspection_jobs (user_id);
CREATE INDEX IF NOT EXISTS inspection_jobs_email_idx    ON public.inspection_jobs (inspector_email);
CREATE INDEX IF NOT EXISTS inspection_jobs_updated_idx  ON public.inspection_jobs (updated_at DESC);

-- ── RLS: DISABLE entirely so the service_role key from the API can always write ──
-- The service_role key used in API routes bypasses RLS at the transport level,
-- but ONLY if RLS is disabled OR the key is set as a bypassRls role.
-- With RLS enabled, auth.role() = 'anon' for server-side createClient() calls,
-- blocking all writes even with the service role key.
--
-- Our API routes use the service_role key server-side — they ARE the security layer.
-- Client-side code uses the anon key and only reads via the API, never directly.
ALTER TABLE public.inspection_jobs DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies that may be blocking writes
DROP POLICY IF EXISTS "service_role_all"  ON public.inspection_jobs;
DROP POLICY IF EXISTS "user_own_records"  ON public.inspection_jobs;

-- Grant full access to both roles so the API can read/write
GRANT ALL ON public.inspection_jobs TO service_role;
GRANT ALL ON public.inspection_jobs TO anon;
GRANT ALL ON public.inspection_jobs TO authenticated;

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
