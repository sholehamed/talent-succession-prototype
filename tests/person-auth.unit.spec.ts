import "@angular/compiler";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { DEFAULT_PASSWORD, SESSION_KEY, rolesForPerson } from "../src/app/core/auth";
const data = new Map<string,string>(), session = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k),
}});
Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{
  getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v),removeItem:(k:string)=>session.delete(k),
}});
beforeEach(()=>{data.clear();session.clear();Object.defineProperty(globalThis,"window",{configurable:true,value:{}})});
afterEach(()=>{Reflect.deleteProperty(globalThis,"window")});

describe("person sessions and scoping",()=>{
  it("requires valid individual ID/password; restores session; limits role switch; logs out",()=>{
    const s = new Store();
    expect(s.authenticated()).toBe(false);
    expect(s.login("missing",DEFAULT_PASSWORD)).toBe(false);
    expect(s.login("p3","bad")).toBe(false);
    expect(s.login("p3",DEFAULT_PASSWORD)).toBe(true);
    expect(s.actor()).toBe("p3");
    expect(s.role()).toBe("employee");
    expect(s.permittedRoles()).toEqual(["employee","evaluator"]);
    expect(s.switchRole("hr")).toBe(false);
    expect(s.role()).toBe("employee");
    expect(s.switchRole("evaluator")).toBe(true);
    expect(JSON.parse(session.get(SESSION_KEY)!).id).toBe("p3");
    const restored=new Store();
    expect(restored.authenticated()).toBe(true);
    expect(restored.role()).toBe("evaluator");
    expect(restored.actor()).toBe("p3");
    restored.logout();
    expect(restored.authenticated()).toBe(false);
    expect(session.has(SESSION_KEY)).toBe(false);
  });
  it("grants privileged roles only to selected people and limits manager scope",()=>{
    expect(rolesForPerson("p1")).toContain("hr");
    expect(rolesForPerson("p2")).toContain("manager");
    expect(rolesForPerson("p11")).toContain("executive");
    expect(rolesForPerson("p11")).toContain("manager");
    expect(rolesForPerson("p12")).toContain("owner");
    expect(rolesForPerson("p3")).toEqual(["employee","evaluator"]);
    const s=new Store();
    s.login("p11",DEFAULT_PASSWORD);
    s.switchRole("manager");
    expect(s.allowedPerson("p1")).toBe(true);
    expect(s.allowedPerson("p3")).toBe(false);
    s.logout();
    s.login("p3",DEFAULT_PASSWORD);
    expect(s.allowedPerson("p3")).toBe(true);
    expect(s.allowedPerson("p2")).toBe(false);
    expect(s.canAccess(["hr"])).toBe(false);
  });
  it("allows an employee to update only owned actions; retains assignee even across old state",()=>{
    const s=new Store();
    s.login("p3",DEFAULT_PASSWORD);
    expect(s.assignedActions().some((x)=>x.action.assigneeId==="p3")).toBe(true);
    const own=s.state().plans.find((p)=>p.id==="d2")!;
    const action=own.actions.find((a)=>a.assigneeId==="p3")!;
    expect(s.saveAction("d2",{...action,status:"completed",evidence:"شاهد اجرای من"})).toBe(true);
    expect(s.saveAction("d2",{...action,title:"عنوان جعلی"})).toBe(false);
    expect(s.saveAction("d1",{...s.state().plans[0].actions[0],status:"completed"})).toBe(false);
    expect(s.state().plans.find((p)=>p.id==="d2")!.actions[0].evidence).toBe("شاهد اجرای من");
    const old=structuredClone(s.state());
    for(const p of old.plans)for(const a of p.actions)delete a.assigneeId;
    data.set("royesh.demo.v1",JSON.stringify(old));
    const restored=new Store();
    expect(restored.assignedActions().length).toBeGreaterThan(0);
  });
  it("binds evaluator submission to person ID, never a client-selected second evaluator",()=>{
    const hr=new Store();hr.login("p1",DEFAULT_PASSWORD);
    expect(hr.advance("c1")).toBe(true);
    hr.logout();
    hr.login("p3",DEFAULT_PASSWORD);
    hr.switchRole("evaluator");
    const c=hr.cycle("c1")!;
    const own=c.assignments.find((a)=>a.personId==="p3")!;
    const other=c.assignments.find((a)=>a.personId==="p4")!;
    const answers=hr.questionsFor(c,"peer").map((q)=>({questionId:q.id,score:4}));
    expect(hr.submit(c.id,other.id,answers)).toBe(false);
    expect(hr.submit(c.id,own.id,answers)).toBe(true);
    expect(hr.submit(c.id,own.id,answers)).toBe(false);
    expect(c.assignments.find((a)=>a.id===other.id)?.answers).toBeUndefined();
  });
});
