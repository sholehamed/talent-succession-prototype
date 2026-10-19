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
  it("migrates browser snapshots without changing legacy cycles, decisions, and assignments", () => {
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

  it("requires HR; rejects invalid scope, dates and unconfigured selections", () => {
    const s = new Store();
    s.role.set("manager");
    expect(create(s)).toBe("");
    s.role.set("hr");
    expect(s.createCampaign("نام", "1406-a", "2026-02-30", 360, scope)).toBe("");
    expect(s.createCampaign("نام", "1406-a", "2026-10-19", 360,
      { type: "unit", ids: [] })).toBe("");
    expect(s.createCampaign("نام", "1406-a", "2026-10-19", 360,
      { type: "people", ids: ["unknown"] })).toBe("");
    const id = create(s);
    expect(id).toBeTruthy();
    expect(s.state().campaigns.find(c => c.id === id)?.status).toBe("draft");
    expect(s.state().cycles.some(c => c.campaignId === id)).toBe(false);
    s.role.set("manager");
    expect(s.publishCampaign(id)).toBe(false);
  });

  it("publishes all eligible persons in one transaction with position-derived evaluators", () => {
    const s = new Store();
    const old = s.state().cycles.map(c => ({ id: c.id, assignments: structuredClone(c.assignments) }));
    const before = s.state().cycles.length;
    const id = create(s);
    const preview = s.previewCampaign(scope, "1406-spring", "2026-10-19", 360);
    expect(preview.length).toBeGreaterThan(5);
    const eligible = preview.filter(x => !x.reason);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every(x => x.assignments.length > 0)).toBe(true);
    expect(s.publishCampaign(id)).toBe(true);
    const cycles = s.state().cycles.filter(c => c.campaignId === id);
    expect(cycles).toHaveLength(eligible.length);
    expect(s.state().cycles).toHaveLength(before + eligible.length);
    expect(s.state().campaigns[0].status).toBe("active");
    expect(s.state().campaigns[0].exclusions.length).toBe(preview.length - eligible.length);
    for (const cycle of cycles) {
      expect(cycle.status).toBe("collecting");
      expect(cycle.questions?.length).toBeGreaterThan(0);
      expect(cycle.organizationSnapshot?.asOf).toBe("2026-10-19");
      expect(cycle.organizationSnapshot?.positionId).toBeTruthy();
      expect(canStart(cycle)).toBe(true);
      expect(new Set(cycle.assignments.map(a => a.personId)).size).toBe(cycle.assignments.length);
      expect(cycle.assignments.some(a => a.personId === cycle.subjectId)).toBe(false);
      for (const group of ["peer", "subordinate"] as const) {
        const groupCount = cycle.assignments.filter(a => a.group === group).length;
        expect(groupCount === 0 || groupCount >= 2).toBe(true);
      }
    }
    for (const record of old)
      expect(s.state().cycles.find(c => c.id === record.id)?.assignments).toEqual(record.assignments);
    expect(new Store().state().campaigns[0].id).toBe(id);
    expect(s.publishCampaign(id)).toBe(false);
  });

  it("keeps cycle assignments and questions unchanged when chart and bank later change", () => {
    const s = new Store(), id = create(s);
    expect(s.publishCampaign(id)).toBe(true);
    const one = s.state().cycles.find(c => c.campaignId === id)!;
    const assignments = structuredClone(one.assignments);
    const questions = structuredClone(one.questions);
    const snapshot = structuredClone(one.organizationSnapshot);
    s.commit("تغییر نمایشی", "test", state => {
      state.positions.forEach(p => p.parentPositionId = null);
      state.questions[0].text = "متن ویرایش شده";
    });
    const after = s.cycle(one.id)!;
    expect(after.assignments).toEqual(assignments);
    expect(after.questions).toEqual(questions);
    expect(after.organizationSnapshot).toEqual(snapshot);
  });

  it("rejects duplicate person/period/mode cycles and never fakes external 540 raters", () => {
    const s = new Store(), id = create(s);
    expect(s.publishCampaign(id)).toBe(true);
    const another = create(s);
    const preview = s.previewCampaign(scope, "1406-spring", "2026-10-19", 360);
    expect(preview.filter(x => !x.reason)).toHaveLength(0);
    expect(preview.every(x => x.reason?.includes("قبلاً"))).toBe(true);
    expect(s.publishCampaign(another)).toBe(false);
    const external = s.createCampaign("آزمون ۵۴۰", "1407-spring", "2026-10-19", 540, scope);
    expect(external).toBeTruthy();
    const before = s.state().cycles.length;
    expect(s.publishCampaign(external)).toBe(false);
    expect(s.state().cycles).toHaveLength(before);
    expect(s.notice()).toContain("ذی‌نفعان بیرونی");
    expect(s.state().campaigns.find(c => c.id === external)?.status).toBe("draft");
    expect(s.closeCampaign(id)).toBe(false);
  });

  it("supports explicit employee selection while reporting missing staffing as an exception", () => {
    const s = new Store();
    s.commit("ثبت وضعیت تشکیلات", "test", state => {
      state.appointments = state.appointments.filter(a => a.personId !== "p3");
    });
    const selection = {type:"people" as const,ids:["p3","p2"]};
    const preview=s.previewCampaign(selection,"1407-summer","2026-10-19",360);
    expect(preview).toHaveLength(2);
    expect(preview.find(x=>x.personId==="p3")?.reason).toContain("انتصاب");
    const id=s.createCampaign("بررسی منتخب","1407-summer","2026-10-19",360,selection);
    const good=preview.filter(x=>!x.reason);
    if(good.length){
      expect(s.publishCampaign(id)).toBe(true);
      expect(s.state().campaigns.find(c=>c.id===id)?.exclusions).toEqual([
        expect.objectContaining({personId:"p3"}),
      ]);
    }else expect(s.publishCampaign(id)).toBe(false);
  });
});
