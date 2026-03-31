import { fetchAuroraData } from '@/components/utils/noaa';

global.fetch = jest.fn();

describe('fetchAuroraData', () => {
  beforeEach(() => jest.resetAllMocks());

  it('filters out zero-intensity points and parses coordinates', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          coordinates: [[-180, 65, 0], [10, 70, 45], [20, 72, 80]],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => [
          ['time_tag', 'Kp'],
          ['2024-01-01 00:00:00', '3.33'],
        ],
      });

    const result = await fetchAuroraData();

    expect(result.coordinates).toHaveLength(2);
    expect(result.coordinates[0]).toEqual({ lon: 10, lat: 70, intensity: 45 });
    expect(result.coordinates[1]).toEqual({ lon: 20, lat: 72, intensity: 80 });
  });

  it('parses Kp from the last row of kp response', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({
        json: async () => [
          ['time_tag', 'Kp'],
          ['2024-01-01 00:00:00', '1.00'],
          ['2024-01-01 00:03:00', '4.67'],
        ],
      });

    const result = await fetchAuroraData();
    expect(result.kp).toBeCloseTo(4.67);
  });

  it('returns kp=0 when kp data has only a header row', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({ json: async () => [['time_tag', 'Kp']] });

    const result = await fetchAuroraData();
    expect(result.kp).toBe(0);
  });

  it('includes fetchedAt timestamp', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ coordinates: [] }) })
      .mockResolvedValueOnce({ json: async () => [['time_tag', 'Kp']] });

    const before = Date.now();
    const result = await fetchAuroraData();
    const after = Date.now();

    expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAt).toBeLessThanOrEqual(after);
  });
});
