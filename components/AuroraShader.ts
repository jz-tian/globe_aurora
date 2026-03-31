import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vModelNormal;

  void main() {
    vModelNormal = normal;
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

    // Latitude from Y component (Y = sin(lat) in Globe.gl model space)
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float absLat = abs(lat);

    // Only render in aurora zone
    if (absLat < 45.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Hemisphere activity
    float hemiStrength = (n.y > 0.0) ? uNorthActive : uSouthActive;
    if (hemiStrength < 0.01 || uIntensityScale < 0.01) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Latitude envelope: fade in 45–62°, fade out 78–88°
    float latMask = smoothstep(45.0, 62.0, absLat)
                  * (1.0 - smoothstep(78.0, 88.0, absLat));

    // UV from lon + lat band
    float lon = degrees(atan(n.z, n.x)); // -180 to 180
    vec2 baseUV = vec2(lon / 180.0, sign(n.y));

    float t = uTime;

    // Three noise layers at different scales and drift speeds
    vec2 uv1 = baseUV * vec2(2.5, 4.0) + vec2(t * 0.08,  t * 0.03);
    vec2 uv2 = baseUV * vec2(5.0, 8.0) + vec2(-t * 0.11, t * 0.05);
    vec2 uv3 = baseUV * vec2(1.2, 2.5) + vec2(t * 0.04, -t * 0.02);

    int q = uQuality;
    float n1 = fbm(uv1, q);
    float n2 = fbm(uv2, max(q / 2, 2));
    float n3 = smoothNoise(uv3);

    // Curtain: mainly n1/n2, n3 adds micro-detail
    float curtain = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
    curtain = smoothstep(0.30, 0.82, curtain);

    // Breathing pulse (~2–3 s period)
    float pulse = 0.72 + 0.28 * sin(t * 0.85 + n1 * 6.2832);
    curtain *= pulse;

    float intensity = curtain * uIntensityScale * hemiStrength * latMask;

    if (intensity < 0.018) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 color = auroraColor(intensity);
    // Additive brightness in bright cores
    color += color * intensity * 0.45;

    float alpha = clamp(intensity * 0.92, 0.0, 0.90);
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
      uQuality:        { value: isMobile ? 20 : 50 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
