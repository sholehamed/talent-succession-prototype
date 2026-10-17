import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { aggregate, validQuestionAnswers } from "../src/app/core/domain";
import { EvaluationQuestion, Group } from "../src/app/core/models";
import { seed } from "../src/app/core/seed";
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

describe("dynamic evaluator-group question bank", () => {
  it("seeds editable group-specific questionnaires, and restores old local browser data", () => {
    const s = new Store();
    for (const group of ["supervisor", "peer", "subordinate", "external"] as Group[])
      expect(s.state().questions.filter((q) => q.group === group && q.isActive)).toHaveLength(5);
    const old = { ...s.state() } as Record<string, unknown>;
    delete old.questions;
    browserStore.set("royesh.demo.v1", JSON.stringify(old));
    const restored = new Store();
    expect(restored.state().questions).toHaveLength(20);
    expect(restored.state().people).toHaveLength(s.state().people.length);
    expect(restored.state().cycles).toEqual(s.state().cycles);
  });

  it("allows HR-only add, edit, deactivate, reorder, and delete while maintaining saved state", () => {
    const s = new Store();
    const question = {
      id: "", group: "peer" as Group, text: "نمونه رفتار همکاری با همکاران چیست؟",
      competencyIndex: 1, order: 0, isActive: true,
    };
    s.role.set("manager");
    expect(s.saveEvaluationQuestion(question)).toBe(false);
    s.role.set("hr");
    expect(s.saveEvaluationQuestion(question)).toBe(true);
    const q = s.state().questions.find((x) => x.text === question.text)!;
    expect(s.saveEvaluationQuestion({ ...q, text: "رفتار همکاری چگونه است؟" })).toBe(true);
    expect(s.saveEvaluationQuestion({ ...q, id: "", text: "رفتار همکاری چگونه است؟" })).toBe(false);
    const updated = s.state().questions.find((x) => x.id === q.id)!;
    expect(s.saveEvaluationQuestion({ ...updated, isActive: false })).toBe(true);
    expect(new Store().state().questions.find((x) => x.id === q.id)?.isActive).toBe(false);
    expect(s.moveEvaluationQuestion(q.id, -1)).toBe(true);
    expect(s.state().questions.filter((x) => x.group === "peer").sort((a,b)=>a.order-b.order).at(-2)?.id).toBe(q.id);
    expect(s.deleteEvaluationQuestion(q.id)).toBe(true);
    expect(s.state().questions.find((x) => x.id === q.id)).toBeUndefined();
    s.role.set("employee");
    expect(s.deleteEvaluationQuestion("q-peer-0")).toBe(false);
  });

  it("snapshots question text/order/group at collection start and rejects incomplete banks", () => {
    const s = new Store();
    const q = s.state().questions.find((q) => q.group === "external")!;
    expect(s.saveEvaluationQuestion({ ...q, isActive: false })).toBe(true);
    expect(s.advance("c1")).toBe(true);
    const snapshot = s.cycle("c1")!.questions!;
    expect(snapshot.some((v) => v.id === q.id)).toBe(false);
    expect(snapshot.filter((v) => v.group === "external")).toHaveLength(4);
    const peer = s.state().questions.find((q) => q.group === "peer")!;
    expect(s.saveEvaluationQuestion({ ...peer, text: "متن تغییر یافته بانک" })).toBe(true);
    expect(s.cycle("c1")!.questions!.find((v) => v.id === peer.id)?.text).toBe(peer.text);
    s.reset();
    for (const item of s.state().questions.filter((x) => x.group === "external" && x.isActive))
      s.saveEvaluationQuestion({ ...item, isActive: false });
    expect(s.advance("c1")).toBe(false);
    expect(s.cycle("c1")!.status).toBe("preparing");
  });

  it("validates by question ids and aggregates unequal group question counts without leaking person IDs", () => {
    const s = new Store();
    expect(s.saveEvaluationQuestion({
      id: "", group: "peer", text: "رفتار دیگری درباره حل مسئله",
      competencyIndex: 2, order: 0, isActive: true,
    })).toBe(true);
    expect(s.advance("c1")).toBe(true);
    const cycle = s.cycle("c1")!;
    const first = cycle.assignments[0];
    const supervisorQuestions = s.questionsFor(cycle, first.group);
    const supervisorAnswers = supervisorQuestions.map((q) => ({questionId: q.id, score: 4}));
    expect(validQuestionAnswers(supervisorQuestions, supervisorAnswers)).toBe(true);
    expect(validQuestionAnswers(supervisorQuestions, supervisorAnswers.slice(1))).toBe(false);
    expect(validQuestionAnswers(supervisorQuestions, [...supervisorAnswers.slice(1), supervisorAnswers[1]])).toBe(false);
    s.role.set("evaluator");
    s.actor.set(first.personId);
    expect(s.submit("c1", first.id, supervisorAnswers.slice(1))).toBe(false);
    expect(s.submit("c1", first.id, supervisorAnswers)).toBe(true);
    expect(s.submit("c1", first.id, supervisorAnswers)).toBe(false);
    let interim = aggregate(s.cycle("c1")!);
    expect(interim.rows.find((r) => r.group === "peer")!.scores).toBeNull();
    expect(JSON.stringify(interim)).not.toContain("personId");
    for (const a of s.cycle("c1")!.assignments.slice(1)) {
      s.actor.set(a.personId);
      const qs = s.questionsFor(s.cycle("c1")!, a.group);
      const answers = qs.map((q) => ({ questionId: q.id,
        score: a.group === "peer" && q.competencyIndex === 2 ? 2 : 4 }));
      expect(s.submit("c1", a.id, answers)).toBe(true);
    }
    const result = aggregate(s.cycle("c1")!);
    expect(result.scores).toHaveLength(5);
    expect(result.scores![2]).toBe(3.5);
    expect(result.rows.find((r) => r.group === "peer")!.scores![2]).toBe(2);
    expect(JSON.stringify(result)).not.toContain("personId");
    s.role.set("hr");
    expect(s.advance("c1")).toBe(true);
  });

  it("requires all five shared competencies in the total active set to keep reports comparable", () => {
    const s = new Store();
    for (const q of [...s.state().questions].filter((q) => q.competencyIndex === 4))
      s.saveEvaluationQuestion({ ...q, isActive: false });
    expect(s.advance("c1")).toBe(false);
    expect(s.notice()).toContain("پنج شایستگی");
  });

  it("preserves aggregation of legacy saved cycles without snapshots", () => {
    const legacy = seed().cycles.find((c) => c.id === "c0")!;
    expect(legacy.questions).toBeUndefined();
    expect(aggregate(legacy).scores).toEqual(aggregate(seed().cycles[1]).scores);
  });
});
