import OpenAI from 'openai';
import { config } from '@/lib/config';

export type TweetParts = {
  textEn: string;
  textTe: string;
  hashtags: string[];
};

const client = config.openAiKey ? new OpenAI({ apiKey: config.openAiKey }) : null;

export async function formatTweetBalajiStyle(input: string, isHyd: boolean): Promise<TweetParts | null> {
  if (!client) return null;
  const sys = 'You write compact bilingual weather alerts for Telangana. Use the numbers given exactly. Keep total under 280 chars. English first, then Telugu. Use 1–2 emojis only. Clear and calm tone. Output JSON only with keys: text_en, text_te, hashtags (array).';
  try {
    const c = await client.chat.completions.create({
      model: config.aiModel,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: input + '\n(Respond in json.)' },
      ],
    });
    const txt = c.choices[0]?.message?.content ?? '';
    const json = JSON.parse(txt);
    const hashtags: string[] = Array.isArray(json.hashtags) ? json.hashtags : [];
    const enforced = isHyd ? Array.from(new Set([...hashtags, '#TelanganaWeather', '#HyderabadRains'])) : Array.from(new Set([...hashtags, '#TelanganaWeather']));
    return { textEn: String(json.text_en || ''), textTe: String(json.text_te || ''), hashtags: enforced };
  } catch {
    return null;
  }
}

export function formatTweetFallback(params: {
  area: string;
  scope: 'now' | 'today' | 'week';
  intensity: string;
  etaFrom?: number | null; etaTo?: number | null;
  mmhLow?: number | null; mmhHigh?: number | null;
  windowLabel?: string | null;
  threeLow?: number | null; threeHigh?: number | null;
  source: 'Model' | 'Model+Radar';
}): TweetParts {
  const { area, scope, intensity, etaFrom, etaTo, mmhLow, mmhHigh, windowLabel, threeLow, threeHigh, source } = params;
  let enLead = '';
  if (scope === 'now') {
    enLead = `${intensity} in ~${etaFrom ?? '?'}–${etaTo ?? '?'} min (${mmhLow ?? '?'}–${mmhHigh ?? '?'} mm/h).`;
    if (windowLabel) enLead += ` Window ${windowLabel}.`;
  } else if (scope === 'today') {
    enLead = `${intensity} ${threeLow ?? '?'}–${threeHigh ?? '?'} mm likely ${windowLabel || 'later today'}.`;
  } else {
    enLead = `${intensity} expected this week.`;
  }
  const textEn = `${area}: ${enLead} ( ${source} )`.trim();
  // Simple Telugu mapping
  const teIntensity = intensity === 'drizzle' ? 'జల్లులు' : intensity === 'light' ? 'తేలిక' : intensity === 'moderate' ? 'మోస్తరు' : intensity === 'heavy' ? 'భారీ' : 'అత్యంత భారీ';
  let teLead = '';
  if (scope === 'now') {
    teLead = `${teIntensity} ~${etaFrom ?? '?'}–${etaTo ?? '?'} నిమిషాల్లో (${mmhLow ?? '?'}–${mmhHigh ?? '?'} మి.మీ/గం).`;
    if (windowLabel) teLead += ` విండో ${windowLabel}.`;
  } else if (scope === 'today') {
    teLead = `${teIntensity} ${threeLow ?? '?'}–${threeHigh ?? '?'} మి.మీ ${windowLabel || 'ఈ రోజు తరువాత'} అవకాశం.`;
  } else {
    teLead = `${teIntensity} ఈ వారం అవకాశం.`;
  }
  const textTe = `${area}: ${teLead} (${source})`;
  return { textEn, textTe, hashtags: ['#TelanganaWeather'] };
}


export async function formatTweetWithAI({
  area,
  now,
  today,
  week,
  scope,
  sourceTag,
}: {
  area: string;
  now?: any;
  today?: any;
  week?: any[];
  scope: 'now' | 'today' | 'week';
  sourceTag: string;
}): Promise<{ textEn: string; textTe: string; meta: { scope: string; area: string; used: 'openai' | 'fallback' } }> {
  const sysPrompt = `You are a formatter that writes short, precise weather alerts for Telangana based on exact numbers provided.
Output both English and Telugu versions.
Use only the given data — do not guess or round beyond one decimal place.
Tone: factual, slightly urgent if severe, compact.
Keep each language ≤ 200 characters.
Include the source tag in parentheses at the end.
Output only JSON: { "textEn": "...", "textTe": "..." }`;

  // Derive when_local for better guidance
  let whenLocal = '';
  if (scope === 'now') {
    const f = Number(now?.eta_from_min);
    const t = Number(now?.eta_to_min);
    if (Number.isFinite(f) && Number.isFinite(t)) whenLocal = `arriving in ${f}–${t} min`;
  } else if (scope === 'today') {
    const wl = today?.window_label ? String(today.window_label) : '';
    if (wl) whenLocal = `${wl} IST`;
  } else {
    whenLocal = 'this week';
  }

  // Map week to required top2 structure if caller passed daily objects with date/mm values
  function mapWeekTop2(input?: any[]): Array<{ weekday: string; low_mm: number; high_mm: number; prob: number }> {
    if (!Array.isArray(input)) return [];
    const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const coerce = (d: any) => {
      if (d && typeof d.weekday === 'string') {
        return { weekday: d.weekday, low_mm: Number(d.low_mm), high_mm: Number(d.high_mm), prob: Number(d.prob ?? 0) };
      }
      const date = d?.date ? new Date(d.date) : undefined;
      const weekday = date ? dayFmt.format(date) : String(d?.weekday || '');
      const low = Number(d?.mmLow ?? d?.low_mm);
      const high = Number(d?.mmHigh ?? d?.high_mm);
      const prob = Number(d?.prob ?? d?.maxProb ?? 0);
      return { weekday, low_mm: low, high_mm: high, prob };
    };
    return input.slice(0, 2).map(coerce).filter((x) => Number.isFinite(x.low_mm) && Number.isFinite(x.high_mm));
  }

  const payload = {
    area,
    scope,
    when_local: whenLocal,
    source_tag: sourceTag,
    now: now
      ? {
          eta_from_min: now?.eta_from_min ?? now?.radarEtaMin?.from ?? null,
          eta_to_min: now?.eta_to_min ?? now?.radarEtaMin?.to ?? null,
          mmh_low: now?.mmh_low ?? now?.mmhLow ?? null,
          mmh_high: now?.mmh_high ?? now?.mmhHigh ?? null,
          thunder: Boolean(now?.thunder ?? now?.thunderFlag ?? false),
        }
      : { eta_from_min: null, eta_to_min: null, mmh_low: null, mmh_high: null, thunder: false },
    today: today
      ? {
          low_mm: today?.low_mm ?? today?.threeMmLow ?? today?.mmLow ?? null,
          high_mm: today?.high_mm ?? today?.threeMmHigh ?? today?.mmHigh ?? null,
          intensity: today?.intensity ?? today?.intensityWordToday ?? null,
          prob: today?.prob ?? today?.maxProb12h ?? null,
          window_label: today?.window_label ?? today?.windowLabel ?? null,
        }
      : { low_mm: null, high_mm: null, intensity: null, prob: null, window_label: null },
    week_top2: mapWeekTop2(week),
  };

  async function callOpenAI() {
    if (!client || !config.openAiKey) throw new Error('no-openai');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const completion = await client.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 250,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysPrompt },
            {
              role: 'user',
              content:
                'json_input:\n' +
                JSON.stringify(payload, (_k, v) => (typeof v === 'number' && Number.isFinite(v) ? Number(v) : v)),
            },
          ],
        },
        { signal: controller.signal },
      );
      const raw = completion.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw);
      const textEn = String(parsed.textEn || parsed.text_en || '').trim();
      const textTe = String(parsed.textTe || parsed.text_te || '').trim();
      if (!textEn || !textTe) throw new Error('bad-json');
      return { textEn, textTe };
    } finally {
      clearTimeout(t);
    }
  }

  function toTeluguWeekday(eng: string): string {
    const map: Record<string, string> = {
      Sun: 'ఆది', Mon: 'సోమ', Tue: 'మంగళ', Wed: 'బుధ', Thu: 'గురు', Fri: 'శుక్ర', Sat: 'శని',
    };
    return map[eng] || eng;
  }

  function buildFallback(): { textEn: string; textTe: string } {
    if (scope === 'now') {
      const f = payload.now.eta_from_min;
      const t = payload.now.eta_to_min;
      const l = payload.now.mmh_low;
      const h = payload.now.mmh_high;
      const thunder = payload.now.thunder;
      const enParts: string[] = [];
      if (l != null && h != null) enParts.push(`${Number(l)}–${Number(h)} mm/h`);
      if (f != null && t != null) enParts.push(`in ${Number(f)}–${Number(t)} min`);
      if (thunder) enParts.push('thunder');
      const textEn = `${area}: ${enParts.join(', ')}. (${sourceTag})`.trim();
      const teParts: string[] = [];
      if (l != null && h != null) teParts.push(`${Number(l)}–${Number(h)} మి.మీ/గం`);
      if (f != null && t != null) teParts.push(`${Number(f)}–${Number(t)} నిమిషాల్లో`);
      if (thunder) teParts.push('మెరుపులు');
      const textTe = `${area}: ${teParts.join(', ')}. (${sourceTag})`;
      return { textEn, textTe };
    }
    if (scope === 'today') {
      const l = payload.today.low_mm;
      const h = payload.today.high_mm;
      const intensity = payload.today.intensity || 'rain';
      const prob = payload.today.prob != null ? `${Number(payload.today.prob)}%` : '';
      const win = payload.today.window_label ? String(payload.today.window_label) : '';
      const textEn = `${area}: ${l ?? '?'}–${h ?? '?'} mm ${String(intensity)} ${win}. ${prob ? `${prob} conf.` : ''} (${sourceTag})`.replace(/\s+/g, ' ').trim();
      const textTe = `${area}: ${l ?? '?'}–${h ?? '?'} మి.మీ ${String(intensity)} ${win}. ${prob ? `${prob} నమ్మకం.` : ''} (${sourceTag})`.replace(/\s+/g, ' ').trim();
      return { textEn, textTe };
    }
    const days = payload.week_top2 || [];
    const enDays = days.map((d) => `${d.weekday} ${d.low_mm}–${d.high_mm} mm (${Math.round(Number(d.prob))}%)`).join(', ');
    const teDays = days
      .map((d) => `${toTeluguWeekday(d.weekday)} ${d.low_mm}–${d.high_mm} మి.మీ (${Math.round(Number(d.prob))}%)`)
      .join(', ');
    const textEn = `${area}: ${enDays}. (${sourceTag})`.trim();
    const textTe = `${area}: ${teDays}. (${sourceTag})`.trim();
    return { textEn, textTe };
  }

  try {
    const ai = await callOpenAI();
    return { ...ai, meta: { scope, area, used: 'openai' } };
  } catch {
    const fb = buildFallback();
    return { ...fb, meta: { scope, area, used: 'fallback' } };
  }
}


