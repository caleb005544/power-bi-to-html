/*
 * Board Summary measure engine.
 * Replicates the DAX of the source semantic model on the compact JSON in data/.
 * Works in the browser (window.Measures) and in Node (module.exports) so the
 * numbers can be validated outside the page.
 *
 * Filter context:
 *   months    : array of month indexes (0 = first month of the data window). Empty = no month in context.
 *   sites     : Set of site indexes allowed (null = all)       <- Region / Venue / account cross-filter
 *   contracts : Set of contract-type indexes allowed (null = all)
 *   accounts  : Set of account indexes allowed (null = all)
 * All data is simulated data for demo purposes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Measures = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BLANK = null;
  const isBlank = (v) => v === null || v === undefined || Number.isNaN(v);
  // DAX DIVIDE: blank when denominator is 0/blank
  const divide = (a, b) => (isBlank(b) || b === 0 || isBlank(a) ? BLANK : a / b);
  const nz = (v) => (isBlank(v) ? 0 : v);


  // ======================================================================
  // Growth & Deployment, Site Productivity, Availability & Ops measures.
  // Same conventions as above; every family (X, PY, YTD, PYTD, YoY, YTD YoY, Color)
  // follows the model's generated time-intelligence pattern.
  // ======================================================================
  const DAY = 86400000;
  const pctile = (vals, p) => {               // PERCENTILEX.INC (Excel INC interpolation)
    if (!vals.length) return BLANK;
    const s = vals.slice().sort((a, b) => a - b); const r = p * (s.length - 1);
    const lo = Math.floor(r), hi = Math.ceil(r); return s[lo] + (s[hi] - s[lo]) * (r - lo);
  };

  function extend(X) {
    const { D, N, ym, max, min, py, ytd, periodEnd, comparable, rowOk, memo } = X;
    const C = (name) => { const m = {}; D[name + 'Cols'].forEach((c, i) => (m[c] = i)); return m; };
    const MC = C('machineMonth'), DC = C('deployment'), SC = C('sales'), IC = C('inventory');
    const mm = D.machineMonth, dep = D.deployments, sales = D.sales, inv = D.inventory;
    const dayOf = (i) => { const { y, m } = ym(i); return Date.UTC(y, m - 1, 1) / DAY; };        // first day of month i
    const eomDay = (i) => dayOf(i + 1) - 1;                                                     // EOMONTH(month i, 0)
    const daysIn = (i) => dayOf(i + 1) - dayOf(i);
    const DATA_END_DAY = eomDay(N - 1);
    const M_ = {};

    // ---- aggregations
    const mmSum = (M, f) => memo('mm2', M, f, () => {
      const S = new Set(M); const a = { n: 0, cups: 0, days: 0, sched: 0, sell: 0, up: 0, down: 0, stock: 0, staff: 0, fail: 0, repair: 0, mmonths: 0, byMachine: new Map() };
      for (const r of mm) {
        if (!S.has(r[0]) || !rowOk(f, r[1], r[2])) continue;
        a.n++; a.cups += r[MC.paidCups]; a.days += r[MC.operatingDays]; a.sched += r[MC.scheduledMin]; a.sell += r[MC.sellableMin];
        a.up += r[MC.uptimeMin]; a.down += r[MC.downtimeMin]; a.stock += r[MC.stockoutMin]; a.staff += r[MC.staffGapMin];
        a.fail += r[MC.failures]; a.repair += r[MC.repairMin]; a.mmonths += r[MC.activeCalendarDays] / daysIn(r[0]);
        const b = a.byMachine.get(r[1]) || [0, 0]; b[0] += r[MC.paidCups]; b[1] += r[MC.operatingDays]; a.byMachine.set(r[1], b);
      }
      return a;
    });
    const salesSum = (M, f) => memo('sales', M, f, () => {
      const S = new Set(M); const a = { n: 0, net: 0, consumer: 0, cashless: 0, tx: 0 };
      for (const r of sales) {
        if (!S.has(r[0]) || !rowOk(f, r[1], r[2]) || (f.items && !f.items.has(r[SC.item]))) continue;
        a.n++; a.net += r[SC.netRevenue]; a.consumer += r[SC.consumerSales]; a.cashless += r[SC.cashlessSales]; a.tx += r[SC.transactions];
      }
      return a;
    });
    const invSum = (M, f) => memo('inv', M, f, () => {
      const S = new Set(M); const a = { n: 0, rec: 0, waste: 0, act: 0, theo: 0, due: 0, filled: 0 };
      for (const r of inv) {
        if (!S.has(r[0]) || !rowOk(f, r[1], r[2])) continue;
        a.n++; a.rec += r[IC.receivedCups]; a.waste += r[IC.wasteCups]; a.act += r[IC.actualUseCups]; a.theo += r[IC.theoreticalUseCups];
        a.due += r[IC.slotsDue]; a.filled += r[IC.slotsFilledOnTime];
      }
      return a;
    });
    const sumOrBlank = (a, k) => (a.n ? a[k] : BLANK);
    const deps = (f) => dep.filter((r) => rowOk(f, r[DC.machine], r[DC.site]));
    const depsLive = (M, f) => { if (M.noDateFilter) return deps(f); const S = new Set(M); return deps(f).filter((r) => r[DC.liveMonth] !== null && S.has(r[DC.liveMonth])); }; // active relationship
    const cnt = (n) => (n ? n : BLANK); // COUNTROWS / DISTINCTCOUNT of nothing = blank

    // ---- base measures (machine month)
    M_.paidCupsMachine = (M, f) => sumOrBlank(mmSum(M, f), 'cups');
    M_.machineDays = (M, f) => sumOrBlank(mmSum(M, f), 'days');
    M_.scheduledMinutes = (M, f) => sumOrBlank(mmSum(M, f), 'sched');
    M_.uptimeMinutes = (M, f) => sumOrBlank(mmSum(M, f), 'up');
    M_.downtimeMinutes = (M, f) => sumOrBlank(mmSum(M, f), 'down');
    M_.stockoutMinutes = (M, f) => sumOrBlank(mmSum(M, f), 'stock');
    M_.staffGapMinutes = (M, f) => sumOrBlank(mmSum(M, f), 'staff');
    M_.breakdowns = (M, f) => sumOrBlank(mmSum(M, f), 'fail');
    M_.machineMonths = (M, f) => sumOrBlank(mmSum(M, f), 'mmonths');
    const ratio = (num, den) => (M, f) => divide(num(M, f), den(M, f));
    M_.cupsPerDay = ratio(M_.paidCupsMachine, M_.machineDays);
    M_.revenuePerDay = ratio(X.M_.revenue, M_.machineDays);
    M_.uptime = ratio(M_.uptimeMinutes, M_.scheduledMinutes);
    M_.stockoutRate = ratio(M_.stockoutMinutes, M_.scheduledMinutes);
    M_.downtimeLoss = ratio(M_.downtimeMinutes, M_.scheduledMinutes);
    M_.stockoutLoss = ratio(M_.stockoutMinutes, M_.scheduledMinutes);
    M_.staffGapLoss = ratio(M_.staffGapMinutes, M_.scheduledMinutes);
    M_.mttr = (M, f) => { const a = mmSum(M, f); return a.n ? divide(a.repair / 60, a.fail) : BLANK; };
    M_.breakdownsPer100 = (M, f) => { const d = divide(M_.breakdowns(M, f), M_.machineMonths(M, f)); return d === BLANK ? BLANK : d * 100; };
    const cupsPctile = (p) => (M, f) => {
      const v = []; mmSum(M, f).byMachine.forEach(([c, d]) => { if (d > 0) v.push(c / d); }); return pctile(v, p);
    };
    M_.cupsP25 = cupsPctile(0.25); M_.cupsMedian = cupsPctile(0.5); M_.cupsP75 = cupsPctile(0.75);

    // ---- sales / inventory
    M_.netCupRevenue = (M, f) => sumOrBlank(salesSum(M, f), 'net');
    M_.consumerSales = (M, f) => sumOrBlank(salesSum(M, f), 'consumer');
    M_.transactions = (M, f) => sumOrBlank(salesSum(M, f), 'tx');
    M_.averageTicket = ratio(M_.consumerSales, M_.transactions);
    M_.cashless = (M, f) => { const a = salesSum(M, f); return a.n ? divide(a.cashless, M_.consumerSales(M, f)) : BLANK; };
    M_.productMix = (M, f) => divide(M_.netCupRevenue(M, f), M_.netCupRevenue(M, { ...f, items: null }));
    M_.fillRate = (M, f) => { const a = invSum(M, f); return a.n ? divide(a.filled, a.due) : BLANK; };
    M_.wasteRate = (M, f) => { const a = invSum(M, f); return a.n ? divide(a.waste, a.rec) : BLANK; };
    M_.consumptionVariance = (M, f) => { const a = invSum(M, f); return a.n ? divide(a.act - a.theo, a.theo) : BLANK; };
    // RANKX ( ALLSELECTED ( Dim_Site[site_name] ), [Consumption Variance %], , DESC ) <= 10
    M_.consumptionVarianceTop10 = (M, f, selected) => {
      const v = M_.consumptionVariance(M, f); if (isBlank(v)) return BLANK;
      const pool = selected || f; let higher = 0;
      D.sites.forEach((_, s) => {
        if (pool.sites && !pool.sites.has(s)) return;
        const x = M_.consumptionVariance(M, { ...pool, sites: new Set([s]) });
        if (!isBlank(x) && x > v) higher++;
      });
      return higher + 1 <= 10 ? v : BLANK;
    };

    // ---- deployment / growth
    M_.installedBase = (M, f) => {
      const e = periodEnd(M); if (e === null) return BLANK; const s = new Set();
      for (const r of mm) if (r[0] === e && r[MC.activeEom] === 1 && rowOk(f, r[1], r[2])) s.add(r[1]);
      return cnt(s.size);
    };
    const cumSites = (dayCol, mustLive) => (M, f) => {
      const e = periodEnd(M); if (e === null) return BLANK; const lim = eomDay(e); const s = new Set();
      for (const r of deps(f)) if ((!mustLive || r[DC.liveDay] !== null) && r[dayCol] !== null && r[dayCol] <= lim) s.add(r[DC.site]);
      return cnt(s.size);
    };
    M_.signedLocations = cumSites(DC.signedDay, false);
    M_.liveLocations = cumSites(DC.liveDay, true);
    M_.installConversion = ratio(M_.liveLocations, M_.signedLocations);
    M_.machinesInstalled = (M, f) => cnt(depsLive(M, f).filter((r) => r[DC.liveDay] !== null).length);
    M_.machinesRemoved = (M, f) => { if (M.noDateFilter) return cnt(deps(f).length); const S = new Set(M); return cnt(deps(f).filter((r) => r[DC.removedMonth] !== null && S.has(r[DC.removedMonth])).length); };
    M_.installedBaseAtStart = (M, f) => {
      const s = min(M); if (s === null) return BLANK; const e = dayOf(s) - 1;
      return cnt(deps(f).filter((r) => r[DC.liveDay] !== null && r[DC.liveDay] <= e && (r[DC.removedDay] === null || r[DC.removedDay] > e)).length);
    };
    M_.unitChurn = ratio(M_.machinesRemoved, M_.installedBaseAtStart);
    M_.cohortSize = (M, f) => {
      const e = periodEnd(M); if (e === null) return BLANK; const lim = eomDay(e);
      return cnt(deps(f).filter((r) => r[DC.liveDay] !== null && r[DC.liveDay] <= lim).length);
    };
    M_.removedToDate = (M, f) => {
      if (isBlank(M_.cohortSize(M, f))) return BLANK; const lim = eomDay(periodEnd(M));
      return deps(f).filter((r) => r[DC.removedDay] !== null && r[DC.removedDay] <= lim).length;
    };
    const ttl = (col, p) => (M, f) => pctile(depsLive(M, f).map((r) => r[col]).filter((v) => v !== null), p);
    M_.timeToLiveP50 = ttl(DC.daysSignToLive, 0.5); M_.timeToLiveP90 = ttl(DC.daysSignToLive, 0.9);
    M_.readyToLiveP50 = ttl(DC.daysReadyToLive, 0.5); M_.readyToLiveP90 = ttl(DC.daysReadyToLive, 0.9);
    M_.machinesTimeToLive = (M, f) => depsLive(M, f).filter((r) => r[DC.daysSignToLive] !== null).length;

    // 'Signing Half' (Sort = year*10 + half): first machine per site signed in the half; ignores Year/Month and the data window
    const halves = []; for (let y = 2023, h = 2; y * 10 + h <= 20261; h === 2 ? (y++, h = 1) : h++) halves.push({ sort: y * 10 + h, label: `${y} H${h}` });
    const halfRows = (sort, f) => {
      const y = Math.floor(sort / 10), h = sort % 10; const s = Date.UTC(y, (h - 1) * 6, 1) / DAY, e = Date.UTC(y, (h - 1) * 6 + 6, 1) / DAY - 1;
      return deps(f).filter((r) => r[DC.isFirstMachineAtSite] === 1 && r[DC.signedDay] >= s && r[DC.signedDay] <= e);
    };
    M_.signToLiveHalf = (days) => (sort, f) => {
      if (sort === null || sort === undefined) return BLANK;
      const elig = halfRows(sort, f).filter((r) => DATA_END_DAY - r[DC.signedDay] >= days);
      if (!elig.length) return BLANK;
      return elig.filter((r) => r[DC.daysSignToLive] !== null && r[DC.daysSignToLive] <= days).length / elig.length;
    };
    M_.sitesSignedHalf = (sort, f) => (sort === null || sort === undefined ? BLANK : halfRows(sort, f).length);

    // ---- time-intelligence family (model pattern)
    const out = {};
    const PYf = (m) => (M, f) => m(py(M), f);
    const YTDf = (m) => (M, f) => m(ytd(M), f);
    const PYTDf = (m) => (M, f) => m(ytd(py(M)), f);   // CALCULATE([X YTD], SAMEPERIODLASTYEAR)
    const both = (a, b) => !isBlank(a) && !isBlank(b);
    const GREY = '#6B7280', GREEN = '#1B7F3B', RED = '#B3261E';
    function family(key, m, kind, dir, unguarded) {
      out[key] = m; out[key + 'PY'] = PYf(m); out[key + 'YTD'] = YTDf(m); out[key + 'PYTD'] = PYTDf(m);
      const chg = (c, p) => (kind === 'pp' ? c - p : divide(c - p, p));
      if (unguarded) {   // e.g. 'Consumer Sales YoY %' = DIVIDE ( [X] - [X PY], [X PY] )
        out[key + 'YoY'] = (M, f) => divide(nz(m(M, f)) - nz(m(py(M), f)), m(py(M), f));
        out[key + 'YTDYoY'] = (M, f) => divide(nz(out[key + 'YTD'](M, f)) - nz(out[key + 'PYTD'](M, f)), out[key + 'PYTD'](M, f));
      } else {
      out[key + 'YoY'] = (M, f) => { const c = m(M, f), p = m(py(M), f); return both(c, p) && comparable(M) ? chg(c, p) : BLANK; };
      out[key + 'YTDYoY'] = (M, f) => { const c = out[key + 'YTD'](M, f), p = out[key + 'PYTD'](M, f); return both(c, p) ? chg(c, p) : BLANK; };
      }
      out[key + 'Color'] = (M, f) => {
        const d = out[key + 'YoY'](M, f);
        if (isBlank(d) || (kind === 'pp' && Math.abs(d) < 0.0005)) return GREY;
        return d * dir >= 0 ? GREEN : RED;
      };
    }
    family('installedBase', M_.installedBase, 'pct', 1);
    family('machinesInstalled', M_.machinesInstalled, 'pct', 1);
    family('signedLocations', M_.signedLocations, 'pct', 1);
    family('installConversion', M_.installConversion, 'pp', 1);
    family('unitChurn', M_.unitChurn, 'pp', -1);
    family('cupsPerDay', M_.cupsPerDay, 'pct', 1);
    family('revenuePerDay', M_.revenuePerDay, 'pct', 1);
    family('averageTicket', M_.averageTicket, 'pct', 1);
    family('cashless', M_.cashless, 'pp', 1);
    family('uptime', M_.uptime, 'pp', 1);
    family('sellable', X.M_.sellableAvailability, 'pp', 1);
    family('stockoutRate', M_.stockoutRate, 'pp', -1);
    family('mttr', M_.mttr, 'pct', -1);
    family('breakdownsPer100', M_.breakdownsPer100, 'pct', -1);
    family('machineDays', M_.machineDays, 'pct', 1);
    family('consumerSales', M_.consumerSales, 'pct', 1, true);
    family('paidCups', M_.paidCupsMachine, 'pct', 1);

    out.machinesInstalledVsPY = (M, f) => comparable(M)
      ? `${Math.round(nz(M_.machinesInstalled(M, f)))} vs ${Math.round(nz(M_.machinesInstalled(py(M), f)))} PY` : 'n/a';
    out.machinesInstalledVsPYColor = (M, f) => {
      const c = nz(M_.machinesInstalled(M, f)), p = nz(M_.machinesInstalled(py(M), f));
      return !comparable(M) || (c === 0 && p === 0) ? GREY : c >= p ? GREEN : RED;
    };
    out.uptimePYActive = (M, f) => (isBlank(M_.machineMonths(M, f)) ? BLANK : out.uptimePY(M, f));
    out.opsSampleColor = (M, f) => (nz(M_.breakdowns(M, f)) < 5 || nz(M_.machineMonths(M, f)) < 3 ? '#9CA3AF' : '#1F2937');

    for (const k of Object.keys(M_)) if (!(k in out)) out[k] = M_[k];
    return { measures: out, helpers: { halves, pctile, dayOf, eomDay } };
  }

  function create(D) {
    const N = D.months.length;
    const DATA_END = N - 1; // 'Data End Month' = last month in Fact_MachineMonth
    const [y0, m0] = D.months[0].split('-').map(Number);
    const ym = (i) => { const t = y0 * 12 + (m0 - 1) + i; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = (i) => { const { y, m } = ym(i); return `${MON[m - 1]} ${y}`; };

    const fin = D.finance;      // [month, machine, site, recurring, revenue, cogs, logistics, service, equipmentCogs]
    const mm = D.machineMonth;  // [month, machine, site, activeEom, mature, operatingDays, paidCups, sellableMin, scheduledMin]
    const dep = D.deployments;  // [machine, site, deployCost]
    const siteAcc = D.sites.map((s) => s[0]);
    const machCt = D.machines.map((m) => m[1]);
    const machCoh = D.machines.map((m) => (m[2] === undefined ? -1 : m[2]));

    const rowOk = (f, machine, site) =>
      (!f.sites || f.sites.has(site)) &&
      (!f.contracts || f.contracts.has(machCt[machine])) &&
      (!f.cohorts || f.cohorts.has(machCoh[machine])) &&
      (!f.accounts || f.accounts.has(siteAcc[site]));

    // ---- time intelligence on month-index sets
    const max = (M) => (M.length ? Math.max(...M) : null);
    const min = (M) => (M.length ? Math.min(...M) : null);
    const py = (M) => M.map((i) => i - 12);                         // SAMEPERIODLASTYEAR
    const ytd = (M) => {                                            // DATESYTD
      if (!M.length) return [];
      const e = max(M); const jan = e - (ym(e).m - 1);
      const out = []; for (let i = jan; i <= e; i++) out.push(i); return out;
    };
    const periodEnd = (M) => (M.length ? Math.min(max(M), DATA_END) : null); // 'Period End Month'
    const inWindow = (M) => M.filter((i) => i >= 0 && i < N).length;
    const comparable = (M) => { const c = inWindow(M); return c > 0 && c === inWindow(py(M)); }; // 'YoY Comparable Period'

    // ---- base aggregations (cached per call key)
    const cache = new Map();
    const key = (tag, M, f) => tag + '|' + M.join(',') + '|' + [f.sites, f.contracts, f.accounts, f.cohorts, f.items].map((s) => (s ? [...s].sort().join('.') : '*')).join('|');
    const memo = (tag, M, f, fn) => { const k = key(tag, M, f); if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

    function finAgg(M, f) {
      return memo('fin', M, f, () => {
        const S = new Set(M); const a = { n: 0, rev: 0, rec: 0, cost: 0, eq: 0, byAcc: {} };
        for (const r of fin) {
          if (!S.has(r[0]) || !rowOk(f, r[1], r[2])) continue;
          a.n++; a.rev += r[4]; if (r[3]) a.rec += r[4]; a.cost += r[5] + r[6] + r[7]; a.eq += r[8];
          const acc = siteAcc[r[2]]; a.byAcc[acc] = (a.byAcc[acc] || 0) + r[4];
        }
        return a;
      });
    }
    function mmAgg(M, f) {
      return memo('mm', M, f, () => {
        const S = new Set(M); const a = { cups: 0, days: 0, sell: 0, sched: 0, nMature: 0, n: 0 };
        for (const r of mm) {
          if (!S.has(r[0]) || !rowOk(f, r[1], r[2])) continue;
          a.n++; a.sell += r[7]; a.sched += r[8];
          if (r[4] === 1) { a.nMature++; a.cups += r[6]; a.days += r[5]; }
        }
        return a;
      });
    }
    function activeSiteSet(month, f) {
      const s = new Set();
      for (const r of mm) if (r[0] === month && r[3] === 1 && rowOk(f, r[1], r[2])) s.add(r[2]);
      return s;
    }

    // ---- measures (names follow the source model)
    const M_ = {};
    M_.revenue = (M, f) => { const a = finAgg(M, f); return a.n ? a.rev : BLANK; };
    M_.directCost = (M, f) => { const a = finAgg(M, f); return a.n ? a.cost : BLANK; };
    M_.siteContribution = (M, f) => { const a = finAgg(M, f); return a.n ? a.rev - a.cost : BLANK; };
    M_.recurringRevenuePct = (M, f) => { const a = finAgg(M, f); return a.n ? divide(a.rec, a.rev) : BLANK; };

    M_.activeSites = (M, f) => {
      const e = periodEnd(M); if (e === null || e < 0) return BLANK;
      const n = activeSiteSet(e, f).size; return n ? n : BLANK; // DISTINCTCOUNT of nothing = blank
    };
    M_.cupsMature = (M, f) => { const a = mmAgg(M, f); return a.nMature ? divide(a.cups, a.days) : BLANK; };
    M_.sellableAvailability = (M, f) => { const a = mmAgg(M, f); return a.n ? divide(a.sell, a.sched) : BLANK; };

    // 'NRR %' = SUMX over accounts with [Revenue PY] > 0 of Revenue / Revenue PY
    M_.nrr = (M, f) => {
      const cur = finAgg(M, f).byAcc, prev = finAgg(py(M), f).byAcc;
      let n = 0, d = 0, any = false; // SUMX over blanks is blank -> DIVIDE(blank, x) is blank
      for (const acc of Object.keys(prev)) if (prev[acc] > 0) { if (acc in cur) { any = true; n += cur[acc]; } d += prev[acc]; }
      return d > 0 && any ? n / d : BLANK;
    };
    // 'Top 1 Customer Share %' : removes site + account filters, keeps period (and contract type)
    M_.top1Share = (M, f) => {
      const a = finAgg(M, { sites: null, accounts: null, contracts: f.contracts, cohorts: f.cohorts }).byAcc;
      const v = Object.values(a); if (!v.length) return BLANK;
      return divide(Math.max(...v), v.reduce((s, x) => s + x, 0));
    };
    // 'Cumulative Payback %' = cumulative (Site Contribution + Equipment COGS) up to MAX(month) / all deployment cost
    M_.cumulativePayback = (M, f) => {
      const e = max(M); if (e === null) return BLANK;
      const all = []; for (let i = 0; i <= Math.min(e, N - 1); i++) all.push(i);
      const a = finAgg(all, f);
      let inv = 0; for (const r of dep) if (rowOk(f, r[0], r[1])) inv += r[2];
      return a.n ? divide(a.rev - a.cost + a.eq, inv) : BLANK;
    };
    // 'Site Retention (12M) %'
    M_.siteRetention12m = (M, f) => {
      const e = periodEnd(M); if (e === null) return BLANK;
      const base = activeSiteSet(e - 12, f); if (!base.size) return BLANK;
      const still = activeSiteSet(e, f); let k = 0; base.forEach((s) => still.has(s) && k++);
      return k / base.size;
    };

    // ---- time-intelligence wrappers
    const PY = (m) => (M, f) => m(py(M), f);
    const YTD = (m) => (M, f) => m(ytd(M), f);
    const yoyPct = (m, guarded) => (M, f) => {
      const c = m(M, f), p = m(py(M), f);
      if (guarded && (isBlank(c) || isBlank(p) || !comparable(M))) return BLANK;
      return divide(nz(c) - nz(p), p);
    };
    const yoyDelta = (m) => (M, f) => {
      const c = m(M, f), p = m(py(M), f);
      return isBlank(c) || isBlank(p) || !comparable(M) ? BLANK : c - p;
    };

    const measures = {
      revenue: M_.revenue, revenuePY: PY(M_.revenue), revenueYTD: YTD(M_.revenue), revenueYoY: yoyPct(M_.revenue, false),
      contribution: M_.siteContribution, contributionPY: PY(M_.siteContribution), contributionYTD: YTD(M_.siteContribution), contributionYoY: yoyPct(M_.siteContribution, false),
      activeSites: M_.activeSites, activeSitesPY: PY(M_.activeSites), activeSitesYTD: YTD(M_.activeSites), activeSitesYoY: yoyPct(M_.activeSites, true),
      cupsMature: M_.cupsMature, cupsMaturePY: PY(M_.cupsMature), cupsMatureYTD: YTD(M_.cupsMature), cupsMatureYoY: yoyPct(M_.cupsMature, true),
      nrr: M_.nrr, nrrPY: PY(M_.nrr), nrrYTD: YTD(M_.nrr), nrrYoYpp: yoyDelta(M_.nrr),
      recurringRevenuePct: M_.recurringRevenuePct, top1Share: M_.top1Share,
      cumulativePayback: M_.cumulativePayback, siteRetention12m: M_.siteRetention12m,
      sellableAvailability: M_.sellableAvailability, sellableAvailabilityYoYpp: yoyDelta(M_.sellableAvailability),
    };

    function periodLabel(M) {
      if (!M.length) return '(no period)';
      const s = min(M), e = max(M);
      return s === e ? label(s) : `${label(s)} – ${label(e)}`;
    }

    // Accounts visible in the matrix (any measure non-blank), plus a total row computed in the same context
    function accountRows(M, f) {
      const out = [];
      D.accounts.forEach((name, i) => {
        if (f.accounts && !f.accounts.has(i)) return;
        const af = { ...f, accounts: new Set([i]) };
        const row = { account: i, name };
        for (const k of ['revenue', 'revenueYTD', 'revenuePY', 'revenueYoY', 'activeSites', 'cupsMature', 'contribution', 'nrr']) row[k] = measures[k](M, af);
        if (['revenue', 'revenueYTD', 'revenuePY', 'activeSites', 'cupsMature', 'contribution', 'nrr'].some((k) => !isBlank(row[k]))) out.push(row);
      });
      return out;
    }

    const ext = extend({ D, N, ym, max, min, py, ytd, periodEnd, comparable, rowOk, memo, finAgg, mmAgg, activeSiteSet, PY, YTD, yoyPct, yoyDelta, M_ });
    Object.assign(measures, ext.measures);

    return { measures, periodLabel, accountRows, ym, label, N, isBlank, ytd, py, comparable, rowOk, helpers: ext.helpers };
  }

  return { create, BLANK };
});
