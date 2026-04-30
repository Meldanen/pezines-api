export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  GOV_URL: string;
  ADMIN_API_KEY: string;
  DASHBOARD_PASSWORD: string;
  RATE_LIMITER: RateLimit;
}
