import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { developmentMetrics } from "../core/development-metrics";
import { UI, download } from "../shared/ui";
import { Chart } from "../shared/chart";
import { competencies } from "../core/models";

@Component({
  standalone: true,
  imports: [...UI, Chart],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">توسعه سرمایه انسانی</div>
        <h1>داشبورد توسعه سرمایه انسانی</h1>
        <p>سه شاخص مجزا برای فعالیت‌های توسعه، نظر اثربخشی مدیر و رشد مشاهده‌شده</p>
      </div>
      <div class="actions">
        <button mat-button class="secondary" (click)="exportCsv()">↓ دریافت گزارش CSV</button>
        <a mat-button routerLink="/development">برنامه‌های توسعه ←</a>
      </div>
    </div>
    <div class="filterbar">
      <mat-form-field appearance="outline">
        <mat-label>دوره ارزیابی و توسعه</mat-label>
        <mat-select [ngModel]="period()" (ngModelChange)="period.set($event)">
          <mat-option value="">همه دوره‌ها</mat-option>
          @for (value of periodOptions(); track value) {
            <mat-option [value]="value">{{ periodLabel(value) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>واحد سازمانی</mat-label>
        <mat-select [ngModel]="unit()" (ngModelChange)="unit.set($event)"
          [disabled]="s.role() === 'manager'">
          <mat-option value="">همه واحدها</mat-option>
          @for (u of s.units(); track u) {
            <mat-option [value]="u">{{ u }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <small class="muted">داده‌ها از رکوردهای همین مرورگر به‌روزرسانی می‌شوند.</small>
    </div>

    <div class="grid three" style="margin-bottom:24px">
      <div class="stat">
        <span class="stat-icon">✓</span>
        <div class="label">پیشرفت اقدامات توسعه</div>
        <strong>{{ metrics().activityPercent === null ? "—" : (metrics().activityPercent | fa) + "٪" }}</strong>
        <small>{{ metrics().completed | fa }} فعالیت انجام‌شده از {{ metrics().totalActions | fa }} فعالیت
          در برنامه‌های فیلترشده</small>
        <div class="bar" style="margin-top:10px">
          <span [style.width.%]="metrics().activityPercent ?? 0"></span>
        </div>
        <a [routerLink]="['/development']" [queryParams]="filterParams()">مشاهده برنامه‌ها ←</a>
      </div>
      <div class="stat">
        <span class="stat-icon" style="background:#eef7f5;color:#28866d">◎</span>
        <div class="label">اثربخشی تأییدشده توسط مدیر</div>
        <strong>{{ metrics().effectivePercent === null ? "—" : (metrics().effectivePercent | fa) + "٪" }}</strong>
        <small>{{ metrics().effective | fa }} اقدام مؤثر از {{ metrics().reviewed | fa }} اقدام بررسی‌شده؛
          تأیید اثربخشی تنها پس از تکمیل فعالیت و ثبت شواهد انجام می‌شود</small>
        <small>پوشش بررسی مدیر:
          {{ metrics().reviewCoverage === null ? "—" : (metrics().reviewCoverage | fa) + "٪" }}
          ({{ metrics().reviewed | fa }} از {{ metrics().completed | fa }} اقدام تکمیل‌شده)
        </small>
      </div>
      <div class="stat">
        <span class="stat-icon" style="background:#f3eff9;color:#9878b9">↗</span>
        <div class="label">تغییر شایستگی بین دوره‌ها</div>
        <strong>
          @if (metrics().meanObservedChange !== null) {
            {{ signed(metrics().meanObservedChange!) | fa }}
          } @else { — }
        </strong>
        <small>میانگین تغییر امتیاز مشاهده‌شده (مقیاس ۱ تا ۵) در
          {{ metrics().growthRows.length | fa }} مقایسه فرد × شغل</small>
        <small>تغییر میانگین شکاف:
          @if (metrics().meanGapReduction !== null) {
            {{ signed(metrics().meanGapReduction!) | fa }} واحد کاهش
          } @else { — }
        </small>
      </div>
    </div>

    <div class="info" style="margin-bottom:22px">
      «پیشرفت فعالیت» صرفاً نسبت اقدام‌های تکمیل‌شده است؛ «اثربخشی» نظر ثبت‌شده مدیر
      درباره اقدام‌های تکمیل‌شده با شواهد است؛ «رشد شایستگی» مقایسه امتیاز
      ارزیابی‌های منتشرشده در دو دوره متفاوت است. هیچ‌یک به‌تنهایی آمادگی انتصاب
      یا تأثیر علّی یک فعالیت بر رشد را اثبات نمی‌کند.
      در صورت نبود داده قابل محاسبه، به‌جای صفر «—» نمایش داده می‌شود.
    </div>

    <div class="grid wide">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>توزیع نظر اثربخشی مدیران</h2>
            <small>از {{ metrics().reviewed | fa }} بررسی ثبت‌شده در محدوده فیلتر</small>
          </div>
        </div>
        @if (metrics().reviewed) {
          @defer (on viewport) {
            <app-chart type="bar" [categories]="reviewCategories"
              [series]="reviewSeries()" />
          } @placeholder { <div class="empty">آماده‌سازی نمودار</div> }
        } @else {
          <div class="empty">هنوز برای اقدامات تکمیل‌شده این محدوده، نظر اثربخشی مدیر ثبت نشده است.</div>
        }
        <div class="metric-line"><span class="grow">مؤثر</span>
          <strong>{{ metrics().effective | fa }}</strong></div>
        <div class="metric-line"><span class="grow">تاحدی مؤثر</span>
          <strong>{{ metrics().partial | fa }}</strong></div>
        <div class="metric-line"><span class="grow">بدون اثربخشی مشاهده‌شده</span>
          <strong>{{ metrics().ineffective | fa }}</strong></div>
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>اقدام‌های تکمیل‌شده در انتظار بررسی</h2>
            <small>اولویت پیگیری: اجرای ثبت‌شده بدون نظر اثربخشی مدیر</small>
          </div>
          <span class="badge amber">{{ pendingReviews().length | fa }} اقدام</span>
        </div>
        @for (item of pendingReviews().slice(0, 8); track item.action.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ item.action.title }}</strong>
              <small>{{ s.person(item.plan.personId).name }} ·
                {{ competencies[item.action.competency] }} ·
                {{ s.job(item.plan.jobId).title }}</small>
              @if (!item.action.evidence?.trim()) {
                <small>شواهد اجرا نیز نیازمند تکمیل است.</small>
              }
            </div>
            <a [routerLink]="['/development/idp', item.plan.id]">پیگیری ←</a>
          </div>
        } @empty {
          <div class="empty">مورد تکمیل‌شده‌ای در انتظار بررسی مدیر نیست.</div>
        }
        @if (pendingReviews().length > 8) {
          <a routerLink="/development" [queryParams]="filterParams()">سایر برنامه‌ها ←</a>
        }
      </mat-card>
    </div>

    <mat-card class="panel" style="margin-top:22px">
      <div class="panel-head">
        <div>
          <h2>رشد شایستگی در ارزیابی‌های متوالی</h2>
          <small>هر سطر: آخرین مقایسه معتبر برای یک فرد و شغل هدف در دوره انتخاب‌شده</small>
        </div>
        <span class="badge">{{ metrics().growthRows.length | fa }} مقایسه</span>
      </div>
      @if (metrics().growthRows.length) {
        <div class="table-wrap">
          <table mat-table [dataSource]="metrics().growthRows" class="royesh-table">
            <ng-container matColumnDef="person">
              <th mat-header-cell *matHeaderCellDef>فرد / شغل هدف</th>
              <td mat-cell *matCellDef="let g">
                {{ s.person(g.personId).name }}
                <small style="display:block">{{ s.job(g.jobId).title }}</small>
              </td>
            </ng-container>
            <ng-container matColumnDef="cycles">
              <th mat-header-cell *matHeaderCellDef>دو دوره مقایسه‌شده</th>
              <td mat-cell *matCellDef="let g">{{ g.previousTitle }} ← {{ g.currentTitle }}</td>
            </ng-container>
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef>تغییر میانگین امتیاز</th>
              <td mat-cell *matCellDef="let g">{{ signed(g.observedChange) | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="gap">
              <th mat-header-cell *matHeaderCellDef>کاهش شکاف</th>
              <td mat-cell *matCellDef="let g">{{ signed(g.gapReduction) | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="link">
              <th mat-header-cell *matHeaderCellDef>جزئیات</th>
              <td mat-cell *matCellDef="let g">
                <a mat-button [routerLink]="['/people', g.personId]"
                  [queryParams]="{ job: g.jobId }">پروفایل ←</a>
                <a mat-button [routerLink]="['/evaluations/reports', g.currentCycleId]">گزارش ←</a>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="growthColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: growthColumns"></tr>
          </table>
        </div>
        @if (metrics().growthRows.some(g => g.expectationsChanged || g.historicalExpectedEstimated)) {
          <div class="warning">
            بعضی مبناهای تاریخی فاقد Snapshot کامل‌اند یا انتظار شغل تغییر کرده؛
            تفسیر عدد «کاهش شکاف» در این ردیف‌ها نیازمند بررسی است.
            تغییر امتیاز مشاهده‌شده مستقل از تغییر سطح انتظار محاسبه می‌شود.
          </div>
        }
      } @else {
        <div class="empty">
          برای این فیلتر، دو دوره ارزیابی منتشرشده و متفاوت از یک فرد و شغل
          وجود ندارد؛ نبود مقایسه به‌معنی نبود رشد نیست.
        </div>
      }
    </mat-card>
  `,
})
export default class DevelopmentDashboard {
  readonly s = inject(Store);
  readonly period = signal("1405-autumn");
  readonly unit = signal(this.s.role() === "manager" ? "دفتر پروژه‌ها" : "");
  readonly competencies = competencies;
  readonly growthColumns = ["person", "cycles", "score", "gap", "link"];
  readonly reviewCategories = ["مؤثر", "تاحدی مؤثر", "بدون اثربخشی"];
  readonly periodOptions = computed(() => [
    ...new Set([
      ...this.s.state().cycles.map((c) => c.period),
      ...this.s.state().plans.map((p) => p.period),
    ]),
  ].filter(Boolean).sort().reverse());
  readonly visiblePeople = computed(() => this.s.state().people.filter(
    (p) => this.s.allowedPerson(p.id) &&
      (!this.unit() || p.unit === this.unit()),
  ));
  readonly metrics = computed(() => developmentMetrics(
    this.s.state(), new Set(this.visiblePeople().map((p) => p.id)), this.period(),
  ));
  readonly pendingReviews = computed(() => this.metrics().actions.filter(({ action, plan }) =>
    action.status === "completed" && !action.effectiveness &&
    this.s.isCurrentPlan(plan),
  ));
  readonly reviewSeries = computed(() => [{
    name: "تعداد بررسی",
    data: [this.metrics().effective, this.metrics().partial, this.metrics().ineffective],
  }]);
  filterParams() {
    return {
      ...(this.unit() ? { unit: this.unit() } : {}),
      ...(this.period() ? { period: this.period() } : {}),
    };
  }
  signed(value: number) { return value > 0 ? "+" + value : String(value); }
  periodLabel(value: string) {
    const [year, season] = value.split("-");
    const names: Record<string, string> = {
      spring: "بهار", summer: "تابستان", autumn: "پاییز", winter: "زمستان",
    };
    return (names[season] ?? season) + " " + year.replace(/\d/g, x => "۰۱۲۳۴۵۶۷۸۹"[Number(x)]);
  }
  exportCsv() {
    const m = this.metrics();
    const safe = (value: string | number | null) => {
      let v = value === null ? "ناموجود" : String(value);
      if (/^[=+@-]/.test(v)) v = "'" + v;
      return '"' + v.replaceAll('"', '""') + '"';
    };
    const line = (...values: (string | number | null)[]) =>
      values.map(safe).join(",");
    download("royesh-human-capital-development.csv", [
      line("گزارش توسعه سرمایه انسانی", this.period() || "همه دوره‌ها", this.unit() || "همه واحدها"),
      line("شاخص", "مقدار", "صورت", "مخرج"),
      line("پیشرفت فعالیت‌های توسعه", m.activityPercent, m.completed, m.totalActions),
      line("اثربخشی مؤثر از نظر مدیر", m.effectivePercent, m.effective, m.reviewed),
      line("پوشش بررسی مدیر از اقدامات تکمیل‌شده", m.reviewCoverage, m.reviewed, m.completed),
      line("تغییر میانگین امتیاز مشاهده‌شده", m.meanObservedChange, m.growthRows.length, ""),
      line("کاهش میانگین شکاف", m.meanGapReduction, m.growthRows.length, ""),
      "",
      line("فرد", "شغل", "دوره قبلی", "دوره جاری", "تغییر امتیاز", "کاهش شکاف", "احتیاط مبنای تاریخی"),
      ...m.growthRows.map(g => line(
        this.s.person(g.personId).name, this.s.job(g.jobId).title,
        g.previousTitle, g.currentTitle, g.observedChange, g.gapReduction,
        g.expectationsChanged || g.historicalExpectedEstimated ? "نیازمند بررسی" : "مبنای ثبت‌شده",
      )),
    ].join("\n"), "text/csv;charset=utf-8");
  }
}
