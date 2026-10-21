import { DemoState, Job, Person, Knowledge, Cycle, Plan } from "./models";
import { defaultEvaluationQuestions } from "./evaluation-questions";
import { defaultEntryQuestions, defaultEntryEvaluatorGroups } from "./entry-committees";
import { defaultDevelopmentTemplates } from "./development-templates";
import { hydrateOrganization } from "./organization";
import { hydrateTalentHistory } from "./talent-history";
import { seedDemoTalentHistory } from "./demo-talent-history";
import { defaultProspectiveIndicators, defaultProspectiveQuestions } from "./prospective";
export function seed(): DemoState {
  const units = [
    "دفتر پروژه‌ها",
    "عملیات",
    "منابع انسانی",
    "فناوری اطلاعات",
    "کنترل کیفیت",
  ];
  const titles = [
    "مدیر پروژه",
    "سرپرست عملیات",
    "کارشناس منابع انسانی",
    "مدیر فناوری اطلاعات",
    "کارشناس کنترل کیفیت",
    "سرپرست HSE",
    "کارشناس ارشد پروژه",
    "سرپرست پروژه",
    "تحلیلگر سیستم",
    "کارشناس آموزش",
  ];
  const jobs: Job[] = titles.map((title, i) => ({
    id: `j${i + 1}`,
    code: `JOB-${101 + i}`,
    title,
    unit: i === 6 || i === 7 ? "دفتر پروژه‌ها" : units[i % 5],
    family: [
      "مدیریت پروژه",
      "عملیات و ایمنی",
      "سرمایه انسانی",
      "فناوری",
      "کیفیت",
    ][i % 5],
    level: i < 6 ? "ارشد" : "کارشناسی",
    mission: `راهبری و هماهنگی فعالیت‌های ${title} برای تحقق خروجی‌های قابل اندازه‌گیری.\nتوسعه همکاری میان واحدها و مدیریت مسئولانه منابع.\nپایش ریسک‌ها، کیفیت خدمات و انتقال تجربه به اعضای تیم.`,
    tasks: [
      {
        id: `t${i}-1`,
        title: "مدیریت ریسک پروژه",
        output: "ثبت و پیگیری هفتگی ریسک‌های اولویت‌دار",
      },
      {
        id: `t${i}-2`,
        title: "هماهنگی و پایش تحویل",
        output: "تحویل خروجی مطابق برنامه مصوب",
      },
      {
        id: `t${i}-3`,
        title: "توسعه و انتقال دانش",
        output: "یک مرور پس از اقدام در پایان هر فاز",
      },
    ],
    kpis: [
      {
        title: "تحویل به‌موقع",
        definition: "سهم خروجی‌های تحویل‌شده در موعد برنامه",
        formula: "تحویل به‌موقع ÷ کل تحویل × ۱۰۰",
        unit: "درصد",
        frequency: "ماهانه",
        source: "سامانه مدیریت پروژه",
        owner: "مالک خانواده شغلی",
      },
      {
        title: "بسته‌شدن ریسک",
        definition: "سهم ریسک‌های دارای اقدام تکمیل‌شده",
        formula: "ریسک بسته ÷ کل ریسک × ۱۰۰",
        unit: "درصد",
        frequency: "ماهانه",
        source: "دفتر مدیریت ریسک",
        owner: "مدیر واحد",
      },
      {
        title: "مشارکت دانشی",
        definition: "تعداد درس‌آموخته‌های منتشرشده مرتبط",
        formula: "تعداد AAR تأییدشده",
        unit: "مورد",
        frequency: "فصلی",
        source: "مخزن دانش سازمانی",
        owner: "مالک دانش",
      },
    ],
    expected: [4, 4, 4, 4, i === 0 ? 3 : 4],
    skills: "برنامه‌ریزی: پیشرفته؛ تحلیل داده: متوسط؛ تسهیل جلسات: پیشرفته",
    qualifications:
      "کارشناسی مرتبط؛ تجربه راهبری تیم؛ گواهی آموزشی مرتبط",
    hse: "رعایت الزامات ایمنی محیط کار و محرمانگی اسناد پروژه",
    owner: "مالک خانواده شغلی",
    version: 1,
    revised: "2026-09-23",
    review: "published",
    history: [
      { version: 1, at: "2026-09-23", summary: "تصویب نسخه اولیه شناسنامه" },
    ],
  }));
  const names = [
    "آرمان راد",
    "سارا مهر",
    "نیما روشن",
    "مهسا سپهر",
    "علی پارسا",
    "نازنین آذر",
    "کیان نیک",
    "رها بهار",
    "سامان شایان",
    "آوا تابان",
    "پویان فرهمند",
    "هستی مهران",
    "مانی آریا",
    "نیکا دانا",
    "اشکان امید",
    "ترانه والا",
    "بردیا آزاد",
    "یلدا شمس",
    "رضا بهین",
    "ستاره شکیبا",
    "آرش سام",
    "شیدا نوری",
    "پارسا فرزین",
    "الهام صفا",
    "رامین نوا",
    "نگار توانا",
    "شهاب حامی",
    "مریم دل‌آرا",
    "امیر رایان",
    "سحر فروغ",
    "ماهان شاد",
    "رویا رسا",
    "حمید پایا",
    "ندا آبان",
    "فرید نوین",
    "باران سروش",
  ];
  const people: Person[] = names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    code: `EMP-${1001 + i}`,
    unit: jobs[i === 0 ? 6 : i % 10].unit,
    jobId: `j${i === 0 ? 7 : (i % 10) + 1}`,
    managerId: i === 10 ? "p21" : "p11",
    performance: (["high", "medium", "low"] as const)[i % 3],
    potential: (["high", "medium", "low"] as const)[Math.floor(i / 3) % 3],
    observed: [3 + (i % 2), 3, 2 + (i % 3), 4, 2 + (i % 2)],
    evidence: "مصاحبه رفتاری و سوابق پروژه؛ بازبینی کمیته در پاییز ۱۴۰۵",
  }));
  const assignments = Array.from({ length: 6 }, (_, i) => ({
    id: `a${i + 1}`,
    personId: `p${i + 2}`,
    group: (
      [
        "supervisor",
        "peer",
        "peer",
        "subordinate",
        "subordinate",
        "external",
      ] as const
    )[i],
  }));
  const cycles: Cycle[] = [
    {
      id: "c1",
      title: "ارزیابی پاییز ۱۴۰۵",
      period: "1405-autumn",
      subjectId: "p1",
      jobId: "j1",
      mode: 540,
      status: "preparing",
      assignments,
      notes: "",
      created: "2026-10-16",
    },
    {
      id: "c0",
      title: "ارزیابی تابستان ۱۴۰۵",
      period: "1405-summer",
      subjectId: "p1",
      jobId: "j1",
      mode: 540,
      status: "closed",
      assignments: assignments.map((a, i) => ({
        ...a,
        id: `old-${a.id}`,
        scores: [3, 3, 2 + (i % 2), 3, 2],
      })),
      notes: "بازبینی تکمیل شده؛ تمرکز بر هدایت تیم",
      created: "2026-07-23",
    },
  ];
  const plans: Plan[] = Array.from({ length: 8 }, (_, i) => ({
    id: `d${i + 1}`,
    personId: `p${i + 2}`,
    jobId: `j${(i % 5) + 1}`,
    period: "1405-autumn",
    actions: [0, 1, 2].map((n) => ({
      id: `d${i + 1}-${n}`,
      competency: n,
      title: [
        "هدایت یک پروژه کوچک",
        "جلسات مربیگری با مدیر",
        "کارگاه تحلیل مسئله",
      ][n],
      kind: ["تجربه عملی", "مربیگری", "آموزش"][n],
      owner: n === 0 ? names[i + 1] : "مدیر مستقیم",
      assigneeId: n === 0 ? `p${i + 2}` : "p11",
      due: "2026-12-21",
      indicator: [
        "تحویل یک خروجی تأییدشده",
        "ثبت چهار بازخورد رفتاری",
        "حل یک مسئله مستند",
      ][n],
      status: i % 3 === n ? "completed" : "planned",
    })),
  }));
  const knowledge: Knowledge[] = Array.from({ length: 18 }, (_, i) => ({
    id: `k${i + 1}`,
    title:
      [
        "درس‌آموخته هماهنگی پروژه توسعه شعبه",
        "چک‌لیست تحویل امن پروژه",
        "راهنمای جلسه بازخورد",
        "الگوی برنامه توسعه فردی",
        "تجربه کاهش دوباره‌کاری",
        "پرسش‌های متداول مدیریت ریسک",
      ][i % 6] + (i > 5 ? ` — بخش ${i + 1}` : ""),
    kind: i % 3 === 0 ? "AAR" : i % 3 === 1 ? "چک‌لیست" : "راهنما",
    jobId: `j${(i % 5) + 1}`,
    taskId: `t${i % 5}-1`,
    tags: "ریسک، همکاری، پروژه",
    owner: names[i],
    revision: i % 4 === 0 ? "2026-10-01" : "2027-03-21",
    access: "داخلی",
    body: "پیش از آغاز هر فاز، مسئول خروجی و معیار پذیرش مشخص شود. مرور هفتگی ریسک‌ها با حضور ذی‌نفعان از دوباره‌کاری جلوگیری می‌کند.",
    status: i < 14 ? "published" : "draft",
    views: i * 3,
    viewers: i ? ["p1", "p2"] : [],
    attachments: [],
    ...(i % 3 === 0
      ? {
          aar: {
            intended: "تحویل فاز نخست در زمان برنامه",
            actual: "تأخیر به علت ابهام در وابستگی‌ها",
            reasons: "مالک تصمیم مشخص نبود",
            lessons: "تعیین مسئول پیش از شروع",
            action: "تدوین ماتریس مسئولیت",
            responsible: names[i],
            due: "2026-12-21",
            done: false,
          },
        }
      : {}),
  }));
  return seedDemoTalentHistory(hydrateTalentHistory(hydrateOrganization({
    schema: 1,
    jobs,
    people,
    roleAssignments: {}, // hydrated with prior demo grants; newly hired people get the basic roles
    performanceReviews: [],
    questions: defaultEvaluationQuestions(),
    entryQuestions: defaultEntryQuestions(jobs),
    entryEvaluatorGroups: defaultEntryEvaluatorGroups(jobs),
    entryCommitteeMembers: [
      { stage: "general", personId: "p3" }, { stage: "general", personId: "p4" },
      { stage: "specialist", personId: "p5" }, { stage: "specialist", personId: "p6" },
    ],
    developmentTemplates: defaultDevelopmentTemplates(),
    candidates: [
      {
        id: "cand1", name: "تارا ساعی", jobId: "j1", createdAt: "2026-10-10T09:00:00.000Z",
        assessments: [{
          id: "entry1", scores: [4, 3, 4, 4, 3], potential: "high",
          evidence: "تحلیل یک موقعیت واقعی مدیریت پروژه و مثال رفتاری مستند از تجربه کار تیمی",
          potentialReason: "پذیرش بازخورد و توان یادگیری و حل مسئله در موقعیت جدید؛ تأیید کیفی ارزیاب",
          assessor: "کارشناس منابع انسانی", evaluatedAt: "2026-10-11T10:00:00.000Z",
        }],
      },
      {
        id: "cand2", name: "بهزاد پویش", jobId: "j9", createdAt: "2026-10-12T08:30:00.000Z",
        assessments: [],
      },
    ],
    cycles,
    campaigns: [],
    plans,
    knowledge,
    positions: Array.from({ length: 15 }, (_, i) => ({
      id: `pos${i + 1}`,
      title: `${titles[i % 10]} — ${units[i % 5]}`,
      jobId: `j${(i % 10) + 1}`,
      holderId: `p${i + 11}`,
      unit: jobs[i % 10].unit,
      critical: i < 5,
      reason: "تداوم تحویل و حفظ دانش کلیدی سازمان",
      probability: (i % 3) + 1,
      impact: 3,
      months: 6 + i,
    })),
    prospectiveIndicators: defaultProspectiveIndicators(),
    prospectiveQuestions: defaultProspectiveQuestions(),
    prospectiveRuns: [],
    nominations: Array.from({ length: 10 }, (_, i) => ({
      id: `n${i + 1}`,
      personId: `p${i + 1}`,
      positionId: i < 3 ? "pos1" : `pos${(i % 5) + 1}`,
      readiness: i === 4 ? "A" : i % 2 ? "B" : "C",
      evidence: "بررسی شواهد شایستگی؛ نیازمند تکمیل تجربه راهبری",
      at: "2026-10-16",
    })),
    paths: [
      {
        from: "j7",
        to: "j8",
        criteria: "تجربه هدایت یک تیم و دو خروجی قابل اندازه‌گیری",
      },
      { from: "j8", to: "j1", criteria: "مدیریت بودجه، هدایت تیم و نظر کمیته" },
      { from: "j9", to: "j4", criteria: "تجربه طراحی سیستم و راهبری تیم فنی" },
    ],
    audit: [],
    syncs: [],
  } as unknown as DemoState),new Date().toISOString()));
}
