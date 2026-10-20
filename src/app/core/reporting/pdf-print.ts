import { ReportFilters, ReportResult, ReportValue } from "./reports";
const html = (s:string) => s.replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const fmt = (v:ReportValue, suffix="") =>
  v===null||v===undefined ? "—" :
  typeof v==="number" ? v.toLocaleString("fa-IR",{maximumFractionDigits:1})+suffix : v;
const text = (v:ReportValue,suffix="") => html(String(fmt(v,suffix)));
/**
 * Use the browser's native print-to-PDF pipeline: Vazirmatn is already loaded
 * locally in the app, so complex Persian/RTL shaping stays correct offline.
 * The print DOM is derived exclusively from the same authorized ReportResult
 * used for the charts and XLSX; it never fetches data from a remote endpoint.
 */
export function printReportPdf(report:ReportResult,filters:ReportFilters,unit:string):void {
  document.getElementById("royesh-report-print-root")?.remove();
  document.getElementById("royesh-report-print-style")?.remove();
  const tableHeader=report.columns.map(c=>"<th>"+html(c.title)+"</th>").join("");
  const tableBody=report.rows.map(r=>"<tr>"+report.columns.map(c=>
    "<td>"+text(r.values[c.key]??null)+"</td>").join("")+"</tr>").join("");
  const metrics=report.metrics.map(m=>'<section class="metric"><small>'+html(m.title)+
    '</small><strong>'+text(m.value,m.suffix??"")+'</strong><p>'+html(m.detail)+
    "</p></section>").join("");
  const charts=report.charts.map(chart=>{
    const max=Math.max(1,...chart.series.flatMap(s=>s.data));
    const rows=chart.categories.map((category,i)=>
      '<div class="bar-group"><strong>'+html(category)+'</strong>'+chart.series.map(s=>{
        const value=s.data[i]??0;
        const label=chart.series.length>1?s.name+" · ":"";
        return '<div class="bar-line"><small>'+html(label)+text(value)+
          '</small><div class="bar-track"><span style="width:'+
          Math.min(100,Math.max(0,value/max*100))+'%"></span></div></div>';
      }).join("")+"</div>").join("");
    return '<section class="print-chart"><h2>'+html(chart.title)+"</h2>"+rows+"</section>";
  }).join("");
  const details=[
    ["واحد",unit||"همه واحدهای مجاز"],["شغل",filters.jobId||"همه مشاغل"],
    ["دوره",filters.period||"همه دوره‌ها / وضعیت جاری"],
    ["وضعیت",filters.status||"همه"],["جستجوی جدول",filters.search||"ندارد"],
    ["از تاریخ",filters.from||"—"],["تا تاریخ",filters.to||"—"],
  ];
  const top='<header><h1>'+html(report.title)+'</h1><p>'+html(report.description)+
    '</p><div class="meta">تاریخ استخراج: '+html(new Date().toLocaleString("fa-IR"))+
    ' · '+details.map(([k,v])=>html(k)+": "+html(v)).join(" | ")+'</div></header>';
  const root=document.createElement("div");
  root.id="royesh-report-print-root";
  root.setAttribute("dir","rtl");
  root.innerHTML=top+'<div class="metrics">'+metrics+'</div>'+charts+
    '<section class="print-details"><h2>داده‌های تفصیلی ('+
    text(report.rows.length)+')</h2><table><thead><tr>'+tableHeader+
    '</tr></thead><tbody>'+tableBody+'</tbody></table></section>'+
    '<footer><strong>توضیح روش محاسبه و محدوده داده:</strong> '+html(report.note)+
    '<p>اطلاعات از داده‌های قابل مشاهده برای نقش فعال در همین مرورگر تولید شده‌اند.</p></footer>';
  const style=document.createElement("style");
  style.id="royesh-report-print-style";
  style.textContent='@media screen{#royesh-report-print-root{display:none!important}}'+
    '@media print{'+
    '@page{size:A4 landscape;margin:13mm}'+
    'body{background:white!important;color:#243545!important;font-family:Vazirmatn,sans-serif!important}'+
    'body > :not(#royesh-report-print-root){display:none!important}'+
    '#royesh-report-print-root{display:block!important;direction:rtl;font:11px/1.65 Vazirmatn,sans-serif}'+
    '#royesh-report-print-root h1{font-size:21px}'+
    '#royesh-report-print-root h2{font-size:14px;margin:12px 0}'+
    '#royesh-report-print-root .meta{font-size:9px;color:#667;margin:12px 0}'+
    '#royesh-report-print-root .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:15px 0}'+
    '#royesh-report-print-root .metric{padding:9px;border:1px solid #dce5e8;border-radius:7px;break-inside:avoid}'+
    '#royesh-report-print-root .metric small{display:block}'+
    '#royesh-report-print-root .metric strong{display:block;font-size:17px;color:#087864}'+
    '#royesh-report-print-root .metric p{font-size:9px}'+
    '#royesh-report-print-root .print-chart{margin:12px 0;break-inside:avoid}'+
    '#royesh-report-print-root .bar-group{margin:4px 0;padding:4px 0;border-bottom:1px solid #eee}'+
    '#royesh-report-print-root .bar-group>strong{display:inline-block;min-width:90px}'+
    '#royesh-report-print-root .bar-line{display:inline-flex;min-width:105px;max-width:230px;vertical-align:middle;align-items:center;gap:6px;margin-left:10px}'+
    '#royesh-report-print-root .bar-line small{white-space:nowrap}'+
    '#royesh-report-print-root .bar-track{height:7px;width:110px;background:#e8f1ef;border-radius:6px}'+
    '#royesh-report-print-root .bar-track span{display:block;height:100%;background:#0d8b78;border-radius:6px}'+
    '#royesh-report-print-root table{width:100%;border-collapse:collapse;font-size:9px}'+
    '#royesh-report-print-root th,#royesh-report-print-root td{border:1px solid #dce5e8;padding:6px;text-align:right}'+
    '#royesh-report-print-root th{background:#e6f1ed}'+
    '#royesh-report-print-root thead{display:table-header-group}'+
    '#royesh-report-print-root tr{break-inside:avoid}'+
    '#royesh-report-print-root footer{margin-top:16px;font-size:10px;border-top:1px solid #ddd;padding-top:9px}'+
    '}';
  document.head.appendChild(style);
  document.body.appendChild(root);
  const originalTitle=document.title;
  document.title=report.title+" - رویش";
  const clean=()=>{root.remove();style.remove();document.title=originalTitle;
    window.removeEventListener("afterprint",clean);};
  window.addEventListener("afterprint",clean,{once:true});
  try{window.print();}catch(error){clean();throw error;}
}
