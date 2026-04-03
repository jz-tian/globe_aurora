'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { AuroraPoint } from './utils/noaa';
import { createAuroraMesh } from './AuroraShader';
import { createDayNightMesh } from './DayNightShader';
import { createStarField } from './StarField';
import { getSunDirection } from './utils/sunPosition';

const GLOBE_RADIUS = 100;

/**
 * Build a high-quality Phong globe material.
 * We load all three textures ourselves so we can set colorSpace and
 * bumpScale — react-globe.gl's globeImageUrl/bumpImageUrl props don't
 * expose those controls.
 */
function buildGlobeMaterial() {
  const mat = new THREE.MeshPhongMaterial();
  mat.specular = new THREE.Color(0x1e4a70);
  mat.shininess = 60;

  const loader = new THREE.TextureLoader();

  loader.load('/textures/earth_day.webp', tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  });

  loader.load('/textures/earth_spec.webp', tex => {
    mat.specularMap = tex;
    mat.needsUpdate = true;
  });

  loader.load('/textures/earth_bump.webp', tex => {
    mat.bumpMap = tex;
    mat.bumpScale = 0.06;
    mat.needsUpdate = true;
  });

  return mat;
}

interface Props {
  auroraData: AuroraPoint[];
  selectedSite: { lat: number; lon: number } | null;
  ipLocation: { lat: number; lon: number; city: string; country: string } | null;
}

export default function GlobeScene({ auroraData, selectedSite, ipLocation }: Props) {
  const globeMaterial = useMemo(() => buildGlobeMaterial(), []);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const auroraMeshRef = useRef<THREE.Mesh | null>(null);
  const dayNightMeshRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<(() => void) | null>(null);
  const pendingSiteRef = useRef<{ lat: number; lon: number } | null>(null);

  const { maxIntensity, northMax, southMax } = useMemo(() => {
    let max = 0, nm = 0, sm = 0;
    for (const p of auroraData) {
      if (p.intensity > max) max = p.intensity;
      if (p.lat > 0 && p.intensity > nm) nm = p.intensity;
      if (p.lat < 0 && p.intensity > sm) sm = p.intensity;
    }
    return { maxIntensity: max, northMax: nm, southMax: sm };
  }, [auroraData]);

  useEffect(() => {
    if (!auroraMeshRef.current) return;
    const uniforms = (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms;
    uniforms.uIntensityScale.value = maxIntensity / 100;
    uniforms.uNorthActive.value = northMax / 100;
    uniforms.uSouthActive.value = southMax / 100;
  }, [maxIntensity, northMax, southMax]);

  useEffect(() => {
    if (!selectedSite) return;
    if (!globeRef.current) {
      pendingSiteRef.current = selectedSite;
      return;
    }
    globeRef.current.pointOfView(
      { lat: selectedSite.lat, lng: selectedSite.lon, altitude: 1.5 },
      1500
    );
  }, [selectedSite]);

  const startAnimation = useCallback(() => {
    // Update sun direction at most once per second — it doesn't move perceptibly faster
    let lastSunUpdate = 0;

    const tick = () => {
      const t = performance.now() / 1000;
      if (auroraMeshRef.current) {
        (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      }
      if (dayNightMeshRef.current && t - lastSunUpdate > 1.0) {
        const sunDir = getSunDirection(new Date());
        const uni = (dayNightMeshRef.current.material as THREE.ShaderMaterial).uniforms;
        uni.uSunDirection.value.set(sunDir.x, sunDir.y, sunDir.z);
        lastSunUpdate = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tickRef.current = tick;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;

    // ── Renderer quality upgrades ──────────────────────────────────
    const renderer = globeRef.current.renderer() as THREE.WebGLRenderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Anisotropic filtering on all material textures (sharper at angles)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const applyAniso = (tex: THREE.Texture | null) => {
      if (tex) { tex.anisotropy = maxAniso; tex.needsUpdate = true; }
    };
    applyAniso(globeMaterial.map);
    applyAniso(globeMaterial.specularMap);
    applyAniso(globeMaterial.bumpMap);

    const scene = globeRef.current.scene();

    scene.add(createStarField());

    const dayNight = createDayNightMesh(GLOBE_RADIUS);
    scene.add(dayNight);
    dayNightMeshRef.current = dayNight;

    const aurora = createAuroraMesh(GLOBE_RADIUS * 1.15);
    scene.add(aurora);
    auroraMeshRef.current = aurora;

    if (maxIntensity > 0) {
      const uniforms = (aurora.material as THREE.ShaderMaterial).uniforms;
      uniforms.uIntensityScale.value = maxIntensity / 100;
      uniforms.uNorthActive.value = northMax / 100;
      uniforms.uSouthActive.value = southMax / 100;
    }

    if (pendingSiteRef.current) {
      globeRef.current.pointOfView(
        { lat: pendingSiteRef.current.lat, lng: pendingSiteRef.current.lon, altitude: 1.5 },
        0
      );
      pendingSiteRef.current = null;
    }

    // Slow auto-rotation when not interacting
    const controls = globeRef.current.controls() as THREE.EventDispatcher & {
      autoRotate: boolean;
      autoRotateSpeed: number;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    startAnimation();
  }, [startAnimation, maxIntensity, northMax, southMax, globeMaterial]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (auroraMeshRef.current) {
        auroraMeshRef.current.geometry.dispose();
        (auroraMeshRef.current.material as THREE.Material).dispose();
      }
      if (dayNightMeshRef.current) {
        dayNightMeshRef.current.geometry.dispose();
        (dayNightMeshRef.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  // Pause/resume animation loop with tab visibility — avoids burning CPU/GPU in background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (tickRef.current) {
        rafRef.current = requestAnimationFrame(tickRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const heatmapPoints = useMemo(
    () => auroraData.map(p => ({ lat: p.lat, lon: p.lon, weight: p.intensity / 100 })),
    [auroraData]
  );

  const heatmapColorFn = useCallback(
    () => (t: number) =>
      `rgba(0, ${Math.round(220 * t)}, ${Math.round(120 * t)}, ${t * 0.45})`,
    []
  );

  const { pinPoints, pinLabels } = useMemo(() => {
    type PinPoint = { lat: number; lon: number; color: string; radius: number };
    type PinLabel = { lat: number; lon: number; text: string; color: string };

    const points: PinPoint[] = [];
    const labels: PinLabel[] = [];

    const sameAsIp = (site: { lat: number; lon: number } | null) =>
      site !== null &&
      ipLocation !== null &&
      Math.abs(site.lat - ipLocation.lat) < 0.01 &&
      Math.abs(site.lon - ipLocation.lon) < 0.01;

    if (ipLocation) {
      points.push({ lat: ipLocation.lat, lon: ipLocation.lon, color: '#7dd3fc', radius: 0.4 });
      labels.push({
        lat: ipLocation.lat,
        lon: ipLocation.lon,
        text: ipLocation.country ? `${ipLocation.city}, ${ipLocation.country}` : ipLocation.city,
        color: 'rgba(125,211,252,0.75)',
      });
    }

    if (selectedSite && !sameAsIp(selectedSite)) {
      points.push({ lat: selectedSite.lat, lon: selectedSite.lon, color: '#3dffa0', radius: 0.35 });
    }

    return { pinPoints: points, pinLabels: labels };
  }, [ipLocation, selectedSite]);

  return (
    <div ref={containerRef} className="flex-1" style={{ height: '100%' }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        // Textures loaded in custom material — don't pass URLs here
        globeMaterial={globeMaterial}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#2a6ab0"
        atmosphereAltitude={0.22}
        onGlobeReady={handleGlobeReady}
        heatmapsData={[heatmapPoints]}
        heatmapPointLat="lat"
        heatmapPointLng="lon"
        heatmapPointWeight="weight"
        heatmapBandwidth={3.5}
        heatmapColorFn={heatmapColorFn}
        pointsData={pinPoints}
        pointLat={(d: object) => (d as { lat: number }).lat}
        pointLng={(d: object) => (d as { lon: number }).lon}
        pointColor={(d: object) => (d as { color: string }).color}
        pointRadius={(d: object) => (d as { radius: number }).radius}
        pointAltitude={0.01}
        pointsMerge={false}
        labelsData={pinLabels}
        labelLat={(d: object) => (d as { lat: number }).lat}
        labelLng={(d: object) => (d as { lon: number }).lon}
        labelText={(d: object) => (d as { text: string }).text}
        labelColor={(d: object) => (d as { color: string }).color}
        labelSize={0.45}
        labelDotRadius={0}
        labelAltitude={0.015}
        labelResolution={2}
      />
    </div>
  );
}
