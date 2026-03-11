# CI Performance Variance Dashboard

A client-side dashboard for analyzing measurement quality across Mozilla's CI fleet. While Perfherder answers "did the code get slower?", this dashboard answers "can we trust the numbers?"

## What it does

Fetches performance data from Treeherder, groups results by CI machine, and computes variance metrics to surface noisy or bimodal test/platform combinations at a glance.

**Heatmap view** -- rows are platforms, columns are suites, cell color reflects MDR (Minimum Detectable Regression). Green = trustworthy, red = noisy.

**Drill-down panel** -- click any cell to see:
- Per-machine box plots (colored by bimodal group)
- Value distribution histogram (with split line if bimodal)
- Time series scatter (colored by machine group)
- Variance decomposition bar (between-machine vs within-machine)

## Key metrics

| Metric | What it answers |
|--------|----------------|
| **MDR** | Smallest regression we could detect (2.5 * rCV / sqrt(n)) |
| **rCV** | Overall noise level (IQR / median) |
| **R-between** | Machine noise vs run-to-run noise (SS_between / SS_total) |
| **Bimodality coefficient** | Is the distribution split? ((skewness^2 + 1) / kurtosis) |

## Architecture

Pure client-side TypeScript + Vite. No backend -- the browser fetches directly from Treeherder's API (open CORS). Job-to-machine mappings are cached in IndexedDB so return visits are fast.

- **D3.js** for heatmap and drill-down charts
- **IndexedDB** for caching immutable job_id -> machine_name lookups
- Scoped to ~50-100 signatures: ~16 API calls, ~6MB, ~2.5s first load

## Development

```bash
npm install
npm run dev       # start dev server at localhost:5173
npm test          # run unit tests
npm run build     # production build to dist/
```

## Bimodal detection

Ported from the [NUC performance analysis](https://github.com/92kns/variance_analysis_dash) Python tool. Slides a window (15% of data range) across sorted values to find the sparsest region, then classifies machines as LOW/HIGH/MIXED based on which side of the split their values fall.

## Deploy

```bash
npm run deploy    # pushes dist/ to gh-pages branch
```
