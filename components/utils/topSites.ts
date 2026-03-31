import type { AuroraPoint } from './noaa';
import citiesRaw from '@/public/data/cities.json';

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface TopSite {
  city: City;
  intensity: number;
  hemisphere: 'N' | 'S';
}

const cities = citiesRaw as City[];

function nearestCity(lat: number, lon: number): City {
  let best = cities[0];
  let bestDist = Infinity;
  for (const city of cities) {
    const dist = (city.lat - lat) ** 2 + (city.lon - lon) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = city;
    }
  }
  return best;
}

export function computeTopSites(coordinates: AuroraPoint[], n = 10): TopSite[] {
  const sorted = [...coordinates].sort((a, b) => b.intensity - a.intensity);
  const results: TopSite[] = [];
  const used = new Set<string>();

  for (const point of sorted) {
    if (results.length >= n) break;
    const city = nearestCity(point.lat, point.lon);
    const key = `${city.name}::${city.country}`;
    if (used.has(key)) continue;
    used.add(key);
    results.push({
      city,
      intensity: point.intensity,
      hemisphere: point.lat >= 0 ? 'N' : 'S',
    });
  }

  return results;
}
