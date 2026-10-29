// Growth & Deployment page. All data is simulated data for demo purposes.
PageKit.ready((A) => {
  'use strict';
  const U = PageKit, m = A.m, E = A.E, F = U.formats(A), $ = A.$;
  const sel = (src) => (A.S().x && A.S().x.src === src ? A.S().x.key : null);

  const KPIS = [
    { label: 'Installed base (machines)', v: m.installedBase, f: F.int, subs: [['PY', m.installedBasePY, F.int], ['YoY', m.installedBaseYoY, F.yoy, m.installedBaseColor]] },
    { label: 'Machines installed', v: m.machinesInstalled, f: F.int, subs: [['YTD', m.machinesInstalledYTD, F.int], ['PY', m.machinesInstalledPY, F.int], ['YoY', m.machinesInstalledVsPY, F.text, m.machinesInstalledVsPYColor]] },
    { label: 'Signed locations (cumulative)', v: m.signedLocations, f: F.int, subs: [['PY', m.signedLocationsPY, F.int], ['YoY', m.signedLocationsYoY, F.yoy, m.signedLocationsColor]] },
    { label: 'Ever-live conversion', v: m.installConversion, f: F.pct, subs: [['PY', m.installConversionPY, F.pct], ['YoY', m.installConversionYoY, F.dpp, m.installConversionColor]] },
    { label: 'Unit churn', v: m.unitChurn, f: F.pct, subs: [['YTD', m.unitChurnYTD, F.pct], ['PY', m.unitChurnPY, F.pct], ['YoY', m.unitChurnYoY, F.dpp, m.unitChurnColor]] },
  ];

  // combo: ignores Year/Month (whole data window); click a month -> cross-filter
  let comboIdx = [];
  function combo() {
    const { Mwin, f } = A.pageContext('g-combo'); const s = sel('g-combo'); comboIdx = Mwin;
    const pt = (fn, i) => ({ value: A.blank(fn([i], f)) ? null : fn([i], f), itemStyle: { opacity: U.op(s, String(i)) } });
    U.chart('g-combo').setOption({
      animation: false, color: [U.PAL[0], U.PAL[1], U.PAL[2]], legend: U.legend, tooltip: { trigger: 'axis' },
      grid: { left: 30, right: 34, top: 26, bottom: 22 },
      xAxis: { type: 'category', data: Mwin.map(E.label), ...U.axis, axisLabel: { ...U.axis.axisLabel, interval: 5 } },
      yAxis: [{ type: 'value', ...U.axis, minInterval: 1 }, { type: 'value', ...U.axis, splitLine: { show: false } }],
      series: [
        { name: 'Installed', type: 'bar', data: Mwin.map((i) => pt(m.machinesInstalled, i)), barGap: '10%' },
        { name: 'Removed', type: 'bar', data: Mwin.map((i) => pt(m.machinesRemoved, i)) },
        { name: 'Installed base', type: 'line', yAxisIndex: 1, showSymbol: false, smooth: false, lineStyle: { width: 2.5 }, data: Mwin.map((i) => m.installedBase([i], f)) },
      ],
    }, true);
  }
  function bindCombo() {
    const c = U.chart('g-combo');
    c.getZr().on('click', (e) => {
      if (!c.containPixel('grid', [e.offsetX, e.offsetY])) return;
      const i = comboIdx[Math.round(c.convertFromPixel({ seriesIndex: 0 }, [e.offsetX, e.offsetY])[0])];
      if (i !== undefined) A.setCross({ src: 'g-combo', key: String(i), M: [i] });
    });
  }

  // signing half-year chart: 'Signing Half' is a disconnected table, the visual ignores Year/Month and the window
  function half() {
    const { f } = A.pageContext('g-half'); const H = E.helpers.halves;
    const ser = (d, name, c) => ({ name, type: 'bar', color: c, data: H.map((h) => m.signToLiveHalf(d)(h.sort, f)) });
    U.chart('g-half').setOption({
      animation: false, legend: U.legend, grid: { left: 38, right: 8, top: 26, bottom: 34 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => F.pct(v), formatter: (ps) => `${ps[0].axisValue}<br>` + ps.map((p) => `${p.marker}${p.seriesName}: ${F.pct(p.value)}`).join('<br>') + `<br>Sites signed: ${m.sitesSignedHalf(H[ps[0].dataIndex].sort, f)}` },
      xAxis: { type: 'category', data: H.map((h) => h.label), ...U.axis, axisLabel: { ...U.axis.axisLabel, rotate: 45 } },
      yAxis: { type: 'value', max: 1, ...U.axis, axisLabel: { ...U.axis.axisLabel, formatter: (v) => Math.round(v * 100) + '%' } },
      series: [ser(60, '60 days', U.PAL[0]), ser(90, '90 days', U.PAL[1]), ser(120, '120 days', U.PAL[2])],
    }, true);
  }

  // region bar: ignores Year/Month (full window); click a region -> cross-filter
  const regionOrder = () => A.D.regions.map((r, i) => [r, i]).sort((a, b) => b[0].localeCompare(a[0]));
  function region() {
    const { Mwin, f } = A.pageContext('g-region'); const s = sel('g-region'); const R = regionOrder();
    const rf = (i) => ({ ...f, sites: A.sitesWhere((st, si) => st[1] === i && (!f.sites || f.sites.has(si))) });
    const ser = (fn, name, c) => ({ name, type: 'bar', color: c, label: { show: true, position: 'right', fontSize: 9, formatter: (p) => F.dec1(p.value) },
      data: R.map(([, i]) => ({ value: fn(Mwin, rf(i)), itemStyle: { opacity: U.op(s, String(i)) } })) });
    U.chart('g-region').setOption({
      animation: false, legend: U.legend, grid: { left: 96, right: 30, top: 26, bottom: 20 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => `${ps[0].axisValue}<br>` + ps.map((p) => `${p.marker}${p.seriesName}: ${F.dec1(p.value)} days`).join('<br>') + `<br>Machines: ${m.machinesTimeToLive(Mwin, rf(R[ps[0].dataIndex][1]))}` },
      yAxis: { type: 'category', data: R.map((r) => r[0]), ...U.axis },
      xAxis: { type: 'value', ...U.axis },
      series: [ser(m.timeToLiveP50, 'Sign → live P50', U.PAL[0]), ser(m.timeToLiveP90, 'Sign → live P90', U.PAL[1]), ser(m.readyToLiveP50, 'Ready → live P50', U.PAL[2])],
    }, true);
  }
  function bindRegion() {
    U.chart('g-region').on('click', (p) => { const i = regionOrder()[p.dataIndex][1]; A.setCross({ src: 'g-region', key: String(i), sites: A.sitesWhere((s) => s[1] === i) }); });
  }

  const VCOLS = [
    ['Installed base', m.installedBase, F.int], ['PY', m.installedBasePY, F.int], ['YoY %', m.installedBaseYoY, F.yoy, (v) => A.tone(v)],
    ['Installed', m.machinesInstalled, F.int], ['Inst. YTD', m.machinesInstalledYTD, F.int], ['Signed (cum.)', m.signedLocations, F.int],
    ['Ever-live conv.', m.installConversion, F.pct], ['Unit churn', m.unitChurn, F.pct],
  ];
  function venue() {
    const { M, f } = A.pageContext('g-venue');
    U.matrix(A, $('#g-venue'), { first: 'Venue type', rows: U.visible(A, U.venueRows(A, f), VCOLS, M), cols: VCOLS, M, total: f, selected: sel('g-venue'),
      onClick: (k) => A.setCross({ src: 'g-venue', key: k, sites: A.sitesWhere((s) => s[2] === +k) }) });
  }
  const CCOLS = [['Installed base', m.installedBase, F.int], ['Cohort size', m.cohortSize, F.int], ['Removed to date', m.removedToDate, F.int], ['Retention 12M', m.siteRetention12m, F.pct]];
  function cohort() {
    const { M, f } = A.pageContext('g-cohort');
    const rows = A.D.cohorts.map((l, i) => ({ key: String(i), label: l, f: { ...f, cohorts: new Set([i]) } }));
    U.matrix(A, $('#g-cohort'), { first: 'Go-live cohort', rows: U.visible(A, rows, CCOLS, M), cols: CCOLS, M, total: f, selected: sel('g-cohort'),
      onClick: (k) => A.setCross({ src: 'g-cohort', key: k, cohorts: new Set([+k]) }) });
  }

  let bound = false;
  A.register('growth-deployment', {
    show() { if (!bound) { bound = true; U.chart('g-combo'); U.chart('g-half'); U.chart('g-region'); bindCombo(); bindRegion(); } setTimeout(() => U.resizeAll(['g-combo', 'g-half', 'g-region']), 0); },
    render() {
      const { M, f } = A.pageContext('g-kpis');
      document.querySelector('#page-growth-deployment .period-out').textContent = E.periodLabel(M);
      U.kpis(A, $('#g-kpis'), KPIS, M, f);
      combo(); half(); region(); venue(); cohort();
    },
  });
});
