import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { defaultDevelopmentTemplates } from "../src/app/core/development-templates";

const browserStore = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => browserStore.get(key) ?? null,
    setItem: (key: string, value: string) => browserStore.set(key, value),
    removeItem: (key: string) => browserStore.delete(key),
  },
});
beforeEach(() => browserStore.clear());

describe("competency-led development and effectiveness", () => {
  it("provides two distinct relevant suggestions for every competency", () => {
    for (let i = 0; i < 5; i++) {
      const choices = new Store().templatesForCompetency(i);
      expect(choices).toHaveLength(2);
      expect(new Set(choices.map((t) => t.id)).size).toBe(2);
      expect(choices.every((t) => t.competency === i && t.title && t.indicator)).toBe(true);
    }
    expect(defaultDevelopmentTemplates()).toHaveLength(10);
  });

  it("creates actions from the actual gap and supports additional validated templates", () => {
    const s = new Store();
    const id = s.createPlan("p1", "j1", "c0");
    const plan = s.state().plans.find((p) => p.id === id)!;
    expect(plan.actions).toHaveLength(3);
    for (const action of plan.actions) {
      const template = s.state().developmentTemplates.find((t) => t.id === action.templateId);
      expect(template).toBeTruthy();
      expect(action.competency).toBe(template!.competency);
      expect(action.title).toBe(template!.title);
      expect(action.indicator).toBe(template!.indicator);
    }
    expect(s.addDevelopmentAction(id, 4, "leadership-delegate")).toBe(true);
    expect(s.addDevelopmentAction(id, 4, "leadership-delegate")).toBe(false);
    expect(s.addDevelopmentAction(id, 4, "communication-brief")).toBe(false);
    const added = s.state().plans.find((p) => p.id === id)!.actions.at(-1)!;
    expect(added.competency).toBe(4);
    expect(added.kind).toBe("مأموریت عملی");
    expect(new Store().state().plans.find((p) => p.id === id)!.actions.at(-1))
      .toEqual(added);
  });

  it("separates completed activities from effectiveness; only manager in scope can review evidence", () => {
    const s = new Store();
    const id = s.createPlan("p1", "j1", "c0");
    const original = s.state().plans.find((p) => p.id === id)!.actions[0];
    expect(s.reviewActionEffectiveness(id, original.id, "effective", "نتیجه مستند")).toBe(false);
    expect(s.saveAction(id, { ...original, status: "completed" })).toBe(true);
    s.role.set("manager");
    expect(s.reviewActionEffectiveness(id, original.id, "effective", "نتیجه مستند")).toBe(false);
    s.role.set("hr");
    const updated = s.state().plans.find((p) => p.id === id)!.actions[0];
    expect(s.saveAction(id, { ...updated, evidence: "تحویل خروجی و بازخورد ثبت شده" })).toBe(true);
    expect(s.reviewActionEffectiveness(id, original.id, "effective", "توضیح مدیر")).toBe(false);
    s.role.set("manager");
    expect(s.reviewActionEffectiveness(id, original.id, "partial", "بازخورد و خروجی مرور شد")).toBe(true);
    const reviewed = s.state().plans.find((p) => p.id === id)!.actions[0];
    expect(reviewed.effectiveness?.outcome).toBe("partial");
    expect(reviewed.effectiveness?.note).toContain("بازخورد");
    expect(reviewed.effectiveness?.reviewedAt).toBeTruthy();
    expect(s.saveAction(id, { ...reviewed, title: "دستکاری عنوان" })).toBe(false);
    expect(new Store().state().plans.find((p) => p.id === id)!.actions[0].effectiveness)
      .toEqual(reviewed.effectiveness);
  });

  it("does not permit review on historical plans or another manager unit", () => {
    const s = new Store();
    const id = s.createPlan("p1", "j1", "c0");
    const action = s.state().plans.find((p) => p.id === id)!.actions[0];
    s.saveAction(id, { ...action, evidence: "شاهد", status: "completed" });
    s.commit("دوره جدید تکمیل شد", "c1", (state) => {
      const c = state.cycles.find((c) => c.id === "c1")!;
      c.status = "feedback";
      for (const x of c.assignments) x.scores = [4, 4, 4, 4, 4];
    });
    expect(s.createPlan("p1", "j1", "c1")).toBeTruthy();
    s.role.set("manager");
    expect(s.reviewActionEffectiveness(id, action.id, "effective", "بهبود تأیید شد"))
      .toBe(false);
    expect(s.addDevelopmentAction(id, 4, "leadership-delegate")).toBe(false);
    s.role.set("hr");
    const other = s.createPlan("p2", "j2");
    const second = s.state().plans.find((p) => p.id === other)!.actions[0];
    s.saveAction(other, { ...second, evidence: "شاهد", status: "completed" });
    s.role.set("manager"); // demo manager scope: office of projects only
    expect(s.reviewActionEffectiveness(other, second.id, "effective", "بهبود")).toBe(false);
  });

  it("compares observed competency gaps only across the same person's approved cycles", () => {
    const s = new Store();
    expect(s.assessmentComparison("p1", "j1")).toBeNull();
    expect(s.assessmentComparison("p1", "j1", "c0")).toBeNull();
    s.createPlan("p1", "j1", "c0");
    s.commit("تأیید ارزیابی جدید", "c1", (state) => {
      const cycle = state.cycles.find((x) => x.id === "c1")!;
      cycle.status = "feedback";
      cycle.assignments.forEach((a) => { a.scores = [4, 4, 4, 4, 4]; });
    });
    const latest = s.createPlan("p1", "j1", "c1");
    const trend = s.assessmentComparison("p1", "j1");
    expect(trend?.older.cycleId).toBe("c0");
    expect(trend?.newer.cycleId).toBe("c1");
    expect(trend?.rows).toHaveLength(5);
    expect(trend!.meanGapImprovement).toBeGreaterThan(0);
    expect(trend?.expectationsChanged).toBe(false);
    const preserved = structuredClone(trend!.older);
    const job = structuredClone(s.job("j1"));
    job.expected[4] = 5;
    s.saveJob("j1", job);
    s.reviewJob("j1", "submit");
    s.role.set("owner");
    s.reviewJob("j1", "approve");
    s.role.set("hr");
    expect(s.assessmentComparison("p1", "j1")?.older).toEqual(preserved);
    expect(s.assessmentComparison("p1", "j1")?.newer.expected)
      .toEqual(s.state().plans.find((p) => p.id === latest)!.baseline?.expected);
    expect(s.assessmentComparison("p2", "j1")).toBeNull();
    expect(s.assessmentComparison("p1", "j2")).toBeNull();
    expect(s.assessmentComparison("p1", "j1", "missing")).toBeNull();
  });

  it("reads old LocalStorage action records without evidence or effectiveness fields", () => {
    const s = new Store();
    expect(s.state().plans[0].actions[0].evidence).toBeUndefined();
    expect(s.state().plans[0].actions[0].effectiveness).toBeUndefined();
    expect(new Store().state()).toEqual(s.state());
  });
});
