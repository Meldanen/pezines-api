export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>pezines admin</title>
<style>
  :root { color-scheme: light dark; --b:#d0d4da; --bg:#fafbfc; --fg:#1a1a1a; --muted:#6b7280; --accent:#2563eb; --bad:#b91c1c; --good:#15803d; --warn:#b45309; }
  @media (prefers-color-scheme: dark) { :root { --b:#2a2f36; --bg:#0f1115; --fg:#e6e6e6; --muted:#9aa3ad; --accent:#60a5fa; --bad:#f87171; --good:#4ade80; --warn:#fbbf24; } }
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
  h3 { font-size: 13px; margin: 0 0 8px; color: var(--muted); font-weight: 500; }
  .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  .chart-wrap { position: relative; height: 280px; }
  .chart-wrap.short { height: 180px; }
  .chart-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); font-style: italic; pointer-events: none; text-align: center; padding: 0 12px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .stat { padding: 8px 12px; border: 1px solid var(--b); border-radius: 8px; background: var(--bg); }
  .stat .k { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: .04em; }
  .stat .v { font-size: 18px; font-weight: 600; margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .pill.ok { background: color-mix(in srgb, var(--good) 20%, transparent); color: var(--good); }
  .pill.bad { background: color-mix(in srgb, var(--bad) 20%, transparent); color: var(--bad); }
  .url { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); word-break: break-all; }
  .toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: var(--fg); color: var(--bg); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; opacity: 0; transition: opacity .2s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .toast.warn { background: var(--warn); color: #fff; }
  .toast.bad  { background: var(--bad);  color: #fff; }
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
    <h2>Avg price trend</h2>
    <div class="row">
      <label>Window
        <select id="trendLimit">
          <option value="48">last 48 snapshots</option>
          <option value="168">last 168</option>
          <option value="500" selected>all (up to 500)</option>
        </select>
      </label>
      <button class="secondary" id="trendReload">Reload</button>
    </div>
    <div class="chart-wrap" style="margin-top:12px"><canvas id="trendChart"></canvas></div>
  </section>

  <section class="card">
    <h2>Avg / min / max per fuel (now)</h2>
    <div class="chart-wrap"><canvas id="summaryChart"></canvas></div>
  </section>

  <section class="card">
    <h2>Top 10 cheapest stations</h2>
    <div class="row" style="margin-bottom:8px">
      <label class="grow">Fuel
        <select id="cheapFuel" autocomplete="off"></select>
      </label>
    </div>
    <div class="chart-wrap"><canvas id="cheapestChart"></canvas></div>
  </section>

  <section class="card">
    <h2>Snapshot cadence</h2>
    <div class="sub" style="margin:0 0 8px">Minutes between consecutive snapshots. Hourly cron should be ~60. Spikes mean a missed run.</div>
    <div class="chart-wrap short"><canvas id="cadenceChart"></canvas></div>
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

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" integrity="sha384-NrKB+u6Ts6AtkIhwPixiKTzgSKNblyhlk0Sohlgar9UHUBzai/sgnNNWWd291xqt" crossorigin="anonymous"></script>
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

function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('warn', 'bad');
  if (kind === 'warn' || kind === 'bad') t.classList.add(kind);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), kind ? 2600 : 1600);
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
    if (r.ok) {
      if (json.fresh === false) {
        toast('Scrape failed — kept stale cache', 'warn');
      } else {
        toast('Resynced');
      }
      loadStatus();
    } else { toast('Resync failed', 'bad'); }
  } catch (e) {
    out.textContent = String(e);
    toast('Network error', 'bad');
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

// ---------- Charts ----------
const PALETTE = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d'];
const charts = {};

function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

function chartMsg(wrap, msg) {
  let el = wrap.querySelector('.chart-msg');
  if (!el) {
    el = document.createElement('div');
    el.className = 'chart-msg';
    wrap.appendChild(el);
  }
  if (msg) { el.textContent = msg; el.style.display = ''; }
  else el.style.display = 'none';
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function gridColor() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
}

function tickColor() {
  return getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#888';
}

function commonAxes(opts = {}) {
  const c = gridColor(); const t = tickColor();
  return {
    x: { grid: { color: c }, ticks: { color: t, autoSkip: true, maxRotation: 0, ...opts.xTicks } },
    y: { grid: { color: c }, ticks: { color: t, ...opts.yTicks }, beginAtZero: !!opts.beginAtZero },
  };
}

async function loadTrend() {
  const limit = $('trendLimit').value;
  const wrap = $('trendChart').parentElement;
  destroyChart('trend');
  chartMsg(wrap, 'Loading…');
  try {
    const r = await fetch(\`/api/v1/history/average?limit=\${limit}\`);
    if (!r.ok) { chartMsg(wrap, 'HTTP ' + r.status + ' from /history/average'); return; }
    const json = await r.json();
    const rows = (json.history ?? []).slice().sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    if (rows.length === 0) { chartMsg(wrap, 'No history yet — click Resync to capture a snapshot.'); return; }
    const fuels = [...new Set(rows.map(r => r.fuel_type))];
    const labels = [...new Set(rows.map(r => r.recorded_at))].sort();
    const labelIdx = new Map(labels.map((l, i) => [l, i]));
    const singlePoint = labels.length === 1;
    const datasets = fuels.map((ft, i) => {
      const data = new Array(labels.length).fill(null);
      for (const row of rows) if (row.fuel_type === ft) data[labelIdx.get(row.recorded_at)] = row.avg_price;
      return { label: ft, data, borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length], tension: .25, spanGaps: true, pointRadius: singlePoint ? 4 : 2, borderWidth: 2 };
    });
    chartMsg(wrap, null);
    charts.trend = new Chart($('trendChart'), {
      type: 'line',
      data: { labels: labels.map(fmtTime), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: { legend: { labels: { color: tickColor() } }, tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex] } } },
        scales: commonAxes({ xTicks: { maxTicksLimit: 8 } }),
      },
    });
  } catch (e) { chartMsg(wrap, 'Error: ' + String(e)); }
}

async function loadSummary() {
  const wrap = $('summaryChart').parentElement;
  destroyChart('summary');
  chartMsg(wrap, 'Loading…');
  try {
    const r = await fetch('/api/v1/prices/summary');
    if (!r.ok) { chartMsg(wrap, 'HTTP ' + r.status + ' from /prices/summary'); return; }
    const json = await r.json();
    const items = json.byFuelType ?? [];
    if (items.length === 0) { chartMsg(wrap, 'No data.'); return; }
    chartMsg(wrap, null);
    charts.summary = new Chart($('summaryChart'), {
      type: 'bar',
      data: {
        labels: items.map(i => i.fuelType),
        datasets: [
          { label: 'min', data: items.map(i => i.min), backgroundColor: PALETTE[2] },
          { label: 'avg', data: items.map(i => i.avg), backgroundColor: PALETTE[0] },
          { label: 'max', data: items.map(i => i.max), backgroundColor: PALETTE[1] },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tickColor() } } },
        scales: commonAxes({ xTicks: { autoSkip: false } }),
      },
    });
  } catch (e) { chartMsg(wrap, 'Error: ' + String(e)); }
}

async function loadCheapest() {
  const fuel = $('cheapFuel').value;
  const wrap = $('cheapestChart').parentElement;
  destroyChart('cheapest');
  if (!fuel) { chartMsg(wrap, 'Pick a fuel.'); return; }
  chartMsg(wrap, 'Loading…');
  try {
    const r = await fetch(\`/api/v1/prices/cheapest?fuelType=\${encodeURIComponent(fuel)}&limit=10\`);
    if (!r.ok) { chartMsg(wrap, 'HTTP ' + r.status + ' from /prices/cheapest'); return; }
    const json = await r.json();
    const stations = json.stations ?? [];
    if (stations.length === 0) { chartMsg(wrap, 'No data.'); return; }
    chartMsg(wrap, null);
    charts.cheapest = new Chart($('cheapestChart'), {
      type: 'bar',
      data: {
        labels: stations.map(s => \`\${s.brand} — \${s.name}\`),
        datasets: [{ label: fuel, data: stations.map(s => s.price), backgroundColor: PALETTE[0] }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: commonAxes({ yTicks: { autoSkip: false, font: { size: 11 } } }),
      },
    });
  } catch (e) { chartMsg(wrap, 'Error: ' + String(e)); }
}

async function loadCadence() {
  const wrap = $('cadenceChart').parentElement;
  destroyChart('cadence');
  chartMsg(wrap, 'Loading…');
  try {
    const r = await fetch('/api/v1/history/snapshots?limit=200');
    if (!r.ok) { chartMsg(wrap, 'HTTP ' + r.status + ' from /history/snapshots'); return; }
    const json = await r.json();
    const snaps = (json.snapshots ?? []).slice().sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    if (snaps.length < 2) { chartMsg(wrap, 'Need at least 2 snapshots — current: ' + snaps.length + '.'); return; }
    chartMsg(wrap, null);
    const labels = []; const data = []; const colors = [];
    for (let i = 1; i < snaps.length; i++) {
      const gap = (new Date(snaps[i].recorded_at) - new Date(snaps[i - 1].recorded_at)) / 60000;
      labels.push(fmtTime(snaps[i].recorded_at));
      data.push(Math.round(gap * 10) / 10);
      colors.push(gap > 90 ? PALETTE[1] : gap < 30 ? PALETTE[3] : PALETTE[0]);
    }
    charts.cadence = new Chart($('cadenceChart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'gap (min)', data, backgroundColor: colors }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: commonAxes({ beginAtZero: true, xTicks: { maxTicksLimit: 10 } }),
      },
    });
  } catch (e) { chartMsg(wrap, 'Error: ' + String(e)); }
}

async function loadFuelsAndCharts() {
  try {
    const r = await fetch('/api/v1/meta/fuel-types');
    const { fuelTypes = [] } = await r.json();
    const sel = $('cheapFuel');
    sel.innerHTML = '';
    const isPreferred = (ft) => /unleaded\s*95|\b95\b/i.test(ft);
    const preferred = fuelTypes.find(isPreferred);
    for (const ft of fuelTypes) {
      const o = document.createElement('option');
      o.value = ft;
      o.textContent = ft;
      if (preferred ? ft === preferred : false) o.selected = true;
      sel.appendChild(o);
    }
  } catch {}
  loadSummary();
  loadCheapest();
  loadTrend();
  loadCadence();
}

$('cheapFuel').addEventListener('change', loadCheapest);
$('trendReload').addEventListener('click', loadTrend);
$('trendLimit').addEventListener('change', loadTrend);

if (window.Chart) loadFuelsAndCharts();
else window.addEventListener('load', loadFuelsAndCharts);
</script>
</body>
</html>`;
