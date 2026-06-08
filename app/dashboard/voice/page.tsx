import { getVoiceStats } from "@/lib/services/voice";
import VoiceDashboard from "./voice-client";

export default async function VoiceDashboardPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    // Default: last 7 days
    let from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    let to = new Date();
    to.setHours(23, 59, 59, 999);

    const params = await searchParams;

    if (typeof params.from === "string") from = new Date(params.from);
    if (typeof params.to === "string") to = new Date(params.to);

    const providerFilter = typeof params.provider === "string" ? params.provider : "all";

    const data = await getVoiceStats(from, to, providerFilter);

    return (
        <VoiceDashboard
            stats={data.stats}
            dailyVolume={data.dailyVolume}
            hourlyDistribution={data.hourlyDistribution}
            statusBreakdown={data.statusBreakdown}
        />
    );
}
