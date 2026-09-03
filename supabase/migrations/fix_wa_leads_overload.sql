-- Run this to fix an ambiguous-function error: the previous migration's
-- CREATE OR REPLACE added new trailing params, which Postgres treats as a
-- DIFFERENT overload (not a true replace) since the parameter list differs
-- from the original 3-arg signature. Both versions now coexist, so a call
-- with exactly 3 positional/named args (p_lead_type, p_limit, p_offset) is
-- ambiguous between them. Drop the old 3-arg signature so only the 6-arg
-- version (with p_from/p_to/p_activity_only) remains — every call site
-- resolves unambiguously afterward regardless of how many trailing
-- optional args it passes.

drop function if exists public.get_wa_leads(text, integer, integer);

-- Same trap hit get_outreach_leads earlier in this session (its date-filter
-- migration also added trailing p_from/p_to as a new overload rather than a
-- true replace) — drop its old 3-arg signature too, for the same reason.
drop function if exists public.get_outreach_leads(text, integer, integer);
