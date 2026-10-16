import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import {
  aggregate,
  canStart,
  gap,
  progress,
  validateJob,
  validScores,
} from "../src/app/core/domain";
import { seed } from "../src/app/core/seed";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
beforeEach(() => memory.clear());
describe("REQ evaluation and privacy", () => {
  it("requires all groups including external in 540", () => {
    const c = seed().cycles[0];
    expect(canStart(c)).toBe(true);
    c.assignments.splice(2, 1);
    expect(canStart(c)).toBe(false);
  });
  it("rejects missing, fractional and out-of-range answers", () => {
    expect(validScores([1, 2, 3, 4, 5])).toBe(true);
    for (const s of [
      [0, 2, 3, 4, 5],
      [1, 2, 3, 4],
      [1, 2.5, 3, 4, 5],
      [1, 2, 3, 4, 6],
    ])
      expect(validScores(s)).toBe(false);
  });
  it("suppresses small peer samples and exposes no identities", () => {
    const c = seed().cycles[1];
    c.assignments[2].scores = undefined;
    const r = aggregate(c);
    expect(r.rows.find((g) => g.group === "peer")!.scores).toBeNull();
    expect(JSON.stringify(r)).not.toContain("personId");
    expect(JSON.stringify(r)).not.toContain("p2");
  });
  it("weights available groups equally rather than individual responses", () => {
    const c = seed().cycles[1];
    for (const a of c.assignments)
      a.scores = Array(5).fill(a.group === "supervisor" ? 5 : 1);
    expect(aggregate(c).scores).toEqual([2, 2, 2, 2, 2]);
  });
  it("guards collecting, submission, calibration and feedback", () => {
    const s = new Store();
    expect(s.advance("c1")).toBe(true);
    expect(s.advance("c1")).toBe(false);
    for (const a of s.cycle("c1")!.assignments) {
      s.role.set("evaluator");
      s.actor.set(a.personId);
      expect(s.submit("c1", a.id, [3, 3, 3, 3, 3])).toBe(true);
      expect(s.submit("c1", a.id, [5, 5, 5, 5, 5])).toBe(false);
    }
    s.role.set("hr");
    expect(s.advance("c1")).toBe(true);
    expect(s.advance("c1", "")).toBe(false);
    expect(s.advance("c1", "شواهد مرور شد")).toBe(true);
    expect(s.scores("p1")).toEqual([3, 3, 3, 3, 3]);
  });
});
describe("REQ jobs, IDP, knowledge and persistence", () => {
  it("published job changes only after owner approval and updates gaps", () => {
    const s = new Store();
    const j = structuredClone(s.job("j1"));
    const before = s.gaps("p1", "j1");
    j.expected[4] = 5;
    expect(s.saveJob("j1", j)).toBe(true);
    expect(s.gaps("p1", "j1")).toEqual(before);
    s.reviewJob("j1", "submit");
    expect(s.reviewJob("j1", "approve")).toBe(false);
    s.role.set("owner");
    s.reviewJob("j1", "approve");
    expect(s.job("j1").version).toBe(2);
    expect(s.gaps("p1", "j1")[4]).toBe(before[4] + 2);
  });
  it("rejects duplicate KPI definitions", () => {
    const j = seed().jobs[0];
    j.kpis.push({ ...j.kpis[0] });
    expect(validateJob(j)).toContain("تکراری");
  });
  it("creates exactly 3 actions, updates progress and survives reload", () => {
    const s = new Store();
    const id = s.createPlan("p1", "j1");
    const p = s.state().plans.find((p) => p.id === id)!;
    expect(p.actions).toHaveLength(3);
    s.saveAction(id, { ...p.actions[0], status: "completed" });
    expect(progress(s.state().plans.find((p) => p.id === id)!)).toBe(33);
    expect(new Store().state()).toEqual(s.state());
  });
  it("keeps readiness per position independent of assessments", () => {
    const s = new Store();
    s.nominate({
      id: "",
      personId: "p1",
      positionId: "pos1",
      readiness: "A",
      evidence: "شواهد انسانی",
      at: "",
    });
    s.nominate({
      id: "",
      personId: "p1",
      positionId: "pos2",
      readiness: "C",
      evidence: "تجربه ناکافی برای این پست",
      at: "",
    });
    expect(
      s
        .state()
        .nominations.filter((n) => n.personId === "p1")
        .map((n) => n.readiness),
    ).toEqual(["A", "C"]);
    s.sync();
    expect(
      s.state().nominations.find((n) => n.personId === "p1")!.readiness,
    ).toBe("A");
  });
  it("requires review then owner approval for knowledge", () => {
    const s = new Store();
    const k = s.state().knowledge.find((k) => k.status === "draft")!;
    s.knowledgeTransition(k.id, "published");
    expect(s.state().knowledge.find((x) => x.id === k.id)!.status).toBe(
      "draft",
    );
    s.knowledgeTransition(k.id, "review");
    s.knowledgeTransition(k.id, "published");
    expect(s.state().knowledge.find((x) => x.id === k.id)!.status).toBe(
      "review",
    );
    s.role.set("owner");
    s.knowledgeTransition(k.id, "published");
    expect(s.state().knowledge.find((x) => x.id === k.id)!.status).toBe(
      "published",
    );
  });
  it("resets exactly to seed and recovers invalid storage", () => {
    const s = new Store();
    s.sync();
    s.reset();
    expect(s.state()).toEqual(seed());
    memory.set("royesh.demo.v1", "{bad");
    expect(new Store().state()).toEqual(seed());
  });
  it("all seed relations resolve and gaps never become negative", () => {
    const s = seed();
    for (const p of s.people) {
      expect(s.jobs.some((j) => j.id === p.jobId)).toBe(true);
      expect(s.people.some((x) => x.id === p.managerId)).toBe(true);
    }
    for (const k of s.knowledge)
      expect(
        s.jobs
          .find((j) => j.id === k.jobId)!
          .tasks.some((t) => t.id === k.taskId),
      ).toBe(true);
    for (const n of s.nominations) {
      expect(s.people.some((p) => p.id === n.personId)).toBe(true);
      expect(s.positions.some((p) => p.id === n.positionId)).toBe(true);
    }
    expect(gap([2, 4], [4, 2])).toEqual([0, 2]);
  });
});
