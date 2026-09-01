-- Run this once against Supabase (after add_wa_outreach_leads.sql and
-- rpc_analysis_and_functions.sql).
--
-- Mirrors whatsapp-outreach.ts's computeWaMetrics(): contacted/sent/replied
-- counts computed server-side. Note: hasWaActivity() gating (only leads
-- with ANY stage content or conversation history are considered at all,
-- before the date-range filter even applies) is folded in here as a WHERE
-- clause, same as fetchWaLeads().filter(hasWaActivity) + computeWaMetrics()
-- in the JS.
create or replace function public.get_wa_outreach_metrics(
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
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date
        from public."ENRICHED_LEADS"
        where p_lead_type = 'cold'

        union all

        select
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_6",
            wa_conversation,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
        from public.hubspot_lead
        where p_lead_type = 'hot'

        union all

        select
            "Whatsapp_1", null, null, null, null,
            wa_conversation,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at)
        from public.hubspot_wa_outreach
        where p_lead_type = 'hubspot_wa'
    ),
    has_activity as (
        select *,
            (_is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
             or _is_truthy("Whatsapp_4") or _is_truthy(whatsapp_6)
             or jsonb_array_length(coalesce(wa_conversation, '[]'::jsonb)) > 0) as had_activity
        from unioned
    ),
    in_scope as (
        select
            (_is_truthy("Whatsapp_1")::int + _is_truthy("Whatsapp_2")::int + _is_truthy("Whatsapp_3")::int
             + _is_truthy("Whatsapp_4")::int + _is_truthy(whatsapp_6)::int) as stages_sent,
            exists (
                select 1 from jsonb_array_elements(coalesce(wa_conversation, '[]'::jsonb)) msg
                where lower(coalesce(msg->>'role', '')) = 'user'
                   or lower(coalesce(msg->>'direction', '')) = 'inbound'
            ) as replied
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
        end;
end;
$$;
