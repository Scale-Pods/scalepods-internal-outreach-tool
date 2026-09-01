-- Run this once against Supabase — adds the one new function needed for the
-- master dashboard's hubspot_lead stats (leads/whatsapp/voice/replies),
-- which was missing from rpc_analysis_and_functions.sql v2. Depends on
-- _is_truthy, _is_truthy_narrow, and _safe_ts already existing (from that
-- file) — run this AFTER rpc_analysis_and_functions.sql, not before.

create or replace function public.get_dashboard_hubspot_stats(
    p_from timestamptz,
    p_to timestamptz
)
returns table (
    hubspot_leads integer,
    hubspot_whatsapp_sent integer,
    hubspot_voice_contacted integer,
    hubspot_whatsapp_reply integer
)
language plpgsql
stable
as $$
begin
    return query
    with scoped as (
        select
            "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
            "Voice_1_Status", "Voice_1_Date", "Voice_2_Status", "Voice_2_Date",
            "WTS_Reply_Track",
            "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
            coalesce(
                _safe_ts("Email Last Contacted"), _safe_ts("Whatsapp Last Contacted"),
                _safe_ts("Voice Last Contacted"), _safe_ts(voice_last_contacted), created_at
            ) as effective_date
        from public.hubspot_lead
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
        from scoped
        where effective_date between p_from and p_to
    )
    select
        count(*)::int,
        count(*) filter (where was_wa_sent)::int,
        count(*) filter (where was_voice_sent)::int,
        count(*) filter (where did_wa_reply)::int
    from in_scope;
end;
$$;
