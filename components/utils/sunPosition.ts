/**
 * Returns the sun's direction as a unit vector in Globe.gl model space.
 *
 * Globe.gl coordinate system (Three.js Y-up):
 *   Y-axis = north pole
 *   X-axis = prime meridian (lon=0) at equator
 *   Z-axis = lon=90°E at equator
 *
 * Accuracy: ±1° — sufficient for day/night visualization.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function getSunDirection(date: Date): Vec3 {
  const msPerDay = 86_400_000;
  // Days since J2000.0 (2000-01-01 12:00 UTC)
  const d = date.getTime() / msPerDay - 10957.5;

  // Mean longitude and anomaly (degrees → radians)
  const L = ((280.46 + 0.9856474 * d) % 360 + 360) % 360;
  const gDeg = ((357.528 + 0.9856003 * d) % 360 + 360) % 360;
  const g = gDeg * (Math.PI / 180);

  // Ecliptic longitude (radians)
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);

  // Obliquity of the ecliptic
  const epsilon = 23.439 * (Math.PI / 180);

  // Sun direction in ECI (Earth-centered inertial) frame
  const xEci = Math.cos(lambda);
  const yEci = Math.sin(lambda) * Math.cos(epsilon);
  const zEci = Math.sin(lambda) * Math.sin(epsilon);

  // Greenwich Mean Sidereal Time (degrees → radians)
  const gmstDeg = ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
  const gmst = gmstDeg * (Math.PI / 180);

  // ECI → ECEF: rotate about Z (Earth spin axis) by GMST
  const xEcef = xEci * Math.cos(gmst) + yEci * Math.sin(gmst);
  const yEcef = -xEci * Math.sin(gmst) + yEci * Math.cos(gmst);
  const zEcef = zEci;

  // ECEF → Globe.gl model space
  // ECEF: X=lon0 equator, Y=lon90E equator, Z=north pole
  // Globe.gl: X=lon0 equator, Y=north pole, Z=lon90E equator
  const x = xEcef;
  const y = zEcef; // ECEF Z (polar) → Globe.gl Y (up)
  const z = yEcef; // ECEF Y (lon90E) → Globe.gl Z

  // Normalize
  const len = Math.sqrt(x * x + y * y + z * z);
  return { x: x / len, y: y / len, z: z / len };
}

/** Sub-solar point in lat/lon degrees. Useful for debugging. */
export function getSunSubsolarPoint(date: Date): { lat: number; lon: number } {
  const { x, y, z } = getSunDirection(date);
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
  const lon = Math.atan2(z, x) * (180 / Math.PI);
  return { lat, lon };
}
