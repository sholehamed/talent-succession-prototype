import { Injectable, computed, signal } from "@angular/core";
import {
  Action,
  Cycle,
  DemoState,
  EffectivenessOutcome,
  Group,
  JobContent,
  Knowledge,
  Nomination,
  Role,
  competencies,
} from "./models";
import { seed } from "./seed";
import { developmentTemplates, templatesForCompetency } from "./development-templates";
import {
  aggregate,
  canStart,
  gap,
  progress,
  validateJob,
  validScores,
} from "./domain";
const KEY = "royesh.demo.v1";
@Injectable({ providedIn: "root" })
export class Store {
  readonly role = signal<Role>("hr");
  readonly actor = signal("p2");
  readonly notice = signal("");
  readonly storageWarning = signal("");
  readonly state = signal<DemoState>(this.restore());
  readonly units = computed(() => [
    ...new Set(this.state().jobs.map((j) => j.unit)),
  ]);
  readonly editable = computed(() => ["hr", "manager"].includes(this.role()));
  readonly canReport = computed(() =>
    ["hr", "manager", "executive", "employee"].includes(this.role()),
  );
  readonly canApprove = computed(() => this.role() === "owner");
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
          return d;
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
    const s = structuredClone(this.state());
    mutate(s);
    s.audit.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
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
  allowedPerson(id: string) {
    return (
      this.role() === "hr" ||
      this.role() === "executive" ||
      (this.role() === "manager" &&
        this.person(id)?.unit === "دفتر پروژه‌ها") ||
      (this.role() === "employee" && id === "p1")
    );
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
  saveJob(id: string, draft: JobContent) {
    if (!this.editable()) return this.fail("نقش فعلی اجازه ویرایش ندارد.");
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
            summary: "بازنگری و تأیید مالک خانواده",
          });
        } else x.review = decision === "submit" ? "review" : "rejected";
      },
    );
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
      !this.job(jobId)
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
  addEvaluator(id: string, personId: string, group: Group) {
    const c = this.cycle(id);
    if (this.role() !== "hr" || c?.status !== "preparing") return false;
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
    if (this.role() !== "hr" || this.cycle(id)?.status !== "preparing") return;
    this.commit("ارزیاب حذف شد", id, (s) => {
      const c = s.cycles.find((c) => c.id === id)!;
      c.assignments = c.assignments.filter((a) => a.id !== aid);
    });
  }
  advance(id: string, notes = "") {
    const c = this.cycle(id);
    if (this.role() !== "hr" || !c) return false;
    if (c.status === "preparing" && !canStart(c))
      return this.fail(
        "حداقل یک سرپرست، دو هم‌سطح، دو زیردست و در ۵۴۰ یک بیرونی لازم است.",
      );
    if (c.status === "collecting" && c.assignments.some((a) => !a.scores))
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
      x.status = next[x.status as keyof typeof next];
      if (notes) x.notes = notes.trim();
    });
    return true;
  }
  submit(id: string, aid: string, scores: number[]) {
    const c = this.cycle(id);
    const a = c?.assignments.find((a) => a.id === aid);
    if (
      this.role() !== "evaluator" ||
      a?.personId !== this.actor() ||
      c?.status !== "collecting" ||
      a.scores
    )
      return this.fail("این تکلیف برای نقش و شخصیت فعلی قابل ثبت نیست.");
    if (!validScores(scores))
      return this.fail(
        "برای هر پنج سؤال یک امتیاز صحیح از ۱ تا ۵ انتخاب کنید.",
      );
    this.commit("پرسشنامه ثبت شد", id, (s) => {
      s.cycles
        .find((c) => c.id === id)!
        .assignments.find((a) => a.id === aid)!.scores = [...scores];
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
    if (!this.person(personId) || !this.job(jobId) || !this.allowedPerson(personId))
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
    const top = [0, 1, 2, 3, 4]
      .sort((a, b) => baseline.gaps[b] - baseline.gaps[a]).slice(0, 3);
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
        actions: top.map((c, i) => {
          const template = templatesForCompetency(c)[i % 2];
          return {
            id: crypto.randomUUID(),
            competency: c,
            templateId: template.id,
            title: template.title,
            kind: template.kind,
            owner: this.person(personId).name,
            due: "2026-12-21",
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
    if (
      !p ||
      !this.allowedPerson(p.personId) ||
      !(this.editable() || (this.role() === "employee" && p.personId === "p1"))
    ) return this.fail("اجازه ویرایش این اقدام را ندارید.");
    if (!this.isCurrentPlan(p))
      return this.fail("این نسخه از برنامه توسعه آرشیوی است؛ فقط آخرین نسخه قابل ویرایش است.");
    if (!original) return this.fail("اقدام موردنظر در این برنامه وجود ندارد.");
    if (original.effectiveness)
      return this.fail("اقدام بررسی‌شده توسط مدیر قفل است؛ ثبت نتیجه جدید از طریق بازبینی مدیر انجام می‌شود.");
    if (
      !Number.isInteger(a.competency) || a.competency < 0 || a.competency >= competencies.length ||
      !a.title.trim() || !a.owner.trim() || !a.due ||
      !/^\d{4}-\d{2}-\d{2}$/.test(a.due) || !a.indicator.trim()
    ) return this.fail("شایستگی، عنوان، مسئول، مهلت معتبر و شاخص موفقیت را تکمیل کنید.");
    this.commit("اقدام توسعه به‌روزرسانی شد", planId, (state) => {
      const plan = state.plans.find((x) => x.id === planId)!;
      plan.actions = plan.actions.map((v) =>
        v.id === a.id ? { ...structuredClone(a), effectiveness: undefined } : v,
      );
    });
    return true;
  }
  addDevelopmentAction(planId: string, competency: number, templateId: string) {
    const p = this.state().plans.find((x) => x.id === planId);
    if (!p || !this.editable() || !this.allowedPerson(p.personId) || !this.isCurrentPlan(p))
      return this.fail("ثبت اقدام برای این برنامه مجاز نیست.");
    const template = developmentTemplates.find(
      (x) => x.id === templateId && x.competency === competency,
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
        due: "2026-12-21",
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
      !p || !action || this.role() !== "manager" ||
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
  nominate(n: Nomination) {
    if (!["hr", "manager"].includes(this.role())) return false;
    if (!n.evidence.trim()) return this.fail("شواهد و نظر انسانی الزامی است.");
    if (
      this.state().positions.find((p) => p.id === n.positionId)?.holderId ===
      n.personId
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
    if (!this.editable() || from === to || !criteria.trim())
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
