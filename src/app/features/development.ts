import { Component, computed, inject, input, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { Action, EffectivenessOutcome, competencies } from "../core/models";
import { GrowthComparison } from "../shared/growth-comparison";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: [...UI, GrowthComparison],
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">از بازخورد تا اقدام</div>
        <h1>برنامه توسعه فردی</h1>
        <p>اقدام مشخص، مسئول روشن و پیگیری قابل مشاهده</p>
      </div>
      <a mat-button class="secondary" routerLink="/development"
        >همه برنامه‌ها</a
      >
    </div>
    @if (!id()) {
      @if (jobFilter() || personFilter() || periodFilter() || unitFilter()) {
        <div class="info">
          @if (jobFilter()) { برنامه‌های شغل «{{ s.job(jobFilter()).title }}» }
          @if (personFilter()) { · فرد: {{ s.person(personFilter()).name }} }
          @if (periodFilter()) { · دوره: {{ periodFilter() }} }
          @if (unitFilter()) { · واحد: {{ unitFilter() }} }
          <a routerLink="/development">نمایش همه برنامه‌ها</a>
        </div>
      }
      <div class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search"
            ><mat-label>جستجوی فرد</mat-label><input matInput
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="نام فرد…"
          /></mat-form-field>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="plans()" class="royesh-table">
    <ng-container matColumnDef="person"><th mat-header-cell *matHeaderCellDef>فرد</th><td mat-cell *matCellDef="let p">{{ s.person(p.personId).name }}</td></ng-container>
    <ng-container matColumnDef="job"><th mat-header-cell *matHeaderCellDef>شغل هدف</th><td mat-cell *matCellDef="let p">{{ s.job(p.jobId).title }}</td></ng-container>
    <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>نسخه و مبنا</th><td mat-cell *matCellDef="let p">
      <strong>نسخه {{ s.planVersion(p) | fa }}</strong>
      <small style="display:block">{{ sourceTitle(p.cycleId) }} · {{ p.period }}</small>
      @if (!s.isCurrentPlan(p)) { <span class="badge">سوابق</span> }
    </td></ng-container>
    <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>اقدام‌ها</th><td mat-cell *matCellDef="let p">{{ p.actions.length | fa }}</td></ng-container>
    <ng-container matColumnDef="progress"><th mat-header-cell *matHeaderCellDef>پیشرفت</th><td mat-cell *matCellDef="let p"><div class="progress-cell"><span>{{ s.progress(p) | fa }}٪</span><div class="bar"><span [style.width.%]="s.progress(p)"></span></div></div></td></ng-container>
    <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>جزئیات</th><td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/development/idp', p.id]">پیگیری برنامه ←</a></td></ng-container>
    <tr mat-header-row *matHeaderRowDef="developmentColumns"></tr>
    <tr mat-row *matRowDef="let row; columns: developmentColumns"></tr>
  </table>
  @if (!plans().length) { <div class="empty">برنامه‌ای یافت نشد؛ از پروفایل فرد یا گزارش ارزیابی برنامه ایجاد کنید.</div> }
        </div>
      </div>
    } @else if (plan(); as p) {
      @if (s.allowedPerson(p.personId)) {
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>
                {{ s.person(p.personId).name }} ← {{ s.job(p.jobId).title }}
              </h2>
              <small>
                مدیر مستقیم: {{ s.person(s.person(p.personId).managerId).name }}
                · نسخه {{ s.planVersion(p) | fa }}
                · {{ sourceTitle(p.cycleId) }}
                · دوره {{ p.period }}
              </small>
              @if (!s.isCurrentPlan(p)) {
                <div class="info">نسخه قبلی برنامه؛ فقط برای مشاهده و بررسی سوابق نگهداری می‌شود.</div>
              }
            </div>
            <strong>{{ s.progress(p) | fa }}٪</strong>
          </div>
          <mat-progress-bar [value]="s.progress(p)" />
          <div class="actions" style="margin-top:15px">
            <a [routerLink]="['/people', p.personId]" [queryParams]="{ job: p.jobId }">پروفایل و تحلیل شکاف ←</a>
            @if (p.cycleId) {
              <a [routerLink]="['/evaluations/reports', p.cycleId]"
                >گزارش ارزیابی ←</a
              >
            }
          </div>
        </mat-card>
        @if (p.baseline; as baseline) {
          <mat-card class="panel">
            <div class="panel-head">
              <h2>مبنای شایستگی در زمان ایجاد این نسخه</h2>
              <small>مقادیر تاریخی مستقل از تغییرات بعدی شغل یا ارزیابی</small>
            </div>
            <div class="table-wrap">
              <table mat-table [dataSource]="competencies" class="royesh-table">
                <ng-container matColumnDef="competency">
                  <th mat-header-cell *matHeaderCellDef>شایستگی</th>
                  <td mat-cell *matCellDef="let c">{{ c }}</td>
                </ng-container>
                <ng-container matColumnDef="expected">
                  <th mat-header-cell *matHeaderCellDef>انتظار شغل</th>
                  <td mat-cell *matCellDef="let c; let i = index">{{ baseline.expected[i] | fa }}</td>
                </ng-container>
                <ng-container matColumnDef="observed">
                  <th mat-header-cell *matHeaderCellDef>نتیجه ارزیابی</th>
                  <td mat-cell *matCellDef="let c; let i = index">{{ baseline.observed[i] | fa }}</td>
                </ng-container>
                <ng-container matColumnDef="gap">
                  <th mat-header-cell *matHeaderCellDef>شکاف مبنا</th>
                  <td mat-cell *matCellDef="let c; let i = index">{{ baseline.gaps[i] | fa }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="baselineColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: baselineColumns"></tr>
              </table>
            </div>
          </mat-card>
        } @else {
          <div class="info">مبنای شایستگی این برنامه پیش از ثبت نسخه‌های تاریخی ایجاد شده است.</div>
        }
        @if (p.cycleId) {
          <app-growth-comparison
            [personId]="p.personId" [jobId]="p.jobId"
            [currentCycleId]="p.cycleId" />
        }
        @if (s.isCurrentPlan(p) && s.editable()) {
          <mat-card class="panel">
            <div class="panel-head">
              <div>
                <h2>انتخاب اقدام متناسب با شایستگی</h2>
                <small>انتخاب از پیشنهادها؛ عنوان و معیار موفقیت بعد از افزودن قابل ویرایش‌اند</small>
              </div>
            </div>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>شایستگی هدف</mat-label>
                <mat-select [ngModel]="newCompetency" (ngModelChange)="chooseCompetency($event)">
                  @for (comp of competencies; track comp; let i = $index) {
                    <mat-option [value]="i">{{ comp }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>الگوی اقدام توسعه</mat-label>
                <mat-select [(ngModel)]="newTemplateId">
                  @for (t of templates(); track t.id) {
                    <mat-option [value]="t.id">{{ t.title }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <div class="actions">
              <button mat-button class="primary" (click)="addAction()">افزودن اقدام توسعه</button>
            </div>
          </mat-card>
        }
        <div class="grid three">
          @for (a of p.actions; track a.id; let i = $index) {
            <mat-card class="panel">
              <div class="panel-head">
                <span class="eyebrow"
                  >اقدام {{ i + 1 | fa }} · {{ a.kind }}</span
                ><span class="badge" [class]="'badge ' + a.status">{{
                  a.status | status
                }}</span>
              </div>
              <h2>{{ a.title }}</h2>
              <p style="margin:15px 0">{{ competencies[a.competency] }}</p>
              <div class="metric-line">
                <span class="grow">مسئول</span><span>{{ a.owner }}</span>
              </div>
              <div class="metric-line">
                <span class="grow">مهلت</span><span>{{ a.due | faDate }}</span>
              </div>
              <p style="margin:16px 0">شاخص موفقیت: {{ a.indicator }}</p>
              <p>شواهد اجرا: {{ a.evidence || "هنوز ثبت نشده است" }}</p>
              @if (a.effectiveness; as review) {
                <div class="info">
                  نظر مدیر: {{ outcomeLabel(review.outcome) }} · {{ review.reviewedAt | faDate }}
                  <p>{{ review.note }}</p>
                  <small>{{ review.reviewer }}</small>
                </div>
              } @else if (a.status === "completed") {
                <div class="warning">تکمیل فعالیت ثبت شده؛ بررسی اثربخشی هنوز انجام نشده است.</div>
              }
              <div class="actions">
                @if (s.isCurrentPlan(p) && !a.effectiveness &&
                     (s.editable() || s.role() === "employee")) {
                  <button mat-button class="secondary" (click)="edit(a)">
                    ویرایش و پیگیری
                  </button>
                }
                @if (s.isCurrentPlan(p) && s.role() === "manager" && s.allowedPerson(p.personId)
                     && a.status === "completed") {
                  <button mat-button (click)="reviewAction(a)">ثبت / اصلاح نظر اثربخشی</button>
                }
              </div>
            </mat-card>
          }
        </div>
        @if (draft && s.isCurrentPlan(p)) {
          <mat-card class="panel">
            <h2>پیگیری اقدام</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>شایستگی مرتبط</mat-label>
                <mat-select [(ngModel)]="draft.competency">
                  @for (comp of competencies; track comp; let i = $index) {
                    <mat-option [value]="i">{{ comp }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline"><mat-label>عنوان اقدام</mat-label><input matInput [(ngModel)]="draft.title" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>نوع اقدام</mat-label><input matInput [(ngModel)]="draft.kind" /></mat-form-field><mat-form-field appearance="outline"><mat-label>مسئول</mat-label><input matInput [(ngModel)]="draft.owner" /></mat-form-field><app-date-field
                 label="مهلت اقدام" [(ngModel)]="draft.due" /><mat-form-field appearance="outline"
                ><mat-label>وضعیت</mat-label><mat-select [(ngModel)]="draft.status">
                  @for (st of statuses; track st) {
                    <mat-option [value]="st">{{ st | status }}</mat-option>
                  }
                </mat-select></mat-form-field><mat-form-field appearance="outline" class="full"
                ><mat-label>شاخص موفقیت</mat-label><textarea matInput [(ngModel)]="draft.indicator"></textarea></mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>شواهد انجام اقدام</mat-label>
                <textarea matInput [(ngModel)]="draft.evidence" placeholder="لینک خروجی، گزارش، نتیجه مشاهده‌شده یا توضیح مستند"></textarea>
              </mat-form-field>
            </div>
            <div class="actions">
              <button mat-button class="primary" (click)="save()">
                ذخیره اقدام</button
              ><button mat-button (click)="draft = undefined">انصراف</button>
            </div>
          </mat-card>
        }
        @if (reviewDraft && s.isCurrentPlan(p) && s.role() === "manager") {
          <mat-card class="panel">
            <h2>بررسی اثربخشی اقدام توسط مدیر واحد</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>نتیجه بررسی اثربخشی</mat-label>
                <mat-select [(ngModel)]="reviewDraft.outcome">
                  <mat-option value="effective">مؤثر</mat-option>
                  <mat-option value="partial">تاحدی مؤثر</mat-option>
                  <mat-option value="ineffective">بدون اثربخشی مشاهده‌شده</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>شواهد و توضیح مدیر</mat-label>
                <textarea matInput [(ngModel)]="reviewDraft.note"></textarea>
              </mat-form-field>
            </div>
            <div class="actions">
              <button mat-button class="primary" (click)="saveReview()">ثبت نظر اثربخشی</button>
              <button mat-button (click)="reviewDraft = undefined">انصراف</button>
            </div>
          </mat-card>
        }
        <div class="info">
          درصد پیشرفت از تعداد فعالیت‌های تکمیل‌شده محاسبه می‌شود.
          نظر اثربخشی مدیر جداگانه ثبت می‌شود و رشد شایستگی فقط از نتایج ارزیابی
          دوره‌ای قابل بررسی است؛ هیچ‌کدام به معنی آمادگی قطعی انتصاب نیست.
        </div>
      } @else {
        <div class="warning">این برنامه در محدوده نقش فعلی نیست.</div>
      }
    } @else {
      <div class="empty">برنامه پیدا نشد.</div>
    }`,
})
export default class Development {
  s = inject(Store);
  readonly route = inject(ActivatedRoute);
  readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly jobFilter = computed(() => {
    const job = this.queryParams().get("job");
    return job && this.s.state().jobs.some((j) => j.id === job) ? job : "";
  });
  readonly personFilter = computed(() => {
    const person = this.queryParams().get("person");
    return person && this.s.state().people.some((p) => p.id === person) ? person : "";
  });
  readonly periodFilter = computed(() => this.queryParams().get("period") ?? "");
  readonly unitFilter = computed(() => {
    const unit = this.queryParams().get("unit");
    return unit && this.s.units().includes(unit) ? unit : "";
  });
  readonly developmentColumns = ["person","job","source","actions","progress","action"];
  readonly baselineColumns = ["competency", "expected", "observed", "gap"];
  sourceTitle(cycleId?: string) {
    return cycleId
      ? this.s.cycle(cycleId)?.title ?? "دوره ارزیابی ثبت‌شده"
      : "برنامه مستقل";
  }
  id = input<string>();
  search = signal("");
  draft?: Action;
  reviewDraft?: { actionId: string; outcome: EffectivenessOutcome; note: string };
  newCompetency = 4;
  newTemplateId = "";
  readonly templates = () => this.s.templatesForCompetency(this.newCompetency)
    .filter((t) => !this.plan()?.actions.some((a) => a.templateId === t.id));
  selectedTemplateId() {
    return this.templates().some((t) => t.id === this.newTemplateId)
      ? this.newTemplateId : (this.templates()[0]?.id ?? "");
  }
  competencies = competencies;
  statuses = ["planned", "progress", "completed", "blocked", "cancelled"];
  plan = computed(() => this.s.state().plans.find((p) => p.id === this.id()));
  plans = computed(() =>
    this.s
      .state()
      .plans.filter(
        (p) =>
          this.s.allowedPerson(p.personId) &&
          (!this.jobFilter() || p.jobId === this.jobFilter()) &&
          (!this.personFilter() || p.personId === this.personFilter()) &&
          (!this.periodFilter() || p.period === this.periodFilter()) &&
          (!this.unitFilter() || this.s.person(p.personId).unit === this.unitFilter()) &&
          this.s.person(p.personId).name.includes(this.search()),
      ),
  );
  chooseCompetency(value: number) {
    this.newCompetency = value;
    this.newTemplateId = this.templates()[0]?.id ?? "";
  }
  addAction() {
    if (this.s.addDevelopmentAction(this.id()!, this.newCompetency, this.selectedTemplateId())) {
      this.newTemplateId = this.templates()[0]?.id ?? "";
    }
  }
  outcomeLabel(outcome: EffectivenessOutcome) {
    return {
      effective: "مؤثر",
      partial: "تاحدی مؤثر",
      ineffective: "بدون اثربخشی مشاهده‌شده",
    }[outcome];
  }
  edit(a: Action) { this.draft = structuredClone(a); }
  save() {
    if (this.draft && this.s.saveAction(this.id()!, this.draft))
      this.draft = undefined;
  }
  reviewAction(a: Action) {
    this.draft = undefined;
    this.reviewDraft = {
      actionId: a.id,
      outcome: a.effectiveness?.outcome ?? "partial",
      note: a.effectiveness?.note ?? "",
    };
  }
  saveReview() {
    if (!this.reviewDraft) return;
    if (this.s.reviewActionEffectiveness(
      this.id()!, this.reviewDraft.actionId, this.reviewDraft.outcome, this.reviewDraft.note,
    )) this.reviewDraft = undefined;
  }
}
