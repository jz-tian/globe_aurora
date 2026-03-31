# Aurora Globe — Design Spec
**Date:** 2026-03-31  
**Status:** Approved

---

## 1. Overview

A real-time aurora intensity visualization website. A photorealistic 3D Earth sits centered on a dark space background. Users can drag to rotate and scroll to zoom. Aurora borealis and australis are rendered as animated volumetric shader effects, positioned and scaled by live NOAA forecast data. A sidebar lists the top 10 current viewing locations worldwide.

---

## 2. Architecture

### Stack
- **Framework:** Next.js 14 App Router (TypeScript)
- **Globe rendering:** `react-globe.gl` (Three.js-backed, MIT license)
- **Styling:** Tailwind CSS (layout only; visual effects via Three.js/GLSL)
- **Deployment:** Vercel free tier

### Data Flow
```
NOAA Ovation Prime API (free, no API key, updates every 30 min)
  └─ GET https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
        ↓
  Next.js API Route: /api/aurora
  (server-side fetch + in-memory cache, TTL 30 min)
        ↓
  React client fetches /api/aurora on mount + every 30 min
        ↓
  Globe component receives aurora data array: [lon, lat, intensity]
        ↓
  1. Globe.gl heatmapsData layer → geographic accuracy overlay
  2. Aurora ShaderMaterial uIntensityMap uniform → visual shader effect
  3. Top 10 computation → Sidebar component
```

### Caching Strategy
In-memory `Map` in the API route module scope:
```ts
{ data: AuroraPoint[], fetchedAt: number }
```
TTL = 30 minutes. Vercel cold starts invalidate cache, triggering a fresh NOAA fetch — acceptable since NOAA updates on the same 30-min cadence.

---

## 3. NOAA Data

**Endpoint:** `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`  
**Format:** JSON with a `coordinates` array of `[longitude, latitude, aurora_intensity]` tuples.  
**Coverage:** Global, ~1° longitude resolution, both hemispheres.  
**Intensity range:** 0–100 (arbitrary units, higher = stronger aurora).  
**Auth:** None required. CORS-restricted (must be fetched server-side).

Top 10 calculation: sort all points by intensity descending, take top 10, reverse-geocode to nearest named location from a bundled list of ~500 high-latitude cities/towns (static JSON, no external API needed).

---

## 4. Globe Rendering

### Base Earth
- Texture: NASA Blue Marble Next Generation (`world.200408.3x21600x10800.jpg` or lower-res 5400×2700 for performance), served from `/public/textures/`.
- Bump map: NASA elevation map for surface relief.
- Specular map: ocean highlights.

### Layer Stack (bottom to top)
1. **Earth mesh** — Globe.gl default with NASA textures
2. **Day/Night terminator** — transparent `THREE.Mesh` sphere at Earth radius, `ShaderMaterial` that calculates sun position from current UTC, darkens the night hemisphere with `rgba(0, 10, 30, 0.55)` blue-black
3. **Aurora data heatmap** — Globe.gl `heatmapsData` API, renders geographic NOAA grid as a color-mapped overlay (green→cyan→white), low opacity (0.4), for data accuracy
4. **Aurora volumetric shader** — separate `THREE.Mesh` transparent sphere at 1.02× Earth radius, custom GLSL `ShaderMaterial`, `THREE.AdditiveBlending`, for visual realism and animation

### Aurora Shader Approach
Base: CC0 volumetric raymarching shader (Godot community port of nimitz `XtGGRt` algorithm), ported to GLSL ES 300 / Three.js `ShaderMaterial`.

Key uniforms:
- `uTime: float` — updated every frame via `requestAnimationFrame`
- `uIntensityScale: float` — 0.0–1.0, driven by current global max aurora intensity from NOAA data
- `uNorthActive: float` — 0.0–1.0, northern hemisphere aurora strength
- `uSouthActive: float` — 0.0–1.0, southern hemisphere aurora strength

Geographic clamping in fragment shader: aurora visible only when `abs(lat) > 45°`, with soft falloff between 45°–60° latitude. Computed from world-space vertex normal.

Aurora color ramp:
```
Intensity 0–20%:  transparent
Intensity 20–50%: #00ff88 (green), low opacity
Intensity 50–80%: #00ffcc (cyan-green), medium opacity
Intensity 80–100%: #aaffee → white core with cyan glow
```

Animation: `uTime` drives `triNoise2d`-style noise UV scrolling at ~0.15 speed, plus a pulsing `sin(uTime * 0.8)` amplitude modulation — gives the characteristic aurora "curtain breathing" effect at ~2–3 second period.

### Day/Night Terminator
Sun position computed from UTC timestamp using standard astronomical formulas (ecliptic longitude → right ascension/declination → hour angle). Applied each frame. Accuracy: ±1° (sufficient for visual purposes).

### Kp Index
Fetched from NOAA's planetary K-index endpoint (also proxied via `/api/aurora` response, bundled alongside the Ovation data to avoid a second client request):
`https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`  
Returns array of `[timestamp, Kp]` pairs; take the most recent value.

---

## 5. UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Header] Aurora Live  ·  Kp: 4.2  ·  Updated 14:30 UTC │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │           Globe (centered, ~70vh)            │
│ 280px    │                                              │
│          │                                              │
│ Top 10   │                                              │
│ Viewing  │                                              │
│ Spots    │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Header (top bar, ~48px)
- Left: site name "Aurora Live" in monospace/tech font
- Center: current Kp index badge (color-coded: green <3, yellow 3–5, red >5)
- Right: "Data updated HH:MM UTC" timestamp

### Sidebar
- Background: `rgba(0, 0, 0, 0.6)` + `backdrop-filter: blur(12px)`
- Border-right: `1px solid rgba(255,255,255,0.08)`
- Title: "Best Viewing Now"
- List: 10 items, each showing:
  - Location name (city/region)
  - Hemisphere indicator (N/S)
  - Intensity bar (0–100, colored green→cyan→white)
  - Numeric intensity value
- Click: globe smoothly rotates (`globe.pointOfView({ lat, lng, altitude }, 1500ms)`) to center that location
- Hover: subtle highlight

### Globe interaction
- Drag: rotate (Globe.gl default)
- Scroll: zoom in/out (Globe.gl default)
- Hover on globe surface: tooltip showing lat/lng + aurora intensity at that point
- Double-click: zoom to that location

### Background
- Full-screen `THREE.Points` star field: ~2000 stars, random unit sphere distribution projected at large radius, white with slight blue tint, varying size 0.5–2px.

---

## 6. Component Structure

```
app/
├── page.tsx                    # Root page, fetches aurora data
├── api/
│   └── aurora/
│       └── route.ts            # NOAA proxy + cache
components/
├── GlobeScene.tsx              # react-globe.gl wrapper, injects Three.js layers
├── AuroraShader.ts             # GLSL shader strings + THREE.ShaderMaterial factory
├── DayNightShader.ts           # Day/night terminator ShaderMaterial factory
├── StarField.ts                # THREE.Points star background factory
├── Sidebar.tsx                 # Top 10 list, click handlers
├── Header.tsx                  # Kp index, timestamp
└── utils/
    ├── noaa.ts                 # NOAA data fetch + type definitions
    ├── topSites.ts             # Top 10 computation + reverse geocode lookup
    └── sunPosition.ts          # Sun lat/lng from UTC timestamp
public/
├── textures/
│   ├── earth_day.jpg           # NASA Blue Marble
│   ├── earth_bump.jpg          # Elevation bump map
│   └── earth_spec.jpg          # Specular map
└── data/
    └── cities.json             # ~500 high-latitude named locations for reverse geocode
```

---

## 7. Performance

- NASA texture: serve 5400×2700 JPG (~4MB), lazy-loaded. Consider WebP conversion.
- Aurora shader: 50 raymarch steps is heavy on mobile. Add `uQuality` uniform: desktop = 50 steps, mobile (`window.devicePixelRatio < 2` or touch device) = 20 steps.
- NOAA data: ~180KB JSON. Parsed once on server, cached 30 min.
- Globe.gl renders at 60fps by default. Star field and aurora shader add ~2ms/frame on modern GPU.

---

## 8. Out of Scope (for v1)

- Cloud layer (planned for v2, NOAA satellite tiles available)
- User accounts / saved locations
- Historical aurora data / charts
- Mobile-optimized layout
- Push notifications for aurora alerts
