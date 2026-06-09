-- ============================================================
-- stAIrcode — RLS Security Fix
-- Safe version — skips tables that don't exist yet
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ── 1. inspection_jobs ───────────────────────────────────────
ALTER TABLE public.inspection_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all"  ON public.inspection_jobs;
DROP POLICY IF EXISTS "user_own_records"  ON public.inspection_jobs;
DROP POLICY IF EXISTS "anon_all"          ON public.inspection_jobs;
DROP POLICY IF EXISTS "owner_select"      ON public.inspection_jobs;
DROP POLICY IF EXISTS "owner_insert"      ON public.inspection_jobs;
DROP POLICY IF EXISTS "owner_update"      ON public.inspection_jobs;
DROP POLICY IF EXISTS "owner_delete"      ON public.inspection_jobs;

CREATE POLICY "owner_select" ON public.inspection_jobs
  FOR SELECT USING (
    auth.jwt() ->> 'email' = user_id OR
    auth.jwt() ->> 'email' = inspector_email
  );

CREATE POLICY "owner_insert" ON public.inspection_jobs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' = user_id OR
    auth.jwt() ->> 'email' = inspector_email
  );

CREATE POLICY "owner_update" ON public.inspection_jobs
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = user_id OR
    auth.jwt() ->> 'email' = inspector_email
  );

CREATE POLICY "owner_delete" ON public.inspection_jobs
  FOR DELETE USING (
    auth.jwt() ->> 'email' = user_id OR
    auth.jwt() ->> 'email' = inspector_email
  );

REVOKE ALL ON public.inspection_jobs FROM anon;
GRANT ALL   ON public.inspection_jobs TO authenticated;
GRANT ALL   ON public.inspection_jobs TO service_role;


-- ── 2. inspection_photos (only if it exists) ──────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='inspection_photos') THEN
    ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "service_role_photos"    ON public.inspection_photos;
    DROP POLICY IF EXISTS "owner_photos_select"    ON public.inspection_photos;
    DROP POLICY IF EXISTS "owner_photos_insert"    ON public.inspection_photos;
    DROP POLICY IF EXISTS "owner_photos_delete"    ON public.inspection_photos;

    CREATE POLICY "owner_photos_select" ON public.inspection_photos
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.inspection_jobs j
          WHERE j.id = inspection_photos.job_id
            AND (auth.jwt() ->> 'email' = j.user_id OR auth.jwt() ->> 'email' = j.inspector_email)
        )
      );
    CREATE POLICY "owner_photos_insert" ON public.inspection_photos
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.inspection_jobs j
          WHERE j.id = inspection_photos.job_id
            AND (auth.jwt() ->> 'email' = j.user_id OR auth.jwt() ->> 'email' = j.inspector_email)
        )
      );
    CREATE POLICY "owner_photos_delete" ON public.inspection_photos
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.inspection_jobs j
          WHERE j.id = inspection_photos.job_id
            AND (auth.jwt() ->> 'email' = j.user_id OR auth.jwt() ->> 'email' = j.inspector_email)
        )
      );

    REVOKE ALL ON public.inspection_photos FROM anon;
    GRANT ALL   ON public.inspection_photos TO authenticated;
    GRANT ALL   ON public.inspection_photos TO service_role;
  END IF;
END $$;


-- ── 3. trials (only if it exists) ────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='trials') THEN
    ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_all"           ON public.trials;
    DROP POLICY IF EXISTS "owner_trial_select" ON public.trials;
    CREATE POLICY "owner_trial_select" ON public.trials
      FOR SELECT USING (auth.jwt() ->> 'email' = email);
    REVOKE ALL    ON public.trials FROM anon;
    GRANT SELECT  ON public.trials TO authenticated;
    GRANT ALL     ON public.trials TO service_role;
  END IF;
END $$;


-- ── 4. scan_usage (only if it exists) ────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='scan_usage') THEN
    ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "owner_scan_select" ON public.scan_usage;
    CREATE POLICY "owner_scan_select" ON public.scan_usage
      FOR SELECT USING (lower(auth.jwt() ->> 'email') = lower(email));
    REVOKE ALL    ON public.scan_usage FROM anon;
    GRANT SELECT  ON public.scan_usage TO authenticated;
    GRANT ALL     ON public.scan_usage TO service_role;
  END IF;
END $$;


-- ── 5. report_usage (only if it exists) ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='report_usage') THEN
    ALTER TABLE public.report_usage ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "owner_report_usage_select" ON public.report_usage;
    CREATE POLICY "owner_report_usage_select" ON public.report_usage
      FOR SELECT USING (lower(auth.jwt() ->> 'email') = lower(email));
    REVOKE ALL    ON public.report_usage FROM anon;
    GRANT SELECT  ON public.report_usage TO authenticated;
    GRANT ALL     ON public.report_usage TO service_role;
  END IF;
END $$;


-- ── 6. email_events (only if it exists) ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='email_events') THEN
    ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "deny_all_direct" ON public.email_events;
    CREATE POLICY "deny_all_direct" ON public.email_events
      FOR ALL USING (false);
    REVOKE ALL ON public.email_events FROM anon;
    REVOKE ALL ON public.email_events FROM authenticated;
    GRANT ALL  ON public.email_events TO service_role;
  END IF;
END $$;


-- ── 7. profiles (only if it exists) ──────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "owner_profile"        ON public.profiles;
    DROP POLICY IF EXISTS "owner_profile_select" ON public.profiles;
    DROP POLICY IF EXISTS "owner_profile_update" ON public.profiles;
    CREATE POLICY "owner_profile_select" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "owner_profile_update" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
    REVOKE ALL          ON public.profiles FROM anon;
    GRANT SELECT,UPDATE ON public.profiles TO authenticated;
    GRANT ALL           ON public.profiles TO service_role;
  END IF;
END $$;


-- ── Verify — run this after to confirm ───────────────────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
