import { z } from 'zod';

export const AreaFeaturesSchema = z.object({
  areaId: z.string(),
  areaName: z.string(),
  type: z.enum(['district', 'neighbourhood']),
  radar: z.object({
    etaMin: z.number().int().nullable(),
    durationMin: z.number().int().nullable(),
    intensity: z.enum(['none', 'light', 'moderate', 'heavy']).default('none'),
  }),
  meteo: z.object({
    precipHour: z.number().nullable(),
    probability: z.number().nullable(),
    intensity: z.enum(['none', 'light', 'moderate', 'heavy']),
    stale: z.boolean().default(false),
  }),
  nowcastText: z.string().optional(),
  observedAt: z.string(),
});

export type AreaFeatures = z.infer<typeof AreaFeaturesSchema>;

export const AlertSchema = z.object({
  area: z.string(),
  alerts: z
    .array(
      z.object({
        title_en: z.string().max(80),
        title_te: z.string().max(80),
        window_min_from_now: z.tuple([z.number().int().min(0), z.number().int().max(180)]),
        severity: z.enum(['info', 'medium', 'high']),
        advice_en: z.string().max(120),
        advice_te: z.string().max(120),
        confidence: z.number().min(0).max(1),
        sources: z.array(z.enum(['Radar', 'Stations', 'Nowcast'])).min(1),
      }),
    )
    .min(1)
    .max(2),
});

export type AlertPayload = z.infer<typeof AlertSchema>;


