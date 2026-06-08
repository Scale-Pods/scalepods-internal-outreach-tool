import { getEmailStats } from "@/lib/services/email";
import EmailDashboardClient from "./email-client";

export default async function EmailDashboardPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    let from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    let to = new Date();
    to.setHours(23, 59, 59, 999);

    const params = await searchParams;

    if (typeof params.from === "string") {
        from = new Date(params.from);
    }
    if (typeof params.to === "string") {
        to = new Date(params.to);
    }

    const { campaigns, metrics, recentReplies, dbReplyCount, localData } = await getEmailStats(from, to);

    return <EmailDashboardClient 
        campaigns={campaigns} 
        metrics={metrics} 
        recentReplies={recentReplies} 
        dbReplyCount={dbReplyCount} 
        localData={localData} 
    />;
}
