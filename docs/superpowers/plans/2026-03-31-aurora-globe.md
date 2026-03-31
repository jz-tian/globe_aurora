# Aurora Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time aurora intensity visualization website with a photorealistic 3D globe, animated volumetric aurora shaders driven by live NOAA data, and a top-10 viewing locations sidebar.

**Architecture:** Next.js 14 App Router with `react-globe.gl` for the Three.js globe. A `/api/aurora` route proxies and caches NOAA Ovation Prime + Kp data (30-min TTL). Custom Three.js ShaderMaterial spheres for aurora (additive blending) and day/night (multiplicative dark overlay) are injected into the Globe.gl scene via `onGlobeReady`.

**Tech Stack:** Next.js 14, TypeScript, react-globe.gl, Three.js, Tailwind CSS, Jest, Vercel

---

## File Map

| File | Responsibility |
|------|----------------|
| `app/layout.tsx` | Root HTML, black background, fonts |
| `app/globals.css` | Reset, fullscreen canvas styles |
| `app/page.tsx` | Data fetching, layout, passes props |
| `app/api/aurora/route.ts` | NOAA proxy + in-memory cache |
| `components/GlobeScene.tsx` | react-globe.gl wrapper, injects Three.js layers |
| `components/AuroraShader.ts` | GLSL strings + ShaderMaterial factory for aurora |
| `components/DayNightShader.ts` | GLSL strings + ShaderMaterial factory for terminator |
| `components/StarField.ts` | THREE.Points star background factory |
| `components/Header.tsx` | Site name, Kp badge, update timestamp |
| `components/Sidebar.tsx` | Top-10 list, click-to-navigate |
| `components/utils/noaa.ts` | Types + NOAA fetch functions |
| `components/utils/topSites.ts` | Top-10 computation + nearest-city lookup |
| `components/utils/sunPosition.ts` | Sun direction vector from UTC date |
| `public/data/cities.json` | ~70 high-latitude named cities |
| `public/textures/` | NASA earth_day.jpg, earth_bump.jpg, earth_spec.jpg |
| `__tests__/utils/noaa.test.ts` | Unit tests for NOAA parsing |
| `__tests__/utils/topSites.test.ts` | Unit tests for top-10 logic |
| `__tests__/utils/sunPosition.test.ts` | Unit tests for sun position |

---

## Task 1: Project Setup

**Files:**
- Create: `package.json` (via next CLI)
- Create: `tailwind.config.ts`
- Create: `tsconfig.json` (auto-generated)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js project**

Run from `/Users/jiazheng/idol/claude_projects/globe_aurora`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --yes
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-globe.gl three
npm install --save-dev @types/three jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

- [ ] **Step 3: Create `jest.config.ts`**

```ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default createJestConfig(config);
```

- [ ] **Step 4: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Add test script to `package.json`**

Add to the `scripts` section:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Create texture and data directories**

```bash
mkdir -p public/textures public/data
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

## Task 2: NOAA Types & Utility

**Files:**
- Create: `components/utils/noaa.ts`
- Create: `__tests__/utils/noaa.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/utils/noaa.test.ts`:
```ts
import { fetchAuroraData } from '@/components/utils/noaa';

global.fetch = jest.fn();

describe('fetchAuroraData', () => {
  beforeEach(() => jest.resetAllMocks());

  it('filters out zero-intensity points and parses coordinates', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          coordinates: [[-180, 65, 0], [10, 70, 45], [20, 72, 80]],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => [
          ['time_tag', 'Kp'],
          ['2024-01-01 00:00:00', '3.33'],
        ],
      });

    const result = await fetchAuroraData();

    expect(result.coordinates).toHaveLength(2);
    expect(result.coordinates[0]).toEqual({ lon: 10, lat: 70, intensity: 45 });
    expect(result.coordinates[1]).toEqual({ lon: 20, lat: 72, intensity: 80 });
  });

  it('parses Kp from the last row of kp response', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({
        json: async () => [
          ['time_tag', 'Kp'],
          ['2024-01-01 00:00:00', '1.00'],
          ['2024-01-01 00:03:00', '4.67'],
        ],
      });

    const result = await fetchAuroraData();
    expect(result.kp).toBeCloseTo(4.67);
  });

  it('returns kp=0 when kp data has only a header row', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({ json: async () => [['time_tag', 'Kp']] });

    const result = await fetchAuroraData();
    expect(result.kp).toBe(0);
  });

  it('includes fetchedAt timestamp', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({ json: async () => [['time_tag', 'Kp']] });

    const before = Date.now();
    const result = await fetchAuroraData();
    const after = Date.now();

    expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAt).toBeLessThanOrEqual(after);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/utils/noaa.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/components/utils/noaa'`

- [ ] **Step 3: Create `components/utils/noaa.ts`**

```bash
mkdir -p components/utils
```

```ts
export interface AuroraPoint {
  lon: number;
  lat: number;
  intensity: number; // 0–100
}

export interface AuroraApiResponse {
  coordinates: AuroraPoint[];
  kp: number;
  fetchedAt: number; // Unix ms
}

const OVATION_URL =
  'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const KP_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export async function fetchAuroraData(): Promise<AuroraApiResponse> {
  const [auroraRes, kpRes] = await Promise.all([
    fetch(OVATION_URL, { cache: 'no-store' }),
    fetch(KP_URL, { cache: 'no-store' }),
  ]);

  const auroraJson = await auroraRes.json();
  const kpJson = (await kpRes.json()) as string[][];

  const coordinates: AuroraPoint[] = (
    auroraJson.coordinates as [number, number, number][]
  )
    .filter(([, , intensity]) => intensity > 0)
    .map(([lon, lat, intensity]) => ({ lon, lat, intensity }));

  // First row is header; last data row has the most recent Kp
  const kpRows = kpJson.slice(1);
  const latestKpStr = kpRows[kpRows.length - 1]?.[1] ?? '';
  const kp = parseFloat(latestKpStr);

  return {
    coordinates,
    kp: isNaN(kp) ? 0 : kp,
    fetchedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/utils/noaa.test.ts --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/utils/noaa.ts __tests__/utils/noaa.test.ts
git commit -m "feat: NOAA aurora + Kp data fetch utility"
```

---

## Task 3: Sun Position Utility

**Files:**
- Create: `components/utils/sunPosition.ts`
- Create: `__tests__/utils/sunPosition.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/utils/sunPosition.test.ts`:
```ts
import { getSunDirection, getSunSubsolarPoint } from '@/components/utils/sunPosition';

describe('getSunDirection', () => {
  it('returns a unit vector', () => {
    const dir = getSunDirection(new Date('2024-06-21T12:00:00Z'));
    const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    expect(length).toBeCloseTo(1.0, 3);
  });

  it('sun declination is ~+23.5° at northern summer solstice', () => {
    const { lat } = getSunSubsolarPoint(new Date('2024-06-21T12:00:00Z'));
    expect(Math.abs(lat - 23.5)).toBeLessThan(1.5);
  });

  it('sun declination is ~-23.5° at northern winter solstice', () => {
    const { lat } = getSunSubsolarPoint(new Date('2024-12-21T12:00:00Z'));
    expect(Math.abs(lat - (-23.5))).toBeLessThan(1.5);
  });

  it('sun subsolar longitude differs by ~180° between noon and midnight UTC', () => {
    const { lon: lonNoon } = getSunSubsolarPoint(new Date('2024-03-20T12:00:00Z'));
    const { lon: lonMidnight } = getSunSubsolarPoint(new Date('2024-03-20T00:00:00Z'));
    const diff = Math.abs(lonNoon - lonMidnight);
    // Should be close to 180°, allow ±20° for approximation
    expect(diff).toBeGreaterThan(160);
    expect(diff).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/utils/sunPosition.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/components/utils/sunPosition'`

- [ ] **Step 3: Create `components/utils/sunPosition.ts`**

```ts
/**
 * Returns the sun's direction as a unit vector in Globe.gl model space.
 *
 * Globe.gl coordinate system (Three.js Y-up):
 *   Y-axis = north pole
 *   X-axis = prime meridian (lon=0) at equator
 *   Z-axis = lon=90°E at equator
 *
 * Accuracy: ±1° — sufficient for day/night visualization.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function getSunDirection(date: Date): Vec3 {
  const msPerDay = 86_400_000;
  // Days since J2000.0 (2000-01-01 12:00 UTC)
  const d = date.getTime() / msPerDay - 10957.5;

  // Mean longitude and anomaly (degrees → radians)
  const L = ((280.46 + 0.9856474 * d) % 360 + 360) % 360;
  const gDeg = ((357.528 + 0.9856003 * d) % 360 + 360) % 360;
  const g = gDeg * (Math.PI / 180);

  // Ecliptic longitude (radians)
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);

  // Obliquity of the ecliptic
  const epsilon = 23.439 * (Math.PI / 180);

  // Sun direction in ECI (Earth-centered inertial) frame
  const xEci = Math.cos(lambda);
  const yEci = Math.sin(lambda) * Math.cos(epsilon);
  const zEci = Math.sin(lambda) * Math.sin(epsilon);

  // Greenwich Mean Sidereal Time (degrees → radians)
  const gmstDeg = ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
  const gmst = gmstDeg * (Math.PI / 180);

  // ECI → ECEF: rotate about Z (Earth spin axis) by GMST
  const xEcef = xEci * Math.cos(gmst) + yEci * Math.sin(gmst);
  const yEcef = -xEci * Math.sin(gmst) + yEci * Math.cos(gmst);
  const zEcef = zEci;

  // ECEF → Globe.gl model space
  // ECEF: X=lon0 equator, Y=lon90E equator, Z=north pole
  // Globe.gl: X=lon0 equator, Y=north pole, Z=lon90E equator
  const x = xEcef;
  const y = zEcef; // ECEF Z (polar) → Globe.gl Y (up)
  const z = yEcef; // ECEF Y (lon90E) → Globe.gl Z

  // Normalize
  const len = Math.sqrt(x * x + y * y + z * z);
  return { x: x / len, y: y / len, z: z / len };
}

/** Sub-solar point in lat/lon degrees. Useful for debugging. */
export function getSunSubsolarPoint(date: Date): { lat: number; lon: number } {
  const { x, y, z } = getSunDirection(date);
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
  const lon = Math.atan2(z, x) * (180 / Math.PI);
  return { lat, lon };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/utils/sunPosition.test.ts --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/utils/sunPosition.ts __tests__/utils/sunPosition.test.ts
git commit -m "feat: sun position utility for day/night terminator"
```

---

## Task 4: Cities Data + Top Sites Utility

**Files:**
- Create: `public/data/cities.json`
- Create: `components/utils/topSites.ts`
- Create: `__tests__/utils/topSites.test.ts`

- [ ] **Step 1: Create `public/data/cities.json`**

```json
[
  {"name":"Tromsø","country":"Norway","lat":69.6,"lon":18.9},
  {"name":"Abisko","country":"Sweden","lat":68.3,"lon":18.8},
  {"name":"Kiruna","country":"Sweden","lat":67.9,"lon":20.2},
  {"name":"Luleå","country":"Sweden","lat":65.6,"lon":22.2},
  {"name":"Rovaniemi","country":"Finland","lat":66.5,"lon":25.7},
  {"name":"Sodankylä","country":"Finland","lat":67.4,"lon":26.6},
  {"name":"Ivalo","country":"Finland","lat":68.7,"lon":27.5},
  {"name":"Inari","country":"Finland","lat":68.9,"lon":27.0},
  {"name":"Oulu","country":"Finland","lat":65.0,"lon":25.5},
  {"name":"Murmansk","country":"Russia","lat":68.9,"lon":33.1},
  {"name":"Arkhangelsk","country":"Russia","lat":64.5,"lon":40.8},
  {"name":"Norilsk","country":"Russia","lat":69.3,"lon":88.2},
  {"name":"Yakutsk","country":"Russia","lat":62.0,"lon":129.7},
  {"name":"Magadan","country":"Russia","lat":59.6,"lon":150.8},
  {"name":"Reykjavik","country":"Iceland","lat":64.1,"lon":-21.9},
  {"name":"Akureyri","country":"Iceland","lat":65.7,"lon":-18.1},
  {"name":"Longyearbyen","country":"Norway","lat":78.2,"lon":15.6},
  {"name":"Alta","country":"Norway","lat":70.0,"lon":23.3},
  {"name":"Hammerfest","country":"Norway","lat":70.7,"lon":23.7},
  {"name":"Narvik","country":"Norway","lat":68.4,"lon":17.4},
  {"name":"Bodø","country":"Norway","lat":67.3,"lon":14.4},
  {"name":"Lofoten Islands","country":"Norway","lat":68.1,"lon":13.6},
  {"name":"Oslo","country":"Norway","lat":59.9,"lon":10.8},
  {"name":"Stockholm","country":"Sweden","lat":59.3,"lon":18.1},
  {"name":"Helsinki","country":"Finland","lat":60.2,"lon":24.9},
  {"name":"Tallinn","country":"Estonia","lat":59.4,"lon":24.7},
  {"name":"Saint Petersburg","country":"Russia","lat":59.9,"lon":30.3},
  {"name":"Lerwick","country":"UK","lat":60.2,"lon":-1.1},
  {"name":"Inverness","country":"UK","lat":57.5,"lon":-4.2},
  {"name":"Aberdeen","country":"UK","lat":57.1,"lon":-2.1},
  {"name":"Fairbanks","country":"USA","lat":64.8,"lon":-147.7},
  {"name":"Barrow (Utqiaġvik)","country":"USA","lat":71.3,"lon":-156.8},
  {"name":"Nome","country":"USA","lat":64.5,"lon":-165.4},
  {"name":"Anchorage","country":"USA","lat":61.2,"lon":-149.9},
  {"name":"Juneau","country":"USA","lat":58.3,"lon":-134.4},
  {"name":"Yellowknife","country":"Canada","lat":62.4,"lon":-114.4},
  {"name":"Whitehorse","country":"Canada","lat":60.7,"lon":-135.1},
  {"name":"Churchill","country":"Canada","lat":58.7,"lon":-94.2},
  {"name":"Iqaluit","country":"Canada","lat":63.7,"lon":-68.5},
  {"name":"Alert","country":"Canada","lat":82.5,"lon":-62.3},
  {"name":"Edmonton","country":"Canada","lat":53.5,"lon":-113.5},
  {"name":"Saskatoon","country":"Canada","lat":52.1,"lon":-106.7},
  {"name":"Winnipeg","country":"Canada","lat":49.9,"lon":-97.1},
  {"name":"Nuuk","country":"Greenland","lat":64.2,"lon":-51.7},
  {"name":"Ilulissat","country":"Greenland","lat":69.2,"lon":-51.1},
  {"name":"Qaanaaq","country":"Greenland","lat":77.5,"lon":-69.2},
  {"name":"Ushuaia","country":"Argentina","lat":-54.8,"lon":-68.3},
  {"name":"Punta Arenas","country":"Chile","lat":-53.1,"lon":-70.9},
  {"name":"Puerto Williams","country":"Chile","lat":-54.9,"lon":-67.6},
  {"name":"Stanley","country":"Falkland Islands","lat":-51.7,"lon":-57.9},
  {"name":"Hobart","country":"Australia","lat":-42.9,"lon":147.3},
  {"name":"Macquarie Island","country":"Australia","lat":-54.6,"lon":158.9},
  {"name":"Dunedin","country":"New Zealand","lat":-45.9,"lon":170.5},
  {"name":"Invercargill","country":"New Zealand","lat":-46.4,"lon":168.4},
  {"name":"Queenstown","country":"New Zealand","lat":-45.0,"lon":168.7},
  {"name":"Stewart Island","country":"New Zealand","lat":-47.0,"lon":167.8},
  {"name":"South Georgia","country":"UK Territory","lat":-54.3,"lon":-36.5},
  {"name":"Marion Island","country":"South Africa","lat":-46.9,"lon":37.8},
  {"name":"Kerguelen Islands","country":"France","lat":-49.4,"lon":70.2},
  {"name":"Heard Island","country":"Australia","lat":-53.1,"lon":73.5},
  {"name":"Campbell Island","country":"New Zealand","lat":-52.5,"lon":169.2},
  {"name":"Tromsø","country":"Norway","lat":69.6,"lon":18.9},
  {"name":"Dawson City","country":"Canada","lat":64.1,"lon":-139.4},
  {"name":"Watson Lake","country":"Canada","lat":60.1,"lon":-128.7},
  {"name":"Tromso Region","country":"Norway","lat":70.0,"lon":20.0},
  {"name":"North Cape","country":"Norway","lat":71.2,"lon":25.8},
  {"name":"Vadsø","country":"Norway","lat":70.1,"lon":29.8},
  {"name":"Chena Hot Springs","country":"USA","lat":65.1,"lon":-146.1},
  {"name":"Coldfoot","country":"USA","lat":67.3,"lon":-150.2},
  {"name":"Deadhorse","country":"USA","lat":70.2,"lon":-148.5}
]
```

- [ ] **Step 2: Write failing tests for topSites**

Create `__tests__/utils/topSites.test.ts`:
```ts
import { computeTopSites } from '@/components/utils/topSites';
import type { AuroraPoint } from '@/components/utils/noaa';

jest.mock('@/public/data/cities.json', () => [
  { name: 'Tromsø', country: 'Norway', lat: 69.6, lon: 18.9 },
  { name: 'Fairbanks', country: 'USA', lat: 64.8, lon: -147.7 },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1, lon: -21.9 },
  { name: 'Ushuaia', country: 'Argentina', lat: -54.8, lon: -68.3 },
]);

describe('computeTopSites', () => {
  it('returns results sorted by intensity descending', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: -147.7, lat: 64.8, intensity: 60 },
      { lon: -21.9, lat: 64.1, intensity: 40 },
    ];
    const result = computeTopSites(coords, 3);
    expect(result[0].intensity).toBe(80);
    expect(result[1].intensity).toBe(60);
    expect(result[2].intensity).toBe(40);
  });

  it('respects n limit', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: -147.7, lat: 64.8, intensity: 60 },
      { lon: -21.9, lat: 64.1, intensity: 40 },
    ];
    const result = computeTopSites(coords, 2);
    expect(result).toHaveLength(2);
  });

  it('deduplicates by nearest city — two nearby points map to same city', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: 18.5, lat: 69.4, intensity: 75 }, // also nearest to Tromsø
      { lon: -147.7, lat: 64.8, intensity: 60 },
    ];
    const result = computeTopSites(coords, 10);
    const names = result.map(s => s.city.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tags northern hemisphere correctly', () => {
    const coords: AuroraPoint[] = [{ lon: 18.9, lat: 69.6, intensity: 80 }];
    const result = computeTopSites(coords, 10);
    expect(result[0].hemisphere).toBe('N');
  });

  it('tags southern hemisphere correctly', () => {
    const coords: AuroraPoint[] = [{ lon: -68.3, lat: -54.8, intensity: 70 }];
    const result = computeTopSites(coords, 10);
    expect(result[0].hemisphere).toBe('S');
  });

  it('returns empty array for empty input', () => {
    expect(computeTopSites([], 10)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest __tests__/utils/topSites.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/components/utils/topSites'`

- [ ] **Step 4: Create `components/utils/topSites.ts`**

```ts
import type { AuroraPoint } from './noaa';
import citiesRaw from '@/public/data/cities.json';

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface TopSite {
  city: City;
  intensity: number;
  hemisphere: 'N' | 'S';
}

const cities = citiesRaw as City[];

function nearestCity(lat: number, lon: number): City {
  let best = cities[0];
  let bestDist = Infinity;
  for (const city of cities) {
    const dist = (city.lat - lat) ** 2 + (city.lon - lon) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = city;
    }
  }
  return best;
}

export function computeTopSites(coordinates: AuroraPoint[], n = 10): TopSite[] {
  const sorted = [...coordinates].sort((a, b) => b.intensity - a.intensity);
  const results: TopSite[] = [];
  const used = new Set<string>();

  for (const point of sorted) {
    if (results.length >= n) break;
    const city = nearestCity(point.lat, point.lon);
    const key = `${city.name}::${city.country}`;
    if (used.has(key)) continue;
    used.add(key);
    results.push({
      city,
      intensity: point.intensity,
      hemisphere: point.lat >= 0 ? 'N' : 'S',
    });
  }

  return results;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest __tests__/utils/topSites.test.ts --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add public/data/cities.json components/utils/topSites.ts __tests__/utils/topSites.test.ts
git commit -m "feat: cities data and top-10 aurora viewing sites utility"
```

---

## Task 5: API Route

**Files:**
- Create: `app/api/aurora/route.ts`

- [ ] **Step 1: Create `app/api/aurora/route.ts`**

```ts
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
```

- [ ] **Step 2: Verify route works manually (after server start in Task 14)**

We'll verify this with `curl` during Task 14. No automated test here — the unit tests for `fetchAuroraData` already cover the parsing logic.

- [ ] **Step 3: Commit**

```bash
git add app/api/aurora/route.ts
git commit -m "feat: /api/aurora route with 30-min in-memory cache"
```

---

## Task 6: Star Field

**Files:**
- Create: `components/StarField.ts`

- [ ] **Step 1: Create `components/StarField.ts`**

```ts
import * as THREE from 'three';

export function createStarField(): THREE.Points {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Uniform distribution on a sphere surface
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 900; // far behind the globe

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Slight blue-white tint, varying brightness
    const brightness = 0.6 + Math.random() * 0.4;
    colors[i * 3]     = brightness * 0.88; // R
    colors[i * 3 + 1] = brightness * 0.93; // G
    colors[i * 3 + 2] = brightness;        // B

    sizes[i] = Math.random() * 1.8 + 0.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
  });

  return new THREE.Points(geo, mat);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StarField.ts
git commit -m "feat: Three.js star field background"
```

---

## Task 7: Day/Night Shader

**Files:**
- Create: `components/DayNightShader.ts`

- [ ] **Step 1: Create `components/DayNightShader.ts`**

```ts
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vModelNormal;

  void main() {
    vModelNormal = normal; // model-space normal = unit direction from sphere center
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDirection;

  varying vec3 vModelNormal;

  void main() {
    vec3 n = normalize(vModelNormal);

    // Positive = day side, negative = night side
    float sunDot = dot(n, normalize(uSunDirection));

    // Soft terminator: transition over ~12° of arc
    float nightFactor = 1.0 - smoothstep(-0.07, 0.07, sunDot);

    // Night: deep blue-black atmosphere
    vec3 nightColor = vec3(0.0, 0.03, 0.10);
    float alpha = nightFactor * 0.62;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(nightColor, alpha);
  }
`;

/**
 * Creates a transparent sphere mesh for the day/night terminator.
 * Add to the Globe.gl scene. Radius should equal the globe radius (100).
 * Update uniforms.uSunDirection.value each frame.
 */
export function createDayNightMesh(globeRadius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(globeRadius + 0.3, 64, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/DayNightShader.ts
git commit -m "feat: day/night terminator shader"
```

---

## Task 8: Aurora Shader

**Files:**
- Create: `components/AuroraShader.ts`

- [ ] **Step 1: Create `components/AuroraShader.ts`**

```ts
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vModelNormal;

  void main() {
    vModelNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Volumetric-style aurora fragment shader.
// Based on the CC0 Godot community port of nimitz's triNoise2d algorithm.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensityScale; // 0.0–1.0, global max from NOAA data / 100
  uniform float uNorthActive;    // 0.0–1.0, northern hemisphere strength
  uniform float uSouthActive;    // 0.0–1.0, southern hemisphere strength
  uniform int   uQuality;        // raymarch steps: 20 (mobile) or 50 (desktop)

  varying vec3 vModelNormal;

  // --- Noise ---
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      v += amp * smoothNoise(p * freq);
      freq *= 2.1;
      amp *= 0.45;
    }
    return v;
  }

  // --- Color ramp: green → cyan → near-white ---
  vec3 auroraColor(float t) {
    vec3 green = vec3(0.00, 1.00, 0.53);  // #00ff88
    vec3 cyan  = vec3(0.00, 1.00, 0.80);  // #00ffcc
    vec3 white = vec3(0.87, 1.00, 0.95);  // #defff3

    if (t < 0.5) {
      return mix(green, cyan, t * 2.0);
    } else {
      return mix(cyan, white, (t - 0.5) * 2.0);
    }
  }

  void main() {
    vec3 n = normalize(vModelNormal);

    // Latitude from Y component (Y = sin(lat) in Globe.gl model space)
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float absLat = abs(lat);

    // Only render in aurora zone
    if (absLat < 45.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Hemisphere activity
    float hemiStrength = (n.y > 0.0) ? uNorthActive : uSouthActive;
    if (hemiStrength < 0.01 || uIntensityScale < 0.01) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Latitude envelope: fade in 45–62°, fade out 78–88°
    float latMask = smoothstep(45.0, 62.0, absLat)
                  * (1.0 - smoothstep(78.0, 88.0, absLat));

    // UV from lon + lat band
    float lon = degrees(atan(n.z, n.x)); // -180 to 180
    vec2 baseUV = vec2(lon / 180.0, sign(n.y));

    float t = uTime;

    // Three noise layers at different scales and drift speeds
    vec2 uv1 = baseUV * vec2(2.5, 4.0) + vec2(t * 0.08,  t * 0.03);
    vec2 uv2 = baseUV * vec2(5.0, 8.0) + vec2(-t * 0.11, t * 0.05);
    vec2 uv3 = baseUV * vec2(1.2, 2.5) + vec2(t * 0.04, -t * 0.02);

    int q = uQuality;
    float n1 = fbm(uv1, q);
    float n2 = fbm(uv2, max(q / 2, 2));
    float n3 = smoothNoise(uv3);

    // Curtain: mainly n1/n2, n3 adds micro-detail
    float curtain = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
    curtain = smoothstep(0.30, 0.82, curtain);

    // Breathing pulse (~2–3 s period)
    float pulse = 0.72 + 0.28 * sin(t * 0.85 + n1 * 6.2832);
    curtain *= pulse;

    float intensity = curtain * uIntensityScale * hemiStrength * latMask;

    if (intensity < 0.018) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 color = auroraColor(intensity);
    // Additive brightness in bright cores
    color += color * intensity * 0.45;

    float alpha = clamp(intensity * 0.92, 0.0, 0.90);
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Creates the aurora shader mesh.
 * Place at globeRadius * 1.02 so it floats above the Earth surface.
 * Update uniforms each frame in an animation loop.
 */
export function createAuroraMesh(radius: number): THREE.Mesh {
  const isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.devicePixelRatio < 1.5);

  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:           { value: 0.0 },
      uIntensityScale: { value: 0.0 },
      uNorthActive:    { value: 0.0 },
      uSouthActive:    { value: 0.0 },
      uQuality:        { value: isMobile ? 20 : 50 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AuroraShader.ts
git commit -m "feat: volumetric aurora GLSL shader with pulsing animation"
```

---

## Task 9: Globe Scene Component

**Files:**
- Create: `components/GlobeScene.tsx`

- [ ] **Step 1: Create `components/GlobeScene.tsx`**

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { AuroraPoint } from './utils/noaa';
import { createAuroraMesh } from './AuroraShader';
import { createDayNightMesh } from './DayNightShader';
import { createStarField } from './StarField';
import { getSunDirection } from './utils/sunPosition';

const GLOBE_RADIUS = 100; // react-globe.gl default

interface Props {
  auroraData: AuroraPoint[];
  selectedSite: { lat: number; lon: number } | null;
}

export default function GlobeScene({ auroraData, selectedSite }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const auroraMeshRef = useRef<THREE.Mesh | null>(null);
  const dayNightMeshRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);

  // Derive aurora uniforms from data
  const intensities = auroraData.map(p => p.intensity);
  const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : 0;
  const northMax = auroraData
    .filter(p => p.lat > 0)
    .reduce((m, p) => Math.max(m, p.intensity), 0);
  const southMax = auroraData
    .filter(p => p.lat < 0)
    .reduce((m, p) => Math.max(m, p.intensity), 0);

  // Update aurora shader uniforms when data changes
  useEffect(() => {
    if (!auroraMeshRef.current) return;
    const uniforms = (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms;
    uniforms.uIntensityScale.value = maxIntensity / 100;
    uniforms.uNorthActive.value = northMax / 100;
    uniforms.uSouthActive.value = southMax / 100;
  }, [maxIntensity, northMax, southMax]);

  // Navigate to selected site
  useEffect(() => {
    if (!selectedSite || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: selectedSite.lat, lng: selectedSite.lon, altitude: 1.5 },
      1500
    );
  }, [selectedSite]);

  // Animation loop: update uTime and sun direction every frame
  const startAnimation = useCallback(() => {
    const tick = () => {
      const t = performance.now() / 1000;

      if (auroraMeshRef.current) {
        (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      }

      if (dayNightMeshRef.current) {
        const sunDir = getSunDirection(new Date());
        const uni = (dayNightMeshRef.current.material as THREE.ShaderMaterial).uniforms;
        uni.uSunDirection.value.set(sunDir.x, sunDir.y, sunDir.z);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const scene = globeRef.current.scene();

    // Star field (fixed in scene, doesn't orbit with camera)
    scene.add(createStarField());

    // Day/night overlay
    const dayNight = createDayNightMesh(GLOBE_RADIUS);
    scene.add(dayNight);
    dayNightMeshRef.current = dayNight;

    // Aurora shader sphere
    const aurora = createAuroraMesh(GLOBE_RADIUS * 1.02);
    scene.add(aurora);
    auroraMeshRef.current = aurora;

    // Set initial aurora uniforms if data already loaded
    if (maxIntensity > 0) {
      const uniforms = (aurora.material as THREE.ShaderMaterial).uniforms;
      uniforms.uIntensityScale.value = maxIntensity / 100;
      uniforms.uNorthActive.value = northMax / 100;
      uniforms.uSouthActive.value = southMax / 100;
    }

    startAnimation();
  }, [startAnimation, maxIntensity, northMax, southMax]);

  // Cleanup animation loop on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Heatmap data: weight = intensity normalized to 0–1
  const heatmapPoints = auroraData.map(p => ({
    lat: p.lat,
    lon: p.lon,
    weight: p.intensity / 100,
  }));

  return (
    <div className="flex-1 flex items-center justify-center">
      <Globe
        ref={globeRef}
        width={typeof window !== 'undefined' ? window.innerWidth - 280 : 1200}
        height={typeof window !== 'undefined' ? window.innerHeight - 48 : 800}
        globeImageUrl="/textures/earth_day.jpg"
        bumpImageUrl="/textures/earth_bump.jpg"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#1a4a8a"
        atmosphereAltitude={0.18}
        onGlobeReady={handleGlobeReady}
        // Aurora heatmap layer for geographic accuracy
        heatmapsData={[heatmapPoints]}
        heatmapPointLat="lat"
        heatmapPointLng="lon"
        heatmapPointWeight="weight"
        heatmapBandwidth={3.5}
        heatmapColorFn={(t: number) =>
          `rgba(0, ${Math.round(220 * t)}, ${Math.round(120 * t)}, ${t * 0.45})`
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/GlobeScene.tsx
git commit -m "feat: GlobeScene with aurora, day/night, and star field layers"
```

---

## Task 10: Header Component

**Files:**
- Create: `components/Header.tsx`

- [ ] **Step 1: Create `components/Header.tsx`**

```tsx
interface Props {
  kp: number | null;
  updatedAt: number | null; // Unix ms
}

function kpColor(kp: number): string {
  if (kp < 3) return '#22c55e';  // green
  if (kp < 5) return '#eab308';  // yellow
  return '#ef4444';              // red
}

function kpLabel(kp: number): string {
  if (kp < 2) return 'Quiet';
  if (kp < 4) return 'Unsettled';
  if (kp < 6) return 'Active';
  if (kp < 8) return 'Storm';
  return 'Severe';
}

export default function Header({ kp, updatedAt }: Props) {
  const timeStr = updatedAt
    ? new Date(updatedAt).toUTCString().slice(17, 22) + ' UTC'
    : '—';

  return (
    <header
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6"
      style={{
        height: 48,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Site name */}
      <span
        className="text-white font-mono tracking-widest text-sm"
        style={{ letterSpacing: '0.2em' }}
      >
        AURORA LIVE
      </span>

      {/* Kp badge */}
      {kp !== null ? (
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs font-mono">Kp INDEX</span>
          <span
            className="text-sm font-mono font-bold px-3 py-0.5 rounded"
            style={{
              color: kpColor(kp),
              background: `${kpColor(kp)}18`,
              border: `1px solid ${kpColor(kp)}44`,
            }}
          >
            {kp.toFixed(1)}
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ color: kpColor(kp), opacity: 0.7 }}
          >
            {kpLabel(kp)}
          </span>
        </div>
      ) : (
        <span className="text-white/20 text-xs font-mono">Loading…</span>
      )}

      {/* Timestamp */}
      <span className="text-white/30 text-xs font-mono">
        Updated {timeStr}
      </span>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Header.tsx
git commit -m "feat: header with Kp index badge and update timestamp"
```

---

## Task 11: Sidebar Component

**Files:**
- Create: `components/Sidebar.tsx`

- [ ] **Step 1: Create `components/Sidebar.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import type { AuroraPoint } from './utils/noaa';
import { computeTopSites, TopSite } from './utils/topSites';

interface Props {
  auroraData: AuroraPoint[];
  onSelectSite: (site: { lat: number; lon: number }) => void;
}

function intensityColor(intensity: number): string {
  if (intensity < 30) return '#00ff88';
  if (intensity < 65) return '#00ffcc';
  return '#aaffee';
}

function SiteRow({
  site,
  rank,
  onClick,
}: {
  site: TopSite;
  rank: number;
  onClick: () => void;
}) {
  const color = intensityColor(site.intensity);
  const barWidth = `${site.intensity}%`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-all duration-150 group"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background =
          'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Top line: rank + name */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-xs font-mono w-4 text-right flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          {rank}
        </span>
        <span
          className="text-xs font-mono truncate"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          {site.city.name}
        </span>
        <span
          className="text-xs ml-auto flex-shrink-0 font-mono"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {site.hemisphere}
        </span>
      </div>

      {/* Country */}
      <div
        className="text-xs font-mono mb-2 ml-6"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        {site.city.country}
      </div>

      {/* Intensity bar */}
      <div className="ml-6 flex items-center gap-2">
        <div
          className="flex-1 h-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: barWidth, background: color, boxShadow: `0 0 6px ${color}` }}
          />
        </div>
        <span
          className="text-xs font-mono w-6 text-right flex-shrink-0"
          style={{ color }}
        >
          {site.intensity}
        </span>
      </div>
    </button>
  );
}

export default function Sidebar({ auroraData, onSelectSite }: Props) {
  const topSites = useMemo(
    () => computeTopSites(auroraData, 10),
    [auroraData]
  );

  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width: 280,
        height: '100%',
        paddingTop: 48,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Section title */}
      <div
        className="px-4 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="text-xs font-mono tracking-widest uppercase"
          style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}
        >
          Best Viewing Now
        </span>
      </div>

      {/* Site list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {topSites.length === 0 ? (
          <div
            className="px-6 py-8 text-xs font-mono"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Loading aurora data…
          </div>
        ) : (
          topSites.map((site, i) => (
            <SiteRow
              key={`${site.city.name}-${site.city.country}`}
              site={site}
              rank={i + 1}
              onClick={() =>
                onSelectSite({ lat: site.city.lat, lon: site.city.lon })
              }
            />
          ))
        )}
      </div>

      {/* Footer note */}
      <div
        className="px-4 py-3 text-xs font-mono"
        style={{
          color: 'rgba(255,255,255,0.15)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        Source: NOAA SWPC · 30 min cadence
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: sidebar with top-10 aurora viewing sites"
```

---

## Task 12: Root Layout, Globals, and Page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `app/globals.css`**

Replace its entire contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

canvas {
  display: block;
}

/* Hide scrollbar in sidebar */
::-webkit-scrollbar { display: none; }
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Space_Mono } from 'next/font/google';
import './globals.css';

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Aurora Live',
  description: 'Real-time global aurora intensity visualization',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body style={{ fontFamily: 'var(--font-mono), monospace' }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `app/page.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import type { AuroraApiResponse } from '@/components/utils/noaa';

// Globe uses browser APIs — must be client-only
const GlobeScene = dynamic(() => import('@/components/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div
      className="flex-1 flex items-center justify-center font-mono text-xs"
      style={{ color: 'rgba(255,255,255,0.2)' }}
    >
      Initializing globe…
    </div>
  ),
});

export default function Home() {
  const [data, setData] = useState<AuroraApiResponse | null>(null);
  const [selectedSite, setSelectedSite] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/aurora');
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error('Failed to load aurora data:', e);
      }
    };

    load();
    const interval = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden">
      <Header kp={data?.kp ?? null} updatedAt={data?.fetchedAt ?? null} />
      <div className="flex w-full h-full">
        <Sidebar
          auroraData={data?.coordinates ?? []}
          onSelectSite={setSelectedSite}
        />
        <GlobeScene
          auroraData={data?.coordinates ?? []}
          selectedSite={selectedSite}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css app/page.tsx
git commit -m "feat: root layout, page, and global styles"
```

---

## Task 13: NASA Textures

**Files:**
- Download: `public/textures/earth_day.jpg`
- Download: `public/textures/earth_bump.jpg`
- Download: `public/textures/earth_spec.jpg`

- [ ] **Step 1: Download NASA Blue Marble texture**

NASA provides free-to-use Blue Marble imagery. Download via curl:
```bash
# Day texture (5400×2700, ~4MB) — NASA Blue Marble August
curl -L "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.200408.3x5400x2700.jpg" \
  -o public/textures/earth_day.jpg

# If the above is slow, use this mirror from NASA's visible earth:
# curl -L "https://visibleearth.nasa.gov/img/search/oe/73909/world.200408.3x5400x2700.jpg" \
#   -o public/textures/earth_day.jpg
```

- [ ] **Step 2: Download bump map**

```bash
curl -L "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png" \
  -o public/textures/earth_bump_full.png
```

If the full-res is too large, use this 5400×2700 bump map from Three.js examples:
```bash
curl -L "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg" \
  -o public/textures/earth_bump.jpg
```

- [ ] **Step 3: Download specular map**

```bash
curl -L "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg" \
  -o public/textures/earth_spec.jpg
```

- [ ] **Step 4: Add textures to `.gitignore` (they're large binary files)**

Add to `.gitignore`:
```
public/textures/
```

- [ ] **Step 5: Verify files exist**

```bash
ls -lh public/textures/
```
Expected: `earth_day.jpg`, `earth_bump.jpg`, `earth_spec.jpg` all present

- [ ] **Step 6: Update GlobeScene to use bump map**

In `components/GlobeScene.tsx`, the `bumpImageUrl` prop is already set to `/textures/earth_bump.jpg`. If the specular map is needed, you can apply it via a custom globe material using `globeMaterial` prop:

```tsx
// Add to imports in GlobeScene.tsx
import { useMemo } from 'react';

// Inside the component, before return:
const globeMaterial = useMemo(() => {
  const mat = new THREE.MeshPhongMaterial();
  mat.specularMap = new THREE.TextureLoader().load('/textures/earth_spec.jpg');
  mat.specular = new THREE.Color(0x2a2a2a);
  mat.shininess = 12;
  return mat;
}, []);

// Add prop to Globe component:
// globeMaterial={globeMaterial}
```

- [ ] **Step 7: Commit (source code only, not textures)**

```bash
git add .gitignore
git commit -m "chore: exclude large texture files from git"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all unit tests**

```bash
npx jest --no-coverage
```
Expected: all tests PASS (noaa: 4, sunPosition: 4, topSites: 6 = 14 total)

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```
Expected: server starts on `http://localhost:3000`

- [ ] **Step 3: Verify API route returns data**

```bash
curl http://localhost:3000/api/aurora | head -c 500
```
Expected: JSON with `coordinates`, `kp`, `fetchedAt` fields

- [ ] **Step 4: Open browser and verify**

Open `http://localhost:3000`. Confirm:
- [ ] Black background with star field visible
- [ ] Globe renders with NASA earth texture
- [ ] Day/night terminator visible (dark side of Earth)
- [ ] Aurora visible near poles (green/cyan glow)
- [ ] Sidebar shows Top-10 list with intensity bars
- [ ] Header shows Kp index badge
- [ ] Dragging the globe rotates it smoothly
- [ ] Clicking a sidebar entry rotates globe to that location
- [ ] Aurora visibly pulses/breathes over ~3-second period

- [ ] **Step 5: Fix `GlobeScene.tsx` globe dimensions to be responsive**

Replace the hardcoded `width`/`height` with a `ResizeObserver` approach in `components/GlobeScene.tsx`. Replace the `width` and `height` props section:

```tsx
// Add to imports
import { useEffect, useRef, useCallback, useState } from 'react';

// Add inside component, before return:
const containerRef = useRef<HTMLDivElement>(null);
const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

useEffect(() => {
  if (!containerRef.current) return;
  const observer = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    setDimensions({ width, height });
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);

// Replace the return div wrapper:
return (
  <div ref={containerRef} className="flex-1" style={{ height: '100%' }}>
    <Globe
      ref={globeRef}
      width={dimensions.width}
      height={dimensions.height}
      // ... rest of props unchanged
    />
  </div>
);
```

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: aurora globe MVP complete"
```

---

## Troubleshooting Notes

**Aurora not visible:** Check that NOAA data loaded (`/api/aurora` returns non-empty `coordinates`). The shader requires `uIntensityScale > 0.01`. If NOAA data is all zero intensity (solar minimum), the shader won't show — this is correct behavior.

**Globe texture appears black:** Verify texture files are in `public/textures/` and accessible at `http://localhost:3000/textures/earth_day.jpg`.

**Day/night terminator flickers:** The `uSunDirection` uniform updates every RAF tick. If Globe.gl's renderer pauses, uniforms still update but won't render until the next Globe.gl frame. This is acceptable.

**`react-globe.gl` SSR error:** Ensure `GlobeScene` is only imported via `dynamic(() => ..., { ssr: false })` in `page.tsx`. Never import it directly.

**NOAA 503 / CORS error in browser:** The NOAA fetch happens server-side in the API route. If you see CORS errors, you may have accidentally called NOAA directly from client code. Use `/api/aurora` only.

**Kp badge not updating:** The 30-minute client-side interval in `page.tsx` re-fetches. The server cache TTL matches. During development, clear the module cache by restarting the dev server.
