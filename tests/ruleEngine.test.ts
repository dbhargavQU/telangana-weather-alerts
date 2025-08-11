import { describe, it, expect } from 'vitest';
import { evaluateRules } from '@/lib/ruleEngine';

describe('ruleEngine', () => {
  it('flags heavy rain likely', () => {
    const pre = evaluateRules({
      areaId: 'x',
      areaName: 'Test',
      type: 'neighbourhood',
      radar: { etaMin: 30, durationMin: 20, intensity: 'moderate' },
      meteo: { precipHour: 0, probability: 0, intensity: 'none', stale: false },
      observedAt: new Date().toISOString(),
    });
    expect(pre).toBeTruthy();
    expect(pre?.labels).toContain('HEAVY_RAIN_LIKELY');
  });
});


