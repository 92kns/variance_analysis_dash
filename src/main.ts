import { createState } from "./ui/state.js";
import { renderLayout } from "./ui/layout.js";
import { initControls } from "./ui/controls.js";
import { renderHeatmap } from "./ui/heatmap.js";
import { renderDrilldown } from "./ui/drilldown.js";
import { updateProgress } from "./ui/progress.js";
import { fetchSignatures, getTopLevelSigs, loadDashboardData } from "./api/client.js";
import type { DashboardState } from "./types.js";

const initial: DashboardState = {
  repo: "mozilla-central",
  framework: 13,
  days: 14,
  platforms: [],
  suites: [],
  loading: false,
  progress: { done: 0, total: 0, label: "" },
  cells: [],
  selectedCell: null,
  availablePlatforms: [],
  availableSuites: [],
};

const state = createState(initial);

renderLayout(document.getElementById("app")!);

state.subscribe((s, prev) => {
  updateProgress(s.progress, s.loading);
  if (s.cells !== prev.cells || s.selectedCell !== prev.selectedCell) {
    renderHeatmap(s.cells, s.selectedCell, state);
    renderDrilldown(s.selectedCell);
  }
  if (
    s.availablePlatforms !== prev.availablePlatforms ||
    s.availableSuites !== prev.availableSuites ||
    s.loading !== prev.loading
  ) {
    initControls(state);
  }
});

async function loadSignatures() {
  const s = state.get();
  state.set({
    loading: true,
    progress: { done: 0, total: 1, label: "Fetching signature list..." },
  });
  try {
    const allSigs = await fetchSignatures(s.repo, s.framework);
    const topLevel = getTopLevelSigs(allSigs);
    const platforms = [...new Set(topLevel.map((sig) => sig.machine_platform))].sort();
    const suites = [...new Set(topLevel.map((sig) => sig.suite))].sort();
    state.set({
      availablePlatforms: platforms,
      availableSuites: suites,
      loading: false,
      progress: { done: 0, total: 0, label: "" },
    });
  } catch (e) {
    console.error("Failed to fetch signatures:", e);
    state.set({
      loading: false,
      progress: { done: 0, total: 0, label: "" },
    });
    setEmptyState(`Failed to fetch signatures: ${e}`);
  }
}

async function load() {
  const s = state.get();
  if (s.loading) return;
  if (s.platforms.length === 0 && s.suites.length === 0) {
    setEmptyState("Select at least one platform or suite, then click Load.");
    return;
  }

  state.set({ loading: true, cells: [], selectedCell: null });

  try {
    const { cells, platforms, suites } = await loadDashboardData(
      s.repo,
      s.framework,
      s.days,
      s.platforms,
      s.suites,
      (progress) => state.set({ progress }),
    );
    state.set({
      cells,
      availablePlatforms: platforms,
      availableSuites: suites,
      loading: false,
      progress: { done: 0, total: 0, label: "" },
    });
    if (cells.length === 0) {
      setEmptyState("No data found for the selected filters.");
    }
  } catch (e) {
    console.error("Load failed:", e);
    state.set({ loading: false, progress: { done: 0, total: 0, label: "" } });
    setEmptyState(`Load failed: ${e}`);
  }
}

function setEmptyState(msg: string) {
  const el = document.getElementById("heatmap");
  if (el) el.innerHTML = `<div class="empty-state">${msg}</div>`;
}

state.subscribe((s, prev) => {
  if (s.repo !== prev.repo || s.framework !== prev.framework) {
    if (s.availablePlatforms.length === 0 && !s.loading) {
      loadSignatures();
    }
  }
});

initControls(state, load);
applyHashState();
loadSignatures();

function applyHashState() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const updates: Partial<DashboardState> = {};
  if (params.get("repo")) updates.repo = params.get("repo")!;
  if (params.get("fw")) updates.framework = Number(params.get("fw"));
  if (params.get("days")) updates.days = Number(params.get("days"));
  if (params.get("platforms"))
    updates.platforms = params.get("platforms")!.split(",");
  if (params.get("suites"))
    updates.suites = params.get("suites")!.split(",");
  state.set(updates);
}

state.subscribe((s) => {
  const params = new URLSearchParams();
  if (s.repo !== "mozilla-central") params.set("repo", s.repo);
  if (s.framework !== 13) params.set("fw", String(s.framework));
  if (s.days !== 14) params.set("days", String(s.days));
  if (s.platforms.length) params.set("platforms", s.platforms.join(","));
  if (s.suites.length) params.set("suites", s.suites.join(","));
  const str = params.toString();
  history.replaceState(null, "", str ? `#${str}` : location.pathname);
});
