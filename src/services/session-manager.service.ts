import { config } from '../config.js';
import type { SessionTokens } from '../models/types.js';
import { fetchSessionTokens } from './session-fetcher.js';

let currentSession: SessionTokens | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function fetchAndStore(): Promise<SessionTokens> {
  const session = await fetchSessionTokens(config.GOV_URL);
  currentSession = session;
  return session;
}

export async function getSession(): Promise<SessionTokens> {
  if (!currentSession) return fetchAndStore();
  // Proactively refresh if past the TTL; fall back to stale on failure.
  if (Date.now() - currentSession.obtainedAt > config.SESSION_REFRESH_MS) {
    try {
      return await fetchAndStore();
    } catch {
      return currentSession;
    }
  }
  return currentSession;
}

export async function refreshSession(): Promise<SessionTokens> {
  return fetchAndStore();
}

export function startSessionRefresh(): void {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    try {
      await fetchAndStore();
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
