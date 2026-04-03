import * as THREE from 'three';

// Galactic pole direction (approximately IAU-defined) in Three.js world space
// Galactic plane normal: RA 192.86°, Dec +27.13° → converted to cartesian
const GALACTIC_POLE = new THREE.Vector3(
  -0.0669, // x
   0.4927, // y (north)
  -0.8677  // z
).normalize();

function gaussianRand(): number {
  // Box-Muller
  const u = Math.random() + 1e-9;
  const v = Math.random() + 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

let cachedStarField: THREE.Points | null = null;

export function createStarField(): THREE.Points {
  if (cachedStarField) return cachedStarField;

  const R = 900;

  // Buckets: bg stars, milky way stars, bright stars
  const bgCount = 3500;
  const mwCount = 4500;
  const brightCount = 60;
  const total = bgCount + mwCount + brightCount;

  const positions = new Float32Array(total * 3);
  const colors    = new Float32Array(total * 3);
  const sizes     = new Float32Array(total);

  let idx = 0;

  // --- Background stars: uniform sphere, dim ---
  for (let i = 0; i < bgCount; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);
    positions[idx * 3]     = R * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = R * Math.sin(phi) * Math.sin(theta);
    positions[idx * 3 + 2] = R * Math.cos(phi);

    const b = 0.35 + Math.random() * 0.35;
    colors[idx * 3]     = b * 0.85;
    colors[idx * 3 + 1] = b * 0.90;
    colors[idx * 3 + 2] = b;

    sizes[idx] = Math.random() * 1.0 + 0.3;
    idx++;
  }

  // --- Milky Way band: stars concentrated near the galactic plane ---
  // Build two orthogonal vectors in the galactic plane
  const up = new THREE.Vector3(0, 1, 0);
  const mwTangent = new THREE.Vector3().crossVectors(GALACTIC_POLE, up).normalize();
  const mwBinorm  = new THREE.Vector3().crossVectors(GALACTIC_POLE, mwTangent).normalize();

  for (let i = 0; i < mwCount; i++) {
    // Random angle along the galactic circle
    const angle = Math.random() * 2 * Math.PI;
    // Gaussian offset from the galactic plane (σ ≈ 12°)
    const latOffset = gaussianRand() * (12 * Math.PI / 180);

    // Base point on galactic circle
    const base = new THREE.Vector3(
      Math.cos(angle) * mwTangent.x + Math.sin(angle) * mwBinorm.x,
      Math.cos(angle) * mwTangent.y + Math.sin(angle) * mwBinorm.y,
      Math.cos(angle) * mwTangent.z + Math.sin(angle) * mwBinorm.z
    );
    // Add galactic-latitude offset toward the pole
    const dir = new THREE.Vector3()
      .addScaledVector(base, Math.cos(latOffset))
      .addScaledVector(GALACTIC_POLE, Math.sin(latOffset))
      .normalize();

    positions[idx * 3]     = dir.x * R;
    positions[idx * 3 + 1] = dir.y * R;
    positions[idx * 3 + 2] = dir.z * R;

    // Color: warm toward galactic center arc, cool at edges
    const absLat = Math.abs(latOffset);
    const warmness = Math.max(0, 1 - absLat / (15 * Math.PI / 180));
    const brightness = 0.45 + Math.random() * 0.45;
    // Slight orange-yellow tint near plane center, blue-white at edges
    colors[idx * 3]     = brightness * (0.88 + warmness * 0.10);
    colors[idx * 3 + 1] = brightness * (0.88 + warmness * 0.04);
    colors[idx * 3 + 2] = brightness * (0.95 - warmness * 0.15);

    sizes[idx] = Math.random() * 1.2 + 0.4;
    idx++;
  }

  // --- Bright foreground stars: scattered, larger, varied colors ---
  const starColors = [
    [1.0,  0.90, 0.75], // warm white (Capella-ish)
    [0.70, 0.80, 1.0 ], // blue-white (Rigel-ish)
    [1.0,  0.96, 0.94], // near-white
    [1.0,  0.75, 0.55], // orange (Arcturus-ish)
    [1.0,  0.98, 0.85], // warm white
  ];

  for (let i = 0; i < brightCount; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);
    positions[idx * 3]     = R * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = R * Math.sin(phi) * Math.sin(theta);
    positions[idx * 3 + 2] = R * Math.cos(phi);

    const sc = starColors[Math.floor(Math.random() * starColors.length)];
    const b = 0.85 + Math.random() * 0.15;
    colors[idx * 3]     = sc[0] * b;
    colors[idx * 3 + 1] = sc[1] * b;
    colors[idx * 3 + 2] = sc[2] * b;

    sizes[idx] = 1.8 + Math.random() * 1.8; // bigger & brighter
    idx++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.90,
    sizeAttenuation: false,
  });

  cachedStarField = new THREE.Points(geo, mat);
  return cachedStarField;
}

export function disposeStarField(): void {
  if (!cachedStarField) return;
  cachedStarField.geometry.dispose();
  (cachedStarField.material as THREE.Material).dispose();
  cachedStarField = null;
}
