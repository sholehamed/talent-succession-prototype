import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Band, bands, TalentPositionEvent } from "../core/models";
import { nineBoxProfile } from "../core/nine-box";
import { nineBoxChanges, NineBoxMovement } from "../core/talent-history";
import { UI } from "../shared/ui";

function dayString(date:Date):string{
  return [String(date.getFullYear()),String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0")].join("-");
}
function monthsAgo(months:number):string{
  const d=new Date();
  const day=d.getDate();
  d.setDate(1);d.setMonth(d.getMonth()-months);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return dayString(d);
}
const movementNames:Record<NineBoxMovement,string>={
  improved:"رشد",declined:"افت",mixed:"تغییر ترکیبی",
  unchanged:"بدون تغییر",insufficient:"فاقد سابقه کافی",
};
@Component({
  standalone:true,
  imports:[...UI,RouterLink],
  styles:[`
    .demo-banner {display:flex;align-items:center;justify-content:space-between;gap:12px;
      flex-wrap:wrap;padding:12px 16px;border:1px solid var(--line,#e3e7e8);
      border-radius:10px;margin-bottom:16px}
    .demo-banner {background:#fff4db;border-color:#e5bc67;color:#69490d}
    .demo-banner p {margin:0;flex:1;min-width:220px}
    .source-mark {font-size:11px;font-weight:700;color:#7b5012;margin-inline-start:4px}
    .trend-compare {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .trend-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;direction:ltr}
    .trend-cell {--tone:#f5e2e0;--ink:#67454b;border:1px solid color-mix(in srgb,var(--ink) 22%,transparent);
      background:var(--tone);color:var(--ink);min-height:85px;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;gap:4px;border-radius:8px;
      padding:6px 4px;cursor:pointer;font:inherit;direction:rtl;line-height:1.6}
    .trend-cell--rose{--tone:#e9a1a5;--ink:#5e2330}
    .trend-cell--amber{--tone:#fae18a;--ink:#604914}
    .trend-cell--blush{--tone:#f5e2e0;--ink:#67454b}
    .trend-cell strong{font-size:22px}
    .trend-cell span{font-size:10px;font-weight:700}
    .trend-cell[aria-pressed=true]{outline:3px solid #087864;outline-offset:0}
    .trend-cell:focus-visible{outline:3px solid #084f45}
    .trend-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
    .trend-stat{border:1px solid var(--line,#e3e7e8);border-radius:10px;padding:12px;text-align:center}
    .trend-stat strong{display:block;font-size:22px}
    .trend-list{max-height:540px;overflow:auto}
    .trend-person.active{background:rgba(8,120,100,.06)}
    @media(max-width:950px){.trend-compare{grid-template-columns:1fr}.trend-stats{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:600px){.trend-stats{grid-template-columns:repeat(2,1fr)}}
  `],
  template:`
    <div class="page-header">
      <div>
        <div class="eyebrow">توسعه و جانشین‌پروری / نقشه استعداد</div>
        <h1>تحلیل روند جابه‌جایی استعدادها</h1>
        <p>مقایسه خودکار خانه‌های ۹گانه در دو تاریخ؛ بدون ثبت یا تأیید دوره جدید.</p>
      </div>
      <a mat-button class="secondary" routerLink="/talent/9box">بازگشت به نقشه ۹خانه‌ای ←</a>
    </div>
    <div class="info">این تحلیل وضعیت‌های ثبت‌شده را در دو تاریخ مقایسه می‌کند.
      برای افراد اولیه نمونه، تاریخچه ماهانه ۱۵ماهه به‌صورت آزمایشی وجود دارد.
      هر خانه با محور عملکرد از چپ به راست و پتانسیل از پایین به بالا نمایش داده می‌شود.</div>
    @if (sampleCount()) {
      <div class="demo-banner" data-testid="talent-demo-banner">
        <p><strong>داده آزمایشی در تاریخچه:</strong>
          {{ sampleCount() | fa }} نفر در این مقایسه حداقل یک وضعیت ساختگی دارند.
          این سوابق صرفاً برای ارائه سامانه‌اند و معادل ارزیابی واقعی نیستند.</p>
      </div>
    }
    <mat-card class="panel">
      <div class="filterbar">
        <mat-form-field appearance="outline">
          <mat-label>بازه مقایسه</mat-label>
          <mat-select [ngModel]="range()" (ngModelChange)="setRange($event)">
            <mat-option value="3">۳ ماه گذشته</mat-option>
            <mat-option value="6">۶ ماه گذشته</mat-option>
            <mat-option value="12">۱۲ ماه گذشته</mat-option>
            <mat-option value="custom">بازه دلخواه</mat-option>
          </mat-select>
        </mat-form-field>
        <app-date-field label="تاریخ مبنا (شمسی)" [ngModel]="startDay()"
          (ngModelChange)="setStart($event)" />
        <app-date-field label="تاریخ پایان (شمسی)" [ngModel]="endDay()"
          (ngModelChange)="setEnd($event)" />
        <mat-form-field appearance="outline">
          <mat-label>واحد سازمانی</mat-label>
          <mat-select [ngModel]="unit()" (ngModelChange)="unit.set($event)">
            <mat-option value="">همه واحدهای مجاز</mat-option>
            @for (name of units(); track name) {
              <mat-option [value]="name">{{ name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-button (click)="unit.set('');query.set('');selectedCell.set('')">
          پاک‌کردن فیلترهای افراد
        </button>
        <mat-form-field appearance="outline" class="search">
          <mat-label>جستجوی کارمند</mat-label>
          <input matInput [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </mat-form-field>
      </div>
      @if (!validRange()) {
        <div class="warning" role="alert">تاریخ مبنا باید معتبر، قبل از تاریخ پایان یا برابر با آن باشد؛ تاریخ آینده مجاز نیست.</div>
      } @else {
        <div class="trend-stats">
          @for (item of stats(); track item.status) {
            <div class="trend-stat">
              <strong>{{ item.count | fa }}</strong>
              <small>{{ item.label }}</small>
            </div>
          }
        </div>
      }
    </mat-card>
    @if (validRange()) {
      <div class="trend-compare">
        @for (side of sides; track side) {
          <mat-card class="panel">
            <div class="panel-head">
              <h2>{{ side === 'from' ? 'مقطع مبنا' : 'مقطع پایان' }}</h2>
              <small>{{ (side === 'from' ? startDay() : endDay()) | faDate }}</small>
            </div>
            <div class="trend-grid" role="group" [attr.aria-label]="side === 'from' ? 'نقشه مبنا' : 'نقشه پایان'">
              @for (y of ys; track y) {
                @for (x of xs; track x) {
                  <button type="button" class="trend-cell"
                    [ngClass]="'trend-cell--'+nineBoxProfile(x,y).tone"
                    [attr.aria-pressed]="selectedCell() === side+':'+x+'-'+y"
                    [attr.aria-label]="nineBoxProfile(x,y).title+', '+cellCount(side,x,y)+' نفر'"
                    (click)="selectCell(side,x,y)">
                    <strong>{{ cellCount(side,x,y) | fa }}</strong>
                    <span>{{ nineBoxProfile(x,y).title }}</span>
                  </button>
                }
              }
            </div>
            <div class="info" style="margin-top:10px">
              {{ side === 'from' ? 'مبنای' : 'پایان' }} مقایسه:
              {{ mappedCount(side) | fa }} نفر با داده قابل جانمایی.
              {{ noPositionCount(side) | fa }} نفر بدون موقعیت قابل بازسازی.
            </div>
          </mat-card>
        }
      </div>
      <mat-card class="panel">
        <div class="panel-head">
          <h2>جابه‌جایی افراد میان خانه‌های نقشه</h2>
          <button mat-button (click)="selectedCell.set('');selectedPersonId.set('')">پاک‌کردن فیلتر خانه</button>
        </div>
        @if (selectedCell()) { <div class="info">فیلتر خانه انتخاب شده فعال است؛ برای مشاهده همه افراد پاک کنید.</div> }
        <div class="table-wrap trend-list">
          <table class="royesh-table" style="width:100%">
            <thead><tr><th>فرد</th><th>خانه در مبنا</th><th>خانه در پایان</th><th>جهت تغییر</th><th>جزئیات</th></tr></thead>
            <tbody>
              @for (item of visibleRows(); track item.person.id) {
                <tr [class.active]="selectedPersonId() === item.person.id">
                  <td>{{ item.person.name }} <small>{{ item.person.code }}</small></td>
                  <td>{{ cellTitle(item.from) }} @if (item.from?.source === 'demo') { <small class="source-mark">نمایشی</small> }</td>
                  <td>{{ cellTitle(item.to) }} @if (item.to?.source === 'demo') { <small class="source-mark">نمایشی</small> }</td>
                  <td>{{ movementNames[item.movement] }}</td>
                  <td><button mat-button (click)="selectedPersonId.set(item.person.id)">نمایش مسیر</button></td>
                </tr>
              }
            </tbody>
          </table>
          @if (!visibleRows().length) { <div class="empty">فردی با این بازه و فیلتر پیدا نشد.</div> }
        </div>
        @if (selectedPerson(); as item) {
          <div class="info">
            <strong>مسیر {{ item.person.name }}:</strong>
            {{ cellTitle(item.from) }} ← {{ cellTitle(item.to) }}
            · عملکرد: {{ label(item.from?.performance) }} ← {{ label(item.to?.performance) }}
            · پتانسیل: {{ label(item.from?.potential) }} ← {{ label(item.to?.potential) }}
            · {{ movementNames[item.movement] }}.
            <div>زمان ثبت مبنا: {{ item.from?.at | faDate }} @if (item.from?.source === 'demo') { (نمایشی) }
              ؛ زمان ثبت پایان: {{ item.to?.at | faDate }} @if (item.to?.source === 'demo') { (نمایشی) }</div>
          </div>
        }
        @if (stats()[4].count) {
          <div class="info">{{ stats()[4].count | fa }} نفر هنوز برای دو تاریخ انتخاب‌شده سابقه کافی ندارند؛
            به‌عنوان «بدون تغییر» محسوب نشده‌اند.</div>
        }
      </mat-card>
    }
  `,
})
export default class TalentTrends {
  readonly s=inject(Store);
  readonly today=dayString(new Date());
  readonly range=signal("3");
  readonly startDay=signal(monthsAgo(3));
  readonly endDay=signal(this.today);
  readonly unit=signal("");
  readonly query=signal("");
  readonly selectedCell=signal("");
  readonly selectedPersonId=signal("");
  readonly xs:Band[]=["low","medium","high"];
  readonly ys:Band[]=["high","medium","low"];
  readonly sides=["from","to"] as const;
  readonly movementNames=movementNames;
  readonly nineBoxProfile=nineBoxProfile;
  readonly units=computed(()=>[...new Set(this.s.state().people
    .filter(p=>this.s.allowedPerson(p.id)).map(p=>p.unit))].sort());
  readonly people=computed(()=>{
    const q=this.query().trim().toLocaleLowerCase();
    return this.s.state().people.filter(p=>this.s.allowedPerson(p.id)&&
      (!this.unit()||p.unit===this.unit())&&
      (!q||[p.name,p.code].some(value=>value.toLocaleLowerCase().includes(q))));
  });
  readonly validRange=computed(()=>!!this.startDay()&&!!this.endDay()&&
    this.startDay()<=this.endDay()&&this.endDay()<=this.today);
  readonly rows=computed(()=>this.validRange()?
    nineBoxChanges(this.s.state(),this.people(),this.startDay(),this.endDay()):[]);
  readonly sampleCount=computed(()=>this.rows().filter(row=>
    row.from?.source==="demo" || row.to?.source==="demo").length);
  readonly stats=computed(()=>([
    ["improved","رشد"],["declined","افت"],["mixed","تغییر ترکیبی"],
    ["unchanged","بدون تغییر"],["insufficient","سابقه ناکافی"],
  ] as [NineBoxMovement,string][]).map(([status,label])=>({
    status,label,count:this.rows().filter(row=>row.movement===status).length,
  })));
  readonly visibleRows=computed(()=>{
    const [side,cell]=this.selectedCell().split(":");
    return this.rows().filter(row=>{
      if(!cell)return true;
      const e=side==="from"?row.from:row.to;
      return !!e&&e.performance+"-"+e.potential===cell;
    });
  });
  readonly selectedPerson=computed(()=>this.rows().find(r=>r.person.id===this.selectedPersonId()));
  label(value:Band|null|undefined){return value?bands[value]:"—";}
  cellTitle(event?:TalentPositionEvent){
    return event?.performance&&event?.potential
      ?nineBoxProfile(event.performance,event.potential).title:"فاقد داده تاریخی";
  }
  cellCount(side:"from"|"to",x:Band,y:Band){
    return this.rows().filter(row=>{
      const e=side==="from"?row.from:row.to;
      return e?.performance===x&&e?.potential===y;
    }).length;
  }
  mappedCount(side:"from"|"to"){
    return this.rows().filter(row=>{
      const e=side==="from"?row.from:row.to;
      return !!e?.performance&&!!e?.potential;
    }).length;
  }
  noPositionCount(side:"from"|"to"){return this.rows().length-this.mappedCount(side);}
  selectCell(side:"from"|"to",x:Band,y:Band){
    const key=side+":"+x+"-"+y;
    this.selectedCell.set(this.selectedCell()===key?"":key);
  }
  setRange(value:string){
    this.range.set(value);
    if(value!=="custom"){
      this.startDay.set(monthsAgo(Number(value)));
      this.endDay.set(this.today);
    }
    this.selectedCell.set("");
  }
  setStart(value:string){this.startDay.set(value);this.range.set("custom");this.selectedCell.set("");}
  setEnd(value:string){this.endDay.set(value);this.range.set("custom");this.selectedCell.set("");}
}
