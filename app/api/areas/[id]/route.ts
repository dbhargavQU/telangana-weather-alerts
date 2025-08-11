import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatLocalWindow, safeRangeFromCenter } from '@/lib/time';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const area = await prisma.area.findUnique({ where: { id } });
  if (!area) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const alert = await prisma.alert.findFirst({ where: { areaId: area.id }, orderBy: { issuedAt: 'desc' } });
  const obs = await prisma.observation.findFirst({ where: { areaId: area.id }, orderBy: { observedAt: 'desc' } });
  const features = obs
    ? {
        radar: { etaMin: (obs as any).radarEtaMin, durationMin: (obs as any).radarDuration, intensity: (obs as any).radarIntensity },
        meteo: { precipHour: (obs as any).precipHour, probability: (obs as any).probability, intensity: (obs as any).intensityClass },
      }
    : null;

  const fmtMm = (n: number) => {
    const v = Math.round(n * 10) / 10;
    return Number.isFinite(v) ? (v % 1 === 0 ? String(v.toFixed(0)) : String(v)) : '0';
  };
  const fmtPct = (n: number | null | undefined) => {
    const v = Math.max(0, Math.min(100, Math.round(n ?? 0)));
    return v;
  };
  const intensityFromMmh = (mmh: number): 'none'|'light'|'moderate'|'heavy'|'very heavy' => {
    if (mmh < 0.2) return 'none';
    if (mmh < 1.0) return 'light';
    if (mmh < 4.0) return 'moderate';
    if (mmh < 15.0) return 'heavy';
    return 'very heavy';
  };
  const teWord = (w: string) => {
    switch (w) {
      case 'light': return 'తేలిక';
      case 'moderate': return 'మోస్తరు';
      case 'heavy': return 'భారీ';
      case 'very heavy': return 'అతి భారీ';
      default: return '';
    }
  };

  // Derived NOW data contract with text
  const now = obs ? (() => {
    const mmh = Number((obs as any).precipHour ?? 0) || 0;
    const mmhLow = Math.max(0, Math.round(mmh * 0.7 * 10) / 10);
    const mmhHigh = Math.max(mmhLow, Math.round(mmh * 1.3 * 10) / 10);
    const intensity = intensityFromMmh(mmh);
    const confidencePct = fmtPct(alert?.confidence ? alert.confidence * 100 : (obs as any).nowProb ?? 0);
    const timeLabel = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date());
    let en = '';
    let te = '';
    const eta = safeRangeFromCenter((obs as any).radarEtaMin ?? null, 10);
    const dur = safeRangeFromCenter((obs as any).radarDuration ?? null, 15);
    const etaPartEn = eta.from!=null && eta.to!=null ? ` in ${eta.from}–${eta.to} min` : '';
    const etaPartTe = eta.from!=null && eta.to!=null ? `లో ${eta.from}–${eta.to} నిమి.` : '';
    if (mmhHigh < 0.2 && ((obs as any).nowProb ?? 0) < 30) {
      en = 'Quiet now (next 1–3 hr).';
      te = 'ఇప్పుడు ప్రశాంతం (తదుపరి 1–3 గం.).';
    } else if (mmhHigh < 0.2 && ((obs as any).nowProb ?? 0) >= 30) {
      en = 'Drizzle possible next 1–3 hr.';
      te = 'తదుపరి 1–3 గం. స్వల్ప జల్లులు అవకాశం.';
    } else {
      en = `${intensity} rain (${fmtMm(mmhLow)}–${fmtMm(mmhHigh)} mm/h)${etaPartEn}; lasts ~${dur.from ?? 30}–${dur.to ?? 60} min.`;
      te = `${teWord(intensity)} వర్షం (${fmtMm(mmhLow)}–${fmtMm(mmhHigh)} మి.మీ/గం)${etaPartTe}; ~${dur.from ?? 30}–${dur.to ?? 60} నిమి. పాటు.`;
      if (confidencePct < 50) {
        // omit % conf in sentence for cleanliness; badges can still show
      } else {
        en += ` ${confidencePct}% conf.`;
        te += ` ${confidencePct}% నమ్మకం.`;
      }
    }
    return {
      timeLabel,
      intensityWordNow: intensity,
      mmhLow,
      mmhHigh,
      thunderFlag: false,
      gustLow: null as number | null,
      gustHigh: null as number | null,
      radarEtaMin: safeRangeFromCenter((obs as any).radarEtaMin ?? null, 10),
      radarDuration: safeRangeFromCenter((obs as any).radarDuration ?? null, 15),
      textEn: en.replace(/undefined|NaN/g, '0'),
      textTe: te.replace(/undefined|NaN/g, '0'),
      sources: features?.radar.etaMin != null ? ['Model', 'Radar'] : ['Model'],
      confidence: confidencePct,
      severity: alert?.severity ?? null,
    };
  })() : null;

  // Derived TODAY data contract
  const today = obs ? (() => {
    const three = Number((obs as any).threeHourTotalMm ?? ((obs as any).sumPrecip12h ? (obs as any).sumPrecip12h * 0.25 * 3 : 0)) || 0;
    const threeLow = Math.round(three * 0.7 * 10) / 10;
    const threeHigh = Math.max(threeLow, Math.round(three * 1.3 * 10) / 10);
    const intensityFrom3h = (x: number): 'drizzle'|'light'|'moderate'|'heavy'|'very heavy' => {
      if (x < 1) return 'drizzle';
      if (x < 5) return 'light';
      if (x < 15) return 'moderate';
      if (x < 35) return 'heavy';
      return 'very heavy';
    };
    const intensity = intensityFrom3h(three);
    const prob = Number((obs as any).maxProb12h ?? 0) || 0;
    const windowLabel = formatLocalWindow((obs as any).peakHourLocal ?? null, 3, 'Asia/Kolkata');
    const en = `${fmtMm(threeLow)}–${fmtMm(threeHigh)} mm ${intensity} rain likely ${windowLabel}.${prob>=50?` ${fmtPct(prob)}% conf.`:''}`;
    const te = `${fmtMm(threeLow)}–${fmtMm(threeHigh)} మి.మీ ${teWord(intensity)} వర్షం ${windowLabel} వచ్చే అవకాశం.${prob>=50?` ${fmtPct(prob)}% నమ్మకం.`:''}`;
    return {
      peakHourLocalUTC: (obs as any).peakHourLocal ?? null,
      threeHourTotalMm: three,
      threeMmLow: threeLow,
      threeMmHigh: threeHigh,
      intensityWordToday: intensity,
      maxProb12h: (obs as any).maxProb12h ?? null,
      sumPrecip12h: (obs as any).sumPrecip12h ?? null,
      gustLow: null as number | null,
      gustHigh: null as number | null,
      thunderFlag: false,
      windowLabel,
      textEn: en.replace(/undefined|NaN/g, '0'),
      textTe: te.replace(/undefined|NaN/g, '0'),
      sources: ['Model'],
      confidence: fmtPct(prob),
      severity: alert?.severity ?? null,
    };
  })() : null;

  // Derived WEEK block
  const week = await (async () => {
    const nowDate = new Date();
    const daily = await (prisma as any).forecastDaily.findMany({
      where: { areaId: area.id, date: { gte: new Date(nowDate.toDateString()) } },
      orderBy: { date: 'asc' },
      take: 7,
    });
    const enWeekday = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const teMap: Record<string, string> = { Mon: 'సోమ', Tue: 'మంగళ', Wed: 'బుధ', Thu: 'గురు', Fri: 'శుక్ర', Sat: 'శని', Sun: 'ఆది' };
    return daily.map((d: any) => {
      const mm = Number(d.precipitationSum ?? 0) || 0;
      const maxProb = Number(d.precipitationProbabilityMax ?? 0) || 0;
      const low = Math.round(mm * 0.7 * 10) / 10;
      const high = Math.max(low, Math.round(mm * 1.3 * 10) / 10);
      const weekday = enWeekday.format(d.date);
      const intensity = mm < 1 ? 'drizzle' : mm <= 15 ? 'light' : mm <= 64.4 ? 'moderate' : mm <= 115.5 ? 'heavy' : 'very heavy';
      const intenTe = intensity === 'drizzle' ? 'జల్లులు' : teWord(intensity);
      let en: string;
      let te: string;
      if (mm < 1 && maxProb < 40) {
        en = `Mostly dry on ${weekday}.${maxProb>=50?` ${fmtPct(maxProb)}% conf.`:''}`;
        te = `ముఖ్యంగా ఎండ ${weekday}.${maxProb>=50?` ${fmtPct(maxProb)}% నమ్మకం.`:''}`;
      } else {
        const range = low !== high ? `${fmtMm(low)}–${fmtMm(high)} mm ` : `${fmtMm(mm)} mm `;
        en = `${range}${intensity} likely on ${weekday}.${maxProb>=50?` ${fmtPct(maxProb)}% conf.`:''}`;
        te = `${range.replace('mm','మి.మీ ')}${intenTe} అవకాశం ${weekday}.${maxProb>=50?` ${fmtPct(maxProb)}% నమ్మకం.`:''}`;
      }
      return {
        date: d.date,
        mmLow: low,
        mmHigh: high,
        intensityWord: intensity,
        maxProb: maxProb,
        textEn: en.replace(/undefined|NaN|null/g, ''),
        textTe: te.replace(/undefined|NaN|null/g, ''),
        sources: ['Model'],
      };
    });
  })();

  return NextResponse.json({ area, alert, observation: obs, features, now, today, week });
}


