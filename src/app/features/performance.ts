import { Component, computed, inject, input, signal } from "@angular/core";
import { Store } from "../core/store";
import { Band, PerformanceKpiInput, PerformanceReview, bands } from "../core/models";
import { UI } from "../shared/ui";

/** Source-attested period performance, separate from competency and hiring results. */
@Component({
  standalone: true,
  imports: UI,
  template: `
    @if (!id()) {
      <div class="page-header">
        <div>
          <div class="eyebrow">سرمایه انسانی / عملکرد شغلی</div>
          <h1>ارزیابی عملکرد دوره‌ای</h1>
          <p>ثبت درصد تحقق شاخص‌های شناسنامه شغلی، شواهد و تأیید منابع انسانی</p>
        </div>
      </div>
      <div class="info">
        شایستگی‌های ارزیابی ۳۶۰/۵۴۰ و پتانسیل رشد از عملکرد KPI مستقل هستند.
        تا زمان تأیید، پیش‌نویس روی نقشه استعداد اثر نمی‌گذارد.
      </div>
      <mat-card class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search">
            <mat-label>جستجوی کارمند</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>واحد</mat-label>
            <mat-select [ngModel]="unit()" (ngModelChange)="unit.set($event)">
              <mat-option value="">همه واحدها</mat-option>
              @for (value of s.units(); track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="people()" class="royesh-table">
            <ng-container matColumnDef="person">
              <th mat-header-cell *matHeaderCellDef>کارمند</th>
              <td mat-cell *matCellDef="let p"><strong>{{ p.name }}</strong><small style="display:block">{{ p.code }}</small></td>
            </ng-container>
            <ng-container matColumnDef="job">
              <th mat-header-cell *matHeaderCellDef>شغل / واحد</th>
              <td mat-cell *matCellDef="let p">{{ s.job(p.jobId).title }}<small style="display:block">{{ p.unit }}</small></td>
            </ng-container>
            <ng-container matColumnDef="performance">
              <th mat-header-cell *matHeaderCellDef>آخرین عملکرد</th>
              <td mat-cell *matCellDef="let p">{{ label(p.performance) }}
                <small style="display:block">{{ s.latestApprovedPerformance(p.id) ? 'ارزیابی تأییدشده' : (p.performance ? 'داده نمایشی اولیه' : 'فاقد ارزیابی') }}</small>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>جزئیات</th>
              <td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/performance', p.id]">مشاهده و ثبت ←</a></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
          @if (!people().length) { <div class="empty">فردی مطابق دسترسی و فیلترها یافت نشد.</div> }
        </div>
      </mat-card>
    } @else if (person(); as p) {
      <div class="page-header">
        <div>
          <div class="eyebrow"><a routerLink="/performance">ارزیابی عملکرد</a> / {{ p.code }}</div>
          <h1>{{ p.name }}</h1>
          <p>{{ s.job(p.jobId).title }} · {{ p.unit }}</p>
        </div>
        <div class="actions">
          <a mat-button class="secondary" [routerLink]="['/people', p.id]">پروفایل فرد ←</a>
          @if (s.canEditPerformance(p.id) && !editorOpen()) {
            <button mat-button class="primary" (click)="startNew(p.id)">+ ارزیابی دوره جدید</button>
          }
        </div>
      </div>
      <div class="grid three" style="margin-bottom:22px">
        <div class="stat">
          <span class="label">عملکرد فعلی</span>
          <strong>{{ label(p.performance) }}</strong>
          <small>{{ latest() ? 'آخرین ارزیابی تأییدشده' : (p.performance ? 'مقدار نمایشی اولیه؛ بدون سابقه تأییدشده' : 'در انتظار اولین ارزیابی شغلی') }}</small>
        </div>
        <div class="stat">
          <span class="label">امتیاز آخرین دوره</span>
          <strong>{{ latest()?.score | fa }}{{ latest() ? ' از ۱۰۰' : '' }}</strong>
          <small>{{ latest()?.period ?? 'هنوز دوره تأییدشده‌ای وجود ندارد' }}</small>
        </div>
        <div class="stat">
          <span class="label">سوابق دوره‌ای</span>
          <strong>{{ history().length | fa }}</strong>
          <small>پیش‌نویس و تأییدشده، مطابق دسترسی نقش فعال</small>
        </div>
      </div>
      @if (editorOpen() && s.canEditPerformance(p.id)) {
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>{{ editingId() ? 'ویرایش پیش‌نویس' : 'ثبت ارزیابی عملکرد شغلی' }}</h2>
              <small>مبنای KPI: شناسنامه شغلی منتشرشده، نسخه {{ s.job(p.jobId).version | fa }}</small>
            </div>
            <button mat-button (click)="cancel()">انصراف</button>
          </div>
          <div class="info">برای هر KPI درصد تحقق هدف (بین ۰ تا ۱۰۰) و مستندات آن را وارد کنید. امتیاز نهایی میانگین هم‌وزن شاخص‌هاست؛ نتیجه فقط پس از تأیید منابع انسانی در پروفایل و ۹ خانه‌ای اعمال می‌شود.</div>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>دوره ارزیابی</mat-label>
              <input matInput placeholder="مثلاً ۱۴۰۵ - پاییز" [ngModel]="period()" (ngModelChange)="period.set($event)" />
            </mat-form-field>
          </div>
          @for (k of s.job(p.jobId).kpis; track k.title; let i = $index) {
            <div class="metric-line">
              <div class="grow">
                <strong>{{ k.title }}</strong>
                <small>{{ k.definition }} · {{ k.unit }} · منبع: {{ k.source }}</small>
                <small>روش محاسبه: {{ k.formula }}</small>
              </div>
            </div>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>درصد تحقق هدف</mat-label>
                <input matInput type="number" min="0" max="100" step="1"
                  [ngModel]="draftKpis()[i]?.achievement"
                  (ngModelChange)="changeAchievement(i, $event)" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>شواهد و منبع ثبت‌شده</mat-label>
                <input matInput [ngModel]="draftKpis()[i]?.evidence"
                  (ngModelChange)="changeEvidence(i, $event)" />
              </mat-form-field>
            </div>
          }
          @if (!s.job(p.jobId).kpis.length) {
            <div class="warning">این شناسنامه KPI ندارد؛ ابتدا شاخص‌های عملکرد را در شناسنامه ثبت کنید.</div>
          }
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>جمع‌بندی و توضیح ارزیابی</mat-label>
            <textarea matInput rows="3" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
          </mat-form-field>
          <div class="actions">
            <button mat-button class="primary" [disabled]="!s.job(p.jobId).kpis.length" (click)="save(p.id)">
              ذخیره پیش‌نویس
            </button>
          </div>
        </mat-card>
      }
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>تاریخچه ارزیابی عملکرد</h2>
            <small>هر دوره به نسخه شناسنامه شغل و شواهد خودش متصل است.</small>
          </div>
        </div>
        @for (review of history(); track review.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ review.period }} · {{ label(review.band) }} · {{ review.score | fa }} از ۱۰۰</strong>
              <small>
                {{ review.status === 'approved' ? 'تأییدشده' : 'پیش‌نویس' }}
                · نسخه شغل {{ review.jobVersion | fa }}
                · ثبت: {{ review.createdAt | faDate }}
                @if (review.approvedAt) { · تأیید: {{ review.approvedAt | faDate }} }
              </small>
              <p>{{ review.notes }}</p>
              <details>
                <summary>شواهد KPIها</summary>
                @for (kpi of review.kpis; track kpi.title) {
                  <p><strong>{{ kpi.title }}</strong> — {{ kpi.achievement | fa }}٪ · {{ kpi.evidence }}</p>
                }
              </details>
            </div>
            @if (review.status === 'draft' && s.canEditPerformance(p.id)) {
              <button mat-button (click)="edit(review)">ویرایش</button>
            }
            @if (review.status === 'draft' && s.role() === 'hr') {
              <button mat-button class="primary" (click)="approve(review.id)">تأیید عملکرد</button>
            }
          </div>
        } @empty {
          <div class="empty">هنوز ارزیابی عملکرد شغلی ثبت نشده است. سوابق ارزیابی بدو استخدام، عملکرد دوره‌ای محسوب نمی‌شوند.</div>
        }
      </mat-card>
    } @else {
      <div class="warning">این فرد وجود ندارد یا دسترسی مشاهده پرونده او را ندارید.</div>
    }
  `,
})
export default class Performance {
  readonly s = inject(Store);
  readonly id = input<string>();
  readonly columns = ["person", "job", "performance", "action"];
  readonly search = signal("");
  readonly unit = signal("");
  readonly editorOpen = signal(false);
  readonly editingId = signal("");
  readonly period = signal("");
  readonly notes = signal("");
  readonly draftKpis = signal<(Omit<PerformanceKpiInput, "achievement"> & { achievement: number | null })[]>([]);
  readonly person = computed(() => this.s.state().people.find(
    (p) => p.id === this.id() && this.s.allowedPerson(p.id)));
  readonly people = computed(() => this.s.state().people.filter((p) =>
    this.s.allowedPerson(p.id) && (!this.unit() || p.unit === this.unit()) &&
    (p.name + " " + p.code).includes(this.search())));
  readonly history = computed(() => this.id() ? this.s.performanceReviewsFor(this.id()!) : []);
  readonly latest = computed(() => this.id() ? this.s.latestApprovedPerformance(this.id()!) : undefined);

  label(band: Band | null) { return band ? bands[band] : "—"; }
  startNew(personId: string) {
    if (!this.s.canEditPerformance(personId)) return;
    this.editingId.set("");
    this.period.set("");
    this.notes.set("");
    this.draftKpis.set(this.s.job(this.s.person(personId).jobId).kpis.map((k) => ({
      title: k.title, achievement: null, evidence: "",
    })));
    this.editorOpen.set(true);
  }
  edit(review: PerformanceReview) {
    if (review.status !== "draft" || !this.s.canEditPerformance(review.personId)) return;
    this.editingId.set(review.id);
    this.period.set(review.period);
    this.notes.set(review.notes);
    this.draftKpis.set(review.kpis.map((k) => ({
      title: k.title, achievement: k.achievement, evidence: k.evidence,
    })));
    this.editorOpen.set(true);
  }
  changeAchievement(i: number, value: number | string | null) {
    this.draftKpis.update((rows) => rows.map((row, index) => index === i
      ? { ...row, achievement: value === null || value === "" ? null : Number(value) }
      : row));
  }
  changeEvidence(i: number, value: string) {
    this.draftKpis.update((rows) => rows.map((row, index) =>
      index === i ? { ...row, evidence: value } : row));
  }
  cancel() { this.editorOpen.set(false); }
  save(personId: string) {
    const id = this.s.savePerformanceDraft(
      personId, this.period(),
      this.draftKpis().map((k) => ({
        title: k.title, achievement: k.achievement as number, evidence: k.evidence,
      })),
      this.notes(), this.editingId() || undefined,
    );
    if (id) this.cancel();
  }
  approve(id: string) {
    if (this.s.approvePerformanceReview(id)) this.cancel();
  }
}
