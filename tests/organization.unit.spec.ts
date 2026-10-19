import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { hydrateOrganization, organizationTree, validDay, wouldCycle } from "../src/app/core/organization";
import { seed } from "../src/app/core/seed";

const data = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
}});
beforeEach(() => data.clear());

describe("organizational structure and effective-dated appointments", () => {
  it("derives the chart from posts and staffing, without losing succession references", () => {
    const s = new Store();
    expect(s.state().positions.find((p) => p.id === "pos1")).toBeTruthy();
    expect(s.state().nominations.every((n) =>
      s.state().positions.some((p) => p.id === n.positionId))).toBe(true);
    expect(s.currentPosition("p1")?.jobId).toBe("j7");
    expect(s.currentPositionHolder("pos1")?.id).toBe("p11");
    expect(s.currentManager("p1")?.id).toBe("p11");
    expect(s.directReports("p11").some((p) => p.id === "p1")).toBe(true);
    expect(s.currentLocation("p1")?.name).toBe("ستاد مرکزی");
    expect(s.vacantPositions("j1").some((p) => p.id === "vac-j1")).toBe(true);
    expect(s.positionTree()).toHaveLength(s.state().positions.length);
    expect(new Set(s.positionTree().map((x) => x.position.id)).size)
      .toBe(s.state().positions.length);
    for (const p of s.state().positions)
      expect(wouldCycle(s.state().positions, p.id, p.parentPositionId)).toBe(false);
    expect(organizationTree(s.state().positions).length).toBeGreaterThan(0);
  });

  it("upgrades old snapshots without clearing people, job descriptions or assessments", () => {
    const original = new Store().state();
    const old = structuredClone(original) as Record<string, unknown>;
    delete old.organizationUnits;
    delete old.workLocations;
    delete old.appointments;
    (old.positions as Array<Record<string, unknown>>).splice(15);
    for (const position of old.positions as Array<Record<string, unknown>>) {
      delete position.parentPositionId; delete position.unitId;
      delete position.locationId; delete position.code; delete position.isActive;
    }
    data.set("royesh.demo.v1", JSON.stringify(old));
    const restored = new Store();
    expect(restored.state().people).toEqual(original.people);
    expect(restored.state().jobs).toEqual(original.jobs);
    expect(restored.state().plans).toEqual(original.plans);
    expect(restored.state().cycles).toEqual(original.cycles);
    expect(restored.state().nominations).toEqual(original.nominations);
    expect(restored.currentPosition("p1")).toBeTruthy();
    expect(restored.state().positions.length).toBeGreaterThan(15);
    expect(hydrateOrganization(restored.state()).appointments).toEqual(restored.state().appointments);
  });

  it("creates multiple posts from one job, preserves vacancy and rejects hierarchy cycles", () => {
    const s = new Store();
    const before = s.state().positions.length;
    const location = {id:"",code:"LOC-200",name:"شعبه غرب",isActive:true};
    expect(s.saveWorkLocation(location)).toBe(true);
    const loc = s.state().workLocations.find((l) => l.code === "LOC-200")!;
    const unit = {id:"",code:"UNIT-200",name:"مرکز فنی جدید",parentUnitId:null,isActive:true};
    expect(s.saveOrganizationUnit(unit)).toBe(true);
    const org = s.state().organizationUnits.find((u) => u.code === "UNIT-200")!;
    const post = {
      id:"", code:"POST-201", title:"کارشناس فناوری غرب",
      jobId:"j9", holderId:"", unit:org.name, unitId:org.id, locationId:loc.id,
      parentPositionId:"pos1", isActive:true,
      critical:false,reason:"",probability:1,impact:1,months:6,
    };
    expect(s.saveOrganizationPosition(post)).toBe(true);
    expect(s.state().positions.length).toBe(before+1);
    const created = s.state().positions.find((p) => p.code === "POST-201")!;
    expect(s.currentPositionHolder(created.id)).toBeUndefined();
    expect(s.saveOrganizationPosition({...created,parentPositionId:created.id})).toBe(false);
    expect(s.saveOrganizationPosition({...s.positionRecord("pos1")!,
      parentPositionId:created.id})).toBe(false);
    expect(s.saveOrganizationPosition({...created,code:"POST-pos1"})).toBe(false);
  });

  it("transfers staff via appointment history and keeps old evaluation/IDP snapshots", () => {
    const s = new Store();
    const cycles = structuredClone(s.state().cycles);
    const plans = structuredClone(s.state().plans);
    const nominations = structuredClone(s.state().nominations);
    const from = s.currentPosition("p1")!;
    const appointment = s.currentAppointment("p1")!;
    const newId = s.appointPerson("p1", "vac-j1", "2026-10-19", "AP-100", "انتقال رسمی");
    expect(newId).toBeTruthy();
    expect(s.currentPosition("p1")?.id).toBe("vac-j1");
    expect(s.currentJob("p1")?.id).toBe("j1");
    expect(s.person("p1").jobId).toBe("j1");
    expect(s.currentPositionHolder("vac-j1")?.id).toBe("p1");
    expect(s.currentPositionHolder(from.id)).toBeUndefined();
    expect(s.state().appointments.find((a) => a.id === appointment.id)?.effectiveTo)
      .toBe("2026-10-18");
    expect(s.state().appointments.find((a) => a.id === newId)?.referenceNo).toBe("AP-100");
    expect(s.state().cycles).toEqual(cycles);
    expect(s.state().plans).toEqual(plans);
    expect(s.state().nominations).toEqual(nominations);
    expect(s.appointPerson("p2", "vac-j1", "2026-10-20")).toBe("");
    expect(s.appointPerson("p1", "vac-j1", "2026-10-20")).toBe("");
    expect(new Store().currentPosition("p1")?.id).toBe("vac-j1");
    expect(s.endPositionAppointment(newId, "2026-10-19")).toBe(true);
    expect(s.currentPosition("p1", "2026-10-20")).toBeUndefined();
    expect(s.currentPositionHolder("vac-j1", "2026-10-20")).toBeUndefined();
  });

  it("preserves manager access to their team in the seeded hierarchy", () => {
    const s = new Store();
    expect(s.currentManager("p12")?.id).toBe("p2");
    expect(s.directReports("p2").map((p) => p.id)).toContain("p12");
    s.actor.set("p2");
    s.role.set("manager");
    expect(s.allowedPerson("p12")).toBe(true);
    expect(s.allowedPerson("p1")).toBe(false);
  });

  it("does not allow a manager or employee to change the org chart", () => {
    const s = new Store();
    s.role.set("manager");
    expect(s.saveWorkLocation({id:"",code:"LOC-A",name:"غیرمجاز",isActive:true})).toBe(false);
    expect(s.appointPerson("p1","vac-j1","2026-10-19")).toBe("");
    s.role.set("employee");
    expect(s.endPositionAppointment("initial-appointment-p1","2026-10-18")).toBe(false);
    expect(s.state().appointments).toHaveLength(seed().appointments.length);
  });

  it("is calendar-safe and rejects overlapping staff records", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("2026-10-19")).toBe(true);
    const s = new Store();
    expect(s.appointPerson("p1", "vac-j1", "2026-02-30")).toBe("");
    expect(s.appointPerson("p1", "pos1", "2026-10-19")).toBe("");
    expect(s.endPositionAppointment("initial-appointment-p1", "2025-01-01")).toBe(false);
  });

  it("enrolls a hired candidate into a vacancy while preserving initial competency data", () => {
    const s = new Store();
    const id = s.registerCandidate("تازه استخدام", "j1");
    expect(s.recordEntryAssessment(id, [4,4,4,3,5], "high",
      "تست ورودی با شواهد", "بازبینی یادگیری و رشد")).toBe(true);
    const personId = s.decideCandidate(id, "hired", "تأیید استخدام و انتصاب",
      {code:"EMP-8009",positionId:"vac-j1",hiredAt:"2026-10-19"});
    expect(typeof personId).toBe("string");
    expect(s.person(personId as string).performance).toBeNull();
    expect(s.currentPosition(personId as string)?.id).toBe("vac-j1");
    expect(s.currentManager(personId as string)?.id).toBe("p11");
    expect(s.person(personId as string).observed).toEqual([4,4,4,3,5]);
    expect(s.candidate(id)?.decision?.personId).toBe(personId);
  });
  it("proposes chart-derived evaluators without creating fake external assignments", () => {
    const s = new Store();
    const cycleId = s.createCycle("دوره تشکیلاتی", "p1", "j7", 540);
    expect(cycleId).toBeTruthy();
    const proposed = s.organizationalEvaluatorSuggestions("p1", 540);
    expect(proposed.some((x) => x.group === "supervisor" && x.personId === "p11")).toBe(true);
    expect(proposed.some((x) => x.group === "external")).toBe(false);
    expect(proposed.some((x) => x.personId === "p1")).toBe(false);
    expect(s.cycle(cycleId)!.assignments).toHaveLength(0);
    expect(s.addOrganizationalEvaluators(cycleId)).toBe(true);
    const assignments = s.cycle(cycleId)!.assignments;
    expect(assignments.length).toBe(proposed.length);
    expect(new Set(assignments.map((a) => a.personId)).size).toBe(assignments.length);
    expect(s.addOrganizationalEvaluators(cycleId)).toBe(false);
    s.role.set("manager");
    expect(s.addOrganizationalEvaluators(cycleId)).toBe(false);
    expect(s.cycle(cycleId)!.assignments).toHaveLength(assignments.length);
  });

  it("does not invent or duplicate positions after a staffing contract ends and the browser reloads", () => {
    const s = new Store();
    const originalCount = s.state().positions.length;
    const historicId = s.currentPosition("p1")!.id;
    expect(s.endPositionAppointment("initial-appointment-p1", "2026-10-18")).toBe(true);
    expect(s.currentPosition("p1", "2026-10-19")).toBeUndefined();
    const restored = new Store();
    expect(restored.currentPosition("p1", "2026-10-19")).toBeUndefined();
    expect(restored.state().positions).toHaveLength(originalCount);
    expect(restored.state().positions.filter((p) => p.id === historicId)).toHaveLength(1);
    expect(restored.state().appointments).toHaveLength(s.state().appointments.length);
    // Rehydrating already-migrated data is idempotent.
    expect(hydrateOrganization(restored.state()).positions).toHaveLength(originalCount);
  });

  it("propagates a unit rename to staffed posts, people and the legacy unit filter", () => {
    const s = new Store();
    const unit = s.currentUnit("p1")!;
    const renamed = "واحد تشکیلاتی آزمایشی";
    const cycles = structuredClone(s.state().cycles);
    expect(s.saveOrganizationUnit({ ...unit, name: renamed })).toBe(true);
    expect(s.currentUnit("p1")?.name).toBe(renamed);
    expect(s.currentPosition("p1")?.unit).toBe(renamed);
    expect(s.person("p1").unit).toBe(renamed);
    expect(s.units()).toContain(renamed);
    expect(s.state().cycles).toEqual(cycles);
    expect(new Store().person("p1").unit).toBe(renamed);
  });

});
