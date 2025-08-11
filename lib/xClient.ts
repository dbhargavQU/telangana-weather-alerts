import { config } from '@/lib/config';
import crypto from 'node:crypto';

type PostInput = { text: string; replyToId?: string } | string;

export async function postTweet(input: PostInput): Promise<{ tweetId: string } | null> {
  const text = typeof input === 'string' ? input : input.text;
  const replyToId = typeof input === 'string' ? undefined : input.replyToId;

  // Dry mode when disabled or missing keys
  if (!config.tweetEnable || !config.xApiKey || !config.xApiSecret || !config.xAccessToken || !config.xAccessSecret) {
    console.log('[tweet][dry]', text);
    return null;
  }

  try {
    const url = 'https://api.twitter.com/2/tweets';
    const oauthParams = buildOAuthParams({
      method: 'POST',
      url,
      consumerKey: config.xApiKey,
      consumerSecret: config.xApiSecret,
      token: config.xAccessToken,
      tokenSecret: config.xAccessSecret,
    });

    const body: any = { text };
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': oauthParams.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[tweet][error]', res.status, errText);
      return null;
    }
    const json: any = await res.json();
    const tweetId = String(json?.data?.id || '');
    if (tweetId) console.log('[tweet][live]', tweetId);
    return tweetId ? { tweetId } : null;
  } catch (e) {
    console.error('[tweet][error]', e);
    return null;
  }
}

function buildOAuthParams(opts: {
  method: 'POST' | 'GET';
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: opts.token,
    oauth_version: '1.0',
  };
  const baseString = signatureBaseString(opts.method, opts.url, oauthParams);
  const signingKey = `${encodeRFC3986(opts.consumerSecret)}&${encodeRFC3986(opts.tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const entries = Object.entries({ ...oauthParams, oauth_signature: signature }) as Array<[string, string]>;
  entries.sort((aa, bb) => {
    const a = Array.isArray(aa) && typeof aa[0] === 'string' ? aa[0] : '';
    const b = Array.isArray(bb) && typeof bb[0] === 'string' ? bb[0] : '';
    return a.localeCompare(b);
  });
  const authHeader = 'OAuth ' + entries.map(([k, v]) => `${encodeRFC3986(String(k))}="${encodeRFC3986(String(v))}"`).join(', ');
  return { authorization: authHeader };
}

function signatureBaseString(method: string, url: string, params: Record<string, string>): string {
  const parts = url.split('?');
  const baseUrl: string = parts[0] ?? url;
  const queryParams: Record<string, string> = {};
  const query = parts[1];
  if (query) {
    for (const part of query.split('&')) {
      const [k, v] = part.split('=');
      if (typeof k === 'string') queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  const normalizedEntries = Object.entries({ ...queryParams, ...params }) as Array<[string, string]>;
  normalizedEntries.sort((aa, bb) => {
    const a = Array.isArray(aa) && typeof aa[0] === 'string' ? aa[0] : '';
    const b = Array.isArray(bb) && typeof bb[0] === 'string' ? bb[0] : '';
    return a.localeCompare(b);
  });
  const normalized = normalizedEntries
    .map(([k, v]) => [encodeRFC3986(String(k)), encodeRFC3986(String(v))] as const)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return [method.toUpperCase(), encodeRFC3986(baseUrl), encodeRFC3986(normalized)].join('&');
}

function encodeRFC3986(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}


