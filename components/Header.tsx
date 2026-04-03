interface Props {
  kp: number | null;
  updatedAt: number | null;
}

function kpColor(kp: number): string {
  if (kp < 3) return '#3dffa0';
  if (kp < 5) return '#f5c842';
  return '#ff5e5e';
}

function kpLabel(kp: number): string {
  if (kp < 2) return 'QUIET';
  if (kp < 4) return 'UNSETTLED';
  if (kp < 6) return 'ACTIVE';
  if (kp < 8) return 'STORM';
  return 'SEVERE';
}

function kpTip(kp: number): string {
  if (kp < 2) return 'Kp < 2 · Quiet geomagnetic conditions · Aurora confined to polar regions';
  if (kp < 4) return 'Kp 2–3 · Slightly unsettled · Weak aurora possible at high latitudes';
  if (kp < 6) return 'Kp 4–5 · Active / minor storm · Aurora visible at mid-latitudes';
  if (kp < 8) return 'Kp 6–7 · Moderate-to-strong storm · Aurora visible down to ~50° latitude';
  return 'Kp 8–9 · Severe geomagnetic storm · Aurora visible at very low latitudes';
}

const serif: React.CSSProperties = {
  fontFamily: 'var(--font-serif), Georgia, serif',
};

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono), monospace',
};

export default function Header({ kp, updatedAt }: Props) {
  const timeStr = updatedAt
    ? new Date(updatedAt).toISOString().slice(11, 16) + ' UTC'
    : '—';

  return (
    <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none select-none">

      {/* Wordmark — left-aligned (after sidebar on desktop, edge on mobile) */}
      <div className="header-wordmark">
        <span
          style={{
            ...serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 300,
            letterSpacing: '0.26em',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          AURORA
        </span>
        <span className="live-dot" />
      </div>

      {/* Data cluster — top-right */}
      <div
        className="absolute flex flex-col items-end header-kp-cluster"
        style={{ right: 24, gap: 3 }}
      >
        {kp !== null ? (
          <>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              {/* KP number — tooltip explaining the scale */}
              <span
                data-tip="Planetary K-index (0–9) · global geomagnetic disturbance"
                data-tip-dir="below"
                style={{
                  ...mono,
                  fontSize: 26,
                  fontWeight: 300,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: kpColor(kp),
                }}
              >
                {kp.toFixed(1)}
              </span>
              {/* Storm label — tooltip explaining this specific level */}
              <span
                data-tip={kpTip(kp)}
                data-tip-dir="below"
                style={{
                  ...mono,
                  fontSize: 8,
                  fontWeight: 400,
                  letterSpacing: '0.18em',
                  color: kpColor(kp),
                  opacity: 0.65,
                  paddingBottom: 2,
                }}
              >
                {kpLabel(kp)}
              </span>
            </div>
            {/* Timestamp — tooltip explaining the source */}
            <span
              data-tip="NOAA SWPC OVATION model · 30-min aurora forecast"
              data-tip-dir="below"
              style={{
                ...mono,
                fontSize: 8,
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.2)',
              }}
            >
              Kp · {timeStr}
            </span>
          </>
        ) : (
          <span style={{ ...mono, fontSize: 8, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.18)' }}>
            —
          </span>
        )}
      </div>

    </header>
  );
}
