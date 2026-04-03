'use client';

import { useMemo, useCallback, memo, useState, useEffect } from 'react';
import type { AuroraPoint } from './utils/noaa';
import type { ForecastPoint } from './utils/kpForecast';
import { computeTopSites, TopSite } from './utils/topSites';
import { getVisibility } from './utils/visibility';
import ForecastSparkline from './ForecastSparkline';

export interface IpLocation {
  lat: number;
  lon: number;
  city: string;
  country: string;
}

interface Props {
  auroraData: AuroraPoint[];
  onSelectSite: (site: { lat: number; lon: number }) => void;
  ipLocation: IpLocation | null;
  kp: number | null;
  forecast: ForecastPoint[];
  cloudCover: Record<string, number | null>;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono), monospace' };

function intensityColor(v: number): string {
  if (v < 30) return '#3dffa0';
  if (v < 65) return '#00f0cc';
  return '#a0f8ef';
}

function cloudColor(pct: number): string {
  if (pct < 30) return '#4ade80';
  if (pct < 70) return 'rgba(255,255,255,0.45)';
  return 'rgba(255,255,255,0.22)';
}

function formatCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

const cloudKey = (lat: number, lon: number) =>
  `${lat.toFixed(2)},${lon.toFixed(2)}`;

// ── Divider ──────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ height: 1, background: 'rgba(255,255,255,0.055)', flexShrink: 0 }} />
);

// ── Visibility card ──────────────────────────────────────────────────
const VisibilityCard = memo(function VisibilityCard({
  loc,
  kp,
  cloudPct,
}: {
  loc: IpLocation;
  kp: number;
  cloudPct?: number | null;
}) {
  const info = getVisibility(loc.lat, kp);

  return (
    <div
      style={{
        padding: '16px 20px',
        background: `${info.color}09`,
        borderLeft: `3px solid ${info.color}`,
        flexShrink: 0,
      }}
    >
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            className={info.level === 'visible' ? 'live-dot' : 'loc-dot'}
            style={{ background: info.color }}
          />
          <span
            data-tip={info.sublabel}
            data-tip-align="left"
            style={{
              ...mono,
              fontSize: 11,
              letterSpacing: '0.2em',
              color: info.color,
              fontWeight: 500,
            }}
          >
            {info.label}
          </span>
        </div>
        {typeof cloudPct === 'number' && (
          <span
            data-tip={`Cloud cover at your location · ${cloudPct < 30 ? 'Clear skies' : cloudPct < 70 ? 'Partly cloudy' : 'Heavy cloud cover'}`}
            style={{
              ...mono,
              fontSize: 10,
              letterSpacing: '0.05em',
              color: cloudColor(cloudPct),
            }}
          >
            ☁ {cloudPct}%
          </span>
        )}
      </div>
      {/* Sublabel */}
      <div
        style={{
          ...mono,
          fontSize: 10,
          color: 'rgba(255,255,255,0.38)',
          letterSpacing: '0.04em',
          lineHeight: 1.55,
          paddingLeft: 20,
        }}
      >
        {info.sublabel}
      </div>
    </div>
  );
});

// ── IP location card ─────────────────────────────────────────────────
const IpLocationCard = memo(function IpLocationCard({
  loc,
  onClick,
}: {
  loc: IpLocation;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left"
      style={{
        display: 'block',
        padding: '14px 20px',
        background: 'rgba(125,211,252,0.04)',
        borderLeft: '3px solid rgba(125,211,252,0.45)',
        cursor: 'pointer',
        transition: 'background 150ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.04)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span className="loc-dot" />
        <span
          style={{
            ...mono,
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'rgba(125,211,252,0.55)',
            textTransform: 'uppercase',
          }}
        >
          Your Location
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 6 }}>
        <span
          style={{
            ...mono,
            fontSize: 17,
            color: '#7dd3fc',
            letterSpacing: '0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.15,
          }}
        >
          {loc.city}
        </span>
        {loc.country && (
          <span
            style={{
              ...mono,
              fontSize: 10,
              color: 'rgba(125,211,252,0.4)',
              letterSpacing: '0.14em',
            }}
          >
            {loc.country}
          </span>
        )}
      </div>

      <div
        style={{
          ...mono,
          fontSize: 10,
          color: 'rgba(125,211,252,0.32)',
          letterSpacing: '0.06em',
        }}
      >
        {formatCoord(loc.lat, loc.lon)}
      </div>
    </button>
  );
});

// ── Site row ─────────────────────────────────────────────────────────
const SiteRow = memo(function SiteRow({
  site,
  rank,
  displayIntensity,
  cloudPct,
  onSelect,
}: {
  site: TopSite;
  rank: number;
  displayIntensity: number;
  cloudPct?: number | null;
  onSelect: (coords: { lat: number; lon: number }) => void;
}) {
  const col = intensityColor(displayIntensity);

  return (
    <button
      onClick={() => onSelect({ lat: site.city.lat, lon: site.city.lon })}
      className="w-full text-left"
      style={{
        display: 'block',
        padding: '11px 20px 11px 17px',
        borderBottom: '1px solid rgba(255,255,255,0.038)',
        borderLeft: '3px solid transparent',
        background: 'transparent',
        transition: 'background 150ms, border-left-color 150ms',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.032)';
        el.style.borderLeftColor = `${col}70`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'transparent';
        el.style.borderLeftColor = 'transparent';
      }}
    >
      {/* Top row: rank · city · hemisphere dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
        <span
          style={{
            ...mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.22)',
            width: 16,
            textAlign: 'right',
            flexShrink: 0,
            letterSpacing: '0.04em',
          }}
        >
          {String(rank).padStart(2, '0')}
        </span>
        <span
          style={{
            ...mono,
            fontSize: 13,
            color: 'rgba(255,255,255,0.88)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}
        >
          {site.city.name}
        </span>
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: site.hemisphere === 'N'
              ? 'rgba(140,190,255,0.5)'
              : 'rgba(255,190,100,0.5)',
            flexShrink: 0,
          }}
          title={site.hemisphere === 'N' ? 'Northern' : 'Southern'}
        />
      </div>

      {/* Bottom row: country · bar · int · cloud */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 26 }}>
        <span
          style={{
            ...mono,
            fontSize: 10,
            color: 'rgba(255,255,255,0.32)',
            flex: '0 0 56px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {site.city.country}
        </span>

        {/* Intensity bar */}
        <div
          style={{
            flex: 1,
            height: 3,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            className="intensity-bar-fill"
            style={{
              position: 'absolute',
              inset: 0,
              width: `${displayIntensity}%`,
              background: col,
              boxShadow: `0 0 8px 0 ${col}80`,
              borderRadius: 2,
            }}
          />
        </div>

        {/* Intensity number */}
        <span
          data-tip={`Aurora intensity · ${displayIntensity < 30 ? 'Weak' : displayIntensity < 65 ? 'Moderate' : 'Strong'} activity`}
          style={{
            ...mono,
            fontSize: 11,
            color: col,
            width: 24,
            textAlign: 'right',
            flexShrink: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {displayIntensity}
        </span>

        {/* Cloud cover */}
        <span
          data-tip={typeof cloudPct === 'number'
            ? `Cloud cover · ${cloudPct < 30 ? 'Clear' : cloudPct < 70 ? 'Partly cloudy' : 'Overcast'} — ${cloudPct < 30 ? 'good' : cloudPct < 70 ? 'fair' : 'poor'} viewing`
            : cloudPct === undefined ? 'Fetching cloud data…' : undefined}
          style={{
            ...mono,
            fontSize: 10,
            flexShrink: 0,
            width: 42,
            textAlign: 'right',
            letterSpacing: '-0.01em',
            color: typeof cloudPct === 'number'
              ? cloudColor(cloudPct)
              : 'rgba(255,255,255,0.15)',
          }}
        >
          {typeof cloudPct === 'number'
            ? `☁ ${cloudPct}%`
            : cloudPct === undefined
            ? '—'
            : ''}
        </span>
      </div>
    </button>
  );
});

// ── Main Sidebar ─────────────────────────────────────────────────────
export default function Sidebar({ auroraData, onSelectSite, ipLocation, kp, forecast, cloudCover }: Props) {
  const topSites = useMemo(() => computeTopSites(auroraData, 10), [auroraData]);

  const kpScale = useMemo(
    () => (kp !== null ? Math.min(1, Math.max(0.08, kp / 7)) : 1),
    [kp]
  );

  const handleIpClick = useCallback(() => {
    if (ipLocation) onSelectSite({ lat: ipLocation.lat, lon: ipLocation.lon });
  }, [ipLocation, onSelectSite]);

  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleOverlayClick = useCallback(() => setSheetOpen(false), []);

  const visibilityPeek = useMemo(() => {
    if (!ipLocation || kp === null) return null;
    return getVisibility(ipLocation.lat, kp);
  }, [ipLocation, kp]);

  const visibilityLabel = visibilityPeek?.label ?? null;
  const visibilityColor = visibilityPeek?.color ?? 'rgba(255,255,255,0.3)';

  // ── Shared scrollable content ────────────────────────────────────
  const content = (
    <>
      {ipLocation && kp !== null && (
        <>
          <VisibilityCard
            loc={ipLocation}
            kp={kp}
            cloudPct={cloudCover[cloudKey(ipLocation.lat, ipLocation.lon)]}
          />
          <Divider />
        </>
      )}

      {ipLocation && (
        <>
          <IpLocationCard loc={ipLocation} onClick={handleIpClick} />
          <Divider />
        </>
      )}

      {/* Column labels */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 20px 7px 43px',
          flexShrink: 0,
          gap: 9,
        }}
      >
        <span style={{ ...mono, fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', flex: 1 }}>
          AURORA SITES
        </span>
        <span
          data-tip="OVATION forecast intensity at this location · 0–100 scale"
          style={{ ...mono, fontSize: 8.5, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', width: 24, textAlign: 'right' }}
        >
          INT
        </span>
        <span
          data-tip="Current cloud cover % · lower = clearer viewing conditions"
          style={{ ...mono, fontSize: 8.5, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', width: 42, textAlign: 'right' }}
        >
          CLOUD
        </span>
      </div>
      <Divider />

      {/* Site list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {topSites.length === 0 ? (
          <div style={{ ...mono, padding: '24px 20px', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
            Awaiting data…
          </div>
        ) : (
          topSites.map((site, i) => (
            <SiteRow
              key={`${site.city.name}-${site.city.country}`}
              site={site}
              rank={i + 1}
              displayIntensity={Math.round(site.intensity * kpScale)}
              cloudPct={cloudCover[cloudKey(site.city.lat, site.city.lon)]}
              onSelect={onSelectSite}
            />
          ))
        )}
      </div>

      {/* Forecast */}
      {forecast.length > 0 && (
        <>
          <Divider />
          <div style={{ padding: '14px 20px', flexShrink: 0 }}>
            <ForecastSparkline data={forecast} />
          </div>
        </>
      )}

      {/* Footer */}
      <Divider />
      <div
        style={{
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          data-tip="National Oceanic & Atmospheric Administration · Space Weather Prediction Center"
          data-tip-align="left"
          style={{ ...mono, fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)' }}
        >
          NOAA SWPC
        </span>
        <span
          data-tip="OVATION model · 30-minute aurora forecast"
          style={{ ...mono, fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)' }}
        >
          30 MIN
        </span>
      </div>
    </>
  );

  // ── Mobile bottom sheet ──────────────────────────────────────────
  if (isMobile) {
    const PEEK_H = 64;
    const SHEET_H = '68vh';

    return (
      <>
        {sheetOpen && (
          <div
            onClick={handleOverlayClick}
            style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0)' }}
          />
        )}

        <aside
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: SHEET_H,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(2, 5, 12, 0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px 16px 0 0',
            transform: sheetOpen ? 'translateY(0)' : `translateY(calc(100% - ${PEEK_H}px))`,
            transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            willChange: 'transform',
          }}
        >
          {/* Handle + peek strip */}
          <div
            onClick={() => setSheetOpen(o => !o)}
            style={{
              flexShrink: 0,
              height: PEEK_H,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono), monospace' }}>
              {kp !== null && (
                <>
                  <span style={{ fontSize: 14, fontWeight: 300, letterSpacing: '-0.02em', color: kp >= 5 ? '#ff5e5e' : kp >= 3 ? '#f5c842' : '#3dffa0' }}>
                    {kp.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)' }}>·</span>
                </>
              )}
              {visibilityLabel ? (
                <span style={{ fontSize: 9, letterSpacing: '0.18em', color: visibilityColor }}>
                  {visibilityLabel}
                </span>
              ) : (
                <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)' }}>
                  VIEWING CONDITIONS
                </span>
              )}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                style={{ transition: 'transform 300ms', transform: sheetOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M1 5L5 1L9 5" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {content}
          </div>
        </aside>
      </>
    );
  }

  // ── Desktop sidebar ──────────────────────────────────────────────
  return (
    <aside
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 268,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(3, 7, 15, 0.94)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 58,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 20px 13px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.38)',
            textTransform: 'uppercase',
          }}
        >
          Viewing Conditions
        </span>
      </div>
      <Divider />

      {content}
    </aside>
  );
}
