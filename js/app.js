// Executive Dashboard – shared state, slicers, tabs and the Board Summary page (vanilla JS + ECharts).
// The other pages live in js/pages/*.js and register through window.App.
// All data is simulated data for demo purposes.
(async function () {
  'use strict';
  const D = await fetch('data/dashboard.json').then((r) => r.json());
  const E = Measures.create(D);
  const m = E.measures;
  const blank = E.isBlank;
  const $ = (s) => document.querySelector(s);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsIdx = D.months.map((_, i) => i);
  const years = [...new Set(monthsIdx.map((i) => E.ym(i).y))];
  const lastIdx = D.months.length - 1;

  // ---------- state
  const defaults = () => ({
    year: new Set([E.ym(lastIdx).y]), month: new Set([E.ym(lastIdx).m]),
    region: new Set(), venue: new Set(), contract: new Set(), account: new Set(),
    crossMonth: null, crossAccount: null, window: 'All window',
    x: null, // cross-filter on the other pages: { src, M?, sites?, cohorts?, items?, key }
  });
  let S = defaults();

  // ---------- formatting
  const fmt = {
    money: (v) => (blank(v) ? '' : (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US')),
    pct: (v) => (blank(v) ? '' : (v * 100).toFixed(1) + '%'),
    signedPct: (v) => (blank(v) ? '' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'),
    // model format for Δ (pp) measures: +0.0%;-0.0%;0.0% (same as the other pages)
    pp: (v) => (blank(v) ? '' : (Math.abs(v) < 0.0005 ? (v < 0 ? '-0.0%' : '0.0%') : (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%')),
    int: (v) => (blank(v) ? '' : Math.round(v).toLocaleString('en-US')),
    dec1: (v) => (blank(v) ? '' : v.toFixed(1)),
    signedInt: (v) => (blank(v) ? '' : (v > 0 ? '+' : '') + Math.round(v)),
  };
  const dash = (s) => (s === '' ? '--' : s);
  const tone = (v, eps = 0) => (blank(v) || Math.abs(v) < eps ? 'neutral' : v >= 0 ? 'pos' : 'neg');

  // ---------- filter context
  function context() {
    let M = monthsIdx.filter((i) => { const { y, m: mo } = E.ym(i); return (!S.year.size || S.year.has(y)) && (!S.month.size || S.month.has(mo)); });
    if (S.crossMonth !== null) M = [S.crossMonth];
    let sites = null;
    if (S.region.size || S.venue.size) {
      sites = new Set(D.sites.map((s, i) => ((!S.region.size || S.region.has(s[1])) && (!S.venue.size || S.venue.has(s[2])) ? i : -1)).filter((i) => i >= 0));
    }
    const f = { sites, contracts: S.contract.size ? new Set(S.contract) : null, accounts: S.crossAccount !== null ? new Set([S.crossAccount]) : null };
    return { M, f };
  }

  // ---------- slicers
  const slicerDefs = {
    year: years.map((y) => [y, String(y)]),
    month: MON.map((n, i) => [i + 1, n]),
    region: D.regions.map((n, i) => [i, n]),
    venue: D.venues.map((n, i) => [i, n]),
    contract: D.contractTypes.map((n, i) => [i, n]),
    account: D.accounts.map((n, i) => [i, n]).sort((a, b) => a[1].localeCompare(b[1])),
  };
  function renderSlicers() {
    for (const [k, items] of Object.entries(slicerDefs)) {
      const box = document.querySelector(`[data-slicer="${k}"] .slicer-buttons`);
      box.innerHTML = '';
      for (const [val, text] of items) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sbtn' + (S[k].has(val) ? ' on' : ''); b.textContent = text; b.title = text;
        b.onclick = () => { // single-select: pick only this value; clicking the selected value again clears back to 'all'
          S[k] = S[k].has(val) && S[k].size === 1 ? new Set() : new Set([val]); if (k === 'year' || k === 'month') S.crossMonth = null; S.x = null; render(); };
        box.appendChild(b);
      }
    }
  }
  $('#clear-filters').onclick = () => { S = defaults(); render(); };

  // ratio vs 100% (NRR): green above, red below, neutral when blank
  const tone100 = (v) => (blank(v) ? '' : tone(v - 1, 0.00005));

  // ---------- KPI strip
  const KPIS = [
    { label: 'Revenue', v: m.revenue, ytd: m.revenueYTD, py: m.revenuePY, yoy: m.revenueYoY, f: fmt.money, yf: fmt.signedPct },
    { label: 'Revenue Contribution', v: m.contribution, ytd: m.contributionYTD, py: m.contributionPY, yoy: m.contributionYoY, f: fmt.money, yf: fmt.signedPct },
    { label: 'Active sites', v: m.activeSites, ytd: m.activeSitesYTD, py: m.activeSitesPY, yoy: m.activeSitesYoY, f: fmt.int, yf: fmt.signedPct },
    { label: 'Cups / machine-day (mature)', v: m.cupsMature, ytd: m.cupsMatureYTD, py: m.cupsMaturePY, yoy: m.cupsMatureYoY, f: fmt.dec1, yf: fmt.signedPct },
    { label: 'NRR', v: m.nrr, ytd: m.nrrYTD, py: m.nrrPY, yoy: m.nrrYoYpp, f: fmt.pct, yf: fmt.pp, eps: 0.0005, vs100: true },
  ];
  function renderKpis(M, f) {
    $('#kpi-strip').innerHTML = KPIS.map((k) => {
      const y = k.yoy(M, f);
      return `<div class="kpi"><span class="kpi-label">${k.label}</span><span class="kpi-value ${k.vs100 ? tone100(k.v(M, f)) : ''}">${dash(k.f(k.v(M, f)))}</span>
        <div class="kpi-sub"><span>YTD</span><b class="${k.vs100 ? 'r100 ' + tone100(k.ytd(M, f)) : ''}">${dash(k.f(k.ytd(M, f)))}</b></div>
        <div class="kpi-sub"><span>PY</span><b>${dash(k.f(k.py(M, f)))}</b></div>
        <div class="kpi-sub"><span>YoY</span><b class="${tone(y, k.eps)}">${dash(k.yf(y))}</b></div></div>`;
    }).join('');
  }

  // ---------- small cards
  const MINIS = [
    ['Revenue from operations (share)', m.recurringRevenuePct],
    ['Top customer share', m.top1Share],
    ['Cumulative payback (to date)', m.cumulativePayback],
    ['Site retention (12M)', m.siteRetention12m],
  ];
  function renderMinis(M, f) {
    $('#mini-cards').innerHTML = MINIS.map(([l, fn]) => `<div class="card mini"><span class="mini-label">${l}</span><span class="mini-value">${dash(fmt.pct(fn(M, f)))}</span></div>`).join('');
  }

  // ---------- trend chart (not filtered by Year/Month slicers, like the source visual interactions)
  const chart = echarts.init($('#trend-chart'));
  const WINDOWS = ['All window', ...years.map(String)];
  function renderWindowButtons() {
    $('#trend-window').innerHTML = WINDOWS.map((w) => `<button type="button" class="wbtn${S.window === w ? ' on' : ''}" data-w="${w}">${w}</button>`).join('');
    document.querySelectorAll('.wbtn').forEach((b) => (b.onclick = () => { S.window = b.dataset.w; render(); }));
  }
  let chartIdx = [];
  function renderChart(f) {
    chartIdx = monthsIdx.filter((i) => S.window === 'All window' || String(E.ym(i).y) === S.window);
    const cats = chartIdx.map((i) => E.label(i));
    const point = (fn) => chartIdx.map((i) => {
      const v = fn([i], f);
      const sel = S.crossMonth === null || S.crossMonth === i;
      return { value: blank(v) ? null : Math.round(v), symbolSize: S.crossMonth === i ? 9 : 4, itemStyle: { opacity: sel ? 1 : 0.35 } };
    });
    chart.setOption({
      animation: false,
      grid: { left: 48, right: 14, top: 26, bottom: 24 },
      legend: { top: 0, left: 0, icon: 'circle', itemWidth: 8, textStyle: { fontSize: 10, color: '#6B7280' } },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmt.money(v) },
      xAxis: { type: 'category', data: cats, boundaryGap: false, axisLabel: { fontSize: 9, color: '#6B7280' }, axisLine: { lineStyle: { color: '#D1D5DB' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, color: '#6B7280', formatter: (v) => '$' + Math.round(v / 1000) + 'K' }, splitLine: { lineStyle: { color: '#F1F2F4' } } },
      series: [
        { name: 'Revenue', type: 'line', data: point(m.revenue), color: '#1F3A5F', lineStyle: { width: 2.5 }, symbol: 'circle', showSymbol: true },
        { name: 'Revenue contribution', type: 'line', data: point(m.contribution), color: '#2A9D8F', lineStyle: { width: 2.5 }, symbol: 'circle', showSymbol: true },
      ],
    }, true);
  }
  // click anywhere on the plot -> cross-filter the other visuals to that month (click again to clear)
  chart.getZr().on('click', (e) => {
    if (!chart.containPixel('grid', [e.offsetX, e.offsetY])) return;
    const k = chart.convertFromPixel({ seriesIndex: 0 }, [e.offsetX, e.offsetY])[0];
    const i = chartIdx[Math.round(k)];
    if (i === undefined) return;
    S.crossMonth = S.crossMonth === i ? null : i;
    render();
  });
  window.addEventListener('resize', () => chart.resize());

  // ---------- matrix (rows by account, total row = same measures in the page context = KPI cards)
  const COLS = [
    ['Revenue', 'revenue', fmt.money], ['Revenue YTD', 'revenueYTD', fmt.money], ['Revenue PY', 'revenuePY', fmt.money],
    ['YoY %', 'revenueYoY', fmt.signedPct], ['Active sites', 'activeSites', fmt.int], ['Cups/day (mature)', 'cupsMature', fmt.dec1],
    ['Revenue contribution', 'contribution', fmt.money], ['NRR', 'nrr', fmt.pct],
  ];
  function renderMatrix(M, f) {
    const fAll = { ...f, accounts: null }; // matrix itself is the source of the account cross-filter
    const rows = E.accountRows(M, fAll).sort((a, b) => a.name.localeCompare(b.name));
    const cell = (k, fn, v) => `<td class="${k === 'revenueYoY' ? tone(v) : k === 'nrr' ? tone100(v) : ''}">${fn(v)}</td>`;
    const head = `<thead><tr><th>Account</th>${COLS.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead>`;
    const body = rows.map((r) => {
      const cls = S.crossAccount === null ? '' : S.crossAccount === r.account ? 'selected' : 'dim';
      return `<tr data-acc="${r.account}" class="${cls}"><td>${r.name}</td>${COLS.map(([, k, fn]) => cell(k, fn, r[k])).join('')}</tr>`;
    }).join('');
    const tot = `<tfoot><tr><td>Total</td>${COLS.map(([, k, fn]) => cell(k, fn, m[k](M, f))).join('')}</tr></tfoot>`;
    $('#matrix').innerHTML = head + `<tbody>${body}</tbody>` + tot;
    document.querySelectorAll('#matrix tbody tr').forEach((tr) => (tr.onclick = () => {
      const a = +tr.dataset.acc; S.crossAccount = S.crossAccount === a ? null : a; render();
    }));
  }

  // ---------- highlights ('Highlight Lines' table + Highlight Value / Color / Detail measures)
  function renderHighlights(M, f) {
    const rev = m.revenueYoY(M, f), sites = m.activeSites(M, f), sitesPy = m.activeSitesPY(M, f), cups = m.cupsMatureYoY(M, f);
    const nrr = m.nrr(M, f), av = m.sellableAvailability(M, f), avd = m.sellableAvailabilityYoYpp(M, f), top = m.top1Share(M, f);
    const k1 = (v) => (blank(v) ? '' : '$' + (v / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K');
    const avS = blank(av) ? null : Math.round(av * 1000) / 1000;
    const lines = [
      ['Revenue', blank(rev) ? 'n/a' : fmt.signedPct(rev), rev, `${k1(m.revenue(M, f))} vs ${k1(m.revenuePY(M, f))} LY`],
      ['Sites', blank(sitesPy) ? 'n/a' : fmt.signedInt(nz(sites) - sitesPy), blank(sitesPy) ? null : nz(sites) - sitesPy, `${fmt.int(sites)} active vs ${fmt.int(sitesPy)} a year ago`],
      ['Productivity', blank(cups) ? 'n/a' : fmt.signedPct(cups), cups, `${fmt.dec1(m.cupsMature(M, f))} vs ${fmt.dec1(m.cupsMaturePY(M, f))} cups/day`],
      ['Retention', blank(nrr) ? 'n/a' : fmt.pct(nrr), blank(nrr) ? null : nrr - 1, 'NRR, existing accounts vs LY'],
      ['Availability', blank(av) ? 'n/a' : fmt.pct(av), avS === null ? null : avS > 0.95 ? 1 : avS < 0.95 ? -1 : null,
        blank(av) ? 'Sellable n/a' : `Sellable ${fmt.pct(av)} (${blank(avd) ? 'n/a' : fmt.pp(avd)} YoY)`],
      ['Concentration', fmt.pct(top), blank(top) ? null : 0.3 - top, 'Top account; flag > 30%'],
    ];
    $('#highlights-title').textContent = `KPI Highlights (${E.periodLabel(M)})`;
    $('#highlights').innerHTML = '<thead><tr><th>Topic</th><th>Change</th><th>Detail</th></tr></thead><tbody>' +
      lines.map((l, i) => [l, i, { pos: 0, neutral: 1, neg: 2 }[tone(l[2])]])   // green first, plain next, red last; stable within group
        .sort((a, b) => a[2] - b[2] || a[1] - b[1]).map(([l]) => l).map(([t, v, c, d]) => `<tr><td>${t}</td><td class="${tone(c)}">${v}</td><td>${d}</td></tr>`).join('') + '</tbody>';
  }
  const nz = (v) => (blank(v) ? 0 : v);

  // ---------- render all
  let page = 'board-summary';
  const pages = {};
  function render() {
    renderSlicers();
    if (page !== 'board-summary') { pages[page].render(); return; }
    const { M, f } = context();
    renderWindowButtons();
    $('#period-label').textContent = E.periodLabel(M);
    renderKpis(M, f); renderMinis(M, f); renderMatrix(M, f); renderHighlights(M, f);
    renderChart({ ...f });
  }
  $('#data-window').textContent = `${E.label(0)} – ${E.label(lastIdx)}`;

  // ---------- context for the other pages (Account slicer + page cross-filter)
  // src = id of the visual asking; a visual is never filtered by its own selection (it highlights it instead)
  function pageContext(src) {
    const base = context();
    const yearMonths = monthsIdx.filter((i) => !S.year.size || S.year.has(E.ym(i).y)); // 'selected year' visuals ignore Month
    let { M } = base; const f = { ...base.f, accounts: S.account.size ? new Set(S.account) : null };
    let Mwin = monthsIdx.slice(), Myear = yearMonths;
    const x = S.x;
    if (x && x.src !== src) {
      if (x.M) { M = x.M; Mwin = x.M; Myear = x.M; }
      if (x.sites) f.sites = f.sites ? new Set([...f.sites].filter((s) => x.sites.has(s))) : new Set(x.sites);
      if (x.cohorts) f.cohorts = x.cohorts;
      if (x.items) f.items = x.items;
    }
    return { M, f, Mwin, Myear };
  }
  const setCross = (x) => { S.x = S.x && x && S.x.src === x.src && S.x.key === x.key ? null : x; render(); };
  const sitesWhere = (fn) => new Set(D.sites.map((s, i) => (fn(s, i) ? i : -1)).filter((i) => i >= 0));
  const colorClass = (hex) => (hex === '#1B7F3B' ? 'pos' : hex === '#B3261E' ? 'neg' : 'neutral');

  window.App = { D, E, m, S: () => S, fmt, dash, tone, blank, $, MON, monthsIdx, years, lastIdx, pageContext, setCross, sitesWhere, colorClass, render,
    register: (id, p) => (pages[id] = p) };

  // ---------- tabs
  function showPage(id) {
    page = id; S.x = null; S.crossMonth = null; S.crossAccount = null;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.page === id));
    document.querySelectorAll('main.content').forEach((el) => (el.hidden = el.id !== 'page-' + id));
    $('[data-slicer="account"]').hidden = id === 'board-summary';
    if (pages[id] && pages[id].show) pages[id].show();
    render();
    if (id === 'board-summary') chart.resize();
  }
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => showPage(tab.dataset.page)));
  App.showPage = showPage;
  document.querySelectorAll('.data-window').forEach((el) => (el.textContent = `${E.label(0)} – ${E.label(lastIdx)}`));
  window.dispatchEvent(new Event('app-ready'));

  showPage(new URLSearchParams(location.search).get('page') || 'board-summary');
  window.__dashboardReady = true;
})();
