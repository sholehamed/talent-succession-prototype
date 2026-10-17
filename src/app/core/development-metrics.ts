import { aggregate, gap } from "./domain";
import { Cycle, DemoState, Plan } from "./models";

export interface GrowthRow {
  personId: string;
  jobId: string;
  previousCycleId: string;
  currentCycleId: string;
  previousTitle: string;
  currentTitle: string;
  observedChange: number;
  gapReduction: number;
  expectationsChanged: boolean;
  /** Older plans may lack frozen baselines; the report must disclose this. */
  historicalExpectedEstimated: boolean;
}
export interface DevelopmentActionRow {
  plan: Plan;
  action: Plan["actions"][number];
}
export interface DevelopmentMetrics {
  plans: Plan[];
  actions: DevelopmentActionRow[];
  totalActions: number;
  completed: number;
  activityPercent: number | null;
  reviewed: number;
  effective: number;
  partial: number;
  ineffective: number;
  reviewCoverage: number | null;
  effectivePercent: number | null;
  growthRows: GrowthRow[];
  meanObservedChange: number | null;
  meanGapReduction: number | null;
}
const round = (n: number) => Math.round(n * 100) / 100;
const percent = (a: number, b: number) => b ? Math.round(a / b * 100) : null;
const published = (cycle: Cycle) => ["feedback", "closed"].includes(cycle.status);

/**
 * Snapshot of a filtered period and visible people.
 * Activity completion, management judgment and observed change are independent metrics.
 * Growth is calculated from two distinct published evaluation periods of the SAME person/job.
 */
export function developmentMetrics(
  state: DemoState,
  visiblePersonIds: ReadonlySet<string>,
  period: string,
): DevelopmentMetrics {
  const plans = state.plans.filter(
    (plan) => visiblePersonIds.has(plan.personId) &&
      (!period || plan.period === period),
  );
  const actions = plans.flatMap((plan) =>
    plan.actions.map((action) => ({ plan, action })),
  );
  const completed = actions.filter(({ action }) => action.status === "completed").length;
  const reviews = actions.filter(({ action }) =>
    action.status === "completed" && !!action.effectiveness,
  );
  const effective = reviews.filter(({ action }) =>
    action.effectiveness?.outcome === "effective",
  ).length;
  const partial = reviews.filter(({ action }) =>
    action.effectiveness?.outcome === "partial",
  ).length;
  const ineffective = reviews.filter(({ action }) =>
    action.effectiveness?.outcome === "ineffective",
  ).length;

  const cycles = state.cycles.filter(
    (cycle) => published(cycle) && visiblePersonIds.has(cycle.subjectId),
  );
  const groups = new Map<string, Cycle[]>();
  for (const cycle of cycles) {
    const key = JSON.stringify([cycle.subjectId, cycle.jobId]);
    groups.set(key, [...(groups.get(key) ?? []), cycle]);
  }
  const growthRows: GrowthRow[] = [];
  for (const pairCycles of groups.values()) {
    pairCycles.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
    const eligible = period ? pairCycles.filter((c) => c.period === period) : pairCycles;
    const current = eligible.at(-1);
    if (!current) continue;
    const previous = pairCycles.filter(
      (c) => c.created < current.created && c.period !== current.period,
    ).at(-1);
    if (!previous) continue;

    const snapshot = (cycle: Cycle) => {
      const frozen = state.plans.find((p) => p.cycleId === cycle.id)?.baseline;
      const observed = frozen?.observed ?? aggregate(cycle).scores;
      const expected = frozen?.expected ??
        state.jobs.find((job) => job.id === cycle.jobId)?.expected;
      if (!observed || !expected || observed.length !== 5 || expected.length !== 5)
        return null;
      return {
        observed, expected,
        gaps: frozen?.gaps ?? gap(expected, observed),
        estimated: !frozen,
      };
    };
    const old = snapshot(previous), next = snapshot(current);
    if (!old || !next) continue;
    growthRows.push({
      personId: current.subjectId,
      jobId: current.jobId,
      previousCycleId: previous.id,
      currentCycleId: current.id,
      previousTitle: previous.title,
      currentTitle: current.title,
      observedChange: round(next.observed.reduce(
        (sum, value, i) => sum + value - old.observed[i], 0,
      ) / 5),
      gapReduction: round(next.gaps.reduce(
        (sum, value, i) => sum + old.gaps[i] - value, 0,
      ) / 5),
      expectationsChanged: old.expected.some((v, i) => v !== next.expected[i]),
      historicalExpectedEstimated: old.estimated || next.estimated,
    });
  }
  growthRows.sort((a, b) => a.personId.localeCompare(b.personId) ||
    a.jobId.localeCompare(b.jobId));
  return {
    plans,
    actions,
    totalActions: actions.length,
    completed,
    activityPercent: percent(completed, actions.length),
    reviewed: reviews.length,
    effective,
    partial,
    ineffective,
    reviewCoverage: percent(reviews.length, completed),
    effectivePercent: percent(effective, reviews.length),
    growthRows,
    meanObservedChange: growthRows.length
      ? round(growthRows.reduce((sum, row) => sum + row.observedChange, 0) / growthRows.length)
      : null,
    meanGapReduction: growthRows.length
      ? round(growthRows.reduce((sum, row) => sum + row.gapReduction, 0) / growthRows.length)
      : null,
  };
}
