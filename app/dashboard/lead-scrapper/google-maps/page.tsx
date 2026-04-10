"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Send, CheckCircle2, Globe, Settings, Users, Image as ImageIcon, MessageSquare, Search, Filter, X, Info, Table as TableIcon, Download, Eye, Calendar, Tag, RefreshCw } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Country, State } from 'country-state-city';
import { supabase } from "@/lib/supabase";
import * as XLSX from 'xlsx';

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
import { Progress } from "@/components/ui/progress";

export default function GoogleMapsScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [formData, setFormData] = useState({
        countryCode: "US",
        language: "en",
        state: "",
        maxCrawledPlacesPerSearch: 10,
        maxImages: 0,
        maximumLeadsEnrichmentRecords: 0,
        reviewsSort: "newest",
        includeWebResults: false,
        scrapeContacts: true,
        scrapeDirectories: false,
        scrapeImageAuthors: false,
        scrapePlaceDetailPage: true,
        scrapeReviewsPersonalData: false,
        scrapeTableReservationProvider: false,
        skipClosedPlaces: true,
        campaign_name: ""
    });
    const router = useRouter();

    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [searchQueries, setSearchQueries] = useState<string[]>([]);
    
    // Departments
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

    // Categories
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // History and Modal
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [campaignLeads, setCampaignLeads] = useState<any[]>([]);
    const [fetchingLeads, setFetchingLeads] = useState(false);

    // Countries & States
    const countries = Country.getAllCountries();
    const [statesList, setStatesList] = useState<any[]>([]);

    const DEPARTMENTS = [
        "C-Suite", "Product", "Engineering & Technical", "Design", "Education", 
        "Finance", "Human Resources", "Information Technology", "Legal", 
        "Marketing", "Medical & Health", "Operations", "Sales", "Consulting"
    ];

    const CATEGORIES = [
        "steel distributor",
        "steel fabricator",
        "metal workshop",
        "industrial spares and products wholesaler",
        "construction company",
        "transportation service",
        "metal supplier",
        "interior construction contractor",
        "metal fabricator"
    ];

    const LANGUAGES = [
        { code: "en", name: "English" }, { code: "es", name: "Spanish" }, 
        { code: "fr", name: "French" }, { code: "de", name: "German" },
        { code: "it", name: "Italian" }, { code: "pt", name: "Portuguese" },
        { code: "ru", name: "Russian" }, { code: "zh", name: "Chinese" },
        { code: "ja", name: "Japanese" }, { code: "ar", name: "Arabic" }
    ];

    useEffect(() => {
        fetchCampaigns();
        
        // Subscribe to real-time updates
        const channel = supabase
            .channel('leads_scraper_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads_scraper_gmap' }, () => {
                fetchCampaigns();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCampaigns = async () => {
        console.log("Fetching campaigns from leads_scraper_gmap...");
        
        try {
            const { data, error } = await supabase
                .from('leads_scraper_gmap')
                .select('*');
            
            if (error) {
                console.error("Supabase fetch failed:", error);
                return;
            }

            if (!data || data.length === 0) {
                console.log("No rows found in 'leads_scraper_gmap'.");
                setCampaigns([]);
                return;
            }

            console.log(`FETCH SUCCESS: Found ${data.length} raw rows.`);
            
            // Group leads by campaign_name to create unique cards
            const grouped = data.reduce((acc: any[], current: any) => {
                const name = current.campaign_name || current.campaignName || current.campaign || 'Unnamed';
                const existingIndex = acc.findIndex(item => 
                    (item.campaign_name || item.campaignName || item.campaign) === name
                );
                
                if (existingIndex !== -1) {
                    acc[existingIndex].leads = acc[existingIndex].leads || [];
                    acc[existingIndex].leads.push(current);
                } else {
                    acc.push({ ...current, leads: [current] });
                }
                return acc;
            }, []);

            console.log(`Grouped into ${grouped.length} unique campaigns. Updating UI...`);
            setCampaigns(grouped);

            // Clean up transient active jobs
            setActiveJobs(prev => prev.filter(job => 
                !grouped.some(c => (c.campaign_name || c.campaignName || c.campaign) === job.campaign_name)
            ));
        } catch (e) {
            console.error("Unexpected fetch crash:", e);
        }
    };

    const fetchLeadsForCampaign = async (campaign: any) => {
        setSelectedCampaign(campaign);
        setCampaignLeads(campaign.leads || [campaign]);
        setIsModalOpen(true);
    };

    const downloadExcel = (data: any[], fileName: string) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const [activeJobs, setActiveJobs] = useState<any[]>([]);

    useEffect(() => {
        if (formData.countryCode) {
            setStatesList(State.getStatesOfCountry(formData.countryCode));
        }
    }, [formData.countryCode]);

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const isoCode = e.target.value;
        setFormData(prev => ({ ...prev, countryCode: isoCode, state: "" }));
        setStatesList(State.getStatesOfCountry(isoCode));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [id]: checked }));
        } else {
            setFormData(prev => ({
                ...prev,
                [id]: type === 'number' ? (value === '' ? '' : parseInt(value)) : value
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        const payload = {
            ...formData,
            searchStringsArray: searchQueries.join(", "),
            leadsEnrichmentDepartments: selectedDepartments.join(", "),
            categoryFilterWords: selectedCategories.join(", "),
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch("/api/webhook/google-maps", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Failed to trigger webhook");

            const data = await response.json();
            setResult({
                status: "success",
                message: "Google Maps scraper job submitted successfully",
                parameters: payload,
                response: data,
                timestamp: new Date().toISOString()
            });
            setSubmitted(true);
            
            // Add to local active jobs temporarily
            const newJob = { ...payload, id: 'temp-' + Date.now(), status: 'running' };
            setActiveJobs(prev => [newJob, ...prev]);

            // Auto-clear success message after 5 seconds
            setTimeout(() => setSubmitted(false), 5000);

        } catch (error) {
            console.error("Webhook error:", error);
            setResult({
                status: "error",
                message: "Failed to initialize scraper workflow. Please try again.",
                error: error instanceof Error ? error.message : String(error)
            });
            setSubmitted(true);
        } finally {
            setLoading(false);
            fetchCampaigns();
        }
    };

    return (
        <div className="relative space-y-6 pb-10 max-w-5xl mx-auto px-4">
            {/* Active Jobs Sidebar/Toast Area */}
            <div className="fixed top-24 right-6 w-80 z-[100] space-y-3 pointer-events-none">
                {submitted && result?.status === 'success' && (
                    <div className="pointer-events-auto bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-full duration-500">
                        <CheckCircle2 className="h-6 w-6" />
                        <div>
                            <p className="font-bold text-sm">Scrapper Started!</p>
                            <p className="text-[10px] opacity-90">Workflow deployed to n8n successfully.</p>
                        </div>
                    </div>
                )}
                
                {activeJobs.map(job => (
                    <div key={job.id} className="pointer-events-auto bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-xl flex flex-col gap-2 animate-in slide-in-from-right-full">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">Active Extraction</span>
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                        </div>
                        <p className="font-bold text-slate-800 text-xs truncate">{job.campaign_name || 'Unnamed Job'}</p>
                        <Progress value={45} className="h-1 bg-blue-50" />
                    </div>
                ))}
            </div>
            <Button 
                variant="ghost" 
                className="mb-2 hover:bg-slate-100" 
                onClick={() => router.push('/dashboard/lead-scrapper')}
            >
                ← Back to Selection
            </Button>

            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                    <MapPin className="h-8 w-8 text-red-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Google Maps Scrapper</h1>
                    <p className="text-slate-500">Advanced extraction for local business leads and SEO data.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Search Settings */}
                    <Card className="md:col-span-2 border-2 border-red-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-red-50/50 border-b border-red-100 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Search className="h-4 w-4 text-red-600" /> Primary Search Parameters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="campaign_name" className="font-bold text-slate-700 flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-red-600" /> Campaign Name
                                </Label>
                                <Input 
                                    id="campaign_name" 
                                    value={formData.campaign_name} 
                                    onChange={handleChange} 
                                    placeholder="e.g. NYC Italian Restaurants Q2" 
                                    className="border-red-100 focus:border-red-400 focus:ring-red-400" 
                                    required 
                                />
                            </div>
                            <div className="space-y-4 col-span-2 border-t border-red-50 pt-4">
                                <Label className="font-bold text-slate-700">Search Queries</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {searchQueries.map((query, index) => (
                                        <div key={index} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-sm">
                                            {query}
                                            <button type="button" onClick={() => setSearchQueries(prev => prev.filter((_, i) => i !== index))} className="text-slate-500 hover:text-red-500">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input 
                                        value={currentSearchQuery} 
                                        onChange={(e) => setCurrentSearchQuery(e.target.value)} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (currentSearchQuery.trim()) {
                                                    setSearchQueries(prev => [...prev, currentSearchQuery.trim()]);
                                                    setCurrentSearchQuery("");
                                                }
                                            }
                                        }}
                                        placeholder="e.g. Italian Restaurants in NY" 
                                        className="border-red-100 focus:border-red-400 focus:ring-red-400" 
                                        required={searchQueries.length === 0}
                                    />
                                    <Button type="button" variant="outline" onClick={() => {
                                        if (currentSearchQuery.trim()) {
                                            setSearchQueries(prev => [...prev, currentSearchQuery.trim()]);
                                            setCurrentSearchQuery("");
                                        }
                                    }}>Add</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="categoryFilterWords" className="font-bold text-slate-700">Place categories ($)</Label>
                                    <div className="h-40 overflow-y-auto w-full rounded-md border border-red-100 bg-white p-2 flex flex-col gap-1">
                                        {CATEGORIES.map(cat => (
                                            <label key={cat} className="flex items-center gap-2 p-1.5 hover:bg-red-50 cursor-pointer rounded transition-colors text-sm">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedCategories.includes(cat)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedCategories(prev => [...prev, cat]);
                                                        else setSelectedCategories(prev => prev.filter(c => c !== cat));
                                                    }}
                                                    className="rounded border-red-300 text-red-600 focus:ring-red-600 w-4 h-4"
                                                />
                                                <span className="capitalize font-medium text-slate-700">{cat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="countryCode" className="font-bold text-slate-700">Country</Label>
                                    <select 
                                        id="countryCode"
                                        value={formData.countryCode}
                                        onChange={handleCountryChange}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-red-100 focus:border-red-400 focus:ring-red-400"
                                    >
                                        <option value="">Select Country</option>
                                        {countries.map(c => (
                                            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state" className="font-bold text-slate-700">State / Region</Label>
                                    <select 
                                        id="state"
                                        value={formData.state}
                                        onChange={(e) => {
                                            const stateName = e.target.value;
                                            setFormData(prev => ({...prev, state: stateName}));
                                        }}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-red-100 focus:border-red-400 focus:ring-red-400"
                                    >
                                        <option value="">Select State/Region</option>
                                        {statesList.map(s => (
                                            <option key={s.isoCode} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="language" className="font-bold text-slate-700">Language</Label>
                                    <select 
                                        id="language"
                                        value={formData.language}
                                        onChange={handleChange}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-red-100 focus:border-red-400 focus:ring-red-400"
                                    >
                                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                    </select>
                                </div>
                                
                            </div>
                        </CardContent>
                    </Card>

                    {/* Limits */}
                    <Card className="border-2 border-slate-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Filter className="h-4 w-4 text-slate-600" /> Limits & Enrichment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="maxCrawledPlacesPerSearch" className="font-bold text-slate-700 text-xs uppercase">Max Places per Search Item</Label>
                                <Input id="maxCrawledPlacesPerSearch" type="number" min={1} value={formData.maxCrawledPlacesPerSearch} onChange={handleChange} className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>

                            <div className="space-y-2 relative">
                                <div className="flex justify-between items-center mb-2">
                                    <Label htmlFor="maximumLeadsEnrichmentRecords" className="font-bold text-slate-700 text-xs uppercase flex items-center gap-1">
                                        Max Leads per Place
                                        <div className="group relative flex items-center">
                                            <Info className="h-4 w-4 text-slate-400 cursor-pointer hover:text-red-500 transition-colors" />
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block w-80 p-4 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-2xl font-normal leading-relaxed border border-slate-700 z-[9999]">
                                                <div className="space-y-2">
                                                    <p className="font-bold text-red-400">Lead Enrichment Info</p>
                                                    <p>Enrich your results with detailed contact and company information, including employee names, titles, emails, and LinkedIn profiles.</p>
                                                    <p className="text-yellow-400/90 font-medium border-l-2 border-yellow-400 pl-2">⚠️ GDPR Warning: Personal data is protected globally. Ensure you have a legitimate reason before scraping.</p>
                                                    <p className="bg-white/10 p-2 rounded text-[10px]">Excludes chains: McDonalds, Starbucks, Dominos, PizzaHut.</p>
                                                    <p className="text-red-300 font-bold border-t border-white/10 pt-2 flex items-center gap-1">
                                                        <span className="text-lg">💰</span> Cost warning: Multiplier applied per place.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Label>
                                </div>
                                <Input id="maximumLeadsEnrichmentRecords" type="number" min={0} value={formData.maximumLeadsEnrichmentRecords} onChange={handleChange} className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>
                           
                            <div className="space-y-2">
                                <Label htmlFor="leadsEnrichmentDepartments" className="font-bold text-slate-700 text-xs uppercase mb-2 block">Enrichment Depts.</Label>
                                <div className="h-48 overflow-y-auto w-full rounded-md border border-slate-200 bg-white p-2 flex flex-col gap-1">
                                    {DEPARTMENTS.map(dept => (
                                        <label key={dept} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedDepartments.includes(dept)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedDepartments(prev => [...prev, dept]);
                                                    else setSelectedDepartments(prev => prev.filter(d => d !== dept));
                                                }}
                                                className="rounded border-slate-300 text-red-600 focus:ring-red-600 w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{dept}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-14 text-xl font-black shadow-xl shadow-red-200 transition-all active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            DEPLOYING SCRAPER WORKFLOW...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-6 w-6" />
                            LAUNCH GOOGLE MAPS EXTRACTION
                        </>
                    )}
                </Button>
            </form>

            {/* Campaign History */}
            <div className="mt-16 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                            <TableIcon className="h-6 w-6 text-red-600" /> Recent Extractions
                        </h2>
                        <p className="text-slate-500 text-sm">Monitor and access your background scraper jobs.</p>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={fetchCampaigns} 
                        size="sm"
                        className="rounded-xl border-slate-200 hover:bg-slate-50 hover:text-red-600 transition-all"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
                    </Button>
                </div>

                {campaigns.length === 0 ? (
                    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-12 text-center rounded-3xl">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                            <Search className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No campaigns found</h3>
                        <p className="text-slate-500 max-w-[280px] text-sm mb-4">Submit your first Google Maps extraction to see it appear here.</p>
                        <Button variant="outline" size="sm" onClick={fetchCampaigns} className="rounded-xl border-slate-200">
                            Try Refreshing
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {campaigns.map((campaign) => (
                            <Card 
                                key={campaign.id} 
                                className="group border-2 border-slate-100 hover:border-red-100 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 rounded-3xl overflow-hidden cursor-pointer flex flex-col"
                                onClick={() => (campaign.status === 'completed' || !campaign.status) && fetchLeadsForCampaign(campaign)}
                            >
                                <div className="p-5 flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400 border-slate-200 px-2 py-0">
                                                {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'Today'}
                                            </Badge>
                                            <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-red-600 transition-colors">
                                                {campaign.campaign_name || 'Unnamed Extraction'}
                                            </h3>
                                        </div>
                                        <div className={`p-2 rounded-xl ${campaign.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600 animate-pulse'}`}>
                                            {campaign.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 font-medium">Extraction Progress</span>
                                                <span className={campaign.status === 'completed' ? 'text-emerald-600 font-bold' : 'text-blue-600 font-bold'}>
                                                    {campaign.status === 'completed' ? '100%' : '65%'}
                                                </span>
                                            </div>
                                            <Progress 
                                                value={campaign.status === 'completed' ? 100 : 65} 
                                                className={`h-2 rounded-full ${campaign.status === 'completed' ? 'bg-emerald-100' : 'bg-blue-100'}`}
                                            />
                                        </div>

                                        <div className="bg-slate-50 p-3 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Search className="h-3 w-3" />
                                                <span className="font-medium truncate">{campaign.searchStringsArray || 'Default Search'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Globe className="h-3 w-3" />
                                                <span className="font-medium uppercase tracking-wider">{campaign.countryCode || 'US'} - {campaign.language || 'EN'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-xs font-bold text-slate-600 hover:text-red-600 p-0 h-auto"
                                        disabled={campaign.status !== 'completed' && campaign.status !== undefined}
                                    >
                                        <Eye className="h-3 w-3 mr-1" /> View Leads
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadExcel([campaign], campaign.campaign_name || 'leads');
                                        }}
                                        className="text-xs font-bold text-slate-600 hover:text-emerald-600 p-0 h-auto"
                                        disabled={campaign.status !== 'completed' && campaign.status !== undefined}
                                    >
                                        <Download className="h-3 w-3 mr-1" /> XLSX
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Leads Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[100vw] h-[100vh] m-0 rounded-none border-0 shadow-none p-0 overflow-hidden flex flex-col bg-slate-50">
                    <div className="bg-white border-b border-slate-200 p-6 flex items-center justify-between shadow-sm z-50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-50 rounded-2xl">
                                <MapPin className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight">
                                    {selectedCampaign?.campaign_name || 'Extraction Results'}
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" /> Produced on {selectedCampaign?.created_at ? new Date(selectedCampaign.created_at).toLocaleString() : 'Recently'}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                className="h-12 px-6 rounded-2xl border-slate-200 font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                                onClick={() => downloadExcel(campaignLeads, selectedCampaign?.campaign_name || 'leads')}
                            >
                                <Download className="h-5 w-5 mr-2" /> Download Excel (XLSX)
                            </Button>
                            <Button 
                                variant="ghost" 
                                className="h-12 w-12 rounded-2xl bg-slate-100 hover:bg-red-50 hover:text-red-600 transition-all ml-2" 
                                onClick={() => setIsModalOpen(false)}
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-10">
                        <div className="max-w-6xl mx-auto">
                            <div className="bg-white border-2 border-slate-100 rounded-[40px] shadow-2xl shadow-slate-200/50 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 border-slate-100">
                                            <TableHead className="py-6 px-8 font-black text-slate-900 text-sm uppercase tracking-widest border-r border-slate-100">Attribute</TableHead>
                                            <TableHead className="py-6 px-8 font-black text-slate-900 text-sm uppercase tracking-widest">Extracted Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                <TableBody>
                                    {Array.isArray(campaignLeads) && campaignLeads.map((lead: any, leadIdx: number) => (
                                        <React.Fragment key={leadIdx}>
                                            {lead && (
                                                <>
                                                    <TableRow className="bg-slate-100/50">
                                                        <TableCell colSpan={2} className="py-2 px-8 font-black text-[10px] text-slate-400 uppercase tracking-widest">
                                                            Lead Instance #{leadIdx + 1}
                                                        </TableCell>
                                                    </TableRow>
                                                    {Object.entries(lead).map(([key, value]) => (
                                                        <TableRow key={key} className="border-slate-100 hover:bg-white transition-colors">
                                                            <TableCell className="py-3 px-8 font-bold text-slate-500 text-xs uppercase tracking-wider border-r border-slate-100 w-1/3 group-hover:text-red-500 transition-colors">
                                                                {key.replace(/_/g, ' ')}
                                                            </TableCell>
                                                            <TableCell className="py-3 px-8 text-slate-700 font-medium text-sm">
                                                                {typeof value === 'object' ? (
                                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                                        <pre className="text-[11px] text-slate-500 font-mono leading-relaxed">
                                                                            {JSON.stringify(value, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                ) : (
                                                                    <span className="break-all">{String(value)}</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                                </Table>
                            </div>
                            <div className="mt-8 text-center text-slate-400 text-xs font-medium">
                                End of data for campaign: {selectedCampaign?.id}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
