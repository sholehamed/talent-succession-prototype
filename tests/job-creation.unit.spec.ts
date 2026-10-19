import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { seed } from "../src/app/core/seed";
import { JobContent } from "../src/app/core/models";

const saved = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
  removeItem: (key: string) => saved.delete(key),
}});
beforeEach(() => saved.clear());
function content(): JobContent {
  const j = seed().jobs[0];
  return {
    title: "کارشناس تحول دیجیتال", family: "فناوری", unit: "فناوری اطلاعات",
    level: "کارشناسی", owner: "دفتر منابع انسانی",
    mission: "تحلیل فرایندها و بهبود سامانه‌های سازمان",
    expected: [3, 4, 4, 3, 2],
    tasks: [{ id: "task-new", title: "تحلیل نیازمندی", output: "سند مورد تأیید ذی‌نفع" }],
    kpis: [{
      title: "پوشش نیازمندی‌ها", definition: "درصد موارد تحلیل‌شده",
      formula: "پوشش / کل × ۱۰۰", unit: "درصد", frequency: "ماهانه",
      source: "گزارش پروژه", owner: "مدیر فناوری اطلاعات",
    }],
    skills: j.skills, qualifications: j.qualifications, hse: j.hse,
  };
}

describe("create job profile lifecycle and links", () => {
  it("requires a privileged role, unique code, valid content and an output-oriented task", () => {
    const s = new Store();
    const valid = content();
    s.role.set("employee");
    expect(s.createJob("JOB-201", valid)).toBe("");
    s.role.set("hr");
    for (const code of ["", "?", "الف-۲۰۲", "a", "JOB 201", "JOB/201"]) {
      expect(s.createJob(code, valid)).toBe("");
    }
    expect(s.createJob(" job-101 ", valid)).toBe("");
    expect(s.notice()).toContain("تکراری");
    expect(s.createJob("JOB-201", { ...valid, title: "" })).toBe("");
    expect(s.createJob("JOB-201", { ...valid, unit: "" })).toBe("");
    expect(s.createJob("JOB-201", { ...valid, level: "" })).toBe("");
    expect(s.createJob("JOB-201", { ...valid, expected: [3, 4, 6, 3, 2] })).toBe("");
    expect(s.createJob("JOB-201", { ...valid, tasks: [] })).toBe("");
    expect(s.createJob("JOB-201", { ...valid, kpis: [{ ...valid.kpis[0], source: "" }] })).toBe("");
    expect(s.state().jobs).toHaveLength(seed().jobs.length);
  });

  it("persists new draft and publishes version one only after owner approval", () => {
    const s = new Store();
    const initialCount = s.state().jobs.length;
    const id = s.createJob(" job-201 ", content());
    expect(id).toBeTruthy();
    const job = s.job(id);
    expect(job).toMatchObject({
      code: "JOB-201", title: "کارشناس تحول دیجیتال",
      version: 0, review: "draft", draft: { expected: [3, 4, 4, 3, 2] },
      history: [],
    });
    expect(s.state().jobs).toHaveLength(initialCount + 1);
    expect(s.publishedJobs().some((j) => j.id === id)).toBe(false);
    expect(s.createJob("JOB-201", content())).toBe("");
    expect(s.registerCandidate("داوطلب جدید", id)).toBe("");
    expect(s.createCycle("ارزیابی شغل جدید", "p1", id, 360)).toBe("");
    expect(s.savePath("j1", id, "تجربه مورد نیاز")).toBe(false);
    expect(s.reviewJob(id, "approve")).toBe(false);
    expect(s.reviewJob(id, "submit")).toBe(true);
    expect(s.job(id).review).toBe("review");
    s.role.set("owner");
    expect(s.reviewJob(id, "approve")).toBe(true);
    expect(s.job(id).version).toBe(1);
    expect(s.job(id).review).toBe("published");
    expect(s.job(id).draft).toBeUndefined();
    expect(s.job(id).history[0].summary).toContain("اولیه");
    expect(s.publishedJobs().some((j) => j.id === id)).toBe(true);
    s.role.set("hr");
    expect(s.registerCandidate("داوطلب جدید", id)).toBeTruthy();
    expect(s.createCycle("ارزیابی شغل جدید", "p1", id, 360)).toBeTruthy();
    expect(s.savePath("j1", id, "تحقق شرایط ارتقا")).toBe(true);
    expect(s.state().paths.some((p) => p.from === "j1" && p.to === id)).toBe(true);
    expect(new Store().job(id)).toEqual(s.job(id));
    expect(new Store().state().paths).toEqual(s.state().paths);
  });

  it("supports edits, rejection and resubmission before initial publication", () => {
    const s = new Store();
    const id = s.createJob("JOB-301", content());
    const updated = { ...content(), title: "تحلیلگر تحول دیجیتال" };
    expect(s.saveJob(id, updated)).toBe(true);
    expect(s.job(id).draft?.title).toBe("تحلیلگر تحول دیجیتال");
    expect(s.reviewJob(id, "submit")).toBe(true);
    s.role.set("owner");
    expect(s.reviewJob(id, "reject")).toBe(true);
    s.role.set("hr");
    expect(s.saveJob(id, updated)).toBe(true);
    expect(s.reviewJob(id, "submit")).toBe(true);
    s.role.set("owner");
    expect(s.reviewJob(id, "approve")).toBe(true);
    expect(s.job(id).title).toBe("تحلیلگر تحول دیجیتال");
    expect(s.job(id).version).toBe(1);
    expect(s.saveJob("missing", updated)).toBe(false);
  });

  it("lets unit managers create only jobs for their own unit", () => {
    const s = new Store();
    s.actor.set("p11");
    s.role.set("manager");
    const managerUnit = s.currentPerson()!.unit;
    expect(s.createJob("JOB-401", content())).toBe(managerUnit === content().unit ? expect.any(String) : "");
    const job = { ...content(), unit: managerUnit };
    const id = s.createJob("JOB-402", job);
    expect(id).toBeTruthy();
    expect(s.saveJob(id, { ...job, unit: "واحد غیرمرتبط" })).toBe(false);
    expect(s.saveJob("j2", job)).toBe(false);
  });
});
