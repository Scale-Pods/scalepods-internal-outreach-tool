import { MessageCircle } from "lucide-react";

const SUPPORT_AI_URL = "https://support-ai-woad.vercel.app";
const SOURCE = "scalepods-internal-outreach";

export function SupportButton() {
    return (
        <a
            href={`${SUPPORT_AI_URL}/?source=${SOURCE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
        >
            <MessageCircle className="h-4 w-4" />
            Support
        </a>
    );
}
