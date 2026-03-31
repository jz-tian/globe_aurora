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
