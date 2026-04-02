# Globe Pin & Cloud Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual location pin (+ city label) for the user's IP location and selected site on the 3D globe, and display real-time cloud cover percentage next to each top-10 viewing site in the sidebar.

**Architecture:** A new `/api/cloud` server route fetches Open-Meteo in parallel for up to 15 coordinates, caches 1h, and returns a `Record<"lat,lon", number | null>`. `HomeClient` fetches this and passes `cloudCover` to `Sidebar`; `GlobeScene` gets a new `ipLocation` prop and renders two distinct pin types using react-globe.gl's `pointsData`/`labelsData` layers.

**Tech Stack:** Next.js 16 App Router, react-globe.gl, Open-Meteo (free, no API key), TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/cloud/route.ts` | **Create** | Fetch + cache cloud cover for a list of coordinates |
| `components/GlobeScene.tsx` | **Modify** | Add `ipLocation` prop; render `pointsData` + `labelsData` pins |
| `components/Sidebar.tsx` | **Modify** | Add `cloudCover` prop; render `☁ N%` tag in `SiteRow` |
| `app/HomeClient.tsx` | **Modify** | Fetch cloud cover; pass `cloudCover` to Sidebar; pass `ipLocation` to GlobeScene |

---

## Task 1: `/api/cloud` route

**Files:**
- Create: `app/api/cloud/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/cloud/route.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jiazheng/idol/claude_projects/globe_aurora && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add app/api/cloud/route.ts
git commit -m "feat: add /api/cloud route with Open-Meteo and 1h cache"
```

---

## Task 2: Cloud cover display in `SiteRow`

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add `cloudColor` helper and `cloudPct` prop to `SiteRow`**

After the existing `intensityColor` function (line ~27), add:

```typescript
function cloudColor(pct: number): string {
  if (pct < 30) return '#3dffa0';
  if (pct < 70) return 'rgba(255,255,255,0.38)';
  return 'rgba(255,255,255,0.18)';
}
```

Update `SiteRow`'s props interface (the destructured params around line 174) to add `cloudPct`:

```typescript
const SiteRow = memo(function SiteRow({
  site,
  rank,
  displayIntensity,
  cloudPct,
  onClick,
}: {
  site: TopSite;
  rank: number;
  displayIntensity: number;
  cloudPct?: number | null;
  onClick: () => void;
}) {
```

- [ ] **Step 2: Render the cloud tag inside `SiteRow`**

In the second `<div>` row of `SiteRow` (the one containing country + bar + intensity, around line 255), add a cloud tag **after** the intensity `<span>`:

```tsx
{/* Cloud cover tag */}
{typeof cloudPct === 'number' && (
  <span
    style={{
      ...mono,
      fontSize: 9,
      color: cloudColor(cloudPct),
      flexShrink: 0,
      width: 38,
      textAlign: 'right',
      letterSpacing: '-0.01em',
    }}
  >
    ☁{cloudPct}%
  </span>
)}
{cloudPct === undefined && (
  <span
    style={{
      ...mono,
      fontSize: 9,
      color: 'rgba(255,255,255,0.15)',
      flexShrink: 0,
      width: 38,
      textAlign: 'right',
    }}
  >
    —
  </span>
)}
```

- [ ] **Step 3: Add `cloudCover` prop to Sidebar and thread to `SiteRow`**

Update the `Props` interface (around line 17):

```typescript
interface Props {
  auroraData: AuroraPoint[];
  onSelectSite: (site: { lat: number; lon: number }) => void;
  ipLocation: IpLocation | null;
  kp: number | null;
  forecast: ForecastPoint[];
  cloudCover: Record<string, number | null>;
}
```

Update the function signature:

```typescript
export default function Sidebar({ auroraData, onSelectSite, ipLocation, kp, forecast, cloudCover }: Props) {
```

Add a helper inside `Sidebar` to look up a site's cloud value (add before the `content` variable):

```typescript
const cloudKey = (lat: number, lon: number) =>
  `${lat.toFixed(2)},${lon.toFixed(2)}`;
```

Update the `SiteRow` call inside `topSites.map` (around line 417):

```tsx
<SiteRow
  key={`${site.city.name}-${site.city.country}`}
  site={site}
  rank={i + 1}
  displayIntensity={Math.round(site.intensity * kpScale)}
  cloudPct={cloudCover[cloudKey(site.city.lat, site.city.lon)]}
  onClick={() => onSelectSite({ lat: site.city.lat, lon: site.city.lon })}
/>
```

- [ ] **Step 4: Update the column header to include cloud label**

In the column labels `<div>` (around line 369), add a cloud header after the `INT` span:

```tsx
<span
  style={{
    ...mono,
    fontSize: 8,
    letterSpacing: '0.18em',
    color: 'rgba(255,255,255,0.38)',
    width: 38,
    textAlign: 'right',
  }}
>
  ☁
</span>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/jiazheng/idol/claude_projects/globe_aurora && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add cloud cover display to sidebar site rows"
```

---

## Task 3: Cloud cover fetch in `HomeClient`

**Files:**
- Modify: `app/HomeClient.tsx`

- [ ] **Step 1: Add `cloudCover` state and fetch logic**

Add the import for `computeTopSites` and the new state. At the top of `HomeClient.tsx`, add to existing imports:

```typescript
import { computeTopSites } from '@/components/utils/topSites';
```

Inside `HomeClient`, after the `forecast` state, add:

```typescript
const [cloudCover, setCloudCover] = useState<Record<string, number | null>>({});
```

- [ ] **Step 2: Add the `fetchCloudCover` effect**

Add this `useEffect` after the forecast effect (around line 128):

```typescript
useEffect(() => {
  if (!data) return;

  const sites = computeTopSites(data.coordinates, 10);
  const pts: string[] = sites.map(
    s => `${s.city.lat.toFixed(2)},${s.city.lon.toFixed(2)}`
  );
  if (ipLocation) {
    pts.push(`${ipLocation.lat.toFixed(2)},${ipLocation.lon.toFixed(2)}`);
  }
  if (pts.length === 0) return;

  const load = async () => {
    try {
      const res = await fetch(`/api/cloud?pts=${encodeURIComponent(pts.join('|'))}`);
      if (res.ok) setCloudCover(await res.json());
    } catch (e) {
      console.error('Failed to load cloud cover:', e);
    }
  };

  load();
  const interval = setInterval(load, 60 * 60 * 1000);
  return () => clearInterval(interval);
}, [data, ipLocation]);
```

- [ ] **Step 3: Pass `cloudCover` to `Sidebar`**

In the JSX, update the `<Sidebar>` call (around line 134):

```tsx
<Sidebar
  auroraData={data?.coordinates ?? []}
  onSelectSite={setSelectedSite}
  ipLocation={ipLocation}
  kp={data?.kp ?? null}
  forecast={forecast}
  cloudCover={cloudCover}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/jiazheng/idol/claude_projects/globe_aurora && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/HomeClient.tsx
git commit -m "feat: fetch cloud cover in HomeClient and pass to Sidebar"
```

---

## Task 4: Globe location pins in `GlobeScene`

**Files:**
- Modify: `components/GlobeScene.tsx`

- [ ] **Step 1: Add `ipLocation` to `GlobeScene` props**

Update the `Props` interface (around line 47):

```typescript
interface Props {
  auroraData: AuroraPoint[];
  selectedSite: { lat: number; lon: number } | null;
  ipLocation: { lat: number; lon: number; city: string; country: string } | null;
}
```

Update the function signature:

```typescript
export default function GlobeScene({ auroraData, selectedSite, ipLocation }: Props) {
```

- [ ] **Step 2: Build `pointsData` and `labelsData` with `useMemo`**

Add this memo after the existing `heatmapColorFn` (around line 221):

```typescript
const { pinPoints, pinLabels } = useMemo(() => {
  type PinPoint = { lat: number; lon: number; color: string; radius: number };
  type PinLabel = { lat: number; lon: number; text: string; color: string };

  const points: PinPoint[] = [];
  const labels: PinLabel[] = [];

  const sameAsIp = (site: { lat: number; lon: number } | null) =>
    site &&
    ipLocation &&
    Math.abs(site.lat - ipLocation.lat) < 0.01 &&
    Math.abs(site.lon - ipLocation.lon) < 0.01;

  if (ipLocation) {
    points.push({ lat: ipLocation.lat, lon: ipLocation.lon, color: '#7dd3fc', radius: 0.4 });
    labels.push({
      lat: ipLocation.lat,
      lon: ipLocation.lon,
      text: ipLocation.country ? `${ipLocation.city}, ${ipLocation.country}` : ipLocation.city,
      color: 'rgba(125,211,252,0.75)',
    });
  }

  if (selectedSite && !sameAsIp(selectedSite)) {
    points.push({ lat: selectedSite.lat, lon: selectedSite.lon, color: '#3dffa0', radius: 0.35 });
    // selectedSite doesn't carry a name — label is omitted
  }

  return { pinPoints: points, pinLabels: labels };
}, [ipLocation, selectedSite]);
```

- [ ] **Step 3: Wire pins to the `Globe` component**

In the `<Globe>` JSX (around line 225), add these props:

```tsx
pointsData={pinPoints}
pointLat={(d: object) => (d as { lat: number }).lat}
pointLng={(d: object) => (d as { lon: number }).lon}
pointColor={(d: object) => (d as { color: string }).color}
pointRadius={(d: object) => (d as { radius: number }).radius}
pointAltitude={0.01}
pointsMerge={false}
labelsData={pinLabels}
labelLat={(d: object) => (d as { lat: number }).lat}
labelLng={(d: object) => (d as { lon: number }).lon}
labelText={(d: object) => (d as { text: string }).text}
labelColor={(d: object) => (d as { color: string }).color}
labelSize={0.45}
labelDotRadius={0}
labelAltitude={0.015}
labelResolution={2}
```

- [ ] **Step 4: Pass `ipLocation` from `HomeClient` to `GlobeScene`**

In `app/HomeClient.tsx`, update the `<GlobeScene>` call (around line 141):

```tsx
<GlobeScene
  auroraData={data?.coordinates ?? []}
  selectedSite={selectedSite}
  ipLocation={ipLocation}
/>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/jiazheng/idol/claude_projects/globe_aurora && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/GlobeScene.tsx app/HomeClient.tsx
git commit -m "feat: add IP location and selected site pins to globe"
```

---

## Self-Review

**Spec coverage:**
- ✅ Globe blue pin for user IP location with city/country label — Task 4
- ✅ Globe green pin for selected viewing site — Task 4
- ✅ Deduplication when selectedSite == ipLocation — Task 4, `sameAsIp` check
- ✅ `/api/cloud` server route, parallel Open-Meteo, 1h cache — Task 1
- ✅ Cloud cover fetched in HomeClient after auroraData loads — Task 3
- ✅ Cloud cover `☁ N%` in each SiteRow, color-coded — Task 2
- ✅ Loading state (undefined → `—`) — Task 2
- ✅ Failed state (null → nothing rendered) — Task 2, `typeof cloudPct === 'number'` guards

**Placeholder scan:** None found.

**Type consistency:**
- `cloudKey(lat, lon)` helper in Sidebar uses `toFixed(2)` — matches `pts.push(lat.toFixed(2), lon.toFixed(2))` in HomeClient ✅
- `pinPoints` / `pinLabels` types defined inline and used consistently ✅
- `cloudCover: Record<string, number | null>` flows from route → HomeClient state → Sidebar prop ✅
