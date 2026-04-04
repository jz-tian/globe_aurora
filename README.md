# Aurora

A real-time aurora borealis tracker with an interactive 3D globe. Live at **[globe-aurora-live.vercel.app](https://globe-aurora-live.vercel.app)**.

> **Demo below is recorded in mock mode** (Kp 8.3), simulating an exceptionally strong geomagnetic storm. Real-world aurora activity is typically much quieter.

![Aurora demo](public/demo2.gif)

---

## Features

### Globe
- Interactive 3D Earth rendered with Three.js — rotate, zoom, drag
- Custom GLSL aurora shader at 1.15× globe radius, animated in real time
- Day/night terminator overlay calculated from the actual sun position
- Procedural star field
- Auto-rotation when idle; pauses when the tab is hidden to save GPU

### Sidebar
- IP geolocation on load — detects your city and pans the globe to your location
- **Top 10 aurora viewing sites** — ranked by real-time OVATION intensity, mapped to the nearest named city
- **Visibility forecast** for your latitude based on NOAA's Kp oval model (Visible / Possibly Visible / Unlikely)
- **Cloud cover** for each site fetched from Open-Meteo, updated hourly
- **48-hour Kp forecast sparkline** with observed vs. predicted data, storm threshold marker, and upcoming peak callout

### Data
- Aurora oval: [NOAA SWPC OVATION](https://www.swpc.noaa.gov/) — refreshed every 30 minutes with stale-while-revalidate caching
- Kp index & forecast: NOAA SWPC planetary K-index — refreshed hourly
- Cloud cover: [Open-Meteo](https://open-meteo.com/) — refreshed hourly

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19 |
| 3D / WebGL | Three.js, react-globe.gl |
| Aurora shader | Custom GLSL (vertex + fragment) |
| Styling | Tailwind CSS v4 |
| Data sources | NOAA SWPC, Open-Meteo |
| Deployment | Vercel |

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To simulate strong aurora activity (useful for development):

```
http://localhost:3000/?mock=1
```
