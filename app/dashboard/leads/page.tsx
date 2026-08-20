"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SPLoader } from "@/components/sp-loader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Database, ChevronLeft, ChevronRight, ArrowLeft, Send, Search, Loader2, CheckCircle2, AlertCircle, X, Phone, MessageCircle, Copy, Check, ExternalLink, Braces, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

// Columns whose values should render as clickable links (with copy) rather than plain text
const LINK_COLUMNS = new Set([
    'Url', 'url', 'linkedin', 'company_linkedin', 'company_linkedin_uid', 'company_website', 'company_domain',
    'Github', 'github', 'Twitter', 'twitter',
    'Work Email', 'Personal Email', 'Other Personal Emails', 'Other Work Emails', 'email',
    'SENDERS  EMAIL',
]);

// Columns whose values should render with a Call / WhatsApp popover
const PHONE_COLUMNS = new Set([
    'company_phone_number', 'personal_phone', 'mobile_number', 'Other Phone Numbers',
]);

function isEmailValue(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function isUrlValue(val: string) {
    return /^https?:\/\//i.test(val.trim()) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(val.trim());
}

function normalizeUrl(val: string) {
    const trimmed = val.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className="text-slate-400 hover:text-slate-700 shrink-0"
            title="Copy"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

function LinkCell({ value }: { value: string }) {
    const trimmed = value.trim();
    if (isEmailValue(trimmed)) {
        return (
            <div className="flex items-center gap-1.5">
                <a
                    href={`mailto:${trimmed}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate max-w-[160px]"
                    title={trimmed}
                >
                    {trimmed}
                </a>
                <CopyButton text={trimmed} />
            </div>
        );
    }
    if (isUrlValue(trimmed)) {
        const href = normalizeUrl(trimmed);
        return (
            <div className="flex items-center gap-1.5">
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate max-w-[160px] flex items-center gap-1"
                    title={trimmed}
                >
                    {trimmed}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <CopyButton text={trimmed} />
            </div>
        );
    }
    return <span className="truncate max-w-[200px] block" title={trimmed}>{trimmed}</span>;
}

function PhoneCell({ value }: { value: string }) {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return <span>—</span>;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-700 hover:text-blue-600 hover:underline flex items-center gap-1.5"
                >
                    <Phone className="h-3 w-3 text-slate-400" />
                    {trimmed}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-1">
                    <a
                        href={`tel:${digits}`}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 text-sm text-slate-700"
                    >
                        <Phone className="h-3.5 w-3.5 text-blue-600" /> Call
                    </a>
                    <a
                        href={`https://wa.me/${digits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 text-sm text-slate-700"
                    >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                    </a>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// Try to parse a value into a JS object/array — handles both native jsonb objects
// and jsonb columns that come back as JSON-encoded strings.
function tryParseJson(value: any): any | null {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return null;
            }
        }
    }
    return null;
}

function isEmpty(parsed: any): boolean {
    if (Array.isArray(parsed)) return parsed.length === 0;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length === 0;
    return true;
}

// Renders a single value inside the JSON popover — links/emails/phones stay clickable
function JsonLeafValue({ value }: { value: any }) {
    if (value === null || value === undefined || value === '') return <span className="text-slate-400 italic">empty</span>;
    if (typeof value === 'object') return <JsonReadable data={value} depth={1} />;

    const strVal = String(value);
    if (isEmailValue(strVal)) {
        return <a href={`mailto:${strVal}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">{strVal}</a>;
    }
    if (isUrlValue(strVal)) {
        return <a href={normalizeUrl(strVal)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">{strVal}</a>;
    }
    const digits = strVal.replace(/\D/g, '');
    if (digits.length >= 7 && /^[+\d\s()-]+$/.test(strVal)) {
        return (
            <span className="inline-flex items-center gap-2">
                {strVal}
                <a href={`tel:${digits}`} className="text-blue-600 hover:underline text-xs">Call</a>
                <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline text-xs">WhatsApp</a>
            </span>
        );
    }
    return <span>{strVal}</span>;
}

// Recursively renders parsed JSON as a readable key: value list (or bulleted list for arrays)
function JsonReadable({ data, depth = 0 }: { data: any; depth?: number }) {
    if (Array.isArray(data)) {
        if (data.length === 0) return <span className="text-slate-400 italic">empty</span>;
        return (
            <ul className={depth > 0 ? "pl-3 space-y-1 list-disc list-inside" : "space-y-1.5"}>
                {data.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700">
                        <JsonLeafValue value={item} />
                    </li>
                ))}
            </ul>
        );
    }
    if (data && typeof data === 'object') {
        const entries = Object.entries(data);
        if (entries.length === 0) return <span className="text-slate-400 italic">empty</span>;
        return (
            <dl className={depth > 0 ? "pl-3 space-y-1" : "space-y-1.5"}>
                {entries.map(([k, v]) => (
                    <div key={k} className="flex gap-1.5 text-sm">
                        <dt className="font-semibold text-slate-500 shrink-0">{k.replace(/_/g, ' ')}:</dt>
                        <dd className="text-slate-700 min-w-0"><JsonLeafValue value={v} /></dd>
                    </div>
                ))}
            </dl>
        );
    }
    return <JsonLeafValue value={data} />;
}

// Compact one-line preview of parsed JSON for the collapsed table cell
function jsonPreview(parsed: any): string {
    if (Array.isArray(parsed)) {
        if (parsed.length === 0) return '—';
        const first = parsed.map(v => (typeof v === 'object' ? Object.values(v)[0] : v)).filter(Boolean)[0];
        return parsed.length > 1 ? `${first} +${parsed.length - 1} more` : String(first ?? '—');
    }
    const values = Object.values(parsed).filter(v => v !== null && v !== undefined && v !== '');
    if (values.length === 0) return '—';
    return String(values[0]);
}

function JsonCell({ value }: { value: any }) {
    const parsed = tryParseJson(value);
    if (parsed === null) return <span className="truncate max-w-[200px] block" title={String(value)}>{String(value)}</span>;
    if (isEmpty(parsed)) return <span className="text-slate-300">—</span>;

    const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 max-w-[200px]"
                >
                    <Braces className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{jsonPreview(parsed)}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 shrink-0">{count}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-80 overflow-auto p-3" onClick={(e) => e.stopPropagation()}>
                <JsonReadable data={parsed} />
            </PopoverContent>
        </Popover>
    );
}

function LeadCell({ col, value }: { col: string; value: any }) {
    if (value === null || value === undefined || value === '') return <span className="text-slate-300">—</span>;

    const parsedJson = tryParseJson(value);
    if (parsedJson !== null) return <JsonCell value={value} />;

    const strVal = String(value);
    if (!strVal) return <span className="text-slate-300">—</span>;

    if (PHONE_COLUMNS.has(col)) return <PhoneCell value={strVal} />;
    if (LINK_COLUMNS.has(col) && (isEmailValue(strVal) || isUrlValue(strVal))) return <LinkCell value={strVal} />;
    return <span className="truncate max-w-[200px] block" title={strVal}>{strVal}</span>;
}

const TABLES = [
    { id: 'master_cold_leads', name: 'Master Cold Leads', color: 'bg-slate-50 text-slate-700 border-slate-200' },
    { id: 'ENRICHED_LEADS', name: 'Enriched Leads', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'LinkedIn_leads', name: 'LinkedIn Leads', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'gmap_leadsv2', name: 'Google Maps Leads', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'hubspot_lead', name: 'Hot Leads', color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

function PaginationFooter({ totalItems, currentPage, itemsPerPage, onPageChange }: {
    totalItems: number; currentPage: number; itemsPerPage: number; onPageChange: (p: number) => void;
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const getPageNumbers = (): (number | string)[] => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages];
        if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Showing {start}–{end} of {totalItems.toLocaleString()} leads</p>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((p, i) =>
                    typeof p === 'string'
                        ? <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">…</span>
                        : <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm"
                            className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-slate-900 text-white' : ''}`}
                            onClick={() => onPageChange(p as number)}>
                            {p}
                        </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export default function LeadsPage() {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loadingCounts, setLoadingCounts] = useState(true);
    
    const [activeTable, setActiveTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [tableTotal, setTableTotal] = useState(0);
    const [tableLoading, setTableLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingIds, setSendingIds] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Auto-dismiss toast
    useEffect(() => {
        if (toast.show) {
            const t = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
            return () => clearTimeout(t);
        }
    }, [toast.show]);

    // Debounce search query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch('/api/leads/counts');
                const data = await res.json();
                setCounts(data);
            } catch (err) {
                console.error("Failed to fetch counts", err);
            } finally {
                setLoadingCounts(false);
            }
        };
        fetchCounts();
    }, []);

    const fetchTableData = useCallback(async (tableName: string, currentPage: number, search: string) => {
        setTableLoading(true);
        try {
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
            const res = await fetch(`/api/leads/source?table=${tableName}&page=${currentPage}&limit=10${searchParam}`);
            const data = await res.json();
            setTableData(data.data || []);
            setTableTotal(data.count || 0);
        } catch (err) {
            console.error("Failed to fetch table data", err);
        } finally {
            setTableLoading(false);
        }
    }, []);

    // Clear selection only when switching tables or search changes — not on page change,
    // so selections persist across pagination.
    useEffect(() => {
        if (activeTable) {
            setSelectedIds(new Set());
        }
    }, [activeTable, debouncedSearch]);

    useEffect(() => {
        if (activeTable) {
            fetchTableData(activeTable, page, debouncedSearch);
        }
    }, [activeTable, page, debouncedSearch, fetchTableData]);

    const handleTableClick = (tableName: string) => {
        setPage(1);
        setSearchQuery("");
        setDebouncedSearch("");
        setSelectedIds(new Set());
        setActiveTable(tableName);
    };

    const handleSendSelected = async () => {
        if (selectedIds.size === 0) return;
        setSendingIds(true);
        const url = 'https://n8n.srv1010832.hstgr.cloud/webhook/leads/enrich';
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_uuids: Array.from(selectedIds) })
            });
            if (res.ok) {
                setToast({ show: true, message: `Successfully sent ${selectedIds.size} lead(s) for enrichment!`, type: 'success' });
                setSelectedIds(new Set());
            } else {
                const text = await res.text();
                setToast({ show: true, message: `Failed to send leads: ${res.status} ${text || res.statusText}`, type: 'error' });
            }
        } catch (error) {
            console.error(error);
            setToast({ show: true, message: 'Failed to send leads.', type: 'error' });
        } finally {
            setSendingIds(false);
        }
    };

    const handleExportCsv = async () => {
        if (!activeTable || exporting) return;
        setExporting(true);
        try {
            const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
            const res = await fetch(`/api/leads/export?table=${activeTable}${searchParam}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Export failed (${res.status})`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="([^"]+)"/);
            const filename = match?.[1] || `${activeTable}-export.csv`;

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setToast({ show: true, message: 'CSV export downloaded successfully!', type: 'success' });
        } catch (error: any) {
            console.error(error);
            setToast({ show: true, message: error.message || 'Failed to export CSV.', type: 'error' });
        } finally {
            setExporting(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getRowId = (row: any) => String(row.lead_uuid || row.company_phone_number);

    const toggleSelectAll = () => {
        const pageIds = tableData.map(r => getRowId(r));
        const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    if (loadingCounts && !activeTable) {
        return <div className="h-screen"><SPLoader /></div>;
    }

    if (activeTable) {
        const tableConfig = TABLES.find(t => t.id === activeTable);
        
        let columns = tableData.length > 0 ? Object.keys(tableData[0]).filter(k => k !== 'id' && !k.startsWith('_')).slice(0, 10) : [];
        if (activeTable === 'hubspot_lead') {
            columns = [
                'full_name', 'company_phone_number', 'personal_phone', 'status', 'lifecyclestage',
                'Work Email', 'Personal Email', 'Other Personal Emails', 'Url', 'Twitter',
                'Company', 'countryCode', 'lead_ststus_id', 'email_unsubscribed',
                'Lead_Classification', 'Lead_Classification_Reason', 'last_conversation', 'date', 'created_at', 'updated_at',
            ];
        }
        if (activeTable === 'master_leads_unique' && tableData.length > 0 && 'lead_uuid' in tableData[0]) {
            columns = ['lead_uuid', ...columns.filter(c => c !== 'lead_uuid')];
        }
        if (activeTable === 'ENRICHED_LEADS') {
            columns = [
                // Enrichment data first, as requested
                'lead_type', 'enrichment_status', 'enrichment_provider', 'enriched_emails', 'enriched_phones',
                'enriched_whatsapps', 'enriched_socials', 'enrichment_pages_visited', 'enrichment_crawled_url', 'last_enriched_at',
                // Core identity/contact fields
                'full_name', 'First Name', 'Last Name', 'Job Title', 'Headline', 'Company', 'Industry',
                'company_phone_number', 'personal_phone', 'Other Phone Numbers',
                'Work Email', 'Personal Email', 'Other Personal Emails', 'Other Work Emails',
                'Work Email Status', 'Email_Classification', 'Email_Classification_Reason',
                'Url', 'Github', 'Twitter',
                'Lead_Classification', 'Lead_Classification_Reason',
                'seniority', 'department', 'company_domain', 'company_website',
                'Location', 'city', 'state', 'country', 'country_code',
                'created_at', 'updated_at',
            ];
        }
        if (activeTable === 'master_cold_leads') {
            columns = [
                'enrichment_status', 'enrichment_provider', 'enriched_emails', 'enriched_phones',
                'enriched_whatsapps', 'enriched_socials', 'enrichment_pages_visited', 'enrichment_crawled_url', 'last_enriched_at',
                'lead_uuid', 'full_name', 'first_name', 'last_name', 'company_name', 'title', 'headline', 'seniority', 'department',
                'email', 'Personal Email', 'mobile_number', 'company_phone_number', 'linkedin', 'company_linkedin', 'company_linkedin_uid',
                'company_domain', 'company_website', 'industry', 'employees_count',
                'city', 'state', 'country', 'company_city', 'company_state', 'company_country', 'company_postal_code',
                'lifecyclestage', 'Loop', 't_name', 'source', 'created_at', 'updated_at',
            ];
        }
        // Only keep columns that are actually present in the returned rows
        if (tableData.length > 0) {
            const availableKeys = new Set(Object.keys(tableData[0]));
            columns = columns.filter(c => availableKeys.has(c));
        }

        return (
            <div className="space-y-6 pb-10 relative">
                {tableLoading && <SPLoader />}
                <div className="flex items-center gap-4 pt-6">
                    <Button variant="ghost" size="sm" onClick={() => setActiveTable(null)} className="h-9 px-3 gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{tableConfig?.name || activeTable}</h1>
                        <p className="text-sm text-slate-500">
                            {tableTotal.toLocaleString()} records found
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search by name, email, or phone..." 
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {(activeTable === 'master_leads_unique' || activeTable === 'master_cold_leads') && selectedIds.size > 0 && (
                        <Button
                            size="sm"
                            disabled={sendingIds}
                            onClick={handleSendSelected}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 h-9 px-4 font-semibold"
                        >
                            {sendingIds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send Selected ({selectedIds.size})
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={exporting || tableTotal === 0}
                        onClick={handleExportCsv}
                        className="gap-2 h-9 px-4 font-semibold border-slate-200"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export CSV
                    </Button>
                </div>

                <Card className="bg-white shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 border-b border-slate-100">
                                        {(activeTable === 'master_leads_unique' || activeTable === 'master_cold_leads') && (
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={tableData.length > 0 && tableData.every(r => selectedIds.has(getRowId(r)))}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                        )}
                                        {columns.map((col) => (
                                            <TableHead key={col} className="text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                                                {col.replace(/_/g, ' ')}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tableData.length === 0 && !tableLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={(columns.length || 1) + ((activeTable === 'master_leads_unique' || activeTable === 'master_cold_leads') ? 1 : 0)} className="text-center py-12 text-slate-400">
                                                No records found in this table.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        tableData.map((row, idx) => (
                                            <TableRow key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                {(activeTable === 'master_leads_unique' || activeTable === 'master_cold_leads') && (
                                                    <TableCell className="w-10">
                                                        <Checkbox 
                                                            checked={selectedIds.has(getRowId(row))}
                                                            onCheckedChange={() => toggleSelect(getRowId(row))}
                                                        />
                                                    </TableCell>
                                                )}
                                                {columns.map((col) => (
                                                    <TableCell key={col} className="text-sm text-slate-600 whitespace-nowrap max-w-[200px]">
                                                        <LeadCell col={col} value={row[col]} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <PaginationFooter 
                                totalItems={tableTotal} 
                                currentPage={page} 
                                itemsPerPage={10} 
                                onPageChange={setPage} 
                            />
                        </div>
                    </CardContent>
                </Card>
                {toast.show && (
                    <div className={`fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-3 ${
                        toast.type === 'success'
                            ? 'bg-emerald-900 border-emerald-700 text-emerald-100'
                            : 'bg-red-900 border-red-700 text-red-100'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                        {toast.message}
                        <button onClick={() => setToast({ ...toast, show: false })} className="ml-2 hover:opacity-70">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <div className="pt-6">
                <h1 className="text-2xl font-bold text-slate-900">Lead Database Segregation</h1>
                <p className="text-sm text-slate-500">
                    Overview of all lead sources and data collections. Click on any card to view its data.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {TABLES.map((table) => (
                    <Card 
                        key={table.id} 
                        className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border border-slate-200 ${table.color.split(' ')[0]} bg-opacity-20`}
                        onClick={() => handleTableClick(table.id)}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                                <Database className="h-4 w-4" />
                                {table.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-black text-slate-900">
                                {counts[table.id] !== undefined ? counts[table.id].toLocaleString() : <span className="animate-pulse bg-slate-200 text-transparent rounded w-16 inline-block">000</span>}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Total Records</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
