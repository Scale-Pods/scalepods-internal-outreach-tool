import { Badge } from "@/components/ui/badge";
import { campaignColor, type CampaignColor } from "@/lib/services/campaigns";

export type InstantlyStatusColor = "emerald" | "amber" | "slate" | "blue" | "red";

export interface InstantlyStatusInfo {
    label: string;
    color: InstantlyStatusColor;
}

export function getInstantlyStatusBadge(status: string | number | null | undefined): InstantlyStatusInfo {
    switch (String(status ?? "").trim()) {
        case "1":
            return { label: "Active", color: "emerald" };
        case "2":
            return { label: "Paused", color: "amber" };
        case "0":
            return { label: "Inactive (Draft)", color: "slate" };
        case "3":
            return { label: "Completed", color: "blue" };
        case "-1":
        case "-2":
        case "-99":
            return { label: "Bounce Protect / Error", color: "red" };
        default:
            return { label: "Unknown", color: "slate" };
    }
}

const INSTANTLY_STATUS_CLASSES: Record<InstantlyStatusColor, { pill: string; dot: string }> = {
    emerald: {
        pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
    },
    amber: {
        pill: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
    },
    blue: {
        pill: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
    },
    red: {
        pill: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
    },
    slate: {
        pill: "bg-slate-100 text-slate-600 border-slate-200",
        dot: "bg-slate-400",
    },
};

export function InstantlyStatusBadge({
    status,
    className = "",
    compact = false,
}: {
    status: string | number | null | undefined;
    className?: string;
    compact?: boolean;
}) {
    if (status === null || status === undefined || String(status).trim() === "") {
        return null;
    }
    const info = getInstantlyStatusBadge(status);
    const styles = INSTANTLY_STATUS_CLASSES[info.color];

    return (
        <Badge
            variant="outline"
            className={`inline-flex items-center gap-1.5 font-bold whitespace-nowrap ${
                compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
            } ${styles.pill} ${className}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`} />
            {info.label}
        </Badge>
    );
}

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
    const hasValidId = campaignId !== null && campaignId !== undefined && String(campaignId).trim() !== "" && String(campaignId) !== "unknown";
    const resolvedName =
        hasValidId && (!campaignName || /^ScalePods Internal Outreach\s+\d+$/i.test(campaignName.trim()))
            ? `ScalePods Internal Outreach ${campaignId}`
            : (campaignName || `Campaign ${campaignId ?? '—'}`);

    return (
        <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap ${campaignColorClasses(color)} ${className}`}>
            {resolvedName}
        </Badge>
    );
}

export function CampaignLabel({
    campaignId,
    campaignName,
    alias,
    showUnassigned = false,
    compact = false,
    badgeClassName = "",
    className = "",
}: {
    campaignId: number | string | null | undefined;
    campaignName?: string | null;
    alias?: string | null;
    showUnassigned?: boolean;
    compact?: boolean;
    badgeClassName?: string;
    className?: string;
}) {
    const trimmedAlias = typeof alias === "string" ? alias.trim() : "";

    return (
        <div className={`inline-flex flex-col items-start min-w-0 ${className}`}>
            <CampaignBadge
                campaignId={campaignId}
                campaignName={campaignName}
                className={badgeClassName}
            />
            {trimmedAlias ? (
                <span className="mt-1 text-[10px] font-medium text-slate-600 leading-tight truncate max-w-full">
                    <span className="text-slate-400 font-normal">Alias:</span> {trimmedAlias}
                </span>
            ) : showUnassigned && !compact ? (
                <span className="mt-1 text-[10px] text-slate-400 italic leading-tight">
                    Unassigned
                </span>
            ) : null}
        </div>
    );
}
