interface Props {
  kp: number | null;
  updatedAt: number | null; // Unix ms
}

function kpColor(kp: number): string {
  if (kp < 3) return '#22c55e';  // green
  if (kp < 5) return '#eab308';  // yellow
  return '#ef4444';              // red
}

function kpLabel(kp: number): string {
  if (kp < 2) return 'Quiet';
  if (kp < 4) return 'Unsettled';
  if (kp < 6) return 'Active';
  if (kp < 8) return 'Storm';
  return 'Severe';
}

export default function Header({ kp, updatedAt }: Props) {
  const timeStr = updatedAt
    ? new Date(updatedAt).toUTCString().slice(17, 22) + ' UTC'
    : '—';

  return (
    <header
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6"
      style={{
        height: 48,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Site name */}
      <span
        className="text-white font-mono tracking-widest text-sm"
        style={{ letterSpacing: '0.2em' }}
      >
        AURORA LIVE
      </span>

      {/* Kp badge */}
      {kp !== null ? (
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs font-mono">Kp INDEX</span>
          <span
            className="text-sm font-mono font-bold px-3 py-0.5 rounded"
            style={{
              color: kpColor(kp),
              background: `${kpColor(kp)}18`,
              border: `1px solid ${kpColor(kp)}44`,
            }}
          >
            {kp.toFixed(1)}
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ color: kpColor(kp), opacity: 0.7 }}
          >
            {kpLabel(kp)}
          </span>
        </div>
      ) : (
        <span className="text-white/20 text-xs font-mono">Loading…</span>
      )}

      {/* Timestamp */}
      <span className="text-white/30 text-xs font-mono">
        Updated {timeStr}
      </span>
    </header>
  );
}
