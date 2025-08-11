import OpenAI from 'openai';
import { z } from 'zod';
import { AlertSchema, type AlertPayload, type AreaFeatures } from './zodSchemas';
import { config } from './config';

const client = config.openAiKey ? new OpenAI({ apiKey: config.openAiKey }) : null;

const systemPrompt = `You are “Telangana Weatherman Assistant.” Return ONLY strict JSON that matches the provided Zod schema. Output must be valid JSON (no markdown, no prose).

Balaji-style formatting rules:
- Write two short lines only: first English, second Telugu. Each ≤110 chars.
- Lead with intensity (Light/Moderate/Heavy) and mm or mm/h range from provided fields.
- Include timing: NOW → use ETA window (e.g., in 20–40 min) and duration (~45 min). TODAY → use peak 3h local window.
- Name affected area first (district or Hyderabad neighbourhood provided); never invent names.
- Optional: add thunder risk or wind gusts if provided. No invented numbers.
- Never add anything beyond provided fields. Keep concise and specific.`;

export async function createBilingualAlert(
  features: AreaFeatures,
  labels: string[],
): Promise<AlertPayload | null> {
  // In dev or when key missing, skip AI and let deterministic layer handle UX fallback
  if (!config.openAiKey || !client) return null;
  const schema = AlertSchema;
  const examples = {
    area: 'LB Nagar, Hyderabad',
    alerts: [
      {
        title_en: 'Heavy downpour likely in ~20–40 min',
        title_te: 'ఇంకా 20–40 నిమిషాల్లో భారీ వర్షం అవకాశం',
        window_min_from_now: [20, 40] as [number, number],
        severity: 'high' as const,
        advice_en: 'Avoid low-lying roads; plan indoor time.',
        advice_te: 'తక్కువ ఎత్తు రోడ్లను తప్పించండి; ఇంట్లోనే ఉండండి.',
        confidence: 0.82,
        sources: ['Radar', 'Stations'] as const,
      },
    ],
  } satisfies AlertPayload;

  try {
    const completion = await client.chat.completions.create({
      model: config.aiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ features, labels, example: examples }) },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = schema.parse(JSON.parse(text));
    return parsed;
  } catch {
    try {
      const retry = await client.chat.completions.create({
        model: config.aiModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              'Return STRICT JSON that matches this Zod schema: ' +
              schema.toString() +
              ' and use ONLY these features and labels: ' +
              JSON.stringify({ features, labels }),
          },
        ],
      });
      const t2 = retry.choices[0]?.message?.content ?? '';
      const parsed2 = schema.parse(JSON.parse(t2));
      return parsed2;
    } catch {
      return null; // fallback to deterministic layer upstream
    }
  }
}


