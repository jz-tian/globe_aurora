# Globe Pin & Cloud Cover Design

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Two features:
1. Show the user's IP location and the currently selected viewing site as visual pins on the 3D globe.
2. Show real-time cloud cover percentage next to each top-10 viewing site in the Sidebar, fetched from Open-Meteo (free, no API key).

---

## Feature 1: Globe Location Pins

### Visual Design

Two pin types, both using react-globe.gl's built-in `pointsData` and `labelsData` layers:

| Type | Color | Size | Label |
|------|-------|------|-------|
| User IP location | `#7dd3fc` (blue, matches `.loc-dot`) | r=0.4 | `City, CC` |
| Selected viewing site | `#3dffa0` (green, matches aurora theme) | r=0.35 | `City, CC` |

- Both pins display simultaneously when different locations.
- When `selectedSite` matches `ipLocation` (same lat/lon), only one pin is shown.
- Labels: mono font, `fontSize: 0.5`, `color: rgba(255,255,255,0.7)`, offset above dot.

### GlobeScene Changes

- Add `ipLocation: { lat: number; lon: number; city: string; country: string } | null` prop.
- Build `pointsData` array from both `ipLocation` and `selectedSite`, tagged with `type: 'ip' | 'selected'`.
- Build `labelsData` from same sources.
- Use `pointColor`, `pointRadius`, `labelColor`, `labelSize` accessor functions based on `type`.

### Data Flow

`HomeClient` already holds `ipLocation` state. Pass it down to `GlobeScene` as a new prop (currently `GlobeScene` only receives `selectedSite`).

---

## Feature 2: Cloud Cover

### API Route `/api/cloud`

- **Method:** GET
- **Query param:** `pts=lat,lon|lat,lon|...` (pipe-separated, max 15 points)
- **External API:** `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=cloud_cover&forecast_days=1`
- **Parallelism:** `Promise.all` over all points
- **Cache:** In-memory, TTL 1h, background refresh at 85% TTL (same pattern as `/api/forecast`)
- **Cache key:** sorted `pts` string
- **Response:** `Record<"lat,lon", number>` — e.g. `{ "68.3,18.6": 42, "64.1,-21.9": 88 }`
- **Error handling:** If a single point fails, return `null` for that key; return 503 only if all points fail

### HomeClient Changes

- Compute top sites from `auroraData` (already done in Sidebar, needs to be lifted or duplicated).
- After `auroraData` loads and `ipLocation` resolves, fire `fetchCloudCover(sites, ipLocation)`.
- Refresh every 1h via `setInterval`.
- New state: `cloudCover: Record<string, number | null>`.
- Pass `cloudCover` to `Sidebar`.

**Key:** use `"${lat.toFixed(2)},${lon.toFixed(2)}"` as consistent map key on both client and server.

### Sidebar Changes

- `SiteRow` accepts new optional prop `cloudPct: number | null | undefined`.
- Renders a small `☁ 72%` tag to the right of the intensity bar.
- Color rules:
  - `< 30%` → `#3dffa0` (clear sky, good for viewing)
  - `30–70%` → `rgba(255,255,255,0.38)` (partly cloudy, neutral)
  - `> 70%` → `rgba(255,255,255,0.18)` (overcast, dim)
- Loading state (`undefined`): show `—` in same position.
- Failed state (`null`): show nothing.

---

## Architecture Summary

```
HomeClient
  ├── fetchCloudCover() → /api/cloud → Open-Meteo (cached 1h)
  ├── cloudCover state → Sidebar → SiteRow (☁ %)
  └── ipLocation → GlobeScene (blue pin)

GlobeScene
  ├── pointsData: [ipLocation pin, selectedSite pin]
  └── labelsData: [ipLocation label, selectedSite label]
```

---

## Out of Scope

- Full globe cloud tile overlay (requires paid API)
- Push notifications
- Cloud cover for user's own location in the visibility card (can be added later using the same `cloudCover` map)
