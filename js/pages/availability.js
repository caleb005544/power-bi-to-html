// Availability & Ops Quality page. All data is simulated data for demo purposes.
PageKit.ready((A) => {
  'use strict';
  const U = PageKit, m = A.m, E = A.E, F = U.formats(A), $ = A.$, D = A.D;
  const sel = (src) => (A.S().x && A.S().x.src === src ? A.S().x.key : null);

  const fam = (label, k, f, df) => ({ label, v: m[k], f, subs: [['YTD', m[k + 'YTD'], f], ['PY', m[k + 'PY'], f], ['YoY', m[k + 'YoY'], df, m[k + 'Color']]] });
  const KPIS = [fam('Uptime', 'uptime', F.pct, F.dpp), fam('Sellable availability', 'sellable', F.pct, F.dpp), fam('Stockout rate', 'stockoutRate', F.pct, F.dpp),
    fam('MTTR (hours)', 'mttr', F.dec1, F.yoy), fam('Breakdowns / 100 machines', 'breakdownsPer100', F.dec1, F.yoy)];

  // lost-time combo: selected year, ignores Month; click a month -> cross-filter
  let comboIdx = [];
  function combo() {
    const { Myear, f } = A.pageContext('a-combo'); const s = sel('a-combo'); comboIdx = Myear;
    const col = (fn, name, c) => ({ name, type: 'bar', stack: 'loss', color: c, barWidth: '45%', data: Myear.map((i) => ({ value: fn([i], f), itemStyle: { opacity: U.op(s, String(i)) } })) });
    const line = (fn, name, c) => ({ name, type: 'line', yAxisIndex: 1, color: c, showSymbol: false, smooth: true, lineStyle: { width: 2.5 }, data: Myear.map((i) => fn([i], f)) });
    const pf = (v) => Math.round(v * 100) + '%';
    U.chart('a-combo').setOption({
      animation: false, legend: U.legend, grid: { left: 36, right: 40, top: 28, bottom: 22 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => F.pct(v) },
      xAxis: { type: 'category', data: Myear.map(E.label), ...U.axis },
      yAxis: [{ type: 'value', ...U.axis, axisLabel: { ...U.axis.axisLabel, formatter: pf } },
        { type: 'value', min: (v) => Math.max(0, Math.floor(v.min * 10) / 10), max: 1, ...U.axis, splitLine: { show: false }, axisLabel: { ...U.axis.axisLabel, formatter: pf } }],
      series: [col(m.downtimeLoss, 'Downtime', U.PAL[0]), col(m.stockoutLoss, 'Stockout', U.PAL[1]), col(m.staffGapLoss, 'Staff gap', U.PAL[2]),
        line(m.uptime, 'Uptime %', U.PAL[3]), line(m.sellable, 'Sellable %', U.PAL[4])],
    }, true);
  }

  // heatmap matrix (selected year, ignores Month); click a cell -> venue × month cross-filter, row label -> venue
  function heat() {
    const { Myear, f } = A.pageContext('a-heat'); const s = sel('a-heat');
    const rows = U.venueRows(A, f).filter((r) => !A.blank(m.sellable(Myear, r.f)));
    const vals = []; rows.forEach((r) => Myear.forEach((i) => { const v = m.sellable([i], r.f); if (!A.blank(v)) vals.push(v); }));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const bg = (v) => {   // diverging red -> yellow -> green, like the source conditional formatting
      if (A.blank(v) || hi === lo) return ''; const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      const a = t < 0.5 ? [248, 215, 218] : [255, 243, 205], b = t < 0.5 ? [255, 243, 205] : [212, 237, 218], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      return `background:rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * u)).join(',')})`;
    };
    const ym = (i) => { const { y, m: mo } = E.ym(i); return `${y}-${String(mo).padStart(2, '0')}`; };
    const cls = (key) => (s === null ? '' : s === key ? 'selected' : 'dim');
    let h = `<thead><tr><th>Venue type</th>${Myear.map((i) => `<th>${ym(i)}</th>`).join('')}<th>Total</th></tr></thead><tbody>`;
    rows.forEach((r) => {
      h += `<tr><td>${r.label}</td>${Myear.map((i) => { const v = m.sellable([i], r.f); const k = r.key + ':' + i; return `<td class="cell ${cls(k)}" data-k="${k}" style="${bg(v)}">${F.pct(v)}</td>`; }).join('')}<td><b>${F.pct(m.sellable(Myear, r.f))}</b></td></tr>`;
    });
    h += `</tbody><tfoot><tr><td>Total</td>${Myear.map((i) => `<td>${F.pct(m.sellable([i], f))}</td>`).join('')}<td>${F.pct(m.sellable(Myear, f))}</td></tr></tfoot>`;
    const el = $('#a-heat'); el.innerHTML = h;
    el.querySelectorAll('td.cell').forEach((td) => (td.onclick = () => {
      const [v, i] = td.dataset.k.split(':').map(Number);
      A.setCross({ src: 'a-heat', key: td.dataset.k, sites: A.sitesWhere((st) => st[2] === v), M: [i] });
    }));
  }

  const grey = (v, M, f) => (m.opsSampleColor(M, f) === '#9CA3AF' ? 'muted' : '');
  const VCOLS = [['Uptime', m.uptime, F.pct], ['PY', m.uptimePYActive, F.pct], ['Sellable', m.sellable, F.pct], ['Down', m.downtimeLoss, F.pct],
    ['Stock-out', m.stockoutLoss, F.pct], ['Staff', m.staffGapLoss, F.pct], ['MTTR h', m.mttr, F.dec1, grey], ['n brk', m.breakdowns, F.int],
    ['Brk/100', m.breakdownsPer100, F.dec1, grey], ['Mach-mo', m.machineMonths, F.dec1], ['Fill', m.fillRate, F.pct], ['Waste', m.wasteRate, F.pct2]];
  function venue() {
    const { M, f } = A.pageContext('a-venue');
    U.matrix(A, $('#a-venue'), { first: 'Venue type', rows: U.visible(A, U.venueRows(A, f), VCOLS, M), cols: VCOLS, M, total: f, selected: sel('a-venue'),
      onClick: (k) => A.setCross({ src: 'a-venue', key: k, sites: A.sitesWhere((s) => s[2] === +k) }) });
  }

  // top 10 sites by consumption variance (RANKX over the sites selected on the page)
  let topRows = [];
  function top() {
    const { M, f } = A.pageContext('a-top'); const s = sel('a-top');
    topRows = D.sites.map((st, si) => ({ st, si, sf: { ...f, sites: new Set([si]) } })).filter(({ si }) => !f.sites || f.sites.has(si))
      .map((r) => ({ ...r, v: m.consumptionVarianceTop10(M, r.sf, f) })).filter((r) => !A.blank(r.v)).sort((a, b) => a.v - b.v);
    U.chart('a-top').setOption({
      animation: false, grid: { left: 130, right: 46, top: 6, bottom: 20 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => { const r = topRows[ps[0].dataIndex]; return `${r.st[3]}<br>Consumption variance: ${F.pct2(r.v)}<br>Waste rate: ${A.dash(F.pct2(m.wasteRate(M, r.sf)))}`; } },
      yAxis: { type: 'category', data: topRows.map((r) => r.st[3]), ...U.axis },
      xAxis: { type: 'value', ...U.axis, axisLabel: { ...U.axis.axisLabel, formatter: (v) => (v * 100).toFixed(0) + '%' } },
      series: [{ type: 'bar', color: U.PAL[0], barWidth: '60%', label: { show: true, position: 'right', fontSize: 9, formatter: (p) => F.pct2(p.value) },
        data: topRows.map((r) => ({ value: r.v, itemStyle: { opacity: U.op(s, String(r.si)) } })) }],
    }, true);
  }

  let bound = false;
  A.register('availability-ops', {
    show() {
      if (!bound) {
        bound = true;
        const c = U.chart('a-combo');
        c.getZr().on('click', (e) => {
          if (!c.containPixel('grid', [e.offsetX, e.offsetY])) return;
          const i = comboIdx[Math.round(c.convertFromPixel({ seriesIndex: 0 }, [e.offsetX, e.offsetY])[0])];
          if (i !== undefined) A.setCross({ src: 'a-combo', key: String(i), M: [i] });
        });
        U.chart('a-top').on('click', (p) => { const r = topRows[p.dataIndex]; A.setCross({ src: 'a-top', key: String(r.si), sites: new Set([r.si]) }); });
      }
      setTimeout(() => U.resizeAll(['a-combo', 'a-top']), 0);
    },
    render() {
      const { M, f } = A.pageContext('a-kpis');
      document.querySelector('#page-availability-ops .period-out').textContent = E.periodLabel(M);
      U.kpis(A, $('#a-kpis'), KPIS, M, f);
      combo(); heat(); venue(); top();
    },
  });
});
