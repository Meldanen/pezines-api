import type { Env } from '../config.worker.js';
import type { SessionTokens } from '../models/types.js';
import { fetchSessionTokens } from './session-fetcher.js';

const SESSION_KEY = 'session';
const SESSION_TTL_MS = 1_800_000; // 30 min

export async function getSessionKV(env: Env): Promise<SessionTokens> {
  const cached = (await env.KV.get(SESSION_KEY, 'json')) as SessionTokens | null;
  if (cached && Date.now() - cached.obtainedAt < SESSION_TTL_MS) {
    return cached;
  }
  return refreshSessionKV(env);
}

export async function refreshSessionKV(env: Env): Promise<SessionTokens> {
  const session = await fetchSessionTokens(env.GOV_URL);
  await env.KV.put(SESSION_KEY, JSON.stringify(session), { expirationTtl: 3600 });
  return session;
}
