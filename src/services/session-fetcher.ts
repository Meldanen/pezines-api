import * as cheerio from 'cheerio';
import type { SessionTokens } from '../models/types.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Fetches the gov page once to harvest the session cookies and the
 * __RequestVerificationToken hidden input. Used by both the Node (in-memory)
 * and Workers (KV) session managers — the only runtime difference is where the
 * resulting tokens are stored.
 */
export async function fetchSessionTokens(govUrl: string): Promise<SessionTokens> {
  const response = await fetch(govUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch session page: ${response.status} ${response.statusText}`);
  }

  // Headers.get('set-cookie') concatenates with ',', which corrupts cookies whose
  // Expires attribute contains a comma. Prefer getSetCookie() when available.
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  const cookies = setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  const html = await response.text();
  const $ = cheerio.load(html);
  const verificationToken = $('input[name="__RequestVerificationToken"]').val() as string;
  if (!verificationToken) {
    throw new Error('Failed to extract __RequestVerificationToken from page');
  }

  return { cookies, verificationToken, obtainedAt: Date.now() };
}
