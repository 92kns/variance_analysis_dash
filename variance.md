# Variance Dashboard -- Project Reference

## What this is

Pure client-side TypeScript + Vite dashboard for Mozilla CI performance variance analysis. Fetches data directly from Treeherder API (open CORS), groups by CI machine, computes noise/variance metrics, and renders a D3 heatmap with drill-down charts.

**Core question:** "Can we trust the numbers?" (Perfherder tracks regressions; this tracks measurement quality.)

**Repo:** https://github.com/92kns/variance_analysis_dash
**Live:** https://92kns.github.io/variance_analysis_dash/
**Ported from:** `../nuc_win_study/nuc_performance_analysis.py` (Python CLI tool)

## Project structure

```
variance_dashboard/
  index.html                     -- entry HTML
  package.json                   -- d3, typescript, vite, vitest
  tsconfig.json
  vite.config.ts
  .github/workflows/
    ci.yml                       -- type-check + test + build on push/PR
    deploy.yml                   -- build + deploy to GitHub Pages on main
  src/
    main.ts                      -- entry point, state wiring, auto-loads signatures on startup
    types.ts                     -- all interfaces (PerfDatum, SignatureInfo, CellMetrics, etc.)
    style.css                    -- dark theme
    api/
      client.ts                  -- Treeherder fetch functions, batching, loadDashboardData orchestrator
      cache.ts                   -- IndexedDB wrapper for job_id -> machine_name (immutable, never expires)
    stats/
      core.ts                    -- mean, stdev, median, percentile, IQR, skewness, kurtosis
      variance.ts                -- rCV, MDR, R-between (ANOVA), bimodality coefficient, computeCellMetrics
      bimodal.ts                 -- classifyGroups() -- direct port from Python
    ui/
      state.ts                   -- minimal pub/sub store (createState<T>)
      layout.ts                  -- top-level DOM scaffolding
      controls.ts                -- repo/framework/days/platform/suite pickers + Load button
      progress.ts                -- loading progress bar
      heatmap.ts                 -- D3 heatmap (rows=platforms, cols=suites, color=MDR)
      drilldown.ts               -- 4 D3 charts + CSV export
  test/
    stats.test.ts                -- 16 unit tests (core stats, variance, bimodal detection)
    fixtures/nuc-data.ts         -- 71 real data points from NUC study report.md
```

## Key metrics (per heatmap cell = one suite/platform combo)

| Metric | Formula | What it answers |
|--------|---------|----------------|
| **MDR** (colors heatmap) | 2.5 * rCV / sqrt(n) | Smallest detectable regression |
| **rCV** | IQR / median | How noisy overall? |
| **R-between** | SS_between / SS_total | Machine noise vs run-to-run noise (one-way ANOVA) |
| **Bimodality coeff** | (skewness^2 + 1) / kurtosis | Is the distribution split? (>0.555 suggests bimodal) |

## Treeherder API details (empirically verified)

### Endpoints
1. **Signatures:** `GET /api/project/{repo}/performance/signatures/?framework={id}&subtests=0`
2. **Perf data:** `GET /api/project/{repo}/performance/data/?framework={id}&interval={days*86400}&signature_id={id1}&signature_id={id2}...`
3. **Jobs:** `GET /api/project/{repo}/jobs/?id__in={csv}&count={n}`

### Gotchas discovered during implementation
- Signatures API returns `machine_platform`, NOT `platform`
- Parent signatures have `test: undefined` (field omitted), NOT `test: null` -- filter with `!sig.test`
- Perf data response is keyed by signature **hash** (hex string), not numeric ID -- must read `signature_id` from the points themselves
- `subtests=0` returns ~12k sigs for browsertime, ~466 are parents
- Batching: 20 signature IDs per perf data call, 100 job IDs per jobs call
- No rate limiting observed at 20 concurrent requests
- Response has `Access-Control-Allow-Origin: *` on all endpoints

### Performance profile
- First load ~50-100 sigs: ~16 API calls, ~6MB, ~2.5s
- Return visits: ~6 calls, ~1.5MB, ~1.5s (cached job lookups in IndexedDB)
- Subtests share job_ids with parents (job fetch cost doesn't scale with sig count)

## Bimodal detection algorithm (from Python)

Direct port of `classify_groups()` from `nuc_performance_analysis.py:100-180`:
1. Sort all values, bail if <4 points or range <0.5
2. Window = 15% of data range, slide across 200 positions
3. At each position, compute density = points_in_window / total_points
4. Only consider positions with >=10% of points on each side
5. Pick position with lowest density; if >0.15 or none found, not bimodal
6. Split point = center of sparsest window
7. Classify machines: points on both sides = MIXED; avg < split = LOW; else HIGH

### Validated against real NUC data
- 71 data points, 52 machines on windows11-64-24h2-shippable
- Detects split ~21.3: 24 LOW (mean 18.6), 27 HIGH (mean 23.3), 1 MIXED (nuc13-149)
- Known signature IDs: 5276830 (Windows NUC), 5153951 (macOS)
- The actual parent sig for speedometer3 on windows11-64-24h2-shippable is 5276630

## UI layers

**Layer 1 -- Heatmap:** Rows = platforms, columns = suites. Cell color = MDR (green = trustworthy, red = noisy). Hover tooltip shows all metrics.

**Layer 2 -- Drill-down (click cell):** 4 charts:
1. Machine fingerprint (per-machine box plots, colored by bimodal group LOW/HIGH/MIXED)
2. Distribution histogram (with bimodal split line if detected)
3. Time series scatter (colored by machine group)
4. Variance decomposition bar (between-machine vs within-machine SS)
Plus CSV export button.

**Layer 3 -- Controls:** Repo, framework, days, platform multi-select, suite multi-select, Load button. Pickers auto-populate from signatures API on page load.

## App flow
1. Page loads -> `loadSignatures()` fetches all sigs, populates pickers
2. User selects platforms/suites, clicks Load
3. `loadDashboardData()`: fetch sigs -> batch fetch perf data -> resolve job machines (IndexedDB cache) -> compute metrics
4. Heatmap renders, sorted by worst MDR
5. Click cell -> drill-down panel opens with 4 charts
6. URL hash state updated for shareable links

## Commands
```bash
npm install       # install deps
npm run dev       # vite dev server on localhost:5173
npm test          # vitest (16 tests)
npm run build     # production build to dist/
npm run deploy    # gh-pages deploy (alternative to GitHub Actions)
npx tsc --noEmit  # type-check only
```

## GitHub Actions
- **CI** (ci.yml): type-check + test + build on push/PR to main
- **Deploy** (deploy.yml): build + deploy to GitHub Pages on push to main
- Pages must be enabled in repo settings: Settings > Pages > Source: GitHub Actions

## Dependencies
- **Runtime:** d3 ^7
- **Dev:** typescript ^5, vite ^6, vitest ^3, @types/d3 ^7, gh-pages ^6
