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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const [activeJobs, setActiveJobs] = useState<any[]>([]);

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
        console.log("Fetching campaigns from API...");
        
        try {
            const response = await fetch('/api/google-maps/leads');
            if (!response.ok) throw new Error("Failed to fetch leads from API");
            
            const result = await response.json();
            const data = result.data;

            if (!data || data.length === 0) {
                console.log("No rows found.");
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
                !grouped.some((c: any) => (c.campaign_name || c.campaignName || c.campaign) === job.campaign_name)
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
                    <div className="pointer-events-auto bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-right-full duration-500 relative group">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-6 w-6" />
                            <div>
                                <p className="font-bold text-sm">Scrapper Started!</p>
                                <p className="text-[10px] opacity-90">Workflow deployed to n8n successfully.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSubmitted(false)}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
                
                {activeJobs.map(job => (
                    <div key={job.id} className="pointer-events-auto bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-xl flex flex-col gap-2 animate-in slide-in-from-right-full relative">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">Active Extraction</span>
                                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                            </div>
                            <button 
                                onClick={() => setActiveJobs(prev => prev.filter(j => j.id !== job.id))}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <p className="font-bold text-slate-800 text-xs truncate pr-4">{job.campaign_name || 'Unnamed Job'}</p>
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

            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                    <MapPin className="h-6 w-6 text-red-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 leading-none">Google Maps Scrapper</h1>
                    <p className="text-slate-500 text-xs">Advanced extraction for local business leads.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                    {/* Search Settings */}
                    <Card className="md:col-span-3 border-2 border-red-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-red-50/50 border-b border-red-100 py-2 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Search className="h-4 w-4 text-red-600" /> Search Parameters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="campaign_name" className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <Tag className="h-3 w-3 text-red-600" /> Campaign Name
                                    </Label>
                                    <Input 
                                        id="campaign_name" 
                                        value={formData.campaign_name} 
                                        onChange={handleChange} 
                                        placeholder="e.g. NYC Restaurants" 
                                        className="h-9 border-red-100 focus:border-red-400 focus:ring-red-400 text-sm" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-700">Search Queries</Label>
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
                                            placeholder="Add query..." 
                                            className="h-9 border-red-100 focus:border-red-400 focus:ring-red-400 text-sm" 
                                            required={searchQueries.length === 0}
                                        />
                                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => {
                                            if (currentSearchQuery.trim()) {
                                                setSearchQueries(prev => [...prev, currentSearchQuery.trim()]);
                                                setCurrentSearchQuery("");
                                            }
                                        }}>Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {searchQueries.map((query, index) => (
                                            <Badge key={index} variant="secondary" className="text-[10px] font-medium bg-slate-100 px-2 py-0">
                                                {query}
                                                <button type="button" onClick={() => setSearchQueries(prev => prev.filter((_, i) => i !== index))} className="ml-1 text-slate-500 hover:text-red-500">
                                                    <X className="h-2 w-2" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-red-50">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-slate-500">Country</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full h-8 justify-between text-[10px] px-2 border-slate-200"
                                            >
                                                <span className="truncate">
                                                    {formData.countryCode 
                                                        ? countries.find(c => c.isoCode === formData.countryCode)?.name 
                                                        : "Country"}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <Input 
                                                    placeholder="Search country..." 
                                                    className="h-7 text-[10px]"
                                                    onChange={(e) => {
                                                        const val = e.target.value.toLowerCase();
                                                        const items = document.querySelectorAll('.country-item');
                                                        items.forEach((item: any) => {
                                                            if (item.textContent.toLowerCase().includes(val)) item.style.display = 'flex';
                                                            else item.style.display = 'none';
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1">
                                                {countries.map((c) => (
                                                    <div
                                                        key={c.isoCode}
                                                        className={cn(
                                                            "country-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-red-50 transition-colors",
                                                            formData.countryCode === c.isoCode && "bg-red-50 text-red-700 font-bold"
                                                        )}
                                                        onClick={() => {
                                                            handleCountryChange({ target: { value: c.isoCode } } as any);
                                                        }}
                                                    >
                                                        {c.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-slate-500">State</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full h-8 justify-between text-[10px] px-2 border-slate-200"
                                                disabled={!formData.countryCode}
                                            >
                                                <span className="truncate">
                                                    {formData.state || "State/Region"}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <Input 
                                                    placeholder="Search state..." 
                                                    className="h-7 text-[10px]"
                                                    onChange={(e) => {
                                                        const val = e.target.value.toLowerCase();
                                                        const items = document.querySelectorAll('.state-item');
                                                        items.forEach((item: any) => {
                                                            if (item.textContent.toLowerCase().includes(val)) item.style.display = 'flex';
                                                            else item.style.display = 'none';
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1">
                                                {statesList.length === 0 && (
                                                    <div className="p-2 text-[10px] text-slate-400 text-center">No states found</div>
                                                )}
                                                {statesList.map((s) => (
                                                    <div
                                                        key={s.isoCode}
                                                        className={cn(
                                                            "state-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-red-50 transition-colors",
                                                            formData.state === s.name && "bg-red-50 text-red-700 font-bold"
                                                        )}
                                                        onClick={() => {
                                                            setFormData(prev => ({...prev, state: s.name}));
                                                        }}
                                                    >
                                                        {s.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-slate-500">Language</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full h-8 justify-between text-[10px] px-2 border-slate-200"
                                            >
                                                <span className="truncate">
                                                    {LANGUAGES.find(l => l.code === formData.language)?.name || "Language"}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-0" align="start">
                                            <div className="max-h-60 overflow-y-auto p-1">
                                                {LANGUAGES.map((l) => (
                                                    <div
                                                        key={l.code}
                                                        className={cn(
                                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-red-50 transition-colors",
                                                            formData.language === l.code && "bg-red-50 text-red-700 font-bold"
                                                        )}
                                                        onClick={() => {
                                                            setFormData(prev => ({...prev, language: l.code}));
                                                        }}
                                                    >
                                                        {l.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-red-50">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-slate-500">Place Categories</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full h-8 justify-between text-[10px] px-2 border-slate-200"
                                                >
                                                    <span className="truncate">
                                                        {selectedCategories.length > 0 
                                                            ? `${selectedCategories.length} Selected` 
                                                            : "Select Categories"}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-48 p-0" align="start">
                                                <div className="max-h-60 overflow-y-auto p-1">
                                                    {CATEGORIES.map((cat) => (
                                                        <div
                                                            key={cat}
                                                            className={cn(
                                                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-slate-100 transition-colors",
                                                                selectedCategories.includes(cat) && "bg-red-50 text-red-700 font-bold"
                                                            )}
                                                            onClick={() => {
                                                                if (selectedCategories.includes(cat)) {
                                                                    setSelectedCategories(prev => prev.filter(c => c !== cat));
                                                                } else {
                                                                    setSelectedCategories(prev => [...prev, cat]);
                                                                }
                                                            }}
                                                        >
                                                            <div className={cn(
                                                                "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-red-400",
                                                                selectedCategories.includes(cat) ? "bg-red-600 border-red-600" : "opacity-50"
                                                            )}>
                                                                {selectedCategories.includes(cat) && <Check className="h-2.5 w-2.5 text-white" />}
                                                            </div>
                                                            {cat}
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                                            {selectedCategories.map(cat => (
                                                <Badge key={cat} variant="secondary" className="bg-red-50 text-red-700 text-[9px] px-1 py-0 border-red-100 capitalize">
                                                    {cat}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-slate-500">Enrichment Departments</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full h-8 justify-between text-[10px] px-2 border-slate-200"
                                                >
                                                    <span className="truncate">
                                                        {selectedDepartments.length > 0 
                                                            ? `${selectedDepartments.length} Selected` 
                                                            : "Select Depts"}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-48 p-0" align="start">
                                                <div className="max-h-60 overflow-y-auto p-1">
                                                    {DEPARTMENTS.map((dept) => (
                                                        <div
                                                            key={dept}
                                                            className={cn(
                                                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[10px] outline-none hover:bg-slate-100 transition-colors",
                                                                selectedDepartments.includes(dept) && "bg-blue-50 text-blue-700 font-bold"
                                                            )}
                                                            onClick={() => {
                                                                if (selectedDepartments.includes(dept)) {
                                                                    setSelectedDepartments(prev => prev.filter(d => d !== dept));
                                                                } else {
                                                                    setSelectedDepartments(prev => [...prev, dept]);
                                                                }
                                                            }}
                                                        >
                                                            <div className={cn(
                                                                "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-blue-400",
                                                                selectedDepartments.includes(dept) ? "bg-blue-600 border-blue-600" : "opacity-50"
                                                            )}>
                                                                {selectedDepartments.includes(dept) && <Check className="h-2.5 w-2.5 text-white" />}
                                                            </div>
                                                            {dept}
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                                            {selectedDepartments.map(dept => (
                                                <Badge key={dept} variant="secondary" className="bg-blue-50 text-blue-700 text-[9px] px-1 py-0 border-blue-100">
                                                    {dept}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Limits */}
                    <Card className="border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Filter className="h-4 w-4 text-slate-600" /> Limits
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 flex-1">
                            <div className="space-y-1">
                                <Label htmlFor="maxCrawledPlacesPerSearch" className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Max Places / Item</Label>
                                <Input id="maxCrawledPlacesPerSearch" type="number" min={1} value={formData.maxCrawledPlacesPerSearch} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="maximumLeadsEnrichmentRecords" className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Max Leads / Place</Label>
                                <Input id="maximumLeadsEnrichmentRecords" type="number" min={0} value={formData.maximumLeadsEnrichmentRecords} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-10 text-sm font-black shadow-lg shadow-red-200 transition-all active:scale-[0.99]"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-slate-500 font-medium tracking-tight uppercase">Progress</span>
                                                <span className={campaign.status === 'completed' ? 'text-emerald-600 font-bold' : 'text-blue-600 font-bold'}>
                                                    {campaign.status === 'completed' ? '100%' : '65%'}
                                                </span>
                                            </div>
                                            <Progress 
                                                value={campaign.status === 'completed' ? 100 : 65} 
                                                className={`h-1.5 rounded-full ${campaign.status === 'completed' ? 'bg-emerald-100' : 'bg-blue-100'}`}
                                            />
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
                    
                    <div className="flex-1 overflow-auto p-4 sm:p-10">
                        <div className="mx-auto w-full">
                            <div className="bg-white border-2 border-slate-100 rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/50 border-slate-200">
                                                {Array.isArray(campaignLeads) && campaignLeads.length > 0 && 
                                                    Object.keys(campaignLeads[0])
                                                        .filter(key => key !== 'leads') // Filter out the grouped leads array if present
                                                        .map((key) => (
                                                            <TableHead key={key} className="py-4 px-4 font-black text-slate-900 text-[10px] uppercase tracking-widest border-r border-slate-100 whitespace-nowrap">
                                                                {key.replace(/_/g, ' ')}
                                                            </TableHead>
                                                        ))
                                                }
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Array.isArray(campaignLeads) && campaignLeads.map((lead: any, leadIdx: number) => (
                                                <TableRow key={leadIdx} className="border-slate-100 hover:bg-slate-50 transition-colors">
                                                    {Object.entries(lead)
                                                        .filter(([key]) => key !== 'leads')
                                                        .map(([key, value], valIdx) => (
                                                            <TableCell key={valIdx} className="py-3 px-4 text-slate-700 font-medium text-xs border-r border-slate-100 whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">
                                                                {typeof value === 'object' ? (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        {JSON.stringify(value)}
                                                                    </span>
                                                                ) : (
                                                                    <span>{String(value || '-')}</span>
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            <div className="mt-8 text-center text-slate-400 text-xs font-medium">
                                Showing {campaignLeads.length} leads for campaign: {selectedCampaign?.campaign_name}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
