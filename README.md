# Power BI to HTML

Replicate a Power BI executive report using plain HTML, CSS and JavaScript.

> **All data is simulated data for demo purposes.**

## Planned stack
- Vanilla JavaScript (no build step)
- [ECharts](https://echarts.apache.org/) for charts (via CDN)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles for the bubble map (via CDN)

## Structure
- `index.html` – dashboard layout (slicers, KPI cards, charts, matrix, page tabs)
- `css/styles.css` – styles
- `js/app.js` – tab switching, data loading, rendering
- `data/` – simulated CSV/JSON data
- `scripts/` – helper scripts (e.g. data generation)

## Local preview
```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy
Static site deployed to Vercel (`vercel.json` included).

## Disclaimer
All data is simulated data for demo purposes. Not affiliated with any real company.
