import { describe, it, expect } from "vitest";
import { mean, stdev, median, percentile, iqr, skewness, kurtosis } from "../src/stats/core.js";
import { robustCV, mdr, rBetween, bimodalityCoefficient } from "../src/stats/variance.js";
import { classifyGroups } from "../src/stats/bimodal.js";
import { makeNucData } from "./fixtures/nuc-data.js";

describe("core stats", () => {
  it("mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBeCloseTo(3.0);
    expect(mean([])).toBe(0);
  });

  it("stdev (sample)", () => {
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    expect(stdev([1])).toBe(0);
    expect(stdev([])).toBe(0);
  });

  it("median", () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([1, 3, 5, 7])).toBe(4);
    expect(median([])).toBe(0);
  });

  it("percentile", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(data, 50)).toBeCloseTo(5.5);
    expect(percentile(data, 25)).toBeCloseTo(3.25);
    expect(percentile(data, 75)).toBeCloseTo(7.75);
    expect(percentile(data, 0)).toBe(1);
    expect(percentile(data, 100)).toBe(10);
  });

  it("iqr", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(iqr(data)).toBeCloseTo(4.5);
  });

  it("skewness returns number for normal-ish data", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(typeof skewness(data)).toBe("number");
    expect(skewness(data)).toBeCloseTo(0, 1);
  });

  it("kurtosis returns number", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(typeof kurtosis(data)).toBe("number");
  });
});

describe("variance metrics", () => {
  it("robustCV", () => {
    const data = [10, 12, 11, 13, 9, 14, 8, 15, 10, 12];
    const rcv = robustCV(data);
    expect(rcv).toBeGreaterThan(0);
    expect(rcv).toBeLessThan(1);
  });

  it("mdr decreases with more samples", () => {
    expect(mdr(0.1, 10)).toBeGreaterThan(mdr(0.1, 100));
  });

  it("rBetween is 0..1 range", () => {
    const data = makeNucData();
    const rb = rBetween(data);
    expect(rb).toBeGreaterThan(0);
    expect(rb).toBeLessThanOrEqual(1);
  });

  it("bimodalityCoefficient for bimodal data is high", () => {
    const bimodal = [1, 1.1, 1.2, 0.9, 0.8, 5, 5.1, 5.2, 4.9, 4.8];
    const bc = bimodalityCoefficient(bimodal);
    expect(bc).toBeGreaterThan(0.5);
  });
});

describe("bimodal detection with real NUC data", () => {
  it("detects bimodal split in NUC data", () => {
    const data = makeNucData();
    const result = classifyGroups(data);
    expect(result).not.toBeNull();
    expect(result!.split).toBeGreaterThan(20);
    expect(result!.split).toBeLessThan(22);
  });

  it("classifies correct number of LOW/HIGH/MIXED machines", () => {
    const data = makeNucData();
    const result = classifyGroups(data)!;
    expect(result.low.length).toBe(24);
    expect(result.high.length).toBe(27);
    expect(result.mixed.length).toBe(1);
    expect(result.mixed[0].machine).toBe("nuc13-149");
  });

  it("LOW mean ~18.6, HIGH mean ~23.3", () => {
    const data = makeNucData();
    const result = classifyGroups(data)!;
    expect(result.low_mean).toBeCloseTo(18.6, 0);
    expect(result.high_mean).toBeCloseTo(23.3, 0);
  });

  it("gap is positive (clear separation between clusters)", () => {
    const data = makeNucData();
    const result = classifyGroups(data)!;
    expect(result.gap).toBeGreaterThan(1);
  });

  it("returns null for uniform data", () => {
    const data = new Map();
    data.set("m1", [
      { timestamp: 1, value: 10.0, revision: "a", push_id: 1, job_id: 1, machine_name: "m1" },
      { timestamp: 2, value: 10.1, revision: "b", push_id: 2, job_id: 2, machine_name: "m1" },
      { timestamp: 3, value: 10.2, revision: "c", push_id: 3, job_id: 3, machine_name: "m1" },
      { timestamp: 4, value: 10.3, revision: "d", push_id: 4, job_id: 4, machine_name: "m1" },
    ]);
    expect(classifyGroups(data)).toBeNull();
  });
});
