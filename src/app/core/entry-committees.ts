import {
  competencies, EntryCommitteeReview, EntryCommitteeStage, EntryEvaluatorGroup, EntryQuestion, Job, QuestionAnswer,
} from "./models";

/**
 * Two scoped banks share competency indices/score anchors with 360/540 but not
 * the same questions or respondent visibility. Specialist questions are per job.
 */
export function defaultEntryQuestions(jobs: Job[]): EntryQuestion[] {
  const general = [
    "در مصاحبه نمونه‌ای از انتقال روشن اطلاعات به دیگران ارائه می‌کند.",
    "با ذکر تجربه واقعی، شیوه همکاری و حل اختلاف را توضیح می‌دهد.",
    "برای یک مسئله عمومی، علت‌ها و راه‌حل‌های جایگزین پیشنهاد می‌کند.",
    "پیگیری مسئولیت و تعهدات قبلی را با مثال توضیح می‌دهد.",
    "در یک موقعیت گروهی، نحوه هدایت و بازخورد سازنده را شرح می‌دهد.",
  ];
  const specialist = [
    "در موقعیت مرتبط با شغل، یافته‌های تخصصی را روشن منتقل می‌کند.",
    "تعامل با واحدهای وابسته به این شغل را با مثال کاربردی شرح می‌دهد.",
    "یک مسئله فنی مرتبط با وظایف شغل را تحلیل و راه‌حل ارائه می‌کند.",
    "روش تحویل خروجی با کیفیت و پاسخگویی در شغل هدف را توضیح می‌دهد.",
    "شیوه هدایت فعالیت یا انتقال دانش تخصصی شغل را نشان می‌دهد.",
  ];
  return [
    ...general.map((text, i) => ({
      id: `entry-general-${i}`, stage: "general" as const,
      jobId: null, text, competencyIndex: i, order: i, isActive: true,
    })),
    ...jobs.flatMap((job) => specialist.map((text, i) => ({
      id: `entry-specialist-${job.id}-${i}`, stage: "specialist" as const,
      jobId: job.id, text: `${text} (${job.title})`,
      competencyIndex: i, order: i, isActive: true,
    }))),
  ];
}
export const entryStageLabel: Record<EntryCommitteeStage, string> = {
  general: "کمیته ارزیابی عمومی",
  specialist: "کمیته ارزیابی تخصصی",
};
export function activeEntryQuestions(
  all: EntryQuestion[], stage: EntryCommitteeStage, jobId: string,
): EntryQuestion[] {
  return all.filter((q) =>
    q.isActive && q.stage === stage &&
    (stage === "general" ? q.jobId === null : q.jobId === jobId))
    .sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
}
export function entryBankError(questions: EntryQuestion[]): string | null {
  if (!questions.length) return "برای ارجاع، سؤال فعال الزامی است.";
  if (competencies.some((_, i) => !questions.some((q) => q.competencyIndex === i)))
    return "بانک این مرحله باید هر پنج شایستگی اصلی را پوشش دهد.";
  return null;
}
export function entryScores(
  questions: EntryQuestion[], answers: QuestionAnswer[],
): number[] | null {
  if (!questions.length || questions.length !== answers.length ||
    new Set(questions.map((q) => q.id)).size !== questions.length ||
    new Set(answers.map((a) => a.questionId)).size !== answers.length) return null;
  const answerMap = new Map(answers.map((a) => [a.questionId, a.score]));
  if (questions.some((q) => {
    const score = answerMap.get(q.id);
    return !Number.isInteger(score) || score! < 1 || score! > 5;
  })) return null;
  const values = competencies.map((_, i) =>
    questions.filter((q) => q.competencyIndex === i).map((q) => answerMap.get(q.id)!));
  if (values.some((v) => !v.length)) return null;
  return values.map((v) => Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10);
}
export function combinedEntryScores(
  general: EntryCommitteeReview, specialist: EntryCommitteeReview,
): number[] | null {
  if (!general.scores || !specialist.scores ||
    general.scores.length !== competencies.length ||
    specialist.scores.length !== competencies.length) return null;
  return general.scores.map((x,i) => Math.round((x+specialist.scores![i])/2*10)/10);
}

/** Single referral contract for both the standard and manually entered general path. */
export function specialistReferral(
  group: EntryEvaluatorGroup, questions: EntryQuestion[], assignedAt: string,
): EntryCommitteeReview {
  return {
    stage: "specialist",
    method: "questionnaire",
    assignedTo: group.memberIds[0],
    assignedAt,
    questions: structuredClone(questions),
    groupId: group.id,
    groupName: group.name,
    assignments: group.memberIds.map(assignedTo => ({assignedTo})),
  };
}

/** Two illustrative reusable groups; no candidate, question or assessment is copied. */
export function defaultEntryEvaluatorGroups(jobs: Job[], memberIds = ["p5", "p6"]): EntryEvaluatorGroup[] {
  const management = new Set(["j1", "j2", "j4", "j8"]);
  const active = jobs.filter(j => j.version > 0).map(j => j.id);
  return [
    {id: "entry-group-management", name: "ارزیابان مشاغل مدیریتی",
      jobIds: active.filter(id => management.has(id)), memberIds: [...memberIds], isActive: true},
    {id: "entry-group-other", name: "ارزیابان سایر مشاغل",
      jobIds: active.filter(id => !management.has(id)), memberIds: [...memberIds], isActive: true},
  ].filter(group => group.jobIds.length > 0);
}
