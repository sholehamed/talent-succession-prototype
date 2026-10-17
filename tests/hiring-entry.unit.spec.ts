import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";

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
const assessmentScores = [5, 4, 4, 3, 5];
const record = (s: Store, id: string) =>
  s.recordEntryAssessment(id, assessmentScores, "high",
    "شواهد مصاحبه ساختاریافته و موقعیت عملی", "چابکی یادگیری و سازگاری مشاهده‌شده");

describe("entry assessment and hiring lifecycle", () => {
  it("provides initial assessed and waiting candidates without creating employees", () => {
    const s = new Store();
    expect(s.state().candidates).toHaveLength(2);
    expect(s.latestEntryAssessment("cand1")?.potential).toBe("high");
    expect(s.latestEntryAssessment("cand2")).toBeUndefined();
    expect(s.state().people.some((p) => p.entry)).toBe(false);
  });

  it("normalizes old browser state without discarding existing people or cycles", () => {
    const original = new Store().state();
    const legacy = { ...original } as Record<string, unknown>;
    delete legacy.candidates;
    local.set("royesh.demo.v1", JSON.stringify(legacy));
    const restored = new Store();
    expect(restored.state().candidates).toEqual([]);
    expect(restored.state().people).toHaveLength(original.people.length);
    expect(restored.state().cycles).toHaveLength(original.cycles.length);
    expect(restored.registerCandidate("  دانیال  ", "j1")).toBeTruthy();
    expect(new Store().state().candidates[0].name).toBe("دانیال");
  });

  it("enforces HR-only registration, correct job and valid scoring with evidence", () => {
    const s = new Store();
    s.role.set("manager");
    expect(s.registerCandidate("داوطلب", "j1")).toBe("");
    s.role.set("hr");
    expect(s.registerCandidate("  ", "j1")).toBe("");
    expect(s.registerCandidate("داوطلب", "missing")).toBe("");
    const id = s.registerCandidate("داوطلب", "j1");
    expect(id).toBeTruthy();
    expect(s.recordEntryAssessment(id, [4, 5], "high", "شواهد", "دلیل")).toBe(false);
    expect(s.recordEntryAssessment(id, [4, 5, 6, 1, 2], "high", "شواهد", "دلیل")).toBe(false);
    expect(s.recordEntryAssessment(id, assessmentScores, "high", " ", "دلیل")).toBe(false);
    expect(s.recordEntryAssessment(id, assessmentScores, "high", "شواهد", " ")).toBe(false);
    s.role.set("manager");
    expect(record(s, id)).toBe(false);
    s.role.set("hr");
    expect(record(s, id)).toBe(true);
    expect(s.latestEntryAssessment(id)?.scores).toEqual(assessmentScores);
  });

  it("keeps all assessment revisions with independent scores and potential judgments", () => {
    const s = new Store();
    const id = s.registerCandidate("مهسا راد", "j9");
    expect(record(s, id)).toBe(true);
    const first = s.latestEntryAssessment(id)!;
    expect(s.recordEntryAssessment(id, [2, 3, 3, 4, 2], "medium",
      "مصاحبه دوم با شواهد جدا", "تغییر رأی با بازبینی شواهد")).toBe(true);
    const c = s.candidate(id)!;
    expect(c.assessments).toHaveLength(2);
    expect(c.assessments[0].id).toBe(first.id);
    expect(c.assessments[0].potential).toBe("high");
    expect(c.assessments[1].potential).toBe("medium");
    expect(new Store().candidate(id)?.assessments).toEqual(c.assessments);
  });

  it("requires a documented human decision and a unique employee identity", () => {
    const s = new Store();
    const id = s.registerCandidate("صبا فرهمند", "j1");
    expect(s.decideCandidate(id, "hired", "قابل استخدام",
      { code: "EMP-2009", managerId: "p11", hiredAt: "2026-10-17" })).toBe(false);
    expect(record(s, id)).toBe(true);
    expect(s.decideCandidate(id, "hired", " ",
      { code: "EMP-2009", managerId: "p11", hiredAt: "2026-10-17" })).toBe(false);
    expect(s.decideCandidate(id, "hired", "تأیید",
      { code: "EMP-1001", managerId: "p11", hiredAt: "2026-10-17" })).toBe(false);
    expect(s.decideCandidate(id, "hired", "تأیید",
      { code: "EMP-2009", managerId: "bad", hiredAt: "2026-10-17" })).toBe(false);
    expect(s.decideCandidate(id, "hired", "تأیید",
      { code: "EMP-2009", managerId: "p11", hiredAt: "2026-02-30" })).toBe(false);
    s.role.set("manager");
    expect(s.decideCandidate(id, "hired", "تأیید",
      { code: "EMP-2009", managerId: "p11", hiredAt: "2026-10-17" })).toBe(false);
    s.role.set("hr");
    const personId = s.decideCandidate(id, "hired", "تطابق نیاز شغل با شواهد",
      { code: "EMP-2009", managerId: "p11", hiredAt: "2026-10-17" });
    expect(typeof personId).toBe("string");
    const p = s.person(personId as string);
    expect(p.code).toBe("EMP-2009");
    expect(p.unit).toBe(s.job("j1").unit);
    expect(p.jobId).toBe("j1");
    expect(p.observed).toEqual(assessmentScores);
    expect(p.potential).toBe("high");
    expect(p.performance).toBeNull();
    expect(p.entry?.candidateId).toBe(id);
    expect(p.entry?.assessmentId).toBe(s.latestEntryAssessment(id)!.id);
    expect(s.candidate(id)?.decision?.personId).toBe(personId);
    expect(s.decideCandidate(id, "hired", "تکرار",
      { code: "EMP-2010", managerId: "p11", hiredAt: "2026-10-17" })).toBe(false);
    expect(record(s, id)).toBe(false);
    expect(new Store().person(personId as string).entry).toEqual(p.entry);
  });

  it("retains a declined candidate for review without creating an employee", () => {
    const s = new Store();
    const initial = s.state().people.length;
    const id = s.registerCandidate("آرمان تاج", "j4");
    expect(record(s, id)).toBe(true);
    expect(s.decideCandidate(id, "declined", "فعلاً شرایط احراز این نقش تکمیل نیست")).toBe("declined");
    expect(s.candidate(id)?.decision?.outcome).toBe("declined");
    expect(s.state().people).toHaveLength(initial);
    expect(record(s, id)).toBe(false);
    expect(s.decideCandidate(id, "hired", "تجدیدنظر")).toBe(false);
    expect(new Store().candidate(id)?.decision?.reason).toContain("شرایط احراز");
  });
});
