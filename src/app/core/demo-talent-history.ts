import type { Band, Person, TalentPositionEvent } from "./models";

/** Synthetic history for display only; never write this projection to LocalStorage or DemoState. */
export function demoNineBoxHistory(people: Person[], today: string): TalentPositionEvent[] {
  const [year, month, day] = today.split("-").map(Number);
  if (!year || !month || !day || !Number.isFinite(new Date(year, month - 1, day).getTime())) return [];
  const observed = (monthsBack: number) => {
    const date = new Date(year, month - 1, 1, 12);
    date.setMonth(date.getMonth() - monthsBack);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return date.toISOString();
  };
  const at = [observed(15), observed(7), observed(4), observed(2), observed(0)];
  const ranks: Band[] = ["low", "medium", "high"];
  const shift = (value: Band | null, amount: number): Band | null =>
    value === null ? null : ranks[Math.max(0, Math.min(2, ranks.indexOf(value) + amount))];
  const offsets: [number, number][] = [
    [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 0], [1, 0],
  ];

  return people.flatMap(person => {
    // Choose the fixture by stable person ID, not filtered list order.
    const numbered = /^p(\d+)$/.exec(person.id);
    const key = numbered ? Number(numbered[1]) - 1 :
      [...person.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
    const [pOffset, vOffset] = offsets[key % offsets.length];
    const priorPerformance = shift(person.performance, pOffset);
    const priorPotential = shift(person.potential, vOffset);
    const steps: [Band | null, Band | null][] = [
      [priorPerformance, priorPotential],
      [priorPerformance, person.potential],
      [priorPerformance, priorPotential],
      [priorPerformance, person.potential],
      [person.performance, person.potential],
    ];
    return steps.map(([performance, potential], step): TalentPositionEvent => ({
      id: `demo-history-${person.id}-${step}`, personId: person.id,
      at: at[step], performance, potential, unit: person.unit,
      source: "demo", action: "سناریوی ساختگی صرفاً برای پیش‌نمایش",
    }));
  });
}
