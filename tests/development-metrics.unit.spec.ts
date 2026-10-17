import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { seed } from "../src/app/core/seed";
import { Store } from "../src/app/core/store";
import { developmentMetrics } from "../src/app/core/development-metrics";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});
beforeEach(() => storage.clear());
const everyone = (s: ReturnType<typeof seed>) => new Set(s.people.map(p => p.id));

describe("human capital development metrics", () => {
  it("keeps zero, missing and completed-action denominators distinct", () => {
    const state = seed();
    const all = developmentMetrics(state, everyone(state), "1405-autumn");
    expect(all.totalActions).toBe(24);
    expect(all.completed).toBe(8);
    expect(all.activityPercent).toBe(33);
    expect(all.reviewed).toBe(0);
    expect(all.effectivePercent).toBeNull();
    expect(all.reviewCoverage).toBe(0);
    expect(all.growthRows).toEqual([]);
    expect(all.meanObservedChange).toBeNull();

    const summer = developmentMetrics(state, everyone(state), "1405-summer");
    expect(summer.activityPercent).toBeNull();
    expect(summer.effectivePercent).toBeNull();
    expect(summer.reviewCoverage).toBeNull();
    const nobody = developmentMetrics(state, new Set(), "");
    expect(nobody.plans).toEqual([]);
    expect(nobody.growthRows).toEqual([]);
  });

  it("counts only manager-reviewed completed actions, by filter and outcome", () => {
    const store = new Store();
    const id = store.createPlan("p1", "j1", "c0");
    const p = store.state().plans.find(x => x.id === id)!;
    const a = p.actions[0], b = p.actions[1];
    expect(store.saveAction(id, { ...a, status: "completed", evidence: "مدرک ثبت شد" })).toBe(true);
    expect(store.saveAction(id, { ...b, status: "completed", evidence: "صورتجلسه ثبت شد" })).toBe(true);
    store.role.set("manager");
    expect(store.reviewActionEffectiveness(id, a.id, "effective", "شواهد و نتیجه بررسی شد")).toBe(true);
    expect(store.reviewActionEffectiveness(id, b.id, "partial", "پیشرفت ناقص")).toBe(true);
    const summer = developmentMetrics(store.state(), new Set(["p1"]), "1405-summer");
    expect(summer.totalActions).toBe(3);
    expect(summer.completed).toBe(2);
    expect(summer.reviewed).toBe(2);
    expect(summer.effective).toBe(1);
    expect(summer.partial).toBe(1);
    expect(summer.ineffective).toBe(0);
    expect(summer.activityPercent).toBe(67);
    expect(summer.effectivePercent).toBe(50);
    expect(summer.reviewCoverage).toBe(100);
    expect(developmentMetrics(store.state(), new Set(["p2"]), "1405-summer").reviewed).toBe(0);
    expect(developmentMetrics(store.state(), new Set(["p1"]), "1405-autumn").reviewed).toBe(0);
    expect(new Store().state().plans.find(p => p.id === id)!.actions[0].effectiveness?.outcome)
      .toBe("effective");
  });

  it("shows one matched published cross-period comparison for the same person and job", () => {
    const s = new Store();
    const first = s.createPlan("p1", "j1", "c0");
    expect(first).toBeTruthy();
    s.commit("ثبت نتایج جدید", "c1", (state) => {
      const c = state.cycles.find(x => x.id === "c1")!;
      c.status = "feedback";
      c.assignments.forEach(a => { a.scores = [4, 4, 4, 4, 4]; });
    });
    s.createPlan("p1", "j1", "c1");
    const autumn = developmentMetrics(s.state(), new Set(["p1"]), "1405-autumn");
    expect(autumn.growthRows).toHaveLength(1);
    expect(autumn.growthRows[0].previousCycleId).toBe("c0");
    expect(autumn.growthRows[0].currentCycleId).toBe("c1");
    expect(autumn.growthRows[0].observedChange).toBeGreaterThan(0);
    expect(autumn.growthRows[0].historicalExpectedEstimated).toBe(false);
    expect(autumn.meanObservedChange).toBe(autumn.growthRows[0].observedChange);
    expect(developmentMetrics(s.state(), new Set(["p1"]), "1405-summer").growthRows)
      .toHaveLength(0);
    expect(developmentMetrics(s.state(), new Set(["p2"]), "1405-autumn").growthRows)
      .toHaveLength(0);
  });

  it("does not double count many cycles within one period, or compare different jobs", () => {
    const s = new Store();
    s.commit("انتشار دو چرخه", "c1", (state) => {
      const c1 = state.cycles.find(c => c.id === "c1")!;
      c1.status = "feedback";
      c1.assignments.forEach(a => { a.scores = [4, 4, 4, 4, 4]; });
      state.cycles.push({
        ...structuredClone(c1),
        id: "c2",
        title: "ارزیابی دوم پاییز",
        created: "2026-11-10",
        assignments: c1.assignments.map(a => ({ ...a, id: "new-" + a.id, scores: [5, 5, 5, 5, 5] })),
      });
    });
    const report = developmentMetrics(s.state(), new Set(["p1"]), "");
    expect(report.growthRows).toHaveLength(1);
    expect(report.growthRows[0].currentCycleId).toBe("c2");
    expect(report.growthRows[0].previousCycleId).toBe("c0");
    expect(report.growthRows[0].historicalExpectedEstimated).toBe(true);
  });
});
