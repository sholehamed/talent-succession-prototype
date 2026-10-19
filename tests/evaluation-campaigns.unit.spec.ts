import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { canStart } from "../src/app/core/domain";

const saved = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  },
});
beforeEach(() => saved.clear());

const scope = { type: "all" as const, ids: [] as string[] };
const create = (s: Store, period = "1406-spring") =>
  s.createCampaign("کمپین شایستگی کارکنان", period, "2026-10-19", 360, scope);

describe("periodic evaluation campaigns", () => {
  it("migrates browser snapshots without changing legacy cycles, decisions and assignments", () => {
    const state = new Store().state();
    const legacy = structuredClone(state) as Record<string, unknown>;
    delete legacy.campaigns;
    saved.set("royesh.demo.v1", JSON.stringify(legacy));
    const s = new Store();
    expect(s.state().campaigns).toEqual([]);
    expect(s.state().cycles).toEqual(state.cycles);
    expect(s.state().appointments).toEqual(state.appointments);
    expect(s.state().candidates).toEqual(state.candidates);
    expect(s.state().plans).toEqual(state.plans);
    expect(s.state().performanceReviews).toEqual(state.performanceReviews);
  });

  it("enforces HR role and valid scope, date and 360-only policy", () => {
    const s = new Store();
    s.role.set("manager");
    expect(create(s)).toBe("");
    s.role.set("hr");
    expect(s.createCampaign("نام", "1406-a", "2026-02-30", 360, scope)).toBe("");
    expect(s.createCampaign("نام", "1406-a", "2026-10-19", 360,
      { type: "unit", ids: [] })).toBe("");
    expect(s.createCampaign("نام", "1406-a", "2026-10-19", 360,
      { type: "people", ids: ["unknown"] })).toBe("");
    const before = s.state().cycles.length;
    expect(s.createCampaign("۵۴۰ بدون ذی‌نفع", "1406-a", "2026-10-19", 540, scope)).toBe("");
    expect(s.state().cycles).toHaveLength(before);
    const id = create(s);
    expect(id).toBeTruthy();
    expect(s.state().campaigns.find(c => c.id === id)?.status).toBe("draft");
    expect(s.state().cycles.some(c => c.campaignId === id)).toBe(true);
    expect(s.state().cycles.filter(c => c.campaignId === id)
      .every(c => c.status === "preparing")).toBe(true);
    s.role.set("manager");
    expect(s.startCampaign(id)).toBe(false);
  });

  it("enrolls every eligible employee during creation with no automatic collecting", () => {
    const s = new Store();
    const old = s.state().cycles.map(c => ({ id: c.id, assignments: structuredClone(c.assignments) }));
    const before = s.state().cycles.length;
    const preview = s.previewCampaign(scope, "1406-spring", "2026-10-19", 360);
    expect(preview.length).toBeGreaterThan(5);
    const eligible = preview.filter(x => !x.reason);
    expect(eligible.length).toBeGreaterThan(0);
    const id = create(s);
    const cycles = s.state().cycles.filter(c => c.campaignId === id);
    expect(cycles).toHaveLength(eligible.length);
    expect(s.state().cycles).toHaveLength(before + eligible.length);
    expect(s.state().campaigns[0].status).toBe("draft");
    expect(s.state().campaigns[0].exclusions.length).toBe(preview.length - eligible.length);
    for (const cycle of cycles) {
      expect(cycle.status).toBe("preparing");
      expect(cycle.questions?.length).toBeGreaterThan(0);
      expect(cycle.organizationSnapshot?.asOf).toBe("2026-10-19");
      expect(cycle.organizationSnapshot?.positionId).toBeTruthy();
      expect(canStart(cycle)).toBe(true);
      expect(new Set(cycle.assignments.map(a => a.personId)).size).toBe(cycle.assignments.length);
      expect(cycle.assignments.some(a => a.personId === cycle.subjectId)).toBe(false);
      for (const group of ["peer", "subordinate"] as const) {
        const n = cycle.assignments.filter(a => a.group === group).length;
        expect(n === 0 || n >= 2).toBe(true);
      }
    }
    for (const record of old)
      expect(s.state().cycles.find(c => c.id === record.id)?.assignments).toEqual(record.assignments);
    expect(new Store().state().campaigns[0].id).toBe(id);
    expect(s.state().cycles.filter(c => c.status === "collecting" && c.campaignId === id)).toHaveLength(0);
  });

  it("starts response collection only on explicit HR action and is idempotent", () => {
    const s = new Store(), id = create(s);
    const count = s.state().cycles.filter(c => c.campaignId === id).length;
    expect(s.startCampaign(id)).toBe(true);
    expect(s.state().campaigns.find(c => c.id === id)?.status).toBe("active");
    expect(s.state().cycles.filter(c => c.campaignId === id && c.status === "collecting"))
      .toHaveLength(count);
    expect(s.startCampaign(id)).toBe(false);
    expect(s.closeCampaign(id)).toBe(false);
  });

  it("rejects the entire batch if any prepared cycle loses its required evaluator", () => {
    const s = new Store(), id = create(s);
    const cycle = s.state().cycles.find(c =>
      c.campaignId === id && c.requiredGroups?.supervisor === 1)!;
    expect(cycle).toBeTruthy();
    s.commit("حذف ارزیاب آزمایشی", "test", state => {
      state.cycles.find(c => c.id === cycle.id)!.assignments =
        state.cycles.find(c => c.id === cycle.id)!.assignments.filter(a => a.group !== "supervisor");
    });
    expect(s.startCampaign(id)).toBe(false);
    expect(s.state().campaigns.find(c => c.id === id)?.status).toBe("draft");
    expect(s.state().cycles.filter(c => c.campaignId === id && c.status === "collecting")).toHaveLength(0);
  });

  it("freezes people, job, assignments and questions at creation despite later chart edits", () => {
    const s = new Store(), id = create(s);
    const one = s.state().cycles.find(c => c.campaignId === id)!;
    const assignments = structuredClone(one.assignments);
    const questions = structuredClone(one.questions);
    const snapshot = structuredClone(one.organizationSnapshot);
    const count = s.state().cycles.filter(c => c.campaignId === id).length;
    s.commit("تغییر نمایشی", "test", state => {
      state.positions.forEach(p => p.parentPositionId = null);
      state.questions[0].text = "متن ویرایش شده";
    });
    expect(s.state().cycles.filter(c => c.campaignId === id)).toHaveLength(count);
    const after = s.cycle(one.id)!;
    expect(after.assignments).toEqual(assignments);
    expect(after.questions).toEqual(questions);
    expect(after.organizationSnapshot).toEqual(snapshot);
    expect(s.startCampaign(id)).toBe(true);
    expect(s.cycle(one.id)?.questions).toEqual(questions);
  });

  it("rejects duplicate person/period/mode when creating a second group", () => {
    const s = new Store(), id = create(s);
    expect(id).toBeTruthy();
    const before = s.state().cycles.length;
    expect(create(s)).toBe("");
    const preview = s.previewCampaign(scope, "1406-spring", "2026-10-19", 360);
    expect(preview.filter(x => !x.reason)).toHaveLength(0);
    expect(preview.every(x => x.reason?.includes("قبلاً"))).toBe(true);
    expect(s.state().cycles).toHaveLength(before);
  });

  it("keeps exceptional people out while enrolling eligible selected employees", () => {
    const s = new Store();
    s.commit("ثبت وضعیت تشکیلات", "test", state => {
      state.appointments = state.appointments.filter(a => a.personId !== "p3");
    });
    const selection = { type: "people" as const, ids: ["p3", "p2"] };
    const preview = s.previewCampaign(selection, "1407-summer", "2026-10-19", 360);
    expect(preview).toHaveLength(2);
    expect(preview.find(x => x.personId === "p3")?.reason).toContain("انتصاب");
    const count = s.state().cycles.length;
    const id = s.createCampaign("بررسی منتخب", "1407-summer", "2026-10-19", 360, selection);
    const good = preview.filter(x => !x.reason);
    if (good.length) {
      expect(id).toBeTruthy();
      expect(s.state().cycles.filter(c => c.campaignId === id)).toHaveLength(good.length);
      expect(s.state().campaigns.find(c => c.id === id)?.exclusions).toEqual([
        expect.objectContaining({ personId: "p3" }),
      ]);
    } else {
      expect(id).toBe("");
      expect(s.state().cycles).toHaveLength(count);
    }
  });
});
