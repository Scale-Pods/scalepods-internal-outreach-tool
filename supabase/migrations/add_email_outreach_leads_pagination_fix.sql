-- Run this after add_email_outreach_leads.sql — adds p_limit/p_offset so the
-- caller can batch-fetch past PostgREST's ~1000-row response cap (confirmed:
-- get_outreach_leads('cold') returned only 1000 of 4572 actual cold rows
-- without this). Same create-or-replace, just with two new parameters and a
-- LIMIT/OFFSET added to the final SELECT.

create or replace function public.get_outreach_leads(
    p_lead_type text default null,  -- 'cold' | 'hot' | null (both)
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
                'email', coalesce(nullif("Personal Email", ''), nullif("Work Email", ''), 'No Email'),
                'phone', coalesce(company_phone_number, personal_phone, ''),
                'senderEmail', nullif("SENDERS  EMAIL", ''),
                'lastContacted', "Email Last Contacted",
                'createdAt', created_at,
                'replied', "Replied",
                'emailReplyTrack', _is_truthy("Email_Reply_Track"),
                'bounced', _is_truthy(email_bounced),
                'unsubscribed', _is_truthy(email_unsubscribed),
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Email_1", 'status', "Email_1_Status", 'messageId', "Email_1_Message_ID"),
                    jsonb_build_object('stage', 2, 'content', "Email_2", 'status', "Email_2_Status", 'messageId', "Email_2_Message_ID"),
                    jsonb_build_object('stage', 3, 'content', "Email_3", 'status', "Email_3_Status", 'messageId', "Email_3_Message_ID"),
                    jsonb_build_object('stage', 4, 'content', "Email_4", 'status', "Email_4_Status", 'messageId', "Email_4_Message_ID"),
                    jsonb_build_object('stage', 5, 'content', "Email_5", 'status', "Email_5_Status", 'messageId', "Email_5_Message_ID"),
                    jsonb_build_object('stage', 6, 'content', "Email_6", 'status', "Email_6_Status", 'messageId', "Email_6_Message_ID")
                ),
                'replies', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'index', idx,
                        'userReplied', case when _is_truthy(uc) then uc else null end,
                        'botReplied', case when _is_truthy(bc) then bc else null end,
                        'userStatusOnly', false,
                        'botStatusOnly', false
                    ) order by idx), '[]'::jsonb)
                    from unnest(
                        array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
                        array["User_Replied_1","User_Replied_2","User_Replied_3","User_Replied_4","User_Replied_5",
                              "User_Replied_6","User_Replied_7","User_Replied_8","User_Replied_9","User_Replied_10",
                              "User_Replied_11","User_Replied_12","User_Replied_13","User_Replied_14","User_Replied_15",
                              "User_Replied_16","User_Replied_17","User_Replied_18","User_Replied_19","User_Replied_20",
                              "User_Replied_21","User_Replied_22","User_Replied_23","User_Replied_24","User_Replied_25"],
                        array["Bot_Replied_1","Bot_Replied_2","Bot_Replied_3","Bot_Replied_4","Bot_Replied_5",
                              "Bot_Replied_6","Bot_Replied_7","Bot_Replied_8","Bot_Replied_9","Bot_Replied_10",
                              "Bot_Replied_11","Bot_Replied_12","Bot_Replied_13","Bot_Replied_14","Bot_Replied_15",
                              "Bot_Replied_16","Bot_Replied_17","Bot_Replied_18","Bot_Replied_19","Bot_Replied_20",
                              "Bot_Replied_21","Bot_Replied_22","Bot_Replied_23","Bot_Replied_24","Bot_Replied_25"]
                    ) as t(idx, uc, bc)
                    where _is_truthy(uc) or _is_truthy(bc)
                )
            ) as lead_json
        from public."ENRICHED_LEADS"
    ),
    master_cold as (
        select
            jsonb_build_object(
                'id', coalesce(lead_uuid::text, company_phone_number),
                'table', 'master_cold_leads',
                'leadType', 'cold',
                'fullName', coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce(first_name, '') || ' ' || coalesce("Last Name", '') || ' ' || coalesce(last_name, '')), 'Unknown Lead'),
                'email', coalesce(nullif("Personal Email", ''), nullif(email, ''), 'No Email'),
                'phone', coalesce(company_phone_number, mobile_number, personal_phone, ''),
                'senderEmail', nullif("SENDERS  EMAIL", ''),
                'lastContacted', coalesce("Email Last Contacted", email_last_sent_at),
                'createdAt', created_at,
                'replied', "Replied",
                'emailReplyTrack', _is_truthy("Email_Reply_Track"),
                'bounced', _is_truthy(email_bounced),
                'unsubscribed', _is_truthy(email_unsubscribed),
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Email_1", 'status', "Email_1_Status", 'messageId', "Email_1_Message_ID"),
                    jsonb_build_object('stage', 2, 'content', "Email_2", 'status', "Email_2_Status", 'messageId', "Email_2_Message_ID"),
                    jsonb_build_object('stage', 3, 'content', "Email_3", 'status', "Email_3_Status", 'messageId', "Email_3_Message_ID"),
                    jsonb_build_object('stage', 4, 'content', "Email_4", 'status', "Email_4_Status", 'messageId', "Email_4_Message_ID"),
                    jsonb_build_object('stage', 5, 'content', "Email_5", 'status', "Email_5_Status", 'messageId', "Email_5_Message_ID"),
                    jsonb_build_object('stage', 6, 'content', "Email_6", 'status', "Email_6_Status", 'messageId', "Email_6_Message_ID")
                ),
                'replies', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'index', idx,
                        'userReplied', case when _is_truthy(uc) then uc else null end,
                        'botReplied', case when _is_truthy(bc) then bc else null end,
                        'userStatusOnly', (_is_truthy(uc) or _is_truthy(us)) and not _is_truthy(uc),
                        'botStatusOnly', (_is_truthy(bc) or _is_truthy(bs)) and not _is_truthy(bc)
                    ) order by idx), '[]'::jsonb)
                    from unnest(
                        array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
                        array["User_Replied_1","User_Replied_2","User_Replied_3","User_Replied_4","User_Replied_5",
                              "User_Replied_6","User_Replied_7","User_Replied_8","User_Replied_9","User_Replied_10",
                              "User_Replied_11","User_Replied_12","User_Replied_13","User_Replied_14","User_Replied_15",
                              "User_Replied_16","User_Replied_17","User_Replied_18","User_Replied_19","User_Replied_20",
                              "User_Replied_21","User_Replied_22","User_Replied_23","User_Replied_24","User_Replied_25"],
                        array["Bot_Replied_1","Bot_Replied_2","Bot_Replied_3","Bot_Replied_4","Bot_Replied_5",
                              "Bot_Replied_6","Bot_Replied_7","Bot_Replied_8","Bot_Replied_9","Bot_Replied_10",
                              "Bot_Replied_11","Bot_Replied_12","Bot_Replied_13","Bot_Replied_14","Bot_Replied_15",
                              "Bot_Replied_16","Bot_Replied_17","Bot_Replied_18","Bot_Replied_19","Bot_Replied_20",
                              "Bot_Replied_21","Bot_Replied_22","Bot_Replied_23","Bot_Replied_24","Bot_Replied_25"],
                        array["User_Replied_Status_1","User_Replied_Status_2","User_Replied_Status_3","User_Replied_Status_4","User_Replied_Status_5",
                              "User_Replied_Status_6","User_Replied_Status_7","User_Replied_Status_8","User_Replied_Status_9","User_Replied_Status_10",
                              "User_Replied_Status_11","User_Replied_Status_12","User_Replied_Status_13","User_Replied_Status_14","User_Replied_Status_15",
                              "User_Replied_Status_16","User_Replied_Status_17","User_Replied_Status_18","User_Replied_Status_19","User_Replied_Status_20",
                              "User_Replied_Status_21","User_Replied_Status_22","User_Replied_Status_23","User_Replied_Status_24","User_Replied_Status_25"],
                        array["Bot_Replied_Status_1","Bot_Replied_Status_2","Bot_Replied_Status_3","Bot_Replied_Status_4","Bot_Replied_Status_5",
                              "Bot_Replied_Status_6","Bot_Replied_Status_7","Bot_Replied_Status_8","Bot_Replied_Status_9","Bot_Replied_Status_10",
                              "Bot_Replied_Status_11","Bot_Replied_Status_12","Bot_Replied_Status_13","Bot_Replied_Status_14","Bot_Replied_Status_15",
                              "Bot_Replied_Status_16","Bot_Replied_Status_17","Bot_Replied_Status_18","Bot_Replied_Status_19","Bot_Replied_Status_20",
                              "Bot_Replied_Status_21","Bot_Replied_Status_22","Bot_Replied_Status_23","Bot_Replied_Status_24","Bot_Replied_Status_25"]
                    ) as t(idx, uc, bc, us, bs)
                    where _is_truthy(uc) or _is_truthy(bc) or _is_truthy(us) or _is_truthy(bs)
                )
            ) as lead_json
        from public.master_cold_leads
    ),
    hubspot as (
        select
            jsonb_build_object(
                'id', coalesce(lead_id::text, company_phone_number),
                'table', 'hubspot_lead',
                'leadType', 'hot',
                'fullName', coalesce(full_name, trim(coalesce("First Name", '') || ' ' || coalesce("Last Name", '')), 'Unknown Lead'),
                'email', coalesce(nullif("Personal Email", ''), nullif("Work Email", ''), 'No Email'),
                'phone', coalesce(company_phone_number, personal_phone, ''),
                'senderEmail', nullif("SENDERS  EMAIL", ''),
                'lastContacted', "Email Last Contacted",
                'createdAt', created_at,
                'replied', "Replied",
                'emailReplyTrack', _is_truthy("Email_Reply_Track"),
                'bounced', _is_truthy(email_bounced),
                'unsubscribed', _is_truthy(email_unsubscribed),
                'stages', jsonb_build_array(
                    jsonb_build_object('stage', 1, 'content', "Email_1", 'status', "Email_1_Status", 'messageId', "Email_1_Message_ID"),
                    jsonb_build_object('stage', 2, 'content', "Email_2", 'status', "Email_2_Status", 'messageId', "Email_2_Message_ID"),
                    jsonb_build_object('stage', 3, 'content', "Email_3", 'status', "Email_3_Status", 'messageId', "Email_3_Message_ID"),
                    jsonb_build_object('stage', 4, 'content', "Email_4", 'status', "Email_4_Status", 'messageId', "Email_4_Message_ID"),
                    jsonb_build_object('stage', 5, 'content', "Email_5", 'status', "Email_5_Status", 'messageId', "Email_5_Message_ID"),
                    jsonb_build_object('stage', 6, 'content', "Email_6", 'status', "Email_6_Status", 'messageId', "Email_6_Message_ID")
                ),
                'replies', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'index', idx,
                        'userReplied', case when _is_truthy(uc) then uc else null end,
                        'botReplied', case when _is_truthy(bc) then bc else null end,
                        'userStatusOnly', false,
                        'botStatusOnly', false
                    ) order by idx), '[]'::jsonb)
                    from unnest(
                        array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
                        array["User_Replied_1","User_Replied_2","User_Replied_3","User_Replied_4","User_Replied_5",
                              "User_Replied_6","User_Replied_7","User_Replied_8","User_Replied_9","User_Replied_10",
                              "User_Replied_11","User_Replied_12","User_Replied_13","User_Replied_14","User_Replied_15",
                              "User_Replied_16","User_Replied_17","User_Replied_18","User_Replied_19","User_Replied_20",
                              "User_Replied_21","User_Replied_22","User_Replied_23","User_Replied_24","User_Replied_25"],
                        array["Bot_Replied_1","Bot_Replied_2","Bot_Replied_3","Bot_Replied_4","Bot_Replied_5",
                              "Bot_Replied_6","Bot_Replied_7","Bot_Replied_8","Bot_Replied_9","Bot_Replied_10",
                              "Bot_Replied_11","Bot_Replied_12","Bot_Replied_13","Bot_Replied_14","Bot_Replied_15",
                              "Bot_Replied_16","Bot_Replied_17","Bot_Replied_18","Bot_Replied_19","Bot_Replied_20",
                              "Bot_Replied_21","Bot_Replied_22","Bot_Replied_23","Bot_Replied_24","Bot_Replied_25"]
                    ) as t(idx, uc, bc)
                    where _is_truthy(uc) or _is_truthy(bc)
                )
            ) as lead_json
        from public.hubspot_lead
    ),
    all_leads as (
        select lead_json from enriched
        union all
        select lead_json from master_cold
        union all
        select lead_json from hubspot
    )
    select lead_json
    from all_leads
    where p_lead_type is null or (lead_json->>'leadType') = p_lead_type
    limit p_limit offset p_offset;
$$;
