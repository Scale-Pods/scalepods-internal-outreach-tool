-- Run this after add_wa_outreach_leads.sql (and rpc_analysis_and_functions.sql
-- for _is_truthy/_safe_ts).
--
-- Adds server-side date-range filtering + activity gating to get_wa_leads —
-- every WhatsApp page (analytics, chat, chat/[customerId], leads, sent) was
-- calling /api/whatsapp/outreach with NO query params, so this RPC always
-- returned the entire lead+conversation universe across 3 tables regardless
-- of what date range the page actually needed. That's the same class of bug
-- already fixed for the email Sent/Received pages, and a major contributor
-- to the Supabase egress overage (WhatsApp conversation history can be as
-- large as email HTML bodies, shipped on every page load).
--
-- Return shape is unchanged (still one jsonb row per lead) — new trailing
-- params are optional, so this stays a plain CREATE OR REPLACE.

create or replace function public.get_wa_leads(
    p_lead_type text default null,   -- 'cold' | 'hot' | 'hubspot_wa' | null (all)
    p_limit integer default 1000,
    p_offset integer default 0,
    p_from timestamptz default null, -- null = no lower bound (all-time)
    p_to timestamptz default null,   -- null = no upper bound
    p_activity_only boolean default true -- mirrors hasWaActivity() gating done in JS today
)
returns setof jsonb
language sql
stable
as $$
    with enriched as (
        select
            jsonb_build_object(
                'id', coalesce(lead_uuid::text, id::text, company_phone_number),
                'table', 'ENRICHED_LEADS',
                'leadType', 'cold',
                'fullName', coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce("Last Name", '')), 'Unknown Lead'),
                'phone', coalesce(company_phone_number, personal_phone, ''),
                'lastContacted', "Whatsapp Last Contacted",
                'createdAt', created_at,
                'lifecycleStage', null,
                'leadClassification', null,
                'leadClassificationReason', null,
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Whatsapp_1", 'status', "Whatsapp_1_status"),
                    jsonb_build_object('stage', 2, 'content', "Whatsapp_2", 'status', "Whatsapp_2_status"),
                    jsonb_build_object('stage', 3, 'content', "Whatsapp_3", 'status', "Whatsapp_3_status"),
                    jsonb_build_object('stage', 4, 'content', "Whatsapp_4", 'status', "Whatsapp_4_status"),
                    jsonb_build_object('stage', 5, 'content', null, 'status', null),
                    jsonb_build_object('stage', 6, 'content', whatsapp_6, 'status', whatsapp_6_status)
                ),
                'conversation', coalesce(wa_conversation, '[]'::jsonb),
                'raw', jsonb_build_object('wa_conversation', wa_conversation)
            ) as lead_json,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date,
            (
                _is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
                or _is_truthy("Whatsapp_4") or _is_truthy(whatsapp_6)
                or jsonb_array_length(coalesce(wa_conversation, '[]'::jsonb)) > 0
            ) as had_activity
        from public."ENRICHED_LEADS"
    ),
    hubspot as (
        select
            jsonb_build_object(
                'id', coalesce(lead_id::text, company_phone_number),
                'table', 'hubspot_lead',
                'leadType', 'hot',
                'fullName', coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce("Last Name", '')), 'Unknown Lead'),
                'phone', coalesce(company_phone_number, personal_phone, ''),
                'lastContacted', "Whatsapp Last Contacted",
                'createdAt', created_at,
                'lifecycleStage', lifecyclestage,
                'leadClassification', "Lead_Classification",
                'leadClassificationReason', "Lead_Classification_Reason",
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Whatsapp_1", 'status', "Whatsapp_1_status"),
                    jsonb_build_object('stage', 2, 'content', "Whatsapp_2", 'status', "Whatsapp_2_status"),
                    jsonb_build_object('stage', 3, 'content', "Whatsapp_3", 'status', "Whatsapp_3_status"),
                    jsonb_build_object('stage', 4, 'content', "Whatsapp_4", 'status', "Whatsapp_4_status"),
                    jsonb_build_object('stage', 5, 'content', null, 'status', null),
                    jsonb_build_object('stage', 6, 'content', "Whatsapp_6", 'status', "Whatsapp_6_status")
                ),
                'conversation', coalesce(wa_conversation, '[]'::jsonb),
                'raw', jsonb_build_object('wa_conversation', wa_conversation)
            ) as lead_json,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date,
            (
                _is_truthy("Whatsapp_1") or _is_truthy("Whatsapp_2") or _is_truthy("Whatsapp_3")
                or _is_truthy("Whatsapp_4") or _is_truthy("Whatsapp_6")
                or jsonb_array_length(coalesce(wa_conversation, '[]'::jsonb)) > 0
            ) as had_activity
        from public.hubspot_lead
    ),
    hubspot_wa as (
        select
            jsonb_build_object(
                'id', coalesce(lead_id::text, company_phone_number),
                'table', 'hubspot_wa_outreach',
                'leadType', 'hubspot_wa',
                'fullName', coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce("Last Name", '')), 'Unknown Lead'),
                'phone', coalesce(company_phone_number, ''),
                'lastContacted', "Whatsapp Last Contacted"::text,
                'createdAt', created_at,
                'lifecycleStage', lifecyclestage,
                'leadClassification', "Lead_Classification",
                'leadClassificationReason', "Lead_Classification_Reason",
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Whatsapp_1", 'status', "Whatsapp_1_status")
                ),
                'conversation', coalesce(wa_conversation, '[]'::jsonb),
                'raw', jsonb_build_object('wa_conversation', wa_conversation)
            ) as lead_json,
            coalesce(_safe_ts("Whatsapp Last Contacted"), created_at) as effective_date,
            (
                _is_truthy("Whatsapp_1")
                or jsonb_array_length(coalesce(wa_conversation, '[]'::jsonb)) > 0
            ) as had_activity
        from public.hubspot_wa_outreach
    ),
    all_leads as (
        select lead_json, effective_date, had_activity from enriched
        union all
        select lead_json, effective_date, had_activity from hubspot
        union all
        select lead_json, effective_date, had_activity from hubspot_wa
    )
    select lead_json
    from all_leads
    where (p_lead_type is null or (lead_json->>'leadType') = p_lead_type)
      and (p_from is null or effective_date >= p_from)
      and (p_to is null or effective_date <= p_to)
      and (not p_activity_only or had_activity)
    order by effective_date desc nulls last
    limit p_limit offset p_offset;
$$;
