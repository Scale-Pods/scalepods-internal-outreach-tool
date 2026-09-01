-- Run this after add_wa_outreach_metrics.sql — same function, now also
-- computing stage_N_sent (per-stage funnel counts) and failed_messages,
-- both of which whatsapp-client.tsx actually renders (found missing from
-- the v1 version during JS wiring — that version left these as 0/stub
-- rather than silently guessing). The return columns changed, so Postgres
-- requires dropping the old signature before recreating it.
--
-- v2 fix: every column in the UNION's first branch now has an explicit
-- lowercase alias (a UNION's output column names come from its first
-- branch only) — the previous attempt referenced whatsapp_2 unaliased,
-- which Postgres resolved to the unaliased first branch's actual output
-- name Whatsapp_2 (case-preserved from the quoted identifier), causing
-- "column whatsapp_2 does not exist" in the later CTEs.

drop function if exists public.get_wa_outreach_metrics(timestamptz, timestamptz, text);

create function public.get_wa_outreach_metrics(
    p_from timestamptz,
    p_to timestamptz,
    p_lead_type text  -- 'cold' | 'hot' | 'hubspot_wa'
)
returns table (
    total_leads integer,
    contacted_leads integer,
    messages_sent integer,
    replied_leads integer,
    reply_rate numeric,
    stage_1_sent integer,
    stage_2_sent integer,
    stage_3_sent integer,
    stage_4_sent integer,
    stage_5_sent integer,
    stage_6_sent integer,
    failed_messages integer
)
language plpgsql
stable
as $$
begin
    return query
    with unioned as (
        select
            "Whatsapp_1" as w1, "Whatsapp_2" as w2, "Whatsapp_3" as w3, "Whatsapp_4" as w4,
            null::text as w5, whatsapp_6 as w6,
            "Whatsapp_1_status" as w1s, "Whatsapp_2_status" as w2s, "Whatsapp_3_status" as w3s, "Whatsapp_4_status" as w4s,
            null::text as w5s, whatsapp_6_status as w6s,
            wa_conversation,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date
        from public."ENRICHED_LEADS"
        where p_lead_type = 'cold'

        union all

        select
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4",
            null::text, "Whatsapp_6",
            "Whatsapp_1_status", "Whatsapp_2_status", "Whatsapp_3_status", "Whatsapp_4_status",
            null::text, "Whatsapp_6_status",
            wa_conversation,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
        from public.hubspot_lead
        where p_lead_type = 'hot'

        union all

        select
            "Whatsapp_1", null::text, null::text, null::text, null::text, null::text,
            "Whatsapp_1_status", null::text, null::text, null::text, null::text, null::text,
            wa_conversation,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
        from public.hubspot_wa_outreach
        where p_lead_type = 'hubspot_wa'
    ),
    has_activity as (
        select *,
            (_is_truthy(w1) or _is_truthy(w2) or _is_truthy(w3)
             or _is_truthy(w4) or _is_truthy(w6)
             or jsonb_array_length(coalesce(wa_conversation, '[]'::jsonb)) > 0) as had_activity
        from unioned
    ),
    in_scope as (
        select
            _is_truthy(w1) as s1, _is_truthy(w2) as s2, _is_truthy(w3) as s3,
            _is_truthy(w4) as s4, _is_truthy(w5) as s5, _is_truthy(w6) as s6,
            (_is_truthy(w1)::int + _is_truthy(w2)::int + _is_truthy(w3)::int
             + _is_truthy(w4)::int + _is_truthy(w6)::int) as stages_sent,
            lower(coalesce(w1s, '')) like '%failed%' as f1,
            lower(coalesce(w2s, '')) like '%failed%' as f2,
            lower(coalesce(w3s, '')) like '%failed%' as f3,
            lower(coalesce(w4s, '')) like '%failed%' as f4,
            lower(coalesce(w6s, '')) like '%failed%' as f6,
            exists (
                select 1 from jsonb_array_elements(coalesce(wa_conversation, '[]'::jsonb)) msg
                where lower(coalesce(msg->>'role', '')) = 'user'
                   or lower(coalesce(msg->>'direction', '')) = 'inbound'
            ) as replied,
            (
                select count(*)
                from jsonb_array_elements(coalesce(wa_conversation, '[]'::jsonb)) msg
                where (lower(coalesce(msg->>'role', '')) = 'bot' or lower(coalesce(msg->>'direction', '')) = 'outbound')
                  and (lower(coalesce(msg->>'status', '')) like '%failed%' or (msg->>'error') is not null)
            ) as conv_failed_count
        from has_activity
        where had_activity
          and effective_date between p_from and p_to
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
        end,
        (select count(*)::int from in_scope where s1),
        (select count(*)::int from in_scope where s2),
        (select count(*)::int from in_scope where s3),
        (select count(*)::int from in_scope where s4),
        (select count(*)::int from in_scope where s5),
        (select count(*)::int from in_scope where s6),
        (select coalesce(sum((f1::int + f2::int + f3::int + f4::int + f6::int) + conv_failed_count), 0)::int from in_scope);
end;
$$;
