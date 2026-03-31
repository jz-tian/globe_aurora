export interface AuroraPoint {
  lon: number;
  lat: number;
  intensity: number; // 0–100
}

export interface AuroraApiResponse {
  coordinates: AuroraPoint[];
  kp: number;
  fetchedAt: number; // Unix ms
}

const OVATION_URL =
  'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const KP_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export async function fetchAuroraData(): Promise<AuroraApiResponse> {
  const [auroraRes, kpRes] = await Promise.all([
    fetch(OVATION_URL, { cache: 'no-store' }),
    fetch(KP_URL, { cache: 'no-store' }),
  ]);

  const auroraJson = await auroraRes.json();
  const kpJson = (await kpRes.json()) as string[][];

  const coordinates: AuroraPoint[] = (
    auroraJson.coordinates as [number, number, number][]
  )
    .filter(([, , intensity]) => intensity > 0)
    .map(([lon, lat, intensity]) => ({ lon, lat, intensity }));

  // First row is header; last data row has the most recent Kp
  const kpRows = kpJson.slice(1);
  const latestKpStr = kpRows[kpRows.length - 1]?.[1] ?? '';
  const kp = parseFloat(latestKpStr);

  return {
    coordinates,
    kp: isNaN(kp) ? 0 : kp,
    fetchedAt: Date.now(),
  };
}
