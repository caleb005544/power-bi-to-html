// Shared building blocks for the Growth, Productivity and Availability pages.
// All data is simulated data for demo purposes.
(function () {
  'use strict';
  const PAL = ['#1F3A5F', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#8AB17D', '#6C8EBF', '#B07AA1', '#9CA3AF', '#264653']; // report theme
  const U = (window.PageKit = {});
  U.PAL = PAL;
  U.ready = (fn) => window.addEventListener('app-ready', () => fn(window.App));

  U.formats = (A) => {
    const b = A.blank;
    return {
      ...A.fmt,
      money2: (v) => (b(v) ? '' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
      pct2: (v) => (b(v) ? '' : (v * 100).toFixed(2) + '%'),
      // model format for Δ (pp) measures: +0.0%;-0.0%;0.0%
      dpp: (v) => (b(v) ? '' : (Math.abs(v) < 0.0005 ? (v < 0 ? '-0.0%' : '0.0%') : (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%')),
      // model format for YoY %: +0.0%;-0.0%;0.0%
      yoy: (v) => (b(v) ? '' : v === 0 ? '0.0%' : (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%'),
      text: (v) => (b(v) ? '' : String(v)),
    };
  };

  // KPI strip: [{label, v, f, subs: [[label, fn, fmt, colorFn?]]}]
  U.kpis = (A, el, specs, M, f) => {
    el.innerHTML = specs.map((k) => `<div class="kpi"><span class="kpi-label">${k.label}</span><span class="kpi-value">${A.dash(k.f(k.v(M, f)))}</span>
      <div class="kpi-subs">${k.subs.map(([l, fn, fm, col]) => `<div class="kpi-sub"><span>${l}</span><b class="${col ? A.colorClass(col(M, f)) : ''}">${A.dash(fm(fn(M, f)))}</b></div>`).join('')}</div></div>`).join('');
  };

  // Matrix: rows [{key, label, cls, ctx: f}], cols [[header, fn(M,f), fmt, cellClassFn?]], total f
  U.matrix = (A, el, { first, rows, cols, M, total, selected, onClick, rowStyle }) => {
    const cell = (c, M2, f2) => { const v = c[1](M2, f2); const cls = c[3] ? c[3](v, M2, f2) : ''; return `<td class="${cls}">${c[2](v)}</td>`; };
    const head = `<thead><tr><th>${first}</th>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead>`;
    const body = rows.map((r) => {
      const cls = selected === null || selected === undefined ? '' : selected === r.key ? 'selected' : 'dim';
      return `<tr data-key="${r.key}" class="${cls}" ${rowStyle ? `style="${rowStyle(r)}"` : ''}><td>${r.label}</td>${cols.map((c) => cell(c, M, r.f)).join('')}</tr>`;
    }).join('');
    const foot = total ? `<tfoot><tr><td>Total</td>${cols.map((c) => cell(c, M, total)).join('')}</tr></tfoot>` : '';
    el.innerHTML = head + `<tbody>${body}</tbody>` + foot;
    if (onClick) el.querySelectorAll('tbody tr').forEach((tr) => (tr.onclick = () => onClick(tr.dataset.key)));
  };
  // rows that show at least one non-blank value (Power BI hides all-blank rows)
  U.visible = (A, rows, cols, M) => rows.filter((r) => cols.some((c) => !A.blank(c[1](M, r.f)) && c[1](M, r.f) !== ''));

  U.charts = {};
  U.chart = (id) => {
    if (!U.charts[id]) { U.charts[id] = echarts.init(document.getElementById(id)); window.addEventListener('resize', () => U.charts[id].resize()); }
    return U.charts[id];
  };
  U.resizeAll = (ids) => ids.forEach((id) => U.charts[id] && U.charts[id].resize());
  U.axis = { axisLabel: { fontSize: 9, color: '#6B7280' }, axisLine: { lineStyle: { color: '#D1D5DB' } }, splitLine: { lineStyle: { color: '#F1F2F4' } } };
  U.legend = { top: 0, left: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 10, color: '#6B7280' } };
  U.op = (sel, key) => (sel === null || sel === undefined || sel === key ? 1 : 0.3);
  // venue colour = theme colour by alphabetical order of venue_type (Power BI series order)
  U.venueColor = (A) => { const order = A.D.venues.map((v, i) => [v, i]).sort((a, b) => a[0].localeCompare(b[0])); const c = {}; order.forEach(([, i], k) => (c[i] = PAL[k % PAL.length])); return c; };
  U.venueRows = (A, f) => A.D.venues.map((v, i) => [v, i]).sort((a, b) => a[0].localeCompare(b[0])).map(([v, i]) => ({
    key: String(i), label: v, f: { ...f, sites: A.sitesWhere((s, si) => s[2] === i && (!f.sites || f.sites.has(si))) } }));
})();
