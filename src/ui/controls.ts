import type { Store } from "./state.js";
import type { DashboardState } from "../types.js";

let loadFn: (() => void) | null = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function initControls(
  state: Store<DashboardState>,
  onLoad?: () => void,
): void {
  if (onLoad) loadFn = onLoad;
  const el = document.getElementById("controls")!;
  const s = state.get();

  const platformOpts = s.availablePlatforms
    .map(
      (p) =>
        `<option value="${escapeHtml(p)}" ${s.platforms.includes(p) ? "selected" : ""}>${escapeHtml(p)}</option>`,
    )
    .join("");

  const suiteOpts = s.availableSuites
    .map(
      (su) =>
        `<option value="${escapeHtml(su)}" ${s.suites.includes(su) ? "selected" : ""}>${escapeHtml(su)}</option>`,
    )
    .join("");

  const noPickers = s.availablePlatforms.length === 0;
  const loadLabel = s.loading ? "Loading..." : "Load";

  el.innerHTML = `
    <label>
      Repo
      <select id="ctl-repo">
        <option value="mozilla-central" ${s.repo === "mozilla-central" ? "selected" : ""}>mozilla-central</option>
        <option value="autoland" ${s.repo === "autoland" ? "selected" : ""}>autoland</option>
        <option value="try" ${s.repo === "try" ? "selected" : ""}>try</option>
      </select>
    </label>
    <label>
      Framework
      <select id="ctl-framework">
        <option value="13" ${s.framework === 13 ? "selected" : ""}>browsertime (13)</option>
        <option value="1" ${s.framework === 1 ? "selected" : ""}>talos (1)</option>
        <option value="15" ${s.framework === 15 ? "selected" : ""}>mozperftest (15)</option>
      </select>
    </label>
    <label>
      Days
      <input type="number" id="ctl-days" value="${s.days}" min="1" max="90">
    </label>
    <label>
      Platforms ${noPickers ? "(loading...)" : `(${s.availablePlatforms.length})`}
      <select id="ctl-platforms" multiple size="4" ${noPickers ? "disabled" : ""}>
        ${platformOpts}
      </select>
    </label>
    <label>
      Suites ${noPickers ? "(loading...)" : `(${s.availableSuites.length})`}
      <select id="ctl-suites" multiple size="4" ${noPickers ? "disabled" : ""}>
        ${suiteOpts}
      </select>
    </label>
    <button id="ctl-load" ${s.loading || noPickers ? "disabled" : ""}>${loadLabel}</button>
  `;

  el.querySelector("#ctl-repo")!.addEventListener("change", (e) => {
    state.set({
      repo: (e.target as HTMLSelectElement).value,
      availablePlatforms: [],
      availableSuites: [],
      platforms: [],
      suites: [],
    });
  });
  el.querySelector("#ctl-framework")!.addEventListener("change", (e) => {
    state.set({
      framework: Number((e.target as HTMLSelectElement).value),
      availablePlatforms: [],
      availableSuites: [],
      platforms: [],
      suites: [],
    });
  });
  el.querySelector("#ctl-days")!.addEventListener("change", (e) => {
    state.set({ days: Number((e.target as HTMLInputElement).value) });
  });
  el.querySelector("#ctl-platforms")!.addEventListener("change", (e) => {
    const opts = (e.target as HTMLSelectElement).selectedOptions;
    state.set({ platforms: Array.from(opts).map((o) => o.value) });
  });
  el.querySelector("#ctl-suites")!.addEventListener("change", (e) => {
    const opts = (e.target as HTMLSelectElement).selectedOptions;
    state.set({ suites: Array.from(opts).map((o) => o.value) });
  });
  el.querySelector("#ctl-load")!.addEventListener("click", () => {
    loadFn?.();
  });
}
