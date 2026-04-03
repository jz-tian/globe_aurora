import { NextResponse } from 'next/server';
import { fetchAuroraData, AuroraApiResponse } from '@/components/utils/noaa';

const CACHE_TTL = 30 * 60 * 1000;        // 30 minutes — serve cached data
const STALE_REFRESH = 25 * 60 * 1000;    // 25 minutes — trigger background refresh

// Tell Vercel CDN to cache for 30 min, serve stale for up to 10 min while revalidating
const CACHE_HEADER = 'public, max-age=1800, stale-while-revalidate=600';

let cache: { data: AuroraApiResponse; fetchedAt: number } | null = null;
let refreshing = false;

export async function GET() {
  const now = Date.now();

  if (cache) {
    const age = now - cache.fetchedAt;

    // Trigger a background refresh when cache is between 25–30 min old
    if (age >= STALE_REFRESH && age < CACHE_TTL && !refreshing) {
      refreshing = true;
      fetchAuroraData()
        .then(data => { cache = { data, fetchedAt: Date.now() }; })
        .catch(err => console.error('Background aurora refresh failed:', err))
        .finally(() => { refreshing = false; });
    }

    // Return cached data immediately (fresh or stale-while-revalidating)
    if (age < CACHE_TTL) {
      return NextResponse.json(cache.data, { headers: { 'Cache-Control': CACHE_HEADER } });
    }
  }

  // Cache missing or fully expired — must wait for fresh fetch
  try {
    const data = await fetchAuroraData();
    cache = { data, fetchedAt: now };
    return NextResponse.json(data, { headers: { 'Cache-Control': CACHE_HEADER } });
  } catch (err) {
    if (cache) return NextResponse.json(cache.data, { headers: { 'Cache-Control': CACHE_HEADER } });
    console.error('Failed to fetch NOAA data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch aurora data' },
      { status: 503 }
    );
  }
}
