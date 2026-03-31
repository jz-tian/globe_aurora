import { computeTopSites } from '@/components/utils/topSites';
import type { AuroraPoint } from '@/components/utils/noaa';

jest.mock('@/public/data/cities.json', () => [
  { name: 'Tromsø', country: 'Norway', lat: 69.6, lon: 18.9 },
  { name: 'Fairbanks', country: 'USA', lat: 64.8, lon: -147.7 },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1, lon: -21.9 },
  { name: 'Ushuaia', country: 'Argentina', lat: -54.8, lon: -68.3 },
]);

describe('computeTopSites', () => {
  it('returns results sorted by intensity descending', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: -147.7, lat: 64.8, intensity: 60 },
      { lon: -21.9, lat: 64.1, intensity: 40 },
    ];
    const result = computeTopSites(coords, 3);
    expect(result[0].intensity).toBe(80);
    expect(result[1].intensity).toBe(60);
    expect(result[2].intensity).toBe(40);
  });

  it('respects n limit', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: -147.7, lat: 64.8, intensity: 60 },
      { lon: -21.9, lat: 64.1, intensity: 40 },
    ];
    const result = computeTopSites(coords, 2);
    expect(result).toHaveLength(2);
  });

  it('deduplicates by nearest city — two nearby points map to same city', () => {
    const coords: AuroraPoint[] = [
      { lon: 18.9, lat: 69.6, intensity: 80 },
      { lon: 18.5, lat: 69.4, intensity: 75 }, // also nearest to Tromsø
      { lon: -147.7, lat: 64.8, intensity: 60 },
    ];
    const result = computeTopSites(coords, 10);
    const names = result.map(s => s.city.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tags northern hemisphere correctly', () => {
    const coords: AuroraPoint[] = [{ lon: 18.9, lat: 69.6, intensity: 80 }];
    const result = computeTopSites(coords, 10);
    expect(result[0].hemisphere).toBe('N');
  });

  it('tags southern hemisphere correctly', () => {
    const coords: AuroraPoint[] = [{ lon: -68.3, lat: -54.8, intensity: 70 }];
    const result = computeTopSites(coords, 10);
    expect(result[0].hemisphere).toBe('S');
  });

  it('returns empty array for empty input', () => {
    expect(computeTopSites([], 10)).toHaveLength(0);
  });
});
