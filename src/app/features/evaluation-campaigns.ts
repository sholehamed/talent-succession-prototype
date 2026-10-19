import { Component, computed, inject, input, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "../core/store";
import {
  CampaignScope, Cycle, EvaluationCampaign,
} from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">منابع انسانی · ارزیابی چندمنبعی</div>
        <h1>کمپین‌های ارزیابی دوره‌ای</h1>
        <p>انتخاب گروهی کارکنان، تشکیل پرونده‌های آماده‌سازی و شروع پاسخ‌گیری فقط با تأیید منابع انسانی</p>
      </div>
      <a mat-button class="secondary" routerLink="/evaluations/cycles">دوره‌ها و ارزیابی‌های فردی ←</a>
    </div>

    @if (!id()) {
      <div class="grid two">
        <mat-card class="panel">
          <div class="panel-head">
            <h2>کمپین‌های ثبت‌شده</h2>
            <span class="badge">{{ s.state().campaigns.length | fa }} مورد</span>
          </div>
          @for (c of s.state().campaigns; track c.id) {
            <div class="metric-line">
              <div class="grow">
                <a [routerLink]="['/evaluations/campaigns', c.id]"><strong>{{ c.title }}</strong></a>
                <small>{{ c.period }} · {{ c.mode | fa }} درجه · {{ c.asOf | faDate }}</small>
              </div>
              <span class="badge">{{ statusLabel(c) }}</span>
            </div>
          } @empty {
            <div class="empty">کمپینی ایجاد نشده است؛ از فرم کنار صفحه شروع کنید.</div>
          }
        </mat-card>
        <mat-card class="panel">
          <div class="panel-head"><h2>کمپین جدید</h2><small>مرحله {{ step() + 1 | fa }} از ۳</small></div>
          <div class="actions" style="margin-bottom:14px">
            <span class="badge">۱ · تعریف</span><span class="badge">۲ · جامعه هدف</span>
            <span class="badge">۳ · پیش‌نمایش</span>
          </div>
          @if (step() === 0) {
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>عنوان دوره ارزیابی</mat-label>
              <input matInput [ngModel]="title()" (ngModelChange)="title.set($event)" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>شناسه دوره (یکتا در هر شخص)</mat-label>
              <input matInput [ngModel]="period()" (ngModelChange)="period.set($event)" />
            </mat-form-field>
            <app-date-field label="تاریخ مبنای چارت سازمانی"
              [ngModel]="asOf()" (ngModelChange)="asOf.set($event)" />
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>روش ارزیابی</mat-label>
              <mat-select [ngModel]="mode()" (ngModelChange)="mode.set($event)">
                <mat-option [value]="360">۳۶۰ درجه · ایجاد گروهی</mat-option>
                <mat-option [value]="540" disabled>۵۴۰ درجه · نیازمند روابط ثبت‌شده ذی‌نفع بیرونی</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="info">دوره‌های تاریخی بدون تغییر باقی می‌مانند. تاریخ مبنا، روابط و شغل افراد را در لحظه ایجاد دوره تثبیت می‌کند.</div>
          } @else if (step() === 1) {
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>جامعه هدف</mat-label>
              <mat-select [ngModel]="scopeType()" (ngModelChange)="chooseScope($event)">
                <mat-option value="all">تمام کارکنان دارای انتصاب فعال</mat-option>
                <mat-option value="unit">واحدهای سازمانی و زیرواحدهای آن‌ها</mat-option>
                <mat-option value="job">شغل‌های منتخب</mat-option>
                <mat-option value="people">افراد منتخب</mat-option>
              </mat-select>
            </mat-form-field>
            @if (scopeType() !== 'all') {
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>انتخاب موارد (امکان چند انتخاب)</mat-label>
                <mat-select multiple [ngModel]="scopeIds()" (ngModelChange)="scopeIds.set($event)">
                  @if (scopeType() === 'unit') {
                    @for (u of s.state().organizationUnits; track u.id) {
                      <mat-option [value]="u.id">{{ u.name }} · {{ u.code }}</mat-option>
                    }
                  } @else if (scopeType() === 'job') {
                    @for (j of s.publishedJobs(); track j.id) {
                      <mat-option [value]="j.id">{{ j.title }}</mat-option>
                    }
                  } @else {
                    @for (p of s.state().people; track p.id) {
                      <mat-option [value]="p.id">{{ p.name }} · {{ p.code }}</mat-option>
                    }
                  }
                </mat-select>
              </mat-form-field>
            }
            <div class="info">منبع انتخاب افراد، انتصاب اصلی در تاریخ مبناست؛ انتخاب دستی ارزیاب در کمپین وجود ندارد.</div>
          } @else {
            <div class="grid two" style="margin-bottom:16px">
              <div class="stat"><small class="label">افراد قابل بررسی</small><strong>{{ preview().length | fa }}</strong></div>
              <div class="stat"><small class="label">واجد ایجاد پرونده</small><strong>{{ eligibleCount() | fa }}</strong></div>
            </div>
            @for (row of preview(); track row.personId) {
              <div class="metric-line">
                <div class="grow">
                  <strong>{{ s.person(row.personId).name }}</strong>
                  <small>{{ row.reason || (row.assignments.length + ' ارزیاب ساختاری') }}</small>
                  @if (row.notes.length) { <small>{{ row.notes.join(' · ') }}</small> }
                </div>
                <span class="badge">{{ row.reason ? 'استثنا' : 'آماده' }}</span>
              </div>
            } @empty {
              <div class="warning">برای این فیلتر و تاریخ، فردی پیدا نشد.</div>
            }
            <div class="info">با ثبت دوره، تمام افراد واجد شرایط همین حالا پروندهٔ آماده‌سازی می‌گیرند؛ دریافت پاسخ بعداً و صرفاً با دستور منابع انسانی آغاز می‌شود.</div>
          }
          <div class="actions">
            @if (step() > 0) {
              <button mat-button (click)="step.set(step() - 1)">مرحله قبل</button>
            }
            @if (step() < 2) {
              <button mat-button class="primary" (click)="next()">مرحله بعد</button>
            } @else {
              <button mat-button class="primary" (click)="create()">ایجاد دوره برای افراد منتخب</button>
            }
          </div>
        </mat-card>
      </div>
    } @else if (campaign(); as c) {
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>{{ c.title }}</h2>
            <small>{{ c.period }} · {{ c.mode | fa }} درجه · تاریخ مبنا: {{ c.asOf | faDate }} · {{ statusLabel(c) }}</small>
          </div>
          <a mat-button routerLink="/evaluations/campaigns">بازگشت به کمپین‌ها ←</a>
        </div>
        <div class="grid three">
          <div class="stat"><small class="label">پرونده‌های ساخته‌شده</small><strong>{{ cycles().length | fa }}</strong></div>
          <div class="stat"><small class="label">پاسخ‌های دریافت‌شده</small><strong>{{ completedAssignments() | fa }} / {{ totalAssignments() | fa }}</strong></div>
          <div class="stat"><small class="label">موارد نیازمند بررسی</small><strong>{{ c.exclusions.length | fa }}</strong></div>
        </div>
        @if (c.status === 'draft') {
          <div class="info">
            پروندهٔ همه افراد واجد شرایط در زمان ایجاد دوره با ارزیاب‌های استخراج‌شده از چارت
            ساخته و در وضعیت آماده‌سازی نگهداری شده است. هنوز هیچ تکلیفی در کارتابل
            ارزیاب‌ها برای پاسخ‌گویی فعال نشده است.
          </div>
          <div class="actions">
            <button mat-button class="primary" [disabled]="!allPrepared()"
              (click)="start()">تأیید منابع انسانی و شروع پاسخ‌گیری</button>
          </div>
        } @else {
          <div class="info">فهرست افراد، ارزیاب‌ها و شغل در زمان ایجاد دوره Snapshot شده است؛ تغییرات بعدی چارت این دوره را تغییر نمی‌دهد.</div>
        }
        <h2>پرونده‌های ارزیابی افراد</h2>
        @for (cycle of cycles(); track cycle.id) {
          <div class="metric-line">
            <div class="grow">
              <a [routerLink]="['/evaluations', cycle.id]"><strong>{{ s.person(cycle.subjectId).name }}</strong></a>
              <small>{{ s.job(cycle.jobId).title }} · {{ cycle.assignments.length | fa }} ارزیاب · {{ answered(cycle) | fa }} پاسخ</small>
            </div>
            <span class="badge">{{ cycle.status | status }}</span>
            <a mat-button [routerLink]="['/evaluations', cycle.id]">مدیریت پرونده ←</a>
          </div>
        }
        @if (c.exclusions.length) {
          <h2>استثناهای ایجاد دوره</h2>
          @for (row of c.exclusions; track row.personId) {
            <div class="metric-line"><strong>{{ s.person(row.personId).name }}</strong><small>{{ row.reason }}</small></div>
          }
        }
        @if (c.status === 'active') {
          <button mat-button [disabled]="cycles().some(x => x.status !== 'closed')"
            (click)="close()">بستن کمپین پس از پایان همه پرونده‌ها</button>
        }
      </mat-card>
    } @else {
      <div class="warning">کمپین موردنظر پیدا نشد.</div>
    }
  `,
})
export default class EvaluationCampaignsPage {
  readonly s = inject(Store);
  private readonly router = inject(Router);
  readonly id = input<string>();
  readonly step = signal(0);
  readonly title = signal("ارزیابی شایستگی دوره جدید");
  readonly period = signal("1406-spring");
  readonly asOf = signal(new Date().toISOString().slice(0, 10));
  readonly mode = signal<360 | 540>(360);
  readonly scopeType = signal<CampaignScope["type"]>("all");
  readonly scopeIds = signal<string[]>([]);
  readonly campaign = computed(() => this.s.state().campaigns.find((x) => x.id === this.id()));
  readonly cycles = computed(() => this.s.state().cycles.filter((c) => c.campaignId === this.id()));
  readonly preview = computed(() =>
    this.s.previewCampaign(this.scope(), this.period(), this.asOf(), this.mode()));
  readonly eligibleCount = computed(() => this.preview().filter((x) => !x.reason).length);
  readonly allPrepared = computed(() => this.cycles().length > 0 &&
    this.cycles().every((c) => c.status === "preparing" && this.s.canStart(c)));
  readonly totalAssignments = computed(() => this.cycles().reduce((n,c) => n+c.assignments.length,0));
  readonly completedAssignments = computed(() => this.cycles().reduce((n,c) =>
    n+c.assignments.filter((a) => this.s.hasAnswered(c,a)).length,0));
  scope(): CampaignScope { return { type: this.scopeType(), ids: this.scopeIds() }; }
  chooseScope(type: CampaignScope["type"]) { this.scopeType.set(type); this.scopeIds.set([]); }
  statusLabel(c: EvaluationCampaign) {
    return ({ draft: "آماده‌سازی", active: "دریافت پاسخ", closed: "بسته‌شده" })[c.status];
  }
  answered(c: Cycle) { return c.assignments.filter((a) => this.s.hasAnswered(c,a)).length; }
  next() {
    if (this.step() === 0 && (!this.title().trim() || this.period().trim().length < 3))
      return void this.s.fail("عنوان و شناسه دوره معتبر وارد کنید.");
    if (this.step() === 1 && this.scopeType() !== "all" && !this.scopeIds().length)
      return void this.s.fail("حداقل یک مورد از جامعه هدف انتخاب کنید.");
    this.step.update((s) => Math.min(2,s+1));
  }
  create() {
    const id = this.s.createCampaign(this.title(),this.period(),this.asOf(),this.mode(),this.scope());
    if (id) this.router.navigate(["/evaluations/campaigns", id]);
  }
  start() { const id = this.campaign()?.id; if (id) this.s.startCampaign(id); }
  close() { const id = this.campaign()?.id; if (id) this.s.closeCampaign(id); }
}
