export interface PerfDatum {
  signature_id: number;
  job_id: number;
  push_id: number;
  push_timestamp: number;
  revision: string;
  value: number;
}

export interface JobInfo {
  id: number;
  machine_name: string;
}

export interface MachinePoint {
  timestamp: number;
  value: number;
  revision: string;
  push_id: number;
  job_id: number;
  machine_name: string;
}

export type MachineData = Map<string, MachinePoint[]>;

export interface SignatureInfo {
  id: number;
  suite: string;
  test: string | null;
  machine_platform: string;
  framework_id: number;
  application: string;
}

export interface BimodalGroupEntry {
  machine: string;
  avg: number;
  n: number;
  n_low: number;
  n_high: number;
}

export interface BimodalResult {
  split: number;
  gap: number;
  low: BimodalGroupEntry[];
  high: BimodalGroupEntry[];
  mixed: BimodalGroupEntry[];
  low_mean: number;
  high_mean: number;
  n_low_pts: number;
  n_high_pts: number;
}

export interface CellMetrics {
  platform: string;
  suite: string;
  signatureId: number;
  n: number;
  nMachines: number;
  median: number;
  iqr: number;
  rCV: number;
  mdr: number;
  rBetween: number;
  bimodalityCoeff: number;
  bimodal: BimodalResult | null;
  machineData: MachineData;
}

export interface DashboardState {
  repo: string;
  framework: number;
  days: number;
  platforms: string[];
  suites: string[];
  loading: boolean;
  progress: { done: number; total: number; label: string };
  cells: CellMetrics[];
  selectedCell: CellMetrics | null;
  availablePlatforms: string[];
  availableSuites: string[];
}
