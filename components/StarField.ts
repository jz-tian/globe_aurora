import * as THREE from 'three';

export function createStarField(): THREE.Points {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Uniform distribution on a sphere surface
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 900; // far behind the globe

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Slight blue-white tint, varying brightness
    const brightness = 0.6 + Math.random() * 0.4;
    colors[i * 3]     = brightness * 0.88; // R
    colors[i * 3 + 1] = brightness * 0.93; // G
    colors[i * 3 + 2] = brightness;        // B

    sizes[i] = Math.random() * 1.8 + 0.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
  });

  return new THREE.Points(geo, mat);
}
