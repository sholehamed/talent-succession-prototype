import { Band } from "./models";

/** Rounded, equal-weight KPI attainment; this is not the 360/540 competency mean. */
export function performanceScore(values: number[]): number {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0 || v > 100))
    throw new Error("Invalid KPI attainment");
  return Math.round(values.reduce((total, v) => total + v, 0) / values.length);
}

/** Prototype-only policy for 9-box performance categories. */
export function performanceBand(score: number): Band {
  if (!Number.isFinite(score) || score < 0 || score > 100)
    throw new Error("Invalid performance score");
  return score >= 80 ? "high" : score >= 50 ? "medium" : "low";
}
