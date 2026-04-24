"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Linkedin, Loader2, Send, CheckCircle2, Search, Filter, X, 
    Table as TableIcon, Download, Eye, Calendar, Tag, RefreshCw,
    Hash, Layers, Target, Database, ChevronLeft, Layout, Briefcase, Building, MapPin,
    ArrowLeft, Plus, Check, ChevronsUpDown, Trash2
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

const INDUSTRIES = [
    "real estate",
    "marketing & advertising",
    "information technology & services",
    "computer software",
    "consumer services",
    "hospitality"
];

const FUNCTIONAL_LEVELS = [
    "c_suite", "finance", "product_management", "engineering", 
    "design", "education", "human_resources", "information_technology", 
    "legal", "marketing", "operations", "sales", "support"
];

const SENIORITY_LEVELS = [
     "founder", "owner", "c_suite", "director", "partner", "vp",
      "head", "manager", "senior", "entry", "trainee"
];

const CITIES = [
    "california, us", "texas, us", "england, united kingdom", "new york, us", "florida, us", 
    "illinois, us", "moscow, russia", "bavaria, germany", "pennsylvania, us", "virginia, us", 
    "ohio, us", "massachusetts, us", "georgia, us", "michigan, us", "north carolina, us", 
    "berlin, germany", "new jersey, us", "île-de-france, france", "maharashtra, india", 
    "ontario, canada", "beijing, china", "colorado, us", "minnesota, us", "karnataka, india", 
    "hamburg, germany", "shanghai, china", "flanders, belgium", "arizona, us", "ciudad de méxico, mexico",
    "tamil nadu, india", "hesse, germany", "dubai, united arab emirates", "jakarta, indonesia"
];

const LOCATIONS = [
    "united states", "united kingdom", "india", "germany", "france", "china", "canada", 
    "netherlands", "mexico", "belgium", "japan", "brazil", "australia", "poland", 
    "thailand", "sweden", "portugal", "spain", "italy", "vietnam", "nigeria", "singapore", 
    "hong kong", "ireland", "israel", "switzerland", "turkey", "romania", "south korea", 
    "indonesia", "united arab emirates", "saudi arabia", "austria", "philippines", 
    "malaysia", "argentina", "ukraine", "denmark", "norway", "finland", "new zealand"
];

const SIZES = [
    "1-10", "11-20", "21-50", "51-100", "101-200", "201-500", "501-1000", 
    "1001-2000", "2001-5000", "5001-10000", "10001-20000", "20001-50000", "50000+"
];

// Creatable Multi-Select Wrapper Component - Moved outside to prevent flickering
const MultiSelect = ({ label, options, selected, onChange, placeholder }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void, placeholder?: string }) => {
    const [inputValue, setInputValue] = useState("");
    
    const toggle = (val: string) => {
        const cleanVal = val.trim();
        if (!cleanVal) return;
        if (selected.includes(cleanVal)) {
            onChange(selected.filter(s => s !== cleanVal));
        } else {
            onChange([...selected, cleanVal]);
        }
        setInputValue("");
    };

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(inputValue.toLowerCase()));
    const isCustomAllowed = inputValue.length > 0 && !options.map(o => o.toLowerCase()).includes(inputValue.toLowerCase());

    return (
        <div className="space-y-1 font-bold">
            <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{label}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 rounded-lg justify-between border-slate-100 bg-white hover:bg-slate-50 font-bold transition-all text-xs truncate px-3">
                        <span className="truncate text-slate-700 font-bold">
                            {selected.length > 0 ? selected.join(", ") : (placeholder || `Select ${label}...`)}
                        </span>
                        <ChevronsUpDown className="h-3 w-3 opacity-30 shrink-0 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 shadow-2xl border-slate-100" align="start">
                    <Command className="rounded-xl overflow-hidden">
                        <div className="flex items-center border-b px-3 bg-slate-50/50">
                            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                            <input
                                placeholder={`Search or type custom ${label}...`}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); toggle(inputValue); } }}
                                className="flex h-9 w-full rounded-md bg-transparent py-3 text-[11px] outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
                            />
                        </div>
                        <ScrollArea className="max-h-[200px] overflow-auto">
                            <CommandGroup className="p-1">
                                {isCustomAllowed && (
                                    <CommandItem
                                        onSelect={() => toggle(inputValue)}
                                        className="flex items-center gap-2 cursor-pointer font-black text-[10px] text-blue-600 bg-blue-50/50 rounded-lg mb-1"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add "{inputValue}"
                                    </CommandItem>
                                )}
                                {filteredOptions.length === 0 && !isCustomAllowed && (
                                    <div className="py-6 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">No results</div>
                                )}
                                {filteredOptions.map((opt) => (
                                    <CommandItem
                                        key={opt}
                                        onSelect={() => toggle(opt)}
                                        className="flex items-center gap-2 cursor-pointer font-bold text-[11px] rounded-lg mb-0.5"
                                    >
                                        <div className={cn(
                                            "h-3.5 w-3.5 border rounded-sm flex items-center justify-center transition-all",
                                            selected.includes(opt) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                                        )}>
                                            {selected.includes(opt) && <Check className="h-2.5 w-2.5" />}
                                        </div>
                                        {opt}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </ScrollArea>
                    </Command>
                </PopoverContent>
            </Popover>
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                    {selected.map(s => (
                        <Badge key={s} className="bg-slate-100 hover:bg-slate-200 text-slate-600 border-none px-2 py-0.5 rounded font-black uppercase text-[7px] tracking-tighter transition-all flex items-center gap-1 shadow-sm">
                            {s}
                            <X className="h-2 w-2 cursor-pointer hover:text-red-500" onClick={() => toggle(s)} />
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function LinkedInScrapper() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        company_industry: [] as string[],
        company_keywords: "",
        contact_city: [] as string[],
        contact_location: [] as string[],
        email_status: "validated",
        fetch_count: 20,
        file_name: "",
        functional_level: [] as string[],
        seniority_level: [] as string[],
        size: [] as string[]
    });
    
    // History and Pending States
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [pendingRuns, setPendingRuns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
        from: subDays(new Date(), 30),
        to: new Date()
    });


    const [currentKeyword, setCurrentKeyword] = useState("");
    const addKeyword = () => {
        if (!currentKeyword.trim()) return;
        const keywords = formData.company_keywords ? formData.company_keywords.split(',').filter(Boolean) : [];
        if (!keywords.includes(currentKeyword.trim())) {
            const newKeywords = [...keywords, currentKeyword.trim()].join(',');
            setFormData({...formData, company_keywords: newKeywords});
        }
        setCurrentKeyword("");
    };

    const removeKeyword = (k: string) => {
        const keywords = formData.company_keywords.split(',').filter(s => s !== k).join(',');
        setFormData({...formData, company_keywords: keywords});
    };

    useEffect(() => {
        fetchCampaigns();
        const channel = supabase.channel('linkedin_v2_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'LinkedIn_leads' }, () => { fetchCampaigns(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // Clean pending runs that have now appeared in the real campaigns list
    useEffect(() => {
        if (pendingRuns.length > 0 && campaigns.length > 0) {
            setPendingRuns(prev => prev.filter(p => !campaigns.some(c => c.campaign_name === p.campaign_name)));
        }
    }, [campaigns, pendingRuns.length]);

    useEffect(() => {
        fetchCampaigns();
    }, [dateRange]);

    const deleteCampaign = async (campaignName: string) => {
        if (!confirm(`Are you sure you want to delete "${campaignName}" and all its leads?`)) return;
        
        try {
            const response = await fetch(`/api/linkedin/leads?campaign_name=${encodeURIComponent(campaignName)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchCampaigns();
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

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

            const response = await fetch(`/api/linkedin/leads?${params.toString()}`, { cache: 'no-store' });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Strictly following requested JSON structure for the backend
            const payload = {
                company_industry: formData.company_industry.map(i => i.toLowerCase()),
                company_keywords: formData.company_keywords.split(',').map(k => k.trim()).filter(Boolean),
                contact_city: formData.contact_city.map(c => c), // Keep casing for custom entries
                contact_location: formData.contact_location.map(l => l), // Keep casing for custom entries
                email_status: [formData.email_status],
                fetch_count: formData.fetch_count,
                file_name: formData.file_name,
                functional_level: formData.functional_level.map(f => f.toLowerCase()),
                seniority_level: formData.seniority_level.map(s => s.toLowerCase()),
                size: formData.size
            };

            const response = await fetch("/api/webhook/linkedin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setSubmitted(true);
                // Track as pending locally so user sees it instantly
                const newPending = {
                    campaign_name: formData.file_name,
                    scrape_date: new Date().toISOString().split('T')[0],
                    leads: [],
                    isPending: true
                };
                setPendingRuns(prev => [newPending, ...prev]);

                // Clear the fields properly
                setFormData({
                    company_industry: [],
                    company_keywords: "",
                    contact_city: [],
                    contact_location: [],
                    email_status: "validated",
                    fetch_count: 20,
                    file_name: "",
                    functional_level: [],
                    seniority_level: [],
                    size: []
                });
                setTimeout(() => setSubmitted(false), 5000);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const downloadExcel = (leads: any[], filename: string) => {
        const worksheet = XLSX.utils.json_to_sheet(leads);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    };

    const parseInputQueries = (q: any) => {
        if (!q) return null;
        if (typeof q === 'object') return q;
        try { return JSON.parse(q); } catch (e) {
            const obj: any = {};
            q.split(/\n/).forEach((line: string) => {
                const sep = line.indexOf(':');
                if (sep !== -1) obj[line.substring(0, sep).trim()] = line.substring(sep + 1).trim();
            });
            return Object.keys(obj).length > 0 ? obj : { "Raw Source": q };
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-2 lg:p-3 space-y-3">
            {/* Minimalist Header */}
            <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100" onClick={() => router.push('/dashboard/lead-scrapper')}>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <div className="flex items-center gap-2.5">
                        <div className="bg-blue-600 p-1.5 rounded-full shadow-md shadow-blue-100 ring-2 ring-blue-50">
                            <Linkedin className="h-3.5 w-3.5 text-white" fill="white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                LinkedIn Scraper <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">V2</span>
                            </h1>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">Table: LinkedIn_leads</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {submitted && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 animate-in fade-in zoom-in slide-in-from-right-4 duration-300 py-1 px-3 flex items-center gap-2 font-black uppercase text-[8px] tracking-widest shadow-sm">
                            <CheckCircle2 className="h-3 w-3" /> Engine Launched
                        </Badge>
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-100" onClick={fetchCampaigns}>
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                </div>
            </div>

            {/* Main Configuration Layout - Optimized Density */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Config Panel - Wide */}
                <Card className="lg:col-span-9 border-none shadow-sm bg-white rounded-xl overflow-hidden ring-1 ring-slate-100 flex flex-col">
                    <CardHeader className="border-b border-slate-50 p-3 flex flex-row items-center gap-2 bg-slate-50/30">
                        <Layout className="h-3.5 w-3.5 text-slate-400" />
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Core Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 flex-1">
                        <form id="linkedin-form" onSubmit={handleSubmit} className="space-y-4 font-bold">
                            <div className="space-y-1 font-bold">
                                <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Campaign Name</Label>
                                <Input 
                                    placeholder="e.g. Q2 International Outreach"
                                    className="h-9 rounded-lg border-slate-100 bg-white font-bold text-xs"
                                    value={formData.file_name}
                                    onChange={(e) => setFormData({...formData, file_name: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <MultiSelect 
                                    label="Target Industries" 
                                    options={INDUSTRIES} 
                                    selected={formData.company_industry} 
                                    onChange={(val) => setFormData({...formData, company_industry: val})} 
                                />
                                <MultiSelect 
                                    label="Function" 
                                    options={FUNCTIONAL_LEVELS} 
                                    selected={formData.functional_level} 
                                    onChange={(val) => setFormData({...formData, functional_level: val})} 
                                />
                                <MultiSelect 
                                    label="Seniority" 
                                    options={SENIORITY_LEVELS} 
                                    selected={formData.seniority_level} 
                                    onChange={(val) => setFormData({...formData, seniority_level: val})} 
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                <MultiSelect 
                                    label="Global Cities" 
                                    options={CITIES} 
                                    selected={formData.contact_city} 
                                    onChange={(val) => setFormData({...formData, contact_city: val})} 
                                />
                                <MultiSelect 
                                    label="Worldwide Region" 
                                    options={LOCATIONS} 
                                    selected={formData.contact_location} 
                                    onChange={(val) => setFormData({...formData, contact_location: val})} 
                                />
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Right Sidebar - Compact */}
                <div className="lg:col-span-3 space-y-3">
                    <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden ring-1 ring-slate-100">
                        <CardHeader className="p-3 border-b border-slate-50 bg-slate-50/30">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Extraction Filters</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 space-y-4 font-bold">
                            <div className="space-y-1 font-bold">
                                <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Fetch Limit</Label>
                                <Input 
                                    type="number"
                                    className="h-9 rounded-lg bg-slate-50/50 border-slate-100 font-bold text-xs"
                                    value={formData.fetch_count}
                                    onChange={(e) => setFormData({...formData, fetch_count: parseInt(e.target.value)})}
                                />
                            </div>

                            <div className="space-y-2 font-bold">
                                <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Keywords</Label>
                                <div className="flex gap-1.5">
                                    <Input 
                                        placeholder="Add..."
                                        className="h-8 rounded-lg border-slate-100 bg-white font-bold text-[10px]"
                                        value={currentKeyword}
                                        onChange={(e) => setCurrentKeyword(e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                                    />
                                    <Button type="button" onClick={addKeyword} size="sm" className="h-8 px-2 bg-slate-900 rounded-lg">
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1 min-h-[30px] p-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                    {formData.company_keywords ? formData.company_keywords.split(',').map((k, i) => (
                                        <Badge key={i} className="bg-blue-600 text-white px-1.5 py-0 rounded flex items-center gap-1 font-bold uppercase text-[7px] tracking-tighter">
                                            {k}
                                            <X className="h-2 w-2 cursor-pointer" onClick={() => removeKeyword(k)} />
                                        </Badge>
                                    )) : (
                                        <span className="text-[7px] text-slate-400 font-black uppercase italic opacity-50">None</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-50">
                                <MultiSelect 
                                    label="Company Size" 
                                    options={SIZES} 
                                    selected={formData.size} 
                                    onChange={(val) => setFormData({...formData, size: val})} 
                                />
                                <div className="space-y-1 font-bold">
                                    <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Email</Label>
                                    <Select defaultValue="validated" onValueChange={(val) => setFormData({...formData, email_status: val})}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-100 font-bold bg-slate-50/50 text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="validated">Validated</SelectItem>
                                            <SelectItem value="all">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button 
                        form="linkedin-form"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-black uppercase tracking-[0.1em] text-sm shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        Start Engine
                    </Button>
                </div>
            </div>

            {/* Recent Runs Section */}
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2 italic">
                            <Database className="h-4 w-4 text-blue-600" /> Recent Runs
                        </h2>
                        <DateRangePicker 
                            onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} 
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Found: {campaigns.length}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Pending Runs Rendering */}
                    {pendingRuns.map((p, idx) => (
                        <Card key={`pending-${idx}`} className="group relative border-dashed border-blue-200 bg-blue-50/20 rounded-xl overflow-hidden shadow-none ring-1 ring-blue-50">
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="text-[9px] font-bold text-blue-400 border-blue-100 bg-white">
                                        Just Now
                                    </Badge>
                                    <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm leading-tight italic truncate">
                                    {p.campaign_name}
                                </h3>
                                <div className="pt-2 border-t border-blue-100/50 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-pulse" />
                                        Running Engine
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {/* Completed Campaigns Rendering */}
                    {campaigns.map((c, idx) => {
                        const queries = parseInputQueries(c.Input_queries);
                        return (
                            <Card 
                                key={idx} 
                                className="group relative border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white rounded-2xl overflow-hidden ring-1 ring-slate-100/50 cursor-pointer"
                                onClick={() => { setSelectedCampaign(c); setIsModalOpen(true); }}
                            >
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="text-[8px] font-black text-slate-300 border-slate-100 px-2 py-0 h-4 uppercase tracking-[0.1em] rounded-full">
                                            {c.scrape_date ? new Date(c.scrape_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Archive'}
                                        </Badge>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100/50 tabular-nums">{c.leads.length}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                onClick={(e) => { e.stopPropagation(); deleteCampaign(c.campaign_name); }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-black text-slate-900 text-[13px] leading-tight group-hover:text-blue-600 transition-colors uppercase italic tracking-tight truncate">
                                            {c.campaign_name}
                                        </h3>
                                        
                                        {/* Parameter Preview - High Density Context */}
                                        <div className="mt-2 flex flex-wrap gap-1 min-h-[16px]">
                                            {queries?.company_industry && (
                                                <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 rounded truncate max-w-[80px]">{Array.isArray(queries.company_industry) ? queries.company_industry[0] : queries.company_industry}</span>
                                            )}
                                            {queries?.contact_location && (
                                                <span className="text-[8px] font-bold text-blue-400 bg-blue-50 px-1.5 rounded truncate max-w-[80px]">{Array.isArray(queries.contact_location) ? queries.contact_location[0] : queries.contact_location}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between group-hover:border-blue-50 transition-colors">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500">Ready</span>
                                        </div>
                                        <Download className="h-3 w-3 text-slate-200 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                                    </div>
                                </div>
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Card>
                        );
                    })}
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[98vw] h-[95vh] rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl border-0 [&>button]:hidden">
                    {/* Synchronized Header */}
                    <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                                <Linkedin className="h-5 w-5 text-white" fill="white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase italic">{selectedCampaign?.campaign_name}</DialogTitle>
                                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                                    <span className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        {selectedCampaign?.scrape_date || 'Recent Run'} 
                                        <span className="opacity-30">•</span>
                                        <Layers className="h-3 w-3" />
                                        {selectedCampaign?.leads?.length || 0} Records Extracted
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest gap-2 bg-blue-600 text-white border-none hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all" onClick={() => downloadExcel(selectedCampaign?.leads || [], selectedCampaign?.campaign_name || 'leads')}>
                                <Download className="h-3.5 w-3.5" /> Export Excel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} className="h-9 w-9 p-0 bg-slate-100 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Parameter Bar - Google Maps Parity */}
                    {selectedCampaign?.Input_queries && (
                        <div className="bg-white border-b px-10 py-5 overflow-x-auto shrink-0 scrollbar-hide">
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
                                                        <Badge key={idx} variant="outline" className="text-[10px] font-bold border-blue-100 text-blue-600 py-0 px-2 h-5 bg-blue-50/30">
                                                            {item.trim()}
                                                        </Badge>
                                                    ))
                                                ) : Array.isArray(v) ? (
                                                    v.map((item, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-[10px] font-bold border-blue-100 text-blue-600 py-0 px-2 h-5 bg-blue-50/30">
                                                            {String(item)}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-[12px] font-black text-slate-800 tabular-nums lowercase">{String(v)}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Main Table View Area */}
                    <div className="flex-1 overflow-auto p-4 bg-slate-100/30 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
                        <div className="mx-auto w-full border rounded-xl bg-white shadow-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900 sticky top-0 z-30">
                                    <TableRow className="hover:bg-slate-900 border-0">
                                        {selectedCampaign?.leads?.[0] && Object.keys(selectedCampaign.leads[0])
                                            .filter(k => !['campaign_name','Input_queries','scrape_date','unique_id'].includes(k))
                                            .map(k => (
                                                <TableHead key={k} className="h-10 px-4 font-black text-white/40 text-[9px] uppercase tracking-widest border-0 min-w-[200px]">{k.replace(/_/g,' ')}</TableHead>
                                            ))
                                        }
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedCampaign?.leads?.map((l: any, i: number) => (
                                        <TableRow key={i} className="hover:bg-blue-50/20 border-slate-50 h-8 group">
                                            {Object.entries(l)
                                                .filter(([k]) => !['campaign_name','Input_queries','scrape_date','unique_id'].includes(k))
                                                .map(([k, v], vi) => (
                                                    <TableCell key={vi} className="py-2 px-4 text-slate-700 text-[11px] font-bold max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-blue-900">
                                                        {typeof v === 'boolean' ? (
                                                            v ? <Badge className="bg-emerald-50 text-emerald-600 py-0 text-[10px] font-black">YES</Badge> : <Badge variant="outline" className="py-0 text-[10px] font-black opacity-30 text-slate-400">NO</Badge>
                                                        ) : String(v || '-')}
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
