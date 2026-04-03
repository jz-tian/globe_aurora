import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vModelNormal;
  varying vec3 vWorldPos;

  void main() {
    vModelNormal = normal;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Volumetric-style aurora fragment shader.
// Based on the CC0 Godot community port of nimitz's triNoise2d algorithm.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensityScale; // 0.0–1.0, global max from NOAA data / 100
  uniform float uNorthActive;    // 0.0–1.0, northern hemisphere strength
  uniform float uSouthActive;    // 0.0–1.0, southern hemisphere strength
  uniform int   uQuality;        // raymarch steps: 20 (mobile) or 50 (desktop)

  varying vec3 vModelNormal;
  varying vec3 vWorldPos;

  // --- Noise ---
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      v += amp * smoothNoise(p * freq);
      freq *= 2.1;
      amp *= 0.45;
    }
    return v;
  }

  // --- Color ramp: green → cyan → near-white ---
  vec3 auroraColor(float t) {
    vec3 green = vec3(0.00, 1.00, 0.53);  // #00ff88
    vec3 cyan  = vec3(0.00, 1.00, 0.80);  // #00ffcc
    vec3 white = vec3(0.87, 1.00, 0.95);  // #defff3

    if (t < 0.5) {
      return mix(green, cyan, t * 2.0);
    } else {
      return mix(cyan, white, (t - 0.5) * 2.0);
    }
  }

  void main() {
    vec3 n = normalize(vModelNormal);

    float lat    = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float absLat = abs(lat);

    // Coarse early exit — well outside any aurora zone
    if (absLat < 28.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Hemisphere activity
    float hemiStrength = (n.y > 0.0) ? uNorthActive : uSouthActive;
    if (hemiStrength < 0.01 || uIntensityScale < 0.01) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float t      = uTime;
    float lon    = degrees(atan(n.z, n.x));   // -180 to 180
    float lonN   = lon / 180.0;               // -1 to 1
    float lonRad = lon * 3.14159265 / 180.0;

    // ── Wavy latitude boundary ──────────────────────────────────────────
    // Multiple sine waves at different wavelengths and speeds along longitude
    // → aurora band rises and falls as if driven by magnetospheric waves
    float waveY = sin(lonRad * 2.1  + t * 0.24) * 5.5   // dominant slow wave
                + sin(lonRad * 4.8  - t * 0.40) * 2.5   // mid-frequency detail
                + sin(lonRad * 0.85 + t * 0.13) * 4.2;  // very slow large-scale swell

    // Noise-based equatorward edge irregularity (no more clean circle)
    float edgeN = smoothNoise(vec2(lonN * 2.4 + t * 0.033, 1.7 + t * 0.021));
    float edgeFuzz = (edgeN * 2.0 - 1.0) * 6.0;          // ±6° irregular edge

    float totalWave = waveY + edgeFuzz;

    // Equatorward boundary varies ~35°–52° depending on wave phase
    float loBound = 42.0 + totalWave;
    // Polar boundary: waves move it too, but more gently
    float hiBound = 80.0 + waveY * 0.35;

    // Soft inner edge (18° ramp) + softer polar fade
    float latMask = smoothstep(loBound, loBound + 18.0, absLat)
                  * (1.0 - smoothstep(hiBound, 90.0, absLat));

    if (latMask < 0.005) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // ── Noise UV — include latitude so noise varies in 2D ───────────────
    // latV: positions noise relative to aurora band centre (~62°)
    // Without this, V is constant → all variation horizontal → laser beams
    float latV = (absLat - 62.0) / 22.0;   // −1…+1 across the band

    vec2 uv1 = vec2(lonN * 2.8, latV * 3.2 + sign(n.y)) + vec2( t * 0.07,  t * 0.022);
    vec2 uv2 = vec2(lonN * 5.5, latV * 5.8 + sign(n.y)) + vec2(-t * 0.10,  t * 0.038);
    vec2 uv3 = vec2(lonN * 1.3, latV * 2.0 + sign(n.y)) + vec2( t * 0.034,-t * 0.016);

    int q = uQuality;
    float n1 = fbm(uv1, q);
    float n2 = fbm(uv2, max(q / 2, 2));
    float n3 = smoothNoise(uv3);

    float curtain = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
    curtain = smoothstep(0.28, 0.80, curtain);

    // Breathing pulse with per-fragment phase offset → not all curtains pulse together
    float pulse = 0.70 + 0.30 * sin(t * 0.85 + n1 * 6.2832 + lonN * 3.14);
    curtain *= pulse;

    // Perceptual curve: sqrt so 14% intensity still renders visibly.
    // uIntensityScale only controls overall fade — not curtain shape.
    float activity  = sqrt(hemiStrength);
    float intensity = curtain * activity * latMask;

    if (intensity < 0.016) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // ── Volumetric shell thickness ─────────────────────────────────────
    vec3 viewDir  = normalize(cameraPosition - vWorldPos);
    float viewDot = abs(dot(viewDir, n));

    // limbFactor: 1× when facing camera, up to ~3× at the limb edge
    float limbFactor = 1.0 + 2.2 * pow(1.0 - clamp(viewDot, 0.0, 1.0), 2.0);

    // Color uses the unmodified intensity — stays green/cyan always
    vec3 color = auroraColor(intensity);
    color += color * intensity * 0.35;

    // Alpha: floor at 0.25 so weak real-data aurora remains visible;
    // scales up to full brightness at high intensity (mock / storm).
    float globalFade = 0.25 + 0.75 * uIntensityScale;
    float alpha = clamp(intensity * limbFactor * globalFade * 0.88, 0.0, 0.88);
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Creates the aurora shader mesh.
 * Place at globeRadius * 1.02 so it floats above the Earth surface.
 * Update uniforms each frame in an animation loop.
 */
export function createAuroraMesh(radius: number): THREE.Mesh {
  const isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.devicePixelRatio < 1.5);

  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:           { value: 0.0 },
      uIntensityScale: { value: 0.0 },
      uNorthActive:    { value: 0.0 },
      uSouthActive:    { value: 0.0 },
      uQuality:        { value: isMobile ? 8 : 24 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
