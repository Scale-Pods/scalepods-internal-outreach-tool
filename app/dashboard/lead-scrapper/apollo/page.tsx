"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
    Linkedin, Loader2, CheckCircle2, X, 
    ArrowLeft, Info, Upload, FileSpreadsheet, AlertCircle, Rocket,
    Search, ExternalLink, Copy
} from "lucide-react";
import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";



export default function ApolloPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submitted, setSubmitted] = useState(false);
    
    // URL Generation States
    const [generating, setGenerating] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerateUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setGenerating(true);
        setGeneratedUrl(null);
        try {
            const response = await fetch("https://n8n.srv1010832.hstgr.cloud/webhook/data-from-frontend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });

            if (response.ok) {
                const data = await response.json();
                let url = "";
                
                if (Array.isArray(data) && data[0]?.message?.content?.searchUrl) {
                    url = data[0].message.content.searchUrl;
                } else if (data.searchUrl) {
                    url = data.searchUrl;
                } else {
                    const text = JSON.stringify(data);
                    const match = text.match(/"searchUrl"\s*:\s*"([^"]+)"/);
                    if (match) url = match[1];
                }

                if (url) {
                    setGeneratedUrl(url);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const handleCopyUrl = async () => {
        if (generatedUrl) {
            await navigator.clipboard.writeText(generatedUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setUploadStatus({ type: null, message: "" });
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadStatus({ type: null, message: "" });
        
        try {
            const formData = new FormData();
            formData.append("source", "ampleleads");
            formData.append("upload_id", crypto.randomUUID());
            formData.append("source_file", selectedFile.name);
            formData.append("file", selectedFile);

            const res = await fetch("https://n8n.srv1010832.hstgr.cloud/webhook/leads/import", {
                method: "POST",
                body: formData,
            });
            
            if (res.ok) {
                setUploadStatus({ type: 'success', message: `Successfully uploaded ${selectedFile.name}. Leads are being processed.` });
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                setSubmitted(true);
                setTimeout(() => setSubmitted(false), 5000);
            } else {
                const text = await res.text();
                setUploadStatus({ type: 'error', message: `Upload failed: ${res.status} ${text || res.statusText}` });
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadStatus({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
        } finally {
            setIsUploading(false);
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
                                Apollo <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">V2</span>
                            </h1>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">Generate URLs & Import Leads</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-500 hover:text-slate-600">
                                    <Info className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-red-800 text-[11px] font-bold p-3 max-w-xs rounded-xl shadow-2xl">
                                <p>Generate LinkedIn search URLs or upload a CSV/Excel file to import leads.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                </div>
            </div>

            {/* URL Generation Section */}
            <div className="max-w-3xl space-y-4">
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden ring-1 ring-slate-100">
                    <CardHeader className="border-b border-slate-50 p-4 bg-slate-50/30">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Generate Search URL</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <form onSubmit={handleGenerateUrl} className="space-y-4 font-bold">
                            <div className="space-y-2 font-bold">
                                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Describe your target audience</Label>
                                <textarea 
                                    placeholder="e.g., CEOs of software companies in New York with 50-200 employees..."
                                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    required
                                />
                            </div>
                            <Button 
                                type="submit"
                                disabled={generating}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-black uppercase tracking-[0.1em] text-sm shadow-lg shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                {generating ? "Generating..." : "Generate Search URL"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {generatedUrl && (
                    <Card className="border-none shadow-sm bg-blue-50/50 rounded-xl overflow-hidden ring-1 ring-blue-100 animate-in fade-in slide-in-from-top-2">
                        <CardHeader className="p-4 border-b border-blue-100/50 bg-blue-100/30">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600">Generated URL</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 font-bold">
                            <div className="p-3 bg-white rounded-lg border border-blue-100 text-xs font-medium text-slate-600 break-all max-h-24 overflow-auto relative group">
                                {generatedUrl}
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="default"
                                    size="sm"
                                    onClick={() => window.open(generatedUrl, '_blank', 'noopener,noreferrer')}
                                    className="h-9 px-4 text-[10px] uppercase font-black shadow-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" /> Open
                                </Button>
                                <Button 
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyUrl}
                                    className="h-9 px-4 text-[10px] uppercase font-black border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
                                >
                                    <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Upload Section */}
            <div className="max-w-3xl space-y-4">
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden ring-1 ring-slate-100">
                    <CardHeader className="border-b border-slate-50 p-4 bg-slate-50/30">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Import Leads</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <FileSpreadsheet className="h-16 w-16 text-slate-400 mb-4" />
                            
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            />
                            
                            {!selectedFile ? (
                                <>
                                    <p className="text-slate-600 font-medium mb-2">Upload CSV or Excel file to import leads</p>
                                    <Button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 font-black uppercase tracking-[0.1em] text-xs shadow-lg shadow-blue-100"
                                    >
                                        <Upload className="h-4 w-4 mr-2" /> Browse Files
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center">
                                    <p className="text-slate-800 font-bold text-lg mb-1">{selectedFile.name}</p>
                                    <p className="text-slate-500 text-sm mb-6">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                    
                                    <div className="flex gap-3 justify-center">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => {
                                                setSelectedFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                            }}
                                            disabled={isUploading}
                                            className="rounded-xl h-10 font-black uppercase tracking-[0.1em] text-xs"
                                        >
                                            Cancel
                                        </Button>
                                        <Button 
                                            onClick={handleUpload}
                                            disabled={isUploading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 font-black uppercase tracking-[0.1em] text-xs shadow-lg shadow-blue-100 min-w-[120px]"
                                        >
                                            {isUploading ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                                            ) : (
                                                <><Upload className="h-4 w-4 mr-2" /> Upload Now</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {uploadStatus.type === 'success' && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-xs uppercase tracking-widest">Upload Successful</h4>
                                    <p className="text-sm mt-1">{uploadStatus.message}</p>
                                </div>
                            </div>
                        )}

                        {uploadStatus.type === 'error' && (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800">
                                <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-xs uppercase tracking-widest">Upload Failed</h4>
                                    <p className="text-sm mt-1">{uploadStatus.message}</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Premium Toast Notification */}
            {submitted && (
                <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden min-w-[320px] border">
                        <div className="p-4 flex items-center gap-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                                <Rocket className="h-6 w-6 text-white animate-bounce" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-black text-white uppercase tracking-tight">Upload Started</h4>
                                <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">Apollo is now processing your file.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)} className="h-8 w-8 p-0 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="h-1 bg-blue-600 w-full animate-[progress_5s_linear_forwards]" />
                    </Card>
                </div>
            )}

            <style jsx global>{`
                @keyframes progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
}
