// Caller ID numbers available to the browser dialer (Twilio Voice).
// Shared between the dialer UI (number picker), the TwiML route (validates
// the chosen "From" against this allow-list before using it as callerId),
// and the Cold Call Logs page (maps a raw from_number back to a friendly label).

export interface CallerNumber {
    /** E.164 number, must be a voice-capable number owned by the Twilio account. */
    number: string;
    /** Short label shown in the picker and call logs, e.g. "US" or "UK". */
    label: string;
    /** Human-friendly formatted number for display. */
    display: string;
}

export const CALLER_NUMBERS: CallerNumber[] = [
    { number: '+14472881677', label: 'US', display: '+1 447 288 1677' },
    { number: '+447462179561', label: 'UK', display: '+44 7462 179561' },
];

export const DEFAULT_CALLER_NUMBER = CALLER_NUMBERS[0].number;

export function isAllowedCallerNumber(number: string | null | undefined): boolean {
    const n = (number || '').trim();
    return CALLER_NUMBERS.some(c => c.number === n);
}

export function getCallerNumberMeta(number: string | null | undefined): CallerNumber | null {
    const n = (number || '').trim();
    return CALLER_NUMBERS.find(c => c.number === n) || null;
}
