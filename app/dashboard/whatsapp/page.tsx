import { getWaDashboardData } from "@/lib/services/whatsapp-outreach";
import WhatsappDashboardClient from "./whatsapp-client";

export default async function WhatsappDashboardPage({
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

    const { cold, hot, hubspotWa } = await getWaDashboardData(from, to);

    return <WhatsappDashboardClient cold={cold} hot={hot} hubspotWa={hubspotWa} />;
}
