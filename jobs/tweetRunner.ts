import { decideTweets } from '@/jobs/tweetDecider';
import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import { postTweet } from '@/lib/xClient';
import { formatTweetWithAI } from '@/lib/tweetFormat';
import { isHyderabad, makeHash } from '@/lib/tweetRules';

export async function runTweetRunner(areaIds?: string[]) {
  const picks = await decideTweets(areaIds);
  let posted = 0;
  const MAX_POSTS_PER_CYCLE = 6;
  const MAX_POSTS_PER_HOUR = 3;

  const intensityBucketRank = (w?: string | null): number => {
    switch ((w || '').toLowerCase()) {
      case 'drizzle': return 0;
      case 'light': return 1;
      case 'moderate': return 2;
      case 'heavy': return 3;
      case 'very heavy': return 4;
      default: return 0;
    }
  };
  const getISTDateParts = (d: Date) => {
    const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
    const hour = Number(parts.hour || '0');
    const minute = Number(parts.minute || '0');
    const y = Number(parts.year || '0');
    const m = Number(parts.month || '0');
    const day = Number(parts.day || '0');
    return { hour, minute, y, m, day };
  };

  const istNow = getISTDateParts(new Date());
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentHourCount = await (prisma as any).tweetLog.count({ where: { createdAt: { gte: oneHourAgo } } });
  let perHourCount = recentHourCount || 0;

  type Candidate = {
    p: typeof picks[number];
    area: any;
    payload: any;
    score: number;
    hyd: boolean;
    groupKey: string;
    severeHyd: boolean;
  };

  const candidates: Candidate[] = [];

  for (const p of picks) {
    const area = await prisma.area.findUnique({ where: { id: p.areaId } });
    if (!area) continue;
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/areas/${area.id}`, { cache: 'no-store' });
    const payload = await res.json();

    // WEEK scheduling: only at 08:10 IST, once per day per area
    if (p.scope === 'week') {
      if (!(istNow.hour === 8 && istNow.minute === 10)) continue;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const already = await (prisma as any).tweetLog.findFirst({ where: { areaId: area.id, scope: 'week', createdAt: { gte: since } } });
      if (already) continue;
    }

    // Thresholds
    const nowBlk = payload.now || null;
    const todayBlk = payload.today || null;
    const weekBlk = payload.week || [];

    const zeroNow = nowBlk && Number(nowBlk.mmhLow ?? 0) === 0 && Number(nowBlk.mmhHigh ?? 0) === 0;
    const zeroToday = todayBlk && Number(todayBlk.threeMmLow ?? 0) === 0 && Number(todayBlk.threeMmHigh ?? 0) === 0;
    if (p.scope === 'now' && zeroNow) continue;
    if (p.scope === 'today' && zeroToday) continue;

    let pass = false;
    if (p.scope === 'now') {
      const etaFrom = nowBlk?.radarEtaMin?.from;
      const mmh = Number(nowBlk?.mmhHigh ?? 0);
      const thunder = Boolean(nowBlk?.thunderFlag);
      const todayProb = Number(todayBlk?.maxProb12h ?? 0);
      if (etaFrom != null && etaFrom <= 60) pass = true;
      if (mmh >= 1.0) pass = true;
      if (thunder) pass = true;
      pass = pass && todayProb >= 40;
      if (mmh < 0.3 && !thunder && (etaFrom == null)) pass = false;
    } else if (p.scope === 'today') {
      const inten = (todayBlk?.intensityWordToday || '').toLowerCase();
      const okInt = ['moderate', 'heavy', 'very heavy'].includes(inten);
      const prob = Number(todayBlk?.maxProb12h ?? 0);
      const three = Number(todayBlk?.threeHourTotalMm ?? todayBlk?.threeMmHigh ?? 0);
      const sum12 = Number(todayBlk?.sumPrecip12h ?? 0);
      pass = okInt && prob >= 70 && (three >= 5 || sum12 >= 10);
    } else if (p.scope === 'week') {
      pass = Array.isArray(weekBlk) && weekBlk.some((d: any) => Number(d.mmHigh ?? 0) >= 20 && Number(d.maxProb ?? 0) >= 80);
    }
    if (!pass) continue;

    // Score
    const scopeScore = p.scope === 'now' ? 60 : p.scope === 'today' ? 30 : 0;
    const intenBucket = p.scope === 'now' ? intensityBucketRank(payload?.now?.intensityWordNow) : p.scope === 'today' ? intensityBucketRank(payload?.today?.intensityWordToday) : (Array.isArray(weekBlk) && weekBlk.length ? intensityBucketRank(weekBlk[0]?.intensityWord) : 0);
    const maxProb = p.scope === 'today' ? Number(todayBlk?.maxProb12h ?? 0) : p.scope === 'now' ? Number(todayBlk?.maxProb12h ?? 0) : (Array.isArray(weekBlk) && weekBlk.length ? Number(weekBlk[0]?.maxProb ?? 0) : 0);
    const thunder = Boolean(nowBlk?.thunderFlag);
    const etaSoon = nowBlk?.radarEtaMin?.from != null && nowBlk.radarEtaMin.from <= 60 ? 1 : 0;
    const three = Number(todayBlk?.threeHourTotalMm ?? todayBlk?.threeMmHigh ?? 0);
    const sum12 = Number(todayBlk?.sumPrecip12h ?? 0);
    const hyd = isHyderabad(area.id);
    const score = scopeScore + 25 * intenBucket + 0.4 * maxProb + 10 * (thunder ? 1 : 0) + 10 * etaSoon + 0.5 * three + 0.4 * sum12 + 6 * (hyd ? 1 : 0);

    const severeHyd = hyd && (intenBucket >= 4 || thunder);
    const groupKey = hyd ? 'hyd-metro' : area.type === 'district' ? area.id : area.id;
    candidates.push({ p, area, payload, score, hyd, groupKey, severeHyd });
  }

  // Rank & diversity
  candidates.sort((a, b) => b.score - a.score);
  const approved: typeof candidates = [];
  const groupCounts = new Map<string, number>();
  for (const c of candidates) {
    if (approved.length >= MAX_POSTS_PER_CYCLE) break;
    const current = groupCounts.get(c.groupKey) || 0;
    const groupLimit = c.groupKey === 'hyd-metro' ? (c.severeHyd ? 2 : 1) : 1;
    if (current >= groupLimit) continue;

    // 180-min cooldown unless escalation
    const last = await (prisma as any).tweetLog.findFirst({ where: { areaId: c.area.id }, orderBy: { createdAt: 'desc' } });
    if (last) {
      const elapsedMin = (Date.now() - new Date(last.createdAt).getTime()) / 60000;
      if (elapsedMin < 180) {
        let escalated = false;
        const prevRank = intensityBucketRank(String(last.bucket || ''));
        const currRank = intensityBucketRank(String(c.p.bucket || ''));
        if (currRank > prevRank) escalated = true;
        if (!escalated && c.p.scope === 'now') {
          const parseRange = (s?: string | null) => {
            if (!s) return null;
            const m = String(s).match(/(\d+)\s*-\s*(\d+)/);
            if (!m) return null;
            return { from: Number(m[1]), to: Number(m[2]) };
          };
          const prevEta = parseRange(last.windowLabel || undefined);
          const currEta = c.payload?.now?.radarEtaMin || null;
          if (prevEta && currEta && (Math.abs((currEta.from ?? 0) - (prevEta.from ?? 0)) > 20 || Math.abs((currEta.to ?? 0) - (prevEta.to ?? 0)) > 20)) {
            escalated = true;
          }
        }
        if (!escalated) continue;
      }
    }

    approved.push(c);
    groupCounts.set(c.groupKey, current + 1);
  }

  for (const item of approved) {
    if (posted >= MAX_POSTS_PER_CYCLE) break;
    if (perHourCount >= MAX_POSTS_PER_HOUR) break;
    const { p, area, payload } = item;

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

    // Post or dry-log
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

    // Thread as reply to last tweet for area
    const last = await (prisma as any).tweetLog.findFirst({ where: { areaId: area.id }, orderBy: { createdAt: 'desc' } });
    const replyToId = last?.tweetId || undefined;

    const postedRes = await postTweet({ text, replyToId });
    const tweetId = postedRes?.tweetId || null;
    if (tweetId) { posted += 1; perHourCount += 1; }
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


