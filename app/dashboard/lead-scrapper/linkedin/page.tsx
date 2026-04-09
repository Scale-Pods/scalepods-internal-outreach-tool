"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Linkedin, Loader2, Send, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkedInScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        // Mocking the n8n webhook trigger
        setTimeout(() => {
            setLoading(false);
            setSubmitted(true);
            setResult({
                status: "success",
                message: "Scrapping job started on n8n",
                jobId: "linkedin_" + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString()
            });
        }, 2000);
    };

    return (
        <div className="space-y-6 pb-10 max-w-4xl mx-auto">
            <Button 
                variant="ghost" 
                className="mb-2 hover:bg-slate-100" 
                onClick={() => router.push('/dashboard/lead-scrapper')}
            >
                ← Back to Selection
            </Button>

            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                    <Linkedin className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">LinkedIn Scrapper</h1>
                    <p className="text-slate-500">Extract high-quality leads from LinkedIn searches and profiles.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-1">
                <Card className="border-2 border-blue-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                        <CardTitle className="text-xl font-bold">Scraper Configuration</CardTitle>
                        <CardDescription>Enter the parameters for your LinkedIn scraping job.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="searchQuery" className="font-bold text-slate-700">Search Query / Keyword</Label>
                                    <Input id="searchQuery" placeholder="e.g. CEO of SaaS companies in Dubai" className="border-blue-100 focus:border-blue-400 focus:ring-blue-400" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="limit" className="font-bold text-slate-700">Max Results</Label>
                                    <Input id="limit" type="number" placeholder="e.g. 50" className="border-blue-100 focus:border-blue-400 focus:ring-blue-400" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profileLink" className="font-bold text-slate-700">Profile URL (Optional)</Label>
                                <Input id="profileLink" placeholder="https://linkedin.com/in/username" className="border-blue-100 focus:border-blue-400 focus:ring-blue-400" />
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-bold shadow-lg shadow-blue-200"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Processing Workflow...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-5 w-5" />
                                        Start Extraction
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {submitted && (
                    <Card className="border-2 border-emerald-100 bg-emerald-50/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="p-2 bg-emerald-100 rounded-full">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold text-emerald-900">Request Sent Successfully</CardTitle>
                                <CardDescription className="text-emerald-700">The n8n workflow has been triggered.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-white rounded-xl border border-emerald-100 p-6">
                                <pre className="text-sm font-mono text-emerald-800 whitespace-pre-wrap">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
