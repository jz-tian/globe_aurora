import { NextResponse } from 'next/server';
import type { ForecastPoint } from '@/components/utils/kpForecast';

const FORECAST_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_HEADER = 'public, max-age=3600, stale-while-revalidate=600';

let cache: { data: ForecastPoint[]; fetchedAt: number } | null = null;
let refreshing = false;

export async function GET() {
  const now = Date.now();

  if (cache) {
    const age = now - cache.fetchedAt;

    if (age >= CACHE_TTL * 0.85 && age < CACHE_TTL && !refreshing) {
      refreshing = true;
      fetchForecast()
        .then(data => { cache = { data, fetchedAt: Date.now() }; })
        .catch(err => console.error('Background forecast refresh failed:', err))
        .finally(() => { refreshing = false; });
    }

    if (age < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': CACHE_HEADER },
      });
    }
  }

  try {
    const data = await fetchForecast();
    cache = { data, fetchedAt: now };
    return NextResponse.json(data, { headers: { 'Cache-Control': CACHE_HEADER } });
  } catch (err) {
    if (cache) return NextResponse.json(cache.data, { headers: { 'Cache-Control': CACHE_HEADER } });
    console.error('Failed to fetch KP forecast:', err);
    return NextResponse.json({ error: 'Failed to fetch forecast' }, { status: 503 });
  }
}

async function fetchForecast(): Promise<ForecastPoint[]> {
  const res = await fetch(FORECAST_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();

  // NOAA returns an array of objects: { time_tag, kp, observed, noaa_scale }
  if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object' && 'kp' in json[0]) {
    return (json as { time_tag: string; kp: number; observed: string | null }[])
      .map(({ time_tag, kp, observed }) => ({
        time: new Date(time_tag).getTime(),
        kp,
        observed: observed === 'observed',
      }))
      .filter(p => !isNaN(p.kp) && !isNaN(p.time));
  }

  // Legacy fallback: 2D array format [["time_tag","Kp","Predicted"], ...]
  return (json as string[][])
    .slice(1)
    .map(([timeTag, kpStr, observed]) => ({
      time: new Date(timeTag.replace(' ', 'T') + 'Z').getTime(),
      kp: parseFloat(kpStr),
      observed: observed === 'observed',
    }))
    .filter(p => !isNaN(p.kp) && !isNaN(p.time));
}
