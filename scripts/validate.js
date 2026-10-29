#!/usr/bin/env node
/*
 * Compare the JS measure engine (js/measures.js) with a Power BI measure snapshot
 * (JSON produced by an executeQueries snapshot: keys "<context>|<group>|<measure name>").
 * usage: node scripts/validate.js <snapshot.json> [data/dashboard.json]
 */
const fs = require('fs');
const path = require('path');
const { create } = require('../js/measures.js');

const snapPath = process.argv[2];
if (!snapPath) { console.error('usage: node scripts/validate.js <snapshot.json> [data.json]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(process.argv[3] || path.join(__dirname, '../data/dashboard.json'), 'utf8'));
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
const E = create(D);
const m = E.measures;

// model measure name -> engine measure
const MAP = {
  'Revenue': m.revenue, 'Revenue PY': m.revenuePY, 'Revenue YTD': m.revenueYTD, 'Revenue YoY %': m.revenueYoY,
  'Site Contribution': m.contribution, 'Site Contribution PY': m.contributionPY, 'Site Contribution YTD': m.contributionYTD, 'Site Contribution YoY %': m.contributionYoY,
  'Active Operating Sites': m.activeSites, 'Active Operating Sites PY': m.activeSitesPY, 'Active Operating Sites YTD': m.activeSitesYTD, 'Active Operating Sites YoY %': m.activeSitesYoY,
  'Paid Cups per Machine-Day (Mature)': m.cupsMature, 'Paid Cups per Machine-Day (Mature) PY': m.cupsMaturePY,
  'Paid Cups per Machine-Day (Mature) YTD': m.cupsMatureYTD, 'Paid Cups per Machine-Day (Mature) YoY %': m.cupsMatureYoY,
  'NRR %': m.nrr, 'NRR % PY': m.nrrPY, 'NRR % YTD': m.nrrYTD, 'NRR % YoY Δ (pp)': m.nrrYoYpp,
  'Recurring Revenue %': m.recurringRevenuePct, 'Top 1 Customer Share %': m.top1Share,
  'Cumulative Payback %': m.cumulativePayback, 'Site Retention (12M) %': m.siteRetention12m,
  'Sellable Availability %': m.sellableAvailability, 'Sellable Availability % YoY Δ (pp)': m.sellableAvailabilityYoYpp,
};
// families: model base name -> engine key (X, PY, YTD, PYTD, YoY, YTD YoY, Color)
const FAM = {
  'Installed Base': ['installedBase', '%'], 'Machines Installed': ['machinesInstalled', '%'], 'Signed Locations': ['signedLocations', '%'],
  'Install Conversion %': ['installConversion', 'pp'], 'Unit Churn %': ['unitChurn', 'pp'], 'Paid Cups per Machine-Day': ['cupsPerDay', '%'],
  'Revenue per Machine-Day': ['revenuePerDay', '%'], 'Average Ticket': ['averageTicket', '%'], 'Cashless %': ['cashless', 'pp'],
  'Uptime %': ['uptime', 'pp'], 'Sellable Availability %': ['sellable', 'pp'], 'Stockout Rate %': ['stockoutRate', 'pp'],
  'MTTR (hours)': ['mttr', '%'], 'Breakdowns per 100 Machines (monthly)': ['breakdownsPer100', '%'],
  'Machine Days': ['machineDays', '%'], 'Consumer Sales': ['consumerSales', '%'],
};
for (const [n, [k, kind]] of Object.entries(FAM)) {
  const d = kind === 'pp' ? 'YoY Δ (pp)' : 'YoY %';
  Object.assign(MAP, { [n]: m[k], [n + ' PY']: m[k + 'PY'], [n + ' YTD']: m[k + 'YTD'], [n + ' PYTD']: m[k + 'PYTD'],
    [n + ' ' + d]: m[k + 'YoY'], [n + ' YTD ' + d]: m[k + 'YTDYoY'], [n + ' YoY Color']: m[k + 'Color'] });
}
Object.assign(MAP, {
  'Paid Cups (Machine)': m.paidCupsMachine, 'Scheduled Minutes': m.scheduledMinutes, 'Uptime Minutes': m.uptimeMinutes,
  'Downtime Minutes': m.downtimeMinutes, 'Stockout Minutes': m.stockoutMinutes, 'Staff Gap Minutes': m.staffGapMinutes,
  'Downtime Loss (pp)': m.downtimeLoss, 'Stockout Loss (pp)': m.stockoutLoss, 'Staff Gap Loss (pp)': m.staffGapLoss,
  'Breakdowns': m.breakdowns, 'Machine Months': m.machineMonths, 'Uptime % PY (active rows)': m.uptimePYActive, 'Ops Sample Color': m.opsSampleColor,
  'Paid Cups per Machine-Day P25': m.cupsP25, 'Paid Cups per Machine-Day Median': m.cupsMedian, 'Paid Cups per Machine-Day P75': m.cupsP75,
  'Net Cup Revenue': m.netCupRevenue, 'Transactions': m.transactions, 'Product Mix %': m.productMix,
  'Fill Rate %': m.fillRate, 'Waste Rate %': m.wasteRate, 'Consumption Variance %': m.consumptionVariance, 'Consumption Variance % (Top 10)': m.consumptionVarianceTop10,
  'Live Locations (Cumulative)': m.liveLocations, 'Machines Removed': m.machinesRemoved, 'Installed Base at Start': m.installedBaseAtStart,
  'Cohort Size': m.cohortSize, 'Removed to Date': m.removedToDate, 'Machines (Time to Live)': m.machinesTimeToLive,
  'Time to Live P50 (days)': m.timeToLiveP50, 'Time to Live P90 (days)': m.timeToLiveP90, 'Ready to Live P50 (days)': m.readyToLiveP50, 'Ready to Live P90 (days)': m.readyToLiveP90,
  'Machines Installed vs PY': m.machinesInstalledVsPY, 'Machines Installed vs PY Color': m.machinesInstalledVsPYColor,
  'Sign-to-Live 60d % (Half)': () => m.signToLiveHalf(60)(null, {}), 'Sign-to-Live 90d % (Half)': () => m.signToLiveHalf(90)(null, {}),
  'Sign-to-Live 120d % (Half)': () => m.signToLiveHalf(120)(null, {}), 'Sites Signed (Half)': () => m.sitesSignedHalf(null, {}),
});
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const idx = (y, mo) => { const [y0, m0] = D.months[0].split('-').map(Number); return (y - y0) * 12 + (mo - m0); };
const ALL = { sites: null, contracts: null, accounts: null, cohorts: null };
const accId = (i) => (D.accountIds ? D.accountIds[i] : 'A' + String(i + 1).padStart(2, '0'));

// contexts used by the snapshot
const contexts = [];
// no filter on Dim_Date at all (inactive-relationship counts then see every row)
const unfiltered = (M) => Object.assign(M, { noDateFilter: true });
// "grand" = no filters at all: every Dim_Date row (Jan 2023 – Dec 2026)
contexts.push({ ctx: 'grand', group: '', M: unfiltered(range(idx(2023, 1), idx(2026, 12))), f: ALL });
contexts.push({ ctx: '2026-06', group: '', M: [idx(2026, 6)], f: ALL });
D.accounts.forEach((_, i) => contexts.push({ ctx: 'account_id 2026-06', group: accId(i), M: [idx(2026, 6)], f: { ...ALL, accounts: new Set([i]) } }));
D.venues.forEach((v, vi) => {
  const sites = new Set(D.sites.map((s, i) => (s[2] === vi ? i : -1)).filter((i) => i >= 0));
  contexts.push({ ctx: 'venue_type 2025', group: v, M: range(idx(2025, 1), idx(2025, 12)), f: { ...ALL, sites } });
});

(D.cohortIds || []).concat(['None']).forEach((id) => {
  const ci = id === 'None' ? -1 : D.cohortIds.indexOf(id);
  contexts.push({ ctx: 'cohort_id', group: id, M: unfiltered(range(idx(2023, 1), idx(2026, 12))), f: { ...ALL, cohorts: new Set([ci]) } });
});

let pass = 0, fail = 0, missing = 0; const fails = [];
for (const c of contexts) {
  for (const [name, fn] of Object.entries(MAP)) {
    const k = `${c.ctx}|${c.group}|${name}`;
    if (!(k in snap)) { missing++; continue; }
    const exp = snap[k];
    let got = fn(c.M, c.f);
    if (name === 'Top 1 Customer Share %' && c.f.accounts) {
      // the model removes Dim_Account/Dim_Site filters for this measure -> same as unfiltered
    }
    if (typeof got === 'string' || typeof exp === 'string') { if (String(exp).toUpperCase() === String(got).toUpperCase()) pass++; else { fail++; fails.push({ k, exp, got }); } continue; }
    const ok = (exp === null && E.isBlank(got)) ||
      (exp !== null && !E.isBlank(got) && Math.abs(got - exp) <= Math.max(1e-6, 1e-6 * Math.abs(exp)));
    if (ok) pass++; else { fail++; fails.push({ k, exp, got }); }
  }
}
console.log(`checked ${pass + fail} values (${missing} not in snapshot): ${pass} match, ${fail} differ`);
for (const x of fails) console.log('  DIFF', x.k, 'PBI=', x.exp, 'JS=', x.got);

// Card values for a few selections (printed for the report)
const show = (lbl, M) => {
  const r = {}; for (const k of ['revenue', 'revenueYTD', 'revenuePY', 'revenueYoY', 'contribution', 'activeSites', 'cupsMature', 'nrr', 'top1Share', 'cumulativePayback', 'siteRetention12m', 'recurringRevenuePct']) {
    const v = m[k](M, ALL); r[k] = E.isBlank(v) ? null : +v.toFixed(4);
  }
  console.log(lbl, JSON.stringify(r));
};
show('Jun 2026     ', [idx(2026, 6)]);
show('Mar 2026     ', [idx(2026, 3)]);
show('2025 (all)   ', range(idx(2025, 1), idx(2025, 12)));
process.exit(fail ? 2 : 0);
