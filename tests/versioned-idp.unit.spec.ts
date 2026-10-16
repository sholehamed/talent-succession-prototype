import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { aggregate } from "../src/app/core/domain";

const local = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  },
});
beforeEach(() => local.clear());

describe("versioned individual development plans", () => {
  it("uses exactly one plan per published cycle and preserves its baseline", () => {
    const store = new Store();
    const c0 = store.cycle("c0")!;
    const id = store.createPlan("p1", "j1", "c0");
    expect(id).toBeTruthy();
    const p = store.state().plans.find((x) => x.id === id)!;
    expect(p.cycleId).toBe("c0");
    expect(p.version).toBe(1);
    expect(p.period).toBe(c0.period);
    expect(p.actions).toHaveLength(3);
    expect(p.baseline!.observed).toEqual(aggregate(c0).scores);
    expect(p.baseline!.expected).toEqual(store.job("j1").expected);

    const revised = { ...p.actions[0], status: "completed" as const };
    expect(store.saveAction(id, revised)).toBe(true);
    const count = store.state().plans.length;
    expect(store.createPlan("p1", "j1", "c0")).toBe(id);
    expect(store.state().plans.length).toBe(count);
    expect(store.state().plans.find((x) => x.id === id)!.actions[0].status)
      .toBe("completed");
  });

  it("rejects unfinished, mismatched and unknown cycle sources without creating a plan", () => {
    const store = new Store();
    const original = store.state().plans.length;
    expect(store.createPlan("p1", "j1", "c1")).toBe("");
    expect(store.createPlan("p2", "j1", "c0")).toBe("");
    expect(store.createPlan("p1", "j2", "c0")).toBe("");
    expect(store.createPlan("p1", "j1", "missing")).toBe("");
    expect(store.createPlan("missing", "j1")).toBe("");
    expect(store.state().plans).toHaveLength(original);
  });

  it("creates a new version from a later approved cycle while older records are read-only", () => {
    const store = new Store();
    const first = store.createPlan("p1", "j1", "c0");
    const originalBaseline = structuredClone(
      store.state().plans.find((p) => p.id === first)!.baseline!,
    );
    const updated = structuredClone(store.job("j1"));
    updated.expected[4] = 5;
    expect(store.saveJob("j1", updated)).toBe(true);
    expect(store.reviewJob("j1", "submit")).toBe(true);
    store.role.set("owner");
    expect(store.reviewJob("j1", "approve")).toBe(true);
    store.role.set("hr");

    store.commit("گزارش دوره جدید تأیید شد", "c1", (state) => {
      const cycle = state.cycles.find((c) => c.id === "c1")!;
      cycle.status = "feedback";
      cycle.assignments.forEach((assignment) => {
        assignment.scores = [4, 4, 4, 4, 4];
      });
    });

    const second = store.createPlan("p1", "j1", "c1");
    expect(second).not.toBe(first);
    expect(store.createPlan("p1", "j1", "c1")).toBe(second);
    const older = store.state().plans.find((p) => p.id === first)!;
    const current = store.state().plans.find((p) => p.id === second)!;
    expect(older.version).toBe(1);
    expect(current.version).toBe(2);
    expect(older.baseline).toEqual(originalBaseline);
    expect(current.baseline!.expected[4]).toBe(5);
    expect(current.baseline!.observed).toEqual([4, 4, 4, 4, 4]);
    expect(current.period).toBe(store.cycle("c1")!.period);
    expect(store.isCurrentPlan(older)).toBe(false);
    expect(store.isCurrentPlan(current)).toBe(true);
    expect(store.saveAction(first, { ...older.actions[0], status: "completed" }))
      .toBe(false);
    expect(store.saveAction(second, { ...current.actions[0], status: "completed" }))
      .toBe(true);

    const restored = new Store();
    expect(restored.state().plans.find((p) => p.id === first)).toEqual(older);
    expect(restored.state().plans.find((p) => p.id === second)!.actions[0].status)
      .toBe("completed");
  });

  it("retains old unversioned browser data, and manual plans are distinct from cycle plans", () => {
    const store = new Store();
    const seeded = store.state().plans.find((p) => p.id === "d1")!;
    expect(seeded.version).toBeUndefined();
    expect(store.planVersion(seeded)).toBe(1);
    expect(store.createPlan(seeded.personId, seeded.jobId)).toBe("d1");

    const manual = store.createPlan("p1", "j1");
    const fromCycle = store.createPlan("p1", "j1", "c0");
    expect(fromCycle).not.toBe(manual);
    expect(store.state().plans.find((p) => p.id === fromCycle)!.version).toBe(2);
    expect(store.createPlan("p1", "j1")).toBe(manual);
    expect(new Store().state().plans.find((p) => p.id === "d1")).toEqual(seeded);
  });
});
