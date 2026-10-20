import { developmentMetrics } from "../development-metrics";
import { positionHolder } from "../organization";
import { Assignment, Band, Candidate, Cycle, DemoState, Role, bands, statusLabels } from "../models";

export type ReportKind =
  "overview" | "evaluations" | "talent" | "succession" |
  "development" | "performance" | "hiring" | "knowledge" | "organization";
export interface ReportFilters {
  unit: string;
  jobId: string;
  period: string;
  status: string;
  search: string;
  from: string;
  to: string;
}
export interface ReportAccess {
  role: Role;
  allowedPersonIds: ReadonlySet<string>;
  /** Unit of the authenticated manager; cannot be overridden by a UI filter. */
  restrictedUnit: string;
  /** Viewer unit, needed for published knowledge visibility (separate from filter unit). */
  viewerUnit: string;
  /** Use the existing validity checks, including legacy and dynamic question banks. */
  hasAnswered: (cycle:Cycle, assignment:Assignment)=>boolean;
}
export interface ReportMetric {
  title: string;
  value: number | null;
  suffix?: string;
  detail: string;
}
export interface ReportChart {
  title: string;
  categories: string[];
  series: {name: string; data: number[]}[];
}
export interface ReportColumn { key: string; title: string }
export type ReportValue = number | string | null;
export interface ReportRow {
  id: string;
  values: Record<string, ReportValue>;
  /** Link is generated only after data authorization and is never a user-provided URL. */
  link?: string;
}
export interface ReportResult {
  kind: ReportKind;
  title: string;
  description: string;
  metrics: ReportMetric[];
  charts: ReportChart[];
  columns: ReportColumn[];
  rows: ReportRow[];
  note: string;
}
export const reportCategories: {id:ReportKind; title:string; period:boolean; statuses: {value:string;label:string}[]}[] = [
  {id:"overview",title:"نمای کلان",period:true,statuses:[]},
  {id:"evaluations",title:"ارزیابی‌های چندمنبعی",period:true,statuses:[
    {value:"preparing",label:"آماده‌سازی"},{value:"collecting",label:"دریافت پاسخ"},
    {value:"calibration",label:"کالیبراسیون"},{value:"feedback",label:"آماده بازخورد"},
    {value:"closed",label:"بسته‌شده"}]},
  {id:"talent",title:"نقشه استعداد",period:false,statuses:[
    {value:"complete",label:"دارای عملکرد و پتانسیل"},{value:"missing",label:"نیازمند سنجش"}]},
  {id:"succession",title:"جانشین‌پروری",period:false,statuses:[
    {value:"ready",label:"دارای جانشین A"},{value:"unready",label:"فاقد جانشین A"}]},
  {id:"development",title:"توسعه فردی",period:true,statuses:[
    {value:"planned",label:"برنامه‌ریزی"},{value:"progress",label:"در حال انجام"},
    {value:"completed",label:"تکمیل‌شده"},{value:"blocked",label:"متوقف"},
    {value:"cancelled",label:"لغوشده"}]},
  {id:"performance",title:"عملکرد شغلی",period:true,statuses:[
    {value:"approved",label:"تأییدشده"},{value:"draft",label:"پیش‌نویس"}]},
  {id:"hiring",title:"ارزیابی بدو استخدام",period:false,statuses:[
    {value:"new",label:"در انتظار ارجاع"},{value:"general",label:"کمیته عمومی"},
    {value:"specialist",label:"کمیته تخصصی"},{value:"review",label:"در انتظار تصمیم"},
    {value:"hired",label:"استخدام‌شده"},{value:"declined",label:"استخدام‌نشده"}]},
  {id:"knowledge",title:"مدیریت دانش",period:false,statuses:[]},
  {id:"organization",title:"مشاغل و تشکیلات",period:false,statuses:[
    {value:"occupied",label:"دارای متصدی"},{value:"vacant",label:"بلاتصدی"}]},
];

export function visibleReportCategories(role: Role) {
  return reportCategories.filter(c => c.id !== "hiring" || role === "hr");
}
export function reportPeriods(state: DemoState): string[] {
  return [...new Set([
    ...state.cycles.map(c => c.period),
    ...state.plans.map(p => p.period),
    ...state.performanceReviews.map(r => r.period),
  ].filter(Boolean))].sort().reverse();
}
const round = (v:number) => Math.round(v * 10) / 10;
const average = (values:number[]):number|null =>
  values.length ? round(values.reduce((a,b)=>a+b,0)/values.length) : null;
const percent = (n:number,d:number):number|null => d ? round(n/d*100) : null;
const cols = (...pairs:[string,string][]):ReportColumn[] => pairs.map(([key,title])=>({key,title}));
const metric = (title:string,value:number|null,detail:string,suffix?:string):ReportMetric =>
  ({title,value,detail,suffix});
const row = (id:string, values:Record<string,ReportValue>, link?:string):ReportRow => ({id,values,link});
const bar = (title:string,categories:string[],name:string,data:number[]):ReportChart =>
  ({title,categories,series:[{name,data}]});
function candidateStatus(c:Candidate):string {
  if (c.decision) return c.decision.outcome;
  if (c.assessments.length) return "review";
  if (c.entryWorkflow?.specialist) return "specialist";
  if (c.entryWorkflow) return "general";
  return "new";
}
const hiringStatus:Record<string,string> = {
  new:"در انتظار ارجاع",general:"کمیته عمومی",specialist:"کمیته تخصصی",
  review:"در انتظار تصمیم",hired:"استخدام‌شده",declined:"استخدام‌نشده",
};
const look = (s:DemoState,id:string) => s.jobs.find(j=>j.id===id)?.title ?? "شغل حذف‌شده";
const searchValues = (r:ReportRow, text:string) =>
  !text || Object.values(r.values).some(v => String(v ?? "").toLocaleLowerCase("fa-IR")
    .includes(text.toLocaleLowerCase("fa-IR")));
function withSearch(result:ReportResult, f:ReportFilters):ReportResult {
  return {...result, rows:result.rows.filter(r=>searchValues(r,f.search.trim()))};
}

/** Pure and deterministic: UI cards, charts, detail rows and exports consume the same result. */
export function buildReport(
  state:DemoState, kind:ReportKind, filter:ReportFilters, access:ReportAccess,
):ReportResult {
  const effectiveUnit = access.restrictedUnit || filter.unit;
  const people = state.people.filter(p=>access.allowedPersonIds.has(p.id) &&
    (!effectiveUnit || p.unit===effectiveUnit) &&
    (!filter.jobId || p.jobId===filter.jobId));
  const personIds = new Set(people.map(p=>p.id));
  const jobs = state.jobs.filter(j=>(!effectiveUnit||j.unit===effectiveUnit) &&
    (!filter.jobId||j.id===filter.jobId));
  const jobIds = new Set(jobs.map(j=>j.id));
  const cycles = state.cycles.filter(c=>personIds.has(c.subjectId) &&
    (!filter.jobId||c.jobId===filter.jobId) && (!filter.period||c.period===filter.period));
  const plans = state.plans.filter(p=>personIds.has(p.personId) &&
    (!filter.jobId||p.jobId===filter.jobId) && (!filter.period||p.period===filter.period));
  const critical = state.positions.filter(p=>p.critical && p.isActive!==false &&
    (!effectiveUnit||p.unit===effectiveUnit) && (!filter.jobId||p.jobId===filter.jobId));
  const allPositions = state.positions.filter(p=>p.isActive!==false &&
    (!effectiveUnit||p.unit===effectiveUnit) && (!filter.jobId||p.jobId===filter.jobId));
  const nominees = (positionId:string) => state.nominations.filter(n=>
    n.positionId===positionId && access.allowedPersonIds.has(n.personId));
  const ready = critical.filter(p=>nominees(p.id).some(n=>n.readiness==="A")).length;
  const activity = plans.flatMap(p=>p.actions);
  const done = activity.filter(a=>a.status==="completed").length;
  const answered = (c:Cycle) => c.assignments.filter(a=>access.hasAnswered(c,a)).length;
  const build = (title:string,description:string,metrics:ReportMetric[],
    charts:ReportChart[],columns:ReportColumn[],rows:ReportRow[],note:string):ReportResult =>
    withSearch({kind,title,description,metrics,charts,columns,rows,note},filter);

  if (kind==="overview") {
    const published = jobs.filter(j=>j.version>0).length;
    const assignments = cycles.reduce((n,c)=>n+c.assignments.length,0);
    const responses = cycles.reduce((n,c)=>n+answered(c),0);
    const units = [...new Set(people.map(p=>p.unit).concat(jobs.map(j=>j.unit)))].sort();
    const detail = units.map(unit=>{
      const peopleIn = people.filter(p=>p.unit===unit);
      const jobsIn = jobs.filter(j=>j.unit===unit);
      return row(unit,{unit,people:peopleIn.length,jobs:jobsIn.length,
        published:jobsIn.filter(j=>j.version>0).length,
        evaluated:cycles.filter(c=>peopleIn.some(p=>p.id===c.subjectId)).length});
    });
    return build("نمای کلان سرمایه انسانی","پوشش ساختار شغلی، مشارکت در ارزیابی، توسعه و تداوم پست‌های حیاتی",
      [metric("پوشش شناسنامه",percent(published,jobs.length),published+" شناسنامه منتشرشده از "+jobs.length,"٪"),
      metric("مشارکت در ارزیابی",percent(responses,assignments),responses+" پاسخ از "+assignments+" تکلیف در دوره","٪"),
      metric("تکمیل اقدامات توسعه",percent(done,activity.length),done+" اقدام از "+activity.length+" اقدام در دوره","٪"),
      metric("پوشش پست‌های حیاتی",percent(ready,critical.length),ready+" پست از "+critical.length+" پست حیاتی","٪")],
      [{title:"حجم افراد و مشاغل به تفکیک واحد",categories:units,series:[
        {name:"افراد",data:units.map(u=>people.filter(p=>p.unit===u).length)},
        {name:"مشاغل",data:units.map(u=>jobs.filter(j=>j.unit===u).length)}]}],
      cols(["unit","واحد"],["people","تعداد افراد"],["jobs","مشاغل"],["published","شناسنامه منتشرشده"],["evaluated","پرونده‌های ارزیابی"]),
      detail,"شاخص‌های ارزیابی و توسعه وابسته به دوره‌اند؛ مشاغل، افراد و جانشینی وضعیت جاری‌اند. صفر مخرج به‌صورت ناموجود نمایش داده می‌شود.");
  }
  if (kind==="evaluations") {
    const items = cycles.filter(c=>!filter.status||c.status===filter.status);
    const assigned = items.reduce((n,c)=>n+c.assignments.length,0);
    const responded = items.reduce((n,c)=>n+answered(c),0);
    const statuses = ["preparing","collecting","calibration","feedback","closed"];
    const resultRows = items.map(c=>row(c.id,{
      person:state.people.find(p=>p.id===c.subjectId)?.name??"—",
      job:look(state,c.jobId),cycle:c.title,period:c.period,mode:String(c.mode),
      status:statusLabels[c.status]??c.status,assigned:c.assignments.length,
      answered:answered(c),participation:percent(answered(c),c.assignments.length),
    },access.role==="hr" ? "/evaluations/"+c.id : "/evaluations/reports/"+c.id));
    return build("ارزیابی‌های چندمنبعی","پایش پیشرفت واقعی ارجاع‌ها و پاسخ‌های ۳۶۰/۵۴۰",
      [metric("پرونده ارزیابی",items.length,"تعداد دوره/پرونده‌های فیلترشده"),
      metric("مشارکت پاسخ‌دهندگان",percent(responded,assigned),responded+" پاسخ از "+assigned+" تکلیف","٪"),
      metric("پرونده منتشرشده",items.filter(c=>["feedback","closed"].includes(c.status)).length,"دارای بازخورد یا بسته‌شده"),
      metric("تکلیف باقی‌مانده",assigned-responded,"فقط در پرونده‌های فیلترشده")],
      [bar("وضعیت پرونده‌های ارزیابی",statuses.map(s=>statusLabels[s]),"تعداد",
        statuses.map(s=>items.filter(c=>c.status===s).length))],
      cols(["person","ارزیابی‌شونده"],["job","شغل هدف"],["cycle","عنوان"],["period","دوره"],
        ["mode","نوع"],["status","وضعیت"],["assigned","تکالیف"],["answered","پاسخ"],["participation","مشارکت (٪)"]),
      resultRows,"درصد مشارکت از نسبت پاسخ‌های ثبت‌شده به تکالیف محاسبه می‌شود؛ امتیازهای محرمانه ارزیابان در این گزارش افشا نمی‌شوند.");
  }
  if (kind==="talent") {
    const included = people.filter(p=> !filter.status ||
      (filter.status==="complete" ? !!p.performance&&!!p.potential : !p.performance||!p.potential));
    const classified = included.filter(p=>p.performance&&p.potential);
    const values:Band[]=["low","medium","high"];
    const resultRows=included.map(p=>row(p.id,{person:p.name,unit:p.unit,job:look(state,p.jobId),
      performance:p.performance?bands[p.performance]:"نامشخص",
      potential:p.potential?bands[p.potential]:"نامشخص",
      box:p.performance&&p.potential ? bands[p.performance]+" / "+bands[p.potential]:"فاقد داده کامل",
    },"/people/"+p.id));
    return build("نقشه استعداد ۹خانه","عملکرد شغلی و پتانسیل رشد دو بعد مستقل‌اند؛ افراد فاقد داده در خانه قرار نمی‌گیرند",
      [metric("افراد در محدوده",included.length,"افراد قابل مشاهده برای نقش جاری"),
        metric("دارای دو بعد معتبر",classified.length,"عملکرد و پتانسیل مشخص"),
        metric("فاقد داده کافی",included.length-classified.length,"عدم جانمایی در ماتریس"),
        metric("پتانسیل بالا",classified.filter(p=>p.potential==="high").length,"از افراد قابل جانمایی")],
      [{title:"توزیع ۹خانه؛ محور افقی عملکرد و سری‌ها پتانسیل",categories:values.map(v=>bands[v]),
        series:values.map(potential=>({name:"پتانسیل "+bands[potential],
          data:values.map(performance=>classified.filter(p=>p.performance===performance&&p.potential===potential).length)}))}],
      cols(["person","فرد"],["unit","واحد"],["job","شغل"],["performance","عملکرد"],
        ["potential","پتانسیل"],["box","موقعیت در ماتریس"]),
      resultRows,"مقادیر فرد فقط از مدل ثبت‌شده خوانده می‌شود؛ نبود ارزیابی به معنای عملکرد ضعیف نیست. ماتریس تصمیم انتصاب خودکار نیست.");
  }
  if (kind==="succession") {
    const selected=critical.filter(p=>!filter.status ||
      (filter.status==="ready" ? nominees(p.id).some(n=>n.readiness==="A"):
        !nominees(p.id).some(n=>n.readiness==="A")));
    const levels=["A","B","C"];
    const rows=selected.map(p=>{
      const n=nominees(p.id);
      return row(p.id,{position:p.title,unit:p.unit,job:look(state,p.jobId),
        risk:p.probability*p.impact,candidates:n.length,
        A:n.filter(x=>x.readiness==="A").length,
        B:n.filter(x=>x.readiness==="B").length,
        C:n.filter(x=>x.readiness==="C").length,
        ready:n.some(x=>x.readiness==="A")?"دارای جانشین آماده":"فاقد جانشین آماده"
      },"/talent/succession?job="+encodeURIComponent(p.jobId));
    });
    const nready=selected.filter(p=>nominees(p.id).some(n=>n.readiness==="A")).length;
    return build("جانشین‌پروری و ریسک پست‌ها","پوشش آمادگی انسانی A/B/C برای هر پست حیاتی فعال",
      [metric("پست حیاتی",selected.length,"پست‌های فعال در محدوده"),
        metric("پوشش جانشین A",percent(nready,selected.length),nready+" پست با نامزد A","٪"),
        metric("فاقد جانشین A",selected.length-nready,"پست نیازمند برنامه جانشینی"),
        metric("نامزدهای ثبت‌شده",selected.reduce((n,p)=>n+nominees(p.id).length,0),"ثبت آمادگی انسانی مرتبط با پست")],
      [bar("پراکندگی آمادگی نامزدها",levels,"نامزد",levels.map(l=>selected.reduce((n,p)=>
        n+nominees(p.id).filter(x=>x.readiness===l).length,0)))],
      cols(["position","پست"],["unit","واحد"],["job","شغل"],["risk","احتمال × اثر"],
        ["candidates","نامزدها"],["A","A"],["B","B"],["C","C"],["ready","پوشش"]),
      rows,"آمادگی به رابطه نامزد و پست وابسته است؛ به‌صورت خودکار از موقعیت ۹خانه محاسبه نمی‌شود.");
  }
  if (kind==="development") {
    const scopedState:DemoState={...state,plans:state.plans.filter(p=>!filter.jobId||p.jobId===filter.jobId),
      cycles:state.cycles.filter(c=>!filter.jobId||c.jobId===filter.jobId)};
    const m=developmentMetrics(scopedState,personIds,filter.period);
    const actions=m.actions.filter(({action})=>!filter.status||action.status===filter.status);
    const ncompleted=actions.filter(x=>x.action.status==="completed").length;
    const nreviewed=actions.filter(x=>x.action.status==="completed"&&!!x.action.effectiveness).length;
    const rows=actions.map(({action,plan})=>row(action.id,{
      person:state.people.find(p=>p.id===plan.personId)?.name??"—",
      job:look(state,plan.jobId),period:plan.period,title:action.title,
      status:statusLabels[action.status]??action.status,
      due:action.due,effectiveness:action.effectiveness?.outcome==="effective"?"مؤثر":
        action.effectiveness?.outcome==="partial"?"تاحدی مؤثر":
          action.effectiveness?.outcome==="ineffective"?"غیرمؤثر":"ثبت نشده",
    },"/development/idp/"+plan.id));
    return build("تحلیل توسعه فردی","تکمیل اقدامات، بررسی اثربخشی مدیر و پرونده‌های توسعه در محدوده فیلتر",
      [metric("اقدامات توسعه",actions.length,"اقدامات در فیلترهای جاری"),
        metric("تکمیل فعالیت",percent(ncompleted,actions.length),ncompleted+" اقدام تکمیل‌شده","٪"),
        metric("بررسی اثربخشی",percent(nreviewed,ncompleted),nreviewed+" اقدام بازبینی‌شده از "+ncompleted+" تکمیل‌شده","٪"),
        metric("رشد مشاهده‌شده",!filter.status ? m.meanObservedChange : null,
          !filter.status?m.growthRows.length+" مقایسه معتبر بین دوره‌ها":"با فیلتر وضعیت اقدام قابل انتساب نیست")],
      [bar("وضعیت اقدامات توسعه",["planned","progress","completed","blocked","cancelled"].map(s=>statusLabels[s]),"تعداد",
        ["planned","progress","completed","blocked","cancelled"].map(s=>actions.filter(a=>a.action.status===s).length))],
      cols(["person","فرد"],["job","شغل"],["period","دوره"],["title","اقدام"],
        ["status","وضعیت"],["due","سررسید"],["effectiveness","نظر اثربخشی"]),
      rows,"پیشرفت، نظر اثربخشی و رشد شایستگی سه مفهوم مستقل‌اند؛ مقایسه تاریخی تابع داده‌های منتشرشده و محدودیت Snapshot است.");
  }
  if (kind==="performance") {
    const records=state.performanceReviews.filter(r=>personIds.has(r.personId) &&
      (!filter.jobId||r.jobId===filter.jobId) && (!filter.period||r.period===filter.period) &&
      (!filter.status||r.status===filter.status));
    const approved=records.filter(r=>r.status==="approved");
    const rows=records.map(r=>row(r.id,{
      person:state.people.find(p=>p.id===r.personId)?.name??"—",
      job:look(state,r.jobId),period:r.period,status:r.status==="approved"?"تأییدشده":"پیش‌نویس",
      kpis:r.kpis.length,achievement:r.status==="approved"?r.score:null,
      band:r.status==="approved"?bands[r.band]:"تأیید نشده",
    },"/performance/"+r.personId));
    return build("عملکرد شغلی مبتنی بر KPI","گزارش عملکرد فقط براساس فرم‌های ثبت‌شده و تأیید منابع انسانی",
      [metric("سوابق عملکرد",records.length,"فرم‌های موجود در محدوده"),
        metric("سوابق تأییدشده",approved.length,"قابل استناد در گزارش رسمی"),
        metric("میانگین تحقق KPI",average(approved.map(r=>r.score)),
          approved.length+" ارزیابی تأییدشده","٪"),
        metric("پیش‌نویس‌ها",records.length-approved.length,"از این محاسبه حذف شده‌اند")],
      [bar("وضعیت سوابق ارزیابی عملکرد",["تأییدشده","پیش‌نویس"],"تعداد",
        [approved.length,records.length-approved.length])],
      cols(["person","فرد"],["job","شغل"],["period","دوره"],["status","وضعیت"],
        ["kpis","تعداد KPI"],["achievement","تحقق میانگین (٪)"],["band","سطح عملکرد"]),
      rows,"داده اولیه Seed فاقد فرم مستند KPI است؛ بدون ارزیابی تأییدشده میانگین رسمی گزارش نمی‌شود.");
  }
  if (kind==="hiring") {
    if(access.role!=="hr")
      return build("ارزیابی بدو استخدام","این حوزه مخصوص منابع انسانی است.",[],[],[],[],
        "داده فردی استخدام برای این نقش مجاز نیست.");
    const all=state.candidates.filter(c=>jobIds.has(c.jobId) &&
      (!filter.from||c.createdAt.slice(0,10)>=filter.from) &&
      (!filter.to||c.createdAt.slice(0,10)<=filter.to));
    const items=all.filter(c=>!filter.status||candidateStatus(c)===filter.status);
    const statuses=["new","general","specialist","review","hired","declined"];
    const rows=items.map(c=>{
      const sp=c.entryWorkflow?.specialist, completed=sp?.assignments?.filter(a=>a.completedAt).length??0,
        total=sp?.assignments?.length??0;
      return row(c.id,{person:c.name,job:look(state,c.jobId),date:c.createdAt.slice(0,10),
        status:hiringStatus[candidateStatus(c)],group:sp?.groupName??(sp?"ارجاع تک‌نفره قدیمی":"—"),
        progress:sp?.assignments ? completed+" / "+total : sp?sp.completedAt?"تکمیل‌شده":"در جریان":"—",
        assessed:c.assessments.length,
      },"/hiring/"+c.id);
    });
    return build("جذب و ارزیابی بدو استخدام","پرونده‌های داوطلبان، گردش کمیته‌ها و گروه‌های تخصصی",
      [metric("پرونده داوطلب",items.length,"در بازه تاریخ و فیلترها"),
        metric("استخدام‌شده",items.filter(c=>c.decision?.outcome==="hired").length,"با تصمیم انسانی منابع انسانی"),
        metric("در کمیته تخصصی",items.filter(c=>!!c.entryWorkflow?.specialist && !c.entryWorkflow.specialist.completedAt).length,"در انتظار تکمیل پاسخ‌ها"),
        metric("تکمیل تخصصی",items.filter(c=>!!c.entryWorkflow?.specialist?.completedAt).length,"نتیجه تخصصی ثبت‌شده")],
      [bar("وضعیت پرونده‌های جذب",statuses.map(s=>hiringStatus[s]),"پرونده",
        statuses.map(s=>items.filter(c=>candidateStatus(c)===s).length))],
      cols(["person","داوطلب"],["job","شغل هدف"],["date","تاریخ ثبت"],
        ["status","وضعیت"],["group","گروه تخصصی"],["progress","پیشرفت اعضا"],["assessed","نتایج نهایی"]),
      rows,"از تاریخ ثبت داوطلب برای فیلتر زمانی استفاده می‌شود، نه از تاریخ تکمیل هر مرحله. انتخاب گروه و ثبت استخدام انسانی است.");
  }
  if (kind==="knowledge") {
    const items=state.knowledge.filter(k=>k.status==="published" && jobIds.has(k.jobId) &&
      (access.role!=="executive" || k.access==="داخلی" ||
        state.jobs.find(j=>j.id===k.jobId)?.unit===access.viewerUnit));
    const kinds=[...new Set(items.map(k=>k.kind))].sort();
    const rows=items.map(k=>row(k.id,{
      title:k.title,job:look(state,k.jobId),kind:k.kind,views:k.views,
      revision:k.revision,status:"منتشرشده",
    },"/knowledge/"+k.id));
    return build("مدیریت دانش و درس‌آموخته‌ها","محتوای منتشرشده و شمار مشاهده‌های ثبت‌شده",
      [metric("محتوای منتشرشده",items.length,"فقط محتوای منتشرشده"),
        metric("درس‌آموخته AAR",items.filter(k=>k.kind==="AAR").length,"از محتوای منتشرشده"),
        metric("مجموع مشاهده",items.reduce((n,k)=>n+k.views,0),"مشاهده‌های ثبت‌شده در Store"),
        metric("مشاغل دارای محتوا",new Set(items.map(k=>k.jobId)).size,"مشاغل تحت پوشش")],
      [bar("انواع محتوای منتشرشده",kinds,"تعداد",kinds.map(kind=>items.filter(k=>k.kind===kind).length))],
      cols(["title","محتوا"],["job","شغل"],["kind","نوع"],["views","بازدید"],
        ["revision","بازنگری"],["status","وضعیت"]),
      rows,"فقط عنوان و متادیتای محتوای منتشرشده گزارش می‌شود؛ متن و پیوست‌ها در Excel افشا نمی‌شوند.");
  }
  const selected=allPositions.filter(p=>{
    if(!filter.status)return true;
    const occupied=!!positionHolder(state,p.id);
    return filter.status==="occupied"?occupied:!occupied;
  });
  const occupied=selected.filter(p=>!!positionHolder(state,p.id)).length;
  const rows=selected.map(p=>{
    const holder=positionHolder(state,p.id);
    return row(p.id,{position:p.title,code:p.code??p.id,
      job:look(state,p.jobId),unit:p.unit,
      holder:holder && access.allowedPersonIds.has(holder.id)?holder.name:holder?"محدود":"بلاتصدی",
      critical:p.critical?"بله":"خیر",
    },"/organization/positions");
  });
  return build("مشاغل و ساختار سازمانی","نسخه‌های منتشرشده، پست‌های فعال و وضعیت تصدی در تاریخ جاری",
    [metric("مشاغل",jobs.length,"شغل‌های تعریف‌شده در محدوده"),
      metric("پوشش انتشار شناسنامه",percent(jobs.filter(j=>j.version>0).length,jobs.length),
        jobs.filter(j=>j.version>0).length+" منتشرشده","٪"),
      metric("پست فعال",selected.length,"پست‌های موجود در ساختار سازمانی"),
      metric("پست بلاتصدی",selected.length-occupied,"برمبنای انتصاب اصلی مؤثر")],
    [bar("وضعیت تصدی پست‌ها",["دارای متصدی","بلاتصدی"],"تعداد",
      [occupied,selected.length-occupied])],
    cols(["position","پست"],["code","کد"],["job","شغل"],
      ["unit","واحد"],["holder","متصدی"],["critical","حیاتی"]),
    rows,"تصدی از انتصاب اصلی مؤثر در تاریخ جاری محاسبه می‌شود؛ داده‌های ثبت‌شده قبلی تغییری نمی‌کنند.");
}
