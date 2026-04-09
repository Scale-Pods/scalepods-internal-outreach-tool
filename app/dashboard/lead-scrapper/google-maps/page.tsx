"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Send, CheckCircle2, Globe, Settings, Users, Image as ImageIcon, MessageSquare, Search, Filter } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoogleMapsScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [formData, setFormData] = useState({
        searchStringsArray: "",
        categoryFilterWords: "",
        countryCode: "US",
        language: "en",
        state: "",
        maxCrawledPlacesPerSearch: 10,
        maxImages: 0,
        maximumLeadsEnrichmentRecords: 10,
        reviewsSort: "newest",
        includeWebResults: false,
        scrapeContacts: true,
        scrapeDirectories: false,
        scrapeImageAuthors: false,
        scrapePlaceDetailPage: true,
        scrapeReviewsPersonalData: false,
        scrapeTableReservationProvider: false,
        skipClosedPlaces: true,
        leadsEnrichmentDepartments: ""
    });
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [id]: checked }));
        } else {
            setFormData(prev => ({
                ...prev,
                [id]: type === 'number' ? parseInt(value) || 0 : value
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        // Mocking the n8n webhook trigger
        setTimeout(() => {
            setLoading(false);
            setSubmitted(true);
            setResult({
                status: "success",
                message: "Google Maps scraper job submitted",
                parameters: formData,
                jobId: "gmaps_" + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString()
            });
        }, 2000);
    };

    return (
        <div className="space-y-6 pb-10 max-w-5xl mx-auto">
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
                                <Label htmlFor="searchStringsArray" className="font-bold text-slate-700">Search Queries (Comma separated)</Label>
                                <Input id="searchStringsArray" value={formData.searchStringsArray} onChange={handleChange} placeholder="e.g. Italian Restaurants in NY, Gyms in Miami" className="border-red-100 focus:border-red-400 focus:ring-red-400" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="categoryFilterWords" className="font-bold text-slate-700">Category Filter</Label>
                                    <Input id="categoryFilterWords" value={formData.categoryFilterWords} onChange={handleChange} placeholder="e.g. Restaurant, Cafe" className="border-red-100 focus:border-red-400 focus:ring-red-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state" className="font-bold text-slate-700">State / Region</Label>
                                    <Input id="state" value={formData.state} onChange={handleChange} placeholder="e.g. Florida" className="border-red-100 focus:border-red-400 focus:ring-red-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="countryCode" className="font-bold text-slate-700">Country Code</Label>
                                    <Input id="countryCode" value={formData.countryCode} onChange={handleChange} placeholder="US" className="border-red-100 focus:border-red-400 focus:ring-red-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="language" className="font-bold text-slate-700">Language</Label>
                                    <Input id="language" value={formData.language} onChange={handleChange} placeholder="en" className="border-red-100 focus:border-red-400 focus:ring-red-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reviewsSort" className="font-bold text-slate-700">Reviews Sort</Label>
                                    <select id="reviewsSort" value={formData.reviewsSort} onChange={handleChange as any} className="w-full rounded-md border border-red-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400">
                                        <option value="newest">Newest</option>
                                        <option value="most_relevant">Most Relevant</option>
                                        <option value="highest_rating">Highest Rating</option>
                                        <option value="lowest_rating">Lowest Rating</option>
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
                                <Label htmlFor="maxCrawledPlacesPerSearch" className="font-bold text-slate-700 text-xs uppercase">Max Places per Search</Label>
                                <Input id="maxCrawledPlacesPerSearch" type="number" value={formData.maxCrawledPlacesPerSearch} onChange={handleChange} className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maximumLeadsEnrichmentRecords" className="font-bold text-slate-700 text-xs uppercase">Max Enrichment Records</Label>
                                <Input id="maximumLeadsEnrichmentRecords" type="number" value={formData.maximumLeadsEnrichmentRecords} onChange={handleChange} className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxImages" className="font-bold text-slate-700 text-xs uppercase">Max Images</Label>
                                <Input id="maxImages" type="number" value={formData.maxImages} onChange={handleChange} className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="leadsEnrichmentDepartments" className="font-bold text-slate-700 text-xs uppercase">Enrichment Depts.</Label>
                                <Input id="leadsEnrichmentDepartments" value={formData.leadsEnrichmentDepartments} onChange={handleChange} placeholder="e.g. Sales, HR" className="border-slate-200 focus:border-red-400 focus:ring-red-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Automation Toggles */}
                <Card className="border-2 border-blue-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 py-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Settings className="h-4 w-4 text-blue-600" /> Advanced Scraping Features
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapeContacts" checked={formData.scrapeContacts} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapeContacts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Scrape Contacts</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapePlaceDetailPage" checked={formData.scrapePlaceDetailPage} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapePlaceDetailPage" className="text-sm font-medium leading-none">Detail Page</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="skipClosedPlaces" checked={formData.skipClosedPlaces} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="skipClosedPlaces" className="text-sm font-medium leading-none">Skip Closed</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="includeWebResults" checked={formData.includeWebResults} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="includeWebResults" className="text-sm font-medium leading-none">Web Results</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapeDirectories" checked={formData.scrapeDirectories} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapeDirectories" className="text-sm font-medium leading-none">Directories</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapeImageAuthors" checked={formData.scrapeImageAuthors} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapeImageAuthors" className="text-sm font-medium leading-none">Image Authors</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapeReviewsPersonalData" checked={formData.scrapeReviewsPersonalData} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapeReviewsPersonalData" className="text-sm font-medium leading-none">Reviewer Data</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" id="scrapeTableReservationProvider" checked={formData.scrapeTableReservationProvider} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <Label htmlFor="scrapeTableReservationProvider" className="text-sm font-medium leading-none">Reservations</Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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

            {submitted && (
                <Card className="border-2 border-emerald-100 bg-emerald-50/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-2 bg-emerald-100 rounded-full">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold text-emerald-900">Extraction Initialized</CardTitle>
                            <CardDescription className="text-emerald-700">The Google Maps payload has been sent to n8n.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-white rounded-xl border border-emerald-100 p-6 overflow-x-auto">
                            <pre className="text-sm font-mono text-emerald-800 whitespace-pre-wrap">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
