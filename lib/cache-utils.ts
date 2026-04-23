// In-memory cache utility for API results
const cache = new Map<string, { data: any, expires: number }>();

export async function getOrSetCache<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && cached.expires > now) {
        // console.log(`Cache hit for ${key}`);
        return cached.data;
    }

    // console.log(`Cache miss for ${key}. Fetching fresh data...`);
    const data = await fetchFn();
    cache.set(key, { data, expires: now + ttl });
    return data;
}
