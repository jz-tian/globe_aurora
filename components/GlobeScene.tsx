'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { AuroraPoint } from './utils/noaa';
import { createAuroraMesh } from './AuroraShader';
import { createDayNightMesh } from './DayNightShader';
import { createStarField } from './StarField';
import { getSunDirection } from './utils/sunPosition';

const GLOBE_RADIUS = 100; // react-globe.gl default

interface Props {
  auroraData: AuroraPoint[];
  selectedSite: { lat: number; lon: number } | null;
}

export default function GlobeScene({ auroraData, selectedSite }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const auroraMeshRef = useRef<THREE.Mesh | null>(null);
  const dayNightMeshRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);

  // Derive aurora uniforms from data
  const intensities = auroraData.map(p => p.intensity);
  const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : 0;
  const northMax = auroraData
    .filter(p => p.lat > 0)
    .reduce((m, p) => Math.max(m, p.intensity), 0);
  const southMax = auroraData
    .filter(p => p.lat < 0)
    .reduce((m, p) => Math.max(m, p.intensity), 0);

  // Update aurora shader uniforms when data changes
  useEffect(() => {
    if (!auroraMeshRef.current) return;
    const uniforms = (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms;
    uniforms.uIntensityScale.value = maxIntensity / 100;
    uniforms.uNorthActive.value = northMax / 100;
    uniforms.uSouthActive.value = southMax / 100;
  }, [maxIntensity, northMax, southMax]);

  // Navigate to selected site
  useEffect(() => {
    if (!selectedSite || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: selectedSite.lat, lng: selectedSite.lon, altitude: 1.5 },
      1500
    );
  }, [selectedSite]);

  // Animation loop: update uTime and sun direction every frame
  const startAnimation = useCallback(() => {
    const tick = () => {
      const t = performance.now() / 1000;

      if (auroraMeshRef.current) {
        (auroraMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      }

      if (dayNightMeshRef.current) {
        const sunDir = getSunDirection(new Date());
        const uni = (dayNightMeshRef.current.material as THREE.ShaderMaterial).uniforms;
        uni.uSunDirection.value.set(sunDir.x, sunDir.y, sunDir.z);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const scene = globeRef.current.scene();

    // Star field (fixed in scene, doesn't orbit with camera)
    scene.add(createStarField());

    // Day/night overlay
    const dayNight = createDayNightMesh(GLOBE_RADIUS);
    scene.add(dayNight);
    dayNightMeshRef.current = dayNight;

    // Aurora shader sphere
    const aurora = createAuroraMesh(GLOBE_RADIUS * 1.02);
    scene.add(aurora);
    auroraMeshRef.current = aurora;

    // Set initial aurora uniforms if data already loaded
    if (maxIntensity > 0) {
      const uniforms = (aurora.material as THREE.ShaderMaterial).uniforms;
      uniforms.uIntensityScale.value = maxIntensity / 100;
      uniforms.uNorthActive.value = northMax / 100;
      uniforms.uSouthActive.value = southMax / 100;
    }

    startAnimation();
  }, [startAnimation, maxIntensity, northMax, southMax]);

  // Cleanup animation loop on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Responsive dimensions
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

  // Heatmap data: weight = intensity normalized to 0–1
  const heatmapPoints = auroraData.map(p => ({
    lat: p.lat,
    lon: p.lon,
    weight: p.intensity / 100,
  }));

  return (
    <div ref={containerRef} className="flex-1" style={{ height: '100%' }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="/textures/earth_day.jpg"
        bumpImageUrl="/textures/earth_bump.jpg"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#1a4a8a"
        atmosphereAltitude={0.18}
        onGlobeReady={handleGlobeReady}
        heatmapsData={[heatmapPoints]}
        heatmapPointLat="lat"
        heatmapPointLng="lon"
        heatmapPointWeight="weight"
        heatmapBandwidth={3.5}
        heatmapColorFn={(t: number) =>
          `rgba(0, ${Math.round(220 * t)}, ${Math.round(120 * t)}, ${t * 0.45})`
        }
      />
    </div>
  );
}
