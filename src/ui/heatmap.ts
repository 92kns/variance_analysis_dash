import * as d3 from "d3";
import type { CellMetrics } from "../types.js";
import type { Store } from "./state.js";
import type { DashboardState } from "../types.js";

function mdrColor(mdr: number): string {
  if (!isFinite(mdr)) return "#30363d";
  const clamped = Math.min(mdr, 0.3);
  const t = clamped / 0.3;
  const r = Math.round(59 + t * (248 - 59));
  const g = Math.round(185 + t * (81 - 185));
  const b = Math.round(80 + t * (73 - 80));
  return `rgb(${r},${g},${b})`;
}

function showTooltip(cell: CellMetrics, x: number, y: number) {
  const tip = document.getElementById("tooltip")!;
  tip.style.display = "block";
  tip.style.left = `${x + 12}px`;
  tip.style.top = `${y + 12}px`;
  const bimodal = cell.bimodal
    ? `<br><span class="metric-name">Bimodal:</span> split at ${cell.bimodal.split.toFixed(1)}, gap ${cell.bimodal.gap.toFixed(1)}`
    : "";
  tip.innerHTML = `
    <strong>${cell.suite}</strong> on ${cell.platform}<br>
    <span class="metric-name">MDR:</span> <span class="metric-value">${(cell.mdr * 100).toFixed(1)}%</span><br>
    <span class="metric-name">rCV:</span> ${(cell.rCV * 100).toFixed(1)}%<br>
    <span class="metric-name">R-between:</span> ${(cell.rBetween * 100).toFixed(1)}%<br>
    <span class="metric-name">Bimodality:</span> ${cell.bimodalityCoeff.toFixed(3)}<br>
    <span class="metric-name">N:</span> ${cell.n} pts, ${cell.nMachines} machines
    ${bimodal}
  `;
}

function hideTooltip() {
  document.getElementById("tooltip")!.style.display = "none";
}

export function renderHeatmap(
  cells: CellMetrics[],
  selected: CellMetrics | null,
  state: Store<DashboardState>,
): void {
  const container = document.getElementById("heatmap")!;
  if (cells.length === 0) {
    container.innerHTML = `<div class="empty-state">Select platforms/suites and click Load to begin.</div>`;
    return;
  }

  const platforms = [...new Set(cells.map((c) => c.platform))].sort();
  const suites = [...new Set(cells.map((c) => c.suite))].sort();

  const lookup = new Map<string, CellMetrics>();
  for (const c of cells) {
    lookup.set(`${c.platform}||${c.suite}`, c);
  }

  const table = document.createElement("table");
  table.className = "heatmap-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));
  for (const suite of suites) {
    const th = document.createElement("th");
    th.className = "suite-header";
    th.textContent = suite;
    th.title = suite;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const platform of platforms) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.className = "platform-label";
    tdLabel.textContent = platform;
    tdLabel.title = platform;
    tr.appendChild(tdLabel);

    for (const suite of suites) {
      const td = document.createElement("td");
      const cell = lookup.get(`${platform}||${suite}`);
      const div = document.createElement("div");
      div.className = "heatmap-cell";

      if (cell) {
        div.style.backgroundColor = mdrColor(cell.mdr);
        if (selected && selected.signatureId === cell.signatureId) {
          div.classList.add("selected");
        }
        div.addEventListener("mouseenter", (e) =>
          showTooltip(cell, e.clientX, e.clientY),
        );
        div.addEventListener("mousemove", (e) =>
          showTooltip(cell, e.clientX, e.clientY),
        );
        div.addEventListener("mouseleave", hideTooltip);
        div.addEventListener("click", () => {
          state.set({ selectedCell: cell });
        });
      } else {
        div.classList.add("no-data");
      }

      td.appendChild(div);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}
