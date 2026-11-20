-- Performance indexes for the Campaigns module (dashboard, leads, email,
-- WhatsApp, voice) plus the vapi_call_logs table now used as the sole
-- source for campaign voice data (vapi_account = 'sarvam').
--
-- All statements are idempotent (IF NOT EXISTS) and safe to run directly
-- against the Supabase SQL editor.

create extension if not exists pg_trgm;

-- ── outreach_leads ──────────────────────────────────────────────────────────
-- Date-range filters: every campaigns dashboard/channel page filters by
-- last_contacted_at (falling back to created_at) for the active date range.
create index if not exists idx_outreach_leads_last_contacted_at
    on public.outreach_leads (last_contacted_at desc);

create index if not exists idx_outreach_leads_last_replied_at
    on public.outreach_leads (last_replied_at desc);

-- Composite: campaign filter + date range is the most common combined shape
-- (campaign dashboard, per-channel stats, leads list).
create index if not exists idx_outreach_leads_campaign_last_contacted
    on public.outreach_leads (campaign_id, last_contacted_at desc);

-- Boolean/status filters used by dashboard + channel stat counts.
create index if not exists idx_outreach_leads_unsubscribed
    on public.outreach_leads (unsubscribed) where unsubscribed = true;

create index if not exists idx_outreach_leads_bounced
    on public.outreach_leads (bounced) where bounced = true;

create index if not exists idx_outreach_leads_whatsapp_status
    on public.outreach_leads (whatsapp_status);

create index if not exists idx_outreach_leads_voice_status
    on public.outreach_leads (voice_status);

create index if not exists idx_outreach_leads_is_enriched
    on public.outreach_leads (is_enriched) where is_enriched = true;

-- Phone-suffix / free-text matching: leads search box, and the campaign
-- voice attribution lookup (vapi_call_logs.customer_phone -> outreach_leads).
create index if not exists idx_outreach_leads_mobile_number_trgm
    on public.outreach_leads using gin (mobile_number gin_trgm_ops);

create index if not exists idx_outreach_leads_mobile_number_2_trgm
    on public.outreach_leads using gin (mobile_number_2 gin_trgm_ops);

create index if not exists idx_outreach_leads_company_phone_trgm
    on public.outreach_leads using gin (company_phone gin_trgm_ops);

create index if not exists idx_outreach_leads_assigned_lead_trgm
    on public.outreach_leads using gin (assigned_lead gin_trgm_ops);

-- ── vapi_call_logs ───────────────────────────────────────────────────────────
-- The campaigns module's voice panels now read exclusively from this table,
-- filtered by vapi_account = 'sarvam' (case-insensitive) and a created_at
-- date range, ordered by started_at.
create index if not exists idx_vapi_call_logs_vapi_account_trgm
    on public.vapi_call_logs using gin (vapi_account gin_trgm_ops);

create index if not exists idx_vapi_call_logs_created_at
    on public.vapi_call_logs (created_at desc);

create index if not exists idx_vapi_call_logs_started_at
    on public.vapi_call_logs (started_at desc);

create index if not exists idx_vapi_call_logs_customer_phone
    on public.vapi_call_logs (customer_phone);

-- ── instantly_lead_replies ───────────────────────────────────────────────────
-- Queried with a reply_timestamp range on every master-dashboard load.
create index if not exists idx_instantly_lead_replies_reply_timestamp
    on public.instantly_lead_replies (reply_timestamp desc);

-- ── RPCs ─────────────────────────────────────────────────────────────────────
-- "Active Campaigns" count used by the Campaigns dashboard and master
-- dashboard, regardless of the selected date range (a campaign isn't a
-- time-boxed concept the way sent/replied counts are).
create or replace function public.get_active_campaigns_count()
returns integer
language sql
stable
as $$
    select count(distinct campaign_id)::integer from public.outreach_leads;
$$;

-- Date-filtered dashboard stats in ONE query (one sequential/index-assisted
-- scan with multiple FILTER aggregates) instead of 9 separate round trips —
-- the previous JS-side Promise.all of 9 head-count queries was the main
-- reason /api/campaigns/dashboard was slow and, under concurrent page load,
-- occasionally timed out into a 500. Mirrors get_campaigns_dashboard_stats()'s
-- semantics but scoped to [p_from, p_to].
create or replace function public.get_campaigns_dashboard_stats_filtered(p_from timestamptz, p_to timestamptz)
returns table (
    total_leads integer,
    total_campaigns integer,
    email_sent integer,
    email_replied integer,
    unsubscribed integer,
    bounced integer,
    whatsapp_active integer,
    voice_active integer,
    contacted integer,
    new_leads integer
)
language sql
stable
as $$
    select
        count(*) filter (
            where (t.created_at between p_from and p_to)
               or (t.last_contacted_at between p_from and p_to)
               or (t.last_replied_at between p_from and p_to)
        )::integer as total_leads,
        count(distinct t.campaign_id)::integer as total_campaigns,
        count(*) filter (where t.outreach_channels @> '["email"]'::jsonb and t.last_contacted_at between p_from and p_to)::integer as email_sent,
        count(*) filter (where t.outreach_channels @> '["email"]'::jsonb and t.last_replied_at between p_from and p_to)::integer as email_replied,
        count(*) filter (where t.unsubscribed and t.last_contacted_at between p_from and p_to)::integer as unsubscribed,
        count(*) filter (where t.bounced and t.last_contacted_at between p_from and p_to)::integer as bounced,
        count(*) filter (where t.outreach_channels @> '["whatsapp"]'::jsonb and t.last_contacted_at between p_from and p_to)::integer as whatsapp_active,
        count(*) filter (where t.outreach_channels @> '["voice"]'::jsonb and t.last_contacted_at between p_from and p_to)::integer as voice_active,
        count(*) filter (where t.last_contacted_at between p_from and p_to)::integer as contacted,
        count(*) filter (where t.created_at between p_from and p_to)::integer as new_leads
    from public.outreach_leads t;
$$;
