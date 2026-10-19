import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { seed } from "../src/app/core/seed";
import { DevelopmentTemplate } from "../src/app/core/development-templates";
import { aggregate, gap } from "../src/app/core/domain";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
});
beforeEach(() => memory.clear());
const newTemplate = (overrides: Partial<DevelopmentTemplate> = {}): DevelopmentTemplate => ({
  id: "", competency: 2, title: "حل مسئله با داده‌های عملیاتی",
  kind: "آموزش", indicator: "تحویل تحلیل مستند و تأیید مدیر", isActive: true,
  ...overrides,
});

describe("competency-linked development template catalog", () => {
  it("seeds all 5 competencies and restores legacy plans without fabricated template provenance", () => {
    const initial = seed();
    expect(initial.developmentTemplates).toHaveLength(10);
    for (let c = 0; c < 5; c++)
      expect(initial.developmentTemplates.filter((t) => t.competency === c && t.isActive)).toHaveLength(2);
    const old = { ...initial } as Record<string, unknown>;
    delete old.developmentTemplates;
    memory.set("royesh.demo.v1", JSON.stringify(old));
    const s = new Store();
    expect(s.state().developmentTemplates).toHaveLength(10);
    expect(s.state().people).toEqual(initial.people);
    expect(s.state().plans).toEqual(initial.plans);
    expect(s.state().cycles).toEqual(initial.cycles);
    expect(s.state().plans.every((p) => p.actions.every((a) => !a.templateId))).toBe(true);
    expect(new Store().state().developmentTemplates).toHaveLength(10);
  });

  it("validates HR-only catalog CRUD, uniqueness and persistent active state", () => {
    const s = new Store();
    s.role.set("manager");
    expect(s.saveDevelopmentTemplate(newTemplate())).toBe(false);
    s.role.set("hr");
    for (const bad of [
      newTemplate({ title: " " }),
      newTemplate({ kind: " " }),
      newTemplate({ indicator: " " }),
      newTemplate({ competency: -1 }),
      newTemplate({ competency: 5 }),
    ]) expect(s.saveDevelopmentTemplate(bad)).toBe(false);
    expect(s.saveDevelopmentTemplate(newTemplate())).toBe(true);
    const t = s.state().developmentTemplates.find((t) => t.title === "حل مسئله با داده‌های عملیاتی")!;
    expect(t.competency).toBe(2);
    expect(s.saveDevelopmentTemplate(newTemplate({title: t.title}))).toBe(false);
    expect(s.saveDevelopmentTemplate({ ...t, title: "تحلیل یک مسئله عملیاتی", isActive: false })).toBe(true);
    expect(s.templatesForCompetency(2).find((x) => x.id === t.id)).toBeUndefined();
    expect(s.templatesForCompetency(2, true).find((x) => x.id === t.id)?.title).toBe("تحلیل یک مسئله عملیاتی");
    expect(new Store().state().developmentTemplates.find((x) => x.id === t.id)?.isActive).toBe(false);
    expect(s.deleteDevelopmentTemplate(t.id)).toBe(true);
    expect(s.state().developmentTemplates.some((x) => x.id === t.id)).toBe(false);
    s.role.set("employee");
    expect(s.deleteDevelopmentTemplate("leadership-delegate")).toBe(false);
  });

  it("offers newly created catalog template in IDP and snapshots its title, type, indicator and competence", () => {
    const s = new Store();
    expect(s.saveDevelopmentTemplate(newTemplate())).toBe(true);
    const item = s.templatesForCompetency(2).find((x) => x.title === newTemplate().title)!;
    expect(s.addDevelopmentAction("d1", 0, item.id)).toBe(false);
    expect(s.addDevelopmentAction("d1", 2, item.id)).toBe(true);
    expect(s.addDevelopmentAction("d1", 2, item.id)).toBe(false);
    const action = s.state().plans.find((p) => p.id === "d1")!.actions.find((a) => a.templateId === item.id)!;
    expect(action).toMatchObject({
      competency: 2, title: item.title, kind: item.kind, indicator: item.indicator, status: "planned",
    });
    expect(s.templateUsageCount(item.id)).toBe(1);
    expect(s.saveDevelopmentTemplate({ ...item, title: "عنوان بعدی", indicator: "شاخص بعدی", isActive: false })).toBe(true);
    expect(s.addDevelopmentAction("d2", 2, item.id)).toBe(false);
    const after = s.state().plans.find((p) => p.id === "d1")!.actions.find((a) => a.id === action.id)!;
    expect(after).toEqual(action);
    expect(s.deleteDevelopmentTemplate(item.id)).toBe(false);
    expect(s.saveDevelopmentTemplate({ ...item, competency: 3 })).toBe(false);
    expect(s.state().developmentTemplates.find((t) => t.id === item.id)?.competency).toBe(2);

    const moved = { ...after, competency: 3, title: "اقدام سفارشی دیگری" };
    expect(s.saveAction("d1", moved)).toBe(true);
    expect(s.state().plans.find((p) => p.id === "d1")!.actions.find((a) => a.id === action.id)?.templateId)
      .toBeUndefined();
    expect(s.templateUsageCount(item.id)).toBe(0);
  });

  it("uses active competency templates when creating a cycle-backed plan from its real assessment gap", () => {
    const s = new Store();
    const target = s.state().developmentTemplates.find((t) => t.id === "problem-rootcause")!;
    expect(s.saveDevelopmentTemplate({ ...target, isActive: false })).toBe(true);
    const cycle = s.cycle("c0")!;
    const id = s.createPlan(cycle.subjectId, cycle.jobId, cycle.id);
    expect(id).toBeTruthy();
    const p = s.state().plans.find((x) => x.id === id)!;
    const baseline = aggregate(cycle).scores!;
    expect(p.baseline?.observed).toEqual(baseline);
    expect(p.baseline?.expected).toEqual(s.job(cycle.jobId).expected);
    expect(p.baseline?.gaps).toEqual(gap(s.job(cycle.jobId).expected, baseline));
    expect(p.actions).toHaveLength(3);
    expect(p.actions.every((a) => !!a.templateId && !!s.state().developmentTemplates.find(
      (t) => t.id === a.templateId && t.isActive && t.competency === a.competency,
    ))).toBe(true);
    expect(p.actions.some((a) => a.templateId === target.id)).toBe(false);
    const prev = structuredClone(p);
    expect(s.saveDevelopmentTemplate({ ...s.state().developmentTemplates.find(
      (t) => t.id === p.actions[0].templateId)!,
      title: "اصلاح کاتالوگ بدون دست‌زدن به برنامه",
    })).toBe(true);
    expect(s.state().plans.find((x) => x.id === id)).toEqual(prev);
    expect(new Store().state().plans.find((x) => x.id === id)).toEqual(prev);
  });

  it("falls back to multiple templates of remaining competencies, and fails safely when fewer than 3 exist", () => {
    const s = new Store();
    for (const t of [...s.state().developmentTemplates])
      if (t.competency > 1) expect(s.saveDevelopmentTemplate({...t, isActive: false})).toBe(true);
    const id = s.createPlan("p1", "j1", "c0");
    expect(id).toBeTruthy();
    expect(s.state().plans.find((p) => p.id === id)?.actions).toHaveLength(3);
    s.reset();
    for (const t of [...s.state().developmentTemplates].slice(2))
      expect(s.saveDevelopmentTemplate({ ...t, isActive: false })).toBe(true);
    const before = s.state().plans.length;
    expect(s.createPlan("p1", "j1", "c0")).toBe("");
    expect(s.notice()).toContain("سه الگوی فعال");
    expect(s.state().plans).toHaveLength(before);
  });
});
