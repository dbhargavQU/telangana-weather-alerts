import { describe, it, expect } from 'vitest';
import { AlertSchema } from '@/lib/zodSchemas';

describe('AlertSchema', () => {
  it('accepts a valid payload', () => {
    const payload = {
      area: 'LB Nagar, Hyderabad',
      alerts: [
        {
          title_en: 'Heavy downpour likely in ~20–40 min',
          title_te: 'ఇంకా 20–40 నిమిషాల్లో భారీ వర్షం అవకాశం',
          window_min_from_now: [20, 40],
          severity: 'high',
          advice_en: 'Avoid low-lying roads; plan indoor time.',
          advice_te: 'తక్కువ ఎత్తు రోడ్లను తప్పించండి; ఇంట్లోనే ఉండండి.',
          confidence: 0.82,
          sources: ['Radar', 'Stations'],
        },
      ],
    };
    const res = AlertSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });
});


