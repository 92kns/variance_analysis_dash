import * as d3 from "d3";
import type { CellMetrics, MachineData } from "../types.js";

const CHART_W = 400;
const CHART_H = 180;
const MARGIN = { top: 10, right: 10, bottom: 30, left: 50 };

const GROUP_COLORS: Record<string, string> = {
  LOW: "#1f77b4",
  HIGH: "#d62728",
  MIXED: "#9467bd",
  NONE: "#8b949e",
};

function machineGroup(
  machine: string,
  cell: CellMetrics,
): string {
  if (!cell.bimodal) return "NONE";
  if (cell.bimodal.mixed.some((e) => e.machine === machine)) return "MIXED";
  const pts = cell.machineData.get(machine);
  if (!pts || pts.length === 0) return "NONE";
  const avg = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  return avg < cell.bimodal.split ? "LOW" : "HIGH";
}

function renderBoxPlots(container: HTMLElement, cell: CellMetrics) {
  const w = CHART_W;
  const machines = [...cell.machineData.entries()]
    .map(([name, pts]) => ({
      name,
      values: pts.map((p) => p.value).sort((a, b) => a - b),
      avg: pts.reduce((s, p) => s + p.value, 0) / pts.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const barH = 14;
  const gap = 2;
  const h = MARGIN.top + machines.length * (barH + gap) + MARGIN.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`);

  const allVals = machines.flatMap((m) => m.values);
  const x = d3
    .scaleLinear()
    .domain([d3.min(allVals)! * 0.98, d3.max(allVals)! * 1.02])
    .range([MARGIN.left, w - MARGIN.right]);

  svg
    .append("g")
    .attr("transform", `translate(0,${h - MARGIN.bottom})`)
    .call(d3.axisBottom(x).ticks(6))
    .attr("color", "#8b949e")
    .attr("font-size", "9px");

  machines.forEach((m, i) => {
    const y = MARGIN.top + i * (barH + gap);
    const group = machineGroup(m.name, cell);
    const color = GROUP_COLORS[group];

    if (m.values.length >= 5) {
      const q1 = d3.quantile(m.values, 0.25)!;
      const q3 = d3.quantile(m.values, 0.75)!;
      const med = d3.quantile(m.values, 0.5)!;
      const lo = m.values[0];
      const hi = m.values[m.values.length - 1];

      svg
        .append("line")
        .attr("x1", x(lo))
        .attr("x2", x(hi))
        .attr("y1", y + barH / 2)
        .attr("y2", y + barH / 2)
        .attr("stroke", color)
        .attr("stroke-width", 1);

      svg
        .append("rect")
        .attr("x", x(q1))
        .attr("y", y)
        .attr("width", x(q3) - x(q1))
        .attr("height", barH)
        .attr("fill", color)
        .attr("opacity", 0.6);

      svg
        .append("line")
        .attr("x1", x(med))
        .attr("x2", x(med))
        .attr("y1", y)
        .attr("y2", y + barH)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    } else {
      for (const v of m.values) {
        svg
          .append("circle")
          .attr("cx", x(v))
          .attr("cy", y + barH / 2)
          .attr("r", 3)
          .attr("fill", color)
          .attr("opacity", 0.8);
      }
    }
  });

  if (cell.bimodal) {
    svg
      .append("line")
      .attr("x1", x(cell.bimodal.split))
      .attr("x2", x(cell.bimodal.split))
      .attr("y1", MARGIN.top)
      .attr("y2", h - MARGIN.bottom)
      .attr("stroke", "#d29922")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 1);
  }
}

function renderHistogram(container: HTMLElement, cell: CellMetrics) {
  const allVals = [...cell.machineData.values()].flatMap((pts) =>
    pts.map((p) => p.value),
  );
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_W} ${CHART_H}`);

  const x = d3
    .scaleLinear()
    .domain([d3.min(allVals)! * 0.98, d3.max(allVals)! * 1.02])
    .range([MARGIN.left, CHART_W - MARGIN.right]);

  const bins = d3.bin().domain(x.domain() as [number, number]).thresholds(20)(
    allVals,
  );
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (b) => b.length)!])
    .range([CHART_H - MARGIN.bottom, MARGIN.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${CHART_H - MARGIN.bottom})`)
    .call(d3.axisBottom(x).ticks(6))
    .attr("color", "#8b949e")
    .attr("font-size", "9px");
  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).ticks(4))
    .attr("color", "#8b949e")
    .attr("font-size", "9px");

  svg
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (d) => x(d.x0!) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1!) - x(d.x0!) - 1))
    .attr("height", (d) => y(0) - y(d.length))
    .attr("fill", "#58a6ff")
    .attr("opacity", 0.7);

  if (cell.bimodal) {
    svg
      .append("line")
      .attr("x1", x(cell.bimodal.split))
      .attr("x2", x(cell.bimodal.split))
      .attr("y1", MARGIN.top)
      .attr("y2", CHART_H - MARGIN.bottom)
      .attr("stroke", "#d29922")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 1);
  }
}

function renderTimeSeries(container: HTMLElement, cell: CellMetrics) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_W} ${CHART_H}`);

  const allPts: { t: number; v: number; group: string }[] = [];
  for (const [machine, pts] of cell.machineData) {
    const group = machineGroup(machine, cell);
    for (const p of pts) {
      allPts.push({ t: p.timestamp * 1000, v: p.value, group });
    }
  }
  allPts.sort((a, b) => a.t - b.t);

  const x = d3
    .scaleTime()
    .domain(d3.extent(allPts, (d) => d.t) as [number, number])
    .range([MARGIN.left, CHART_W - MARGIN.right]);
  const y = d3
    .scaleLinear()
    .domain([
      d3.min(allPts, (d) => d.v)! * 0.98,
      d3.max(allPts, (d) => d.v)! * 1.02,
    ])
    .range([CHART_H - MARGIN.bottom, MARGIN.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${CHART_H - MARGIN.bottom})`)
    .call(d3.axisBottom(x).ticks(5))
    .attr("color", "#8b949e")
    .attr("font-size", "9px");
  svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).ticks(5))
    .attr("color", "#8b949e")
    .attr("font-size", "9px");

  svg
    .selectAll("circle")
    .data(allPts)
    .join("circle")
    .attr("cx", (d) => x(d.t))
    .attr("cy", (d) => y(d.v))
    .attr("r", 3)
    .attr("fill", (d) => GROUP_COLORS[d.group])
    .attr("opacity", 0.7);

  if (cell.bimodal) {
    svg
      .append("line")
      .attr("x1", MARGIN.left)
      .attr("x2", CHART_W - MARGIN.right)
      .attr("y1", y(cell.bimodal.split))
      .attr("y2", y(cell.bimodal.split))
      .attr("stroke", "#d29922")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 1);
  }
}

function renderDecomposition(container: HTMLElement, cell: CellMetrics) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_W} 80`);

  const between = cell.rBetween;
  const within = 1 - between;
  const barY = 20;
  const barH = 30;
  const barW = CHART_W - MARGIN.left - MARGIN.right;

  svg
    .append("rect")
    .attr("x", MARGIN.left)
    .attr("y", barY)
    .attr("width", barW * between)
    .attr("height", barH)
    .attr("fill", "#f85149");

  svg
    .append("rect")
    .attr("x", MARGIN.left + barW * between)
    .attr("y", barY)
    .attr("width", barW * within)
    .attr("height", barH)
    .attr("fill", "#3fb950");

  svg
    .append("text")
    .attr("x", MARGIN.left + 4)
    .attr("y", barY + barH / 2 + 4)
    .attr("fill", "#fff")
    .attr("font-size", "10px")
    .text(`Between: ${(between * 100).toFixed(0)}%`);

  svg
    .append("text")
    .attr("x", CHART_W - MARGIN.right - 4)
    .attr("y", barY + barH / 2 + 4)
    .attr("fill", "#fff")
    .attr("font-size", "10px")
    .attr("text-anchor", "end")
    .text(`Within: ${(within * 100).toFixed(0)}%`);

  svg
    .append("text")
    .attr("x", CHART_W / 2)
    .attr("y", 14)
    .attr("fill", "#8b949e")
    .attr("font-size", "10px")
    .attr("text-anchor", "middle")
    .text("Variance Decomposition (between-machine vs within-machine)");
}

export function renderDrilldown(cell: CellMetrics | null): void {
  const panel = document.getElementById("drilldown")!;
  if (!cell) {
    panel.classList.remove("open");
    return;
  }

  panel.classList.add("open");
  panel.innerHTML = `
    <button class="close-btn" id="drilldown-close">x</button>
    <h2>${cell.suite}</h2>
    <h3>${cell.platform}</h3>
    <dl class="metrics-summary">
      <dt>MDR</dt><dd>${(cell.mdr * 100).toFixed(2)}%</dd>
      <dt>rCV</dt><dd>${(cell.rCV * 100).toFixed(2)}%</dd>
      <dt>R-between</dt><dd>${(cell.rBetween * 100).toFixed(1)}%</dd>
      <dt>Bimodality</dt><dd>${cell.bimodalityCoeff.toFixed(3)}</dd>
      <dt>Points</dt><dd>${cell.n}</dd>
      <dt>Machines</dt><dd>${cell.nMachines}</dd>
      <dt>Median</dt><dd>${cell.median.toFixed(2)}</dd>
      <dt>IQR</dt><dd>${cell.iqr.toFixed(2)}</dd>
    </dl>
  `;

  if (cell.bimodal) {
    const div = document.createElement("div");
    div.className = "bimodal-info";
    div.innerHTML = `
      <strong>Bimodal split detected</strong> at ${cell.bimodal.split.toFixed(2)} (gap: ${cell.bimodal.gap.toFixed(2)})<br>
      LOW: ${cell.bimodal.low.length} machines (mean ${cell.bimodal.low_mean.toFixed(2)})<br>
      HIGH: ${cell.bimodal.high.length} machines (mean ${cell.bimodal.high_mean.toFixed(2)})
      ${cell.bimodal.mixed.length > 0 ? `<br>MIXED: ${cell.bimodal.mixed.map((e) => e.machine).join(", ")}` : ""}
    `;
    panel.appendChild(div);
  }

  const sections = [
    { title: "Machine Fingerprints", render: renderBoxPlots },
    { title: "Distribution", render: renderHistogram },
    { title: "Time Series", render: renderTimeSeries },
    { title: "Variance Decomposition", render: renderDecomposition },
  ];

  for (const sec of sections) {
    const div = document.createElement("div");
    div.className = "chart-section";
    const h3 = document.createElement("h3");
    h3.textContent = sec.title;
    div.appendChild(h3);
    sec.render(div, cell);
    panel.appendChild(div);
  }

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export CSV";
  exportBtn.style.cssText =
    "margin-top:8px;background:var(--border);color:var(--text);border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;";
  exportBtn.addEventListener("click", () => exportCSV(cell));
  panel.appendChild(exportBtn);

  document.getElementById("drilldown-close")!.addEventListener("click", () => {
    panel.classList.remove("open");
  });
}

function exportCSV(cell: CellMetrics) {
  const rows = ["machine,timestamp,value,revision,job_id"];
  for (const [machine, pts] of cell.machineData) {
    for (const p of pts) {
      rows.push(
        `${machine},${new Date(p.timestamp * 1000).toISOString()},${p.value},${p.revision},${p.job_id}`,
      );
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${cell.platform}_${cell.suite}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
