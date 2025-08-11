import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db';
import type { Severity } from '@prisma/client';
import { logInfo } from '@/lib/logger';
import { getDistrictText } from '@/adapters/nowcastAdapter';
import { getAreaPoint, getNext12hSummary, get7DayDaily } from '@/adapters/openMeteoAdapter';
import { estimateEtaForArea, getFrames } from '@/adapters/radarAdapter';
import { AreaFeaturesSchema, type AreaFeatures } from '@/lib/zodSchemas';
import { evaluateRules } from '@/lib/ruleEngine';
import { createBilingualAlert } from '@/lib/aiFormatter';
import { formatLocalWindow } from '@/lib/time';
function capitalize(s?: string) { return (s ?? '').charAt(0).toUpperCase() + (s ?? '').slice(1); }
function teluguIntensity(i?: string) {
  switch (i) {
    case 'heavy': return 'భారీ';
    case 'moderate': return 'మోస్తరు';
    case 'light': return 'తేలిక';
    default: return 'సన్నని';
  }
}
function wordFromThreeHour(x: number): 'none'|'light'|'moderate'|'heavy'|'very heavy' {
  if (x < 1) return 'none';
  if (x < 5) return 'light';
  if (x < 15) return 'moderate';
  if (x < 35) return 'heavy';
  return 'very heavy';
}
function wordFromThreeHourTe(x: number): string {
  const w = wordFromThreeHour(x);
  switch (w) {
    case 'light': return 'తేలిక';
    case 'moderate': return 'మోస్తరు';
    case 'heavy': return 'భారీ';
    case 'very heavy': return 'అత్యంత భారీ';
    default: return 'వర్షం లేదు';
  }
}
function fmtMm(n: number): number { return Math.round(n * 10) / 10; }
function fmtPct(n: number | null | undefined): number { return Math.max(0, Math.min(100, Math.round(n ?? 0))); }
function hasNaN(s: string): boolean { return /(NaN|undefined|null)/.test(s); }

export async function runBuildFeaturesAndAlerts() {
  const areas = await prisma.area.findMany();
  const nowcast = await getDistrictText();
  const nowIso = new Date().toISOString();
  const frames = await getFrames();

  const results: Array<{ areaId: string; features: AreaFeatures }> = [];
  for (const area of areas) {
    // MVP: Use last observation if exists, else default zeros
    // Build fresh observation inputs first
    const centroid = (area.polygon as any)?.coordinates?.[0]?.[0]
      ? (() => {
          const coords = (area.polygon as any).coordinates[0];
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          return { lat, lng };
        })()
      : { lat: 17.4, lng: 78.5 };

    const meteo = await getAreaPoint(centroid.lat, centroid.lng);
    const radar = await estimateEtaForArea(centroid, frames);
    const outlook = await getNext12hSummary(centroid.lat, centroid.lng);

    // Persist Observation first
    const observation = await prisma.observation.create({
      data: {
        areaId: area.id,
        observedAt: new Date(nowIso),
        precipHour: meteo.precipHour,
        probability: meteo.probability ?? null,
        intensityClass: meteo.intensityClass,
        radarEtaMin: radar.etaMin,
        radarDuration: radar.durationMin,
        radarIntensity: radar.intensity,
        nowProb: (outlook.nowProb ?? null) as any,
        maxProb12h: (outlook.maxProb12h ?? null) as any,
        sumPrecip12h: outlook.sumPrecip12h as any,
        threeHourTotalMm: outlook.sumPrecip12h ? (outlook.sumPrecip12h / 4) : null, // coarse proxy
        peakHourLocal: (outlook.peakHourLocal ? new Date(outlook.peakHourLocal.toISOString()) : null) as any,
        sources: ['Radar', 'Stations'],
        staleSources: [meteo.stale ? 'OpenMeteo' : ''].filter(Boolean),
      } as any,
    });

    // Build normalized features for rule engine + AI
    const features: AreaFeatures = AreaFeaturesSchema.parse({
      areaId: area.id,
      areaName: area.name,
      type: area.type,
      radar: { etaMin: radar.etaMin, durationMin: radar.durationMin, intensity: radar.intensity },
      meteo: {
        precipHour: meteo.precipHour,
        probability: meteo.probability,
        intensity: meteo.intensityClass,
        stale: meteo.stale,
      },
      nowcastText: nowcast['Hyderabad'],
      observedAt: nowIso,
    });

    results.push({ areaId: area.id, features });

    // Evaluate determinstic rules
    const pre = evaluateRules(features);
    if (pre) {
      const ai = await createBilingualAlert(features, pre.labels);
      const windowMin = features.radar.etaMin ?? 0;
      const start = new Date(Date.now() + windowMin * 60 * 1000);
      const end = new Date(start.getTime() + (features.radar.durationMin ?? 30) * 60 * 1000);
      if (ai && Array.isArray(ai.alerts) && ai.alerts.length > 0) {
        const a0 = ai.alerts[0]!;
        await prisma.alert.create({
          data: {
            areaId: area.id,
            observationId: observation.id,
            scope: 'now',
            issuedAt: new Date(),
            windowStart: start,
            windowEnd: end,
            severity: pre.severity as Severity,
            confidence: a0.confidence,
            textEn: `${a0.title_en} — ${a0.advice_en}`,
            textTe: `${a0.title_te} — ${a0.advice_te}`,
            sources: (a0.sources as string[]).map((s) => (s === 'Stations' ? 'Model' : s)),
          } as any,
        });
      } else {
        // Fallback deterministic Balaji-style NOW alert (no AI)
        const low = Math.max(0, windowMin - 5);
        const high = Math.max(low + 10, windowMin + 15);
        const mmh = features.meteo.precipHour ?? 0;
        const mmhLow = Math.max(0.2, +(mmh * 0.6).toFixed(1));
        const mmhHigh = +(Math.max(mmhLow + 0.2, mmh * 1.3)).toFixed(1);
        const intensity = features.radar.intensity || features.meteo.intensity;
        const dur = features.radar.durationMin ?? 45;
        const titleEn = `${capitalize(intensity)} rain (${mmhLow}–${mmhHigh} mm/h) in ${area.name} in ${low}–${high} min; lasts ~${dur} min.`;
        const titleTe = `${teluguIntensity(intensity)} వర్షం (${mmhLow}–${mmhHigh} మి.మీ/గం) ${area.name}లో ${low}–${high} నిమిషాల్లో; ~${dur} నిమి. పాటు.`;

        await prisma.alert.create({
          data: {
            areaId: area.id,
            observationId: observation.id,
            scope: 'now',
            issuedAt: new Date(),
            windowStart: start,
            windowEnd: end,
            severity: pre.severity as Severity,
            confidence: pre.confidence,
            textEn: titleEn,
            textTe: titleTe,
            sources: (pre.sources as string[]).map((s) => (s === 'Stations' ? 'Model' : s)),
          } as any,
        });
      }
      // Always persist an observation snapshot as well
      // observation already persisted above; no legacy persist here
    }

    // Today outlook alert
    if ((outlook.maxProb12h ?? 0) >= 60 || (outlook.sumPrecip12h ?? 0) >= 10) {
      const prob = outlook.maxProb12h ?? 0;
      const sumP = outlook.sumPrecip12h ?? 0;
      const threeMm = sumP ? sumP * 0.25 * 3 : 0; // derive 3h total from 12h sum (coarse)
      const radarBoost = (radar.etaMin ?? 999) <= 180;
      const freshness = 0; // observation just created
      const confidence = Math.max(
        0,
        Math.min(
          1,
          0.4 * (prob / 100) + 0.3 * Math.min(1, sumP / 20) + 0.2 * (radarBoost ? 1 : 0) + 0.1 * 1,
        ),
      );
      const sev: Severity = prob >= 70 || sumP >= 15 ? 'medium' : 'info';
      const windowLabel = formatLocalWindow(outlook.peakHourLocal ?? null, 3, 'Asia/Kolkata');
      const { low: threeLow, high: threeHigh } = (() => {
        const low = fmtMm(threeMm * 0.7);
        const high = Math.max(low + 0.2, fmtMm(threeMm * 1.3));
        return { low, high };
      })();
      const intensityWord = wordFromThreeHour(threeMm);
      const intensityTe = wordFromThreeHourTe(threeMm);
      let textEn = `${fmtMm(threeLow)}–${fmtMm(threeHigh)} mm ${intensityWord} rain likely ${windowLabel} in ${area.name}. ${fmtPct(prob)}% conf.`;
      let textTe = `${fmtMm(threeLow)}–${fmtMm(threeHigh)} మి.మీ ${intensityTe} వర్షం ${windowLabel}లో ${area.name}లో అవకాశం. ${fmtPct(prob)}% నమ్మకం.`;
      if (hasNaN(textEn) || hasNaN(textTe)) {
        textEn = `Rain likely later today in ${area.name}.`;
        textTe = `ఈ రోజు తరువాత ${area.name}లో వర్షం అవకాశం.`;
      }
      await prisma.alert.create({
        data: {
          areaId: area.id,
          observationId: observation.id,
          scope: 'today',
          issuedAt: new Date(),
          windowStart: new Date(),
          windowEnd: new Date(Date.now() + 3 * 60 * 60 * 1000),
          severity: sev,
          confidence,
          textEn,
          textTe,
          sources: ['Model'],
        } as any,
      });
    }

    // 7-day daily forecasts
    const daily = await get7DayDaily(centroid.lat, centroid.lng);
    for (const d of daily) {
      const p = d.precipitation_probability_max ?? 0;
      const sum = d.precipitation_sum ?? 0;
      const conf = Math.max(0, Math.min(1, 0.6 * (p / 100) + 0.4 * Math.min(1, sum / 20)));
      const sev = p >= 70 || sum >= 15 ? 'medium' : p >= 40 || sum >= 5 ? 'info' : 'info';
      const textEn = p >= 40 || sum >= 5 ? `Rain ${sum?.toFixed?.(1) ?? '0'} mm possible. ${p}% confidence.` : `Low chance of rain.`;
      const textTe = p >= 40 || sum >= 5 ? `వర్షం అవకాశం ${sum?.toFixed?.(1) ?? '0'} మి.మీ. ${p}% నమ్మకం.` : `వర్షం అవకాశం తక్కువ.`;
      await (prisma as any).forecastDaily.upsert({
        where: { areaId_date: { areaId: area.id, date: new Date(d.date) } },
        update: {
          precipitationSum: d.precipitation_sum ?? null,
          precipitationProbabilityMax: d.precipitation_probability_max ?? null,
          temperatureMax: d.temperature_2m_max ?? null,
          temperatureMin: d.temperature_2m_min ?? null,
          textEn,
          textTe,
          confidence: conf,
        },
        create: {
          areaId: area.id,
          date: new Date(d.date),
          precipitationSum: d.precipitation_sum ?? null,
          precipitationProbabilityMax: d.precipitation_probability_max ?? null,
          temperatureMax: d.temperature_2m_max ?? null,
          temperatureMin: d.temperature_2m_min ?? null,
          textEn,
          textTe,
          confidence: conf,
        },
      });
    }
  }

  logInfo('Built features & alerts', { areas: results.length });
  return results;
}

export const buildFeaturesQueue = new Queue('buildFeaturesAndAlerts', { connection: redis });


