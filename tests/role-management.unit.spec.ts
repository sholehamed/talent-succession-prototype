import "@angular/compiler";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { DEFAULT_PASSWORD, SESSION_KEY } from "../src/app/core/auth";
import { Role } from "../src/app/core/models";

const data = new Map<string,string>();
const session = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),
  removeItem:(k:string)=>data.delete(k),
}});
Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{
  getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v),
  removeItem:(k:string)=>session.delete(k),
}});
beforeEach(()=>{
  data.clear(); session.clear();
  Object.defineProperty(globalThis,"window",{configurable:true,value:{}});
});
afterEach(()=>Reflect.deleteProperty(globalThis,"window"));
const enter=(store:Store,id:string,role?:Role)=>{
  expect(store.login(id,DEFAULT_PASSWORD)).toBe(true);
  if(role) expect(store.switchRole(role)).toBe(true);
};

describe("HR role management from persisted per-person grants",()=>{
  it("keeps the original executive dashboard as the default for a dual-role leader",()=>{
    const s=new Store();
    enter(s,"p11");
    expect(s.rolesOf("p11")).toContain("manager");
    expect(s.rolesOf("p11")).toContain("executive");
    expect(s.role()).toBe("executive");
    expect(s.switchRole("manager")).toBe(true);
    expect(s.role()).toBe("manager");
  });
  it("preserves current legacy grants and migrates old snapshots without erasing organizational data",()=>{
    const hr=new Store();
    expect(hr.rolesOf("p1")).toContain("hr");
    expect(hr.rolesOf("p12")).toContain("owner");
    expect(hr.rolesOf("p3")).toEqual(["employee","evaluator"]);
    const snapshot=structuredClone(hr.state());
    delete (snapshot as Partial<typeof snapshot>).roleAssignments;
    data.set("royesh.demo.v1",JSON.stringify(snapshot));
    const restored=new Store();
    expect(restored.rolesOf("p12")).toContain("owner");
    expect(restored.rolesOf("p1")).toContain("hr");
    expect(restored.state().appointments).toEqual(snapshot.appointments);
    expect(restored.state().nominations).toEqual(snapshot.nominations);
  });

  it("lets HR grant an owner role, then the person can use owner actions after logging in",()=>{
    const hr=new Store();
    enter(hr,"p1","hr");
    expect(hr.setPersonRoles("p3",["employee","evaluator","owner"])).toBe(true);
    expect(hr.state().audit[0].entity).toBe("p3");
    expect(hr.state().audit[0].action).toBe("نقش‌های کاربر تغییر کرد");
    hr.logout();
    enter(hr,"p3");
    expect(hr.permittedRoles()).toEqual(["employee","evaluator","owner"]);
    expect(hr.role()).toBe("owner");
    expect(hr.canApprove()).toBe(true);
    expect(hr.canAccess(["hr"])).toBe(false);
    expect(new Store().rolesOf("p3")).toContain("owner");
  });

  it("revokes roles without restoring their old hardcoded grants and rejects unauthorized switching",()=>{
    const s=new Store();
    enter(s,"p1","hr");
    expect(s.setPersonRoles("p12",["employee"])).toBe(true);
    expect(s.rolesOf("p12")).toEqual(["employee"]);
    expect(s.setPersonRoles("p2",["employee","evaluator"])).toBe(true);
    const saved=new Store();
    saved.login("p12",DEFAULT_PASSWORD);
    expect(saved.role()).toBe("employee");
    expect(saved.switchRole("owner")).toBe(false);
    expect(saved.canApprove()).toBe(false);
    expect(saved.rolesOf("p2")).not.toContain("manager");
  });

  it("denies non-HR edits, unknown roles and empty role lists without mutating state",()=>{
    const s=new Store();
    enter(s,"p1","hr");
    const before=JSON.stringify(s.state());
    expect(s.setPersonRoles("does-not-exist",["owner"])).toBe(false);
    expect(s.setPersonRoles("p3",[])).toBe(false);
    expect(s.setPersonRoles("p3",["superuser" as Role])).toBe(false);
    expect(JSON.stringify(s.state())).toBe(before);
    s.logout();
    enter(s,"p2","manager");
    expect(s.setPersonRoles("p3",["hr"])).toBe(false);
    expect(JSON.stringify(s.state())).toBe(before);
  });

  it("prevents removing the current HR or the final HR account",()=>{
    const s=new Store();
    enter(s,"p1","hr");
    const before=JSON.stringify(s.state());
    expect(s.setPersonRoles("p1",["employee"])).toBe(false);
    expect(JSON.stringify(s.state())).toBe(before);
    expect(s.setPersonRoles("p3",["employee","hr"])).toBe(true);
    expect(s.rolesOf("p3")).toContain("hr");
    expect(s.setPersonRoles("p1",["employee"])).toBe(false);
    expect(s.setPersonRoles("p3",["employee"])).toBe(true);
    expect(s.rolesOf("p1")).toContain("hr");
  });

  it("falls back to a permitted role when a restored session contains a revoked role",()=>{
    const s=new Store();
    enter(s,"p1","hr");
    s.setPersonRoles("p12",["employee"]);
    session.set(SESSION_KEY,JSON.stringify({id:"p12",role:"owner"}));
    const restarted=new Store();
    expect(restarted.authenticated()).toBe(true);
    expect(restarted.actor()).toBe("p12");
    expect(restarted.role()).toBe("employee");
    expect(restarted.canAccess(["owner"])).toBe(false);
    expect(JSON.parse(session.get(SESSION_KEY)!).role).toBe("employee");
  });

  it("persists role removal for evaluator membership checks",()=>{
    const s=new Store();enter(s,"p1","hr");
    expect(s.setEntryCommitteeMember("general","p3",true)).toBe(true);
    expect(s.setPersonRoles("p3",["employee"])).toBe(true);
    expect(s.setEntryCommitteeMember("general","p3",true)).toBe(false);
    s.logout();enter(s,"p3");
    expect(s.switchRole("evaluator")).toBe(false);
  });
});
