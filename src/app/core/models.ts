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
/** Dated position in the nine-box matrix, recorded automatically by Store commits.
 * Historical backdating of a current-only baseline is forbidden. */
export interface TalentPositionEvent {
  id:string;
  personId:string;
  at:string;
  performance:Band|null;
  potential:Band|null;
  unit:string;
  source:"baseline"|"change";
  action?:string;
}
/** A period's documented results are separate from 360/540 competency assessments. */
export interface PerformanceKpiResult {
  title: string;
  definition: string;
  unit: string;
  source: string;
  /** Reviewed percentage of target achievement for this KPI (0-100). */
  achievement: number;
  evidence: string;
}
export interface PerformanceReview {
  id: string;
  personId: string;
  jobId: string;
  jobVersion: number;
  period: string;
  kpis: PerformanceKpiResult[];
  /** Equal-weight mean of documented KPI attainment, rounded to an integer. */
  score: number;
  band: Band;
  status: "draft" | "approved";
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}
export interface PerformanceKpiInput {
  title: string;
  achievement: number;
  evidence: string;
}
/** Entry assessment uses the same five competencies as Job and 360/540,
 * but keeps an independent question bank and immutable referred questionnaires. */
export type EntryCommitteeStage = "general" | "specialist";
export interface EntryQuestion {
  id: string;
  stage: EntryCommitteeStage;
  /** Null means organization-wide; specialist questions are job-specific. */
  jobId: string | null;
  text: string;
  competencyIndex: number;
  order: number;
  isActive: boolean;
}
/** HR-defined, reusable specialist evaluators for several published job profiles. */
export interface EntryEvaluatorGroup {
  id: string;
  name: string;
  jobIds: string[];
  memberIds: string[];
  isActive: boolean;
}
export interface EntryCommitteeAssignment {
  assignedTo: string;
  answers?: QuestionAnswer[];
  scores?: number[];
  evidence?: string;
  completedAt?: string;
}
export interface EntryCommitteeReview {
  stage: EntryCommitteeStage;
  /** Legacy undefined means a questionnaire-based review. */
  method?: "questionnaire" | "manual";
  /** For a manual general assessment: the HR person who entered the scores. */
  enteredBy?: string;
  assignedTo: string;
  assignedAt: string;
  questions: EntryQuestion[];
  /** Snapshot of the selected specialist group; old reviews have neither field. */
  groupId?: string;
  groupName?: string;
  assignments?: EntryCommitteeAssignment[];
  answers?: QuestionAnswer[];
  scores?: number[];
  evidence?: string;
  completedAt?: string;
}
export interface EntryWorkflow {
  general: EntryCommitteeReview;
  specialist?: EntryCommitteeReview;
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
  /** Legacy manually recorded entries retain their original model. */
  source?: "legacy" | "committees";
  /** Snapshot of general-stage method; older committee assessments used questionnaires. */
  generalMethod?: "questionnaire" | "manual";
  generalReviewAt?: string;
  specialistReviewAt?: string;
}
export interface Candidate {
  id: string;
  name: string;
  jobId: string;
  createdAt: string;
  assessments: EntryAssessment[];
  /** Absent on previous browser data; the older assessment remains readable. */
  entryWorkflow?: EntryWorkflow;
  decision?: {
    outcome: HiringOutcome;
    reason: string;
    reviewer: string;
    decidedAt: string;
    /** Employee exists only after a positive HR decision. */
    personId?: string;
  };
}
/** Evidence-backed review of turnover risk for a particular staffing appointment. */
export interface PositionRiskReview {
  assessedAt: string;
  assessedBy: string;
  appointmentIdAtReview: string;
  horizonMonths: 12;
  probabilityEvidence: string;
  impactEvidence: string;
  replacementBasis: string;
  mitigationAction: string;
}

export interface PositionRiskInput {
  probability: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  months: number;
  reason: string;
  probabilityEvidence: string;
  impactEvidence: string;
  replacementBasis: string;
  mitigationAction: string;
}

export interface Position {
  id: string;
  title: string;
  jobId: string;
  /** Compatibility snapshot for saved demos; staffing comes from appointments. */
  holderId: string;
  /** Compatibility label, organizational placement is unitId. */
  unit: string;
  code?: string;
  unitId?: string;
  locationId?: string;
  parentPositionId?: string | null;
  isActive?: boolean;
  critical: boolean;
  reason: string;
  probability: number;
  impact: number;
  months: number;
  /** Missing on old/seed records: numeric defaults do not count as an assessment. */
  riskReview?: PositionRiskReview;
}
/** Organization structure is independent of job descriptions. */
export interface OrganizationUnit {
  id: string;
  code: string;
  name: string;
  parentUnitId: string | null;
  isActive: boolean;
}
export interface WorkLocation {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
/** Effective-dated staffing record. Historical plans and assessments keep job snapshots. */
export interface PositionAppointment {
  id: string;
  personId: string;
  positionId: string;
  type: "primary" | "acting";
  effectiveFrom: string;
  effectiveTo: string | null;
  referenceNo: string;
  note: string;
}
export interface EvaluationQuestion {
  id: string;
  group: Group;
  text: string;
  /** Index in the five shared competency dimensions. */
  competencyIndex: number;
  order: number;
  isActive: boolean;
}
export interface QuestionAnswer {
  questionId: string;
  score: number;
}
export interface Assignment {
  id: string;
  personId: string;
  group: Group;
  /** Old browser cycles may have five fixed scores. */
  scores?: number[];
  /** New cycles keep one rating for every assigned question id. */
  answers?: QuestionAnswer[];
}
export interface Cycle {
  /** Missing for historical, manually created evaluations. */
  campaignId?: string;
  /** Dynamic minimums for chart-generated groups; legacy cycles retain their old rule. */
  requiredGroups?: Partial<Record<Group, number>>;
  /** Frozen reporting context when this cycle was published. */
  organizationSnapshot?: {
    asOf: string; positionId: string; unitId: string;
    locationId: string; managerId?: string;
  };
  id: string;
  title: string;
  period: string;
  subjectId: string;
  jobId: string;
  mode: 360 | 540;
  status: "preparing" | "collecting" | "calibration" | "feedback" | "closed";
  assignments: Assignment[];
  /** Immutable active questionnaire at the start of collection. Missing in legacy cycles. */
  questions?: EvaluationQuestion[];
  notes: string;
  created: string;
}
import type { DevelopmentTemplate } from "./development-templates";
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
  /** Person responsible for execution, independent of the IDP subject. */
  assigneeId?: string;
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
/** Organization-wide forward-looking dimensions; never tied to a job profile. */
export interface ProspectiveIndicator {
  id: string; title: string; description: string; order: number; isActive: boolean;
}
export interface ProspectiveQuestion {
  id: string; indicatorId: string; text: string; order: number; isActive: boolean;
}
export interface ProspectiveNomineeSnapshot {
  nominationId: string; personId: string; personName: string;
  readiness: "A" | "B" | "C"; nominationEvidence: string; nominatedAt: string;
}
export interface ProspectiveResult {
  personId: string;
  answers: QuestionAnswer[];
  evidence: string;
  indicatorScores: {indicatorId: string; score: number}[];
  score: number;
  completedAt: string; completedBy: string;
}
/** One immutable roster and questionnaire per target POSITION (not job). */
export interface ProspectiveEvaluationRun {
  id: string; positionId: string; jobId: string; positionTitle: string;
  startedAt: string; startedBy: string;
  status: "active" | "closed"; closedAt?: string;
  indicators: ProspectiveIndicator[];
  questions: ProspectiveQuestion[];
  nominees: ProspectiveNomineeSnapshot[];
  results: ProspectiveResult[];
}
export interface Audit {
  id: string;
  at: string;
  role: Role;
  action: string;
  entity: string;
}
export type CampaignScope = {
  type: "all" | "unit" | "job" | "people";
  /** IDs of selected organization units, jobs, or people respectively. */
  ids: string[];
};
/** One HR-run period whose individual Cycle records remain compatible with old reports. */
export interface EvaluationCampaign {
  id: string;
  title: string;
  period: string;
  asOf: string;
  mode: 360 | 540;
  scope: CampaignScope;
  status: "draft" | "active" | "closed";
  createdAt: string;
  createdBy: string;
  startedAt?: string;
  /** Creation-time exceptions remain visible for audit and follow-up. */
  exclusions: { personId: string; reason: string }[];
}
export interface DemoState {
  schema: 1;
  jobs: Job[];
  people: Person[];
  /** Roles granted per person; legacy browser data is migrated from default demo grants. */
  roleAssignments: Record<string, Role[]>;
  /** Optional in older browser snapshots; normalized to [] when restored. */
  performanceReviews: PerformanceReview[];
  /** Optional in saved v1 snapshots; hydrated from today's known state. */
  talentHistory: TalentPositionEvent[];
  /** Restored from an empty array for browser snapshots predating hiring. */
  candidates: Candidate[];
  /** Separate scoped bank; 360/540 questions remain unchanged. */
  entryQuestions: EntryQuestion[];
  /** HR-managed membership in the two interview committees. */
  entryCommitteeMembers: { stage: EntryCommitteeStage; personId: string }[];
  /** Optional in legacy snapshots; HR-managed group definitions for specialist referrals. */
  entryEvaluatorGroups: EntryEvaluatorGroup[];
  positions: Position[];
  organizationUnits: OrganizationUnit[];
  workLocations: WorkLocation[];
  appointments: PositionAppointment[];
  cycles: Cycle[];
  /** Empty for old browser snapshots; never fabricate campaigns for legacy cycles. */
  campaigns: EvaluationCampaign[];
  questions: EvaluationQuestion[];
  /** Editable action templates, keyed by competency index. */
  developmentTemplates: DevelopmentTemplate[];
  plans: Plan[];
  knowledge: Knowledge[];
  nominations: Nomination[];
  /** Optional in old snapshots; keep the existing schema and LocalStorage key. */
  prospectiveIndicators: ProspectiveIndicator[];
  prospectiveQuestions: ProspectiveQuestion[];
  prospectiveRuns: ProspectiveEvaluationRun[];
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
