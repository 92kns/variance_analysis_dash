export function renderLayout(root: HTMLElement): void {
  root.innerHTML = `
    <header>
      <h1>CI Variance Dashboard</h1>
      <div class="controls" id="controls"></div>
    </header>
    <div class="progress-bar" id="progress-bar"><div class="fill"></div></div>
    <div class="progress-label" id="progress-label"></div>
    <div class="main-content">
      <div class="heatmap-container" id="heatmap">
        <div class="empty-state">Loading available platforms and suites...</div>
      </div>
      <div class="drilldown" id="drilldown"></div>
    </div>
    <div class="tooltip" id="tooltip" style="display:none"></div>
  `;
}
