import { decideTweets } from '@/jobs/tweetDecider';
import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import { postTweet } from '@/lib/xClient';
import { formatTweetWithAI } from '@/lib/tweetFormat';
import { isHyderabad, makeHash } from '@/lib/tweetRules';

export async function runTweetRunner(areaIds?: string[]) {
  const picks = await decideTweets(areaIds);
  let posted = 0;
  for (const p of picks) {
    const area = await prisma.area.findUnique({ where: { id: p.areaId } });
    if (!area) continue;
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/areas/${area.id}`, { cache: 'no-store' });
    const payload = await res.json();

    // Dedupe + budget via redis keys already done in decideTweets allowTweet()
    // Compute source tag
    const hasRadarEta = !!payload?.now?.radarEtaMin && payload.now.radarEtaMin.from != null;
    const hasRadarIntensity = (payload?.observation?.radarIntensity || 'none') !== 'none';
    const sourceTag = hasRadarEta || hasRadarIntensity ? 'Model+Radar' : 'Model';

    // Call AI formatter
    const aiRes = await formatTweetWithAI({
      area: area.name,
      now: payload.now,
      today: payload.today,
      week: payload.week,
      scope: p.scope,
      sourceTag,
    });
    console.log(`[tweet][${aiRes.meta.used}] area=${aiRes.meta.area} scope=${aiRes.meta.scope} chars=${aiRes.textEn.length}`);

    // Build hashtags
    const hyd = isHyderabad(area.id);
    const hashtags = ['#TelanganaWeather', hyd ? '#HyderabadRains' : null].filter(Boolean).join(' ');

    // Assemble text with 280 cap rules
    let text = `${aiRes.textEn}\n${aiRes.textTe}\n${hashtags}`.trim();
    if (text.length > 280) text = `${aiRes.textEn}\n${aiRes.textTe}`.trim();
    if (text.length > 280) text = `${aiRes.textEn}`.trim();
    if (text.length > 280) text = text.replace(/\bminutes\b/gi, 'm').replace(/\bminute\b/gi, 'm').replace(/\bpm\b/gi, 'p');
    if (text.length > 280) text = text.slice(0, 280);

    const hash = makeHash(area.id, p.scope, p.bucket, p.windowLabel);

    // Post or dry-log based on config
    const canPost = config.tweetEnable && !!config.xApiKey && !!config.xApiSecret && !!config.xAccessToken && !!config.xAccessSecret;
    if (!canPost) {
      console.log(`[tweet][dry] area=${area.id} scope=${p.scope} chars=${text.length}`);
      console.log(text);
      await (prisma as any).tweetLog.create({
        data: {
          areaId: area.id,
          scope: p.scope,
          bucket: p.bucket,
          windowLabel: p.windowLabel || null,
          hash,
          tweetId: null,
        },
      });
      continue;
    }

    // Thread replies within the same local day per area
    const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
    const dayKey = `${area.id}:${ist}`;
    const last = await (prisma as any).tweetLog.findFirst({ where: { areaId: area.id }, orderBy: { createdAt: 'desc' } });
    const replyToId = last?.tweetId || undefined;

    const postedRes = await postTweet({ text, replyToId });
    const tweetId = postedRes?.tweetId || null;
    if (tweetId) posted += 1;
    await (prisma as any).tweetLog.create({
      data: {
        areaId: area.id,
        scope: p.scope,
        bucket: p.bucket,
        windowLabel: p.windowLabel || null,
        hash,
        tweetId,
      },
    });
  }
  return { posted };
}


