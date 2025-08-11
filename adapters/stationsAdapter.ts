import { load } from 'cheerio';
import { cacheGet, cacheSet } from '@/lib/redis';
import { config } from '@/lib/config';

export type Station = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  rain15: number;
  rain60: number;
  updatedAtMinAgo: number | null;
};

export async function getLatest(): Promise<Station[]> {
  if (config.useMock) {
    const now = Date.now();
    return [
      { id: 'mock1', name: 'LB Nagar AWS', rain15: Math.random() * 2, rain60: Math.random() * 8, updatedAtMinAgo: 5 },
      { id: 'mock2', name: 'Kukatpally AWS', rain15: Math.random() * 2, rain60: Math.random() * 8, updatedAtMinAgo: 7 },
    ];
  }

  const cacheKey = 'stations:latest';
  const cached = await cacheGet<Station[]>(cacheKey);
  if (cached) return cached;

  const url = config.tsdpsUrl;
  if (!url) return [];
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'WeathermanBot/1.0' } });
    const html = await resp.text();
    const $ = load(html);

    // MVP: find table rows and parse rain columns by header names
    const stations: Station[] = [];
    $('table tr').each((_, el) => {
      const tds = $(el).find('td');
      if (tds.length < 4) return;
      const name = $(tds[0]).text().trim();
      const rain15 = parseFloat($(tds[1]).text().trim()) || 0;
      const rain60 = parseFloat($(tds[2]).text().trim()) || 0;
      const updated = $(tds[3]).text().trim();
      const updatedAtMinAgo = /min/.test(updated)
        ? parseInt(updated.replace(/[^0-9]/g, '')) || null
        : null;
      stations.push({ id: name, name, rain15, rain60, updatedAtMinAgo });
    });

    await cacheSet(cacheKey, stations, 300);
    return stations;
  } catch (e) {
    return [];
  }
}


