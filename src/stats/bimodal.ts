import type { MachineData, BimodalResult, BimodalGroupEntry } from "../types.js";

export function classifyGroups(
  machineData: MachineData,
): BimodalResult | null {
  const allValues: number[] = [];
  for (const points of machineData.values()) {
    for (const p of points) allValues.push(p.value);
  }
  allValues.sort((a, b) => a - b);

  if (allValues.length < 4) return null;

  const dataRange = allValues[allValues.length - 1] - allValues[0];
  if (dataRange < 0.5) return null;

  const window = dataRange * 0.15;
  const step = dataRange / 200;
  const lo = allValues[0] + window / 2;
  const hi = allValues[allValues.length - 1] - window / 2;
  if (lo >= hi) return null;

  let bestScore = Infinity;
  let bestCenter: number | null = null;

  for (let pos = lo; pos <= hi; pos += step) {
    const halfW = window / 2;
    let count = 0;
    let below = 0;
    let above = 0;
    for (const v of allValues) {
      if (v >= pos - halfW && v <= pos + halfW) count++;
      else if (v < pos - halfW) below++;
      else above++;
    }
    const density = count / allValues.length;
    if (
      below >= allValues.length * 0.1 &&
      above >= allValues.length * 0.1 &&
      density < bestScore
    ) {
      bestScore = density;
      bestCenter = pos;
    }
  }

  if (bestCenter === null || bestScore > 0.15) return null;

  const split = bestCenter;
  const belowSplit = allValues.filter((v) => v < split);
  const aboveSplit = allValues.filter((v) => v >= split);
  const gap =
    belowSplit.length > 0 && aboveSplit.length > 0
      ? aboveSplit[0] - belowSplit[belowSplit.length - 1]
      : 0;

  const low: BimodalGroupEntry[] = [];
  const high: BimodalGroupEntry[] = [];
  const mixed: BimodalGroupEntry[] = [];

  const sortedMachines = [...machineData.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  for (const [machine, points] of sortedMachines) {
    const values = points.map((p) => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const nLow = values.filter((v) => v < split).length;
    const nHigh = values.filter((v) => v >= split).length;
    const entry: BimodalGroupEntry = {
      machine,
      avg,
      n: values.length,
      n_low: nLow,
      n_high: nHigh,
    };
    if (nLow > 0 && nHigh > 0) mixed.push(entry);
    else if (avg < split) low.push(entry);
    else high.push(entry);
  }

  low.sort((a, b) => a.avg - b.avg);
  high.sort((a, b) => a.avg - b.avg);
  mixed.sort((a, b) => a.avg - b.avg);

  const lowVals: number[] = [];
  for (const e of low) {
    for (const p of machineData.get(e.machine)!) lowVals.push(p.value);
  }
  const highVals: number[] = [];
  for (const e of high) {
    for (const p of machineData.get(e.machine)!) highVals.push(p.value);
  }

  const lowMean =
    lowVals.length > 0
      ? lowVals.reduce((a, b) => a + b, 0) / lowVals.length
      : 0;
  const highMean =
    highVals.length > 0
      ? highVals.reduce((a, b) => a + b, 0) / highVals.length
      : 0;

  const nLowPts = allValues.filter((v) => v < split).length;

  return {
    split,
    gap,
    low,
    high,
    mixed,
    low_mean: lowMean,
    high_mean: highMean,
    n_low_pts: nLowPts,
    n_high_pts: allValues.length - nLowPts,
  };
}
