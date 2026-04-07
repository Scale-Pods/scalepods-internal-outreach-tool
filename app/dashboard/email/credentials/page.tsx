"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
    Bell,
    Mail,
    Calendar,
    FileSpreadsheet,
    Eye,
    EyeOff,
    CheckCircle2,
    Save
} from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export default function CredentialsPage() {
    return (
        <div className="space-y-8 pb-10 max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Credentials</h1>
                    <p className="text-slate-500">Manage your credentials and preferences</p>
                </div>
                
            </div>

            {/* Main Section Header */}
            <div>
                <h2 className="text-xl font-bold text-slate-900">Setup Your Credentials</h2>
                <p className="text-slate-500">Connect your Gmail, Google Calendar, and Google Sheets to enable automated lead generation and email outreach.</p>
            </div>

            {/* Integration Cards */}
            <div className="grid gap-8">
                {/* 1. Gmail Integration */}
                <IntegrationCard
                    title="Gmail Integration"
                    desc="Send automated emails from your Gmail account"
                    icon={Mail}
                    iconColor="text-rose-600"
                    iconBg="bg-rose-50"
                    buttonColor="bg-rose-600 hover:bg-rose-700"
                >
                    <SetupGuide>
                        <li>Enable 2-factor authentication on your Gmail account</li>
                        <li>Generate an App Password: Go to Google Account Settings → Security → App passwords</li>
                        <li>Select "Mail" as the app and copy the 16-character password</li>
                    </SetupGuide>

                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label>Gmail Address</Label>
                            <Input placeholder="your-email@gmail.com" />
                        </div>
                        <PasswordField label="App Password" placeholder="16-character app password" />
                        <Button className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white gap-2">
                            <Mail className="h-4 w-4" /> Save Gmail Credentials
                        </Button>
                    </div>
                </IntegrationCard>

                {/* 2. Google Calendar Integration */}
                <IntegrationCard
                    title="Google Calendar Integration"
                    desc="Schedule follow-up meetings automatically"
                    icon={Calendar}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                    buttonColor="bg-blue-600 hover:bg-blue-700"
                >
                    <SetupGuide>
                        <li>Go to Google Cloud Console and create a new project</li>
                        <li>Enable Google Calendar API for your project</li>
                        <li>Create OAuth 2.0 credentials and copy Client ID and Client Secret</li>
                    </SetupGuide>

                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label>Client ID</Label>
                            <Input placeholder="" />
                        </div>
                        <PasswordField label="Client Secret" placeholder="" />
                        <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2">
                            <Calendar className="h-4 w-4" /> Save Calendar Credentials
                        </Button>
                    </div>
                </IntegrationCard>

                {/* 3. Google Sheets Integration */}
                <IntegrationCard
                    title="Google Sheets Integration"
                    desc="Store and manage your leads in spreadsheets"
                    icon={FileSpreadsheet}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                    buttonColor="bg-emerald-600 hover:bg-emerald-700"
                >
                    <SetupGuide>
                        <li>Enable Google Sheets API in Google Cloud Console</li>
                        <li>Create an API key with Sheets API access</li>
                        <li>Create a Google Sheet and copy its ID from the URL</li>
                    </SetupGuide>

                    <div className="space-y-4 mt-6">
                        <PasswordField label="API Key" placeholder="" />
                        <div className="space-y-2">
                            <Label>Spreadsheet ID</Label>
                            <Input placeholder="" />
                        </div>
                        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                            <FileSpreadsheet className="h-4 w-4" /> Save Sheets Credentials
                        </Button>
                    </div>
                </IntegrationCard>
            </div>

            {/* Integration Status Section */}
            <Card className="border-border shadow-sm bg-white">
                <CardContent className="p-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Integration Status</h3>
                    <p className="text-slate-500 mb-6">Once all credentials are configured, your automated lead generation system will be ready to:</p>

                    <div className="space-y-3">
                        <StatusItem text="Send personalized emails from your Gmail account" />
                        <StatusItem text="Schedule follow-up meetings in your calendar" />
                        <StatusItem text="Track leads and responses in Google Sheets" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function IntegrationCard({ title, desc, icon: Icon, iconColor, iconBg, children }: any) {
    return (
        <Card className="border-border shadow-sm bg-white">
            <CardHeader className="pb-4 border-border border-border">
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${iconBg} ${iconColor}`}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
                        <CardDescription>{desc}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {children}
            </CardContent>
        </Card>
    );
}

function SetupGuide({ children }: any) {
    return (
        <div className="bg-slate-50 rounded-lg p-4 border border-border">
            <h4 className="font-bold text-sm text-slate-900 mb-2">Setup Guide:</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 marker:text-slate-400">
                {children}
            </ul>
        </div>
    );
}

function PasswordField({ label, placeholder }: any) {
    const [show, setShow] = useState(false);
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="relative">
                <Input
                    type={show ? "text" : "password"}
                    placeholder={placeholder}
                    className="pr-10"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                    onClick={() => setShow(!show)}
                >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

function StatusItem({ text }: any) {
    return (
        <div className="flex items-center gap-3 text-slate-700">
            <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">{text}</span>
        </div>
    );
}
