import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { scoreProspectiveAnswers } from "../src/app/core/prospective";
import { ProspectiveQuestion } from "../src/app/core/models";

const storage=new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>storage.get(k)??null,
  setItem:(k:string,v:string)=>storage.set(k,v),
  removeItem:(k:string)=>storage.delete(k),
}});
beforeEach(()=>storage.clear());
const answers=(q:ProspectiveQuestion[],score:number)=>q.map(x=>({questionId:x.id,score}));

describe("job-independent prospective succession evaluation",()=>{
  it("seeds a standalone bank without altering old snapshots",()=>{
    const s=new Store();
    expect(s.state().prospectiveIndicators).toHaveLength(5);
    expect(s.state().prospectiveQuestions).toHaveLength(10);
    expect(s.state().prospectiveRuns).toHaveLength(0);
    const old=structuredClone(s.state()) as Partial<typeof s.state extends ()=>infer T?T:never>;
    delete old.prospectiveIndicators;delete old.prospectiveQuestions;delete old.prospectiveRuns;
    storage.set("royesh.demo.v1",JSON.stringify(old));
    const restored=new Store();
    expect(restored.state().prospectiveIndicators).toHaveLength(5);
    expect(restored.state().prospectiveRuns).toHaveLength(0);
    expect(restored.state().nominations).toEqual(s.state().nominations);
    expect(restored.state().positions).toEqual(s.state().positions);
  });
  it("allows HR to manage indicators/questions and denies other roles",()=>{
    const s=new Store();
    expect(s.saveProspectiveIndicator({id:"",title:"تحمل ابهام",description:"نمونه",isActive:true,order:0})).toBe(true);
    const ind=s.state().prospectiveIndicators.find(i=>i.title==="تحمل ابهام")!;
    expect(s.saveProspectiveQuestion({id:"",indicatorId:ind.id,text:"چگونه در عدم قطعیت تصمیم می‌گیرد؟",
      isActive:true,order:0})).toBe(true);
    const q=s.state().prospectiveQuestions.find(q=>q.indicatorId===ind.id)!;
    expect(s.saveProspectiveIndicator({...ind,title:"تحمل ابهام و فشار"})).toBe(true);
    expect(s.saveProspectiveQuestion({...q,text:"در فشار چگونه اولویت‌بندی می‌کند؟"})).toBe(true);
    expect(s.saveProspectiveIndicator({...ind,id:"",title:"تحمل ابهام و فشار"})).toBe(false);
    expect(s.saveProspectiveQuestion({...q,id:"unknown"})).toBe(false);
    s.actor.set("p2");s.role.set("manager");
    expect(s.saveProspectiveIndicator({...ind,title:"عنوان مدیر"})).toBe(false);
    expect(s.saveProspectiveQuestion({...q,isActive:false})).toBe(false);
  });
  it("starts one immutable period per position and protects snapshots against later edits",()=>{
    const s=new Store();
    const runId=s.startProspectiveRun("pos1");
    expect(runId).toBeTruthy();
    const saved=structuredClone(s.state().prospectiveRuns.find(r=>r.id===runId)!);
    expect(saved.positionId).toBe("pos1");
    expect(saved.jobId).toBe("j1");
    expect(saved.nominees.length).toBeGreaterThan(0);
    expect(saved.questions.length).toBe(10);
    expect(saved.results).toHaveLength(0);
    const audit=s.state().audit.length;
    expect(s.startProspectiveRun("pos1")).toBe("");
    expect(s.state().audit.length).toBe(audit);
    const i=s.state().prospectiveIndicators[0],q=s.state().prospectiveQuestions[0];
    expect(s.saveProspectiveIndicator({...i,title:"ویرایش بعدی"})).toBe(true);
    expect(s.saveProspectiveQuestion({...q,text:"متن جدید سؤال"})).toBe(true);
    const nomination=s.state().nominations.find(n=>n.positionId==="pos1")!;
    expect(s.nominate({...nomination,readiness:"C",evidence:"بررسی جدید"})).toBe(true);
    const current=s.state().prospectiveRuns.find(r=>r.id===runId)!;
    expect(current.indicators).toEqual(saved.indicators);
    expect(current.questions).toEqual(saved.questions);
    expect(current.nominees).toEqual(saved.nominees);
    expect(new Store().state().prospectiveRuns.find(r=>r.id===runId)?.nominees).toEqual(saved.nominees);
  });
  it("rejects empty or incomplete bank and nameless/empty roster without partial writes",()=>{
    const s=new Store();
    for(const i of [...s.state().prospectiveIndicators]){
      expect(s.saveProspectiveIndicator({...i,isActive:false})).toBe(true);
    }
    const before=JSON.stringify(s.state());
    expect(s.startProspectiveRun("pos1")).toBe("");
    expect(JSON.stringify(s.state())).toBe(before);
    const first=s.state().prospectiveIndicators[0];
    s.saveProspectiveIndicator({...first,isActive:true});
    for(const q of s.state().prospectiveQuestions.filter(x=>x.indicatorId===first.id))
      s.saveProspectiveQuestion({...q,isActive:false});
    const snapshot=JSON.stringify(s.state());
    expect(s.startProspectiveRun("pos1")).toBe("");
    expect(JSON.stringify(s.state())).toBe(snapshot);
    expect(s.startProspectiveRun("missing")).toBe("");
    expect(s.state().prospectiveRuns).toHaveLength(0);
  });
  it("requires exact complete answers and evidence, prevents duplicates, closes after all responses",()=>{
    const s=new Store();
    const id=s.startProspectiveRun("pos1"),run=s.state().prospectiveRuns.find(x=>x.id===id)!;
    const who=run.nominees[0].personId;
    const prior=JSON.stringify(s.state());
    expect(s.submitProspectiveReview(id,who,answers(run.questions,4).slice(1),"شاهد")).toBe(false);
    expect(s.submitProspectiveReview(id,who,answers(run.questions,6),"شاهد")).toBe(false);
    expect(s.submitProspectiveReview(id,who,answers(run.questions,4),"   ")).toBe(false);
    expect(s.submitProspectiveReview(id,"not-nominated",answers(run.questions,4),"شاهد")).toBe(false);
    expect(JSON.stringify(s.state())).toBe(prior);
    expect(s.submitProspectiveReview(id,who,answers(run.questions,4),"مستند")).toBe(true);
    expect(s.state().prospectiveRuns.find(x=>x.id===id)?.results[0].score).toBe(4);
    expect(s.submitProspectiveReview(id,who,answers(run.questions,2),"تکرار")).toBe(false);
    expect(s.closeProspectiveRun(id)).toBe(false);
    for(const nominee of run.nominees.slice(1))
      expect(s.submitProspectiveReview(id,nominee.personId,answers(run.questions,3),"شاهد تکمیل")).toBe(true);
    expect(s.closeProspectiveRun(id)).toBe(true);
    expect(s.submitProspectiveReview(id,who,answers(run.questions,2),"پس از بسته شدن")).toBe(false);
    expect(s.startProspectiveRun("pos1")).toBeTruthy();
    expect(s.state().prospectiveRuns.filter(x=>x.positionId==="pos1")).toHaveLength(2);
  });
  it("scores each indicator equally despite different question counts",()=>{
    const s=new Store();
    const indicators=s.state().prospectiveIndicators.slice(0,2);
    const questions=[
      ...s.state().prospectiveQuestions.filter(q=>q.indicatorId===indicators[0].id),
      ...s.state().prospectiveQuestions.filter(q=>q.indicatorId===indicators[1].id).slice(0,1),
    ];
    const response=questions.map(q=>({questionId:q.id,score:q.indicatorId===indicators[0].id?1:5}));
    const outcome=scoreProspectiveAnswers(indicators,questions,response);
    expect(outcome?.indicatorScores.map(s=>s.score)).toEqual([1,5]);
    expect(outcome?.score).toBe(3);
    expect(scoreProspectiveAnswers(indicators,questions,[response[0],response[0],response[2]])).toBeNull();
  });
  it("scopes manager to their unit; executive can read but cannot launch or score",()=>{
    const s=new Store();
    const pos=s.state().positions.find(p=>p.id==="pos1")!;
    const other=s.state().positions.find(p=>p.critical&&p.unitId!==pos.unitId)!;
    // Find a valid manager with access to a real unit; HR always has access.
    const manager=s.state().people.find(p=>s.rolesOf(p.id).includes("manager") && s.currentUnit(p.id)?.id===pos.unitId);
    if(manager){
      s.actor.set(manager.id);s.role.set("manager");
      expect(s.canManageProspective(pos.id)).toBe(true);
      expect(s.canManageProspective(other.id)).toBe(false);
      expect(s.startProspectiveRun(other.id)).toBe("");
    }
    s.actor.set("p11");s.role.set("executive");
    expect(s.canManageProspective(pos.id)).toBe(false);
    expect(s.startProspectiveRun(pos.id)).toBe("");
    expect(s.canViewProspective(pos.id)).toBe(true);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.canViewProspective(pos.id)).toBe(false);
  });
});
