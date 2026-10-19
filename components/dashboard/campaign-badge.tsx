import { Badge } from "@/components/ui/badge";
import { campaignColor, type CampaignColor } from "@/lib/services/campaigns";

const CAMPAIGN_COLOR_CLASSES: Record<CampaignColor, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    fuchsia: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

export const CAMPAIGN_HEX: Record<CampaignColor, string> = {
    blue: '#3b82f6',
    violet: '#8b5cf6',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    cyan: '#06b6d4',
    indigo: '#6366f1',
    fuchsia: '#d946ef',
};

export function campaignColorClasses(color: CampaignColor) {
    return CAMPAIGN_COLOR_CLASSES[color];
}

export function CampaignBadge({ campaignId, campaignName, className = "" }: {
    campaignId: number | string | null | undefined;
    campaignName: string | null | undefined;
    className?: string;
}) {
    const color = campaignColor(campaignId);
    return (
        <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap ${campaignColorClasses(color)} ${className}`}>
            {campaignName || `Campaign ${campaignId ?? '—'}`}
        </Badge>
    );
}
