-- Campaigns module perf fix.
--
-- Problem: app/dashboard/campaigns/* (Dashboard, Leads, Email, WhatsApp,
-- Voice sub-pages) all funneled through lib/services/campaigns.ts ->
-- getOutreachLeads(), which paginated through EVERY row of outreach_leads
-- (13k+ rows) selecting all 10 email_N HTML bodies + all 10
-- email_status_N jsonb blobs + email_reply per row (~1KB/row, ~13MB total),
-- then did filtering/search/pagination/aggregation in Node/the browser.
-- That's a 13-15s+ load on every one of those pages.
--
-- Fix: push aggregation (dashboard counts) and filtering/pagination (list
-- pages) into Postgres via RPCs, so only the current page's worth of thin
-- rows ever leaves the database, and full per-lead detail (email bodies,
-- replies, step statuses) is fetched on-demand for one lead at a time.
--
-- Table confirmed live via the project's REST API before writing this:
-- public.outreach_leads, 13,691 rows, columns include full_name, email,
-- mobile_number, linkedin_url, company_name, city, country, campaign_id,
-- campaign_key, outreach_channels (jsonb array), lead_status,
-- whatsapp_status, voice_status, unsubscribed, bounced, last_contacted_at,
-- created_at, email_1..email_10 (HTML bodies), email_status_1..10 (jsonb,
-- each with a "status" + "campaign_name" key), email_reply (jsonb array or
-- null) — exactly what lib/services/campaigns.ts (pre-fix) was reading via
-- getOutreachLeads()/LEAD_SELECT.
--
-- NOTE on ordering: every helper function below MUST be created before any
-- function that calls it — `language sql` function bodies are validated
-- against the catalog at CREATE time, so a forward reference here (a
-- get_campaigns_* function defined above its _outreach_* helper) fails with
-- "function ... does not exist" even though both are in the same file. This
-- file is ordered helpers-first for that reason; keep it that way if you
-- add more.

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Helpers (must exist before anything below references them)
-- ────────────────────────────────────────────────────────────────────────────

-- Number of email_status_N entries with a non-empty "status" key.
-- SQL function (not plpgsql) so it inlines cleanly into FILTER clauses
-- instead of being called once per row via a slow row-by-row path.
create or replace function public._outreach_email_sent_count(t public.outreach_leads)
returns integer
language sql
immutable
as $$
    select (
        (case when coalesce(t.email_status_1 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_2 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_3 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_4 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_5 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_6 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_7 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_8 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_9 ->> 'status', '') <> '' then 1 else 0 end) +
        (case when coalesce(t.email_status_10 ->> 'status', '') <> '' then 1 else 0 end)
    );
$$;

-- Whether email_reply (jsonb, either null or a json array) has at least one entry.
create or replace function public._outreach_has_email_reply(t public.outreach_leads)
returns boolean
language sql
immutable
as $$
    select case
        when t.email_reply is null then false
        when jsonb_typeof(t.email_reply) <> 'array' then false
        else jsonb_array_length(t.email_reply) > 0
    end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Dashboard aggregate stats + per-campaign summaries (no row bodies)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.get_campaigns_dashboard_stats()
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
        count(*)::integer as total_leads,
        count(distinct campaign_id)::integer as total_campaigns,
        count(*) filter (where public._outreach_email_sent_count(t) > 0)::integer as email_sent,
        count(*) filter (where public._outreach_has_email_reply(t))::integer as email_replied,
        count(*) filter (where unsubscribed)::integer as unsubscribed,
        count(*) filter (where bounced)::integer as bounced,
        count(*) filter (where whatsapp_status is not null and whatsapp_status <> '')::integer as whatsapp_active,
        count(*) filter (where voice_status is not null and voice_status <> '')::integer as voice_active,
        count(*) filter (where lead_status = 'contacted')::integer as contacted,
        count(*) filter (where lead_status = 'new')::integer as new_leads
    from public.outreach_leads t;
$$;

-- Per-campaign breakdown (replaces buildCampaignSummaries(), which grouped
-- the full in-memory lead list by campaign_id in JS).
create or replace function public.get_campaigns_summary()
returns table (
    campaign_id text,
    campaign_name text,
    total_leads integer,
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
        coalesce(t.campaign_id::text, 'unknown') as campaign_id,
        coalesce(
            max(t.email_status_1 ->> 'campaign_name') filter (where t.email_status_1 ->> 'campaign_name' is not null),
            max((t.email_reply -> 0) ->> 'campaign_name') filter (where t.email_reply is not null and jsonb_typeof(t.email_reply) = 'array' and jsonb_array_length(t.email_reply) > 0),
            initcap(replace(max(t.campaign_key), '_', ' ')),
            'Campaign ' || coalesce(t.campaign_id::text, 'unknown')
        ) as campaign_name,
        count(*)::integer as total_leads,
        count(*) filter (where public._outreach_email_sent_count(t) > 0)::integer as email_sent,
        count(*) filter (where public._outreach_has_email_reply(t))::integer as email_replied,
        count(*) filter (where t.unsubscribed)::integer as unsubscribed,
        count(*) filter (where t.bounced)::integer as bounced,
        count(*) filter (where t.whatsapp_status is not null and t.whatsapp_status <> '')::integer as whatsapp_active,
        count(*) filter (where t.voice_status is not null and t.voice_status <> '')::integer as voice_active,
        count(*) filter (where t.lead_status = 'contacted')::integer as contacted,
        count(*) filter (where t.lead_status = 'new')::integer as new_leads
    from public.outreach_leads t
    group by coalesce(t.campaign_id::text, 'unknown')
    order by count(*) desc;
$$;

-- Channel-scoped stats for the Email/WhatsApp/Voice campaign sub-pages
-- (each page used to filter the FULL in-memory lead list by
-- outreachChannels and recompute these in JS).
create or replace function public.get_campaigns_channel_stats(p_channel text)
returns table (
    enrolled integer,
    active integer,
    not_started integer,
    email_sent integer,
    email_replied integer,
    unsubscribed integer,
    bounced integer
)
language sql
stable
as $$
    select
        count(*)::integer as enrolled,
        count(*) filter (
            where case p_channel
                when 'whatsapp' then whatsapp_status is not null and whatsapp_status <> ''
                when 'voice' then voice_status is not null and voice_status <> ''
                when 'email' then public._outreach_email_sent_count(t) > 0
                else false
            end
        )::integer as active,
        count(*) filter (
            where not case p_channel
                when 'whatsapp' then whatsapp_status is not null and whatsapp_status <> ''
                when 'voice' then voice_status is not null and voice_status <> ''
                when 'email' then public._outreach_email_sent_count(t) > 0
                else false
            end
        )::integer as not_started,
        count(*) filter (where public._outreach_email_sent_count(t) > 0)::integer as email_sent,
        count(*) filter (where public._outreach_has_email_reply(t))::integer as email_replied,
        count(*) filter (where unsubscribed)::integer as unsubscribed,
        count(*) filter (where bounced)::integer as bounced
    from public.outreach_leads t
    where t.outreach_channels @> to_jsonb(array[p_channel]);
$$;

-- Distinct campaigns represented within one channel's enrolled leads — backs
-- the "Campaign" filter dropdown on the Email/WhatsApp/Voice sub-pages
-- without pulling the full lead list to compute it client-side.
create or replace function public.get_campaigns_channel_campaign_options(p_channel text)
returns table (
    campaign_id text,
    campaign_name text
)
language sql
stable
as $$
    select
        coalesce(t.campaign_id::text, 'unknown') as campaign_id,
        coalesce(
            max(t.email_status_1 ->> 'campaign_name') filter (where t.email_status_1 ->> 'campaign_name' is not null),
            max((t.email_reply -> 0) ->> 'campaign_name') filter (where t.email_reply is not null and jsonb_typeof(t.email_reply) = 'array' and jsonb_array_length(t.email_reply) > 0),
            initcap(replace(max(t.campaign_key), '_', ' ')),
            'Campaign ' || coalesce(t.campaign_id::text, 'unknown')
        ) as campaign_name
    from public.outreach_leads t
    where p_channel is null or p_channel = '' or t.outreach_channels @> to_jsonb(array[p_channel])
    group by coalesce(t.campaign_id::text, 'unknown')
    order by 1;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Paginated, filtered, search-aware leads list (thin columns only — no
--    email_N bodies, no raw_data/custom_fields, no email_reply payload)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.get_campaigns_leads_page(
    p_page integer default 1,
    p_page_size integer default 15,
    p_search text default null,
    p_campaign_ids text[] default null,
    p_channel text default null,      -- 'email' | 'whatsapp' | 'voice' | null (any)
    p_status_filter text[] default null, -- subset of: Sent, Not Sent, Replied, Unsubscribed, Bounced (email-scoped)
    p_active_only boolean default false  -- when p_channel is 'whatsapp'/'voice': only leads with that channel's status populated
)
returns table (
    id uuid,
    full_name text,
    email text,
    mobile_number text,
    linkedin_url text,
    company_name text,
    city text,
    country text,
    campaign_id integer,
    campaign_key text,
    campaign_name text,
    outreach_channels jsonb,
    lead_status text,
    whatsapp_status text,
    voice_status text,
    unsubscribed boolean,
    bounced boolean,
    email_sent_count integer,
    email_replied boolean,
    email_reply_count integer,
    last_email_subject text,
    last_contacted_at timestamptz,
    created_at timestamptz,
    total_count bigint
)
language sql
stable
as $$
    with base as (
        select
            t.*,
            public._outreach_email_sent_count(t) as v_email_sent_count,
            public._outreach_has_email_reply(t) as v_email_replied,
            coalesce(
                t.email_status_1 ->> 'campaign_name',
                (t.email_reply -> 0) ->> 'campaign_name',
                initcap(replace(t.campaign_key, '_', ' ')),
                'Campaign ' || coalesce(t.campaign_id::text, 'unknown')
            ) as v_campaign_name,
            coalesce(
                (select es ->> 'subject' from unnest(array[
                    t.email_status_10, t.email_status_9, t.email_status_8, t.email_status_7, t.email_status_6,
                    t.email_status_5, t.email_status_4, t.email_status_3, t.email_status_2, t.email_status_1
                ]) as es where es ->> 'status' is not null and es ->> 'status' <> '' limit 1),
                null
            ) as v_last_subject
        from public.outreach_leads t
        where
            (p_search is null or p_search = '' or (
                t.full_name ilike '%' || p_search || '%' or
                t.email ilike '%' || p_search || '%' or
                t.mobile_number ilike '%' || p_search || '%' or
                t.company_name ilike '%' || p_search || '%' or
                t.city ilike '%' || p_search || '%' or
                t.country ilike '%' || p_search || '%'
            ))
            and (p_campaign_ids is null or array_length(p_campaign_ids, 1) is null or t.campaign_id::text = any(p_campaign_ids))
            and (p_channel is null or p_channel = '' or t.outreach_channels @> to_jsonb(array[p_channel]))
            and (
                not p_active_only or (
                    case p_channel
                        when 'whatsapp' then t.whatsapp_status is not null and t.whatsapp_status <> ''
                        when 'voice' then t.voice_status is not null and t.voice_status <> ''
                        else true
                    end
                )
            )
    ),
    filtered as (
        select * from base b
        where
            p_status_filter is null or array_length(p_status_filter, 1) is null or (
                ('Sent' = any(p_status_filter) and b.v_email_sent_count > 0) or
                ('Not Sent' = any(p_status_filter) and b.v_email_sent_count = 0) or
                ('Replied' = any(p_status_filter) and b.v_email_replied) or
                ('Unsubscribed' = any(p_status_filter) and b.unsubscribed) or
                ('Bounced' = any(p_status_filter) and b.bounced)
            )
    )
    select
        f.id, f.full_name, f.email, f.mobile_number, f.linkedin_url, f.company_name, f.city, f.country,
        f.campaign_id, f.campaign_key, f.v_campaign_name as campaign_name, f.outreach_channels,
        f.lead_status, f.whatsapp_status, f.voice_status, f.unsubscribed, f.bounced,
        f.v_email_sent_count as email_sent_count, f.v_email_replied as email_replied,
        case when f.email_reply is not null and jsonb_typeof(f.email_reply) = 'array'
             then jsonb_array_length(f.email_reply) else 0 end as email_reply_count,
        f.v_last_subject as last_email_subject,
        f.last_contacted_at,
        f.created_at,
        count(*) over() as total_count
    from filtered f
    order by f.v_email_sent_count desc, f.created_at desc
    limit p_page_size
    offset greatest(p_page - 1, 0) * p_page_size;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Single-lead full detail (email bodies, step statuses, replies) — used
--    only by the row-click detail modal, one lead at a time.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.get_campaign_lead_detail(p_id uuid)
returns jsonb
language sql
stable
as $$
    select to_jsonb(t) from public.outreach_leads t where t.id = p_id;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Indexes to back the filters/search/sort above
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

create index if not exists idx_outreach_leads_campaign_id on public.outreach_leads (campaign_id);
create index if not exists idx_outreach_leads_lead_status on public.outreach_leads (lead_status);
create index if not exists idx_outreach_leads_created_at on public.outreach_leads (created_at desc);
create index if not exists idx_outreach_leads_outreach_channels on public.outreach_leads using gin (outreach_channels);
create index if not exists idx_outreach_leads_full_name_trgm on public.outreach_leads using gin (full_name gin_trgm_ops);
create index if not exists idx_outreach_leads_email_trgm on public.outreach_leads using gin (email gin_trgm_ops);
create index if not exists idx_outreach_leads_company_name_trgm on public.outreach_leads using gin (company_name gin_trgm_ops);
