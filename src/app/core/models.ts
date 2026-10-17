export type Role =
  "hr" | "executive" | "manager" | "owner" | "evaluator" | "employee";
export type Band = "low" | "medium" | "high";
export type Group = "supervisor" | "peer" | "subordinate" | "external";
export interface Kpi {
  title: string;
  definition: string;
  formula: string;
  unit: string;
  frequency: string;
  source: string;
  owner: string;
}
export interface JobContent {
  title: string;
  family: string;
  unit: string;
  level: string;
  mission: string;
  tasks: { id: string; title: string; output: string }[];
  kpis: Kpi[];
  expected: number[];
  skills: string;
  qualifications: string;
  hse: string;
  owner: string;
}
export interface Job extends JobContent {
  id: string;
  code: string;
  version: number;
  revised: string;
  draft?: JobContent;
  review: "published" | "draft" | "review" | "rejected";
  history: { version: number; at: string; summary: string }[];
}
export interface Person {
  id: string;
  name: string;
  code: string;
  unit: string;
  jobId: string;
  managerId: string;
  /** Null until an actual on-the-job performance / potential review exists. */
  performance: Band | null;
  potential: Band | null;
  /** Initial entry competency results may be the first observed baseline. */
  entry?: { candidateId: string; assessmentId: string; hiredAt: string; potentialReviewedAt: string };
  observed: number[];
  evidence: string;
}
export type HiringOutcome = "hired" | "declined";
export interface EntryAssessment {
  id: string;
  /** Competencies follow the job-profile's five competency dimensions. */
  scores: number[];
  /** Human-reviewed potential, not computed from mean competency scores. */
  potential: Band;
  evidence: string;
  potentialReason: string;
  assessor: string;
  evaluatedAt: string;
}
export interface Candidate {
  id: string;
  name: string;
  jobId: string;
  createdAt: string;
  assessments: EntryAssessment[];
  decision?: {
    outcome: HiringOutcome;
    reason: string;
    reviewer: string;
    decidedAt: string;
    /** Employee exists only after a positive HR decision. */
    personId?: string;
  };
}
export interface Position {
  id: string;
  title: string;
  jobId: string;
  holderId: string;
  unit: string;
  critical: boolean;
  reason: string;
  probability: number;
  impact: number;
  months: number;
}
export interface Assignment {
  id: string;
  personId: string;
  group: Group;
  scores?: number[];
}
export interface Cycle {
  id: string;
  title: string;
  period: string;
  subjectId: string;
  jobId: string;
  mode: 360 | 540;
  status: "preparing" | "collecting" | "calibration" | "feedback" | "closed";
  assignments: Assignment[];
  notes: string;
  created: string;
}
export type EffectivenessOutcome = "effective" | "partial" | "ineffective";
export interface EffectivenessReview {
  outcome: EffectivenessOutcome;
  note: string;
  reviewer: string;
  reviewedAt: string;
}
export interface Action {
  id: string;
  competency: number;
  title: string;
  kind: string;
  owner: string;
  due: string;
  indicator: string;
  status: "planned" | "progress" | "completed" | "blocked" | "cancelled";
  /** Optional fields preserve previously saved browser plans. */
  templateId?: string;
  evidence?: string;
  effectiveness?: EffectivenessReview;
}
export interface Plan {
  id: string;
  personId: string;
  jobId: string;
  /** Published evaluation source; omitted for plans created directly from a profile. */
  cycleId?: string;
  period: string;
  /** Optional for plans saved in older versions of the browser store. */
  version?: number;
  createdAt?: string;
  /** Immutable competency baseline captured when this version was created. */
  baseline?: {
    expected: number[];
    observed: number[];
    gaps: number[];
  };
  actions: Action[];
}
export interface Knowledge {
  id: string;
  title: string;
  kind: string;
  jobId: string;
  taskId: string;
  tags: string;
  owner: string;
  revision: string;
  access: string;
  body: string;
  status: "draft" | "review" | "published" | "archived";
  views: number;
  viewers: string[];
  aar?: {
    intended: string;
    actual: string;
    reasons: string;
    lessons: string;
    action: string;
    responsible: string;
    due: string;
    done: boolean;
  };
  attachments: string[];
}
export interface Nomination {
  id: string;
  personId: string;
  positionId: string;
  readiness: "A" | "B" | "C";
  evidence: string;
  at: string;
}
export interface Audit {
  id: string;
  at: string;
  role: Role;
  action: string;
  entity: string;
}
export interface DemoState {
  schema: 1;
  jobs: Job[];
  people: Person[];
  /** Restored from an empty array for browser snapshots predating hiring. */
  candidates: Candidate[];
  positions: Position[];
  cycles: Cycle[];
  plans: Plan[];
  knowledge: Knowledge[];
  nominations: Nomination[];
  paths: { from: string; to: string; criteria: string }[];
  audit: Audit[];
  syncs: { at: string; rows: number; summary: string }[];
}
export const competencies = [
  "ارتباط مؤثر",
  "همکاری تیمی",
  "حل مسئله",
  "پاسخگویی",
  "هدایت تیم",
];
export const groups: Record<Group, string> = {
  supervisor: "سرپرست",
  peer: "هم‌سطح",
  subordinate: "زیردست",
  external: "ذی‌نفع بیرونی",
};
export const roles: Record<Role, string> = {
  hr: "کارشناس منابع انسانی",
  executive: "مدیرعامل",
  manager: "مدیر واحد",
  owner: "مالک خانواده شغلی",
  evaluator: "ارزیاب",
  employee: "کارمند",
};
export const bands: Record<Band, string> = {
  low: "نیازمند رشد",
  medium: "متوسط",
  high: "بالا",
};
export const statusLabels: Record<string, string> = {
  published: "منتشرشده",
  draft: "پیش‌نویس",
  review: "در انتظار تأیید",
  rejected: "نیازمند اصلاح",
  preparing: "آماده‌سازی",
  collecting: "دریافت پاسخ",
  calibration: "کالیبراسیون",
  feedback: "آماده بازخورد",
  closed: "بسته‌شده",
  planned: "برنامه‌ریزی",
  progress: "در حال انجام",
  completed: "انجام‌شده",
  blocked: "متوقف",
  cancelled: "لغوشده",
  archived: "بایگانی",
};
