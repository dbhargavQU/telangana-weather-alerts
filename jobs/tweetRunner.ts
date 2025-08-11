import { decideTweets } from '@/jobs/tweetDecider';
import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import { postTweet } from '@/lib/xClient';
import { formatTweetBalajiStyle, formatTweetFallback } from '@/lib/tweetFormat';

export async function runTweetRunner(areaIds?: string[]) {
  if (!config.tweetEnable) return { posted: 0, skipped: 'disabled' };
  const picks = await decideTweets(areaIds);
  let posted = 0;
  for (const p of picks) {
    const a = await prisma.area.findUnique({ where: { id: p.areaId } });
    if (!a) continue;
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/areas/${a.id}`, { cache: 'no-store' });
    const data = await res.json();
    const isHyd = /Hyderabad/i.test(a.name);
    // Build input text for AI
    const input = [
      `AREA: ${a.name}`,
      `WHEN_LOCAL: ${p.windowLabel || data?.today?.windowLabel || ''} IST`,
      `NOW: eta=${data?.now?.radarEtaMin ? `${data.now.radarEtaMin.from}-${data.now.radarEtaMin.to}` : 'none'}; mmh=${data?.now ? `${data.now.mmhLow}-${data.now.mmhHigh}` : 'none'}; thunder=${data?.now?.thunderFlag ? 'true' : 'false'}`,
      `TODAY: total3h=${data?.today ? `${data.today.threeMmLow}-${data.today.threeMmHigh} mm` : 'none'}; intensity=${data?.today?.intensityWordToday || 'none'}; prob=${data?.today?.maxProb12h ?? 0}%`,
      `WEEK_TOP2: ${(data?.week || []).slice(0,2).map((d:any) => `${new Date(d.date).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'short'})} ${d.mmLow}-${d.mmHigh} mm`).join(', ')}`,
      'INSTRUCTIONS: respond in json. If NOW strong, lead with NOW; else TODAY. Use exact numbers; one short safety tip only if heavy/very heavy. Hashtags: #TelanganaWeather and #HyderabadRains only for Hyderabad. End with source tag. Keep <= 280 chars.'
    ].join('\n');

    const ai = await formatTweetBalajiStyle(input, isHyd);
    const sourceTag = data?.now?.radarEtaMin?.from != null ? 'Model+Radar' : 'Model';
    const fallback = formatTweetFallback({
      area: a.name,
      scope: p.scope,
      intensity: (data?.today?.intensityWordToday || data?.now?.intensityWordNow || 'moderate'),
      etaFrom: data?.now?.radarEtaMin?.from,
      etaTo: data?.now?.radarEtaMin?.to,
      mmhLow: data?.now?.mmhLow, mmhHigh: data?.now?.mmhHigh,
      windowLabel: p.windowLabel || data?.today?.windowLabel,
      threeLow: data?.today?.threeMmLow, threeHigh: data?.today?.threeMmHigh,
      source: sourceTag as any,
    });
    const finalText = `${(ai?.textEn || fallback.textEn)}\n${(ai?.textTe || fallback.textTe)}\n${(ai?.hashtags || fallback.hashtags).join(' ')} ${sourceTag ? `(${sourceTag})` : ''}`.trim().slice(0, 280);
    const postedRes = await postTweet(finalText);
    if (postedRes) {
      posted += 1;
      await prisma.tweetLog.create({ data: { areaId: a.id, scope: p.scope, bucket: p.bucket, windowLabel: p.windowLabel || null, hash: 'unused-hash', tweetId: postedRes.id } as any });
    }
  }
  return { posted };
}


