import * as cheerio from 'cheerio';
import type { Env } from '../config.worker.js';
import type { SessionTokens } from '../models/types.js';

const SESSION_KEY = 'session';

async function fetchSession(govUrl: string): Promise<SessionTokens> {
  const response = await fetch(govUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });

  const cookies = (response.headers.get('set-cookie') ?? '')
    .split(',')
    .map((c: string) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  const html = await response.text();
  const $ = cheerio.load(html);
  const verificationToken =
    $('input[name="__RequestVerificationToken"]').val() as string;

  if (!verificationToken) {
    throw new Error('Failed to extract __RequestVerificationToken from page');
  }

  return {
    cookies,
    verificationToken,
    obtainedAt: Date.now(),
  };
}

export async function getSessionKV(env: Env): Promise<SessionTokens> {
  const cached = await env.KV.get(SESSION_KEY, 'json') as SessionTokens | null;
  if (cached && Date.now() - cached.obtainedAt < 1_800_000) {
    return cached;
  }
  return refreshSessionKV(env);
}

export async function refreshSessionKV(env: Env): Promise<SessionTokens> {
  const session = await fetchSession(env.GOV_URL);
  await env.KV.put(SESSION_KEY, JSON.stringify(session), { expirationTtl: 3600 });
  return session;
}
