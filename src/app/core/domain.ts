import { Cycle, Group, JobContent, Plan } from "./models";
export function canStart(c: Cycle): boolean {
  const n = (g: Group) => c.assignments.filter((a) => a.group === g).length;
  return (
    n("supervisor") >= 1 &&
    n("peer") >= 2 &&
    n("subordinate") >= 2 &&
    (c.mode === 360 || n("external") >= 1) &&
    new Set(c.assignments.map((a) => a.personId)).size ===
      c.assignments.length &&
    !c.assignments.some((a) => a.personId === c.subjectId)
  );
}
export function validScores(scores: number[]): boolean {
  return (
    scores.length === 5 &&
    scores.every((s) => Number.isInteger(s) && s >= 1 && s <= 5)
  );
}
// Reports deliberately have no evaluator identities. Small peer/subordinate samples are suppressed.
export function aggregate(c: Cycle) {
  const gs: Group[] = [
    "supervisor",
    "peer",
    "subordinate",
    ...(c.mode === 540 ? ["external" as Group] : []),
  ];
  const rows = gs.map((group) => {
    const responses = c.assignments.filter(
      (a) => a.group === group && a.scores,
    );
    const suppressed =
      responses.length < (["peer", "subordinate"].includes(group) ? 2 : 1);
    return {
      group,
      count: responses.length,
      scores: suppressed
        ? null
        : Array.from(
            { length: 5 },
            (_, i) =>
              responses.reduce((v, a) => v + a.scores![i], 0) /
              responses.length,
          ),
    };
  });
  const available = rows.filter((r) => r.scores);
  return {
    rows,
    scores: available.length
      ? Array.from(
          { length: 5 },
          (_, i) =>
            available.reduce((s, r) => s + r.scores![i], 0) / available.length,
        )
      : null,
  };
}
export function gap(expected: number[], observed: number[]) {
  return expected.map((v, i) =>
    Math.max(0, Math.round((v - observed[i]) * 100) / 100),
  );
}
export function progress(p: Plan): number {
  return p.actions.length
    ? Math.round(
        (p.actions.filter((a) => a.status === "completed").length /
          p.actions.length) *
          100,
      )
    : 0;
}
export function validateJob(j: JobContent): string {
  if (!j.title.trim() || !j.mission.trim() || !j.owner.trim())
    return "عنوان، مأموریت و مالک محتوا الزامی است.";
  if (
    j.expected.length !== 5 ||
    !j.expected.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)
  )
    return "سطح شایستگی باید عدد صحیح بین ۱ تا ۵ باشد.";
  if (j.tasks.some((t) => !t.title.trim() || !t.output.trim()))
    return "عنوان و خروجی تمام وظایف را تکمیل کنید.";
  if (j.kpis.some((k) => Object.values(k).some((v) => !v.trim())))
    return "تمام مشخصات هر KPI الزامی است.";
  if (new Set(j.kpis.map((k) => k.title.trim())).size !== j.kpis.length)
    return "هر KPI فقط یک تعریف و منبع مرجع دارد؛ عنوان تکراری مجاز نیست.";
  return "";
}
