import { cleanEnv, str, port, num } from 'envalid';

export const config = cleanEnv(process.env, {
  PORT: port({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),
  ADMIN_API_KEY: str({ default: 'changeme' }),
  DASHBOARD_PASSWORD: str({ default: '' }),
  CACHE_TTL_MS: num({ default: 14_400_000 }), // 4 hours
  SCRAPE_INTERVAL_MS: num({ default: 14_400_000 }), // 4 hours
  SESSION_REFRESH_MS: num({ default: 1_800_000 }), // 30 min
  GOV_URL: str({ default: 'https://eforms.eservices.cyprus.gov.cy/MCIT/MCIT/PetroleumPrices' }),
});
