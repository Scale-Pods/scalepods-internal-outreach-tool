import { MessageCircle } from "lucide-react";

const SUPPORT_AI_URL = "https://support-ai-woad.vercel.app";
const SOURCE = "scalepods-internal-outreach";

export function SupportButton() {
    return (
        <a
            href={`${SUPPORT_AI_URL}/?source=${SOURCE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-4 right-4 z-[9999] flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
        >
            <MessageCircle className="h-3.5 w-3.5" />
            Support
        </a>
    );
}
