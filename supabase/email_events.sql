-- ── stAIrcode Email Events Table ─────────────────────────────────────────────
-- Run this in Supabase → SQL Editor
--
-- Stores every Resend email event for beta engagement analytics.
-- PostHog gets the events too, but this gives you a queryable DB record.

create table if not exists email_events (
  id               uuid primary key default gen_random_uuid(),
  resend_email_id  text not null,          -- Resend's email ID (re_xxxxx)
  event_type       text not null,          -- email.sent / email.delivered / email.opened etc.
  recipient        text not null,          -- to: address
  subject          text,                   -- email subject line
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Index for fast lookup by recipient (most common query)
create index if not exists email_events_recipient_idx on email_events (recipient);

-- Index for event type queries (e.g. "all bounces")
create index if not exists email_events_type_idx on email_events (event_type);

-- Index for email ID (linking events to a specific send)
create index if not exists email_events_email_id_idx on email_events (resend_email_id);

-- ── Useful queries for beta analysis ─────────────────────────────────────────

-- Open rate by email type (subject line)
-- select subject, 
--        count(*) filter (where event_type = 'email.delivered') as delivered,
--        count(*) filter (where event_type = 'email.opened')    as opened,
--        round(100.0 * count(*) filter (where event_type = 'email.opened') 
--              / nullif(count(*) filter (where event_type = 'email.delivered'), 0), 1) as open_rate_pct
-- from email_events
-- group by subject
-- order by delivered desc;

-- All bounced emails (clean your list)
-- select recipient, occurred_at from email_events
-- where event_type = 'email.bounced'
-- order by occurred_at desc;

-- Users who opened the report email (engaged beta testers)
-- select distinct recipient from email_events
-- where event_type = 'email.opened'
-- and subject ilike '%Compliance Report%';


-- ── Report Usage Tracking ──────────────────────────────────────────────────────
-- Tracks how many free reports each email address has generated.
-- Used to enforce the 1 free report per email trial limit.

create table if not exists report_usage (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  report_count integer not null default 1,
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now()
);

-- Unique index — one row per email
create unique index if not exists report_usage_email_idx on report_usage (lower(email));

-- Upsert helper: increment count or insert on first use
-- Usage: call this after every successful free report generation
-- insert into report_usage (email, report_count, first_at, last_at)
-- values ($1, 1, now(), now())
-- on conflict (lower(email)) do update
--   set report_count = report_usage.report_count + 1,
--       last_at = now();

-- Check if an email has used their free trial:
-- select report_count from report_usage where lower(email) = lower($1);


-- ── increment_report_usage RPC ────────────────────────────────────────────────
-- Called server-side after every successful free report generation.
-- Upserts the row and increments count atomically.

create or replace function increment_report_usage(user_email text)
returns void
language plpgsql
security definer
as $$
begin
  insert into report_usage (email, report_count, first_at, last_at)
  values (lower(user_email), 1, now(), now())
  on conflict (lower(email)) do update
    set report_count = report_usage.report_count + 1,
        last_at = now();
end;
$$;


-- ── Scan Usage Tracking ────────────────────────────────────────────────────────
-- Tracks how many free scans each authenticated user has run.
-- A "scan" = one complete vision API call sequence (1 scan = up to 6 AI calls).
-- We count completed scans (when the user reaches the report screen), not raw API calls.

create table if not exists scan_usage (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  scan_count   integer not null default 1,
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now(),
  is_pro       boolean not null default false   -- true after Pro purchase
);

-- Unique index — one row per email
create unique index if not exists scan_usage_email_idx on scan_usage (lower(email));

-- ── increment_scan_usage RPC ──────────────────────────────────────────────────
-- Called server-side after every completed scan (when report is generated).
-- Upserts atomically.

create or replace function increment_scan_usage(user_email text)
returns void
language plpgsql
security definer
as $$
begin
  insert into scan_usage (email, scan_count, first_at, last_at)
  values (lower(user_email), 1, now(), now())
  on conflict (lower(email)) do update
    set scan_count = scan_usage.scan_count + 1,
        last_at = now();
end;
$$;

-- ── get_scan_usage RPC ────────────────────────────────────────────────────────
-- Returns the current scan count for an email, or 0 if not found.

create or replace function get_scan_usage(user_email text)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  select scan_count into v_count
  from scan_usage
  where lower(email) = lower(user_email);
  return coalesce(v_count, 0);
end;
$$;

-- ── unlock_pro_scans RPC ──────────────────────────────────────────────────────
-- Called by the Stripe webhook after a Pro subscription payment succeeds.
-- Sets is_pro=true so the scan limit check is bypassed for this user.

create or replace function unlock_pro_scans(user_email text)
returns void
language plpgsql
security definer
as $$
begin
  insert into scan_usage (email, scan_count, first_at, last_at, is_pro)
  values (lower(user_email), 0, now(), now(), true)
  on conflict (lower(email)) do update
    set is_pro = true,
        last_at = now();
end;
$$;
