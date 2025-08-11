import { cacheGet, cacheSet } from '@/lib/redis';
import { config } from '@/lib/config';

export type OpenMeteoPoint = {
  lat: number;
  lng: number;
  precipHour: number | null; // mm/hr
  probability: number | null; // %
  intensityClass: 'none' | 'light' | 'moderate' | 'heavy';
  stale: boolean;
};

function classifyIntensity(mmPerHour: number | null): 'none' | 'light' | 'moderate' | 'heavy' {
  const v = mmPerHour ?? 0;
  if (v < 0.2) return 'none';
  if (v < 1.0) return 'light';
  if (v < 4.0) return 'moderate';
  return 'heavy';
}

export async function getAreaPoint(lat: number, lng: number): Promise<OpenMeteoPoint> {
  const key = `openmeteo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = await cacheGet<OpenMeteoPoint>(key);
  if (cached) return cached;
  const url = `${config.openMeteoBase}?latitude=${lat}&longitude=${lng}&hourly=precipitation,precipitation_probability&timezone=Asia/Kolkata&past_hours=1&forecast_hours=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Weatherman/1.0' } });
    const data = (await res.json()) as any;
    const times: string[] = data?.hourly?.time ?? [];
    const probs: Array<number | null> = data?.hourly?.precipitation_probability ?? [];
    const precs: Array<number | null> = data?.hourly?.precipitation ?? [];
    let idx = 0;
    if (times.length > 0) {
      const nowIsoHr = new Date().toISOString().slice(0, 13);
      idx = Math.max(
        0,
        times.findIndex((t) => t.slice(0, 13) === nowIsoHr),
      );
      if (idx === -1) idx = 0;
    }
    const prob = probs[idx] ?? probs[0] ?? null;
    const precip = precs[idx] ?? precs[0] ?? null;
    const p: OpenMeteoPoint = {
      lat,
      lng,
      precipHour: typeof precip === 'number' ? precip : null,
      probability: typeof prob === 'number' ? prob : null,
      intensityClass: classifyIntensity(typeof precip === 'number' ? precip : null),
      stale: false,
    };
    await cacheSet(key, p, 900);
    return p;
  } catch {
    // mark stale when failing and return null metrics
    const p: OpenMeteoPoint = {
      lat,
      lng,
      precipHour: null,
      probability: null,
      intensityClass: 'none',
      stale: true,
    };
    return p;
  }
}

export type OpenMeteoRow = {
  areaId: string;
  name: string;
  lat: number;
  lng: number;
  precipHour: number;
  probability: number;
  intensityClass: 'none' | 'light' | 'moderate' | 'heavy';
  stale: boolean;
};

export async function getAllAreasPoints(
  areas: Array<{ id: string; name: string; centroidLat: number | null; centroidLng: number | null }>,
): Promise<OpenMeteoRow[]> {
  const rows: OpenMeteoRow[] = [];
  for (const a of areas) {
    const lat = a.centroidLat ?? 17.385;
    const lng = a.centroidLng ?? 78.486;
    try {
      const p = await getAreaPoint(lat, lng);
      rows.push({
        areaId: a.id,
        name: a.name,
        lat,
        lng,
        precipHour: p.precipHour ?? 0,
        probability: p.probability ?? 0,
        intensityClass: p.intensityClass,
        stale: p.stale,
      });
    } catch {
      console.warn('OpenMeteo missing data for area', a.id);
      rows.push({ areaId: a.id, name: a.name, lat, lng, precipHour: 0, probability: 0, intensityClass: 'none', stale: true });
    }
  }
  return rows;
}

export async function getNext12hSummary(lat: number, lng: number): Promise<{
  nowProb: number | null;
  maxProb12h: number | null;
  sumPrecip12h: number | null;
  peakHourLocal: Date | null;
}> {
  try {
    const url = `${config.openMeteoBase}?latitude=${lat}&longitude=${lng}&hourly=precipitation,precipitation_probability&timezone=Asia/Kolkata&forecast_hours=24`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Weatherman/1.0' } });
    const data = (await res.json()) as any;
    const times: string[] = data?.hourly?.time ?? [];
    const probs: number[] = data?.hourly?.precipitation_probability ?? [];
    const precs: number[] = data?.hourly?.precipitation ?? [];
    if (times.length === 0) return { nowProb: null, maxProb12h: null, sumPrecip12h: null, peakHourLocal: null };
    const now = new Date();
    const tzNowStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const hourStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', hour: '2-digit' }).format(now); // HH
    // find closest hour index (floor to hour)
    let idx = times.findIndex((t) => t.slice(0, 13) === now.toISOString().slice(0, 13));
    if (idx < 0) idx = 0;
    const window = probs.slice(idx, idx + 12);
    const windowPrec = precs.slice(idx, idx + 12);
    const maxProb = window.length ? Math.max(...window.filter((x) => typeof x === 'number')) : null;
    const sumPrec = windowPrec.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    // peak hour local string
    let peakIdx = idx;
    if (window.length) {
      const rel = window.indexOf(maxProb ?? 0);
      peakIdx = idx + Math.max(0, rel);
    }
    const peakStr = times[peakIdx] ?? null; // local ISO string
    const peakHourLocal = peakStr ? new Date(peakStr) : null;
    const nowProb = probs[idx] ?? null;
    return { nowProb, maxProb12h: maxProb, sumPrecip12h: sumPrec, peakHourLocal };
  } catch {
    return { nowProb: null, maxProb12h: null, sumPrecip12h: null, peakHourLocal: null };
  }
}

export async function get7DayDaily(lat: number, lng: number): Promise<
  Array<{
    date: string;
    precipitation_sum: number | null;
    precipitation_probability_max: number | null;
    temperature_2m_max: number | null;
    temperature_2m_min: number | null;
  }>
> {
  const url = `${config.openMeteoBase}?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Weatherman/1.0' } });
    const data = (await res.json()) as any;
    const days: string[] = data?.daily?.time ?? [];
    const ps: Array<number | null> = data?.daily?.precipitation_sum ?? [];
    const pmax: Array<number | null> = data?.daily?.precipitation_probability_max ?? [];
    const tmax: Array<number | null> = data?.daily?.temperature_2m_max ?? [];
    const tmin: Array<number | null> = data?.daily?.temperature_2m_min ?? [];
    return days.map((d, i) => ({
      date: d,
      precipitation_sum: ps[i] ?? null,
      precipitation_probability_max: pmax[i] ?? null,
      temperature_2m_max: tmax[i] ?? null,
      temperature_2m_min: tmin[i] ?? null,
    }));
  } catch {
    return [];
  }
}


