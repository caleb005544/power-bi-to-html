# Power BI to HTML

Replicate a Power BI executive report using plain HTML, CSS and JavaScript.

> **All data is simulated data for demo purposes.**

## Status
| Page | Status |
|---|---|
| Board Summary | Built: Year / Month / Region / Venue type / Contract type single-select slicers, 5 KPI cards (month, YTD, PY, YoY), trend chart, 4 ratio cards, account matrix (totals = cards), highlights |
| Growth & Deployment | Built: 5 cards (installed base, machines installed, signed locations, ever-live conversion, unit churn), installs/removals + installed-base combo, sign-to-live 60/90/120d by signing half-year, days-to-live by region, venue matrix, go-live cohort matrix |
| Site Productivity | Built: 4 cards (cups / machine-day, revenue / machine-day, average ticket, cashless %), site map for all regions with auto-fit zoom (Leaflet + OpenStreetMap), P25 / median / P75 by venue, product mix, venue matrix, low-volume tail |
| Availability & Ops | Built: 5 cards (uptime, sellable availability, stockout rate, MTTR, breakdowns / 100 machines), lost-time combo, month × venue heatmap, venue matrix, top-10 consumption variance |

## Stack
- Vanilla JavaScript (no build step)
- [ECharts](https://echarts.apache.org/) for charts (via CDN)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles for the site map (via CDN)

## Structure
- `index.html` – dashboard layout (slicers, KPI cards, charts, matrix, page tabs)
- `css/styles.css` – styles
- `js/measures.js` – measure engine that reproduces the semantic-model DAX (MTD / YTD / same period last year / YoY, NRR, retention, payback …). Runs in the browser and in Node.
- `js/app.js` – shared filter state, slicers, tabs, Board Summary page
- `js/pages/*.js` – Growth & Deployment, Site Productivity, Availability & Ops pages (`common.js` = shared cards / matrix / chart helpers)
- `data/dashboard.json` – compact simulated data (generated)
- `scripts/build_data.py` – converts the simulated source CSVs to `data/dashboard.json`
- `scripts/validate.js` – compares the JS measures with a Power BI measure snapshot (executeQueries output)

## Data
```bash
python3 scripts/build_data.py <path-to-source-csv-folder>
node scripts/validate.js <measure_snapshot.json>
```

## Interactions
- Slicers are single-select: clicking a value selects only it, clicking it again clears back to all. Default: Jun 2026.
- Time grain is Year / Month only. Cards show the selected period, YTD, same period last year (PY) and YoY.
- Click a point on the trend chart to filter the cards, matrix and highlights to that month; click it again to clear.
- Click an account row in the matrix to filter the cards, chart and highlights to that account; click again to clear.
- The trend chart ignores the Year / Month slicers (as in the source report) and has its own window buttons.
- Growth, Productivity and Availability pages add an Account slicer. Clicking a chart bar / point, map bubble, heatmap cell or matrix row cross-filters the other visuals on the page; click it again to clear. Switching pages clears cross-filters (slicers stay).
- As in the source: the Growth combo, signing-half and region charts ignore Year / Month; the Availability combo and heatmap use the selected year and ignore Month.
- Site names are generic labels (e.g. "Campus A – Site 01"); account names are type-based labels (e.g. "Campus Account A").

## Local preview
```bash
python3 -m http.server 8000
```

## Deploy
Static site deployed to Vercel (`vercel.json` included).

## Disclaimer
All data is simulated data for demo purposes. Not affiliated with any real company.
