-- Cold Call Logs: stores calls placed via the browser dialer (TWILIO_PHONE_NUMBER),
-- populated by Twilio status/recording/transcription webhooks.
create table if not exists twilio_call_logs (
    id uuid primary key default gen_random_uuid(),
    call_sid text unique not null,
    from_number text,
    to_number text,
    direction text,               -- 'outbound-api' | 'inbound' etc (raw Twilio value)
    status text,                  -- 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled' | ...
    duration_seconds integer default 0,
    recording_sid text,
    recording_url text,           -- Twilio media URL (requires Basic Auth to fetch)
    transcription_sid text,
    transcription_text text,
    transcription_status text,    -- 'completed' | 'failed' | 'in-progress'
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_twilio_call_logs_created_at on twilio_call_logs (created_at desc);
create index if not exists idx_twilio_call_logs_call_sid on twilio_call_logs (call_sid);
