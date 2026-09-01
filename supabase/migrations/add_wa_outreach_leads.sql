-- Run this once against Supabase (after rpc_analysis_and_functions.sql,
-- which defines _is_truthy that this depends on).
--
-- Full RPC replacement for lib/services/whatsapp-outreach.ts's
-- fetchWaLeads() + normalizeWaRow() — returns the complete
-- NormalizedWaLead shape (identity, stages[], conversation[]) as one jsonb
-- row per lead, built in SQL. wa_conversation is native jsonb on all three
-- tables, so it's passed straight through as the 'conversation' field
-- rather than rebuilt — the JS-side parseWaConversation() still runs on it
-- client-side for defensive re-parsing (handles the case where a caller
-- passes a JSON-encoded string instead of a native array, same as before).

create or replace function public.get_wa_leads(
    p_lead_type text default null,  -- 'cold' | 'hot' | 'hubspot_wa' | null (all)
    p_limit integer default 1000,
    p_offset integer default 0
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
            ) as lead_json
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
            ) as lead_json
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
            ) as lead_json
        from public.hubspot_wa_outreach
    ),
    all_leads as (
        select lead_json from enriched
        union all
        select lead_json from hubspot
        union all
        select lead_json from hubspot_wa
    )
    select lead_json
    from all_leads
    where p_lead_type is null or (lead_json->>'leadType') = p_lead_type
    limit p_limit offset p_offset;
$$;
