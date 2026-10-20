import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { QuestionAnswer } from "../src/app/core/models";
import { combinedEntryScores } from "../src/app/core/entry-committees";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {configurable:true,value:{
  getItem:(key:string)=>memory.get(key)??null,
  setItem:(key:string,value:string)=>memory.set(key,value),
  removeItem:(key:string)=>memory.delete(key),
}});
beforeEach(()=>memory.clear());

const answers = (questions:{id:string}[],score:number):QuestionAnswer[] =>
  questions.map(q=>({questionId:q.id,score}));
const scores=[2,3,4,5,1];
const evidence="شواهد عمومی ارزیابی مستقیم منابع انسانی";

describe("manual general assessment with atomic specialist referral",()=>{
  it("records five HR scores and specialist group in one commit without a general evaluator assignment",()=>{
    const s=new Store(),id=s.registerCandidate("داوطلب ورود مستقیم","j1");
    const initialAudit=s.state().audit.length;
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,"entry-group-management")).toBe(true);
    expect(s.state().audit.length).toBe(initialAudit+1);
    expect(s.state().audit[0].action).toContain("عمومی دستی");
    const candidate=s.candidate(id)!;
    expect(candidate.assessments).toHaveLength(0);
    expect(candidate.entryWorkflow?.general).toMatchObject({
      stage:"general",method:"manual",enteredBy:"p1",assignedTo:"p1",
      scores,evidence,questions:[],
    });
    expect(candidate.entryWorkflow?.general.completedAt).toBeTruthy();
    expect(candidate.entryWorkflow?.general.answers).toBeUndefined();
    const specialist=candidate.entryWorkflow?.specialist!;
    expect(specialist.groupId).toBe("entry-group-management");
    expect(specialist.assignments?.map(a=>a.assignedTo)).toEqual(["p5","p6"]);
    expect(specialist.questions).toHaveLength(5);
    expect(specialist.completedAt).toBeUndefined();
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,"entry-group-management")).toBe(false);
    const reloaded=new Store();
    expect(reloaded.candidate(id)?.entryWorkflow?.general.method).toBe("manual");
    expect(reloaded.candidate(id)?.entryWorkflow?.specialist?.groupId).toBe("entry-group-management");
    s.actor.set("p1");s.role.set("evaluator");
    expect(s.entryQueue("general").some(x=>x.id===id)).toBe(false);
    expect(s.submitEntryReview(id,"general",[],evidence)).toBe(false);
  });

  it("rejects incomplete scores, missing evidence, unauthorized or invalid group with no partial mutation",()=>{
    const s=new Store(),id=s.registerCandidate("داوطلب داده نامعتبر","j1");
    const initial=JSON.stringify(s.state());
    const invalid=[
      {scores:[1,2,3,4],evidence,group:"entry-group-management"},
      {scores:[1,2,3,4,0],evidence,group:"entry-group-management"},
      {scores:[1,2,3,4,6],evidence,group:"entry-group-management"},
      {scores:[1,2,3,4,2.5],evidence,group:"entry-group-management"},
      {scores,evidence:"  ",group:"entry-group-management"},
      {scores,evidence,group:"entry-group-other"},
      {scores,evidence,group:"nonexistent"},
    ];
    for(const input of invalid){
      expect(s.recordManualGeneralAndReferSpecialist(id,input.scores,input.evidence,input.group)).toBe(false);
      expect(JSON.stringify(s.state())).toBe(initial);
    }
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,"entry-group-management")).toBe(false);
    expect(JSON.stringify(s.state())).toBe(initial);
    s.actor.set("p1");s.role.set("hr");
    const group=s.entryGroupsForJob("j1").find(x=>x.id==="entry-group-management")!;
    expect(s.saveEntryEvaluatorGroup({...group,isActive:false})).toBe(true);
    const withGroupDisabled=JSON.stringify(s.state());
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,group.id)).toBe(false);
    expect(JSON.stringify(s.state())).toBe(withGroupDisabled);
  });

  it("blocks atomic referral when the specialist question bank is incomplete",()=>{
    const s=new Store(),id=s.registerCandidate("بانک ناقص","j1");
    const question=s.state().entryQuestions.find(q=>q.stage==="specialist"&&q.jobId==="j1")!;
    expect(s.saveEntryQuestion({...question,isActive:false})).toBe(true);
    const previous=JSON.stringify(s.state());
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,"entry-group-management")).toBe(false);
    expect(JSON.stringify(s.state())).toBe(previous);
  });

  it("completes two independent specialist assignments and combines manual general results at equal weight",()=>{
    const s=new Store(),id=s.registerCandidate("داوطلب نهایی","j1");
    expect(s.recordManualGeneralAndReferSpecialist(id,scores,evidence,"entry-group-management")).toBe(true);
    const specialist=s.candidate(id)!.entryWorkflow!.specialist!;
    s.actor.set("p5");s.role.set("evaluator");
    expect(s.entryQueue("specialist").some(x=>x.id===id)).toBe(true);
    expect(s.entryQueue("general").some(x=>x.id===id)).toBe(false);
    expect(s.submitEntryReview(id,"specialist",answers(specialist.questions,4),"شاهد متخصص اول")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    expect(s.finalizeEntryReview(id,"high","پتانسیل","جمع بندی")).toBe(false);
    s.actor.set("p6");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"specialist",answers(specialist.questions,2),"شاهد متخصص دوم")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    const workflow=s.candidate(id)!.entryWorkflow!;
    expect(workflow.specialist!.scores).toEqual([3,3,3,3,3]);
    expect(combinedEntryScores(workflow.general,workflow.specialist!)).toEqual([2.5,3,3.5,4,2]);
    expect(s.finalizeEntryReview(id,"high","دلیل شفاف","شواهد نهایی")).toBe(true);
    expect(s.latestEntryAssessment(id)).toMatchObject({
      scores:[2.5,3,3.5,4,2],source:"committees",generalMethod:"manual",potential:"high",
    });
    expect(s.finalizeEntryReview(id,"medium","دوباره","تکرار")).toBe(false);
  });

  it("leaves the questionnaire route available and legacy stage provenance readable",()=>{
    const s=new Store(),id=s.registerCandidate("داوطلب عمومی عادی","j1");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    expect(s.candidate(id)!.entryWorkflow!.general.method).toBe("questionnaire");
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.entryQueue("general").some(x=>x.id===id)).toBe(true);
    const questions=s.candidate(id)!.entryWorkflow!.general.questions;
    expect(s.submitEntryReview(id,"general",answers(questions,4),"پرسشنامه عمومی")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    expect(s.referEntry(id,"specialist","entry-group-management")).toBe(true);
    const snap=structuredClone(s.state());
    delete snap.candidates.find(x=>x.id===id)!.entryWorkflow!.general.method;
    memory.set("royesh.demo.v1",JSON.stringify(snap));
    const restored=new Store();
    expect(restored.candidate(id)?.entryWorkflow?.general.completedAt).toBeTruthy();
    expect(restored.candidate(id)?.entryWorkflow?.specialist?.assignments).toHaveLength(2);
  });
});
