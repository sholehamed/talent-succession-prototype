import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { demoNineBoxHistory } from "../src/app/core/demo-talent-history";
import {
  captureTalentChanges, hydrateTalentHistory, nineBoxAt, nineBoxChanges,
  nineBoxMovement, talentBaseline,
} from "../src/app/core/talent-history";
import type { TalentPositionEvent, Band } from "../src/app/core/models";

const memory=new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>memory.get(k)??null,
  setItem:(k:string,v:string)=>memory.set(k,v),
  removeItem:(k:string)=>memory.delete(k),
}});
beforeEach(()=>memory.clear());

function event(personId:string,at:string,performance:Band|null,potential:Band|null):TalentPositionEvent{
  return {id:personId+at,personId,at,performance,potential,unit:"دفتر پروژه‌ها",source:"change"};
}

describe("automatic talent history without manual period/snapshot buttons",()=>{
  it("starts with today's current known positions and refuses to backdate them",()=>{
    const s=new Store();
    expect(s.state().talentHistory).toHaveLength(s.state().people.length);
    const baseline=s.state().talentHistory.find(x=>x.personId==="p1")!;
    expect(baseline).toMatchObject({
      source:"baseline",
      performance:s.person("p1").performance,
      potential:s.person("p1").potential,
    });
    expect(nineBoxAt(s.state().talentHistory,"p1","2020-01-01")).toBeUndefined();
    expect(nineBoxAt(s.state().talentHistory,"p1",baseline.at.slice(0,10))).toEqual(baseline);
  });
  it("migrates old saved users without losing data or creating a fictitious prior three-month state",()=>{
    const s=new Store(),legacy=structuredClone(s.state());
    delete (legacy as Partial<typeof legacy>).talentHistory;
    memory.set("royesh.demo.v1",JSON.stringify(legacy));
    const restored=new Store();
    expect(restored.state().talentHistory).toHaveLength(legacy.people.length);
    expect(restored.state().people).toEqual(legacy.people);
    expect(restored.state().performanceReviews).toEqual(legacy.performanceReviews);
    expect(restored.state().nominations).toEqual(legacy.nominations);
    expect(nineBoxAt(restored.state().talentHistory,"p1","2026-01-01")).toBeUndefined();
  });
  it("captures actual changes from the existing HR sync flow once, with no manual button",()=>{
    const s=new Store();
    const before=s.state().talentHistory.filter(x=>x.personId==="p3");
    const prior=s.person("p3").performance;
    s.sync();
    const history=s.state().talentHistory.filter(x=>x.personId==="p3");
    expect(history).toHaveLength(before.length+1);
    expect(history.at(-1)).toMatchObject({
      source:"change",performance:s.person("p3").performance,
      potential:s.person("p3").potential,
      action:"اطلاعات منابع انسانی به‌روزرسانی شد",
    });
    expect(history.at(-1)!.performance).not.toBe(prior);
    expect(new Store().state().talentHistory.filter(x=>x.personId==="p3")).toHaveLength(2);
    // Non-talent commits must not flood history.
    expect(s.setPersonRoles("p3",["employee","evaluator"])).toBe(true);
    expect(s.state().talentHistory.filter(x=>x.personId==="p3")).toHaveLength(2);
  });
  it("captures approved KPI performance in the same commit and never changes potential",()=>{
    const s=new Store(),person=s.person("p3");
    const job=s.publishedJobs().find(j=>j.id===person.jobId)!;
    const before=s.state().talentHistory.length;
    const reviewId=s.savePerformanceDraft(person.id,"1405-autumn",
      job.kpis.map(k=>({title:k.title,achievement:95,evidence:"مستند دوره"})),
      "بازبینی KPI مستند");
    expect(reviewId).toBeTruthy();
    expect(s.state().talentHistory).toHaveLength(before);
    expect(s.approvePerformanceReview(reviewId)).toBe(true);
    const updated=s.state().talentHistory.filter(e=>e.personId===person.id);
    expect(updated).toHaveLength(2);
    expect(updated.at(-1)).toMatchObject({performance:"high",potential:person.potential,
      action:"ارزیابی عملکرد دوره‌ای تأیید شد"});
  });
  it("records potential, unit and new-hire changes only when the actual person changes",()=>{
    const s=new Store(),old=s.state().talentHistory.length;
    s.commit("تأیید پتانسیل دوره", "p2",state=>{
      state.people.find(p=>p.id==="p2")!.potential="low";
    });
    expect(s.state().talentHistory).toHaveLength(old+1);
    s.commit("ویرایش واحد", "p2",state=>{
      state.people.find(p=>p.id==="p2")!.unit="واحد جدید";
    });
    expect(s.state().talentHistory.at(-1)?.unit).toBe("واحد جدید");
    s.commit("ثبت کارمند جدید", "new1",state=>{
      state.people.push({...state.people[0],id:"new1",code:"NEW-1"});
    });
    expect(s.state().talentHistory.filter(x=>x.personId==="new1")).toHaveLength(1);
    expect(s.state().talentHistory.find(x=>x.personId==="new1")?.source).toBe("baseline");
  });
  it("selects the last event at or before the requested local day, never a future event",()=>{
    const events=[
      event("p1","2026-06-01T10:00:00.000Z","low","medium"),
      event("p1","2026-08-31T10:00:00.000Z","medium","medium"),
      event("p1","2026-09-01T10:00:00.000Z","high","high"),
    ];
    expect(nineBoxAt(events,"p1","2026-07-01")?.performance).toBe("low");
    expect(nineBoxAt(events,"p1","2026-08-31")?.performance).toBe("medium");
    expect(nineBoxAt(events,"p1","2026-10-01")?.performance).toBe("high");
    expect(nineBoxAt(events,"p1","2026-05-31")).toBeUndefined();
  });
  it("classifies improve, decline, mixed, unchanged and missing independently",()=>{
    expect(nineBoxMovement(event("x","2026-01-01","low","medium"),
      event("x","2026-04-01","high","high"))).toBe("improved");
    expect(nineBoxMovement(event("x","2026-01-01","high","high"),
      event("x","2026-04-01","low","medium"))).toBe("declined");
    expect(nineBoxMovement(event("x","2026-01-01","high","low"),
      event("x","2026-04-01","low","high"))).toBe("mixed");
    expect(nineBoxMovement(event("x","2026-01-01","medium","medium"),
      event("x","2026-04-01","medium","medium"))).toBe("unchanged");
    expect(nineBoxMovement(undefined,event("x","2026-04-01","high","high"))).toBe("insufficient");
    expect(nineBoxMovement(event("x","2026-01-01",null,"high"),
      event("x","2026-04-01","high","high"))).toBe("insufficient");
  });
  it("compares a fixed allowed cohort without replacing unknown history with present values",()=>{
    const s=new Store(),people=s.state().people.slice(0,3);
    const fixture=structuredClone(s.state());
    fixture.talentHistory=[
      event("p1","2026-06-01T08:00:00Z","medium","medium"),
      event("p1","2026-10-01T08:00:00Z","high","high"),
      event("p2","2026-10-01T08:00:00Z","low","low"),
    ];
    const comparison=nineBoxChanges(fixture,people,"2026-07-01","2026-10-15");
    expect(comparison[0].movement).toBe("improved");
    expect(comparison[1].movement).toBe("insufficient");
    expect(comparison[2].movement).toBe("insufficient");
    expect(comparison[0].from?.performance).toBe("medium");
    expect(comparison[0].to?.performance).toBe("high");
  });
});

describe("read-only demo historical timeline",()=>{
  it("creates stable past/current records, all movement classes, and does not mutate the state",()=>{
    const s=new Store(),people=s.state().people;
    const before=JSON.stringify(s.state());
    const today="2026-10-21",sample=demoNineBoxHistory(people,today);
    expect(sample).toHaveLength(people.length*5);
    expect(sample.every(e=>e.source==="demo")).toBe(true);
    expect(demoNineBoxHistory(people,today)).toEqual(sample);
    const changed=nineBoxChanges(s.state(),people,"2026-07-21",today,sample);
    for(const movement of ["improved","declined","mixed","unchanged"]){
      expect(changed.some(row=>row.movement===movement)).toBe(true);
    }
    expect(changed[0].to?.performance).toBe(people[0].performance);
    expect(sample[0].at).toBeLessThan(sample[4].at);
    expect(JSON.stringify(s.state())).toBe(before);
    expect(s.state().talentHistory.some(e=>e.source==="demo")).toBe(false);
  });
  it("still reports insufficient real history before baseline, regardless of preview",()=>{
    const s=new Store(),people=s.state().people,today="2026-10-21";
    const sample=demoNineBoxHistory(people,today);
    expect(nineBoxChanges(s.state(),people,"2026-07-21",today)[0].movement).toBe("insufficient");
    expect(nineBoxChanges(s.state(),people,"2026-07-21",today,sample)[0].movement)
      .toBe("improved");
    expect(s.state().talentHistory.every(x=>x.source!=="demo")).toBe(true);
  });
});
