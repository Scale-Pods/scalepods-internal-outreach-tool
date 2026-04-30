"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Globe, Loader2, Send, CheckCircle2, Search, Filter, X, 
    Table as TableIcon, Download, Eye, Calendar, Tag, RefreshCw,
    Hash, Layers, Target, Database, ChevronLeft, Layout, Trash2
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TradeIndiaScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        from_date: "2026-04-28",
        to_date: "2026-04-29",
        limit: "50",
        campaign_name: ""
    });

    const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fromDateStr = e.target.value;
        if (!fromDateStr) return;
        
        const fromDate = new Date(fromDateStr);
        const toDate = new Date(fromDate);
        toDate.setDate(fromDate.getDate() + 1);
        
        const toDateStr = toDate.toISOString().split('T')[0];
        
        setFormData(prev => ({
            ...prev,
            from_date: fromDateStr,
            to_date: toDateStr
        }));
    };
    const router = useRouter();

    // History and Modal
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Date Filtering State for Recent Runs
    const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
        from: subDays(new Date(), 30),
        to: new Date()
    });

    useEffect(() => {
        fetchCampaigns();
        const channel = supabase.channel('tradeindia_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'TradeIndia_leads' }, () => { fetchCampaigns(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [dateRange]);

    const fetchCampaigns = async () => {
        try {
            const params = new URLSearchParams();
            if (dateRange.from) {
                const f = new Date(dateRange.from);
                f.setHours(0,0,0,0);
                params.append('from', f.toISOString());
            }
            if (dateRange.to) {
                const t = new Date(dateRange.to);
                t.setHours(23,59,59,999);
                params.append('to', t.toISOString());
            }

            const response = await fetch(`/api/trade-india/leads?${params.toString()}`, {
                cache: 'no-store'
            });
            if (!response.ok) throw new Error("Failed to fetch leads");
            const result = await response.json();
            const data = result.data || [];

            const grouped = data.reduce((acc: any[], current: any) => {
                const name = current.campaign_name || 'Unnamed';
                const existingIndex = acc.findIndex(item => item.campaign_name === name);
                if (existingIndex !== -1) {
                    acc[existingIndex].leads.push(current);
                    if (!acc[existingIndex].Input_queries && current.Input_queries) acc[existingIndex].Input_queries = current.Input_queries;
                } else {
                    acc.push({ ...current, leads: [current] });
                }
                return acc;
            }, []);

            grouped.sort((a: any, b: any) => (b.unique_id || 0) - (a.unique_id || 0));
            setCampaigns(grouped);
        } catch (e) {
            console.error(e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        const payload = {
            from_date: formData.from_date,
            to_date: formData.to_date,
            limit: formData.limit,
            "campaign name": formData.campaign_name
        };

        try {
            const response = await fetch("/api/webhook/trade-india", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });
            if (!response.ok) throw new Error("Trigger failed");
            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 3000);
            setFormData(p => ({ ...p, campaign_name: "" }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            fetchCampaigns();
        }
    };

    const downloadExcel = (leads: any[], fileName: string) => {
        const cleanLeads = leads.map(({campaign_name, Input_queries, ...rest}) => rest);
        const worksheet = XLSX.utils.json_to_sheet(cleanLeads);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const deleteCampaign = async (campaignName: string) => {
        if (!confirm(`Are you sure you want to delete "${campaignName}"?`)) return;
        try {
            const response = await fetch(`/api/trade-india/leads?campaign_name=${encodeURIComponent(campaignName)}`, {
                method: 'DELETE'
            });
            if (response.ok) fetchCampaigns();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto px-4 pt-1 pb-10 font-sans">
            {/* Minimal Header - Exactly like image */}
            <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard/lead-scrapper')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-md shadow-orange-100">
                        <Globe className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-none flex items-center gap-2">
                            Trade India Scrapper <span className="text-orange-600 text-[10px] font-black bg-orange-50 px-1.5 py-0.5 rounded-full">V2</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">Active Table: <span className="text-slate-600 font-bold uppercase">TradeIndia_leads</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {submitted && <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse py-1 px-3 rounded-lg text-[10px] font-bold">Extraction Launched</Badge>}
                    <Button onClick={fetchCampaigns} variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Config Area - Expanded to full width */}
                <Card className="lg:col-span-12 border-slate-200 shadow-sm rounded-xl overflow-hidden ring-1 ring-slate-100">
                    <CardHeader className="py-3 px-5 bg-slate-50/50 border-b">
                        <CardTitle className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Layout className="h-3.5 w-3.5" /> Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="campaign_name" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Campaign Name</Label>
                                <Input 
                                    id="campaign_name" 
                                    value={formData.campaign_name} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Mumbai Textile Suppliers" 
                                    className="h-10 text-xs rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-orange-500/20 transition-all font-medium" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Extraction Limit</Label>
                                <Select value={formData.limit} onValueChange={(val) => setFormData(p => ({...p, limit: val}))}>
                                    <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-orange-500/20 font-medium">
                                        <SelectValue placeholder="Select Limit" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="50">50 Leads</SelectItem>
                                        <SelectItem value="100">100 Leads</SelectItem>
                                        <SelectItem value="500">500 Leads</SelectItem>
                                        <SelectItem value="1000">1000 Leads</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                            <div className="space-y-2">
                                <Label htmlFor="from_date" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">From Date</Label>
                                <div className="relative">
                                    <Input 
                                        id="from_date" 
                                        type="date" 
                                        value={formData.from_date} 
                                        onChange={handleFromDateChange} 
                                        className="h-10 text-xs rounded-xl border-slate-200 bg-white px-4 font-medium" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="to_date" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">To Date</Label>
                                <div className="relative">
                                    <Input 
                                        id="to_date" 
                                        type="date" 
                                        value={formData.to_date} 
                                        readOnly
                                        className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50 font-bold opacity-70 cursor-not-allowed px-4" 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button 
                                type="submit" 
                                className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-lg shadow-orange-500/20 gap-3 uppercase tracking-[0.1em] transition-all active:scale-[0.98]"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {loading ? "Launching..." : "Start Engine"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>

            {/* Recent Runs Section - Identical to image layout */}
            <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Database className="h-4 w-4 text-orange-600" /> Recent Runs
                        </h2>
                        <DateRangePicker 
                            onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} 
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">Total Found: {campaigns.length}</span>
                </div>

                {campaigns.length === 0 ? (
                    <div className="py-20 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic opacity-60">Extraction history is empty</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {campaigns.map((c, i) => (
                            <Card 
                                key={i} 
                                className="group relative border-none shadow-sm hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer transition-all duration-300 bg-white ring-1 ring-slate-100 overflow-hidden"
                                onClick={() => { setSelectedCampaign(c); setIsModalOpen(true); }}
                            >
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="text-[8px] font-black text-slate-300 border-slate-100 px-1.5 py-0 h-4 uppercase tracking-widest rounded-md">
                                            {c.scrape_date ? new Date(c.scrape_date).toLocaleDateString() : 'N/A'}
                                        </Badge>
                                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">{c.leads?.length}</span>
                                    </div>
                                    <h3 className="text-[13px] font-black text-slate-800 leading-tight truncate group-hover:text-orange-600 transition-colors uppercase italic tracking-tight">{c.campaign_name}</h3>
                                    
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-orange-500 tracking-widest flex items-center gap-1">
                                            <div className="h-1 w-1 bg-emerald-500 rounded-full" /> READY
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md"
                                                onClick={(e) => { e.stopPropagation(); deleteCampaign(c.campaign_name); }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                            <Download className="h-3 w-3 text-slate-300 group-hover:text-orange-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 left-0 w-1 h-full bg-orange-600 opacity-0 group-hover:opacity-100 transition-all" />
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col shadow-3xl border-0 [&>button]:hidden">
                    <div className="bg-white border-b px-8 py-5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="h-12 w-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-100">
                                <Target className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">{selectedCampaign?.campaign_name}</DialogTitle>
                                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="h-3 w-3" /> {selectedCampaign?.scrape_date || 'Recent'} 
                                    <span className="opacity-30">•</span>
                                    <Layers className="h-3 w-3" /> {selectedCampaign?.leads?.length || 0} Records
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 bg-orange-600 text-white border-none hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all" 
                                onClick={() => downloadExcel(selectedCampaign.leads, selectedCampaign.campaign_name)}
                            >
                                <Download className="h-4 w-4" /> Export Excel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} className="h-10 w-10 p-0 bg-slate-100 hover:bg-red-50 hover:text-red-600 transition-all rounded-xl">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                        <div className="mx-auto w-full border border-slate-100 rounded-2xl bg-white shadow-2xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900 sticky top-0 z-20">
                                    <TableRow className="hover:bg-slate-900 border-0 h-12">
                                        {selectedCampaign?.leads?.[0] && Object.keys(selectedCampaign.leads[0])
                                            .filter(k => !['campaign_name','Input_queries','scrape_date','unique_id'].includes(k))
                                            .map(k => (
                                                <TableHead key={k} className="h-10 px-6 font-black text-white/40 text-[9px] uppercase tracking-widest border-0 min-w-[180px]">{k.replace(/_/g,' ')}</TableHead>
                                            ))
                                        }
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedCampaign?.leads?.map((l: any, i: number) => (
                                        <TableRow key={i} className="hover:bg-orange-50/30 border-slate-50 group">
                                            {Object.entries(l)
                                                .filter(([k]) => !['campaign_name','Input_queries','scrape_date','unique_id'].includes(k))
                                                .map(([k, v], vi) => (
                                                    <TableCell key={vi} className="py-3.5 px-6 text-slate-700 text-[11px] font-bold max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-orange-900">
                                                        {v === true ? <Badge className="bg-emerald-50 text-emerald-600 py-0 text-[9px] font-black uppercase">YES</Badge> : v === false ? <Badge variant="outline" className="py-0 text-[9px] font-black uppercase opacity-30">NO</Badge> : String(v || '-')}
                                                    </TableCell>
                                                ))
                                            }
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Execution Started Popup Card */}
            {submitted && (
                <div className="fixed top-24 right-8 z-50 animate-in slide-in-from-right-8 fade-in duration-500 w-80">
                    <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.2)] bg-slate-900 rounded-2xl overflow-hidden ring-1 ring-white/10">
                        <div className="p-4 flex items-center gap-4">
                            <div className="relative">
                                <div className="h-12 w-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/40">
                                    <Send className="h-5 w-5 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-white font-black text-xs uppercase tracking-widest">Execution Started</h4>
                                <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-tighter">
                                    Trade India Engine is now scraping records...
                                </p>
                            </div>
                        </div>
                        <div className="h-1 w-full bg-slate-800">
                            <div className="h-full bg-orange-600 animate-[progress_3s_linear]" />
                        </div>
                    </Card>
                </div>
            )}
            <style jsx global>{`
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </div>
    );
}
