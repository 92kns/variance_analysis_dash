export function updateProgress(
  progress: { done: number; total: number; label: string },
  loading: boolean,
): void {
  const bar = document.querySelector("#progress-bar .fill") as HTMLElement;
  const label = document.getElementById("progress-label")!;

  if (!loading || progress.total === 0) {
    bar.style.width = "0%";
    label.textContent = "";
    return;
  }

  const pct = Math.min(100, (progress.done / progress.total) * 100);
  bar.style.width = `${pct}%`;
  label.textContent = progress.label;
}
