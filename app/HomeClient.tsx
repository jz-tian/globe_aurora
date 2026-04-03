'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import type { AuroraApiResponse, AuroraPoint } from '@/components/utils/noaa';
import type { IpLocation } from '@/components/Sidebar';
import type { ForecastPoint } from '@/components/utils/kpForecast';
import { computeTopSites } from '@/components/utils/topSites';

async function fetchIpLocation(): Promise<IpLocation | null> {
  const timeout = 5000;

  // Primary: ipwho.is
  try {
    const res = await fetch('https://ipwho.is/', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.success && typeof d.latitude === 'number') {
        return { lat: d.latitude, lon: d.longitude, city: d.city || 'Unknown', country: d.country_code || '' };
      }
    }
  } catch (e) {
    console.warn('[aurora] ipwho.is failed:', e);
  }

  // Fallback: ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number') {
        return { lat: d.latitude, lon: d.longitude, city: d.city || 'Unknown', country: d.country_code || '' };
      }
    }
  } catch (e) {
    console.warn('[aurora] ipapi.co failed:', e);
  }

  return null;
}

function buildMockData(): AuroraApiResponse {
  const points: AuroraPoint[] = [];
  for (let lon = -180; lon < 180; lon += 3) {
    for (let lat = 60; lat <= 82; lat += 2) {
      const dist = Math.abs(lat - 70);
      const base = Math.max(0, 95 - dist * 4);
      points.push({ lon, lat, intensity: base + Math.random() * 5 });
    }
  }
  for (let lon = -180; lon < 180; lon += 3) {
    for (let lat = -75; lat <= -60; lat += 2) {
      const dist = Math.abs(lat + 68);
      const base = Math.max(0, 88 - dist * 5);
      points.push({ lon, lat, intensity: base + Math.random() * 5 });
    }
  }
  return { coordinates: points, kp: 8.3, fetchedAt: Date.now() };
}

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

export default function HomeClient({ isMock }: { isMock: boolean }) {
  const [data, setData] = useState<AuroraApiResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [ipLocation, setIpLocation] = useState<IpLocation | null>(null);
  const [selectedSite, setSelectedSite] = useState<{ lat: number; lon: number } | null>(null);
  const [cloudCover, setCloudCover] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let mounted = true;
    fetchIpLocation().then(loc => {
      if (!mounted || !loc) return;
      setIpLocation(loc);
      setSelectedSite({ lat: loc.lat, lon: loc.lon });
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isMock) {
      setData(buildMockData());
      return;
    }
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
  }, [isMock]);

  useEffect(() => {
    if (isMock) return;
    const loadForecast = async () => {
      try {
        const res = await fetch('/api/forecast');
        if (res.ok) setForecast(await res.json());
      } catch (e) {
        console.error('Failed to load forecast:', e);
      }
    };
    loadForecast();
    const interval = setInterval(loadForecast, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isMock]);

  useEffect(() => {
    if (isMock) return;
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
  }, [isMock, data, ipLocation]);

  return (
    <main className="relative w-screen h-screen overflow-hidden" style={{ background: '#02060d' }}>
      <Header kp={data?.kp ?? null} updatedAt={data?.fetchedAt ?? null} />
      <div className="flex w-full h-full">
        <Sidebar
          auroraData={data?.coordinates ?? []}
          onSelectSite={setSelectedSite}
          ipLocation={ipLocation}
          kp={data?.kp ?? null}
          forecast={forecast}
          cloudCover={cloudCover}
        />
        <GlobeScene
          auroraData={data?.coordinates ?? []}
          selectedSite={selectedSite}
          ipLocation={ipLocation}
        />
      </div>
    </main>
  );
}
