"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    MapPin, Loader2, Send, CheckCircle2, Search, Filter, X, 
    Table as TableIcon, Download, Eye, Calendar, Tag, RefreshCw,
    Hash, Layers, Target, Database, ChevronLeft, Layout
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Country, State } from 'country-state-city';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

export default function GoogleMapsScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        countryCode: "US",
        language: "en",
        state: "",
        maxCrawledPlacesPerSearch: 10,
        maximumLeadsEnrichmentRecords: 10,
        campaign_name: ""
    });
    const router = useRouter();

    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [searchQueries, setSearchQueries] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // History and Modal
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Countries & States
    const countries = Country.getAllCountries();
    const [statesList, setStatesList] = useState<any[]>([]);

    const CATEGORIES = ["Steel distributor", "Steel fabricator", "Metal workshop", "Industrial wholesaler", "Construction company"];
    const LANGUAGES = [{ code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "fr", name: "French" }];

    useEffect(() => {
        fetchCampaigns();
        const channel = supabase.channel('gmap_v2_compact').on('postgres_changes', { event: '*', schema: 'public', table: 'gmap_leadsv2' }, () => { fetchCampaigns(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchLeadsForCampaign = (campaign: any) => {
        setSelectedCampaign(campaign);
        setIsModalOpen(true);
    };

    // Date Filtering State
    const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
        from: subDays(new Date(), 30),
        to: new Date()
    });

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

            const response = await fetch(`/api/google-maps/leads?${params.toString()}`, {
                cache: 'no-store'
            });
            if (!response.ok) throw new Error("Failed to fetch leads");
            const result = await response.json();
            const data = result.data;
            if (!data || data.length === 0) { setCampaigns([]); return; }

            const grouped = data.reduce((acc: any[], current: any) => {
                const name = current.campaign_name || 'Unnamed';
                const existingIndex = acc.findIndex(item => item.campaign_name === name);
                if (existingIndex !== -1) {
                    acc[existingIndex].leads.push(current);
                    if (!acc[existingIndex].Input_queries && current.Input_queries) acc[existingIndex].Input_queries = current.Input_queries;
                    if (current.scraped_at && (!acc[existingIndex].scraped_at || new Date(current.scraped_at) > new Date(acc[existingIndex].scraped_at))) {
                        acc[existingIndex].scraped_at = current.scraped_at;
                        acc[existingIndex].scrape_date = current.scrape_date;
                    }
                } else {
                    acc.push({ ...current, leads: [current] });
                }
                return acc;
            }, []);

            grouped.sort((a: any, b: any) => {
                const dateA = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
                const dateB = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
                return dateB - dateA;
            });
            setCampaigns(grouped);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (formData.countryCode) setStatesList(State.getStatesOfCountry(formData.countryCode));
    }, [formData.countryCode]);

    const handleCountryChange = (isoCode: string) => {
        setFormData(prev => ({ ...prev, countryCode: isoCode, state: "" }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type } = e.target;
        const val = type === 'number' ? (value === '' ? '' : parseInt(value)) : value;
        setFormData(prev => ({ ...prev, [id]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        const inputParams = { queries: searchQueries, location: `${formData.state}, ${formData.countryCode}`, categories: selectedCategories, max_places: formData.maxCrawledPlacesPerSearch, max_leads: formData.maximumLeadsEnrichmentRecords };
        const payload = { ...formData, searchStringsArray: searchQueries.join(", "), categoryFilterWords: selectedCategories.join(", "), Input_queries: JSON.stringify(inputParams), scrape_date: new Date().toISOString() };

        try {
            const response = await fetch("/api/webhook/google-maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("Trigger failed");
            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 3000);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            fetchCampaigns();
        }
    };

    const downloadExcel = (leads: any[], fileName: string) => {
        const cleanLeads = leads.map(({id, campaign_name, Input_queries, scrape_date, ...rest}) => rest);
        const worksheet = XLSX.utils.json_to_sheet(cleanLeads);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const parseInputQueries = (q: any) => {
        if (!q) return null;
        if (typeof q === 'object') return q;
        try {
            return JSON.parse(q);
        } catch (e) {
            // Handle "Key:Value\nKey:Value" format
            const obj: any = {};
            const lines = q.split(/\n/);
            lines.forEach((line: string) => {
                const sepIndex = line.indexOf(':');
                if (sepIndex !== -1) {
                    const key = line.substring(0, sepIndex).trim();
                    const value = line.substring(sepIndex + 1).trim();
                    if (key && value) obj[key] = value;
                }
            });
            return Object.keys(obj).length > 0 ? obj : { "Raw Source": q };
        }
    };

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto px-4 pt-1 pb-10">
            {/* Minimal Header */}
            <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.push('/dashboard/lead-scrapper')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-none">Google Maps Scraper <span className="text-red-600 text-xs font-black ml-1">V2</span></h1>
                        <p className="text-[10px] text-slate-400 font-medium tracking-tight">Active Table: <span className="text-slate-600">gmap_leadsv2</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {submitted && <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse py-1">Extraction Launched</Badge>}
                    <Button onClick={fetchCampaigns} variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Config Area - Tighter */}
                <Card className="lg:col-span-9 border-slate-200 shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="py-3 px-5 bg-slate-50/50 border-b">
                        <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Layout className="h-3.5 w-3.5" /> Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <Label htmlFor="campaign_name" className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Campaign Name</Label>
                                <Input id="campaign_name" value={formData.campaign_name} onChange={handleChange} placeholder="e.g. London Logistics" className="h-9 text-xs rounded-lg border-slate-200" required />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Search Queries (Separated by enters)</Label>
                                <div className="flex gap-2">
                                    <Input value={currentSearchQuery} onChange={(e) => setCurrentSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), currentSearchQuery.trim() && (setSearchQueries(p => [...p, currentSearchQuery.trim()]), setCurrentSearchQuery("")))} placeholder="Enter business name..." className="h-9 text-xs rounded-lg border-slate-200" />
                                    <Button type="button" size="sm" onClick={() => currentSearchQuery.trim() && (setSearchQueries(p => [...p, currentSearchQuery.trim()]), setCurrentSearchQuery(""))} className="h-9 bg-slate-900">Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {searchQueries.map((q, i) => (
                                        <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md gap-1.5">
                                            {q} <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchQueries(p => p.filter((_, idx) => idx !== i))} />
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Country</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-9 justify-between text-xs px-3 border-slate-200 font-medium">
                                            {formData.countryCode ? countries.find(c => c.isoCode === formData.countryCode)?.name : "Country"}
                                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0 shadow-xl border-0 overflow-hidden bg-white">
                                        <div className="max-h-48 overflow-y-auto">
                                            {countries.map(c => (
                                                <div key={c.isoCode} onClick={() => handleCountryChange(c.isoCode)} className={cn("px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors", formData.countryCode === c.isoCode && "bg-red-50 text-red-600")}>
                                                    {c.name}
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">State</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-9 justify-between text-xs px-3 border-slate-200 font-medium" disabled={!formData.countryCode}>
                                            {formData.state || "State"}
                                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0 shadow-xl border-0 overflow-hidden bg-white">
                                        <div className="max-h-48 overflow-y-auto">
                                            {statesList.map(s => (
                                                <div key={s.isoCode} onClick={() => setFormData(p => ({...p, state: s.name}))} className={cn("px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors", formData.state === s.name && "bg-red-50 text-red-600")}>
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Language</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-9 justify-between text-xs px-3 border-slate-200 font-medium">
                                            {LANGUAGES.find(l => l.code === formData.language)?.name || "Auto"}
                                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-0 shadow-xl border-0 overflow-hidden bg-white">
                                        {LANGUAGES.map(l => (
                                            <div key={l.code} onClick={() => setFormData(p => ({...p, language: l.code}))} className={cn("px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50", formData.language === l.code && "bg-red-50 text-red-600")}>
                                                {l.name}
                                            </div>
                                        ))}
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Constraints - Tighter */}
                <div className="lg:col-span-3 space-y-4">
                    <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-slate-50/30">
                        <CardHeader className="py-3 px-5 border-b bg-white">
                            <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filters & Limits</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Industry Categories</Label>
                                <div className="flex flex-wrap gap-1">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat} type="button" onClick={() => setSelectedCategories(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat])} className={cn("px-2 py-1 text-[9px] font-bold rounded-md border", selectedCategories.includes(cat) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600")}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                <div className="space-y-1">
                                    <Label className="text-[8px] font-black text-slate-400 uppercase">Max Places</Label>
                                    <Input id="maxCrawledPlacesPerSearch" type="number" value={formData.maxCrawledPlacesPerSearch} onChange={handleChange} className="h-8 text-[11px] font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[8px] font-black text-slate-400 uppercase">Leads/Place</Label>
                                    <Input id="maximumLeadsEnrichmentRecords" type="number" value={formData.maximumLeadsEnrichmentRecords} onChange={handleChange} className="h-8 text-[11px] font-bold" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button 
                        type="submit" 
                        className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-500/20 gap-2 uppercase tracking-widest"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {loading ? "Initializing..." : "Start Engine"}
                    </Button>
                </div>
            </form>

            <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                            <Database className="h-4 w-4 text-red-600" /> Recent Runs
                        </h2>
                        <DateRangePicker 
                            onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} 
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Total Found: {campaigns.length}</span>
                </div>

                {campaigns.length === 0 ? (
                    <div className="py-12 bg-slate-50 rounded-2xl border border-dashed text-center">
                        <p className="text-xs text-slate-400 font-medium italic">Your extraction history is currently empty.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {campaigns.slice(0, 20).map((c, i) => (
                            <Card 
                                key={i} 
                                className="group border-slate-200 shadow-sm hover:shadow-md hover:border-red-200 rounded-xl cursor-pointer transition-all duration-200 bg-white"
                                onClick={() => fetchLeadsForCampaign(c)}
                            >
                                <div className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 rounded-md border-slate-100 bg-slate-50 text-slate-400 font-bold">
                                            {c.scraped_at && !isNaN(new Date(c.scraped_at).getTime()) 
                                                ? new Date(c.scraped_at).toLocaleDateString() 
                                                : c.scrape_date || 'N/A'}
                                        </Badge>
                                        <span className="text-[10px] font-black text-red-600">{c.leads?.length}</span>
                                    </div>
                                    <h3 className="text-xs font-black text-slate-800 leading-tight truncate group-hover:text-red-700">{c.campaign_name}</h3>
                                    
                                    {c.Input_queries && (
                                        <div className="mt-2 pt-2 border-t border-slate-50 flex gap-1 overflow-hidden h-4">
                                            {parseInputQueries(c.Input_queries)?.queries?.map((q: string, idx: number) => (
                                                <span key={idx} className="text-[8px] text-slate-400 bg-slate-50 px-1 rounded truncate whitespace-nowrap">{q}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="h-8 bg-slate-50/50 border-t flex items-center justify-between px-3">
                                    <span className="text-[8px] font-black uppercase text-slate-400">READY</span>
                                    <Download className="h-3 w-3 text-slate-300 group-hover:text-red-500" />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[98vw] h-[95vh] rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl border-0 [&>button]:hidden">
                    <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center">
                                <Target className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight leading-none">{selectedCampaign?.campaign_name}</DialogTitle>
                                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-1">
                                    <span className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        {selectedCampaign?.scraped_at && !isNaN(new Date(selectedCampaign.scraped_at).getTime()) 
                                            ? new Date(selectedCampaign.scraped_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) 
                                            : selectedCampaign?.scrape_date || 'Recent Run'} 
                                        <span className="opacity-30">•</span>
                                        <Layers className="h-3 w-3" />
                                        {selectedCampaign?.leads?.length || 0} Records Found
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-widest gap-2 bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" onClick={() => downloadExcel(selectedCampaign.leads, selectedCampaign.campaign_name)}>
                                <Download className="h-3.5 w-3.5" /> Export Excel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} className="h-9 w-9 p-0 bg-slate-100 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Clean Light Parameter Bar */}
                    {selectedCampaign?.Input_queries && (
                        <div className="bg-white border-b px-10 py-5 overflow-x-auto">
                            <div className="flex items-center gap-12 whitespace-nowrap min-w-max">
                                {Object.entries(parseInputQueries(selectedCampaign.Input_queries) || {}).map(([k, v]: any) => {
                                    if (!v || (Array.isArray(v) && v.length === 0)) return null;
                                    const label = k.replace(/_/g, ' ').toUpperCase();
                                    return (
                                        <div key={k} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {typeof v === 'string' && v.includes(',') ? (
                                                    v.split(',').map((item, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-[10px] font-bold border-red-100 text-red-600 py-0 px-2 h-5 bg-red-50/30">
                                                            {item.trim()}
                                                        </Badge>
                                                    ))
                                                ) : Array.isArray(v) ? (
                                                    v.map((item, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-[10px] font-bold border-red-100 text-red-600 py-0 px-2 h-5 bg-red-50/30">
                                                            {String(item)}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-[12px] font-bold text-slate-800">{String(v)}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto p-4 bg-slate-100/30">
                        <div className="mx-auto w-full border rounded-xl bg-white shadow-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-slate-900 border-0">
                                        {selectedCampaign?.leads?.[0] && Object.keys(selectedCampaign.leads[0])
                                            .filter(k => !['id','campaign_name','Input_queries','scrape_date','scraped_at'].includes(k))
                                            .map(k => (
                                                <TableHead key={k} className="h-10 px-4 font-black text-white/40 text-[9px] uppercase tracking-widest border-0">{k.replace(/_/g,' ')}</TableHead>
                                            ))
                                        }
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedCampaign?.leads?.map((l: any, i: number) => (
                                        <TableRow key={i} className="hover:bg-red-50/20 border-slate-50 h-8">
                                            {Object.entries(l)
                                                .filter(([k]) => !['id','campaign_name','Input_queries','scrape_date'].includes(k))
                                                .map(([k, v], vi) => (
                                                    <TableCell key={vi} className="py-2 px-4 text-slate-700 text-[11px] font-medium max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                                                        {v === true ? <Badge className="bg-emerald-50 text-emerald-600 py-0 text-[10px]">YES</Badge> : v === false ? <Badge variant="outline" className="py-0 text-[10px]">NO</Badge> : String(v || '-')}
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
        </div>
    );
}
