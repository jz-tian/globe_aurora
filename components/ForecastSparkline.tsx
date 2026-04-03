'use client';

import { useMemo } from 'react';
import type { ForecastPoint } from './utils/kpForecast';

function kpColor(kp: number): string {
  if (kp < 3) return '#3dffa0';
  if (kp < 5) return '#f5c842';
  return '#ff5e5e';
}

interface Props {
  data: ForecastPoint[];
}

export default function ForecastSparkline({ data }: Props) {
  const chart = useMemo(() => {
    if (!data.length) return null;

    const now = Date.now();
    const windowStart = now - 6 * 3_600_000;
    const windowEnd   = now + 42 * 3_600_000;

    const pts = data.filter(p => p.time >= windowStart && p.time <= windowEnd);
    if (pts.length < 2) return null;

    const minT  = pts[0].time;
    const maxT  = pts[pts.length - 1].time;
    const tSpan = maxT - minT || 1;

    const W = 100; // viewBox units
    const H = 38;
    const PX = 2;  // padding x
    const PY = 4;  // padding y

    const cx = (t: number) => PX + ((t - minT) / tSpan) * (W - 2 * PX);
    const cy = (kp: number) => H - PY - (Math.min(kp, 9) / 9) * (H - 2 * PY);

    const nowX = Math.max(PX, Math.min(W - PX, cx(now)));

    // Polyline points string
    const polyline = pts.map(p => `${cx(p.time)},${cy(p.kp)}`).join(' ');

    // Closed area path
    const area = [
      `M ${cx(pts[0].time)} ${cy(pts[0].kp)}`,
      ...pts.slice(1).map(p => `L ${cx(p.time)} ${cy(p.kp)}`),
      `L ${cx(pts[pts.length - 1].time)} ${H}`,
      `L ${cx(pts[0].time)} ${H}`,
      'Z',
    ].join(' ');

    // Find upcoming peak
    const future = pts.filter(p => !p.observed && p.time > now);
    const peak = future.length
      ? future.reduce((a, b) => (b.kp > a.kp ? b : a))
      : null;

    return { pts, polyline, area, nowX, peak, cx, cy, H, W };
  }, [data]);

  if (!chart) return null;

  const { pts, polyline, area, nowX, peak, cx, cy, H, W } = chart;
  const now = Date.now();

  return (
    <div>
      {/* Section label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 8,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.38)',
          }}
        >
          KP FORECAST
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 8,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          48H
        </span>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* Area fill gradient */}
          <linearGradient id="spl-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#3dffa0" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#3dffa0" stopOpacity={0}    />
          </linearGradient>

          {/* Line glow */}
          <filter id="spl-glow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Dot glow */}
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Storm threshold line at Kp = 5 */}
        <line
          x1={2} y1={cy(5)} x2={W - 2} y2={cy(5)}
          stroke="rgba(255,94,94,0.2)"
          strokeWidth={0.4}
          strokeDasharray="1.5 2.5"
        />

        {/* Area fill */}
        <path d={area} fill="url(#spl-fill)" />

        {/* Main line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#3dffa0"
          strokeWidth={1.1}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#spl-glow)"
        />

        {/* Now marker */}
        <line
          x1={nowX} y1={2} x2={nowX} y2={H - 2}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.5}
        />
        <text
          x={nowX + 1.2}
          y={7}
          fontSize={3}
          fill="rgba(255,255,255,0.28)"
          style={{ fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em' }}
        >
          NOW
        </text>

        {/* Data dots — only show if reasonably spaced */}
        {pts.length <= 18 && pts.map((p, i) => (
          <circle
            key={i}
            cx={cx(p.time)}
            cy={cy(p.kp)}
            r={p.kp >= 5 ? 1.6 : 1.1}
            fill={kpColor(p.kp)}
            opacity={p.time < now ? 0.45 : 0.9}
            filter={p.kp >= 5 ? 'url(#dot-glow)' : undefined}
          />
        ))}
      </svg>

      {/* Peak callout */}
      {peak && peak.kp >= 3 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 7,
            fontFamily: 'var(--font-mono), monospace',
          }}
        >
          <span
            style={{
              fontSize: 8,
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.28)',
            }}
          >
            PEAK
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: kpColor(peak.kp),
              letterSpacing: '-0.01em',
            }}
          >
            Kp {peak.kp.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 8,
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.22)',
            }}
          >
            {(() => {
              const hrs = (peak.time - now) / 3_600_000;
              return hrs < 1
                ? `in ~${Math.round(hrs * 60)}m`
                : `in ~${hrs.toFixed(1)}h`;
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
