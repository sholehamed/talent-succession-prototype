import { Cycle, EvaluationQuestion, Group, JobContent, Plan, QuestionAnswer } from "./models";
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
/** All questions in the assigned group must be answered once with values 1..5. */
export function validQuestionAnswers(
  questions: EvaluationQuestion[], answers: QuestionAnswer[],
): boolean {
  if (!questions.length || answers.length !== questions.length) return false;
  const ids = new Set(questions.map((q) => q.id));
  return ids.size === questions.length &&
    new Set(answers.map((a) => a.questionId)).size === answers.length &&
    answers.every((a) => ids.has(a.questionId) &&
      Number.isInteger(a.score) && a.score >= 1 && a.score <= 5);
}
/** Published result carries no evaluator identifiers; small peer/subordinate samples are suppressed. */
export function aggregate(c: Cycle) {
  const gs: Group[] = [
    "supervisor", "peer", "subordinate",
    ...(c.mode === 540 ? ["external" as Group] : []),
  ];
  const rows = gs.map((group) => {
    const questions = c.questions?.filter((q) => q.group === group) ?? [];
    const dynamic = !!c.questions;
    const responses = c.assignments.filter((a) => a.group === group &&
      (dynamic
        ? !!a.answers && validQuestionAnswers(questions, a.answers)
        : !!a.scores && validScores(a.scores)));
    const suppressed = responses.length < (["peer", "subordinate"].includes(group) ? 2 : 1);
    const scores: (number | null)[] | null = suppressed ? null : Array.from({length:5}, (_, i) => {
      if (!dynamic)
        return responses.reduce((sum, a) => sum + a.scores![i], 0) / responses.length;
      const selected = questions.filter((q) => q.competencyIndex === i);
      if (!selected.length) return null;
      const totals = responses.flatMap((a) => selected.map((q) =>
        a.answers!.find((answer) => answer.questionId === q.id)!.score));
      return totals.reduce((sum, score) => sum + score, 0) / totals.length;
    });
    return { group, count: responses.length, scores };
  });
  const scores = Array.from({length:5}, (_, i) => {
    const values = rows
      .filter((r) => r.scores !== null)
      .map((r) => r.scores![i])
      .filter((v): v is number => v !== null);
    return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
  });
  return {
    rows,
    scores: scores.every((v): v is number => v !== null) ? scores as number[] : null,
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
