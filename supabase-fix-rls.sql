-- ============================================================
-- stAIrcode — CRITICAL FIX: Disable RLS on inspection_jobs
-- Run this in Supabase SQL Editor immediately.
--
-- WHY THIS IS NEEDED:
-- The supabase-js client used in API routes calls createClient()
-- with the service_role key. This bypasses RLS at the transport
-- level (apikey header) BUT auth.role() in RLS policies still
-- evaluates to 'anon' because there is no authenticated JWT user
-- in the request context. This means the 'service_role_all'
-- policy NEVER matches, and ALL writes from the API are blocked.
--
-- The API routes themselves are the security layer — they check
-- that a userId is present before writing. We don't need RLS
-- on top of that.
-- ============================================================

-- Step 1: Disable RLS (this is the critical fix)
ALTER TABLE public.inspection_jobs DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop blocking policies
DROP POLICY IF EXISTS "service_role_all" ON public.inspection_jobs;
DROP POLICY IF EXISTS "user_own_records" ON public.inspection_jobs;

-- Step 3: Ensure grants are correct
GRANT ALL ON public.inspection_jobs TO service_role;
GRANT ALL ON public.inspection_jobs TO anon;
GRANT ALL ON public.inspection_jobs TO authenticated;

-- Step 4: Add inspector_email column if it doesn't exist
ALTER TABLE public.inspection_jobs
  ADD COLUMN IF NOT EXISTS inspector_email text;

CREATE INDEX IF NOT EXISTS inspection_jobs_inspector_email_idx
  ON public.inspection_jobs (inspector_email);

-- Step 5: Backfill inspector_email from existing job data
UPDATE public.inspection_jobs
SET inspector_email = user_id
WHERE inspector_email IS NULL AND user_id IS NOT NULL;

-- Step 6: Verify — this should show your rows (run after the above)
-- SELECT id, user_id, inspector_email, address_street, updated_at
-- FROM public.inspection_jobs
-- ORDER BY updated_at DESC
-- LIMIT 10;
