import { NextResponse } from 'next/server';
import { fetchAuroraData, AuroraApiResponse } from '@/components/utils/noaa';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let cache: { data: AuroraApiResponse; fetchedAt: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await fetchAuroraData();
    cache = { data, fetchedAt: now };
    return NextResponse.json(data);
  } catch (err) {
    // Return stale cache if available, else 503
    if (cache) {
      return NextResponse.json(cache.data);
    }
    console.error('Failed to fetch NOAA data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch aurora data' },
      { status: 503 }
    );
  }
}
