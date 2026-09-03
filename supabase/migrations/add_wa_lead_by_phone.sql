-- Run this after add_wa_leads_date_filter.sql / rpc_analysis_and_functions.sql.
--
-- Targeted single-lead lookup by phone (or id), for the WhatsApp chat
-- detail page (app/dashboard/whatsapp/chat/[customerId]) and the public
-- share-chat route (app/api/public/chat/[customerId]). Both previously
-- fetched the ENTIRE unbounded WhatsApp universe (all leads, all
-- conversation history, no date range) across 3 tables just to find one
-- match by phone — the worst offender for egress since there wasn't even
-- a date range to shrink it. This does the WHERE-clause match in SQL
-- instead, so only the matching row (if any) is ever serialized.

create or replace function public.get_wa_lead_by_phone(
    p_phone_digits text,            -- digits-only phone to match (any substring match, same as the old .includes() check)
    p_lead_type text default null   -- 'cold' | 'hot' | 'hubspot_wa' | null (search all three)
)
returns jsonb
language plpgsql
stable
as $$
declare
    v_result jsonb;
begin
    if p_lead_type is null or p_lead_type = 'cold' then
        select jsonb_build_object(
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
        )
        into v_result
        from public."ENRICHED_LEADS"
        where regexp_replace(coalesce(company_phone_number, ''), '\D', '', 'g') like ('%' || p_phone_digits || '%')
           or regexp_replace(coalesce(personal_phone, ''), '\D', '', 'g') like ('%' || p_phone_digits || '%')
        limit 1;

        if v_result is not null then
            return v_result;
        end if;
    end if;

    if p_lead_type is null or p_lead_type = 'hot' then
        select jsonb_build_object(
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
        )
        into v_result
        from public.hubspot_lead
        where regexp_replace(coalesce(company_phone_number, ''), '\D', '', 'g') like ('%' || p_phone_digits || '%')
           or regexp_replace(coalesce(personal_phone, ''), '\D', '', 'g') like ('%' || p_phone_digits || '%')
        limit 1;

        if v_result is not null then
            return v_result;
        end if;
    end if;

    if p_lead_type is null or p_lead_type = 'hubspot_wa' then
        select jsonb_build_object(
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
        )
        into v_result
        from public.hubspot_wa_outreach
        where regexp_replace(coalesce(company_phone_number, ''), '\D', '', 'g') like ('%' || p_phone_digits || '%')
        limit 1;

        if v_result is not null then
            return v_result;
        end if;
    end if;

    return null;
end;
$$;
