import { ReportFilters, ReportResult, ReportValue } from "./reports";

const encoder = new TextEncoder();
type Cell = string | number | null;
const xml = (s:string) => s
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&apos;");
const cellRef = (n:number) => {
  let label = "";
  for(let x=n;x>0;x=Math.floor((x-1)/26))label=String.fromCharCode(65+(x-1)%26)+label;
  return label;
};
const cell = (value:Cell,col:number,row:number,heading:boolean) => {
  const ref=cellRef(col)+row;
  if (value===null || value===undefined) return '<c r="'+ref+'"/>';
  if (typeof value==="number" && Number.isFinite(value))
    return '<c r="'+ref+'"'+(heading?' s="1"':'')+'><v>'+value+'</v></c>';
  // Inline strings are always typed as strings; never interpreted as spreadsheet formulas.
  return '<c r="'+ref+'" t="inlineStr"'+(heading?' s="1"':'')+
    '><is><t xml:space="preserve">'+xml(String(value))+'</t></is></c>';
};
function worksheet(rows:Cell[][],headers=false):string {
  const width=Math.max(1,...rows.map(r=>r.length));
  const body=rows.map((values,i)=>
    '<row r="'+(i+1)+'">'+values.map((v,j)=>cell(v,j+1,i+1,headers&&i===0)).join("")+'</row>').join("");
  const dims=Array.from({length:width},(_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+
    (i===0?32:20)+'" customWidth="1"/>').join("");
  const views='<sheetViews><sheetView rightToLeft="1" workbookViewId="0">'+
    (headers?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':'')+
    '</sheetView></sheetViews>';
  const autoFilter=headers&&rows.length>1?'<autoFilter ref="A1:'+cellRef(width)+rows.length+'"/>':'';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    views+'<sheetFormatPr defaultRowHeight="20"/><cols>'+dims+'</cols><sheetData>'+body+'</sheetData>'+
    autoFilter+'</worksheet>';
}
const u16 = (n:number) => [n&255,(n>>>8)&255];
const u32 = (n:number) => [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
const bytes = (...parts:(number[]|Uint8Array)[]) => {
  const len=parts.reduce((sum,p)=>sum+p.length,0);
  const buf=new Uint8Array(len);
  let offset=0;
  for(const part of parts){buf.set(part,offset);offset+=part.length;}
  return buf;
};
function crc32(data:Uint8Array):number {
  let crc=0xFFFFFFFF;
  for(const b of data){
    crc^=b;
    for(let k=0;k<8;k++)crc=(crc>>>1) ^ (crc&1 ? 0xEDB88320 : 0);
  }
  return (crc^0xFFFFFFFF)>>>0;
}
/** ZIP store entries (no compression), supported by Excel; no runtime packages or network. */
function zip(entries:{name:string;content:string}[]):Uint8Array {
  const local:Uint8Array[]=[];
  const central:Uint8Array[]=[];
  let offset=0;
  for(const entry of entries){
    const name=encoder.encode(entry.name),data=encoder.encode(entry.content),crc=crc32(data);
    const header=bytes(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),
      u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data);
    const directory=bytes(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),
      u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),
      u16(0),u16(0),u32(0),u32(offset),name);
    local.push(header);central.push(directory);
    offset+=header.length;
  }
  const centralBytes=bytes(...central);
  const end=bytes(u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),
    u32(centralBytes.length),u32(offset),u16(0));
  return bytes(...local,centralBytes,end);
}
const xlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relns="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export function createReportWorkbook(
  report:ReportResult, filters:ReportFilters, activeUnit:string, generatedAt:string,
):Blob {
  const summary:Cell[][]=[
    ["گزارش",report.title],["تاریخ استخراج",generatedAt],
    ["واحد",activeUnit||"همه واحدهای مجاز"],["شغل",filters.jobId||"همه مشاغل"],
    ["دوره",filters.period||"همه دوره‌ها / وضعیت جاری"],
    ["وضعیت",filters.status||"همه"],["جستجوی جدول",filters.search||"بدون جستجو"],
    ["از تاریخ ثبت",filters.from||"—"],["تا تاریخ ثبت",filters.to||"—"],
    [],["شاخص","مقدار","توضیح"],...report.metrics.map(m=>
      [m.title,m.value,m.detail+(m.suffix||"")]),[],["یادداشت",report.note],
  ];
  const details:Cell[][]=[
    report.columns.map(c=>c.title),
    ...report.rows.map(r=>report.columns.map(c=>r.values[c.key]??null)),
  ];
  const charts:Cell[][]=[];
  for(const chart of report.charts){
    charts.push([chart.title]);
    charts.push(["گروه",...chart.series.map(s=>s.name)]);
    chart.categories.forEach((category,i)=>charts.push([
      category,...chart.series.map(s=>s.data[i]??0),
    ]));
    charts.push([]);
  }
  if(!charts.length)charts.push(["نموداری برای این فیلتر وجود ندارد"]);
  const worksheets=[worksheet(summary),worksheet(details,true),worksheet(charts)];
  const entries=[
    {name:"[Content_Types].xml",content:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
      '<Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
      worksheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+
      '</Types>'},
    {name:"_rels/.rels",content:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
      '</Relationships>'},
    {name:"xl/workbook.xml",content:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<workbook xmlns="'+xlns+'" xmlns:r="'+relns+'"><bookViews><workbookView/></bookViews>'+
      '<sheets><sheet name="خلاصه" sheetId="1" r:id="rId1"/>'+
      '<sheet name="جزئیات" sheetId="2" r:id="rId2"/>'+
      '<sheet name="نمودارها" sheetId="3" r:id="rId3"/></sheets></workbook>'},
    {name:"xl/_rels/workbook.xml.rels",content:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      [1,2,3].map(i=>'<Relationship Id="rId'+i+'" Type="'+relns+
        '/worksheet" Target="worksheets/sheet'+i+'.xml"/>').join("")+
      '<Relationship Id="rId4" Type="'+relns+'/styles" Target="styles.xml"/>'+
      '</Relationships>'},
    {name:"xl/styles.xml",content:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<styleSheet xmlns="'+xlns+'"><fonts count="2"><font><sz val="11"/></font>'+
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/></font></fonts>'+
      '<fills count="3"><fill><patternFill patternType="none"/></fill>'+
      '<fill><patternFill patternType="gray125"/></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FF087864"/><bgColor indexed="64"/></patternFill></fill></fills>'+
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'+
      '</styleSheet>'},
    ...worksheets.map((content,i)=>({name:"xl/worksheets/sheet"+(i+1)+".xml",content})),
  ];
  const output=zip(entries);
  return new Blob([output.buffer as ArrayBuffer],
    {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
export function downloadReportWorkbook(report:ReportResult,filters:ReportFilters,unit:string) {
  const blob=createReportWorkbook(report,filters,unit,new Date().toISOString());
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;
  link.download="royesh-"+report.kind+"-"+new Date().toISOString().slice(0,10)+".xlsx";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
