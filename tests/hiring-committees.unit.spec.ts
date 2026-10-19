import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { entryScores } from "../src/app/core/entry-committees";
import { QuestionAnswer } from "../src/app/core/models";

const memory = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),
  removeItem:(k:string)=>memory.delete(k),
}});
beforeEach(()=>memory.clear());
const answers = (questions: {id:string}[],score:number):QuestionAnswer[] =>
  questions.map(q=>({questionId:q.id,score}));

describe("sequential general/specialist hiring committees",()=>{
  it("migrates old candidates and keeps the 360/540 bank unaffected",()=>{
    const base = new Store().state();
    const old = structuredClone(base) as Record<string,unknown>;
    delete old.entryQuestions;
    delete old.entryCommitteeMembers;
    memory.set("royesh.demo.v1",JSON.stringify(old));
    const s = new Store();
    expect(s.state().entryQuestions.filter(q=>q.stage==="general")).toHaveLength(5);
    expect(s.state().entryQuestions.filter(q=>q.stage==="specialist"&&q.jobId==="j1")).toHaveLength(5);
    expect(s.state().questions).toEqual(base.questions);
    expect(s.state().cycles).toEqual(base.cycles);
    expect(s.state().candidates).toEqual(base.candidates);
    expect(s.state().nominations).toEqual(base.nominations);
    expect(s.state().plans).toEqual(base.plans);
  });

  it("requires HR referral and committee membership before any evaluator task is available",()=>{
    const s = new Store();
    const id = s.registerCandidate("صبا راد","j1");
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.referEntry(id,"general","p3")).toBe(false);
    expect(s.entryQueue("general")).toHaveLength(0);
    s.actor.set("p1");s.role.set("hr");
    expect(s.referEntry(id,"specialist","p5")).toBe(false);
    expect(s.referEntry(id,"general","p5")).toBe(false);
    expect(s.referEntry(id,"general","p3")).toBe(true);
    expect(s.referEntry(id,"general","p4")).toBe(false);
    expect(s.recordEntryAssessment(id,[3,3,3,3,3],"high","شواهد","دلیل")).toBe(false);
    s.actor.set("p4");s.role.set("evaluator");
    expect(s.entryQueue("general")).toHaveLength(0);
    s.actor.set("p3");
    expect(s.entryQueue("general").some(c=>c.id===id)).toBe(true);
    expect(s.entryQueue("specialist")).toHaveLength(0);
  });

  it("validates answer ids, one answer per question, scale 1–5, evidence and stage order",()=>{
    const s=new Store(),id=s.registerCandidate("نازنین","j9");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    const q=s.candidate(id)!.entryWorkflow!.general.questions;
    expect(q.map(x=>x.competencyIndex)).toEqual([0,1,2,3,4]);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"general",answers(q,4).slice(1),"نمونه رفتار")).toBe(false);
    expect(s.submitEntryReview(id,"general",[...answers(q,4).slice(1),{questionId:q[1].id,score:0}],"شواهد")).toBe(false);
    expect(s.submitEntryReview(id,"general",answers(q,6),"شواهد")).toBe(false);
    expect(s.submitEntryReview(id,"general",answers(q,4)," ")).toBe(false);
    expect(s.submitEntryReview(id,"general",answers(q,4),"شواهد رفتار و کار تیمی")).toBe(true);
    expect(s.submitEntryReview(id,"general",answers(q,2),"تلاش دوباره")).toBe(false);
    s.actor.set("p1");s.role.set("hr");
    expect(s.finalizeEntryReview(id,"high","استدلال","شواهد")).toBe(false);
    expect(s.referEntry(id,"specialist","p5")).toBe(true);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"specialist",answers(q,3),"نادرست")).toBe(false);
    s.actor.set("p5");
    const spec=s.candidate(id)!.entryWorkflow!.specialist!.questions;
    expect(s.submitEntryReview(id,"specialist",answers(spec,2),"شواهد تخصصی")).toBe(true);
    expect(s.candidate(id)?.assessments).toHaveLength(0);
    s.actor.set("p1");s.role.set("hr");
    expect(s.finalizeEntryReview(id,"high"," ","خلاصه")).toBe(false);
    expect(s.finalizeEntryReview(id,"high","استدلال مستند","جمع‌بندی شواهد")).toBe(true);
    expect(s.latestEntryAssessment(id)?.scores).toEqual([3,3,3,3,3]);
    expect(s.latestEntryAssessment(id)?.source).toBe("committees");
    expect(s.finalizeEntryReview(id,"high","تکرار","دوباره")).toBe(false);
    expect(new Store().latestEntryAssessment(id)?.scores).toEqual([3,3,3,3,3]);
  });

  it("keeps immutable questionnaire snapshots despite bank edits and committee membership changes",()=>{
    const s=new Store(),id=s.registerCandidate("داوطلب نسخه‌دار","j1");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    const snapshot=structuredClone(s.candidate(id)!.entryWorkflow!.general.questions);
    const q=s.state().entryQuestions.find(x=>x.id===snapshot[0].id)!;
    expect(s.saveEntryQuestion({...q,text:"پرسش ویرایش‌شده برای نوبت‌های آینده"})).toBe(true);
    expect(s.setEntryCommitteeMember("general","p3",false)).toBe(true);
    expect(s.candidate(id)!.entryWorkflow!.general.questions).toEqual(snapshot);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.entryQueue("general").some(c=>c.id===id)).toBe(true);
    expect(s.submitEntryReview(id,"general",answers(snapshot,4),"شواهد")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    const next=s.registerCandidate("پرونده تازه","j1");
    expect(s.referEntry(next,"general","p3")).toBe(false);
    expect(s.referEntry(next,"general","p4")).toBe(true);
    expect(s.candidate(next)?.entryWorkflow?.general.questions[0].text).toBe("پرسش ویرایش‌شده برای نوبت‌های آینده");
  });

  it("blocks referrals if a committee bank lacks any of the five competencies",()=>{
    const s=new Store(),id=s.registerCandidate("بدون پوشش","j1");
    for(const q of s.state().entryQuestions.filter(q=>q.stage==="general"&&q.competencyIndex===4))
      expect(s.saveEntryQuestion({...q,isActive:false})).toBe(true);
    expect(s.referEntry(id,"general","p3")).toBe(false);
    expect(s.notice()).toContain("پنج شایستگی");
    expect(s.candidate(id)?.entryWorkflow).toBeUndefined();
  });

  it("aggregates unequal question counts by competency, not by their order",()=>{
    const s=new Store();
    const sample=s.state().entryQuestions.filter(q=>q.stage==="general");
    const questions=[...sample, {...sample[0],id:"extra-communication"}];
    const result=entryScores(questions,[
      ...sample.map((q,i)=>({questionId:q.id,score:i===0?2:4})),
      {questionId:"extra-communication",score:4},
    ]);
    expect(result).toEqual([3,4,4,4,4]);
    expect(entryScores(questions,answers(questions,4).slice(1))).toBeNull();
  });

  it("preserves downstream staffing and legacy seeded decisions",()=>{
    const s=new Store(),id=s.registerCandidate("کارمند جدید","j1");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"general",answers(s.candidate(id)!.entryWorkflow!.general.questions,5),"بررسی عمومی")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    expect(s.referEntry(id,"specialist","p5")).toBe(true);
    s.actor.set("p5");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"specialist",answers(s.candidate(id)!.entryWorkflow!.specialist!.questions,3),"بررسی فنی")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    expect(s.decideCandidate(id,"hired","هنوز تأیید نشده",{code:"EMP-9908",positionId:"vac-j1",hiredAt:"2026-10-19"})).toBe(false);
    expect(s.finalizeEntryReview(id,"medium","آمادگی یادگیری مستند","تجمیع دو نتیجه")).toBe(true);
    const personId=s.decideCandidate(id,"hired","تأیید انسانی",{code:"EMP-9908",positionId:"vac-j1",hiredAt:"2026-10-19"});
    expect(personId).toBeTruthy();
    expect(s.person(personId as string).observed).toEqual([4,4,4,4,4]);
    expect(s.person(personId as string).performance).toBeNull();
    expect(s.currentAppointment(personId as string)).toBeTruthy();
    expect(s.currentPosition(personId as string)?.id).toBe("vac-j1");
    expect(s.currentManager(personId as string)?.id).toBe("p11");
    expect(s.latestEntryAssessment("cand1")?.scores).toEqual([4,3,4,4,3]);
  });
});
