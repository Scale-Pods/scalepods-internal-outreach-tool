"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Loader2, Send, CheckCircle2, Calendar, Shield, User, List, Hash } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function TradeIndiaScrapper() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [formData, setFormData] = useState({
        userid: "",
        profile_id: "",
        key: "",
        from_date: "",
        to_date: "",
        responded_buy_leads: 0,
        limit: 50,
        page_no: 1
    });
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'number' ? parseInt(value) || 0 : value
        }));
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
                message: "Trade India scraper started with parameters",
                parameters: formData,
                jobId: "tradeindia_" + Math.random().toString(36).substr(2, 9),
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
                <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                    <Globe className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Trade India Scrapper</h1>
                    <p className="text-slate-500">Extract supplier and product information using API credentials.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-1">
                <Card className="border-2 border-orange-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-orange-50/50 border-b border-orange-100">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Shield className="h-5 w-5 text-orange-600" />
                            API Authentication & Config
                        </CardTitle>
                        <CardDescription>Configure your Trade India API parameters to fetching buy leads.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="userid" className="font-bold text-slate-700 flex items-center gap-2">
                                        <User className="h-3.5 w-3.5" /> User ID
                                    </Label>
                                    <Input id="userid" value={formData.userid} onChange={handleChange} placeholder="e.g. 2213952" className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile_id" className="font-bold text-slate-700 flex items-center gap-2">
                                        <Hash className="h-3.5 w-3.5" /> Profile ID
                                    </Label>
                                    <Input id="profile_id" value={formData.profile_id} onChange={handleChange} placeholder="e.g. 20709274" className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="key" className="font-bold text-slate-700 flex items-center gap-2">
                                        <Shield className="h-3.5 w-3.5" /> API Key
                                    </Label>
                                    <Input id="key" value={formData.key} onChange={handleChange} placeholder="Enter API Key" className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" required />
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="from_date" className="font-bold text-slate-700 flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5" /> From Date
                                    </Label>
                                    <Input id="from_date" type="date" value={formData.from_date} onChange={handleChange} className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="to_date" className="font-bold text-slate-700 flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5" /> To Date
                                    </Label>
                                    <Input id="to_date" type="date" value={formData.to_date} onChange={handleChange} className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" required />
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="responded_buy_leads" className="font-bold text-slate-700">Responded Leads (0/1)</Label>
                                    <Input id="responded_buy_leads" type="number" min="0" max="1" value={formData.responded_buy_leads} onChange={handleChange} className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="limit" className="font-bold text-slate-700 flex items-center gap-2">
                                        <List className="h-3.5 w-3.5" /> Limit
                                    </Label>
                                    <Input id="limit" type="number" min="1" max="500" value={formData.limit} onChange={handleChange} className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="page_no" className="font-bold text-slate-700">Page No.</Label>
                                    <Input id="page_no" type="number" min="1" value={formData.page_no} onChange={handleChange} className="border-orange-100 focus:border-orange-400 focus:ring-orange-400" />
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg font-bold shadow-lg shadow-orange-200"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Triggering Trade India API...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-5 w-5" />
                                        Run Trade Scrapper
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
                                <CardTitle className="text-xl font-bold text-emerald-900">Workflow Triggered Successfully</CardTitle>
                                <CardDescription className="text-emerald-700">Your Trade India data extraction job is now processing.</CardDescription>
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
        </div>
    );
}
