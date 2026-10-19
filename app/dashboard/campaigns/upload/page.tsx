"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    UploadCloud, FileSpreadsheet, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, X, Megaphone,
} from "lucide-react";
import * as XLSX from "xlsx";

const CAMPAIGN_OPTIONS = Array.from({ length: 10 }, (_, i) => {
    const id = i + 1;
    return { id, key: `scalepods_campaign_${id}`, label: `Campaign ${id}` };
});

const SOURCE_OPTIONS = [
    { value: "country_upload", label: "Country Upload" },
    { value: "manual", label: "Manual" },
    { value: "api", label: "API" },
    { value: "cold_outreach", label: "Cold Outreach" },
];

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

interface PreviewData {
    headers: string[];
    rows: any[][];
    totalRows: number;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadLeadsPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [campaignId, setCampaignId] = useState<string>("");
    const [source, setSource] = useState<string>("country_upload");
    const [isDragging, setIsDragging] = useState(false);

    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);

    const resetUploadStatus = () => {
        setUploadState("idle");
        setUploadResult(null);
        setUploadErrors([]);
    };

    const parseFile = useCallback((f: File) => {
        setParseError(null);
        setPreview(null);
        resetUploadStatus();

        const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            setParseError(`Unsupported file type "${ext}". Please upload a .csv, .xlsx or .xls file.`);
            setFile(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

                if (rows.length === 0) {
                    setParseError("The file appears to be empty.");
                    return;
                }

                const headers = (rows[0] || []).map((h: any) => String(h ?? "").trim());
                const dataRows = rows.slice(1);

                setPreview({
                    headers,
                    rows: dataRows.slice(0, 10),
                    totalRows: dataRows.length,
                });
                setFile(f);
            } catch (err: any) {
                console.error("Failed to parse file:", err);
                setParseError("Could not parse this file. Make sure it's a valid CSV or Excel file.");
            }
        };
        reader.onerror = () => setParseError("Failed to read the file.");
        reader.readAsArrayBuffer(f);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) parseFile(f);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) parseFile(f);
    };

    const clearFile = () => {
        setFile(null);
        setPreview(null);
        setParseError(null);
        resetUploadStatus();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const canUpload = !!file && !!campaignId && !parseError && uploadState !== "uploading";

    const handleUpload = async () => {
        if (!file || !campaignId) return;
        setUploadState("uploading");
        setUploadErrors([]);

        try {
            const campaign = CAMPAIGN_OPTIONS.find(c => String(c.id) === campaignId);
            const uploadId = crypto.randomUUID();

            const formData = new FormData();
            formData.append("file", file);
            formData.append("source", source);
            formData.append("upload_id", uploadId);
            formData.append("campaign_id", String(campaign?.id ?? campaignId));
            if (campaign?.key) formData.append("campaign_key", campaign.key);
            formData.append("source_file", file.name);

            const res = await fetch("/api/webhook/upload-leads", {
                method: "POST",
                body: formData,
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok || json?.success === false) {
                setUploadState("error");
                setUploadErrors(Array.isArray(json?.errors) ? json.errors : [json?.error || "Upload failed. Please try again."]);
                return;
            }

            setUploadState("success");
            setUploadResult(json);
        } catch (err: any) {
            console.error("Upload failed:", err);
            setUploadState("error");
            setUploadErrors([err.message || "Network error while uploading."]);
        }
    };

    const selectedCampaign = CAMPAIGN_OPTIONS.find(c => String(c.id) === campaignId);

    return (
        <div className="space-y-6 pb-10 pt-6 px-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 -ml-2" onClick={() => router.push("/dashboard/campaigns")}>
                    <ChevronLeft className="h-4 w-4" /> Back to Campaigns
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-600 text-white shadow-sm">
                    <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Leads</h1>
                    <p className="text-sm text-slate-500">Upload a CSV or Excel file, assign it to a campaign, and send it for processing</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: upload zone + preview */}
                <Card className="lg:col-span-2 border-border shadow-sm bg-white">
                    <CardContent className="p-6 space-y-5">
                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">File</Label>
                            {!file ? (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`py-12 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors ${isDragging ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                                        }`}
                                >
                                    <UploadCloud className="h-9 w-9 text-slate-400 mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-slate-700">Drag &amp; drop your file here, or click to browse</p>
                                    <p className="text-xs text-slate-400 mt-1">Accepts .csv, .xlsx, .xls</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-slate-50">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                                            <FileSpreadsheet className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB {preview ? `· ${preview.totalRows.toLocaleString()} rows` : ""}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600" onClick={clearFile}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                            {parseError && (
                                <p className="text-xs text-rose-600 mt-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {parseError}</p>
                            )}
                        </div>

                        {preview && (
                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">
                                    Preview (first {Math.min(10, preview.rows.length)} of {preview.totalRows.toLocaleString()} rows)
                                </Label>
                                <div className="overflow-auto max-h-72 rounded-lg border border-border">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0">
                                            <tr>
                                                {preview.headers.map((h, i) => (
                                                    <th key={i} className="px-3 py-2 whitespace-nowrap">{h || `Column ${i + 1}`}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {preview.rows.map((row, ri) => (
                                                <tr key={ri} className="hover:bg-slate-50">
                                                    {preview.headers.map((_, ci) => (
                                                        <td key={ci} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate">{row[ci] ?? ""}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: campaign assignment + submit */}
                <Card className="border-border shadow-sm bg-white h-fit">
                    <CardContent className="p-6 space-y-5">
                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1.5">
                                <Megaphone className="h-3.5 w-3.5" /> Assign to Campaign
                            </Label>
                            <Select value={campaignId} onValueChange={setCampaignId} disabled={!file}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select a campaign..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {CAMPAIGN_OPTIONS.map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.label} <span className="text-slate-400 ml-1">({c.key})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!file && <p className="text-[11px] text-slate-400 mt-1.5">Upload a file first to assign a campaign.</p>}
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Source</Label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select source..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {SOURCE_OPTIONS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="w-full h-11 gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                            disabled={!canUpload}
                            onClick={handleUpload}
                        >
                            {uploadState === "uploading" ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                            ) : (
                                <><UploadCloud className="h-4 w-4" /> Upload &amp; Send</>
                            )}
                        </Button>

                        {uploadState === "success" && (
                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                                <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Upload accepted — processing</p>
                                {uploadResult?.upload_id && <p className="font-mono text-[10px] text-emerald-700 break-all">Upload ID: {uploadResult.upload_id}</p>}
                                {selectedCampaign && <p>Assigned to <span className="font-bold">{selectedCampaign.label}</span> ({selectedCampaign.key})</p>}
                            </div>
                        )}

                        {uploadState === "error" && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                                <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Upload failed</p>
                                {uploadErrors.map((err, i) => <p key={i}>{err}</p>)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
