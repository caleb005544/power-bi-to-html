// Site Productivity page (Leaflet + OpenStreetMap site map). All data is simulated data for demo purposes.
PageKit.ready((A) => {
  'use strict';
  const U = PageKit, m = A.m, E = A.E, F = U.formats(A), $ = A.$, D = A.D;
  const sel = (src) => (A.S().x && A.S().x.src === src ? A.S().x.key : null);
  const VC = U.venueColor(A);
  const venuesSorted = D.venues.map((v, i) => [v, i]).sort((a, b) => a[0].localeCompare(b[0]));
  const TAIL_TIER = D.volumeTiers.indexOf('Bottom quartile');

  const fam = (label, k, f, df) => ({ label, v: m[k], f, subs: [['YTD', m[k + 'YTD'], f], ['PY', m[k + 'PY'], f], ['YoY', m[k + 'YoY'], df, m[k + 'Color']]] });
  const KPIS = [fam('Cups / machine-day', 'cupsPerDay', F.dec1, F.yoy), fam('Revenue / machine-day', 'revenuePerDay', F.money2, F.yoy),
    fam('Average ticket', 'averageTicket', F.money2, F.yoy), fam('Cashless %', 'cashless', F.pct, F.dpp)];

  // ---------- map
  let map = null, layer = null, fitKey = null;
  function initMap() {
    map = L.map('p-map', { zoomControl: true, attributionControl: true, preferCanvas: false }).fitBounds([[49.0, -123.27855], [49.36, -122.76045]]);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('click', () => { if (sel('p-map') !== null) A.setCross(null); });
    $('#p-map-legend').innerHTML = venuesSorted.map(([v, i]) => `<span><i style="background:${VC[i]}"></i>${v}</span>`).join('');
  }
  function renderMap() {
    const { M, f } = A.pageContext('p-map'); const s = sel('p-map');
    layer.clearLayers();
    const pts = [];
    D.sites.forEach((st, si) => {
      if (f.sites && !f.sites.has(si)) return;   // all regions (every site has lat/long)
      const sf = { ...f, sites: new Set([si]) }; const rev = m.revenue(M, sf);
      if (A.blank(rev)) return;   // no Size value -> no bubble (as in the scatter visual)
      pts.push({ si, st, sf, rev });
    });
    const maxRev = Math.max(1, ...pts.map((p) => p.rev));
    pts.sort((a, b) => b.rev - a.rev).forEach(({ si, st, sf, rev }) => {
      const on = s === null || s === String(si);
      const c = L.circleMarker([st[4], st[5]], { radius: 4 + 16 * Math.sqrt(Math.max(rev, 0) / maxRev), color: '#fff', weight: 1, fillColor: VC[st[2]], fillOpacity: on ? 0.85 : 0.2, opacity: on ? 1 : 0.3 });
      c.bindTooltip(`<b>${st[3]}</b><br>${D.venues[st[2]]}<br>Revenue: ${F.money(rev)}<br>Cups / machine-day: ${A.dash(F.dec1(m.cupsPerDay(M, sf)))}<br>Sellable: ${A.dash(F.pct(m.sellableAvailability(M, sf)))}<br>Stockout: ${A.dash(F.pct(m.stockoutRate(M, sf)))}<br>Site contribution: ${A.dash(F.money(m.contribution(M, sf)))}`);
      c.on('click', (e) => { L.DomEvent.stopPropagation(e); A.setCross({ src: 'p-map', key: String(si), sites: new Set([si]) }); });
      c.addTo(layer);
    });
    // auto-fit to the visible bubbles when the set changes (slicers / other cross-filters); a bubble click keeps the view
    const key = pts.map((p) => p.si).sort((a, b) => a - b).join(',');
    if (key !== fitKey && pts.length) {
      fitKey = key;
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.st[4], p.st[5]])), { padding: [24, 24], maxZoom: 13 });
    }
    const regs = [...new Set(pts.map((p) => D.regions[p.st[1]]))];
    $('#p-map-note').textContent = `${pts.length} site${pts.length === 1 ? '' : 's'}${regs.length ? ' | ' + regs.join(' + ') : ''}`;
  }

  // ---------- percentile chart by venue (click = venue cross-filter)
  let pctRows = [];
  function pct() {
    const { M, f } = A.pageContext('p-pct'); const s = sel('p-pct');
    pctRows = U.venueRows(A, f).filter((r) => !A.blank(m.cupsMedian(M, r.f)));
    const ser = (fn, name, c) => ({ name, type: 'bar', color: c, data: pctRows.map((r) => ({ value: fn(M, r.f), itemStyle: { opacity: U.op(s, r.key) } })) });
    U.chart('p-pct').setOption({
      animation: false, legend: U.legend, grid: { left: 34, right: 8, top: 26, bottom: 40 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => F.dec1(v) },
      xAxis: { type: 'category', data: pctRows.map((r) => r.label), ...U.axis, axisLabel: { ...U.axis.axisLabel, rotate: 30 } },
      yAxis: { type: 'value', ...U.axis },
      series: [ser(m.cupsP25, 'P25', U.PAL[0]), ser(m.cupsMedian, 'Median', U.PAL[1]), ser(m.cupsP75, 'P75', U.PAL[2])],
    }, true);
  }

  // ---------- product mix (click = item cross-filter; only sales measures react, like Dim_Item in the model)
  let mixRows = [];
  function mix() {
    const { M, f } = A.pageContext('p-mix'); const s = sel('p-mix');
    mixRows = D.items.map((n, i) => ({ n, i, v: m.productMix(M, { ...f, items: new Set([i]) }) })).filter((r) => !A.blank(r.v)).sort((a, b) => a.v - b.v);
    U.chart('p-mix').setOption({
      animation: false, grid: { left: 130, right: 40, top: 6, bottom: 20 }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => F.pct(v) },
      yAxis: { type: 'category', data: mixRows.map((r) => r.n), ...U.axis },
      xAxis: { type: 'value', ...U.axis, axisLabel: { ...U.axis.axisLabel, formatter: (v) => Math.round(v * 100) + '%' } },
      series: [{ type: 'bar', color: U.PAL[0], barWidth: '60%', label: { show: true, position: 'right', fontSize: 9, formatter: (p) => F.pct(p.value) },
        data: mixRows.map((r) => ({ value: r.v, itemStyle: { opacity: U.op(s, String(r.i)) } })) }],
    }, true);
  }

  const VCOLS = [['Cups/day', m.cupsPerDay, F.dec1], ['YTD', m.cupsPerDayYTD, F.dec1], ['PY', m.cupsPerDayPY, F.dec1], ['YoY %', m.cupsPerDayYoY, F.yoy, (v) => A.tone(v)],
    ['Rev/day', m.revenuePerDay, F.money2], ['Ticket', m.averageTicket, F.money2]];
  function venue() {
    const { M, f } = A.pageContext('p-venue');
    U.matrix(A, $('#p-venue'), { first: 'Venue type', rows: U.visible(A, U.venueRows(A, f), VCOLS, M), cols: VCOLS, M, total: f, selected: sel('p-venue'),
      onClick: (k) => A.setCross({ src: 'p-venue', key: k, sites: A.sitesWhere((s) => s[2] === +k) }) });
  }
  const TCOLS = [['Cups/day (mature)', m.cupsMature, F.dec1], ['Sellable %', m.sellableAvailability, F.pct]];
  function tail() {
    const { M, f } = A.pageContext('p-tail');
    const rows = D.sites.map((st, si) => ({ st, si })).filter(({ st, si }) => st[6] === TAIL_TIER && (!f.sites || f.sites.has(si)))
      .map(({ st, si }) => ({ key: String(si), label: st[3], f: { ...f, sites: new Set([si]) } }));
    const vis = U.visible(A, rows, TCOLS, M).map((r) => ({ ...r, c: m.cupsMature(M, r.f) }))
      .sort((a, b) => (A.blank(a.c) ? 1e9 : a.c) - (A.blank(b.c) ? 1e9 : b.c));
    U.matrix(A, $('#p-tail'), { first: 'Site', rows: vis, cols: TCOLS, M, selected: sel('p-tail'),
      onClick: (k) => A.setCross({ src: 'p-tail', key: k, sites: new Set([+k]) }) });
  }

  let bound = false;
  A.register('site-productivity', {
    show() {
      if (!bound) {
        bound = true; initMap();
        U.chart('p-pct').on('click', (p) => { const r = pctRows[p.dataIndex]; A.setCross({ src: 'p-pct', key: r.key, sites: A.sitesWhere((s) => s[2] === +r.key) }); });
        U.chart('p-mix').on('click', (p) => { const r = mixRows[p.dataIndex]; A.setCross({ src: 'p-mix', key: String(r.i), items: new Set([r.i]) }); });
      }
      setTimeout(() => { map.invalidateSize(); U.resizeAll(['p-pct', 'p-mix']); }, 0);
    },
    render() {
      const { M, f } = A.pageContext('p-kpis');
      document.querySelector('#page-site-productivity .period-out').textContent = E.periodLabel(M);
      U.kpis(A, $('#p-kpis'), KPIS, M, f);
      renderMap(); pct(); mix(); venue(); tail();
    },
  });
});
