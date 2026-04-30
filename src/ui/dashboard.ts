export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>pezines admin</title>
<style>
  :root { color-scheme: light dark; --b:#d0d4da; --bg:#fafbfc; --fg:#1a1a1a; --muted:#6b7280; --accent:#2563eb; --bad:#b91c1c; --good:#15803d; }
  @media (prefers-color-scheme: dark) { :root { --b:#2a2f36; --bg:#0f1115; --fg:#e6e6e6; --muted:#9aa3ad; --accent:#60a5fa; --bad:#f87171; --good:#4ade80; } }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background: var(--bg); color: var(--fg); }
  main { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin-bottom: 24px; }
  .card { border: 1px solid var(--b); border-radius: 10px; padding: 16px; margin-bottom: 16px; background: color-mix(in srgb, var(--bg) 92%, var(--fg) 8%); }
  .card h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 12px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .row > * { flex: 0 0 auto; }
  .grow { flex: 1 1 auto; min-width: 160px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  input, select, button, textarea { font: inherit; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--b); background: var(--bg); color: var(--fg); }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  button { cursor: pointer; background: var(--accent); color: #fff; border-color: transparent; font-weight: 500; }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--b); }
  button:disabled { opacity: .5; cursor: not-allowed; }
  pre { background: color-mix(in srgb, var(--bg) 80%, var(--fg) 20%); border: 1px solid var(--b); border-radius: 8px; padding: 12px; overflow: auto; max-height: 480px; white-space: pre-wrap; word-break: break-word; margin: 0; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .stat { padding: 8px 12px; border: 1px solid var(--b); border-radius: 8px; background: var(--bg); }
  .stat .k { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: .04em; }
  .stat .v { font-size: 18px; font-weight: 600; margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .pill.ok { background: color-mix(in srgb, var(--good) 20%, transparent); color: var(--good); }
  .pill.bad { background: color-mix(in srgb, var(--bad) 20%, transparent); color: var(--bad); }
  .url { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); word-break: break-all; }
  .toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: var(--fg); color: var(--bg); padding: 8px 14px; border-radius: 6px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<main>
  <h1>pezines admin</h1>
  <div class="sub">Cyprus petroleum prices &mdash; cache status, manual resync, and a tiny query playground.</div>

  <section class="card">
    <h2>Status</h2>
    <div id="stats" class="stats"><div class="stat"><div class="k">Loading&hellip;</div></div></div>
    <div class="row" style="margin-top:12px"><button class="secondary" id="refreshStatus">Refresh status</button></div>
  </section>

  <section class="card">
    <h2>Resync from gov site</h2>
    <div class="sub" style="margin:0 0 8px">Triggers a fresh scrape. Takes ~30s.</div>
    <div class="row"><button id="resync">Resync now</button></div>
    <pre id="resyncOut" style="margin-top:12px; display:none"></pre>
  </section>

  <section class="card">
    <h2>Query</h2>
    <div class="row">
      <label class="grow">Endpoint
        <select id="endpoint"></select>
      </label>
    </div>
    <div id="paramsBox" class="row" style="margin-top:12px"></div>
    <div class="url" id="urlPreview" style="margin-top:12px"></div>
    <div class="row" style="margin-top:12px">
      <button id="run">Run</button>
      <button class="secondary" id="openTab">Open in new tab</button>
      <button class="secondary" id="copyCurl">Copy as curl</button>
    </div>
    <pre id="queryOut" style="margin-top:12px; display:none"></pre>
  </section>
</main>
<div id="toast" class="toast"></div>

<script>
const ENDPOINTS = [
  { name: 'GET /stations',                 path: '/api/v1/stations',                 params: ['fuelType','district','brand'] },
  { name: 'GET /stations/nearby',          path: '/api/v1/stations/nearby',          params: ['lat','lng','radius','fuelType','sort'] },
  { name: 'GET /stations/:stationId',      path: '/api/v1/stations/{stationId}',     pathParams: ['stationId'] },
  { name: 'GET /prices/cheapest',          path: '/api/v1/prices/cheapest',          params: ['fuelType','district','limit'] },
  { name: 'GET /prices/summary',           path: '/api/v1/prices/summary' },
  { name: 'GET /meta/fuel-types',          path: '/api/v1/meta/fuel-types' },
  { name: 'GET /meta/districts',           path: '/api/v1/meta/districts' },
  { name: 'GET /history/station/:id',      path: '/api/v1/history/station/{stationId}', pathParams: ['stationId'], params: ['fuelType','from','to','limit'] },
  { name: 'GET /history/average',          path: '/api/v1/history/average',          params: ['fuelType','from','to','limit'] },
  { name: 'GET /history/snapshots',        path: '/api/v1/history/snapshots',        params: ['limit'] },
  { name: 'GET /health',                   path: '/api/v1/health' },
];

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

function renderStats(health) {
  const el = $('stats');
  if (!health) { el.innerHTML = '<div class="stat"><div class="k">Status</div><div class="v">Unreachable</div></div>'; return; }
  const stale = health.cache?.staleTTL;
  const populated = health.cache?.populated;
  const scraped = health.cache?.scrapedAt ? new Date(health.cache.scrapedAt).toLocaleString() : '—';
  el.innerHTML = [
    \`<div class="stat"><div class="k">Runtime</div><div class="v">\${health.runtime ?? 'fastify'}</div></div>\`,
    \`<div class="stat"><div class="k">Stations</div><div class="v">\${health.cache?.stationCount ?? 0}</div></div>\`,
    \`<div class="stat"><div class="k">Last scrape</div><div class="v" style="font-size:14px">\${scraped}</div></div>\`,
    \`<div class="stat"><div class="k">Cache</div><div class="v"><span class="pill \${populated ? 'ok':'bad'}">\${populated ? 'populated' : 'empty'}</span> <span class="pill \${stale ? 'bad':'ok'}">\${stale ? 'stale' : 'fresh'}</span></div></div>\`,
  ].join('');
}

async function loadStatus() {
  try {
    const r = await fetch('/api/v1/health');
    renderStats(await r.json());
  } catch { renderStats(null); }
}

$('refreshStatus').addEventListener('click', loadStatus);

$('resync').addEventListener('click', async () => {
  const btn = $('resync');
  const out = $('resyncOut');
  btn.disabled = true; btn.textContent = 'Resyncing…';
  out.style.display = 'block'; out.textContent = 'Working… this can take ~30s.';
  try {
    // Browser auto-sends the basic-auth Authorization header for same-origin requests.
    const r = await fetch('/api/v1/admin/refresh', { method: 'POST' });
    const json = await r.json();
    out.textContent = JSON.stringify(json, null, 2);
    if (r.ok) { toast('Resynced'); loadStatus(); } else { toast('Resync failed'); }
  } catch (e) {
    out.textContent = String(e);
    toast('Network error');
  } finally {
    btn.disabled = false; btn.textContent = 'Resync now';
  }
});

const endpointSel = $('endpoint');
ENDPOINTS.forEach((ep, i) => {
  const opt = document.createElement('option');
  opt.value = String(i); opt.textContent = ep.name;
  endpointSel.appendChild(opt);
});

function currentEndpoint() { return ENDPOINTS[Number(endpointSel.value)]; }

function renderParams() {
  const ep = currentEndpoint();
  const box = $('paramsBox');
  box.innerHTML = '';
  const all = [...(ep.pathParams ?? []).map(p => ({ key:p, kind:'path' })), ...(ep.params ?? []).map(p => ({ key:p, kind:'query' }))];
  if (all.length === 0) {
    box.innerHTML = '<div class="sub" style="margin:0">No parameters</div>';
  }
  all.forEach(({ key, kind }) => {
    const lbl = document.createElement('label');
    lbl.className = 'grow';
    lbl.innerHTML = \`<span>\${key}\${kind === 'path' ? ' *' : ''}</span>\`;
    const input = document.createElement('input');
    input.dataset.kind = kind; input.dataset.key = key; input.placeholder = key;
    input.addEventListener('input', updateUrl);
    lbl.appendChild(input);
    box.appendChild(lbl);
  });
  updateUrl();
}

function buildUrl() {
  const ep = currentEndpoint();
  let path = ep.path;
  const inputs = $('paramsBox').querySelectorAll('input');
  const qs = new URLSearchParams();
  inputs.forEach(i => {
    const v = i.value.trim();
    if (!v) return;
    if (i.dataset.kind === 'path') path = path.replace('{' + i.dataset.key + '}', encodeURIComponent(v));
    else qs.set(i.dataset.key, v);
  });
  const queryStr = qs.toString();
  return path + (queryStr ? '?' + queryStr : '');
}

function updateUrl() { $('urlPreview').textContent = buildUrl(); }

endpointSel.addEventListener('change', renderParams);

$('run').addEventListener('click', async () => {
  const url = buildUrl();
  const out = $('queryOut');
  out.style.display = 'block'; out.textContent = 'Loading…';
  try {
    const r = await fetch(url);
    const text = await r.text();
    try { out.textContent = JSON.stringify(JSON.parse(text), null, 2); } catch { out.textContent = text; }
  } catch (e) { out.textContent = String(e); }
});

$('openTab').addEventListener('click', () => window.open(buildUrl(), '_blank'));

$('copyCurl').addEventListener('click', async () => {
  const url = location.origin + buildUrl();
  await navigator.clipboard.writeText('curl ' + JSON.stringify(url));
  toast('Copied');
});

renderParams();
loadStatus();
</script>
</body>
</html>`;
