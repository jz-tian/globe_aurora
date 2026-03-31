import { getSunDirection, getSunSubsolarPoint } from '@/components/utils/sunPosition';

describe('getSunDirection', () => {
  it('returns a unit vector', () => {
    const dir = getSunDirection(new Date('2024-06-21T12:00:00Z'));
    const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    expect(length).toBeCloseTo(1.0, 3);
  });

  it('sun declination is ~+23.5° at northern summer solstice', () => {
    const { lat } = getSunSubsolarPoint(new Date('2024-06-21T12:00:00Z'));
    expect(Math.abs(lat - 23.5)).toBeLessThan(1.5);
  });

  it('sun declination is ~-23.5° at northern winter solstice', () => {
    const { lat } = getSunSubsolarPoint(new Date('2024-12-21T12:00:00Z'));
    expect(Math.abs(lat - (-23.5))).toBeLessThan(1.5);
  });

  it('sun subsolar longitude differs by ~180° between noon and midnight UTC', () => {
    const { lon: lonNoon } = getSunSubsolarPoint(new Date('2024-03-20T12:00:00Z'));
    const { lon: lonMidnight } = getSunSubsolarPoint(new Date('2024-03-20T00:00:00Z'));
    const diff = Math.abs(lonNoon - lonMidnight);
    // Should be close to 180°, allow ±20° for approximation
    expect(diff).toBeGreaterThan(160);
    expect(diff).toBeLessThan(200);
  });
});
