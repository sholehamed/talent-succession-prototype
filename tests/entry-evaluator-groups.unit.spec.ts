import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { EntryEvaluatorGroup, QuestionAnswer } from "../src/app/core/models";

const memory = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),
  removeItem:(k:string)=>memory.delete(k),
}});
beforeEach(()=>memory.clear());
const answers=(questions:{id:string}[],score:number): QuestionAnswer[] =>
  questions.map(q=>({questionId:q.id,score}));

describe("reusable specialist evaluator groups", () => {
  it("allows only HR to manage groups with distinct valid jobs and evaluators", () => {
    const s=new Store(),draft:EntryEvaluatorGroup={
      id:"",name:"گروه مدیریت",jobIds:["j1","j4"],memberIds:["p3","p5"],isActive:true,
    };
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.saveEntryEvaluatorGroup(draft)).toBe(false);
    s.actor.set("p1");s.role.set("hr");
    expect(s.saveEntryEvaluatorGroup({...draft,jobIds:["missing"]})).toBe(false);
    expect(s.saveEntryEvaluatorGroup({...draft,memberIds:[]})).toBe(false);
    expect(s.saveEntryEvaluatorGroup({...draft,name:" "})).toBe(false);
    expect(s.saveEntryEvaluatorGroup(draft)).toBe(true);
    const group=s.entryGroupsForJob("j1").find(g=>g.name===draft.name)!;
    expect(group.memberIds).toEqual(["p3","p5"]);
    expect(s.entryGroupsForJob("j4").some(g=>g.id===group.id)).toBe(true);
    expect(s.entryGroupsForJob("j9").some(g=>g.id===group.id)).toBe(false);
    expect(s.saveEntryEvaluatorGroup(draft)).toBe(false);
    expect(new Store().entryGroupsForJob("j4").some(g=>g.id===group.id)).toBe(true);
    expect(s.saveEntryEvaluatorGroup({...group,isActive:false})).toBe(true);
    expect(s.entryGroupsForJob("j1").some(g=>g.id===group.id)).toBe(false);
  });

  it("only offers job-matched groups and freezes membership and bank questions on referral", () => {
    const s=new Store(),id=s.registerCandidate("آزمایش کارتابل","j1");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"general",answers(s.candidate(id)!.entryWorkflow!.general.questions,4),"شواهد عمومی")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    expect(s.referEntry(id,"specialist","p5")).toBe(false);
    expect(s.referEntry(id,"specialist","entry-group-other")).toBe(false);
    expect(s.referEntry(id,"specialist","entry-group-management")).toBe(true);
    const snapshot=structuredClone(s.candidate(id)!.entryWorkflow!.specialist!);
    const group=s.entryGroupsForJob("j1").find(g=>g.id==="entry-group-management")!;
    expect(s.saveEntryEvaluatorGroup({...group,memberIds:["p4"],jobIds:["j2"]})).toBe(true);
    expect(s.candidate(id)!.entryWorkflow!.specialist!.assignments).toEqual(snapshot.assignments);
    const firstQuestion=s.state().entryQuestions.find(q=>q.id===snapshot.questions[0].id)!;
    expect(s.saveEntryQuestion({...firstQuestion,text:"پرسش متفاوت"})).toBe(true);
    expect(s.candidate(id)!.entryWorkflow!.specialist!.questions).toEqual(snapshot.questions);
    s.actor.set("p4");s.role.set("evaluator");
    expect(s.entryQueue("specialist")).toHaveLength(0);
    s.actor.set("p5");
    expect(s.entryQueue("specialist").some(c=>c.id===id)).toBe(true);
    expect(s.submitEntryReview(id,"specialist",answers(snapshot.questions,2),"نظر اول")).toBe(true);
    expect(s.submitEntryReview(id,"specialist",answers(snapshot.questions,3),"تکرار")).toBe(false);
    s.actor.set("p1");s.role.set("hr");
    expect(s.finalizeEntryReview(id,"medium","شواهد","جمع‌بندی")).toBe(false);
    expect(s.candidate(id)!.entryWorkflow!.specialist!.scores).toBeUndefined();
    s.actor.set("p6");s.role.set("evaluator");
    expect(s.entryQueue("specialist").some(c=>c.id===id)).toBe(true);
    expect(s.submitEntryReview(id,"specialist",answers(snapshot.questions,4),"نظر دوم")).toBe(true);
    const saved=s.candidate(id)!.entryWorkflow!.specialist!;
    expect(saved.assignments).toHaveLength(2);
    expect(saved.scores).toEqual([3,3,3,3,3]);
    expect(saved.evidence).toContain("نظر اول");
    expect(saved.evidence).toContain("نظر دوم");
    s.actor.set("p1");s.role.set("hr");
    expect(s.finalizeEntryReview(id,"medium","دلیل مستند","جمع‌بندی")).toBe(true);
    expect(s.latestEntryAssessment(id)!.scores).toEqual([3.5,3.5,3.5,3.5,3.5]);
  });

  it("keeps legacy one-person specialist assignments available after migration", () => {
    const s=new Store(),id=s.registerCandidate("تاریخی","j1");
    expect(s.referEntry(id,"general","p3")).toBe(true);
    s.actor.set("p3");s.role.set("evaluator");
    expect(s.submitEntryReview(id,"general",answers(s.candidate(id)!.entryWorkflow!.general.questions,3),"عمومی")).toBe(true);
    s.actor.set("p1");s.role.set("hr");
    s.commit("legacy",id,state=>{
      state.candidates.find(c=>c.id===id)!.entryWorkflow!.specialist={
        stage:"specialist",assignedTo:"p5",assignedAt:new Date().toISOString(),
        questions:structuredClone(state.entryQuestions.filter(q=>q.stage==="specialist"&&q.jobId==="j1")),
      };
    });
    const saved=structuredClone(s.state()) as Record<string,unknown>;
    delete saved.entryEvaluatorGroups;
    memory.set("royesh.demo.v1",JSON.stringify(saved));
    const restored=new Store();
    expect(restored.state().entryEvaluatorGroups.length).toBeGreaterThan(0);
    expect(restored.candidate(id)!.entryWorkflow!.specialist!.groupId).toBeUndefined();
    restored.actor.set("p5");restored.role.set("evaluator");
    expect(restored.entryQueue("specialist").some(c=>c.id===id)).toBe(true);
    expect(restored.submitEntryReview(id,"specialist",
      answers(restored.candidate(id)!.entryWorkflow!.specialist!.questions,4),"تاریخی")).toBe(true);
    restored.actor.set("p1");restored.role.set("hr");
    expect(restored.finalizeEntryReview(id,"high","دلیل","جمع‌بندی")).toBe(true);
  });
});
