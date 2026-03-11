import { getCachedMachineNames, cacheMachineNames } from "./cache.js";
import { computeCellMetrics } from "../stats/variance.js";
import type {
  PerfDatum,
  SignatureInfo,
  MachineData,
  MachinePoint,
  CellMetrics,
} from "../types.js";

const BASE = "https://treeherder.mozilla.org";
const MAX_CONCURRENT = 20;
const SIG_BATCH = 20;
const JOB_BATCH = 100;

type ProgressCb = (p: { done: number; total: number; label: string }) => void;

async function fetchJSON<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  return resp.json();
}

async function pool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function fetchSignatures(
  repo: string,
  framework: number,
): Promise<SignatureInfo[]> {
  const url = `${BASE}/api/project/${repo}/performance/signatures/?framework=${framework}&subtests=0`;
  const data = await fetchJSON<Record<string, SignatureInfo>>(url);
  return Object.values(data);
}

async function fetchPerfDataBatch(
  repo: string,
  framework: number,
  signatureIds: number[],
  days: number,
): Promise<Map<number, PerfDatum[]>> {
  const interval = days * 86400;
  const params = signatureIds
    .map((id) => `signature_id=${id}`)
    .join("&");
  const url = `${BASE}/api/project/${repo}/performance/data/?framework=${framework}&interval=${interval}&${params}`;
  const data = await fetchJSON<Record<string, PerfDatum[]>>(url);
  const result = new Map<number, PerfDatum[]>();
  for (const points of Object.values(data)) {
    if (points.length > 0) {
      result.set(points[0].signature_id, points);
    }
  }
  return result;
}

async function fetchJobsBulk(
  repo: string,
  jobIds: number[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const batches: number[][] = [];
  for (let i = 0; i < jobIds.length; i += JOB_BATCH) {
    batches.push(jobIds.slice(i, i + JOB_BATCH));
  }

  await pool(batches, MAX_CONCURRENT, async (batch) => {
    const ids = batch.join(",");
    const url = `${BASE}/api/project/${repo}/jobs/?id__in=${ids}&count=${batch.length}`;
    const data = await fetchJSON<{
      results: Array<{ id: number; machine_name: string }>;
    }>(url);
    for (const job of data.results) {
      result.set(job.id, job.machine_name);
    }
  });

  return result;
}

async function resolveJobMachines(
  repo: string,
  jobIds: Set<number>,
  onProgress?: ProgressCb,
): Promise<Map<number, string>> {
  const allIds = [...jobIds];
  const cached = await getCachedMachineNames(allIds);
  const uncached = allIds.filter((id) => !cached.has(id));

  if (onProgress) {
    onProgress({
      done: cached.size,
      total: allIds.length,
      label: `${uncached.length} jobs to fetch (${cached.size} cached)`,
    });
  }

  if (uncached.length > 0) {
    const fetched = await fetchJobsBulk(repo, uncached);
    await cacheMachineNames(fetched);
    for (const [id, name] of fetched) {
      cached.set(id, name);
    }
  }

  return cached;
}

export interface DashboardResult {
  cells: CellMetrics[];
  platforms: string[];
  suites: string[];
}

export async function loadDashboardData(
  repo: string,
  framework: number,
  days: number,
  filterPlatforms: string[],
  filterSuites: string[],
  onProgress?: ProgressCb,
): Promise<DashboardResult> {
  onProgress?.({ done: 0, total: 1, label: "Fetching signatures..." });
  const allSigs = await fetchSignatures(repo, framework);

  const parentSigs = allSigs.filter((s) => !s.test);
  const platformSet = new Set(parentSigs.map((s) => s.machine_platform));
  const suiteSet = new Set(parentSigs.map((s) => s.suite));
  const platforms = [...platformSet].sort();
  const suites = [...suiteSet].sort();

  let sigs = parentSigs;
  if (filterPlatforms.length > 0) {
    const pf = new Set(filterPlatforms);
    sigs = sigs.filter((s) => pf.has(s.machine_platform));
  }
  if (filterSuites.length > 0) {
    const sf = new Set(filterSuites);
    sigs = sigs.filter((s) => sf.has(s.suite));
  }

  if (sigs.length === 0) {
    return { cells: [], platforms, suites };
  }

  onProgress?.({
    done: 0,
    total: sigs.length,
    label: `Fetching perf data for ${sigs.length} signatures...`,
  });

  const sigBatches: number[][] = [];
  for (let i = 0; i < sigs.length; i += SIG_BATCH) {
    sigBatches.push(sigs.slice(i, i + SIG_BATCH).map((s) => s.id));
  }

  const allPerfData = new Map<number, PerfDatum[]>();
  let fetchedSigs = 0;
  await pool(sigBatches, MAX_CONCURRENT, async (batch) => {
    const batchData = await fetchPerfDataBatch(repo, framework, batch, days);
    for (const [id, pts] of batchData) {
      allPerfData.set(id, pts);
    }
    fetchedSigs += batch.length;
    onProgress?.({
      done: fetchedSigs,
      total: sigs.length,
      label: `Fetched ${fetchedSigs}/${sigs.length} signatures`,
    });
  });

  const allJobIds = new Set<number>();
  for (const pts of allPerfData.values()) {
    for (const p of pts) allJobIds.add(p.job_id);
  }

  onProgress?.({
    done: 0,
    total: allJobIds.size,
    label: `Resolving ${allJobIds.size} job machine names...`,
  });
  const jobMachines = await resolveJobMachines(repo, allJobIds, onProgress);

  onProgress?.({ done: 1, total: 1, label: "Computing metrics..." });

  const cells: CellMetrics[] = [];
  for (const sig of sigs) {
    const points = allPerfData.get(sig.id);
    if (!points || points.length === 0) continue;

    const machineData: MachineData = new Map();
    for (const p of points) {
      const machine = jobMachines.get(p.job_id);
      if (!machine) continue;
      if (!machineData.has(machine)) machineData.set(machine, []);
      machineData.get(machine)!.push({
        timestamp: p.push_timestamp,
        value: p.value,
        revision: p.revision,
        push_id: p.push_id,
        job_id: p.job_id,
        machine_name: machine,
      } as MachinePoint);
    }

    if (machineData.size > 0) {
      cells.push(
        computeCellMetrics(sig.machine_platform, sig.suite, sig.id, machineData),
      );
    }
  }

  cells.sort((a, b) => b.mdr - a.mdr);

  return { cells, platforms, suites };
}
