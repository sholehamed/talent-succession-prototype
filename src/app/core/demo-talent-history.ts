import type { Band, DemoState, Person, TalentPositionEvent } from "./models";

/**
 * Demo-only, deterministic monthly backfill for the original 36 seed employees.
 * Generated events are permanently marked "demo" and MUST NOT be presented as
 * real evaluations. Genuine baseline/change observations are never modified.
 */
const SEED_EMPLOYEE_COUNT = 36;
const MONTHS_OF_HISTORY = 15;
const rank: Band[] = ["low", "medium", "high"];
const histories: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 0],
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

export function originalDemoEmployee(person: Person): boolean {
  const match = /^p([1-9]\d*)$/.exec(person.id);
  if (!match) return false;
  const index = Number(match[1]);
  return index <= SEED_EMPLOYEE_COUNT && person.code === `EMP-${1000 + index}`;
}

function shifted(value: Band | null, amount: number): Band | null {
  return value == null ? null :
    rank[Math.max(0, Math.min(2, rank.indexOf(value) + amount))];
}

/** The seed timeline is anchored to the earliest genuine observation, not now. */
export function monthlyDemoHistory(person: Person, firstObserved: TalentPositionEvent): TalentPositionEvent[] {
  const anchor = new Date(firstObserved.at);
  if (!Number.isFinite(anchor.getTime())) return [];
  const index = Number(person.id.slice(1)) - 1;
  const [performanceStep, potentialStep] = histories[index % histories.length];
  const year = anchor.getFullYear(), month = anchor.getMonth(), day = anchor.getDate();
  const entries: TalentPositionEvent[] = [];

  for (let monthsBack = MONTHS_OF_HISTORY; monthsBack >= 1; monthsBack--) {
    // Use local noon so a persisted ISO timestamp stays in the intended local calendar day.
    const date = new Date(year, month - monthsBack, 1, 12);
    const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, monthDays));

    // A different phase each quarter supplies realistic stable periods and transitions.
    const phase = Math.ceil(monthsBack / 3);
    const pDelta = phase === 1 ? performanceStep : phase % 2 === 0 ? 0 : performanceStep;
    const vDelta = phase === 1 ? potentialStep : phase % 2 === 0 ? potentialStep : 0;
    entries.push({
      id: `demo-monthly-${person.id}-${monthsBack}`,
      personId: person.id,
      at: date.toISOString(),
      performance: shifted(firstObserved.performance, pDelta),
      potential: shifted(firstObserved.potential, vDelta),
      unit: firstObserved.unit,
      source: "demo",
      action: "داده ساختگی ماهانه برای ارائه نمونه؛ فاقد ارزیابی تاریخی واقعی",
    });
  }
  return entries;
}

/**
 * Idempotent migration for first-load Seed and pre-existing LocalStorage saves.
 * Only known seed roster members qualify; newly hired people never get a past.
 * A genuine baseline/change always wins at and after its timestamp.
 */
export function seedDemoTalentHistory(state: DemoState): DemoState {
  const added: TalentPositionEvent[] = [];
  for (const person of state.people) {
    if (!originalDemoEmployee(person)) continue;
    const entries = state.talentHistory.filter(e=>e.personId===person.id);
    if (entries.some(e=>e.source==="demo")) continue;
    const genuine = entries.filter(e=>e.source!=="demo" && Number.isFinite(Date.parse(e.at)))
      .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const first = genuine[0];
    if (!first) continue;
    // Genuine history already reaches beyond the demo horizon: leave it intact.
    const earliest = new Date(first.at);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    if (earliest <= twelveMonthsAgo) continue;
    added.push(...monthlyDemoHistory(person,first));
  }
  // Keep recorded timeline order unchanged; future Store.commit() appends real changes.
  // Sorting the newly created demo prefix doesn't mutate any genuine observation.
  if (added.length) {
    added.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at) || a.id.localeCompare(b.id));
    state.talentHistory=[...added,...state.talentHistory];
  }
  return state;
}
