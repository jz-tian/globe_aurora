import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_HEADER = 'public, max-age=3600, stale-while-revalidate=600';

// Key: sorted pts string, Value: { data, fetchedAt }
const cache = new Map<string, { data: Record<string, number | null>; fetchedAt: number }>();
const refreshing = new Set<string>();

export async function GET(req: NextRequest) {
  const pts = req.nextUrl.searchParams.get('pts') ?? '';
  if (!pts) return NextResponse.json({}, { headers: { 'Cache-Control': CACHE_HEADER } });

  // Normalise key so order doesn't matter
  const cacheKey = pts.split('|').sort().join('|');
  const now = Date.now();
  const hit = cache.get(cacheKey);

  if (hit) {
    const age = now - hit.fetchedAt;
    if (age >= CACHE_TTL * 0.85 && age < CACHE_TTL && !refreshing.has(cacheKey)) {
      refreshing.add(cacheKey);
      fetchAll(pts)
        .then(data => cache.set(cacheKey, { data, fetchedAt: Date.now() }))
        .catch(err => console.error('[cloud] background refresh failed:', err))
        .finally(() => refreshing.delete(cacheKey));
    }
    if (age < CACHE_TTL) {
      return NextResponse.json(hit.data, { headers: { 'Cache-Control': CACHE_HEADER } });
    }
  }

  try {
    const data = await fetchAll(pts);
    cache.set(cacheKey, { data, fetchedAt: now });
    return NextResponse.json(data, { headers: { 'Cache-Control': CACHE_HEADER } });
  } catch (err) {
    if (hit) return NextResponse.json(hit.data, { headers: { 'Cache-Control': CACHE_HEADER } });
    console.error('[cloud] failed to fetch:', err);
    return NextResponse.json({ error: 'Failed to fetch cloud cover' }, { status: 503 });
  }
}

async function fetchAll(pts: string): Promise<Record<string, number | null>> {
  const pairs = pts.split('|').slice(0, 15);
  const results = await Promise.allSettled(
    pairs.map(async (pair) => {
      const [latStr, lonStr] = pair.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (isNaN(lat) || isNaN(lon)) return { key: pair, value: null };

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover&forecast_days=1`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      const json = await res.json();
      const value: number | null =
        typeof json?.current?.cloud_cover === 'number' ? json.current.cloud_cover : null;
      return { key: pair, value };
    })
  );

  const out: Record<string, number | null> = {};
  for (let i = 0; i < pairs.length; i++) {
    const r = results[i];
    out[pairs[i]] = r.status === 'fulfilled' ? r.value.value : null;
  }
  return out;
}
