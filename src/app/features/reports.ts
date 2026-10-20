import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { UI, download } from "../shared/ui";
import { Chart } from "../shared/chart";
import {
  ReportFilters, ReportKind, buildReport, reportCategories,
  reportPeriods, visibleReportCategories,
} from "../core/reporting/reports";
import { downloadReportWorkbook } from "../core/reporting/xlsx";
import { printReportPdf } from "../core/reporting/pdf-print";

@Component({
  standalone: true,
  imports: [...UI, Chart],
  styleUrl: "./reports.scss",
  template: `
    <div class="page-header report-page-header">
      <div>
        <div class="eyebrow">مرکز گزارش‌ها / تحلیل سرمایه انسانی</div>
        <h1>گزارش‌ها و تحلیل</h1>
        <p>شاخص‌ها، نمودارها و جداول از رکوردهای مشترک سامانه محاسبه می‌شوند؛ بدون داده مستقل نمایشی.</p>
      </div>
      <div class="actions no-print">
        <button mat-button class="secondary" (click)="exportXlsx()">↓ خروجی Excel</button>
        <button mat-button class="secondary" (click)="exportCsv()">↓ خروجی CSV</button>
        <button mat-button class="primary" (click)="exportPdf()">چاپ / ذخیره PDF</button>
      </div>
    </div>
    <nav class="report-tabs" aria-label="حوزه‌های گزارش">
      @for (category of categories(); track category.id) {
        <button mat-button [class.report-tab-active]="kind() === category.id"
          [attr.aria-pressed]="kind() === category.id"
          (click)="selectCategory(category.id)">
          {{ category.title }}
        </button>
      }
    </nav>
    <mat-card class="panel report-filters">
      <div class="panel-head">
        <div><h2>فیلترهای گزارش</h2><small>فیلترها روی شاخص‌ها، نمودار و خروجی‌ها به‌صورت یکسان اعمال می‌شوند؛ جستجو فقط جدول را محدود می‌کند.</small></div>
        <button mat-button class="secondary" (click)="clearFilters()">پاک‌کردن فیلترها</button>
      </div>
      <div class="report-filter-grid">
        <mat-form-field appearance="outline">
          <mat-label>واحد سازمانی</mat-label>
          <mat-select [ngModel]="effectiveUnit()" (ngModelChange)="changeUnit($event)"
            [disabled]="s.role() === 'manager'">
            <mat-option value="">تمام واحدهای مجاز</mat-option>
            @for (u of s.units(); track u) { <mat-option [value]="u">{{ u }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>شغل</mat-label>
          <mat-select [ngModel]="jobId()" (ngModelChange)="jobId.set($event)">
            <mat-option value="">تمام مشاغل</mat-option>
            @for (j of jobOptions(); track j.id) {
              <mat-option [value]="j.id">{{ j.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (activeCategory().period) {
          <mat-form-field appearance="outline">
            <mat-label>دوره ارزیابی / توسعه</mat-label>
            <mat-select [ngModel]="period()" (ngModelChange)="period.set($event)">
              <mat-option value="">همه دوره‌ها</mat-option>
              @for (p of periods(); track p) {
                <mat-option [value]="p">{{ labelPeriod(p) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (activeCategory().statuses.length) {
          <mat-form-field appearance="outline">
            <mat-label>وضعیت</mat-label>
            <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
              <mat-option value="">همه وضعیت‌ها</mat-option>
              @for (option of activeCategory().statuses; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (kind() === 'hiring') {
          <mat-form-field appearance="outline">
            <mat-label>از تاریخ ثبت (میلادی)</mat-label>
            <input matInput type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>تا تاریخ ثبت (میلادی)</mat-label>
            <input matInput type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
          </mat-form-field>
        }
      </div>
    </mat-card>
    <div class="report-section-title">
      <div>
        <h2>{{ result().title }}</h2>
        <p>{{ result().description }}</p>
      </div>
      <small class="muted">بر اساس اطلاعات ذخیره‌شده در مرورگر و سطح دسترسی نقش جاری</small>
    </div>
    <div class="grid four report-metrics">
      @for (item of result().metrics; track item.title) {
        <div class="stat">
          <span class="label">{{ item.title }}</span>
          <strong>{{ item.value | fa }}{{ item.value === null ? '' : (item.suffix ?? '') }}</strong>
          <small>{{ item.detail }}</small>
        </div>
      }
    </div>
    @if (result().charts.length) {
      <div class="grid two report-chart-grid">
        @for (chart of result().charts; track chart.title) {
          <mat-card class="panel">
            <div class="panel-head">
              <h2>{{ chart.title }}</h2>
              <small>محاسبه‌شده از داده‌های فیلترشده</small>
            </div>
            @if (chart.categories.length) {
              @defer (on viewport) {
                <app-chart type="bar" [categories]="chart.categories"
                  [series]="chart.series" />
              } @placeholder { <div class="empty">نمایش نمودار</div> }
            } @else {
              <div class="empty">داده‌ای برای ترسیم نمودار وجود ندارد.</div>
            }
          </mat-card>
        }
      </div>
    }
    <mat-card class="panel report-details">
      <div class="panel-head report-table-head">
        <div>
          <h2>جدول تفصیلی</h2>
          <small>{{ result().rows.length | fa }} ردیف در فیلتر فعلی · تمام ردیف‌ها در خروجی Excel و PDF قرار می‌گیرند</small>
        </div>
        <mat-form-field appearance="outline" class="report-search">
          <mat-label>جستجو در جدول</mat-label>
          <input matInput [ngModel]="search()" (ngModelChange)="changeSearch($event)" />
        </mat-form-field>
      </div>
      <div class="table-wrap">
        <table class="royesh-table report-data" aria-label="جدول تفصیلی گزارش">
          <thead><tr>
            @for (column of result().columns; track column.key) {
              <th>{{ column.title }}</th>
            }
            <th>جزئیات</th>
          </tr></thead>
          <tbody>
            @for (item of visibleRows(); track item.id) {
              <tr>
                @for (column of result().columns; track column.key) {
                  <td>{{ item.values[column.key] | fa }}</td>
                }
                <td>
                  @if (item.link) {
                    <a [routerLink]="item.link">مشاهده ←</a>
                  } @else { <span class="muted">—</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (!result().rows.length) {
          <div class="empty">برای این فیلتر داده‌ای وجود ندارد؛ مقدارهای ناموجود به‌جای صفر نمایش داده می‌شوند.</div>
        }
      </div>
      @if (result().rows.length > pageSize) {
        <div class="report-pagination">
          <button mat-button [disabled]="currentPage() === 1" (click)="page.set(currentPage()-1)">صفحه قبل</button>
          <span>صفحه {{ currentPage() | fa }} از {{ totalPages() | fa }}</span>
          <button mat-button [disabled]="currentPage() === totalPages()" (click)="page.set(currentPage()+1)">صفحه بعد</button>
        </div>
      }
    </mat-card>
    <div class="info report-methodology">
      <strong>تعریف و محدودیت شاخص‌ها:</strong>
      {{ result().note }}
      <p>خروجی PDF از پنجره چاپ مرورگر با گزینه «Save as PDF / ذخیره به PDF» تهیه می‌شود. Excel دارای شیت‌های خلاصه، جزئیات و داده‌های نمودار است.</p>
    </div>
`,
})
export default class ReportsPage {
  readonly s = inject(Store);
  readonly categories = computed(() => visibleReportCategories(this.s.role()));
  readonly kind = signal<ReportKind>("overview");
  readonly unit = signal("");
  readonly jobId = signal("");
  readonly period = signal("");
  readonly status = signal("");
  readonly search = signal("");
  readonly from = signal("");
  readonly to = signal("");
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly activeCategory = computed(() =>
    reportCategories.find(c => c.id === this.kind())!);
  readonly effectiveUnit = computed(() => this.s.role()==="manager"
    ? this.s.currentPerson()?.unit??"" : this.unit());
  readonly jobOptions = computed(() => this.s.state().jobs.filter(j =>
    !this.effectiveUnit() || j.unit===this.effectiveUnit()));
  readonly periods = computed(() => reportPeriods(this.s.state()));
  readonly filters = computed<ReportFilters>(() => ({
    unit:this.effectiveUnit(),jobId:this.jobId(),
    period:this.activeCategory().period?this.period():"",
    status:this.activeCategory().statuses.length?this.status():"",
    search:this.search(),
    from:this.kind()==="hiring"?this.from():"",
    to:this.kind()==="hiring"?this.to():"",
  }));
  readonly result = computed(() => {
    const allowedPersonIds = new Set(this.s.state().people.filter(p=>
      this.s.allowedPerson(p.id)).map(p=>p.id));
    return buildReport(this.s.state(),this.kind(),this.filters(),{
      role:this.s.role(),
      allowedPersonIds,
      restrictedUnit:this.s.role()==="manager"?this.s.currentPerson()?.unit??"":"",
    });
  });
  readonly totalPages = computed(() => Math.max(1,Math.ceil(this.result().rows.length/this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(),this.totalPages()));
  readonly visibleRows = computed(() => this.result().rows.slice(
    (this.currentPage()-1)*this.pageSize,this.currentPage()*this.pageSize));
  selectCategory(kind:ReportKind) {
    this.kind.set(kind); this.status.set("");this.page.set(1);
  }
  changeUnit(unit:string) {this.unit.set(unit);this.jobId.set("");this.page.set(1);}
  changeSearch(search:string) {this.search.set(search);this.page.set(1);}
  clearFilters() {
    this.unit.set("");this.jobId.set("");this.period.set("");this.status.set("");
    this.search.set("");this.from.set("");this.to.set("");this.page.set(1);
  }
  labelPeriod(period:string) {
    const [year,season] = period.split("-");
    const seasons:Record<string,string>={spring:"بهار",summer:"تابستان",autumn:"پاییز",winter:"زمستان"};
    return (seasons[season]??season)+" "+year.replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[+d]);
  }
  exportXlsx() {
    downloadReportWorkbook(this.result(),this.filters(),this.effectiveUnit());
  }
  exportPdf() {
    printReportPdf(this.result(),this.filters(),this.effectiveUnit());
  }
  exportCsv() {
    const r=this.result();
    const safe=(value:string|number|null)=>{
      let str=value===null?"":String(value);
      if (/^[=+\-@\t\r]/.test(str))str="'"+str;
      return '"'+str.replaceAll('"','""')+'"';
    };
    const records=[r.columns.map(c=>c.title),...r.rows.map(row=>
      r.columns.map(column=>row.values[column.key]??null))];
    const csv=records.map(record=>record.map(safe).join(",")).join("\r\n");
    download("royesh-report-"+this.kind()+".csv",csv,"text/csv;charset=utf-8");
  }
}
