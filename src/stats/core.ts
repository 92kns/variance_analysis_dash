export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const ss = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(ss / (values.length - 1));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function iqr(values: number[]): number {
  return percentile(values, 75) - percentile(values, 25);
}

export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const avg = mean(values);
  const sd = stdev(values);
  if (sd === 0) return 0;
  const m3 = values.reduce((s, v) => s + ((v - avg) / sd) ** 3, 0) / n;
  return (n * (n - 1)) ** 0.5 / (n - 2) * m3;
}

export function kurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return 0;
  const avg = mean(values);
  const sd = stdev(values);
  if (sd === 0) return 0;
  const m4 = values.reduce((s, v) => s + ((v - avg) / sd) ** 4, 0) / n;
  return m4;
}
