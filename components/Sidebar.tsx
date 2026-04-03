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
  if (pct < 30) return '#3dffa0';
  if (pct < 70) return 'rgba(255,255,255,0.38)';
  return 'rgba(255,255,255,0.18)';
}

function formatCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

// ── Visibility card ──────────────────────────────────────────────────
const VisibilityCard = memo(function VisibilityCard({
  loc,
  kp,
}: {
  loc: IpLocation;
  kp: number;
}) {
  const info = getVisibility(loc.lat, kp);

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: `${info.color}08`,
        borderLeft: `2px solid ${info.color}55`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        {/* Pulsing status dot */}
        <span
          className={info.level === 'visible' ? 'live-dot' : 'loc-dot'}
          style={{ background: info.color }}
        />
        <span
          style={{
            ...mono,
            fontSize: 8,
            letterSpacing: '0.2em',
            color: info.color,
            opacity: 0.9,
          }}
        >
          {info.label}
        </span>
      </div>
      <div
        style={{
          ...mono,
          fontSize: 9,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.04em',
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
        padding: '13px 16px',
        background: 'rgba(125, 211, 252, 0.06)',
        borderBottom: '1px solid rgba(125, 211, 252, 0.18)',
        borderLeft: '2px solid rgba(125, 211, 252, 0.6)',
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(125, 211, 252, 0.10)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(125, 211, 252, 0.06)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="loc-dot" />
        <span
          style={{
            ...mono,
            fontSize: 8,
            letterSpacing: '0.2em',
            color: 'rgba(125, 211, 252, 0.75)',
            textTransform: 'uppercase',
          }}
        >
          Your Location
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}>
        <span
          style={{
            ...mono,
            fontSize: 13,
            color: '#7dd3fc',
            letterSpacing: '0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loc.city}
        </span>
        {loc.country && (
          <span
            style={{
              ...mono,
              fontSize: 9.5,
              color: 'rgba(125, 211, 252, 0.55)',
              letterSpacing: '0.1em',
            }}
          >
            {loc.country}
          </span>
        )}
      </div>

      <div
        style={{
          ...mono,
          fontSize: 9,
          color: 'rgba(125, 211, 252, 0.45)',
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
  onClick,
}: {
  site: TopSite;
  rank: number;
  displayIntensity: number;
  cloudPct?: number | null;
  onClick: () => void;
}) {
  const col = intensityColor(displayIntensity);
  const pct = `${displayIntensity}%`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left"
      style={{
        display: 'block',
        padding: '10px 16px 10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: '2px solid transparent',
        background: 'transparent',
        transition: 'background 120ms, border-left-color 120ms',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.04)';
        el.style.borderLeftColor = `${col}66`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'transparent';
        el.style.borderLeftColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span
          style={{
            ...mono,
            fontSize: 9,
            color: 'rgba(255,255,255,0.38)',
            width: 14,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {String(rank).padStart(2, '0')}
        </span>
        <span
          style={{
            ...mono,
            fontSize: 12,
            color: 'rgba(255,255,255,0.88)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
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
            background:
              site.hemisphere === 'N'
                ? 'rgba(140,190,255,0.65)'
                : 'rgba(255,190,100,0.65)',
            flexShrink: 0,
          }}
          title={site.hemisphere === 'N' ? 'Northern' : 'Southern'}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 22 }}>
        <span
          style={{
            ...mono,
            fontSize: 9.5,
            color: 'rgba(255,255,255,0.48)',
            flex: '0 0 64px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.03em',
          }}
        >
          {site.city.country}
        </span>

        <div
          style={{
            flex: 1,
            height: 2,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            className="intensity-bar-fill"
            style={{
              position: 'absolute',
              inset: 0,
              width: pct,
              background: col,
              boxShadow: `0 0 6px 0 ${col}99`,
              borderRadius: 1,
            }}
          />
        </div>

        <span
          style={{
            ...mono,
            fontSize: 10.5,
            color: col,
            width: 24,
            textAlign: 'right',
            flexShrink: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {displayIntensity}
        </span>

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
      </div>
    </button>
  );
});

// ── Main Sidebar ─────────────────────────────────────────────────────
export default function Sidebar({ auroraData, onSelectSite, ipLocation, kp, forecast, cloudCover }: Props) {
  const topSites = useMemo(() => computeTopSites(auroraData, 10), [auroraData]);

  // Scale displayed intensity by KP so quiet conditions show low values.
  // Formula: kp=0 → ~8%, kp=3.5 → ~50%, kp=7 → 100%
  // Raw OVATION data is preserved for globe shader; only display is scaled.
  const kpScale = useMemo(
    () => (kp !== null ? Math.min(1, Math.max(0.08, kp / 7)) : 1),
    [kp]
  );

  const handleIpClick = useCallback(() => {
    if (ipLocation) onSelectSite({ lat: ipLocation.lat, lon: ipLocation.lon });
  }, [ipLocation, onSelectSite]);

  const cloudKey = (lat: number, lon: number) =>
    `${lat.toFixed(2)},${lon.toFixed(2)}`;

  // Mobile bottom sheet state
  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close sheet on outside tap
  const handleOverlayClick = useCallback(() => setSheetOpen(false), []);

  // ── Visibility verdict for mobile peek ───────────────────────────
  const visibilityLabel =
    ipLocation && kp !== null
      ? getVisibility(ipLocation.lat, kp).label
      : null;

  const visibilityColor =
    ipLocation && kp !== null
      ? getVisibility(ipLocation.lat, kp).color
      : 'rgba(255,255,255,0.3)';

  // ── Shared scrollable content ────────────────────────────────────
  const content = (
    <>
      {/* Visibility card — only when we have location + KP */}
      {ipLocation && kp !== null && (
        <VisibilityCard loc={ipLocation} kp={kp} />
      )}

      {/* IP location card */}
      {ipLocation && (
        <IpLocationCard loc={ipLocation} onClick={handleIpClick} />
      )}

      {/* Column labels */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '7px 16px 6px 36px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          gap: 8,
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 8,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.38)',
            flex: 1,
          }}
        >
          AURORA SITES
        </span>
        <span
          style={{
            ...mono,
            fontSize: 8,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.38)',
            width: 24,
            textAlign: 'right',
          }}
        >
          INT
        </span>
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
      </div>

      {/* Site list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {topSites.length === 0 ? (
          <div
            style={{
              ...mono,
              padding: '24px 16px',
              fontSize: 9,
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
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
              onClick={() => onSelectSite({ lat: site.city.lat, lon: site.city.lon })}
            />
          ))
        )}
      </div>

      {/* Forecast section */}
      {forecast.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <ForecastSparkline data={forecast} />
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{ ...mono, fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}
        >
          NOAA SWPC
        </span>
        <span
          style={{ ...mono, fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}
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
        {/* Backdrop overlay */}
        {sheetOpen && (
          <div
            onClick={handleOverlayClick}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 30,
              background: 'rgba(0,0,0,0)',
            }}
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
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px 14px 0 0',
            transform: sheetOpen ? 'translateY(0)' : `translateY(calc(100% - ${PEEK_H}px))`,
            transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            willChange: 'transform',
          }}
        >
          {/* Handle + peek strip — always visible */}
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
            {/* Handle pill */}
            <div
              style={{
                width: 36,
                height: 3,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.22)',
              }}
            />

            {/* Peek info row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              {kp !== null && (
                <>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 300,
                      letterSpacing: '-0.02em',
                      color: kp >= 5 ? '#ff5e5e' : kp >= 3 ? '#f5c842' : '#3dffa0',
                    }}
                  >
                    {kp.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
                </>
              )}
              {visibilityLabel ? (
                <span
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.16em',
                    color: visibilityColor,
                  }}
                >
                  {visibilityLabel}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.16em',
                    color: 'rgba(255,255,255,0.3)',
                  }}
                >
                  VIEWING CONDITIONS
                </span>
              )}
              {/* Expand chevron */}
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                style={{
                  transition: 'transform 300ms',
                  transform: sheetOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <path
                  d="M1 5L5 1L9 5"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Scrollable content area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}
          >
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
        width: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(3, 8, 16, 0.92)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 60,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 16px 13px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 8.5,
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
          }}
        >
          Viewing Conditions
        </span>
      </div>

      {content}
    </aside>
  );
}
