import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vModelNormal;

  void main() {
    vModelNormal = normal; // model-space normal = unit direction from sphere center
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDirection;

  varying vec3 vModelNormal;

  void main() {
    vec3 n = normalize(vModelNormal);

    // Positive = day side, negative = night side
    float sunDot = dot(n, normalize(uSunDirection));

    // Soft terminator: transition over ~12° of arc
    float nightFactor = 1.0 - smoothstep(-0.07, 0.07, sunDot);

    // Night: deep blue-black atmosphere
    vec3 nightColor = vec3(0.0, 0.03, 0.10);
    float alpha = nightFactor * 0.62;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(nightColor, alpha);
  }
`;

/**
 * Creates a transparent sphere mesh for the day/night terminator.
 * Add to the Globe.gl scene. Radius should equal the globe radius (100).
 * Update uniforms.uSunDirection.value each frame.
 */
export function createDayNightMesh(globeRadius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(globeRadius + 0.3, 64, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(geo, mat);
}
