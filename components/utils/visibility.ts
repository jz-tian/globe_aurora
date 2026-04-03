export type VisibilityLevel = 'visible' | 'possible' | 'unlikely';

export interface VisibilityInfo {
  level: VisibilityLevel;
  label: string;
  color: string;
  sublabel: string;
}

/**
 * Approximate minimum latitude (absolute) at which aurora is visible
 * for a given Kp index, based on NOAA SWPC oval model.
 * threshold ≈ 66.5° − Kp × 2.5°
 */
export function getVisibility(userLat: number, kp: number): VisibilityInfo {
  const absLat = Math.abs(userLat);
  const threshold = Math.max(45, 66.5 - kp * 2.5);

  if (absLat >= threshold) {
    return {
      level: 'visible',
      label: 'VISIBLE TONIGHT',
      color: '#3dffa0',
      sublabel: `Kp ${kp.toFixed(1)} reaches ${absLat.toFixed(1)}°`,
    };
  }
  if (absLat >= threshold - 5) {
    return {
      level: 'possible',
      label: 'POSSIBLY VISIBLE',
      color: '#f5c842',
      sublabel: `${(threshold - absLat).toFixed(1)}° below threshold`,
    };
  }
  return {
    level: 'unlikely',
    label: 'UNLIKELY',
    color: 'rgba(255,255,255,0.32)',
    sublabel: `Need Kp ${Math.ceil((66.5 - absLat) / 2.5)} for your latitude`,
  };
}
