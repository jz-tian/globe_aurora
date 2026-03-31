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
