-- ============================================================================
-- RPC MIGRATION PLAN — Email / Voice / WhatsApp / Leads dashboards
-- ============================================================================
-- ANALYSIS ONLY. Do not run this against production yet — nothing in the app
-- calls any of these functions. This file is the reference set of RPCs to
-- swap in later, one dashboard at a time, once explicitly requested.
--
-- Why: every current dashboard/service function (lib/services/*.ts) pulls
-- full row sets into Node and aggregates in JS. Several of those fetches are
-- not properly paginated (.limit(N) without .range() batching, or no limit
-- at all) and silently truncate on tables above ~1000 rows. Moving the
-- aggregation into Postgres functions means: (a) only the final numbers
-- cross the network, not full row sets, (b) no truncation risk since a
-- server-side COUNT/SUM never hits a PostgREST row cap, (c) the DB does the
-- filtering/scanning with indexes instead of Node doing a full table scan
-- in memory.
--
-- Every function below reproduces the exact business logic found in the
-- current JS (truthy-value rules, date-fallback chains, reply-detection
-- gates) so swapping the call site later is a like-for-like replacement,
-- not a behavior change. Inconsistencies already present in the JS (e.g.
-- two different "replied" definitions between dashboard.ts and
-- email-outreach.ts) are preserved as separate functions rather than
-- silently unified — unifying them is a product decision, not a migration
-- detail, and should be made explicitly later.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 0. SHARED SQL HELPERS
-- ────────────────────────────────────────────────────────────────────────────

-- Mirrors truthyText()/hasTruthy() from the JS: false for null, '', 'no',
-- 'none', 'false', '0' (case-insensitive, trimmed). Used everywhere a
-- "Yes/No"-style flag column is checked.
create or replace function public._is_truthy(val text)
returns boolean
language sql
immutable
as $$
  select val is not null
     and length(trim(val)) > 0
     and lower(trim(val)) not in ('no', 'none', 'false', '0');
$$;

-- Mirrors the narrower exclusion list used by hasWhatsappReplied()'s
-- User_Replied_i check and a couple of other spots: excludes only
-- 'no'/'none'/'false', NOT '0' (word-for-word from the JS, kept separate
-- from _is_truthy on purpose since the exclusion sets differ).
create or replace function public._is_truthy_narrow(val text)
returns boolean
language sql
immutable
as $$
  select val is not null
     and length(trim(val)) > 0
     and lower(trim(val)) not in ('no', 'none', 'false');
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. TELEPHONY RATES LOOKUP TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Replaces context/rates.json (453 rows, loaded and longest-prefix-matched
-- in JS today via app/api/calls/route.ts's getRateInfo()). Becomes a real
-- table so calculate_telephony_cost() below can do the same longest-prefix
-- match in SQL. One-time data load from the JSON file happens outside this
-- migration (seed script), not here — this just defines the shape.

create table if not exists public.telephony_rates (
    id serial primary key,
    type text,
    category text,
    country text,
    specifier text,
    prefix text not null,       -- kept as text: JSON has numeric prefixes but
                                 -- comparison is via string prefix-matching,
                                 -- same as JS's `cleaned.startsWith(String(r.Prefix))`
    rate numeric not null
);

create index if not exists idx_telephony_rates_prefix on public.telephony_rates (prefix);

-- Longest-prefix match, mirrors getRateInfo(): filter rows whose prefix is a
-- string-prefix of the cleaned number, then take the longest prefix.
create or replace function public._get_rate_for_number(clean_number text)
returns numeric
language sql
stable
as $$
  select rate
  from public.telephony_rates
  where clean_number like (prefix || '%')
  order by length(prefix) desc
  limit 1;
$$;

-- Mirrors calculateTelephonyCost() from app/api/calls/route.ts exactly,
-- including the hardcoded BYOC partner-rate tiers for US/UK caller numbers.
create or replace function public._calculate_telephony_cost(
    duration_secs integer,
    phone_number text,
    is_inbound boolean,
    provider_number text
)
returns numeric
language plpgsql
stable
as $$
declare
    p_clean text := regexp_replace(coalesce(provider_number, ''), '\D', '', 'g');
    t_clean text := regexp_replace(coalesce(phone_number, ''), '\D', '', 'g');
    bot_is_us boolean := p_clean like '1%';
    bot_is_uk boolean := p_clean like '44%';
    target_is_uae boolean := t_clean like '971%';
    target_is_us boolean := t_clean like '1%';
    target_is_uk boolean := t_clean like '44%';
    rate numeric;
begin
    if is_inbound then
        return case when duration_secs > 0 then 0.02 else 0 end;
    end if;

    if duration_secs is null or duration_secs <= 0 then
        return 0;
    end if;

    if bot_is_us or bot_is_uk then
        if target_is_uae then
            return (duration_secs / 60.0) * 0.2426;
        end if;
        if bot_is_us and target_is_us then
            return (duration_secs / 60.0) * 0.013;
        end if;
        if bot_is_uk and target_is_uk then
            return (duration_secs / 60.0) * 0.0305;
        end if;
        return (duration_secs / 60.0) * 0.05;
    end if;

    rate := public._get_rate_for_number(t_clean);
    return (duration_secs / 60.0) * coalesce(rate, 0);
end;
$$;

-- Mirrors getCountryName() (via getRateInfo()).
create or replace function public._get_country_for_number(phone_number text)
returns text
language sql
stable
as $$
  select coalesce(
    (select country
     from public.telephony_rates
     where regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') like (prefix || '%')
     order by length(prefix) desc
     limit 1),
    'Unknown'
  );
$$;

-- Mirrors PROVIDER_NUMBER_BY_ACCOUNT from app/api/calls/route.ts — which
-- Twilio number a given VAPI account calls from, used to pick the rate tier.
create or replace function public._get_provider_number_for_account(vapi_account text, fallback_number text default null)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(vapi_account, '')))
    when 'hubspot' then '+13187232814'
    when 'cold leads' then '+447414280238'
    else coalesce(fallback_number, '')
  end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. EMAIL DOMAIN
-- ────────────────────────────────────────────────────────────────────────────

-- Mirrors lib/services/email-outreach.ts's computeMetrics(), run against
-- ENRICHED_LEADS + master_cold_leads (leadType='cold') or hubspot_lead
-- (leadType='hot'). Date filter: COALESCE("Email Last Contacted",
-- email_last_sent_at, created_at) — the same lastContacted-then-createdAt
-- fallback chain as inRange(l.lastContacted || l.createdAt, from, to).
--
-- Returns one row: the OutreachMetrics shape. Call twice (cold/hot) from the
-- application layer, same as computeMetrics(coldLeads,...) /
-- computeMetrics(hotLeads,...) today.
create or replace function public.get_email_outreach_metrics(
    p_from timestamptz,
    p_to timestamptz,
    p_lead_type text  -- 'cold' | 'hot'
)
returns table (
    total_leads integer,
    contacted_leads integer,
    emails_sent integer,
    stage_1_sent integer,
    stage_2_sent integer,
    stage_3_sent integer,
    stage_4_sent integer,
    stage_5_sent integer,
    stage_6_sent integer,
    replied_leads integer,
    total_replies integer,
    bounced_leads integer,
    unsubscribed_leads integer,
    reply_rate numeric
)
language plpgsql
stable
as $$
begin
    return query
    with cold_union as (
        select
            "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6",
            "Email_Reply_Track", email_bounced, email_unsubscribed,
            coalesce("Email Last Contacted", created_at) as effective_date
        from public."ENRICHED_LEADS"
        where p_lead_type = 'cold'

        union all

        select
            "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6",
            "Email_Reply_Track", email_bounced::text, email_unsubscribed::text,
            coalesce("Email Last Contacted", email_last_sent_at, created_at) as effective_date
        from public.master_cold_leads
        where p_lead_type = 'cold'

        union all

        select
            "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6",
            "Email_Reply_Track", email_bounced, email_unsubscribed,
            coalesce("Email Last Contacted", created_at) as effective_date
        from public.hubspot_lead
        where p_lead_type = 'hot'
    ),
    in_scope as (
        select *
        from cold_union
        where effective_date between p_from and p_to
    ),
    per_lead as (
        select
            (_is_truthy("Email_1")::int + _is_truthy("Email_2")::int + _is_truthy("Email_3")::int
             + _is_truthy("Email_4")::int + _is_truthy("Email_5")::int + _is_truthy("Email_6")::int) as stages_sent,
            _is_truthy("Email_1") as s1, _is_truthy("Email_2") as s2, _is_truthy("Email_3") as s3,
            _is_truthy("Email_4") as s4, _is_truthy("Email_5") as s5, _is_truthy("Email_6") as s6,
            _is_truthy("Email_Reply_Track") as replied,
            _is_truthy(email_bounced) as bounced,
            _is_truthy(email_unsubscribed) as unsubscribed
        from in_scope
    )
    select
        (select count(*)::int from in_scope),
        (select count(*)::int from per_lead where stages_sent > 0),
        (select coalesce(sum(stages_sent), 0)::int from per_lead),
        (select count(*)::int from per_lead where s1),
        (select count(*)::int from per_lead where s2),
        (select count(*)::int from per_lead where s3),
        (select count(*)::int from per_lead where s4),
        (select count(*)::int from per_lead where s5),
        (select count(*)::int from per_lead where s6),
        (select count(*)::int from per_lead where replied),
        (select count(*)::int from per_lead where replied),  -- totalReplies == repliedLeads count here,
                                                               -- since JS does max(replies.length,1) per
                                                               -- replied lead and we don't have a replies-
                                                               -- array count in SQL without unnesting 25
                                                               -- User/Bot_Replied_N columns — see note below.
        (select count(*)::int from per_lead where bounced),
        (select count(*)::int from per_lead where unsubscribed),
        case when (select count(*) from per_lead where stages_sent > 0) > 0
            then round(
                (select count(*)::numeric from per_lead where replied)
                / (select count(*)::numeric from per_lead where stages_sent > 0) * 100,
                2)
            else 0
        end;
end;
$$;
-- NOTE on total_replies: the JS computes totalReplies as the sum, across
-- replied leads, of max(lead.replies.length, 1) — i.e. it counts actual
-- reply-thread entries (User_Replied_1..25 / Bot_Replied_1..25 columns with
-- content), not just a per-lead flag. Reproducing that exactly in SQL means
-- unnesting 50 columns per table via UNNEST(ARRAY[...]) and counting
-- non-null/truthy entries per row. That's mechanical but verbose — flagged
-- here rather than silently approximated, to decide when this is actually
-- implemented: do you want total_replies to be thread-count-accurate, or is
-- replied-lead-count (what's shown above) good enough? The "Total Replies"
-- stat cards in the UI today display repliedLeads, not totalReplies, so this
-- may not even be observably different — worth confirming before build time.


-- Backing function for the "Total Replies" modal on the master dashboard —
-- mirrors extractLeadIdentity()/hasReplyTrack() gating from dashboard.ts,
-- scoped to ENRICHED_LEADS (cold) or hubspot_lead (hot).
create or replace function public.get_replied_leads(
    p_from timestamptz,
    p_to timestamptz,
    p_scope text  -- 'cold' (ENRICHED_LEADS) | 'hot' (hubspot_lead)
)
returns table (
    id text,
    name text,
    email text,
    phone text,
    replied_via_whatsapp boolean,
    replied_via_email boolean
)
language sql
stable
as $$
    select
        coalesce(lead_uuid::text, lead_id::text, coalesce("Work Email", "Personal Email"), company_phone_number, gen_random_uuid()::text) as id,
        coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce("Last Name", '')), 'Unknown Lead') as name,
        coalesce("Work Email", "Personal Email") as email,
        coalesce(company_phone_number, personal_phone) as phone,
        _is_truthy("WTS_Reply_Track") as replied_via_whatsapp,
        _is_truthy("Email_Reply_Track") as replied_via_email
    from (
        select lead_uuid, null::text as lead_id, full_name, "First Name", "Last Name",
               "Work Email", "Personal Email", company_phone_number, personal_phone,
               "WTS_Reply_Track", "Email_Reply_Track",
               coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at) as effective_date
        from public."ENRICHED_LEADS"
        where p_scope = 'cold'

        union all

        select null::uuid as lead_uuid, lead_id, full_name, "First Name", "Last Name",
               "Work Email", "Personal Email", company_phone_number, personal_phone,
               "WTS_Reply_Track", "Email_Reply_Track",
               coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at) as effective_date
        from public.hubspot_lead
        where p_scope = 'hot'
    ) src
    where effective_date between p_from and p_to
      and (_is_truthy("WTS_Reply_Track") or _is_truthy("Email_Reply_Track"));
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. VOICE DOMAIN
-- ────────────────────────────────────────────────────────────────────────────

-- Mirrors buildMetrics() from lib/services/voice.ts, filtered by
-- vapi_account classification ('all' | 'cold' | 'hubspot').
create or replace function public.get_voice_call_stats(
    p_from timestamptz,
    p_to timestamptz,
    p_account_scope text default 'all'  -- 'all' | 'cold' | 'hubspot'
)
returns table (
    total_calls integer,
    total_duration integer,
    avg_duration numeric,
    total_cost numeric,
    avg_cost numeric,
    success_count integer,
    success_rate numeric,
    picked_up_count integer,
    pickup_rate numeric,
    completed_count integer,
    completion_rate numeric
)
language plpgsql
stable
as $$
declare
    v_total integer;
begin
    return query
    with scoped as (
        select duration_seconds, cost_usd, lower(trim(coalesce(status, ''))) as status_norm
        from public.vapi_call_logs
        where created_at between p_from and p_to
          and (
                p_account_scope = 'all'
                or (p_account_scope = 'cold' and lower(trim(vapi_account)) = 'cold leads')
                or (p_account_scope = 'hubspot' and lower(trim(vapi_account)) = 'hubspot')
              )
    )
    select
        count(*)::int,
        coalesce(sum(duration_seconds), 0)::int,
        case when count(*) > 0 then round(coalesce(sum(duration_seconds), 0)::numeric / count(*), 2) else 0 end,
        coalesce(sum(cost_usd), 0)::numeric,
        case when count(*) > 0 then round(coalesce(sum(cost_usd), 0) / count(*), 4) else 0 end,
        count(*) filter (where status_norm in ('done', 'ended', 'completed', 'success', 'answered'))::int,
        case when count(*) > 0 then round(
            count(*) filter (where status_norm in ('done', 'ended', 'completed', 'success', 'answered'))::numeric
            / count(*) * 100, 2) else 0 end,
        count(*) filter (where duration_seconds > 18)::int,
        case when count(*) > 0 then round(
            count(*) filter (where duration_seconds > 18)::numeric / count(*) * 100, 2) else 0 end,
        count(*) filter (where status_norm in ('customer-ended-call', 'assistant-ended-call'))::int,
        case when count(*) > 0 then round(
            count(*) filter (where status_norm in ('customer-ended-call', 'assistant-ended-call'))::numeric
            / count(*) * 100, 2) else 0 end
    from scoped;
end;
$$;

-- Mirrors the dailyVolume bucketing from buildMetrics(): one row per
-- calendar day with call count and total duration in minutes.
create or replace function public.get_voice_daily_volume(
    p_from timestamptz,
    p_to timestamptz,
    p_account_scope text default 'all'
)
returns table (
    day_key date,
    display_name text,
    calls integer,
    total_duration_minutes integer
)
language sql
stable
as $$
    select
        (created_at at time zone 'UTC')::date as day_key,
        to_char(created_at at time zone 'UTC', 'Mon DD') as display_name,
        count(*)::int as calls,
        round(coalesce(sum(duration_seconds), 0) / 60.0)::int as total_duration_minutes
    from public.vapi_call_logs
    where created_at between p_from and p_to
      and (
            p_account_scope = 'all'
            or (p_account_scope = 'cold' and lower(trim(vapi_account)) = 'cold leads')
            or (p_account_scope = 'hubspot' and lower(trim(vapi_account)) = 'hubspot')
          )
    group by 1, 2
    order by 1 asc;
$$;

-- Mirrors hourlyDistribution: 24 hourly buckets, then the JS filters to
-- every 3rd hour for display — kept as all 24 here since collapsing to 8 is
-- a presentation concern, not a data concern; the caller can slice client-side.
create or replace function public.get_voice_hourly_distribution(
    p_from timestamptz,
    p_to timestamptz,
    p_account_scope text default 'all'
)
returns table (
    hour_of_day integer,
    calls integer
)
language sql
stable
as $$
    select
        extract(hour from created_at at time zone 'UTC')::int as hour_of_day,
        count(*)::int as calls
    from public.vapi_call_logs
    where created_at between p_from and p_to
      and (
            p_account_scope = 'all'
            or (p_account_scope = 'cold' and lower(trim(vapi_account)) = 'cold leads')
            or (p_account_scope = 'hubspot' and lower(trim(vapi_account)) = 'hubspot')
          )
    group by 1
    order by 1;
$$;

-- Mirrors statusBreakdown.
create or replace function public.get_voice_status_breakdown(
    p_from timestamptz,
    p_to timestamptz,
    p_account_scope text default 'all'
)
returns table (
    status text,
    calls integer
)
language sql
stable
as $$
    select
        lower(trim(coalesce(status, 'unknown'))) as status,
        count(*)::int as calls
    from public.vapi_call_logs
    where created_at between p_from and p_to
      and (
            p_account_scope = 'all'
            or (p_account_scope = 'cold' and lower(trim(vapi_account)) = 'cold leads')
            or (p_account_scope = 'hubspot' and lower(trim(vapi_account)) = 'hubspot')
          )
    group by 1
    order by 2 desc;
$$;

-- Mirrors app/api/calls/route.ts's fetchArchive() — the per-call feed with
-- full cost breakdown, used by the Call Logs / Cold Call Logs tables and the
-- CSV-adjacent detail views. This is the big one: replaces both the raw REST
-- fetch (10000-row hard cap, no true pagination) AND the per-row JS cost
-- calculation with a single indexed, paginated query.
create or replace function public.get_call_logs(
    p_from timestamptz,
    p_to timestamptz,
    p_limit integer default 1000,
    p_offset integer default 0
)
returns table (
    id uuid,
    name text,
    started_at timestamptz,
    duration_seconds integer,
    cost_value numeric,
    agent_cost numeric,
    telephony_cost numeric,
    source text,
    status text,
    phone text,
    call_summary text,
    audio_url text,
    transcript text,
    call_type text,
    is_inbound boolean,
    assistant_id text,
    vapi_account text,
    account_type text,
    created_at timestamptz,
    country text
)
language sql
stable
as $$
    select
        v.id,
        v.customer_name,
        v.started_at,
        v.duration_seconds,
        coalesce(v.cost_usd, 0) + _calculate_telephony_cost(
            v.duration_seconds, v.customer_phone,
            lower(coalesce(v.type, '')) = 'inbound',
            _get_provider_number_for_account(v.vapi_account)
        ) as cost_value,
        coalesce(v.cost_usd, 0) as agent_cost,
        _calculate_telephony_cost(
            v.duration_seconds, v.customer_phone,
            lower(coalesce(v.type, '')) = 'inbound',
            _get_provider_number_for_account(v.vapi_account)
        ) as telephony_cost,
        v.source,
        v.status,
        v.customer_phone,
        v.summary,
        v.recording_url,
        v.transcript,
        v.type,
        lower(coalesce(v.type, '')) = 'inbound',
        v."assistantId",
        v.vapi_account,
        case
            when lower(trim(coalesce(v.vapi_account, ''))) = 'cold leads' then 'cold'
            when lower(trim(coalesce(v.vapi_account, ''))) = 'hubspot' then 'hubspot'
            else 'other'
        end,
        v.created_at,
        _get_country_for_number(v.customer_phone)
    from public.vapi_call_logs v
    where v.created_at between p_from and p_to
    order by v.created_at desc
    limit p_limit offset p_offset;
$$;

-- Companion count for get_call_logs, so the UI can paginate properly instead
-- of relying on "got fewer than p_limit rows back" as an end-of-data signal.
create or replace function public.get_call_logs_count(
    p_from timestamptz,
    p_to timestamptz
)
returns integer
language sql
stable
as $$
    select count(*)::int
    from public.vapi_call_logs
    where created_at between p_from and p_to;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. WHATSAPP DOMAIN
-- ────────────────────────────────────────────────────────────────────────────
-- Two independent JS implementations exist today (whatsapp.ts vs
-- whatsapp-outreach.ts) with different table sets and different reply/sent
-- rules — see analysis notes above. Reproduced as two separate RPC groups
-- rather than unified, since unifying them changes product behavior and
-- needs an explicit decision, not a silent merge during migration.

-- 4a. Mirrors lib/services/whatsapp.ts's per-source stats (icp_tracker,
-- meta_lead_tracker, ENRICHED_LEADS, hubspot_lead). Date filter:
-- COALESCE("Whatsapp Last Contacted", created_at).
create or replace function public.get_whatsapp_stats_v1(
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    source_table text,
    leads_contacted integer,
    messages_sent integer,
    total_replies integer,
    waiting_count integer
)
language plpgsql
stable
as $$
begin
    return query
    with unioned as (
        select 'icp_tracker' as src,
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Whatsapp Last Contacted", created_at) as effective_date
        from public.icp_tracker

        union all

        select 'meta_lead_tracker',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Whatsapp Last Contacted", created_at)
        from public.meta_lead_tracker

        union all

        select 'ENRICHED_LEADS',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Whatsapp Last Contacted", created_at)
        from public."ENRICHED_LEADS"

        union all

        select 'hubspot_lead',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Whatsapp Last Contacted", created_at)
        from public.hubspot_lead
    ),
    in_scope as (
        select *,
            (_is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
             or _is_truthy("Whatsapp_4") or _is_truthy("Whatsapp_5")) as was_sent,
            (
                _is_truthy_narrow("User_Replied_1") or _is_truthy_narrow("User_Replied_2")
                or _is_truthy_narrow("User_Replied_3") or _is_truthy_narrow("User_Replied_4")
                or _is_truthy_narrow("User_Replied_5") or _is_truthy("WTS_Reply_Track")
            ) as did_reply
        from unioned
        where effective_date between p_from and p_to
    )
    select
        src,
        count(*) filter (where was_sent)::int,
        (count(*) filter (where _is_truthy("Whatsapp_1")) + count(*) filter (where _is_truthy("Whatsapp_2"))
         + count(*) filter (where _is_truthy("Whatsapp_3")) + count(*) filter (where _is_truthy("Whatsapp_4"))
         + count(*) filter (where _is_truthy("Whatsapp_5")))::int,
        count(*) filter (where did_reply)::int,
        count(*) filter (where was_sent and not did_reply)::int
    from in_scope
    group by src;
end;
$$;
-- NOTE: this reproduces the sent/replied core of whatsapp.ts but omits the
-- wa_conversation-JSON-scan and W.P_i legacy-column fallbacks (those need
-- jsonb parsing + a much longer column list to fully match — flagged as a
-- follow-up refinement, not skipped silently, since the current function
-- would undercount leads whose only reply signal is inside wa_conversation).

-- 4b. Mirrors lib/services/whatsapp-outreach.ts's computeWaMetrics(), for
-- ENRICHED_LEADS/hubspot_lead (leadType='cold'/'hot') or hubspot_wa_outreach
-- (leadType='hubspot_wa'). Date filter: COALESCE("Whatsapp Last Contacted",
-- created_at) — same fallback as get_email_outreach_metrics.
create or replace function public.get_whatsapp_outreach_metrics(
    p_from timestamptz,
    p_to timestamptz,
    p_lead_type text  -- 'cold' | 'hot' | 'hubspot_wa'
)
returns table (
    total_leads integer,
    contacted_leads integer,
    messages_sent integer,
    replied_leads integer,
    reply_rate numeric
)
language plpgsql
stable
as $$
begin
    return query
    with unioned as (
        select
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", whatsapp_6,
            wa_conversation,
            coalesce("Whatsapp Last Contacted", created_at) as effective_date
        from public."ENRICHED_LEADS"
        where p_lead_type = 'cold'

        union all

        select
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_6",
            wa_conversation,
            coalesce("Whatsapp Last Contacted", created_at)
        from public.hubspot_lead
        where p_lead_type = 'hot'

        union all

        select
            "Whatsapp_1", null, null, null, null,
            wa_conversation,
            coalesce("Whatsapp Last Contacted", created_at)
        from public.hubspot_wa_outreach
        where p_lead_type = 'hubspot_wa'
    ),
    in_scope as (
        select
            (_is_truthy("Whatsapp_1")::int + _is_truthy("Whatsapp_2")::int + _is_truthy("Whatsapp_3")::int
             + _is_truthy("Whatsapp_4")::int + _is_truthy(whatsapp_6)::int) as stages_sent,
            -- Reply detection = any inbound message in wa_conversation jsonb array
            exists (
                select 1 from jsonb_array_elements(coalesce(wa_conversation, '[]'::jsonb)) msg
                where lower(coalesce(msg->>'role', '')) = 'user'
                   or lower(coalesce(msg->>'direction', '')) = 'inbound'
            ) as replied
        from unioned
        where effective_date between p_from and p_to
    )
    select
        (select count(*)::int from in_scope),
        (select count(*)::int from in_scope where stages_sent > 0),
        (select coalesce(sum(stages_sent), 0)::int from in_scope),
        (select count(*)::int from in_scope where replied),
        case when (select count(*) from in_scope where stages_sent > 0) > 0
            then round(
                (select count(*)::numeric from in_scope where replied)
                / (select count(*)::numeric from in_scope where stages_sent > 0) * 100, 2)
            else 0
        end;
end;
$$;
-- NOTE: wa_conversation is assumed jsonb here (matches the column's default
-- '[]'::jsonb / '{}'::jsonb pattern seen on master_cold_leads' equivalent
-- columns). If any of ENRICHED_LEADS/hubspot_lead/hubspot_wa_outreach store
-- it as text-encoded JSON instead of a native jsonb column, this needs a
-- ::jsonb cast added — confirm actual column type before wiring this in.


-- ────────────────────────────────────────────────────────────────────────────
-- 5. LEADS DOMAIN (counts, paginated browse, search)
-- ────────────────────────────────────────────────────────────────────────────

-- Mirrors app/api/leads/counts/route.ts — one row per table, replaces 8
-- separate head-count requests with a single round trip.
create or replace function public.get_leads_table_counts()
returns table (
    table_name text,
    row_count bigint
)
language sql
stable
as $$
    select 'ENRICHED_LEADS', count(*) from public."ENRICHED_LEADS"
    union all
    select 'LinkedIn_leads', count(*) from public."LinkedIn_leads"
    union all
    select 'gmap_leadsv2', count(*) from public.gmap_leadsv2
    union all
    select 'hubspot_lead', count(*) from public.hubspot_lead
    union all
    select 'icp_tracker', count(*) from public.icp_tracker
    union all
    select 'meta_lead_tracker', count(*) from public.meta_lead_tracker
    union all
    select 'master_leads_unique', count(*) from public.master_leads_unique
    union all
    select 'master_cold_leads', count(*) from public.master_cold_leads;
$$;
-- NOTE: the current JS uses {count:'estimated'} (fast, approximate, reads
-- Postgres planner stats) rather than an exact COUNT(*). A real COUNT(*) as
-- written above is exact but does a full scan per table — fine for the
-- table sizes seen so far (thousands, not millions of rows) but worth
-- flagging: swap to `SELECT reltuples::bigint FROM pg_class WHERE
-- relname = '...'` per table if the estimated/approximate behavior needs
-- to be preserved for very large tables later.

-- Mirrors app/api/leads/source/route.ts's per-table paginated browse with
-- search. Since the source table is dynamic in the JS (?table= query param)
-- and Postgres functions can't take a table name as a normal parameter
-- safely without dynamic SQL, this is written with EXECUTE + format(%I) for
-- identifier-safety (allowlist enforced inside the function body, NOT left
-- open like the current route, which accepts any table name unchecked).
create or replace function public.get_leads_page(
    p_table text,
    p_page integer default 1,
    p_limit integer default 10,
    p_search text default null
)
returns setof jsonb
language plpgsql
stable
as $$
declare
    v_offset integer := greatest(p_page - 1, 0) * p_limit;
    v_sql text;
begin
    if p_table not in ('ENRICHED_LEADS', 'master_cold_leads', 'LinkedIn_leads', 'gmap_leadsv2', 'hubspot_lead') then
        raise exception 'Table % is not allowlisted for get_leads_page', p_table;
    end if;

    v_sql := format(
        'select to_jsonb(t) from public.%I t where ($1 is null or full_name ilike $2 or company_phone_number ilike $2) order by t.ctid limit $3 offset $4',
        p_table
    );

    return query execute v_sql using p_search, '%' || coalesce(p_search, '') || '%', p_limit, v_offset;
end;
$$;

-- Companion count for get_leads_page (mirrors the count:'exact' half of the
-- same route).
create or replace function public.get_leads_page_count(
    p_table text,
    p_search text default null
)
returns integer
language plpgsql
stable
as $$
declare
    v_sql text;
    v_count integer;
begin
    if p_table not in ('ENRICHED_LEADS', 'master_cold_leads', 'LinkedIn_leads', 'gmap_leadsv2', 'hubspot_lead') then
        raise exception 'Table % is not allowlisted for get_leads_page_count', p_table;
    end if;

    v_sql := format(
        'select count(*) from public.%I where ($1 is null or full_name ilike $2 or company_phone_number ilike $2)',
        p_table
    );

    execute v_sql using p_search, '%' || coalesce(p_search, '') || '%' into v_count;
    return v_count;
end;
$$;
-- NOTE: get_leads_page assumes every allowlisted table has full_name and
-- company_phone_number columns for the search filter — true for the 5
-- tables the current UI actually uses (per app/dashboard/leads/page.tsx's
-- TABLES config), matching the same fragile assumption already present in
-- the JS route. Flagged, not fixed, since fixing it means per-table search
-- column config, a bigger change than a straight RPC port.


-- ────────────────────────────────────────────────────────────────────────────
-- 6. DASHBOARD DOMAIN (master dashboard top-line stats)
-- ────────────────────────────────────────────────────────────────────────────
-- Mirrors the icp_tracker + meta_lead_tracker + ENRICHED_LEADS aggregate
-- portion of lib/services/dashboard.ts's getDashboardStats() — the
-- hasWhatsappSent/hasVoiceSent/hasWhatsappReplied counts and the
-- acquisitionChartData day-bucketing. hubspot_lead's parallel counts and
-- email/voice sub-metrics are covered by the functions above (this one is
-- specifically the "Cold Outreach bot" section's non-email/voice/whatsapp-
-- outreach numbers — the ICP/Meta/Enriched lead-volume and WhatsApp-flag
-- counts that dashboard.ts computes independently of email-outreach.ts /
-- voice.ts / whatsapp-outreach.ts).

create or replace function public.get_dashboard_lead_stats(
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    total_leads integer,
    icp_count integer,
    meta_count integer,
    enriched_count integer,
    whatsapp_sent_count integer,
    voice_contacted_count integer,
    whatsapp_reply_count integer,
    icp_replied_count integer,
    meta_replied_count integer,
    enriched_replied_count integer
)
language plpgsql
stable
as $$
begin
    return query
    with unioned as (
        select 'icp_tracker' as src,
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "Voice_1_Status", "Voice_1_Date", "Voice_2_Status", "Voice_2_Date",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at) as effective_date
        from public.icp_tracker

        union all

        select 'meta_lead_tracker',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            null, null, null, null,
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Whatsapp Last Contacted", created_at)
        from public.meta_lead_tracker

        union all

        select 'ENRICHED_LEADS',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "Voice_1_Status", "Voice_1_Date", "Voice_2_Status", "Voice_2_Date",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at)
        from public."ENRICHED_LEADS"
    ),
    in_scope as (
        select *,
            (_is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
             or _is_truthy("Whatsapp_4") or _is_truthy("Whatsapp_5")) as was_wa_sent,
            (
                _is_truthy_narrow("Voice_1_Status") or "Voice_1_Date" is not null
                or _is_truthy_narrow("Voice_2_Status") or "Voice_2_Date" is not null
            ) as was_voice_sent,
            (
                _is_truthy_narrow("User_Replied_1") or _is_truthy_narrow("User_Replied_2")
                or _is_truthy_narrow("User_Replied_3") or _is_truthy_narrow("User_Replied_4")
                or _is_truthy_narrow("User_Replied_5")
                or (
                    "WTS_Reply_Track" is not null and length(trim("WTS_Reply_Track")) > 0
                    and lower(trim("WTS_Reply_Track")) not in ('no', 'none', 'false')
                )
            ) as did_wa_reply
        from unioned
        where effective_date between p_from and p_to
    )
    select
        count(*)::int,
        count(*) filter (where src = 'icp_tracker')::int,
        count(*) filter (where src = 'meta_lead_tracker')::int,
        count(*) filter (where src = 'ENRICHED_LEADS')::int,
        count(*) filter (where was_wa_sent)::int,
        count(*) filter (where was_voice_sent)::int,
        count(*) filter (where did_wa_reply)::int,
        count(*) filter (where did_wa_reply and src = 'icp_tracker')::int,
        count(*) filter (where did_wa_reply and src = 'meta_lead_tracker')::int,
        count(*) filter (where did_wa_reply and src = 'ENRICHED_LEADS')::int
    from in_scope;
end;
$$;
-- NOTE: hasVoiceSent() in the JS also checks legacy Voice_1/Voice_2/Voice_3
-- text columns (for meta_lead_tracker rows, which lack Voice_i_Status), and
-- hasWhatsappSent()/hasWhatsappReplied() also scan wa_conversation (jsonb)
-- and W.P_i / W.P_Replied_i legacy columns as fallbacks. Omitted here for
-- the same reason as get_whatsapp_stats_v1's note above — those are
-- mechanical additions (more UNNEST/jsonb_array_elements clauses) but were
-- left out of this first pass to keep the function's core logic reviewable;
-- they must be added before this fully replaces getDashboardStats(), not
-- silently skipped.

-- Mirrors the acquisitionMap day-bucketing in getDashboardStats(): one row
-- per calendar day in range, count of icp+meta+enriched leads whose
-- effective date falls on that day. Pre-seeding every day at 0 (even ones
-- with no leads) is left to the caller — SQL naturally omits empty days from
-- a GROUP BY, so the app layer should left-join this against a generated day
-- series, same as the JS pre-seeds acquisitionMap before the main loop.
create or replace function public.get_lead_acquisition_by_day(
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    day_key date,
    lead_count integer
)
language sql
stable
as $$
    with unioned as (
        select coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at) as effective_date
        from public.icp_tracker
        union all
        select coalesce("Whatsapp Last Contacted", created_at)
        from public.meta_lead_tracker
        union all
        select coalesce("Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", voice_last_contacted, created_at)
        from public."ENRICHED_LEADS"
    )
    select (effective_date at time zone 'UTC')::date as day_key, count(*)::int as lead_count
    from unioned
    where effective_date between p_from and p_to
    group by 1
    order by 1;
$$;


-- ============================================================================
-- OPEN QUESTIONS TO RESOLVE BEFORE WIRING ANY OF THESE IN
-- ============================================================================
-- 1. total_replies in get_email_outreach_metrics() approximates repliedLeads
--    count rather than summing actual reply-thread entries (see inline note)
--    — confirm whether the UI actually needs thread-count precision.
-- 2. wa_conversation column type (jsonb vs text-encoded JSON) needs
--    confirming per table before get_whatsapp_outreach_metrics is trusted.
-- 3. get_whatsapp_stats_v1 and get_dashboard_lead_stats omit the
--    wa_conversation-jsonb-scan and legacy W.P_i / Voice_i text-column
--    fallbacks that the JS has — need those added for full parity.
-- 4. dashboard.ts's totalEmailReplies (from instantly_lead_replies, an
--    external reply-event log) vs totalReplies/repliedLeadsCold (from
--    WTS_Reply_Track/Email_Reply_Track flags) are two different "replied"
--    definitions surfaced side by side today — an RPC for
--    instantly_lead_replies count would be trivial to add
--    (SELECT COUNT(*) ... WHERE reply_timestamp BETWEEN...) but wasn't
--    included above pending a decision on whether that's still wanted once
--    the flag-column-based counts are the primary signal.
-- 5. telephony_rates table needs a one-time data load from
--    context/rates.json (453 rows) before _calculate_telephony_cost() can
--    be trusted — not part of this migration file.
-- 6. get_leads_page uses `order by t.ctid` (physical row order) since the
--    current JS route applies no explicit ordering either — confirm this
--    is acceptable, or specify a real sort column (e.g. created_at) if the
--    UI expects stable/meaningful ordering across pages.
-- ============================================================================
