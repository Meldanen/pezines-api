import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { SessionTokens } from '../models/types.js';

let currentSession: SessionTokens | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function fetchSession(): Promise<SessionTokens> {
  const response = await axios.get(config.GOV_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html',
    },
    maxRedirects: 5,
  });

  const cookies = (response.headers['set-cookie'] ?? [])
    .map((c: string) => c.split(';')[0])
    .join('; ');

  const $ = cheerio.load(response.data);
  const verificationToken =
    $('input[name="__RequestVerificationToken"]').val() as string;

  if (!verificationToken) {
    throw new Error('Failed to extract __RequestVerificationToken from page');
  }

  const session: SessionTokens = {
    cookies,
    verificationToken,
    obtainedAt: Date.now(),
  };

  currentSession = session;
  return session;
}

export async function getSession(): Promise<SessionTokens> {
  if (!currentSession) {
    return fetchSession();
  }
  // If session is older than configured refresh interval, refresh proactively
  if (Date.now() - currentSession.obtainedAt > config.SESSION_REFRESH_MS) {
    try {
      return await fetchSession();
    } catch {
      // Return stale session if refresh fails
      return currentSession;
    }
  }
  return currentSession;
}

export async function refreshSession(): Promise<SessionTokens> {
  return fetchSession();
}

export function startSessionRefresh(): void {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    try {
      await fetchSession();
      console.log('[session] Proactively refreshed session tokens');
    } catch (err) {
      console.error('[session] Failed to refresh session:', (err as Error).message);
    }
  }, config.SESSION_REFRESH_MS);
}

export function stopSessionRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
