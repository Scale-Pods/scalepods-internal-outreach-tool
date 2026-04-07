import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ScalePods | AI Automation",
    description: "AI-Powered Marketing & Operations managed by ScalePods",
    icons: {
        icon: '/SP_logo.png',
        shortcut: '/SP_logo.png',
        apple: '/SP_logo.png',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
