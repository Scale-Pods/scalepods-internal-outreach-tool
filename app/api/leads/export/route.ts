import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const BATCH_SIZE = 1000;
const MAX_ROWS = 50000;

// Renders any value (including nested JSON/jsonb columns) as a single complete
// CSV cell — objects/arrays are flattened to readable "key: value" text rather
// than truncated or shown as [object Object].
function stringifyCellValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map((item) => stringifyCellValue(item)).join(' | ');
        }
        return Object.entries(value)
            .map(([k, v]) => `${k}: ${stringifyCellValue(v)}`)
            .join(' | ');
    }

    return String(value);
}

// Escapes a cell for CSV — always quotes, doubles internal quotes, and
// preserves the value in full (no truncation).
function csvEscape(value: any): string {
    const str = stringifyCellValue(value);
    return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table');
    const search = searchParams.get('search') || '';

    if (!table) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    try {
        const allRows: any[] = [];
        let offset = 0;

        while (offset < MAX_ROWS) {
            let query = supabaseAdmin.from(table).select('*');

            if (search) {
                query = query.or(`full_name.ilike.%${search}%,company_phone_number.ilike.%${search}%`);
            }

            const { data, error } = await query.range(offset, offset + BATCH_SIZE - 1);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allRows.push(...data);
            offset += BATCH_SIZE;

            if (data.length < BATCH_SIZE) break;
        }

        if (allRows.length === 0) {
            return NextResponse.json({ error: 'No records found to export' }, { status: 404 });
        }

        // Union of every key across every row — some rows may have columns others don't.
        const columnSet = new Set<string>();
        allRows.forEach((row) => Object.keys(row).forEach((k) => columnSet.add(k)));
        const columns = Array.from(columnSet);

        const headerLine = columns.map((c) => csvEscape(c)).join(',');
        const bodyLines = allRows.map((row) =>
            columns.map((col) => csvEscape(row[col])).join(',')
        );

        const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${table}-export-${Date.now()}.csv"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
    }
}
