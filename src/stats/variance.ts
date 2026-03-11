import { mean, stdev, median, iqr, skewness, kurtosis } from "./core.js";
import { classifyGroups } from "./bimodal.js";
import type { MachineData, CellMetrics } from "../types.js";

export function robustCV(values: number[]): number {
  const med = median(values);
  if (med === 0) return 0;
  return iqr(values) / med;
}

export function mdr(rCV: number, n: number): number {
  if (n <= 0) return Infinity;
  return (2.5 * rCV) / Math.sqrt(n);
}

export function rBetween(machineData: MachineData): number {
  const allValues: number[] = [];
  const machineMeans: { mean: number; n: number }[] = [];

  for (const points of machineData.values()) {
    const vals = points.map((p) => p.value);
    if (vals.length === 0) continue;
    allValues.push(...vals);
    machineMeans.push({ mean: mean(vals), n: vals.length });
  }

  if (allValues.length < 2 || machineMeans.length < 2) return 0;

  const grandMean = mean(allValues);
  const ssTotal = allValues.reduce((s, v) => s + (v - grandMean) ** 2, 0);
  if (ssTotal === 0) return 0;

  const ssBetween = machineMeans.reduce(
    (s, m) => s + m.n * (m.mean - grandMean) ** 2,
    0,
  );

  return ssBetween / ssTotal;
}

export function bimodalityCoefficient(values: number[]): number {
  if (values.length < 4) return 0;
  const s = skewness(values);
  const k = kurtosis(values);
  if (k === 0) return 0;
  return (s * s + 1) / k;
}

export function computeCellMetrics(
  platform: string,
  suite: string,
  signatureId: number,
  machineData: MachineData,
): CellMetrics {
  const allValues: number[] = [];
  for (const points of machineData.values()) {
    for (const p of points) allValues.push(p.value);
  }

  const rcv = robustCV(allValues);
  const n = allValues.length;

  return {
    platform,
    suite,
    signatureId,
    n,
    nMachines: machineData.size,
    median: median(allValues),
    iqr: iqr(allValues),
    rCV: rcv,
    mdr: mdr(rcv, n),
    rBetween: rBetween(machineData),
    bimodalityCoeff: bimodalityCoefficient(allValues),
    bimodal: classifyGroups(machineData),
    machineData,
  };
}
