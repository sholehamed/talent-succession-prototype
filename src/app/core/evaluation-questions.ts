import { EvaluationQuestion, Group, competencies } from "./models";

export const evaluationAnchors = [
  "به‌ندرت", "با کمک مستمر", "مستقل و قابل اتکا", "فراتر از انتظار", "الگوی دیگران",
];

const examples: Record<Group, string[]> = {
  supervisor: [
    "پیام و انتظار کاری خود را به‌روشنی منتقل می‌کند.",
    "در تحقق اهداف مشترک با سایر واحدها همکاری مؤثر دارد.",
    "ریشه مسائل و راهکارهای جایگزین را بررسی می‌کند.",
    "برای نتیجه کار و پیگیری تعهدات پاسخگو است.",
    "در موقعیت مناسب هدایت تیم و بازخورد سازنده را بر عهده می‌گیرد.",
  ],
  peer: [
    "در گفت‌وگوهای کاری، اطلاعات لازم را شفاف و به‌موقع منتقل می‌کند.",
    "در انجام وظایف مشترک همکاری سازنده دارد.",
    "برای حل اختلاف نظر، راه‌حل‌های عملی پیشنهاد می‌کند.",
    "تعهدات مشترک را به‌موقع پیگیری می‌کند.",
    "به همکاران برای یادگیری و پیشرفت بازخورد مفید می‌دهد.",
  ],
  subordinate: [
    "درباره وظایف و انتظارات، توضیح روشن ارائه می‌دهد.",
    "فضایی برای همکاری و شنیده شدن دیدگاه اعضای تیم فراهم می‌کند.",
    "در مواجهه با مشکلات تیم، به بررسی راه‌حل‌ها کمک می‌کند.",
    "تصمیم‌ها و تعهدات خود را شفاف پیگیری می‌کند.",
    "مسئولیت‌ها را مناسب واگذار کرده و فرصت رشد ایجاد می‌کند.",
  ],
  external: [
    "خواسته‌ها و اطلاعات همکاری را واضح منتقل می‌کند.",
    "برای هماهنگی با شما و تیم‌تان همکاری مناسبی دارد.",
    "در مواجهه با مسائل مشترک، راه‌حل قابل اجرا پیشنهاد می‌کند.",
    "تعهدات و پیگیری‌های مرتبط با همکاری را انجام می‌دهد.",
    "در تعاملات، تصمیم‌ها و هماهنگی لازم را به‌خوبی راهبری می‌کند.",
  ],
};
export function defaultEvaluationQuestions(): EvaluationQuestion[] {
  return (Object.entries(examples) as [Group, string[]][]).flatMap(
    ([group, texts]) => texts.map((text, competencyIndex) => ({
      id: `q-${group}-${competencyIndex}`,
      group, text, competencyIndex, order: competencyIndex, isActive: true,
    })),
  );
}
/** Texts used only for ongoing legacy cycles without a saved question snapshot. */
export function legacyCycleQuestions(group: Group): EvaluationQuestion[] {
  return [
    "پیام و انتظار خود را روشن و قابل فهم منتقل می‌کند.",
    "برای حل مسائل مشترک با دیگران همکاری می‌کند.",
    "علت مسئله و راه‌حل‌های جایگزین را بررسی می‌کند.",
    "مسئولیت نتیجه و پیگیری تعهدات را می‌پذیرد.",
    "به اعضای تیم بازخورد و فرصت رشد می‌دهد.",
  ].map((text, competencyIndex) => ({
    id: `legacy-${group}-${competencyIndex}`,
    group, text, competencyIndex, order: competencyIndex, isActive: true,
  }));
}
export function orderedQuestions(list: EvaluationQuestion[], group: Group) {
  return list.filter((q) => q.group === group && q.isActive)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function validateQuestionBank(
  questions: EvaluationQuestion[], mode: 360 | 540,
): string | null {
  const groups: Group[] = ["supervisor", "peer", "subordinate", ...(mode === 540 ? ["external" as Group] : [])];
  const active = groups.flatMap((g) => orderedQuestions(questions, g));
  if (groups.some((g) => !active.some((q) => q.group === g)))
    return "برای هر گروه ارزیاب این دوره حداقل یک سؤال فعال لازم است.";
  if (competencies.some((_, i) => !active.some((q) => q.competencyIndex === i)))
    return "برای شروع دوره، پنج شایستگی اصلی باید مجموعاً توسط سؤالات گروه‌ها پوشش داده شوند.";
  return null;
}
