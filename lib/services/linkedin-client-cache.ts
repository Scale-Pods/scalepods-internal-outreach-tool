"use client";

// Client-side in-memory cache for LinkedIn module navigation
// Prevents redundant round-trips and full-page loading flickers when switching between
// Dashboard, Leads, Chat, and Analytics.

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const clientCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

const CLIENT_CACHE_TTL_MS = 180_000; // 3 minutes fresh
const STALE_CACHE_MAX_AGE_MS = 600_000; // 10 minutes stale-while-revalidate

export function getLinkedInClientCache<T>(key: string): T | null {
    const entry = clientCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > STALE_CACHE_MAX_AGE_MS) {
        clientCache.delete(key);
        return null;
    }
    return entry.data as T;
}

export function setLinkedInClientCache<T>(key: string, data: T) {
    clientCache.set(key, { data, timestamp: Date.now() });
}

export function clearLinkedInClientCache(keyPrefix?: string) {
    if (!keyPrefix) {
        clientCache.clear();
        return;
    }
    for (const key of clientCache.keys()) {
        if (key.startsWith(keyPrefix)) {
            clientCache.delete(key);
        }
    }
}

export async function fetchLinkedInClient<T>(url: string, force = false): Promise<T> {
    const now = Date.now();
    const cached = clientCache.get(url);

    if (!force && cached && now - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        return cached.data as T;
    }

    if (!force && inFlightRequests.has(url)) {
        return inFlightRequests.get(url)!;
    }

    const fetchUrl = force ? `${url}${url.includes('?') ? '&' : '?'}refresh=true` : url;

    const promise = (async () => {
        try {
            const res = await fetch(fetchUrl);
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            clientCache.set(url, { data, timestamp: Date.now() });
            return data as T;
        } finally {
            inFlightRequests.delete(url);
        }
    })();

    inFlightRequests.set(url, promise);
    return promise;
}

// Prefetches sibling sections in idle time so clicking tabs is instantaneous
export function prefetchLinkedInSections() {
    if (typeof window === "undefined") return;

    const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1000));
    idle(() => {
        const endpoints = [
            "/api/linkedin/leads",
            "/api/linkedin/conversations",
            "/api/linkedin/quota",
        ];
        endpoints.forEach((ep) => {
            if (!clientCache.has(ep) && !inFlightRequests.has(ep)) {
                fetchLinkedInClient(ep, false).catch(() => {});
            }
        });
    });
}
