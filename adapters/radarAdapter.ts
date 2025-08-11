import { cacheGet, cacheSet } from '@/lib/redis';
import { config } from '@/lib/config';

export type RadarFrame = {
  time: number; // unix seconds
  urlTemplate: string; // Tile URL template
};

export type RadarEta = {
  etaMin: number | null;
  durationMin: number | null;
  intensity: 'none' | 'light' | 'moderate' | 'heavy';
};

export async function getFrames(): Promise<RadarFrame[]> {
  if (config.useMock) {
    const now = Math.floor(Date.now() / 1000);
    return [0, 10, 20].map((m) => ({ time: now - m * 60, urlTemplate: 'mock' }));
  }

  const cacheKey = 'radar:frames';
  const cached = await cacheGet<RadarFrame[]>(cacheKey);
  if (cached) return cached;

  // RainViewer public API v3 example list
  // We will use tilecache times list endpoint
  try {
    const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      headers: { 'User-Agent': 'Weatherman/1.0' },
    });
    const data = (await resp.json()) as any;
    const times: number[] = data.radar.nowcast?.slice(-3) || [];
    const frames: RadarFrame[] = times.map((t) => ({
      time: t,
      urlTemplate: `https://tilecache.rainviewer.com/v2/radar/${t}/256/{z}/{x}/{y}/2/1_1.png`,
    }));
    await cacheSet(cacheKey, frames, 300);
    return frames;
  } catch (e) {
    return [];
  }
}

// Minimal ETA estimation: checks a small set of Hyderabad-centered tiles across the last frames
export async function estimateEtaForArea(
  areaCenter: { lat: number; lng: number },
  frames: RadarFrame[],
): Promise<RadarEta> {
  if (frames.length < 2) return { etaMin: null, durationMin: null, intensity: 'none' };
  // For MVP: probe a fixed zoom tile around centroid; if rain pixels increase closer to center, estimate ETA
  // Heuristic: if last frame shows rain at centroid tile → ongoing (eta 0–20, duration 20–40)
  // if previous frame shows rain in adjacent tiles but not current, eta 20–60
  try {
    const z = 10; // coarse zoom
    // Convert lat/lng to XYZ tile
    const tile = (lat: number, lng: number, zoom: number) => {
      const n = Math.pow(2, zoom);
      const xtile = Math.floor(((lng + 180) / 360) * n);
      const ytile = Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
          n,
      );
      return { x: xtile, y: ytile };
    };
    const { x, y } = tile(areaCenter.lat, areaCenter.lng, z);
    const last = frames[frames.length - 1]!;
    const prev = frames[frames.length - 2]!;
    const lastUrl: string = last.urlTemplate
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
    const prevUrl: string = prev.urlTemplate
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
    const resLast = await fetch(lastUrl, { headers: { 'User-Agent': 'Weatherman/1.0' } });
    const resPrev = await fetch(prevUrl, { headers: { 'User-Agent': 'Weatherman/1.0' } });
    if (!resLast.ok || !resPrev.ok) throw new Error('tile error');
    const bufLast: ArrayBuffer = await resLast.arrayBuffer();
    const bufPrev: ArrayBuffer = await resPrev.arrayBuffer();
    // Simple presence check: non-empty pixels implies rain; we will approximate intensity by byte variance
    const varOf = (arr: Uint8Array) => {
      if (arr.length === 0) return 0;
      let sum = 0;
      for (let i = 0; i < arr.length; i++) sum += arr[i]!;
      const mean = sum / arr.length;
      let v = 0;
      for (let i = 0; i < arr.length; i++) v += (arr[i]! - mean) ** 2;
      return v / arr.length;
    };
    const aLast = new Uint8Array(bufLast);
    const aPrev = new Uint8Array(bufPrev);
    const vLast = varOf(aLast);
    const vPrev = varOf(aPrev);
    const hadRainPrev = vPrev > 50;
    const hasRainNow = vLast > 50;
    const intensity: RadarEta['intensity'] = hasRainNow ? (vLast > 120 ? 'heavy' : vLast > 80 ? 'moderate' : 'light') : hadRainPrev ? 'light' : 'none';
    if (hasRainNow) return { etaMin: 0, durationMin: 30, intensity };
    if (hadRainPrev) return { etaMin: 30, durationMin: 30, intensity };
    return { etaMin: null, durationMin: null, intensity: 'none' };
  } catch {
    return { etaMin: null, durationMin: null, intensity: 'none' };
  }
}


