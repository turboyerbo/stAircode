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
