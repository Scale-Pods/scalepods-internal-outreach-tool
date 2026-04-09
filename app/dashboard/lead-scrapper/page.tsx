"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, MapPin, Globe, Linkedin, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const scraperOptions = [
    {
        title: "LinkedIn Scrapper",
        description: "Extract professional leads, company data, and job details directly from LinkedIn profiles and searches.",
        icon: Linkedin,
        href: "/dashboard/lead-scrapper/linkedin",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-100",
        hoverBorder: "hover:border-blue-300",
    },
    {
        title: "Google Maps Scrapper",
        description: "Gather business listings, contact info, and ratings from Google Maps for any location or category.",
        icon: MapPin,
        href: "/dashboard/lead-scrapper/google-maps",
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-100",
        hoverBorder: "hover:border-red-300",
    },
    {
        title: "Trade India Scrapper",
        description: "Scrape B2B leads, supplier information, and product listings from the Trade India portal.",
        icon: Globe,
        href: "/dashboard/lead-scrapper/trade-india",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-100",
        hoverBorder: "hover:border-orange-300",
    }
];

export default function LeadScrapperPage() {
    return (
        <div className="space-y-8 pb-10 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <p className="text-slate-500 text-lg">Select a platform to start extracting high-quality leads for your outreach campaigns.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {scraperOptions.map((option, index) => (
                    <Link key={index} href={option.href} className="group">
                        <Card className={`h-full border-2 ${option.borderColor} ${option.hoverBorder} transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden`}>
                            <CardHeader className={`${option.bgColor} pb-8`}>
                                <div className={`p-4 rounded-2xl bg-white w-fit shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                    <option.icon className={`h-8 w-8 ${option.color}`} />
                                </div>
                                <CardTitle className="text-xl font-bold text-slate-900">{option.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <CardDescription className="text-slate-600 leading-relaxed mb-8">
                                    {option.description}
                                </CardDescription>
                                <div className="flex items-center text-slate-900 font-bold group-hover:gap-2 transition-all">
                                    Get Started <ArrowRight className="h-4 w-4 ml-1" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            
        </div>
    );
}
