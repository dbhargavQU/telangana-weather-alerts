import { load } from 'cheerio';
import { cacheGet, cacheSet } from '@/lib/redis';
import { config } from '@/lib/config';

export async function getDistrictText(): Promise<Record<string, string>> {
  if (config.useMock) {
    return { Hyderabad: 'Light to moderate rain likely in parts in next 2 hours.' };
  }
  const cacheKey = 'nowcast:texts';
  const cached = await cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;
  const url = config.imdNowcastUrl;
  if (!url) return {};
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'WeathermanBot/1.0' } });
    const html = await res.text();
    const $ = load(html);
    const out: Record<string, string> = {};
    $('div, p, li').each((_, el) => {
      const text = $(el).text().trim();
      if (/Hyderabad/i.test(text)) {
        out['Hyderabad'] = text;
      }
    });
    await cacheSet(cacheKey, out, 600);
    return out;
  } catch (e) {
    return {};
  }
}


