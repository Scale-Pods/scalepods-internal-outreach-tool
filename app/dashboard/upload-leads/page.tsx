"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export default function UploadLeadsPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
            formData.append("data", selectedFile);
            formData.append("webhookUrl", "https://n8n.srv1010832.hstgr.cloud/webhook/upload-leads-xls");

            const res = await fetch('/api/upload-leads', {
                method: 'POST',
                body: formData,
            });
            const result = await res.json();
            
            if (res.ok && result.ok) {
                setUploadStatus({ type: 'success', message: `Successfully sent ${selectedFile.name} to the webhook.` });
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } else {
                setUploadStatus({ type: 'error', message: `Error uploading leads: ${result.response || result.error || res.statusText}` });
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadStatus({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 pb-10 max-w-4xl mx-auto pt-10">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Upload Leads to Webhook</h1>
                <p className="text-slate-500 mt-2">
                    Import leads directly by uploading an Excel or CSV file to trigger the webhook.
                </p>
            </div>

            <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="bg-slate-50 border-b border-slate-100">
                    <CardTitle className="text-lg">File Upload</CardTitle>
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
