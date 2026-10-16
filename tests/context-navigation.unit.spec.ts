import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
beforeEach(() => storage.clear());

describe("contextual job people", () => {
  it("includes current employees, feeder-career people and succession nominees", () => {
    const s = new Store();
    const job1 = s.relatedPeople("j1").map((p) => p.id);
    expect(job1).toContain("p1"); // career path j7 → j8 → j1 + nomination
    expect(job1).toContain("p2"); // candidate nominated for the j1 position
    expect(job1).toContain("p11"); // current job j1
    const job2 = s.relatedPeople("j2").map((p) => p.id);
    expect(job2).toContain("p2"); // current job j2
    expect(job2).not.toContain("p1");
    expect(s.relatedPeople("unknown")).toEqual([]);
  });

  it("limits related results to people visible to the selected role", () => {
    const s = new Store();
    s.role.set("employee");
    expect(s.relatedPeople("j1").map((p) => p.id)).toEqual(["p1"]);
    expect(s.relatedPeople("j2")).toEqual([]);
  });

  it("reflects nomination and career-path changes without hardcoded person IDs", () => {
    const s = new Store();
    const before = s.relatedPeople("j3").map((p) => p.id);
    expect(before).not.toContain("p1");
    s.savePath("j7", "j3", "سوابق و شواهد تخصصی");
    expect(s.relatedPeople("j3").map((p) => p.id)).toContain("p1");
  });
});
