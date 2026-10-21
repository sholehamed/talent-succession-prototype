import { Injectable, computed, signal } from "@angular/core";
import {
  Action,
  Band,
  Candidate,
  CampaignScope,
  Cycle,
  EvaluationCampaign,
  DemoState,
  EffectivenessOutcome,
  EvaluationQuestion,
  EntryQuestion,
  EntryCommitteeStage,
  EntryEvaluatorGroup,
  QuestionAnswer,
  Assignment,
  Group,
  JobContent,
  Job,
  Knowledge,
  Nomination,
  ProspectiveIndicator, ProspectiveQuestion, ProspectiveEvaluationRun,
  OrganizationUnit,
  WorkLocation,
  Position,
  PositionRiskInput,
  PositionAppointment,
  Plan,
  PerformanceKpiInput,
  PerformanceReview,
  Role,
  competencies,
} from "./models";
import { activeProspectiveBank, defaultProspectiveIndicators, defaultProspectiveQuestions, prospectiveSnapshotError, scoreProspectiveAnswers } from "./prospective";
import { seed } from "./seed";
import {
  hydrateOrganization, appointmentOn, positionOf, positionHolder, managerOf,
  directReports, organizationTree, validDay,
} from "./organization";
import {
  saveLocation, saveUnit, savePosition, assignPosition, finishAppointment, projectStaffing,
} from "./organization-actions";
import { performanceBand, performanceScore } from "./performance";
import { captureTalentChanges, hydrateTalentHistory } from "./talent-history";
import { assessPositionRisk, validatePositionRiskInput } from "./position-risk";
import { campaignCycle, campaignPreview } from "./evaluation-campaigns";
import { DEFAULT_PASSWORD, SESSION_KEY, homeForRole, roleOrder } from "./auth";
import { defaultEvaluationQuestions, legacyCycleQuestions, orderedQuestions, validateQuestionBank } from "./evaluation-questions";
import { activeEntryQuestions, combinedEntryScores, defaultEntryQuestions, defaultEntryEvaluatorGroups, entryBankError, entryScores, specialistReferral } from "./entry-committees";
import { DevelopmentTemplate, defaultDevelopmentTemplates, templatesForCompetency } from "./development-templates";
import {
  aggregate,
  canStart,
  gap,
  progress,
  validateJob,
  validScores,
  validQuestionAnswers,
} from "./domain";
const KEY = "royesh.demo.v1";
@Injectable({ providedIn: "root" })
export class Store {
  /** The browser starts signed out; Vitest's Node environment uses its legacy HR fixture. */
  private readonly startingSession = this.readSession();
  readonly actor = signal(this.startingSession?.id ?? (typeof window === "undefined" ? "p1" : ""));
  readonly role = signal<Role>(this.startingSession?.role ?? "hr");
  readonly authenticated = computed(() =>
    !!this.actor() && this.state().people.some((p) => p.id === this.actor()));
  readonly currentPerson = computed(() => this.state().people.find((p) => p.id === this.actor()));
  /** All permissions derive from persisted person grants, never a hardcoded ID list. */
  rolesOf(personId: string): Role[] {
    return this.state().roleAssignments[personId] ?? [];
  }
  readonly permittedRoles = computed(() =>
    this.authenticated() ? this.rolesOf(this.actor()) : []);
  readonly activeRoleAllowed = computed(() => this.authenticated() &&
    (this.permittedRoles().includes(this.role()) || typeof window === "undefined"));
  readonly assignedActions = computed(() => this.state().plans.flatMap((plan) =>
    plan.actions.filter((a) => this.actionAssigneeId(plan, a) === this.actor())
      .map((action) => ({ plan, action }))));
  private readSession(): { id: string; role: Role } | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const value = JSON.parse(stored);
      if (typeof value.id !== "string" || !roleOrder.includes(value.role))
        return null;
      return value;
    } catch { return null; }
  }
  private persistSession() {
    try {
      if (typeof window !== "undefined") {
        if (this.actor()) sessionStorage.setItem(SESSION_KEY,
          JSON.stringify({ id: this.actor(), role: this.role() }));
        else sessionStorage.removeItem(SESSION_KEY);
      }
    } catch { this.storageWarning.set("نشست در مرورگر قابل نگهداری نیست."); }
  }
  constructor() {
    // Persist the first observed baseline immediately, even if the user only views
    // the matrix. Otherwise a future reload would move the baseline forward.
    if (typeof window !== "undefined") {
      try {
        const raw=localStorage.getItem(KEY);
        const persisted=raw?JSON.parse(raw):null;
        const saved=Array.isArray(persisted?.talentHistory)?persisted.talentHistory:[];
        if (saved.length!==this.state().talentHistory.length)
          localStorage.setItem(KEY,JSON.stringify(this.state()));
      } catch {
        this.storageWarning.set("ذخیره نخستین وضعیت تاریخی در مرورگر ممکن نشد.");
      }
    }
    // Validate persisted sessions against current grants after the Store is hydrated.
    if (this.actor() && !this.rolesOf(this.actor()).includes(this.role())) {
      const fallback = this.rolesOf(this.actor())[0];
      if (fallback) this.role.set(fallback);
      else { this.actor.set(""); this.role.set("employee"); }
      this.persistSession();
    }
  }
  login(id: string, password: string) {
    const normalized = id.trim();
    const person = this.state().people.find((p) => p.id === normalized);
    if (!person || password !== DEFAULT_PASSWORD)
      return this.fail("شناسه کاربری یا رمز عبور صحیح نیست.");
    this.actor.set(person.id);
    const preferred: Role[] = ["hr", "executive", "manager", "owner"];
    this.role.set(preferred.find(role => this.rolesOf(person.id).includes(role))
      ?? this.rolesOf(person.id)[0] ?? "employee");
    this.persistSession();
    this.notice.set("");
    return true;
  }
  logout() {
    this.actor.set("");
    this.role.set("employee");
    this.persistSession();
    this.notice.set("");
  }
  switchRole(role: Role) {
    if (!this.authenticated() || !this.permittedRoles().includes(role))
      return this.fail("این نقش به حساب شما اختصاص داده نشده است.");
    this.role.set(role);
    this.persistSession();
    return true;
  }
  /**
   * HR-only role assignment. Replace the person's full role set atomically.
   * Keep one role, block self-revocation of HR and protect the last HR account.
   */
  setPersonRoles(personId: string, requested: Role[]): boolean {
    if (!this.canAccess(["hr"]))
      return this.fail("مدیریت نقش‌های کاربران فقط برای منابع انسانی مجاز است.");
    if (!this.state().people.some(p => p.id === personId) || !Array.isArray(requested) ||
      !requested.length || requested.some(role => !roleOrder.includes(role)))
      return this.fail("فرد و حداقل یک نقش معتبر الزامی هستند.");
    const next = roleOrder.filter(role => requested.includes(role));
    if (personId === this.actor() && !next.includes("hr"))
      return this.fail("برای جلوگیری از قطع دسترسی، امکان حذف نقش منابع انسانی از حساب فعلی وجود ندارد.");
    if (this.rolesOf(personId).includes("hr") && !next.includes("hr") &&
      !this.state().people.some(p => p.id !== personId && this.rolesOf(p.id).includes("hr")))
      return this.fail("حذف آخرین کاربر منابع انسانی مجاز نیست.");
    if (JSON.stringify(next) === JSON.stringify(this.rolesOf(personId))) return true;
    this.commit("نقش‌های کاربر تغییر کرد", personId, state => {
      state.roleAssignments[personId] = next;
    });
    if (personId === this.actor() && !next.includes(this.role())) {
      this.role.set(next[0]); this.persistSession();
    }
    return true;
  }
  home() { return homeForRole(this.role(), this.actor()); }
  canAccess(roles?: Role[]) {
    return this.activeRoleAllowed() && (!roles || roles.includes(this.role()));
  }

  readonly notice = signal("");
  readonly storageWarning = signal("");
  readonly state = signal<DemoState>(this.restore());
  /** Only a published version can be used for hiring, evaluation, career paths or staffing. */
  readonly publishedJobs = computed(() => this.state().jobs.filter((j) => j.version > 0));
  readonly units = computed(() => [
    ...new Set([
      ...this.state().organizationUnits.filter((u) => u.isActive).map((u) => u.name),
      ...this.state().jobs.map((j) => j.unit),
      ...this.state().people.map((p) => p.unit),
    ]),
  ]);
  readonly editable = computed(() => this.activeRoleAllowed() && ["hr", "manager"].includes(this.role()));
  readonly canReport = computed(() => this.activeRoleAllowed() &&
    ["hr", "manager", "executive", "employee"].includes(this.role()),
  );
  readonly canApprove = computed(() => this.activeRoleAllowed() && this.role() === "owner");
  restore(): DemoState {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (
          d.schema === 1 &&
          [
            "jobs",
            "people",
            "positions",
            "cycles",
            "plans",
            "knowledge",
            "nominations",
            "paths",
            "audit",
            "syncs",
          ].every((k) => Array.isArray(d[k])) &&
          d.jobs.every(
            (j: any) =>
              Array.isArray(j.expected) &&
              Array.isArray(j.tasks) &&
              Array.isArray(j.kpis),
          ) &&
          d.cycles.every((c: any) => Array.isArray(c.assignments)) &&
          d.plans.every((p: any) => Array.isArray(p.actions))
        )
          return hydrateTalentHistory(hydrateOrganization({ ...d,
            performanceReviews: Array.isArray(d.performanceReviews) ? d.performanceReviews : [],
            talentHistory: Array.isArray(d.talentHistory) ? d.talentHistory : [],
            campaigns: Array.isArray(d.campaigns) ? d.campaigns : [],
            candidates: Array.isArray(d.candidates) ? d.candidates : [],
            prospectiveIndicators: Array.isArray(d.prospectiveIndicators)
              ? d.prospectiveIndicators : defaultProspectiveIndicators(),
            prospectiveQuestions: Array.isArray(d.prospectiveQuestions)
              ? d.prospectiveQuestions : defaultProspectiveQuestions(),
            prospectiveRuns: Array.isArray(d.prospectiveRuns) ? d.prospectiveRuns : [],
            questions: Array.isArray(d.questions) ? d.questions : defaultEvaluationQuestions(),
            entryQuestions: Array.isArray(d.entryQuestions) ? d.entryQuestions : defaultEntryQuestions(d.jobs),
            entryEvaluatorGroups: Array.isArray(d.entryEvaluatorGroups) ? d.entryEvaluatorGroups
              : defaultEntryEvaluatorGroups(d.jobs,
                Array.isArray(d.entryCommitteeMembers)
                  ? d.entryCommitteeMembers.filter((m: {stage: string; personId: string}) =>
                      m.stage === "specialist" && d.people.some((p: {id: string}) => p.id === m.personId))
                    .map((m: {personId: string}) => m.personId)
                  : ["p5", "p6"]),
            entryCommitteeMembers: Array.isArray(d.entryCommitteeMembers) ? d.entryCommitteeMembers : [
              { stage: "general", personId: "p3" }, { stage: "general", personId: "p4" },
              { stage: "specialist", personId: "p5" }, { stage: "specialist", personId: "p6" },
            ],
            developmentTemplates: Array.isArray(d.developmentTemplates)
              ? d.developmentTemplates.map((t: DevelopmentTemplate) => ({ ...t, isActive: t.isActive !== false }))
              : defaultDevelopmentTemplates(),
          }),new Date().toISOString());
        this.storageWarning.set(
          "اطلاعات ذخیره‌شده ناسازگار بود؛ وضعیت اولیه بازیابی شد.",
        );
      }
    } catch {
      this.storageWarning.set(
        "اطلاعات مرورگر قابل خواندن نیست؛ وضعیت اولیه بارگذاری شد.",
      );
    }
    return seed();
  }
  commit(action: string, entity: string, mutate: (s: DemoState) => void) {
    const before=this.state();
    const s = structuredClone(before);
    mutate(s);
    const at=new Date().toISOString();
    captureTalentChanges(before,s,at,action);
    s.audit.unshift({
      id: crypto.randomUUID(),
      at,
      role: this.role(),
      action,
      entity,
    });
    s.audit = s.audit.slice(0, 250);
    this.state.set(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      this.storageWarning.set(
        "ذخیره مرورگر در دسترس نیست؛ تغییرات فقط تا بستن صفحه باقی می‌مانند.",
      );
    }
    this.notice.set(action);
  }
  fail(message: string) {
    this.notice.set(message);
    return false;
  }
  person(id: string) {
    return this.state().people.find((p) => p.id === id)!;
  }
  job(id: string) {
    return this.state().jobs.find((j) => j.id === id)!;
  }
  cycle(id: string) {
    return this.state().cycles.find((c) => c.id === id);
  }
  /** Canonical staffing navigation; existing plans/evaluations retain their historical jobId. */
  currentAppointment(personId: string, date?: string) { return appointmentOn(this.state(), personId, date); }
  currentPosition(personId: string, date?: string) { return positionOf(this.state(), personId, date); }
  currentPositionHolder(positionId: string, date?: string) { return positionHolder(this.state(), positionId, date); }
  positionRecord(id: string) { return this.state().positions.find((p) => p.id === id); }
  currentJob(personId: string, date?: string) {
    const p = this.currentPosition(personId, date);
    return this.state().jobs.find((j) => j.id === p?.jobId);
  }
  currentUnit(personId: string, date?: string) {
    const p = this.currentPosition(personId, date);
    return this.state().organizationUnits.find((u) => u.id === p?.unitId);
  }
  currentLocation(personId: string, date?: string) {
    const p = this.currentPosition(personId, date);
    return this.state().workLocations.find((l) => l.id === p?.locationId);
  }
  currentManager(personId: string, date?: string) { return managerOf(this.state(), personId, date); }
  directReports(personId: string, date?: string) { return directReports(this.state(), personId, date); }
  subordinateIds(personId: string) {
    const seen = new Set([personId]), result: string[] = [];
    const pending = [personId];
    while (pending.length) {
      for (const person of this.directReports(pending.shift()!)) {
        if (seen.has(person.id)) continue;
        seen.add(person.id); result.push(person.id); pending.push(person.id);
      }
    }
    return result;
  }
  positionTree() { return organizationTree(this.state().positions); }
  vacantPositions(jobId?: string, date = new Date().toISOString().slice(0, 10)) {
    return this.state().positions.filter((p) =>
      p.isActive !== false && (!jobId || p.jobId === jobId) && !this.currentPositionHolder(p.id, date));
  }
  /**
   * Hiring creates an open-ended primary appointment. Unlike vacancies on one
   * particular day, a hireable post must remain unreserved from the start date
   * onwards. Do not offer posts with a future booked appointment.
   */
  hireablePositions(jobId: string, effectiveFrom: string) {
    if (!validDay(effectiveFrom)) return [];
    return this.state().positions.filter((p) =>
      p.isActive !== false && p.jobId === jobId &&
      !this.state().appointments.some((a) =>
        a.type === "primary" && a.positionId === p.id &&
        (!a.effectiveTo || a.effectiveTo >= effectiveFrom)));
  }
  canManageOrganization() { return this.canAccess(["hr"]); }
  /** Apply a validated mutation inside the existing audit + LocalStorage commit flow. */
  private orgMutation(action: string, entity: string, change: (draft: DemoState) => string) {
    if (!this.canManageOrganization()) return this.fail("مدیریت تشکیلات فقط برای منابع انسانی مجاز است.");
    const next = structuredClone(this.state());
    const error = change(next);
    if (error) return this.fail(error);
    this.commit(action, entity, (state) => {
      state.organizationUnits = next.organizationUnits;
      state.workLocations = next.workLocations;
      state.positions = next.positions;
      state.appointments = next.appointments;
      state.people = next.people;
    });
    return true;
  }
  saveWorkLocation(value: WorkLocation) {
    const id = value.id || crypto.randomUUID();
    return this.orgMutation("محل خدمت ثبت شد", id, (s) => saveLocation(s, {...value, id}));
  }
  saveOrganizationUnit(value: OrganizationUnit) {
    const id = value.id || crypto.randomUUID();
    return this.orgMutation("واحد سازمانی ثبت شد", id, (s) => saveUnit(s, {...value, id}));
  }
  saveOrganizationPosition(value: Position) {
    const id = value.id || crypto.randomUUID();
    return this.orgMutation("پست سازمانی ثبت شد", id, (s) => savePosition(s, {...value, id}));
  }
  canReviewPositionRisk(positionId: string): boolean {
    if (!this.canAccess(["hr", "manager"])) return false;
    const p = this.positionRecord(positionId);
    if (!p || p.isActive === false || !p.critical) return false;
    return this.role() === "hr" || (!!p.unitId &&
      p.unitId === this.currentUnit(this.actor())?.id);
  }
  positionRisk(positionId: string) {
    return assessPositionRisk(this.state(), positionId);
  }
  savePositionRisk(positionId: string, input: PositionRiskInput): boolean {
    if (!this.canReviewPositionRisk(positionId))
      return this.fail("ثبت ریسک این پست برای نقش یا واحد شما مجاز نیست.");
    const error = validatePositionRiskInput(input);
    if (error) return this.fail(error);
    const appointment = this.state().appointments.find(a =>
      a.type === "primary" && a.positionId === positionId &&
      a.effectiveFrom <= new Date().toISOString().slice(0, 10) &&
      (!a.effectiveTo || a.effectiveTo >= new Date().toISOString().slice(0, 10)));
    if (!appointment) return this.fail("این پست متصدی جاری ندارد؛ احتمال خروج قابل ارزیابی نیست.");
    const now = new Date().toISOString();
    this.commit("ارزیابی ریسک پست ثبت شد", positionId, s => {
      const p = s.positions.find(x => x.id === positionId)!;
      p.probability = input.probability;
      p.impact = input.impact;
      p.months = input.months;
      p.reason = input.reason.trim();
      p.riskReview = {
        assessedAt: now,
        assessedBy: this.actor(),
        appointmentIdAtReview: appointment.id,
        horizonMonths: 12,
        probabilityEvidence: input.probabilityEvidence.trim(),
        impactEvidence: input.impactEvidence.trim(),
        replacementBasis: input.replacementBasis.trim(),
        mitigationAction: input.mitigationAction.trim(),
      };
    });
    return true;
  }
  appointPerson(personId: string, positionId: string, effectiveFrom: string,
    referenceNo = "", note = "") {
    const id = crypto.randomUUID();
    const value: PositionAppointment = {
      id, personId, positionId, type: "primary", effectiveFrom,
      effectiveTo: null, referenceNo, note,
    };
    return this.orgMutation("انتصاب ثبت شد", positionId, (s) => assignPosition(s, value)) ? id : "";
  }
  endPositionAppointment(id: string, day: string) {
    return this.orgMutation("انتصاب پایان یافت", id, (s) => finishAppointment(s, id, day));
  }

  /** Person-aware access: managers see their own unit; staff see themselves. */
  allowedPerson(id: string) {
    if (!this.activeRoleAllowed()) return false;
    if (this.role() === "hr" || this.role() === "executive") return true;
    if (id === this.actor()) return true;
    if (this.role() === "manager") {
      return this.subordinateIds(this.actor()).includes(id);
    }
    return false;
  }
  actionAssigneeId(plan: {personId: string}, action: Action) {
    if (action.assigneeId) return action.assigneeId;
    return this.state().people.find((p) => p.name === action.owner)?.id ??
      (action.owner === "مدیر مستقیم"
        ? this.currentManager(plan.personId)?.id
        : undefined);
  }
  canEditAction(plan: Plan, action: Action) {
    if (!this.activeRoleAllowed() || !this.isCurrentPlan(plan) || !!action.effectiveness)
      return false;
    return this.role() === "employee"
      ? this.actionAssigneeId(plan, action) === this.actor()
      : this.editable() && this.allowedPerson(plan.personId);
  }
  /**
   * People linked to a target job through their current job, a succession
   * nomination, or a feeder job in the configured career paths.
   * Scope the results with the existing front-end person visibility rule.
   */
  relatedPeople(jobId: string) {
    if (!this.state().jobs.some((j) => j.id === jobId)) return [];

    const feeders = new Set([jobId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const path of this.state().paths) {
        if (feeders.has(path.to) && !feeders.has(path.from)) {
          feeders.add(path.from);
          grew = true;
        }
      }
    }

    const positions = new Set(
      this.state().positions.filter((p) => p.jobId === jobId).map((p) => p.id),
    );
    const nominees = new Set(
      this.state().nominations
        .filter((n) => positions.has(n.positionId))
        .map((n) => n.personId),
    );

    return this.state().people.filter(
      (p) => this.allowedPerson(p.id) && (feeders.has(p.jobId) || nominees.has(p.id)),
    );
  }

  /** A draft is visible to HR or a manager of the same unit; others see approvals only. */
  performanceReviewsFor(personId: string): PerformanceReview[] {
    if (!this.allowedPerson(personId)) return [];
    const canSeeDraft = this.canEditPerformance(personId);
    return this.state().performanceReviews
      .filter((r) => r.personId === personId &&
        (r.status === "approved" || canSeeDraft))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  latestApprovedPerformance(personId: string): PerformanceReview | undefined {
    if (!this.allowedPerson(personId)) return undefined;
    return this.state().performanceReviews
      .filter((r) => r.personId === personId && r.status === "approved")
      .sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""))[0];
  }
  canEditPerformance(personId: string) {
    return this.editable() && this.allowedPerson(personId);
  }
  /**
   * Drafts snapshot the published job's KPI definitions. A reviewer supplies
   * attainment and a concrete source/evidence for each KPI; no guessed defaults.
   * Multiple periods remain immutable once approved.
   */
  savePerformanceDraft(
    personId: string, period: string, inputs: PerformanceKpiInput[],
    notes: string, reviewId?: string,
  ): string {
    const person = this.state().people.find((p) => p.id === personId);
    if (!person || !this.canEditPerformance(personId))
      return (this.fail("ثبت عملکرد فقط برای منابع انسانی یا مدیر واحد مجاز است."), "");
    const job = this.publishedJobs().find((j) => j.id === person.jobId);
    if (!job || !job.kpis.length)
      return (this.fail("شغل فعلی باید شناسنامه منتشرشده و شاخص عملکرد داشته باشد."), "");
    const normalizedPeriod = period.trim();
    if (normalizedPeriod.length < 3 || normalizedPeriod.length > 60 || !notes.trim())
      return (this.fail("دوره معتبر و جمع‌بندی مستند ارزیابی الزامی است."), "");
    if (!Array.isArray(inputs) || inputs.length !== job.kpis.length ||
        inputs.some((k, i) =>
          k.title !== job.kpis[i].title || !Number.isFinite(k.achievement) ||
          k.achievement < 0 || k.achievement > 100 || !k.evidence?.trim()))
      return (this.fail("برای تمام KPIها درصد تحقق ۰ تا ۱۰۰ و شواهد معتبر وارد کنید."), "");
    const existing = reviewId
      ? this.state().performanceReviews.find((r) => r.id === reviewId)
      : undefined;
    if (reviewId && (!existing || existing.personId !== personId ||
        existing.status !== "draft" || existing.jobId !== job.id ||
        existing.jobVersion !== job.version))
      return (this.fail("پیش‌نویس وجود ندارد، تأیید شده یا نسخه شغل تغییر کرده است."), "");
    if (this.state().performanceReviews.some((r) =>
      r.personId === personId && r.period === normalizedPeriod && r.id !== reviewId))
      return (this.fail("برای این فرد و دوره قبلاً ارزیابی ثبت شده است."), "");
    const score = performanceScore(inputs.map((k) => k.achievement));
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const record: PerformanceReview = {
      id, personId, jobId: job.id, jobVersion: job.version,
      period: normalizedPeriod,
      kpis: inputs.map((input, i) => ({
        title: job.kpis[i].title,
        definition: job.kpis[i].definition,
        unit: job.kpis[i].unit,
        source: job.kpis[i].source,
        achievement: input.achievement,
        evidence: input.evidence.trim(),
      })),
      score, band: performanceBand(score), status: "draft",
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? now,
      createdBy: existing?.createdBy ?? this.actor(),
      updatedAt: now,
    };
    this.commit(existing ? "پیش‌نویس عملکرد ویرایش شد" : "پیش‌نویس عملکرد ثبت شد",
      personId, (state) => {
        const index = state.performanceReviews.findIndex((r) => r.id === id);
        if (index >= 0) state.performanceReviews[index] = record;
        else state.performanceReviews.push(record);
      });
    return id;
  }
  approvePerformanceReview(reviewId: string): boolean {
    const review = this.state().performanceReviews.find((r) => r.id === reviewId);
    if (this.role() !== "hr" || !this.activeRoleAllowed() ||
        !review || review.status !== "draft" || !this.allowedPerson(review.personId))
      return this.fail("تأیید عملکرد فقط برای منابع انسانی و پیش‌نویس معتبر مجاز است.");
    this.commit("ارزیابی عملکرد دوره‌ای تأیید شد", review.personId, (state) => {
      const target = state.performanceReviews.find((r) => r.id === reviewId)!;
      target.status = "approved";
      target.approvedAt = new Date().toISOString();
      target.approvedBy = this.actor();
      // Projection for existing profile, dashboard and 9-box consumers.
      state.people.find((p) => p.id === target.personId)!.performance = target.band;
      // Potential, 360/540 assessments and succession readiness stay untouched.
    });
    return true;
  }

  candidate(id: string): Candidate | undefined {
    return this.state().candidates.find((c) => c.id === id);
  }
  latestEntryAssessment(id: string) {
    return this.candidate(id)?.assessments.at(-1);
  }
  /** General committee still uses direct members; specialist referrals use reusable groups. */
  entryMembers(stage: EntryCommitteeStage) {
    return this.state().entryCommitteeMembers
      .filter(m => m.stage === stage && this.rolesOf(m.personId).includes("evaluator"))
      .flatMap(m => {
        const person = this.state().people.find(p => p.id === m.personId);
        return person ? [person] : [];
      });
  }
  setEntryCommitteeMember(stage: EntryCommitteeStage, personId: string, enabled: boolean) {
    if (!this.canAccess(["hr"])) return this.fail("تنظیم ترکیب کمیته فقط برای منابع انسانی مجاز است.");
    if (stage !== "general" ||
      !this.state().people.some((p) => p.id === personId && this.rolesOf(p.id).includes("evaluator")))
      return this.fail("عضو کمیته عمومی باید شخص دارای نقش ارزیاب باشد.");
    this.commit("عضویت کمیته عمومی بدو استخدام تنظیم شد", personId, (state) => {
      state.entryCommitteeMembers = state.entryCommitteeMembers.filter((m) =>
        !(m.stage === stage && m.personId === personId));
      if (enabled) state.entryCommitteeMembers.push({ stage, personId });
    });
    return true;
  }
  entryGroupsForJob(jobId: string) {
    return this.state().entryEvaluatorGroups.filter(g => g.isActive && g.jobIds.includes(jobId) &&
      g.memberIds.length > 0 && g.memberIds.every(id => this.rolesOf(id).includes("evaluator")));
  }
  saveEntryEvaluatorGroup(value: EntryEvaluatorGroup) {
    if (!this.canAccess(["hr"])) return this.fail("مدیریت گروه ارزیاب فقط برای منابع انسانی مجاز است.");
    const name = value.name?.trim();
    const jobIds = [...new Set(value.jobIds ?? [])];
    const memberIds = [...new Set(value.memberIds ?? [])];
    const existing = this.state().entryEvaluatorGroups.find(g => g.id === value.id);
    if (!name || !jobIds.length || !memberIds.length ||
      jobIds.some(id => !this.publishedJobs().some(j => j.id === id)) ||
      memberIds.some(id => !this.state().people.some(p =>
        p.id === id && this.rolesOf(p.id).includes("evaluator"))) ||
      this.state().entryEvaluatorGroups.some(g => g.id !== value.id && g.name === name))
      return this.fail("نام یکتا، حداقل یک شغل منتشرشده و یک ارزیاب معتبر الزامی است.");
    const id = existing?.id ?? crypto.randomUUID();
    this.commit("گروه ارزیاب تخصصی ذخیره شد", id, state => {
      const group: EntryEvaluatorGroup = {id, name, jobIds, memberIds, isActive: value.isActive !== false};
      const index = state.entryEvaluatorGroups.findIndex(g => g.id === id);
      if (index < 0) state.entryEvaluatorGroups.push(group);
      else state.entryEvaluatorGroups[index] = group;
    });
    return true;
  }
  saveEntryQuestion(draft: EntryQuestion) {
    if (!this.canAccess(["hr"])) return this.fail("بانک سؤالات بدو استخدام فقط برای منابع انسانی قابل تغییر است.");
    if (!["general","specialist"].includes(draft.stage) ||
      (draft.stage === "general" && draft.jobId !== null) ||
      (draft.stage === "specialist" && !this.publishedJobs().some((j) => j.id === draft.jobId)) ||
      !draft.text.trim() || !Number.isInteger(draft.competencyIndex) ||
      draft.competencyIndex < 0 || draft.competencyIndex >= competencies.length)
      return this.fail("نوع ارزیابی، شغل هدف، شایستگی و متن سؤال باید معتبر باشند.");
    if (this.state().entryQuestions.some((q) => q.id !== draft.id &&
      q.stage === draft.stage && q.jobId === draft.jobId &&
      q.text.trim() === draft.text.trim()))
      return this.fail("در این بانک سؤال تکراری وجود دارد.");
    const existing = this.state().entryQuestions.find((q) => q.id === draft.id);
    if (existing && (existing.stage !== draft.stage || existing.jobId !== draft.jobId))
      return this.fail("برای انتقال سؤال به گروه یا شغل دیگر، یک سؤال جدید ایجاد کنید.");
    const id = existing?.id ?? crypto.randomUUID();
    this.commit("بانک سؤالات بدو استخدام تغییر کرد", id, (state) => {
      const row: EntryQuestion = {
        id, stage: draft.stage, jobId: draft.jobId, competencyIndex: draft.competencyIndex,
        text: draft.text.trim(), isActive: draft.isActive !== false,
        order: existing?.order ?? Math.max(-1, ...state.entryQuestions.filter((q) =>
          q.stage === draft.stage && q.jobId === draft.jobId).map((q) => q.order)) + 1,
      };
      const i = state.entryQuestions.findIndex((q) => q.id === id);
      if (i >= 0) state.entryQuestions[i] = row;
      else state.entryQuestions.push(row);
    });
    return true;
  }
  entryQueue(stage: EntryCommitteeStage) {
    if (!this.canAccess(["evaluator"])) return [];
    return this.state().candidates.filter(c => {
      if (c.decision || !c.entryWorkflow) return false;
      const review = stage === "general" ? c.entryWorkflow.general : c.entryWorkflow.specialist;
      return !!review && review.method !== "manual" && (review.assignments
        ? review.assignments.some(a => a.assignedTo === this.actor())
        : review.assignedTo === this.actor());
    });
  }
  /** General accepts a personId. Specialist accepts a reusable groupId, never a fixed individual. */
  referEntry(candidateId: string, stage: EntryCommitteeStage, targetId: string) {
    const candidate = this.candidate(candidateId);
    if (!this.canAccess(["hr"]) || !candidate || candidate.decision)
      return this.fail("ارجاع ارزیابی فقط برای منابع انسانی و پرونده باز مجاز است.");
    if (stage !== "general" && stage !== "specialist")
      return this.fail("مرحله ارزیابی نامعتبر است.");
    const group = stage === "specialist"
      ? this.entryGroupsForJob(candidate.jobId).find(g => g.id === targetId) : undefined;
    if (stage === "general" && !this.state().entryCommitteeMembers.some(m =>
      m.stage === "general" && m.personId === targetId && this.rolesOf(targetId).includes("evaluator")))
      return this.fail("ارزیاب انتخاب‌شده عضو کمیته عمومی نیست.");
    if (stage === "specialist" && (!group || !group.memberIds.every(id =>
      this.state().people.some(p => p.id === id && this.rolesOf(id).includes("evaluator")))))
      return this.fail("گروه تخصصی فعال و مرتبط با شغل و دارای اعضای معتبر انتخاب کنید.");
    if (stage === "general" && (candidate.entryWorkflow || candidate.assessments.length))
      return this.fail("ارجاع اولیه فقط برای داوطلب فاقد ارزیابی و ارجاع قبلی مجاز است.");
    if (stage === "specialist" &&
      (!candidate.entryWorkflow?.general.completedAt || candidate.entryWorkflow.specialist))
      return this.fail("ابتدا نتیجه عمومی باید ثبت شده و مرحله تخصصی بدون ارجاع قبلی باشد.");
    const questions = activeEntryQuestions(this.state().entryQuestions, stage, candidate.jobId);
    const error = entryBankError(questions);
    if (error) return this.fail(error);
    const now = new Date().toISOString();
    const referral = stage === "specialist"
      ? specialistReferral(group!, questions, now)
      : {
          stage: "general" as const,
          method: "questionnaire" as const,
          assignedTo: targetId, assignedAt: now,
          questions: structuredClone(questions),
        };
    this.commit(stage === "general" ? "ارجاع به کمیته عمومی ثبت شد" : "ارجاع به گروه تخصصی ثبت شد",
      candidateId, state => {
        const c = state.candidates.find(x => x.id === candidateId)!;
        if (stage === "general") c.entryWorkflow = {general: referral};
        else c.entryWorkflow!.specialist = referral;
      });
    return true;
  }
  /**
   * HR records the five general competencies, then immediately refers the
   * candidate to a valid specialist group. No partial writes on failure.
   */
  recordManualGeneralAndReferSpecialist(
    candidateId: string, scores: number[], evidence: string, groupId: string,
  ): boolean {
    const candidate = this.candidate(candidateId);
    if (!this.canAccess(["hr"]) || !candidate || candidate.decision ||
        candidate.entryWorkflow || candidate.assessments.length)
      return this.fail("ثبت دستی عمومی فقط برای منابع انسانی و پرونده ارزیابی‌نشده مجاز است.");
    if (!Array.isArray(scores) || !validScores(scores) || typeof evidence !== "string" || !evidence.trim())
      return this.fail("پنج امتیاز صحیح از ۱ تا ۵ و شواهد مستند ارزیابی عمومی الزامی است.");
    const group = this.entryGroupsForJob(candidate.jobId).find(g => g.id === groupId);
    if (!group || !group.memberIds.length)
      return this.fail("یک گروه تخصصی فعال، مرتبط با شغل و دارای ارزیاب معتبر انتخاب کنید.");
    const questions = activeEntryQuestions(this.state().entryQuestions, "specialist", candidate.jobId);
    const bankError = entryBankError(questions);
    if (bankError) return this.fail(bankError);
    const now = new Date().toISOString();
    const actorId = this.actor();
    this.commit("نتیجه عمومی دستی ثبت و به گروه تخصصی ارجاع شد", candidateId, state => {
      const saved = state.candidates.find(c => c.id === candidateId)!;
      saved.entryWorkflow = {
        general: {
          stage: "general", method: "manual", enteredBy: actorId,
          assignedTo: actorId, assignedAt: now, completedAt: now,
          questions: [], scores: [...scores], evidence: evidence.trim(),
        },
        specialist: specialistReferral(group, questions, now),
      };
    });
    return true;
  }

  submitEntryReview(candidateId: string, stage: EntryCommitteeStage,
    answers: QuestionAnswer[], evidence: string) {
    const candidate = this.candidate(candidateId);
    const review = stage === "general"
      ? candidate?.entryWorkflow?.general : candidate?.entryWorkflow?.specialist;
    const groupAssignment = review?.assignments?.find(a => a.assignedTo === this.actor());
    if (review?.method === "manual" || !this.canAccess(["evaluator"]) || !candidate || candidate.decision ||
      !review || review.completedAt ||
      (review.assignments ? !groupAssignment || !!groupAssignment.completedAt : review.assignedTo !== this.actor()))
      return this.fail("این پرسشنامه به حساب و مرحله فعلی شما تخصیص نیافته است.");
    const scores = entryScores(review.questions, answers);
    if (!scores || !evidence.trim())
      return this.fail("پاسخ معتبر به همه سؤال‌ها و شواهد مستند این مرحله الزامی است.");
    this.commit("نتیجه کمیته ارزیابی بدو استخدام ثبت شد", candidateId, state => {
      const c = state.candidates.find(x => x.id === candidateId)!;
      const target = stage === "general" ? c.entryWorkflow!.general : c.entryWorkflow!.specialist!;
      const now = new Date().toISOString();
      if (target.assignments) {
        const assignment = target.assignments.find(a => a.assignedTo === this.actor())!;
        assignment.answers = answers.map(a => ({...a}));
        assignment.scores = [...scores];
        assignment.evidence = evidence.trim();
        assignment.completedAt = now;
        if (target.assignments.every(a => a.completedAt && a.scores?.length === competencies.length)) {
          target.scores = competencies.map((_, i) => Math.round(
            target.assignments!.reduce((sum, a) => sum + a.scores![i], 0) /
            target.assignments!.length * 10) / 10);
          target.evidence = target.assignments.map(a => {
            const person = state.people.find(p => p.id === a.assignedTo);
            return (person?.name ?? a.assignedTo) + ": " + a.evidence;
          }).join("\n");
          target.completedAt = now;
        }
      } else {
        target.answers = answers.map(a => ({...a}));
        target.scores = scores;
        target.evidence = evidence.trim();
        target.completedAt = now;
      }
    });
    return true;
  }
  finalizeEntryReview(candidateId: string, potential: Band,
    potentialReason: string, evidence: string) {
    const candidate = this.candidate(candidateId);
    const workflow = candidate?.entryWorkflow;
    if (!this.canAccess(["hr"]) || !candidate || candidate.decision ||
      !workflow?.general.completedAt || !workflow.specialist?.completedAt ||
      candidate.assessments.length)
      return this.fail("جمع‌بندی تنها پس از تکمیل هر دو کمیته و برای پرونده باز مجاز است.");
    const scores = combinedEntryScores(workflow.general, workflow.specialist);
    if (!scores || !["low","medium","high"].includes(potential) ||
      !potentialReason.trim() || !evidence.trim())
      return this.fail("امتیازهای هر دو کمیته و نظر مستند درباره پتانسیل الزامی است.");
    this.commit("جمع‌بندی ارزیابی عمومی و تخصصی تأیید شد", candidateId, (state) => {
      state.candidates.find((c) => c.id === candidateId)!.assessments.push({
        id: crypto.randomUUID(), scores, potential,
        evidence: evidence.trim(), potentialReason: potentialReason.trim(),
        assessor: workflow.general.method === "manual"
          ? "منابع انسانی (جمع‌بندی عمومی دستی و تخصصی)"
          : "منابع انسانی (تأیید جمع‌بندی دو کمیته)",
        source: "committees",
        generalMethod: workflow.general.method === "manual" ? "manual" : "questionnaire",
        generalReviewAt: workflow.general.completedAt,
        specialistReviewAt: workflow.specialist!.completedAt,
        evaluatedAt: new Date().toISOString(),
      });
    });
    return true;
  }
  registerCandidate(name: string, jobId: string) {
    if (this.role() !== "hr") return (this.fail("ثبت داوطلب تنها برای منابع انسانی مجاز است."), "");
    if (!name.trim() || !this.publishedJobs().some((j) => j.id === jobId))
      return (this.fail("نام داوطلب و شغل هدف معتبر الزامی است."), "");
    const id = crypto.randomUUID();
    this.commit("داوطلب برای ارزیابی اولیه ثبت شد", id, (state) => {
      state.candidates.unshift({
        id, name: name.trim(), jobId, createdAt: new Date().toISOString(),
        assessments: [],
      });
    });
    return id;
  }
  recordEntryAssessment(
    candidateId: string, scores: number[], potential: Band,
    evidence: string, potentialReason: string,
  ) {
    const candidate = this.candidate(candidateId);
    if (this.role() !== "hr" || !candidate || candidate.decision || candidate.entryWorkflow)
      return this.fail("با شروع ارجاع کمیته، ثبت دستی امتیاز شایستگی مجاز نیست.");
    if (!validScores(scores) || !["low", "medium", "high"].includes(potential) ||
        !evidence.trim() || !potentialReason.trim())
      return this.fail("پنج امتیاز معتبر ۱ تا ۵، سطح پتانسیل و شواهد و استدلال آن الزامی است.");
    this.commit("نسخه جدید ارزیابی بدو استخدام ثبت شد", candidateId, (state) => {
      state.candidates.find((c) => c.id === candidateId)!.assessments.push({
        id: crypto.randomUUID(), scores: [...scores], potential,
        evidence: evidence.trim(), potentialReason: potentialReason.trim(),
        assessor: "کارشناس منابع انسانی", evaluatedAt: new Date().toISOString(),
      });
    });
    return true;
  }
  decideCandidate(
    candidateId: string, outcome: "hired" | "declined", reason: string,
    employment?: { code: string; positionId: string; hiredAt: string; referenceNo?: string },
  ) {
    const candidate = this.candidate(candidateId);
    const assessment = candidate?.assessments.at(-1);
    if (this.role() !== "hr" || !candidate || candidate.decision)
      return this.fail("تصمیم نهایی برای این داوطلب مجاز نیست یا قبلاً ثبت شده است.");
    if (!assessment || !reason.trim() || !["hired", "declined"].includes(outcome))
      return this.fail("ارزیابی اولیه و دلیل تصمیم انسانی الزامی است.");
    if (outcome === "hired") {
      if (!employment?.code?.trim() || !employment.positionId ||
          !validDay(employment.hiredAt) ||
          this.state().people.some((p) => p.code === employment.code.trim()))
        return this.fail("کد پرسنلی یکتا، تاریخ معتبر و پست سازمانی مقصد الزامی هستند.");
      if (!this.hireablePositions(candidate.jobId, employment.hiredAt)
        .some((p) => p.id === employment.positionId))
        return this.fail("پست انتخاب‌شده باید فعال، مربوط به شغل داوطلب و از تاریخ انتصاب به بعد بلاتصدی باشد.");
    }
    const personId = outcome === "hired" ? crypto.randomUUID() : undefined;
    this.commit(outcome === "hired"
      ? "داوطلب استخدام و پرونده کارکنان ایجاد شد"
      : "نتیجه عدم استخدام با شواهد ثبت شد", candidateId, (state) => {
      const c = state.candidates.find((x) => x.id === candidateId)!;
      c.decision = {
        outcome, reason: reason.trim(), reviewer: "کارشناس منابع انسانی",
        decidedAt: new Date().toISOString(),
        ...(personId ? { personId } : {}),
      };
      if (personId && employment) {
        // Source of truth: the pre-existing organizational post. Job, unit and
        // manager are projections from the post hierarchy, not form inputs.
        const position = state.positions.find((p) => p.id === employment.positionId)!;
        const manager = position.parentPositionId
          ? positionHolder(state, position.parentPositionId, employment.hiredAt)
          : undefined;
        state.people.push({
          id: personId, name: c.name, code: employment.code.trim(),
          jobId: position.jobId,
          unit: state.organizationUnits.find((u) => u.id === position.unitId)?.name ?? position.unit,
          managerId: manager?.id ?? "",
          performance: null, potential: assessment.potential,
          observed: [...assessment.scores],
          evidence: "ارزیابی اولیه بدو استخدام: " + assessment.evidence,
          entry: {
            candidateId: c.id, assessmentId: assessment.id,
            hiredAt: employment.hiredAt, potentialReviewedAt: assessment.evaluatedAt,
          },
        });
        state.roleAssignments[personId] = ["employee", "evaluator"];
        const error = assignPosition(state, {
          id: crypto.randomUUID(), personId, positionId: position.id,
          type: "primary", effectiveFrom: employment.hiredAt, effectiveTo: null,
          referenceNo: employment.referenceNo?.trim() || "HIRING",
          note: "انتصاب اولیه پس از استخدام",
        });
        if (error) throw new Error(error); // The vacancy is prevalidated above.
        projectStaffing(state);
      }
    });
    return personId ?? "declined";
  }
  scores(personId: string) {
    const cycle = this.state()
      .cycles.filter(
        (c) =>
          c.subjectId === personId && ["feedback", "closed"].includes(c.status),
      )
      .sort((a, b) => b.created.localeCompare(a.created))[0];
    return cycle
      ? (aggregate(cycle).scores ?? this.person(personId).observed)
      : this.person(personId).observed;
  }
  gaps(personId: string, jobId: string) {
    return gap(this.job(jobId).expected, this.scores(personId));
  }
  progress = progress;
  aggregate = aggregate;
  canStart = canStart;
  createJob(code: string, content: JobContent): string {
    if (!this.editable())
      return (this.fail("تنها منابع انسانی یا مدیر مجاز می‌تواند شناسنامه جدید ثبت کند."), "");
    if (this.role() === "manager" && content.unit.trim() !== this.currentPerson()?.unit)
      return (this.fail("مدیر فقط برای واحد سازمانی خودش شناسنامه تعریف می‌کند."), "");
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(normalizedCode))
      return (this.fail("کد شغل باید ۲ تا ۳۲ نویسه انگلیسی شامل حروف، عدد، خط تیره یا زیرخط باشد."), "");
    if (this.state().jobs.some((j) => j.code.trim().toUpperCase() === normalizedCode))
      return (this.fail("کد شغل تکراری است؛ کد یکتا وارد کنید."), "");
    if (!content.family.trim() || !content.unit.trim() || !content.level.trim())
      return (this.fail("خانواده، واحد سازمانی و سطح شغلی الزامی‌اند."), "");
    const error = validateJob(content);
    if (error) return (this.fail(error), "");
    if (!content.tasks.length)
      return (this.fail("برای شناسنامه جدید حداقل یک وظیفه خروجی‌محور تعریف کنید."), "");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const draft = structuredClone(content);
    // A new record is not published merely because it appears in the job list.
    // Version zero is an initial draft; the owner's approval publishes version one.
    const job: Job = {
      ...structuredClone(content),
      id, code: normalizedCode, version: 0, revised: now,
      review: "draft", draft, history: [],
    };
    this.commit("پیش‌نویس شناسنامه شغلی جدید ایجاد شد", id, (state) => {
      state.jobs.unshift(job);
    });
    return id;
  }
    saveJob(id: string, draft: JobContent) {
    if (!this.editable()) return this.fail("نقش فعلی اجازه ویرایش ندارد.");
    const job = this.state().jobs.find((j) => j.id === id);
    if (!job) return this.fail("شناسنامه شغلی یافت نشد.");
    if (this.role() === "manager" && (job.unit !== this.currentPerson()?.unit || draft.unit.trim() !== this.currentPerson()?.unit))
      return this.fail("مدیر نمی‌تواند شناسنامه‌ای خارج از واحد خودش تعریف یا ویرایش کند.");
    const error = validateJob(draft);
    if (error) return this.fail(error);
    this.commit("پیش‌نویس شناسنامه ذخیره شد", id, (s) => {
      const j = s.jobs.find((j) => j.id === id)!;
      j.draft = structuredClone(draft);
      j.review = "draft";
    });
    return true;
  }
  reviewJob(id: string, decision: "submit" | "approve" | "reject") {
    const j = this.job(id);
    if (!j?.draft) return this.fail("پیش‌نویسی وجود ندارد.");
    if (
      decision === "submit" &&
      (!this.editable() || !["draft", "rejected"].includes(j.review))
    )
      return false;
    if (decision !== "submit" && (!this.canApprove() || j.review !== "review"))
      return this.fail("تأیید به نقش مالک خانواده شغلی نیاز دارد.");
    this.commit(
      decision === "approve"
        ? "نسخه جدید شناسنامه منتشر شد"
        : decision === "submit"
          ? "شناسنامه برای تأیید ارسال شد"
          : "شناسنامه برای اصلاح برگشت داده شد",
      id,
      (s) => {
        const x = s.jobs.find((j) => j.id === id)!;
        if (decision === "approve") {
          Object.assign(x, x.draft);
          delete x.draft;
          x.version++;
          x.revised = new Date().toISOString();
          x.review = "published";
          x.history.unshift({
            version: x.version,
            at: x.revised,
            summary: x.version === 1 ? "تصویب نسخه اولیه شناسنامه" : "بازنگری و تأیید مالک خانواده",
          });
        } else x.review = decision === "submit" ? "review" : "rejected";
      },
    );
    return true;
  }
  /** The global bank is editable by HR, never by an evaluator or employee. */
  saveEvaluationQuestion(draft: EvaluationQuestion) {
    if (this.role() !== "hr") return this.fail("مدیریت سؤالات فقط برای منابع انسانی مجاز است.");
    const validGroups: Group[] = ["supervisor", "peer", "subordinate", "external"];
    if (!validGroups.includes(draft.group) || !draft.text.trim() ||
      !Number.isInteger(draft.competencyIndex) ||
      draft.competencyIndex < 0 || draft.competencyIndex >= competencies.length)
      return this.fail("گروه، متن سؤال و شایستگی معتبر الزامی‌اند.");
    const others = this.state().questions.filter((q) => q.id !== draft.id);
    if (others.some((q) => q.group === draft.group && q.text.trim() === draft.text.trim()))
      return this.fail("متن سؤال در این گروه تکراری است.");
    const existing = this.state().questions.find((q) => q.id === draft.id);
    if (existing && existing.group !== draft.group)
      return this.fail("برای تغییر گروه ارزیاب، سؤال جدیدی تعریف کنید.");
    const id = existing ? existing.id : crypto.randomUUID();
    this.commit(existing ? "سؤال ارزیابی ویرایش شد" : "سؤال ارزیابی افزوده شد", id, (state) => {
      const list = state.questions;
      const value: EvaluationQuestion = {
        id, group: draft.group, text: draft.text.trim(),
        competencyIndex: draft.competencyIndex, isActive: draft.isActive,
        order: existing ? existing.order :
          Math.max(-1, ...list.filter((q) => q.group === draft.group).map((q) => q.order)) + 1,
      };
      const index = list.findIndex((q) => q.id === id);
      if (index >= 0) list[index] = value;
      else list.push(value);
    });
    return true;
  }
  deleteEvaluationQuestion(id: string) {
    if (this.role() !== "hr") return this.fail("اجازه حذف سؤال ندارید.");
    if (!this.state().questions.some((q) => q.id === id))
      return this.fail("سؤال موردنظر یافت نشد.");
    this.commit("سؤال از بانک حذف شد", id, (state) => {
      state.questions = state.questions.filter((q) => q.id !== id);
    });
    return true;
  }
  moveEvaluationQuestion(id: string, direction: -1 | 1) {
    if (this.role() !== "hr") return this.fail("اجازه تغییر ترتیب ندارید.");
    const question = this.state().questions.find((q) => q.id === id);
    if (!question) return false;
    const ordered = this.state().questions.filter((q) => q.group === question.group)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const index = ordered.findIndex((q) => q.id === id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) return false;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    this.commit("ترتیب سؤال‌های گروه تغییر کرد", id, (state) => {
      ordered.forEach((q, order) => {
        state.questions.find((x) => x.id === q.id)!.order = order;
      });
    });
    return true;
  }
  questionsFor(c: Cycle, group: Group): EvaluationQuestion[] {
    if (c.questions) return orderedQuestions(c.questions, group);
    if (c.status === "preparing") return orderedQuestions(this.state().questions, group);
    return legacyCycleQuestions(group);
  }
  hasAnswered(c: Cycle, a: Assignment): boolean {
    return c.questions
      ? !!a.answers && validQuestionAnswers(this.questionsFor(c, a.group), a.answers)
      : !!a.scores && validScores(a.scores);
  }
  /** Preview people and chart-derived assignments without persisting records. */
  previewCampaign(scope: CampaignScope, period: string, asOf: string, mode: 360 | 540) {
    return campaignPreview(this.state(), { scope, period: period.trim(), asOf, mode });
  }
  /** Creating one organizational period immediately enrolls all eligible people,
   * but leaves every individual Cycle in preparing: evaluator inbox stays empty. */
  createCampaign(title: string, period: string, asOf: string,
    mode: 360 | 540, scope: CampaignScope): string {
    if (!this.canAccess(["hr"]))
      return (this.fail("ایجاد دوره گروهی فقط برای منابع انسانی مجاز است."), "");
    if (!title.trim() || period.trim().length < 3 || !validDay(asOf) ||
      ![360,540].includes(mode) || !scope || !["all","unit","job","people"].includes(scope.type) ||
      !Array.isArray(scope.ids) || (scope.type !== "all" && !scope.ids.length) ||
      new Set(scope.ids).size !== scope.ids.length)
      return (this.fail("عنوان، دوره، تاریخ مبنا و جامعه هدف معتبر الزامی است."), "");
    const validIds = scope.type === "all" ? [] :
      scope.type === "unit" ? this.state().organizationUnits.map((u) => u.id) :
      scope.type === "job" ? this.publishedJobs().map((j) => j.id) :
      this.state().people.map((p) => p.id);
    if (scope.type !== "all" && scope.ids.some((id) => !validIds.includes(id)))
      return (this.fail("شناسه‌های جامعه هدف معتبر نیستند."), "");
    if (mode === 540)
      return (this.fail("دوره گروهی ۵۴۰ تا تعریف روابط ذی‌نفعان بیرونی پشتیبانی نمی‌شود."), "");
    const preview = campaignPreview(this.state(), { scope, period: period.trim(), asOf, mode });
    if (!preview.length)
      return (this.fail("جامعه هدف در تاریخ مبنا هیچ فردی ندارد."), "");
    const eligible = preview.filter((x) => !x.reason);
    if (!eligible.length)
      return (this.fail("هیچ فرد واجد شرایطی برای ایجاد پرونده وجود ندارد؛ استثناها را بررسی کنید."), "");
    const snapshot = this.state().questions;
    if (eligible.some((row) => {
      const groups = new Set(row.assignments.map((a) => a.group));
      const questions = snapshot.filter((q) => q.isActive && groups.has(q.group));
      return competencies.some((_, i) => !questions.some((q) => q.competencyIndex === i));
    })) return (this.fail("سؤالات فعال گروه‌های انتخابی باید پنج شایستگی اصلی را پوشش دهند."), "");
    const id = crypto.randomUUID();
    this.commit("دوره گروهی و پرونده‌های آماده‌سازی ایجاد شدند", id, (state) => {
      const campaign: EvaluationCampaign = {
        id, title: title.trim(), period: period.trim(), asOf, mode,
        scope: structuredClone(scope), status: "draft",
        createdAt: new Date().toISOString(), createdBy: this.actor(),
        exclusions: preview.filter((row) => !!row.reason)
          .map((row) => ({ personId: row.personId, reason: row.reason! })),
      };
      state.campaigns.unshift(campaign);
      state.cycles.unshift(...eligible.map((row) => campaignCycle(campaign, row, state)));
    });
    return id;
  }
  /** Explicit HR action; preparing cycles are checked together before any are activated. */
  startCampaign(id: string): boolean {
    const campaign = this.state().campaigns.find((x) => x.id === id);
    if (!this.canAccess(["hr"]) || !campaign || campaign.status !== "draft")
      return this.fail("شروع دریافت پاسخ فقط برای دوره آماده‌سازی و منابع انسانی مجاز است.");
    const cycles = this.state().cycles.filter((c) => c.campaignId === id);
    if (!cycles.length || cycles.some((c) => c.status !== "preparing" || !canStart(c)))
      return this.fail("تمام پرونده‌ها باید در آماده‌سازی و دارای ترکیب معتبر ارزیاب باشند.");
    if (cycles.some((c) => !c.questions?.length ||
      competencies.some((_, i) => !c.questions?.some((q) => q.competencyIndex === i))))
      return this.fail("بانک سؤال Snapshot شده باید پنج شایستگی را پوشش دهد.");
    this.commit("شروع دریافت پاسخ کمپین با تأیید منابع انسانی", id, (state) => {
      state.campaigns.find((x) => x.id === id)!.status = "active";
      state.campaigns.find((x) => x.id === id)!.startedAt = new Date().toISOString();
      state.cycles.filter((c) => c.campaignId === id).forEach((c) => { c.status = "collecting"; });
    });
    return true;
  }
  closeCampaign(id: string): boolean {
    const campaign = this.state().campaigns.find((x) => x.id === id);
    const cycles = this.state().cycles.filter((c) => c.campaignId === id);
    if (!this.canAccess(["hr"]) || !campaign || campaign.status !== "active" ||
      !cycles.length || cycles.some((c) => c.status !== "closed"))
      return this.fail("بستن کمپین فقط پس از تکمیل و بستن تمام ارزیابی‌های آن مجاز است.");
    this.commit("کمپین ارزیابی بسته شد", id, (state) => {
      state.campaigns.find((x) => x.id === id)!.status = "closed";
    });
    return true;
  }
  createCycle(
    title: string,
    subjectId: string,
    jobId: string,
    mode: 360 | 540,
  ) {
    if (
      this.role() !== "hr" ||
      !title.trim() ||
      !this.person(subjectId) ||
      !this.publishedJobs().some((j) => j.id === jobId)
    )
      return "";
    const id = crypto.randomUUID();
    this.commit("دوره ارزیابی ایجاد شد", id, (s) =>
      s.cycles.unshift({
        id,
        title: title.trim(),
        subjectId,
        jobId,
        mode,
        period: "1405-autumn",
        status: "preparing",
        assignments: [],
        notes: "",
        created: new Date().toISOString(),
      }),
    );
    return id;
  }
  /** Suggestions based on position hierarchy; HR must explicitly accept. */
  organizationalEvaluatorSuggestions(personId: string, mode: 360 | 540) {
    const position = this.currentPosition(personId);
    if (!position) return [] as { personId: string; group: Group; reason: string }[];
    const manager = this.currentManager(personId);
    const peers = this.state().positions
      .filter((p) => p.id !== position.id &&
        p.parentPositionId === position.parentPositionId &&
        !!position.parentPositionId)
      .flatMap((p) => {
        const person = this.currentPositionHolder(p.id);
        return person ? [person] : [];
      });
    const juniors = this.directReports(personId);
    const raw: { personId: string; group: Group; reason: string }[] = [
      ...(manager ? [{ personId: manager.id, group: "supervisor" as const, reason: "متصدی پست بالاسری" }] : []),
      ...peers.map((p) => ({ personId: p.id, group: "peer" as const, reason: "هم‌سطح در چارت پست‌ها" })),
      ...juniors.map((p) => ({ personId: p.id, group: "subordinate" as const, reason: "متصدی پست زیرمجموعه مستقیم" })),
    ];
    const seen = new Set([personId]);
    // Only create proposal records from occupied posts, never fake evaluators
    // to satisfy group minima; 540 external relations remain manually selected.
    return raw.filter((r) => {
      if (seen.has(r.personId)) return false;
      seen.add(r.personId);
      return mode === 540 || r.group !== "external";
    });
  }
  addOrganizationalEvaluators(cycleId: string) {
    const cycle = this.cycle(cycleId);
    if (!this.canAccess(["hr"]) || !cycle || cycle.status !== "preparing" || cycle.campaignId)
      return this.fail("ارزیابان کمپین هنگام ایجاد دوره تثبیت می‌شوند؛ افزودن فقط برای پرونده‌های فردی مجاز است.");
    const assigned = new Set([cycle.subjectId, ...cycle.assignments.map((a) => a.personId)]);
    const suggestions = this.organizationalEvaluatorSuggestions(cycle.subjectId, cycle.mode)
      .filter((x) => !assigned.has(x.personId));
    if (!suggestions.length)
      return this.fail("ارزیاب سازمانی جدیدی برای پیشنهاد وجود ندارد.");
    this.commit("ارزیابان پیشنهادی از چارت سازمانی افزوده شدند", cycleId, (state) => {
      const target = state.cycles.find((c) => c.id === cycleId)!;
      for (const item of suggestions) {
        if (target.assignments.some((a) => a.personId === item.personId)) continue;
        target.assignments.push({ id: crypto.randomUUID(), personId: item.personId, group: item.group });
      }
    });
    return true;
  }
  addEvaluator(id: string, personId: string, group: Group) {
    const c = this.cycle(id);
    if (this.role() !== "hr" || c?.status !== "preparing" || c.campaignId) return false;
    if (
      personId === c.subjectId ||
      c.assignments.some((a) => a.personId === personId)
    )
      return this.fail("ارزیاب تکراری یا خود فرد مجاز نیست.");
    if (group === "external" && c.mode === 360)
      return this.fail("ارزیاب بیرونی مخصوص دوره ۵۴۰ است.");
    this.commit("ارزیاب افزوده شد", id, (s) =>
      s.cycles
        .find((c) => c.id === id)!
        .assignments.push({ id: crypto.randomUUID(), personId, group }),
    );
    return true;
  }
  removeEvaluator(id: string, aid: string) {
    if (this.role() !== "hr" || this.cycle(id)?.status !== "preparing" || this.cycle(id)?.campaignId) return;
    this.commit("ارزیاب حذف شد", id, (s) => {
      const c = s.cycles.find((c) => c.id === id)!;
      c.assignments = c.assignments.filter((a) => a.id !== aid);
    });
  }
  advance(id: string, notes = "") {
    const c = this.cycle(id);
    if (this.role() !== "hr" || !c) return false;
    if (c.campaignId && c.status === "preparing")
      return this.fail("شروع پاسخ‌گیری پرونده‌های گروهی فقط از صفحه دوره و با تأیید منابع انسانی مجاز است.");
    if (c.status === "preparing" && !canStart(c))
      return this.fail(
        "حداقل یک سرپرست، دو هم‌سطح، دو زیردست و در ۵۴۰ یک بیرونی لازم است.",
      );
    if (c.status === "preparing") {
      const error = validateQuestionBank(this.state().questions, c.mode);
      if (error) return this.fail(error);
    }
    if (c.status === "collecting" && c.assignments.some((a) => !this.hasAnswered(c, a)))
      return this.fail("ابتدا تمام تکالیف دوره را تکمیل کنید.");
    if (c.status === "calibration" && !notes.trim())
      return this.fail("یادداشت کالیبراسیون الزامی است.");
    if (c.status === "closed") return false;
    this.commit("وضعیت دوره به‌روزرسانی شد", id, (s) => {
      const x = s.cycles.find((c) => c.id === id)!;
      const next = {
        preparing: "collecting",
        collecting: "calibration",
        calibration: "feedback",
        feedback: "closed",
      } as const;
      if (x.status === "preparing") {
        const groups: Group[] = ["supervisor", "peer", "subordinate", ...(x.mode === 540 ? ["external" as Group] : [])];
        x.questions = structuredClone(groups.flatMap((g) => orderedQuestions(s.questions, g)));
      }
      x.status = next[x.status as keyof typeof next];
      if (notes) x.notes = notes.trim();
    });
    return true;
  }
  submit(id: string, aid: string, answers: number[] | QuestionAnswer[]) {
    const c = this.cycle(id);
    const a = c?.assignments.find((item) => item.id === aid);
    if (
      !this.canAccess(["evaluator"]) ||
      a?.personId !== this.actor() ||
      c?.status !== "collecting" ||
      this.hasAnswered(c, a)
    ) return this.fail("این تکلیف برای نقش و شخصیت فعلی قابل ثبت نیست.");

    if (c.questions) {
      const questions = this.questionsFor(c, a.group);
      const keyed: QuestionAnswer[] = answers.every((v) => typeof v === "number")
        ? (answers as number[]).map((score, i) => ({
            questionId: questions[i]?.id ?? "", score,
          }))
        : answers as QuestionAnswer[];
      if (!validQuestionAnswers(questions, keyed))
        return this.fail("برای تمام سؤالات گروه یک امتیاز معتبر از ۱ تا ۵ ثبت کنید.");
      this.commit("پاسخ‌های گروه ارزیاب ثبت شد", id, (state) => {
        state.cycles.find((x) => x.id === id)!.assignments
          .find((x) => x.id === aid)!.answers = keyed.map((v) => ({ ...v }));
      });
      return true;
    }

    if (!answers.every((v) => typeof v === "number") || !validScores(answers as number[]))
      return this.fail("برای هر پنج سؤال یک امتیاز صحیح از ۱ تا ۵ انتخاب کنید.");
    this.commit("پرسشنامه ثبت شد", id, (state) => {
      state.cycles.find((x) => x.id === id)!.assignments
        .find((x) => x.id === aid)!.scores = [...answers as number[]];
    });
    return true;
  }
  /** Runtime catalog is sourced only from persisted state, not hardcoded data. */
  templatesForCompetency(index: number, includeInactive = false) {
    return templatesForCompetency(this.state().developmentTemplates, index, includeInactive);
  }
  templateUsageCount(id: string) {
    return this.state().plans.reduce((count, plan) =>
      count + plan.actions.filter((a) => a.templateId === id).length, 0);
  }
  saveDevelopmentTemplate(draft: DevelopmentTemplate) {
    if (this.role() !== "hr")
      return this.fail("مدیریت الگوهای توسعه فقط برای منابع انسانی مجاز است.");
    if (!Number.isInteger(draft.competency) || draft.competency < 0 ||
      draft.competency >= competencies.length ||
      !draft.title.trim() || !draft.kind.trim() || !draft.indicator.trim())
      return this.fail("عنوان، نوع، شاخص موفقیت و شایستگی معتبر برای الگو الزامی است.");
    const current = this.state().developmentTemplates.find((t) => t.id === draft.id);
    if (current && current.competency !== draft.competency && this.templateUsageCount(current.id))
      return this.fail("شایستگی الگویی که در برنامه استفاده شده قابل تغییر نیست؛ الگوی جدید تعریف کنید.");
    if (this.state().developmentTemplates.some((t) =>
      t.id !== current?.id && t.competency === draft.competency &&
      t.title.trim().toLocaleLowerCase() === draft.title.trim().toLocaleLowerCase()))
      return this.fail("الگویی با همین عنوان برای این شایستگی وجود دارد.");
    const id = current?.id ?? crypto.randomUUID();
    this.commit(current ? "الگوی اقدام توسعه ویرایش شد" : "الگوی اقدام توسعه ثبت شد", id, (state) => {
      const value: DevelopmentTemplate = {
        id, title: draft.title.trim(), kind: draft.kind.trim(),
        indicator: draft.indicator.trim(), competency: draft.competency,
        isActive: draft.isActive,
      };
      const i = state.developmentTemplates.findIndex((t) => t.id === id);
      if (i < 0) state.developmentTemplates.push(value);
      else state.developmentTemplates[i] = value;
    });
    return true;
  }
  deleteDevelopmentTemplate(id: string) {
    if (this.role() !== "hr") return this.fail("اجازه حذف الگوی توسعه ندارید.");
    if (!this.state().developmentTemplates.some((t) => t.id === id))
      return this.fail("الگوی موردنظر یافت نشد.");
    if (this.templateUsageCount(id))
      return this.fail("این الگو در برنامه‌های توسعه استفاده شده است؛ برای حفظ رابطه با سوابق، آن را غیرفعال کنید.");
    this.commit("الگوی توسعه حذف شد", id, (state) => {
      state.developmentTemplates = state.developmentTemplates.filter((t) => t.id !== id);
    });
    return true;
  }
  /** Older browser data may not have explicit version numbers. */
  planVersion(p: { version?: number }) {
    return p.version ?? 1;
  }
  isCurrentPlan(p: { id: string; personId: string; jobId: string }) {
    const versions = this.state().plans.filter(
      (x) => x.personId === p.personId && x.jobId === p.jobId,
    );
    return versions[versions.length - 1]?.id === p.id;
  }
  latestPublishedCycle(personId: string, jobId: string) {
    return this.state().cycles
      .filter(
        (c) =>
          c.subjectId === personId &&
          c.jobId === jobId &&
          (c.status === "feedback" || c.status === "closed"),
      )
      .sort((a, b) => b.created.localeCompare(a.created))[0];
  }
  createPlan(personId: string, jobId: string, cycleId?: string) {
    if (!this.editable()) return "";
    if (!this.person(personId) || !this.publishedJobs().some((j) => j.id === jobId) || !this.allowedPerson(personId))
      return (this.fail("فرد یا شغل معتبر نیست یا دسترسی کافی ندارید."), "");

    // A published cycle is a unique source. The manual plan has a separate key.
    const cycle = cycleId ? this.cycle(cycleId) : undefined;
    if (cycleId && (
      !cycle ||
      cycle.subjectId !== personId ||
      cycle.jobId !== jobId ||
      !["feedback", "closed"].includes(cycle.status)
    ))
      return (this.fail("برای این فرد و شغل، گزارش ارزیابی تأییدشده‌ای با شناسه دوره انتخابی وجود ندارد."), "");

    const existing = this.state().plans.find(
      (p) => p.personId === personId && p.jobId === jobId &&
        (p.cycleId ?? null) === (cycleId ?? null),
    );
    if (existing) return existing.id;

    const observed = cycle
      ? aggregate(cycle).scores
      : this.scores(personId);
    if (!observed)
      return (this.fail("برای ساخت برنامه، نتیجه قابل انتشار ارزیابی موجود نیست."), "");

    const expected = [...this.job(jobId).expected];
    const baseline = {
      expected,
      observed: [...observed],
      gaps: gap(expected, observed),
    };
    // Highest observed competency gaps first, using only active templates.
    // Prefer separate competencies, then fill remaining slots from the same gaps.
    const ranked = competencies.map((_, i) => i)
      .sort((a, b) => baseline.gaps[b] - baseline.gaps[a] || a - b);
    const byCompetency = ranked.map((c) =>
      this.templatesForCompetency(c));
    const selected = byCompetency.flatMap((items, rank) =>
      items.length ? [items[rank % items.length]] : []);
    if (selected.length < 3) {
      const already = new Set(selected.map((t) => t.id));
      for (const items of byCompetency) for (const item of items) {
        if (selected.length === 3) break;
        if (!already.has(item.id)) {
          selected.push(item);
          already.add(item.id);
        }
      }
    }
    if (selected.length < 3)
      return (this.fail("برای ایجاد برنامه حداقل سه الگوی فعال توسعه لازم است؛ از بانک الگوها تعریف یا فعال کنید."), "");
    const chosen = selected.slice(0, 3);
    const older = this.state().plans.filter(
      (p) => p.personId === personId && p.jobId === jobId,
    );
    const version = older.reduce((max, p) => Math.max(max, this.planVersion(p)), 0) + 1;
    const id = crypto.randomUUID();
    this.commit("نسخه جدید برنامه توسعه ایجاد شد", id, (s) =>
      s.plans.push({
        id,
        personId,
        jobId,
        ...(cycle ? { cycleId: cycle.id } : {}),
        period: cycle?.period ?? "1405-autumn",
        version,
        createdAt: new Date().toISOString(),
        baseline,
        actions: chosen.map((template) => {
          const c = template.competency;
          return {
            id: crypto.randomUUID(),
            competency: c,
            templateId: template.id,
            title: template.title,
            kind: template.kind,
            owner: this.person(personId).name,
            assigneeId: personId,
            due: this.defaultDevelopmentDue(),
            indicator: template.indicator,
            status: "planned" as const,
            evidence: "",
          };
        }),
      }),
    );
    return id;
  }
  saveAction(planId: string, a: Action) {
    const p = this.state().plans.find((plan) => plan.id === planId);
    const original = p?.actions.find((x) => x.id === a.id);
    if (!p || !original || !this.canEditAction(p, original))
      return this.fail("ویرایش این اقدام فقط برای مسئول آن یا مدیر مجاز است.");
    if (!this.isCurrentPlan(p))
      return this.fail("این نسخه از برنامه توسعه آرشیوی است؛ فقط آخرین نسخه قابل ویرایش است.");
    if (!original) return this.fail("اقدام موردنظر در این برنامه وجود ندارد.");
    if (original.effectiveness)
      return this.fail("اقدام بررسی‌شده توسط مدیر قفل است؛ ثبت نتیجه جدید از طریق بازبینی مدیر انجام می‌شود.");
    if (this.role() === "employee" && (
      a.id !== original.id || a.title !== original.title || a.kind !== original.kind ||
      a.competency !== original.competency || a.owner !== original.owner ||
      a.due !== original.due || a.indicator !== original.indicator ||
      a.templateId !== original.templateId ||
      a.assigneeId !== original.assigneeId
    )) return this.fail("کارمند فقط وضعیت و شواهد اقدام تخصیص‌یافته را تغییر می‌دهد.");
    if (
      !Number.isInteger(a.competency) || a.competency < 0 || a.competency >= competencies.length ||
      !a.title.trim() || !a.owner.trim() || !a.due ||
      !/^\d{4}-\d{2}-\d{2}$/.test(a.due) || !a.indicator.trim()
    ) return this.fail("شایستگی، عنوان، مسئول، مهلت معتبر و شاخص موفقیت را تکمیل کنید.");
    const resolvedAssignee = this.role() === "employee"
      ? this.actionAssigneeId(p, original)
      : (this.state().people.some((person) => person.id === a.assigneeId)
        ? a.assigneeId
        : this.state().people.find((person) => person.name === a.owner)?.id);
    if (!resolvedAssignee)
      return this.fail("مسئول اقدام را از افراد ثبت‌شده انتخاب کنید.");
    this.commit("اقدام توسعه به‌روزرسانی شد", planId, (state) => {
      const plan = state.plans.find((x) => x.id === planId)!;
      plan.actions = plan.actions.map((v) =>
        v.id === a.id ? {
          ...structuredClone(a),
          owner: state.people.find((p) => p.id === resolvedAssignee)!.name,
          assigneeId: resolvedAssignee,
          /** Changed competency means a customized action, not the original template. */
          templateId: original.competency === a.competency ? original.templateId : undefined,
          effectiveness: undefined,
        } : v,
      );
    });
    return true;
  }
  defaultDevelopmentDue() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 60);
    return date.toISOString().slice(0, 10);
  }
  addDevelopmentAction(planId: string, competency: number, templateId: string) {
    const p = this.state().plans.find((x) => x.id === planId);
    if (!p || !this.editable() || !this.allowedPerson(p.personId) || !this.isCurrentPlan(p))
      return this.fail("ثبت اقدام برای این برنامه مجاز نیست.");
    const template = this.state().developmentTemplates.find(
      (x) => x.id === templateId && x.competency === competency && x.isActive,
    );
    if (!template) return this.fail("الگوی انتخاب‌شده با شایستگی مطابقت ندارد.");
    if (p.actions.some((a) => a.templateId === templateId))
      return this.fail("این الگوی توسعه قبلاً به برنامه افزوده شده است.");
    this.commit("اقدام توسعه متناسب با شایستگی افزوده شد", planId, (state) => {
      state.plans.find((x) => x.id === planId)!.actions.push({
        id: crypto.randomUUID(),
        competency,
        templateId,
        title: template.title,
        kind: template.kind,
        owner: this.person(p.personId).name,
        assigneeId: p.personId,
        due: this.defaultDevelopmentDue(),
        indicator: template.indicator,
        status: "planned",
        evidence: "",
      });
    });
    return true;
  }
  reviewActionEffectiveness(
    planId: string, actionId: string, outcome: EffectivenessOutcome, note: string,
  ) {
    const p = this.state().plans.find((x) => x.id === planId);
    const action = p?.actions.find((x) => x.id === actionId);
    if (
      !p || !action || !this.canAccess(["manager"]) ||
      !this.allowedPerson(p.personId) || !this.isCurrentPlan(p)
    ) return this.fail("بررسی اثربخشی به مدیر واحد مربوط به فرد نیاز دارد.");
    if (action.status !== "completed")
      return this.fail("ابتدا اقدام باید در وضعیت انجام‌شده باشد.");
    if (!action.evidence?.trim())
      return this.fail("برای بررسی اثربخشی ابتدا شواهد انجام اقدام ثبت شود.");
    if (!["effective", "partial", "ineffective"].includes(outcome) || !note.trim())
      return this.fail("نتیجه اثربخشی و توضیح مستند مدیر الزامی است.");
    this.commit("نظر مدیر درباره اثربخشی ثبت شد", planId, (state) => {
      state.plans.find((x) => x.id === planId)!.actions
        .find((x) => x.id === actionId)!.effectiveness = {
          outcome,
          note: note.trim(),
          reviewer: "مدیر واحد",
          reviewedAt: new Date().toISOString(),
        };
    });
    return true;
  }
  /**
   * Compare the same person's published evaluation periods for the same target job.
   * IDP baseline snapshots win over today's job requirements for historic comparisons.
   * This is observed change, never a causal claim about development actions.
   */
  assessmentComparison(personId: string, jobId: string, cycleId?: string) {
    if (!this.state().people.some((p) => p.id === personId) ||
        !this.state().jobs.some((j) => j.id === jobId)) return null;
    const cycles = this.state().cycles
      .filter((c) =>
        c.subjectId === personId && c.jobId === jobId &&
        ["feedback", "closed"].includes(c.status))
      .sort((a, b) => a.created.localeCompare(b.created));
    const currentIndex = cycleId
      ? cycles.findIndex((c) => c.id === cycleId)
      : cycles.length - 1;
    if (currentIndex < 1) return null;
    const previous = cycles[currentIndex - 1];
    const current = cycles[currentIndex];
    const snapshot = (c: Cycle) => {
      const fromPlan = this.state().plans.find((p) => p.cycleId === c.id)?.baseline;
      const observed = fromPlan?.observed ?? aggregate(c).scores;
      if (!observed) return null;
      const expected = fromPlan?.expected ?? this.job(jobId).expected;
      return {
        cycleId: c.id, title: c.title, expected: [...expected],
        observed: [...observed],
        gaps: fromPlan?.gaps ? [...fromPlan.gaps] : gap(expected, observed),
      };
    };
    const older = snapshot(previous), newer = snapshot(current);
    if (!older || !newer) return null;
    const rows = competencies.map((competency, i) => ({
      competency,
      oldScore: older.observed[i],
      newScore: newer.observed[i],
      oldGap: older.gaps[i],
      newGap: newer.gaps[i],
      improvement: Math.round((older.gaps[i] - newer.gaps[i]) * 100) / 100,
    }));
    return {
      older, newer, rows,
      meanGapImprovement: Math.round(
        rows.reduce((sum, r) => sum + r.improvement, 0) / rows.length * 100,
      ) / 100,
      expectationsChanged: older.expected.some((v, i) => v !== newer.expected[i]),
    };
  }
  saveKnowledge(k: Knowledge) {
    if (!["hr", "manager", "employee"].includes(this.role())) return "";
    if (
      !k.title.trim() ||
      !k.body.trim() ||
      !k.owner.trim() ||
      !k.revision ||
      !k.taskId
    )
      return (this.fail("عنوان، متن، وظیفه، مالک و بازنگری الزامی است."), "");
    if (
      k.aar &&
      Object.entries(k.aar).some(
        ([key, v]) => key !== "done" && !String(v).trim(),
      )
    )
      return (
        this.fail("تمام محورهای AAR و اقدام مسئول‌دار را تکمیل کنید."),
        ""
      );
    const id = k.id || crypto.randomUUID();
    this.commit("پیش‌نویس دانش ذخیره شد", id, (s) => {
      const x = { ...structuredClone(k), id, status: "draft" as const };
      const index = s.knowledge.findIndex((k) => k.id === id);
      if (index >= 0) s.knowledge[index] = x;
      else s.knowledge.unshift(x);
    });
    return id;
  }
  knowledgeTransition(id: string, next: Knowledge["status"]) {
    const k = this.state().knowledge.find((k) => k.id === id);
    if (!k) return;
    if (
      next === "review" &&
      !(
        k.status === "draft" &&
        ["hr", "manager", "employee"].includes(this.role())
      )
    )
      return;
    if (
      (next === "published" || next === "draft") &&
      !(k.status === "review" && this.canApprove())
    )
      return;
    if (next === "archived" && !(k.status === "published" && this.canApprove()))
      return;
    this.commit("وضعیت دانش تغییر کرد", id, (s) => {
      s.knowledge.find((k) => k.id === id)!.status = next;
    });
  }
  viewKnowledge(id: string) {
    const k = this.state().knowledge.find((k) => k.id === id);
    if (k?.status !== "published") return;
    this.commit("محتوای منتشرشده مشاهده شد", id, (s) => {
      const x = s.knowledge.find((k) => k.id === id)!;
      x.views++;
      if (!x.viewers.includes(this.actor())) x.viewers.push(this.actor());
    });
  }
  completeAar(id: string) {
    if (!["hr", "manager", "owner"].includes(this.role())) return;
    this.commit("پیگیری اقدام درس‌آموخته به‌روزرسانی شد", id, (s) => {
      const a = s.knowledge.find((k) => k.id === id)?.aar;
      if (a) a.done = !a.done;
    });
  }
  /** Global bank administration is HR-only; never grant managers bank editing. */
  saveProspectiveIndicator(draft:ProspectiveIndicator):boolean {
    if(!this.canAccess(["hr"])) return this.fail("مدیریت شاخص‌های آینده‌نگر فقط برای منابع انسانی است.");
    const title=draft.title?.trim(),description=draft.description?.trim()??"";
    if(!title||typeof draft.isActive!=="boolean" ||
      this.state().prospectiveIndicators.some(i=>i.id!==draft.id&&i.title===title))
      return this.fail("عنوان یکتا و وضعیت معتبر برای شاخص الزامی است.");
    const existing=this.state().prospectiveIndicators.find(i=>i.id===draft.id);
    if(draft.id&&!existing)return this.fail("شاخص موردنظر وجود ندارد.");
    this.commit("شاخص آینده‌نگر ذخیره شد",draft.id||title,state=>{
      const item={id:existing?.id??crypto.randomUUID(),title,description,
        order:existing?.order??state.prospectiveIndicators.length,isActive:draft.isActive};
      const n=state.prospectiveIndicators.findIndex(i=>i.id===item.id);
      if(n>=0)state.prospectiveIndicators[n]=item;
      else state.prospectiveIndicators.push(item);
    });
    return true;
  }
  saveProspectiveQuestion(draft:ProspectiveQuestion):boolean {
    if(!this.canAccess(["hr"]))return this.fail("مدیریت بانک سؤالات آینده‌نگر فقط برای منابع انسانی است.");
    const text=draft.text?.trim();
    if(!text||typeof draft.isActive!=="boolean" ||
      !this.state().prospectiveIndicators.some(i=>i.id===draft.indicatorId))
      return this.fail("متن سؤال و شاخص مرتبط الزامی است.");
    const existing=this.state().prospectiveQuestions.find(q=>q.id===draft.id);
    if(draft.id&&!existing)return this.fail("سؤال موردنظر وجود ندارد.");
    this.commit("سؤال آینده‌نگر ذخیره شد",draft.id||draft.indicatorId,state=>{
      const item={id:existing?.id??crypto.randomUUID(),indicatorId:draft.indicatorId,text,
        order:existing?.order??state.prospectiveQuestions.filter(q=>q.indicatorId===draft.indicatorId).length,
        isActive:draft.isActive};
      const n=state.prospectiveQuestions.findIndex(q=>q.id===item.id);
      if(n>=0)state.prospectiveQuestions[n]=item;
      else state.prospectiveQuestions.push(item);
    });
    return true;
  }
  /** Manager access is limited to their own organizational unit. */
  canManageProspective(positionId:string):boolean {
    if(!this.canAccess(["hr","manager"]))return false;
    const pos=this.positionRecord(positionId);
    if(!pos||!pos.critical||pos.isActive===false)return false;
    return this.role()==="hr" || !!pos.unitId && pos.unitId===this.currentUnit(this.actor())?.id;
  }
  canViewProspective(positionId:string):boolean {
    if(!this.canAccess(["hr","manager","executive"]))return false;
    const pos=this.positionRecord(positionId);
    return !!pos && (this.role()!=="manager" ||
      !!pos.unitId && pos.unitId===this.currentUnit(this.actor())?.id);
  }
  prospectiveRunsForPosition(positionId:string):ProspectiveEvaluationRun[] {
    if(!this.canViewProspective(positionId))return [];
    return this.state().prospectiveRuns.filter(run=>run.positionId===positionId)
      .sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  }
  /** All snapshot references are copied in one commit; no later bank edit changes a run. */
  startProspectiveRun(positionId:string):string {
    if(!this.canManageProspective(positionId)){
      this.fail("شروع ارزیابی برای این پست و نقش مجاز نیست.");return "";
    }
    const state=this.state(),position=this.positionRecord(positionId)!;
    if(state.prospectiveRuns.some(r=>r.positionId===positionId&&r.status==="active")){
      this.fail("برای این پست یک دوره آینده‌نگر فعال وجود دارد.");return "";
    }
    const nominations=state.nominations.filter(n=>n.positionId===positionId);
    if(!nominations.length||new Set(nominations.map(n=>n.personId)).size!==nominations.length||
      nominations.some(n=>!state.people.some(p=>p.id===n.personId)||
        this.currentPositionHolder(positionId)?.id===n.personId)){
      this.fail("برای شروع، نامزدهای معتبر و غیرتکراری لازم است.");return "";
    }
    const {indicators,questions}=activeProspectiveBank(state.prospectiveIndicators,state.prospectiveQuestions);
    const error=prospectiveSnapshotError(indicators,questions);
    if(error){this.fail(error);return "";}
    const id=crypto.randomUUID(),now=new Date().toISOString(),by=this.actor();
    const run:ProspectiveEvaluationRun={
      id,positionId,jobId:position.jobId,positionTitle:position.title,
      startedAt:now,startedBy:by,status:"active",
      indicators:structuredClone(indicators),questions:structuredClone(questions),
      nominees:nominations.map(n=>({
        nominationId:n.id,personId:n.personId,
        personName:state.people.find(p=>p.id===n.personId)!.name,
        readiness:n.readiness,nominationEvidence:n.evidence,nominatedAt:n.at,
      })),
      results:[],
    };
    this.commit("دوره ارزیابی آینده‌نگر آغاز شد",positionId,s=>{
      s.prospectiveRuns.push(run);
    });
    return id;
  }
  submitProspectiveReview(runId:string,personId:string,answers:QuestionAnswer[],evidence:string):boolean{
    const run=this.state().prospectiveRuns.find(r=>r.id===runId);
    if(!run||!this.canManageProspective(run.positionId)||run.status!=="active"||
      !run.nominees.some(n=>n.personId===personId)||
      run.results.some(r=>r.personId===personId))
      return this.fail("ثبت ارزیابی این نامزد در دوره جاری مجاز نیست.");
    if(typeof evidence!=="string"||!evidence.trim())
      return this.fail("شواهد ارزیابی الزامی است.");
    const totals=scoreProspectiveAnswers(run.indicators,run.questions,answers);
    if(!totals)return this.fail("برای تمام سؤالات امتیاز صحیح ۱ تا ۵ ثبت کنید.");
    const by=this.actor(),now=new Date().toISOString();
    this.commit("ارزیابی آینده‌نگر نامزد تکمیل شد",personId,state=>{
      state.prospectiveRuns.find(r=>r.id===runId)!.results.push({
        personId,answers:answers.map(a=>({...a})),evidence:evidence.trim(),
        indicatorScores:totals.indicatorScores,score:totals.score,
        completedAt:now,completedBy:by,
      });
    });
    return true;
  }
  closeProspectiveRun(runId:string):boolean{
    const run=this.state().prospectiveRuns.find(r=>r.id===runId);
    if(!run||!this.canManageProspective(run.positionId)||run.status!=="active"||
      !run.nominees.length||run.results.length!==run.nominees.length)
      return this.fail("بستن دوره فقط پس از تکمیل تمام نامزدها مجاز است.");
    this.commit("دوره آینده‌نگر بسته شد",runId,state=>{
      const target=state.prospectiveRuns.find(r=>r.id===runId)!;
      target.status="closed";target.closedAt=new Date().toISOString();
    });
    return true;
  }

  nominate(n: Nomination) {
    if (!this.canManageProspective(n.positionId)) return this.fail("نامزدی فقط برای منابع انسانی یا مدیر همان واحد مجاز است.");
    if (!this.state().people.some(p=>p.id===n.personId))
      return this.fail("فرد نامزد معتبر نیست.");
    if (!n.evidence.trim()) return this.fail("شواهد و نظر انسانی الزامی است.");
    if (
      this.currentPositionHolder(n.positionId)?.id === n.personId
    )
      return this.fail("دارنده فعلی نمی‌تواند جانشین خودش باشد.");
    this.commit("نظر انسانی درباره آمادگی ثبت شد", n.positionId, (s) => {
      const old = s.nominations.find(
        (x) => x.positionId === n.positionId && x.personId === n.personId,
      );
      if (old) Object.assign(old, n, { at: new Date().toISOString() });
      else
        s.nominations.push({
          ...n,
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
        });
    });
    return true;
  }
  savePath(from: string, to: string, criteria: string) {
    if (!this.editable() || from === to || !criteria.trim() ||
      !this.publishedJobs().some((j) => j.id === from) ||
      !this.publishedJobs().some((j) => j.id === to))
      return this.fail("مبدأ و مقصد متفاوت و معیار ارتقا الزامی است.");
    this.commit("مسیر رشد ذخیره شد", from, (s) => {
      const old = s.paths.find((p) => p.from === from && p.to === to);
      if (old) old.criteria = criteria;
      else s.paths.push({ from, to, criteria });
    });
    return true;
  }
  sync() {
    if (this.role() !== "hr") return;
    this.commit("اطلاعات منابع انسانی به‌روزرسانی شد", "local-hr", (s) => {
      const p = s.people.find((p) => p.id === "p3")!;
      // Do not allow the legacy demo sync to overwrite a reviewed performance.
      if (s.performanceReviews.some((r) => r.personId === p.id && r.status === "approved")) {
        s.syncs.unshift({
          at: new Date().toISOString(), rows: 0,
          summary: "عملکرد تأییدشده موجود است؛ همگام‌سازی نمایشی آن را تغییر نداد.",
        });
        return;
      }
      p.performance = p.performance === "high" ? "medium" : "high";
      p.evidence =
        "به‌روزرسانی محلی سوابق عملکرد؛ " + new Date().toISOString();
      s.syncs.unshift({
        at: new Date().toISOString(),
        rows: 1,
        summary: "تغییر سطح عملکرد نیما روشن؛ مستقل از آمادگی جانشینی",
      });
    });
  }
  reset() {
    const s = seed();
    this.state.set(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      this.storageWarning.set("ذخیره‌سازی در دسترس نیست.");
    }
    this.notice.set("اطلاعات محلی به وضعیت اولیه بازگشتند.");
  }
}
