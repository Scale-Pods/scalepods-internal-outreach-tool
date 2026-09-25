import { Badge } from "@/components/ui/badge";
import { getAccountMeta } from "@/lib/services/linkedin-sheets";

const COLOR_CLASSES: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
};

export function accountColorClasses(color: string) {
    return COLOR_CLASSES[color] || COLOR_CLASSES.slate;
}

export function LinkedInAccountBadge({ accountId, className = "" }: { accountId: string | null | undefined; className?: string }) {
    const meta = getAccountMeta(accountId);
    return (
        <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap ${accountColorClasses(meta.color)} ${className}`}>
            {meta.name}
        </Badge>
    );
}
