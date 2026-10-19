import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { performanceBand, performanceScore } from "../src/app/core/performance";
import { PerformanceKpiInput } from "../src/app/core/models";

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

function kpis(s: Store, personId: string, values: number[]): PerformanceKpiInput[] {
  return s.job(s.person(personId).jobId).kpis.map((k, i) => ({
    title: k.title,
    achievement: values[i],
    evidence: "گزارش منبع رسمی و صورت‌جلسه تأیید مدیر",
  }));
}
function newEmployee(s: Store): string {
  const candidateId = s.registerCandidate("کارمند جدید", "j1");
  expect(s.recordEntryAssessment(candidateId, [4, 4, 4, 4, 4], "high",
    "شواهد مصاحبه اولیه", "پتانسیل رشد بالا")).toBe(true);
  const id = s.decideCandidate(candidateId, "hired", "تأیید ثبت استخدام",
    { code: "EMP-8000", managerId: "p11", hiredAt: "2026-10-18" });
  expect(id).not.toBe(false);
  return id as string;
}

describe("periodic KPI performance lifecycle", () => {
  it("uses transparent thresholds independent of competency aggregation", () => {
    expect(performanceScore([80, 90, 70])).toBe(80);
    expect(performanceScore([70, 71, 72])).toBe(71);
    expect(performanceBand(49)).toBe("low");
    expect(performanceBand(50)).toBe("medium");
    expect(performanceBand(79)).toBe("medium");
    expect(performanceBand(80)).toBe("high");
    expect(() => performanceScore([])).toThrow();
    expect(() => performanceScore([101])).toThrow();
  });

  it("restores old LocalStorage without losing existing people, hiring or evaluations", () => {
    const s = new Store();
    const original = s.state();
    const old = structuredClone(original) as Record<string, unknown>;
    delete old.performanceReviews;
    local.set("royesh.demo.v1", JSON.stringify(old));
    const restored = new Store();
    expect(restored.state().performanceReviews).toEqual([]);
    expect(restored.state().people).toEqual(original.people);
    expect(restored.state().cycles).toEqual(original.cycles);
    expect(restored.state().plans).toEqual(original.plans);
  });

  it("keeps a newly hired employee unclassified until a documented HR approval", () => {
    const s = new Store();
    const id = newEmployee(s);
    const potential = s.person(id).potential;
    const competency = s.scores(id);
    const nominations = structuredClone(s.state().nominations);
    const cycles = structuredClone(s.state().cycles);
    expect(s.person(id).performance).toBeNull();
    const reviewId = s.savePerformanceDraft(
      id, "1405-autumn", kpis(s, id, [90, 80, 70]), "تحقق اهداف بر اساس شواهد");
    expect(reviewId).toBeTruthy();
    expect(s.person(id).performance).toBeNull();
    expect(s.latestApprovedPerformance(id)).toBeUndefined();
    expect(s.performanceReviewsFor(id)[0].score).toBe(80);
    expect(s.performanceReviewsFor(id)[0].status).toBe("draft");
    expect(s.approvePerformanceReview(reviewId)).toBe(true);
    expect(s.person(id).performance).toBe("high");
    expect(s.person(id).potential).toBe(potential);
    expect(s.scores(id)).toEqual(competency);
    expect(s.state().nominations).toEqual(nominations);
    expect(s.state().cycles).toEqual(cycles);
    expect(s.latestApprovedPerformance(id)?.period).toBe("1405-autumn");
    expect(new Store().person(id).performance).toBe("high");
    expect(new Store().state().performanceReviews[0].approvedBy).toBe("p1");
  });

  it("rejects incomplete, out of range, swapped KPI, duplicate and approved changes", () => {
    const s = new Store();
    const id = newEmployee(s);
    const base = kpis(s, id, [79, 80, 81]);
    expect(s.savePerformanceDraft(id, "1405-q4", base, " ")).toBe("");
    expect(s.savePerformanceDraft(id, "1405-q4", base.map((k, i) =>
      i === 1 ? { ...k, achievement: 120 } : k), "جمع‌بندی")).toBe("");
    expect(s.savePerformanceDraft(id, "1405-q4", base.map((k, i) =>
      i === 1 ? { ...k, evidence: "" } : k), "جمع‌بندی")).toBe("");
    expect(s.savePerformanceDraft(id, "1405-q4", [...base].reverse(), "جمع‌بندی")).toBe("");
    const draft = s.savePerformanceDraft(id, "1405-q4", base, "توضیح ارزیابی");
    expect(draft).toBeTruthy();
    expect(s.savePerformanceDraft(id, "1405-q4", base, "ثبت موازی")).toBe("");
    expect(s.savePerformanceDraft(id, "1405-q4", kpis(s, id, [50, 50, 50]),
      "بازبینی شواهد", draft)).toBe(draft);
    expect(s.state().performanceReviews).toHaveLength(1);
    expect(s.state().performanceReviews[0].score).toBe(50);
    expect(s.approvePerformanceReview(draft)).toBe(true);
    expect(s.approvePerformanceReview(draft)).toBe(false);
    expect(s.savePerformanceDraft(id, "1405-q4", base, "ویرایش غیرمجاز", draft)).toBe("");
    expect(s.state().performanceReviews[0].kpis[0].achievement).toBe(50);
  });

  it("respects HR, manager unit, executive and employee review visibility", () => {
    const s = new Store();
    const draft = s.savePerformanceDraft(
      "p1", "1405-summer", kpis(s, "p1", [90, 80, 75]), "خروجی مستند");
    expect(draft).toBeTruthy();
    s.role.set("manager"); s.actor.set("p2");
    expect(s.canEditPerformance("p1")).toBe(false);
    expect(s.performanceReviewsFor("p1")).toEqual([]);
    expect(s.savePerformanceDraft("p1", "1405-winter",
      kpis(s, "p1", [60, 65, 70]), "نامعتبر")).toBe("");
    s.role.set("employee"); s.actor.set("p1");
    expect(s.performanceReviewsFor("p1")).toEqual([]);
    expect(s.approvePerformanceReview(draft)).toBe(false);
    s.role.set("executive"); s.actor.set("p11");
    expect(s.performanceReviewsFor("p1")).toEqual([]);
    s.role.set("hr"); s.actor.set("p1");
    expect(s.approvePerformanceReview(draft)).toBe(true);
    s.role.set("employee");
    expect(s.performanceReviewsFor("p1")).toHaveLength(1);
    expect(s.performanceReviewsFor("p2")).toEqual([]);
    expect(s.savePerformanceDraft("p1", "1405-winter",
      kpis(s, "p1", [50, 60, 70]), "بدون دسترسی")).toBe("");
  });

  it("snapshots job KPI metadata and never lets demo sync overwrite an approval", () => {
    const s = new Store();
    const draft = s.savePerformanceDraft("p3", "1405-autumn",
      kpis(s, "p3", [30, 40, 50]), "عملکرد نیازمند رشد");
    expect(draft).toBeTruthy();
    const initialPotential = s.person("p3").potential;
    expect(s.approvePerformanceReview(draft)).toBe(true);
    expect(s.person("p3").performance).toBe("low");
    const snapshot = structuredClone(s.state().performanceReviews[0].kpis);
    s.sync();
    expect(s.person("p3").performance).toBe("low");
    expect(s.person("p3").potential).toBe(initialPotential);
    s.commit("تغییر در شناسنامه نمونه", "j3", (state) => {
      state.jobs.find((j) => j.id === "j3")!.kpis[0].title = "KPI جدید";
    });
    expect(s.state().performanceReviews[0].kpis).toEqual(snapshot);
    expect(s.state().syncs[0].rows).toBe(0);
  });
});
