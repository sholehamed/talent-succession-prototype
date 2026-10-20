import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { buildReport, ReportAccess, ReportFilters, ReportKind } from "../src/app/core/reporting/reports";
import { createReportWorkbook } from "../src/app/core/reporting/xlsx";

const memory=new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),
  removeItem:(k:string)=>memory.delete(k),
}});
beforeEach(()=>memory.clear());
const filters:ReportFilters={unit:"",jobId:"",period:"",status:"",search:"",from:"",to:""};
function access(s:Store,role:"hr"|"manager"|"executive"="hr"):ReportAccess {
  return {
    role,allowedPersonIds:new Set(s.state().people.filter(p=>s.allowedPerson(p.id)).map(p=>p.id)),
    restrictedUnit:role==="manager"?s.currentPerson()?.unit??"":"",
    hasAnswered:(cycle,assignment)=>s.hasAnswered(cycle,assignment),
  };
}
const report=(s:Store,kind:ReportKind,f:Partial<ReportFilters>={})=>
  buildReport(s.state(),kind,{...filters,...f},access(s,s.role() as "hr"|"manager"|"executive"));
describe("independent Store-backed reporting",()=>{
  it("derives overview metrics from current job, cycle, plan and succession arrays",()=>{
    const s=new Store(),r=report(s,"overview");
    expect(r.metrics[0].value).toBe(
      Math.round(s.state().jobs.filter(j=>j.version>0).length/s.state().jobs.length*1000)/10);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.charts[0].series[0].data.reduce((a,b)=>a+b,0)).toBe(s.state().people.length);
  });
  it("uses valid questionnaire responses and filters evaluation cycles by period and status",()=>{
    const s=new Store(),period=s.state().cycles[0].period;
    const c=report(s,"evaluations",{period});
    expect(c.rows.every(r=>r.values.period===period)).toBe(true);
    expect(c.metrics[0].value).toBe(s.state().cycles.filter(x=>x.period===period).length);
    const f=report(s,"evaluations",{status:"collecting"});
    expect(f.rows.every(r=>r.values.status==="دریافت پاسخ")).toBe(true);
    expect(f.metrics[0].value).toBe(f.rows.length);
  });
  it("never classifies people with missing performance and potential as low",()=>{
    const s=new Store(),newPerson=s.state().people[0];
    newPerson.performance=null;newPerson.potential=null;
    s.state.set({...s.state(),people:[...s.state().people]});
    const r=report(s,"talent",{status:"missing"});
    expect(r.rows.some(x=>x.id===newPerson.id&&x.values.box==="فاقد داده کامل")).toBe(true);
    expect(r.charts[0].series.reduce((sum,x)=>sum+x.data.reduce((a,b)=>a+b,0),0)).toBe(0);
  });
  it("prevents management-unit filters from revealing other units or unrelated people",()=>{
    const s=new Store();s.actor.set("p2");s.role.set("manager");
    const allowed=access(s,"manager"),u=allowed.restrictedUnit;
    const r=buildReport(s.state(),"organization",{...filters,unit:"فناوری اطلاعات"},allowed);
    expect(r.rows.every(x=>x.values.unit===u)).toBe(true);
    const peopleReport=buildReport(s.state(),"talent",filters,allowed);
    expect(peopleReport.rows.every(x=>allowed.allowedPersonIds.has(x.id))).toBe(true);
  });
  it("restricts hiring to HR and applies candidate job/status/date filters",()=>{
    const s=new Store();
    const hr=report(s,"hiring",{jobId:"j1",from:"2026-10-01",to:"2026-10-31"});
    expect(hr.rows.every(x=>x.values.job==="مدیر پروژه")).toBe(true);
    const other=buildReport(s.state(),"hiring",filters,{...access(s),role:"manager"});
    expect(other.rows).toHaveLength(0);
    expect(other.metrics).toHaveLength(0);
  });
  it("does not mistake draft performance reviews for approved KPI results",()=>{
    const s=new Store();
    const r=report(s,"performance");
    expect(r.metrics[2].value).toBeNull();
    expect(r.rows).toHaveLength(s.state().performanceReviews.length);
  });
  it("exports three real OOXML worksheets, typed numbers, RTL and safe inline strings",async()=>{
    const s=new Store(),r=report(s,"overview");
    r.rows.push({id:"security",values:{unit:"=DANGEROUS()",people:2,jobs:0,published:0,evaluated:0}});
    const blob=createReportWorkbook(r,filters,"",new Date("2026-10-20T00:00:00Z").toISOString());
    expect(blob.type).toContain("spreadsheetml.sheet");
    const raw=Buffer.from(await blob.arrayBuffer());
    expect(raw.subarray(0,4).toString("hex")).toBe("504b0304");
    const content=raw.toString("utf8");
    expect(content).toContain("xl/workbook.xml");
    expect(content).toContain("xl/worksheets/sheet3.xml");
    expect(content).toContain("rightToLeft");
    expect(content).toContain('t="inlineStr"');
    expect(content).toContain('>2</v>');
    expect(content).toContain("=DANGEROUS()");
    expect(content).not.toContain('<f>');
  });
});
