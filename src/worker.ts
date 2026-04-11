import { buildWorkerApp } from './worker-app.js';
import { refreshCacheKV } from './services/cache.kv.js';
import type { Env } from './config.worker.js';

const app = buildWorkerApp();

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      refreshCacheKV(env)
        .then((data) => console.log(`[cron] Refreshed cache: ${data.stations.length} stations`))
        .catch((err) => console.error('[cron] Cache refresh failed:', err.message))
    );
  },
};
