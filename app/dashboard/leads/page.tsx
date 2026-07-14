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
import { Database, ChevronLeft, ChevronRight, ArrowLeft, Send, Search, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const TABLES = [
    { id: 'master_leads_unique', name: 'Master Leads Unique', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'master_cold_leads', name: 'Master Cold Leads', color: 'bg-slate-50 text-slate-700 border-slate-200' },
    { id: 'ENRICHED_LEADS', name: 'Enriched Leads', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'LinkedIn_leads', name: 'LinkedIn Leads', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'gmap_leadsv2', name: 'Google Maps Leads', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'hubspot_lead', name: 'HubSpot Leads', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { id: 'icp_tracker', name: 'ICP Tracker', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'meta_lead_tracker', name: 'Meta Ads Leads', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
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

    useEffect(() => {
        if (activeTable) {
            setSelectedIds(new Set());
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
        const url = activeTable === 'master_cold_leads'
            ? 'https://n8n.srv1010832.hstgr.cloud/webhook/master-cold-to-enriched'
            : 'https://n8n.srv1010832.hstgr.cloud/webhook/leads/enrich';
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
        if (selectedIds.size === tableData.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(tableData.map(r => getRowId(r))));
        }
    };

    if (loadingCounts && !activeTable) {
        return <div className="h-screen"><SPLoader /></div>;
    }

    if (activeTable) {
        const tableConfig = TABLES.find(t => t.id === activeTable);
        
        let columns = tableData.length > 0 ? Object.keys(tableData[0]).filter(k => k !== 'id' && !k.startsWith('_')).slice(0, 10) : [];
        if (activeTable === 'hubspot_lead') {
            columns = ['full_name', 'company_phone_number', 'Personal Email', 'status', 'lifecyclestage', 'created_at'];
        }
        if (activeTable === 'master_leads_unique' && tableData.length > 0 && 'lead_uuid' in tableData[0]) {
            columns = ['lead_uuid', ...columns.filter(c => c !== 'lead_uuid')];
        }
        if (activeTable === 'master_cold_leads') {
            columns = ['lead_uuid', 'full_name', 'company_name', 'email', 'mobile_number', 'company_phone_number', 'title', 'industry', 'city', 'state', 'country', 'lifecyclestage', 'enrichment_status', 'created_at'];
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
                                                    checked={tableData.length > 0 && selectedIds.size === tableData.length}
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
                                                    <TableCell key={col} className="text-sm text-slate-600 whitespace-nowrap max-w-[200px] truncate" title={String(row[col] || '')}>
                                                        {String(row[col] || '—')}
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
