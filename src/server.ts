import 'dotenv/config';
import { config } from './config.js';
import { buildApp } from './app.js';
import { initCache, startAutoRefresh } from './services/cache.service.js';
import { startSessionRefresh } from './services/session-manager.service.js';

async function main() {
  const app = await buildApp();

  // Initialize cache (loads from file, then kicks off background scrape)
  await initCache();

  // Start periodic refresh timers
  startAutoRefresh();
  startSessionRefresh();

  // Start listening
  await app.listen({ port: config.PORT, host: config.HOST });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
