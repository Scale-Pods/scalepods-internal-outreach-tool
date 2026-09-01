-- Run this against Supabase to stop fetching icp_tracker across the app.
-- icp_tracker is no longer needed — drops its ~1902 rows out of every
-- aggregate that used to include it (master dashboard totals/whatsapp/voice
-- counts, acquisition chart, WhatsApp per-stage funnel).

-- ── 1. get_dashboard_lead_stats: drop the icp branch + its output columns ──
-- Return shape changed (icp_count / icp_replied_count removed), so this
-- needs DROP + CREATE rather than CREATE OR REPLACE.
drop function if exists public.get_dashboard_lead_stats(timestamptz, timestamptz);

create function public.get_dashboard_lead_stats(
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    total_leads integer,
    meta_count integer,
    enriched_count integer,
    whatsapp_sent_count integer,
    voice_contacted_count integer,
    whatsapp_reply_count integer,
    meta_replied_count integer,
    enriched_replied_count integer
)
language plpgsql
stable
as $$
begin
    return query
    with unioned as (
        select 'meta_lead_tracker' as src,
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            null::text as "Voice_1_Status", null::timestamptz as voice_1_date,
            null::text as "Voice_2_Status", null::timestamptz as voice_2_date,
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date
        from public.meta_lead_tracker

        union all

        select 'ENRICHED_LEADS',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "Voice_1_Status", "Voice_1_Date",
            "Voice_2_Status", "Voice_2_Date",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(
                _safe_ts("Email Last Contacted"), _safe_ts("Whatsapp Last Contacted"),
                _safe_ts("Voice Last Contacted"), _safe_ts(voice_last_contacted), created_at
            )
        from public."ENRICHED_LEADS"
    ),
    in_scope as (
        select *,
            (_is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
             or _is_truthy("Whatsapp_4") or _is_truthy("Whatsapp_5")) as was_wa_sent,
            (
                _is_truthy_narrow("Voice_1_Status") or voice_1_date is not null
                or _is_truthy_narrow("Voice_2_Status") or voice_2_date is not null
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
        count(*) filter (where src = 'meta_lead_tracker')::int,
        count(*) filter (where src = 'ENRICHED_LEADS')::int,
        count(*) filter (where was_wa_sent)::int,
        count(*) filter (where was_voice_sent)::int,
        count(*) filter (where did_wa_reply)::int,
        count(*) filter (where did_wa_reply and src = 'meta_lead_tracker')::int,
        count(*) filter (where did_wa_reply and src = 'ENRICHED_LEADS')::int
    from in_scope;
end;
$$;

-- ── 2. get_lead_acquisition_by_day: drop the icp_tracker branch ────────────
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
        select coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date
        from public.meta_lead_tracker
        union all
        select coalesce(
            _safe_ts("Email Last Contacted"), _safe_ts("Whatsapp Last Contacted"),
            _safe_ts("Voice Last Contacted"), _safe_ts(voice_last_contacted), created_at
        )
        from public."ENRICHED_LEADS"
    )
    select (effective_date at time zone 'UTC')::date as day_key, count(*)::int as lead_count
    from unioned
    where effective_date between p_from and p_to
    group by 1
    order by 1;
$$;

-- ── 3. get_whatsapp_stats_v1: drop the icp_tracker branch ──────────────────
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
        select 'meta_lead_tracker' as src,
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date
        from public.meta_lead_tracker

        union all

        select 'ENRICHED_LEADS',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
        from public."ENRICHED_LEADS"

        union all

        select 'hubspot_lead',
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
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
