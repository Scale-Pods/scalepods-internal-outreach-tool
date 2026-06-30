"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export default function UploadLeadsPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [tName, setTName] = useState<string>("ENRICHED_LEADS");
    const [loopValue, setLoopValue] = useState<string>("Intro");

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
            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const res = await fetch('/api/master-leads/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: jsonData, t_name: tName, loop: loopValue }),
            });
            const result = await res.json();
            
            if (res.ok) {
                setUploadStatus({ type: 'success', message: `Successfully uploaded ${result.count} leads to Master Database.` });
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } else {
                setUploadStatus({ type: 'error', message: `Error uploading leads: ${result.error}` });
            }
        } catch (error) {
            console.error("Upload error:", error);
            setUploadStatus({ type: 'error', message: "An unexpected error occurred while parsing or uploading the file." });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 pb-10 max-w-4xl mx-auto pt-10">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Upload Master Leads</h1>
                <p className="text-slate-500 mt-2">
                    Import leads directly into the master_leads_unique database table using an Excel or CSV file.
                </p>
            </div>

            <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="bg-slate-50 border-b border-slate-100">
                    <CardTitle className="text-lg">File Upload</CardTitle>
                    <CardDescription>Upload a .csv or .xlsx file containing full_name, company_phone_number, and Personal Email</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
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
                                <p className="text-slate-600 font-medium mb-2">Drag and drop your file here, or click to browse</p>
                                <Button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white"
                                >
                                    Browse Files
                                </Button>
                            </>
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-800 font-bold text-lg mb-1">{selectedFile.name}</p>
                                <p className="text-slate-500 text-sm mb-6">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                
                                <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Target Table (t_name)</label>
                                        <select 
                                            value={tName} 
                                            onChange={(e) => setTName(e.target.value)}
                                            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="ENRICHED_LEADS">ENRICHED_LEADS</option>
                                            <option value="LinkedIn_leads">LinkedIn_leads</option>
                                            <option value="gmap_leadsv2">gmap_leadsv2</option>
                                            <option value="hubspot_lead">hubspot_lead</option>
                                            <option value="icp_tracker">icp_tracker</option>
                                            <option value="meta_lead_tracker">meta_lead_tracker</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Loop</label>
                                        <select 
                                            value={loopValue} 
                                            onChange={(e) => setLoopValue(e.target.value)}
                                            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="Intro">Intro</option>
                                            <option value="Followup">Followup</option>
                                            <option value="nurture">nurture</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 justify-center">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setSelectedFile(null);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleUpload}
                                        disabled={isUploading}
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[120px]"
                                    >
                                        {isUploading ? (
                                            "Uploading..."
                                        ) : (
                                            <>
                                                <Upload className="mr-2 h-4 w-4" /> Upload Now
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {uploadStatus.type === 'success' && (
                        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-emerald-800">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="font-bold">Upload Successful</h4>
                                <p className="text-sm mt-1">{uploadStatus.message}</p>
                            </div>
                        </div>
                    )}

                    {uploadStatus.type === 'error' && (
                        <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-800">
                            <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="font-bold">Upload Failed</h4>
                                <p className="text-sm mt-1">{uploadStatus.message}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
