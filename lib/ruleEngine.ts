import type { AreaFeatures } from './zodSchemas';
import { config } from './config';

export type Label =
  | 'HEAVY_RAIN_LIKELY'
  | 'SEVERE_THUNDERSTORM_RISK'
  | 'LOCAL_DOWNPOUR_ONGOING';

export type PreAlert = {
  labels: Label[];
  severity: 'info' | 'medium' | 'high';
  confidence: number; // 0..1
  sources: Array<'Radar' | 'Stations' | 'Nowcast'>;
};

export function evaluateRules(features: AreaFeatures): PreAlert | null {
  const labels: Label[] = [];
  const sources: Array<'Radar' | 'Stations' | 'Nowcast'> = [];

  const { radar, meteo } = features;
  const etaOk = radar.etaMin !== null && radar.etaMin <= 90;
  const modPlus = radar.intensity === 'moderate' || radar.intensity === 'heavy';
  const heavy = radar.intensity === 'heavy';
  const prob = meteo.probability ?? 0;
  const precip = meteo.precipHour ?? 0;

  if ((etaOk && modPlus) || (prob >= 70 && precip >= 2)) {
    labels.push('HEAVY_RAIN_LIKELY');
    if (!sources.includes('Radar')) sources.push('Radar');
  }
  if ((radar.etaMin !== null && radar.etaMin <= 60) && heavy) {
    labels.push('SEVERE_THUNDERSTORM_RISK');
    if (!sources.includes('Radar')) sources.push('Radar');
  }
  if (precip >= 10) {
    labels.push('LOCAL_DOWNPOUR_ONGOING');
    if (!sources.includes('Stations')) sources.push('Stations');
  }

  // Temporary relaxed thresholds for live mode to ensure alerts fire in calm weather
  if (config.relaxedRules) {
    if (prob >= 40 || precip >= 1.0) {
      if (!labels.includes('HEAVY_RAIN_LIKELY')) labels.push('HEAVY_RAIN_LIKELY');
      if (!sources.includes('Stations')) sources.push('Stations');
    }
  }

  if (labels.length === 0) return null;

  let severity: 'info' | 'medium' | 'high' = labels.includes('SEVERE_THUNDERSTORM_RISK')
    ? 'high'
    : labels.includes('HEAVY_RAIN_LIKELY')
    ? 'medium'
    : 'info';

  // Adjust severity for relaxed thresholds
  if (config.relaxedRules && (prob >= 40 || precip >= 1.0)) {
    severity = prob >= 60 || precip >= 3 ? 'medium' : 'info';
  }

  // Confidence blends nearer ETA, higher probability, and intensity
  let confidence = 0.3;
  if (radar.etaMin !== null) confidence += Math.max(0, (90 - radar.etaMin) / 180); // up to ~0.5
  confidence += (prob / 100) * 0.3; // up to 0.3
  if (radar.intensity === 'moderate') confidence += 0.1;
  if (radar.intensity === 'heavy') confidence += 0.2;
  confidence = Math.max(0, Math.min(1, confidence));

  return { labels, severity, confidence, sources };
}


