export type LngLat = { lng: number; lat: number };

export function centroidOfPolygon(coords: number[][][]): { lat: number; lng: number } {
  // Simple bbox center for MVP
  const ring = coords?.[0] ?? [];
  const lngs = ring.map((p) => p?.[0] ?? 0);
  const lats = ring.map((p) => p?.[1] ?? 0);
  const minLng = Math.min(...(lngs.length ? lngs : [0]));
  const maxLng = Math.max(...(lngs.length ? lngs : [0]));
  const minLat = Math.min(...(lats.length ? lats : [0]));
  const maxLat = Math.max(...(lats.length ? lats : [0]));
  return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

export function kmBetween(a: LngLat, b: LngLat): number {
  // Haversine
  const R = 6371;
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const la1 = deg2rad(a.lat);
  const la2 = deg2rad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  const d = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * d;
}

export function bearingDegrees(a: LngLat, b: LngLat): number {
  const la1 = deg2rad(a.lat);
  const la2 = deg2rad(b.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  const brng = Math.atan2(y, x);
  return (rad2deg(brng) + 360) % 360;
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}
function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}


