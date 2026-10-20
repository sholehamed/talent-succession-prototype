import "@angular/compiler";
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/app/core/store";
import { PositionRiskInput } from "../src/app/core/models";
import { assessPositionRisk, validatePositionRiskInput } from "../src/app/core/position-risk";
import { buildReport, ReportAccess, ReportFilters } from "../src/app/core/reporting/reports";

const memory=new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(k:string)=>memory.get(k)??null,
  setItem:(k:string,v:string)=>memory.set(k,v),
  removeItem:(k:string)=>memory.delete(k),
}});
beforeEach(()=>memory.clear());
const valid:PositionRiskInput={
  probability:2,impact:3,months:8,reason:"حفظ تداوم پروژه",
  probabilityEvidence:"برنامه جابه‌جایی احتمالی طی سال آینده",
  impactEvidence:"وابستگی تحویل پروژه به تجربه متصدی",
  replacementBasis:"برآورد هشت ماه برای تأمین و انتقال دانش",
  mitigationAction:"تربیت یک جانشین و ثبت فرآیندها",
};
const filter:ReportFilters={unit:"",jobId:"",period:"",status:"",search:"",from:"",to:""};
function successionReport(s:Store) {
  const access:ReportAccess={
    role:"hr",
    allowedPersonIds:new Set(s.state().people.map(p=>p.id)),
    restrictedUnit:"",viewerUnit:"",
    hasAnswered:(c,a)=>s.hasAnswered(c,a),
  };
  return buildReport(s.state(),"succession",filter,access);
}
describe("evidence-backed critical position risk",()=>{
  it("does not treat Seed numbers as reviewed risk and persists a valid assessment",()=>{
    const s=new Store(),position=s.positionRecord("pos1")!;
    expect(position.probability*position.impact).toBe(3);
    expect(s.positionRisk("pos1")).toMatchObject({
      status:"unassessed",score:null,replacementMonths:null,
    });
    expect(s.savePositionRisk("pos1",valid)).toBe(true);
    expect(s.positionRisk("pos1")).toMatchObject({
      status:"current",score:6,replacementMonths:8,
    });
    const review=s.positionRecord("pos1")!.riskReview!;
    expect(review.assessedBy).toBe("p1");
    expect(review.appointmentIdAtReview).toBe(s.state().appointments.find(a=>
      a.positionId==="pos1"&&!a.effectiveTo)?.id);
    expect(review.probabilityEvidence).toBe(valid.probabilityEvidence);
    expect(new Store().positionRisk("pos1").score).toBe(6);
    expect(s.state().audit[0].action).toBe("ارزیابی ریسک پست ثبت شد");
  });

  it("rejects malformed values and missing evidence without committing or mutating",()=>{
    const s=new Store(),snapshot=JSON.stringify(s.state());
    const bad=[
      {...valid,probability:0 as 1},
      {...valid,impact:4 as 3},
      {...valid,probability:2.5 as 2},
      {...valid,months:0},
      {...valid,months:2.5},
      {...valid,probabilityEvidence:"  "},
      {...valid,reason:"  "},
    ];
    for(const input of bad){
      expect(validatePositionRiskInput(input)).toBeTruthy();
      expect(s.savePositionRisk("pos1",input)).toBe(false);
      expect(JSON.stringify(s.state())).toBe(snapshot);
    }
  });

  it("enforces HR and manager unit scope in Store, not only in the UI",()=>{
    const s=new Store();
    const pos1=s.positionRecord("pos1")!,pos2=s.positionRecord("pos2")!;
    expect(pos1.unitId).not.toBe(pos2.unitId);
    s.actor.set("p11");s.role.set("manager");
    expect(s.canReviewPositionRisk("pos1")).toBe(true);
    expect(s.canReviewPositionRisk("pos2")).toBe(false);
    expect(s.savePositionRisk("pos2",valid)).toBe(false);
    expect(s.savePositionRisk("pos1",valid)).toBe(true);
    s.role.set("executive");
    expect(s.savePositionRisk("pos1",valid)).toBe(false);
    s.role.set("employee");
    expect(s.savePositionRisk("pos1",valid)).toBe(false);
    expect(s.savePositionRisk("unknown",valid)).toBe(false);
  });

  it("invalidates the old review on vacancy, new appointment or expiry",()=>{
    const s=new Store();
    expect(s.savePositionRisk("pos1",valid)).toBe(true);
    const source=s.state();
    expect(assessPositionRisk(source,"pos1","2027-11-01").status).toBe("stale");
    const appointment=source.appointments.find(a=>a.positionId==="pos1"&&!a.effectiveTo)!;
    s.endPositionAppointment(appointment.id,"2026-10-19");
    expect(s.positionRisk("pos1").status).toBe("vacant");
    expect(s.appointPerson("p11","pos1","2026-10-20")).toBeTruthy();
    expect(s.positionRisk("pos1").status).toBe("stale");
    expect(s.positionRecord("pos1")?.riskReview?.appointmentIdAtReview).toBe(appointment.id);
  });

  it("keeps risk review when editing position structure and leaves nominations unaffected",()=>{
    const s=new Store();
    const nominations=structuredClone(s.state().nominations);
    const beforeCoverage=successionReport(s).metrics[1].value;
    expect(s.savePositionRisk("pos1",valid)).toBe(true);
    expect(s.saveOrganizationPosition({...s.positionRecord("pos1")!,title:"مدیر پروژه اصلاح‌شده",
      probability:1,impact:1,months:1,reason:"overwrite attempt",
      riskReview:undefined})).toBe(true);
    expect(s.positionRisk("pos1")).toMatchObject({status:"current",score:6});
    expect(s.positionRecord("pos1")?.months).toBe(8);
    expect(s.state().nominations).toEqual(nominations);
    expect(successionReport(s).metrics[1].value).toBe(beforeCoverage);
  });

  it("reports invalid or stale data as null and deep-links to the exact position",()=>{
    const s=new Store();
    const prior=successionReport(s).rows.find(r=>r.id==="pos1")!;
    expect(prior.values.risk).toBeNull();
    expect(prior.values.riskStatus).toBe("فاقد ارزیابی مستند");
    expect(prior.link).toBe("/talent/succession?position=pos1");
    s.savePositionRisk("pos1",valid);
    const next=successionReport(s).rows.find(r=>r.id==="pos1")!;
    expect(next.values.risk).toBe(6);
    expect(next.values.replacementMonths).toBe(8);
    expect(next.values.riskStatus).toBe("ارزیابی مستند معتبر");
    const review=s.positionRecord("pos1")!.riskReview!;
    review.appointmentIdAtReview="different";
    s.state.set({...s.state(),positions:[...s.state().positions]});
    const stale=successionReport(s).rows.find(r=>r.id==="pos1")!;
    expect(stale.values.risk).toBeNull();
    expect(stale.values.riskStatus).toBe("نیازمند بازبینی");
  });

  it("preserves a legacy snapshot without inventing review provenance",()=>{
    const s=new Store();
    const snapshot=structuredClone(s.state());
    snapshot.positions.forEach(p=>{delete p.riskReview});
    memory.set("royesh.demo.v1",JSON.stringify(snapshot));
    const restored=new Store();
    expect(restored.positionRisk("pos1").status).toBe("unassessed");
    expect(restored.state().nominations).toEqual(snapshot.nominations);
    expect(restored.state().appointments).toEqual(snapshot.appointments);
  });
});
