import { buildWorkerApp } from './worker-app.js';
import { refreshCacheKV } from './services/cache.kv.js';
import { savePriceSnapshot } from './services/history.d1.js';
import type { Env } from './config.worker.js';

const app = buildWorkerApp();

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      refreshCacheKV(env)
        .then(async (data) => {
          console.log(`[cron] Refreshed cache: ${data.stations.length} stations`);
          await savePriceSnapshot(env.DB, data);
          console.log('[cron] Saved price snapshot to D1');
        })
        .catch((err) => console.error('[cron] Cache refresh failed:', err.message))
    );
  },
};
