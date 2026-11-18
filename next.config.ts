import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'ScalePods.ae',
            },
            {
                protocol: 'https',
                hostname: 'user-images.githubusercontent.com',
            }
        ],
    },
    async redirects() {
        return [
            {
                source: '/dashboard/campaigns/voice/cold-logs',
                destination: '/dashboard/campaigns/voice/logs',
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
