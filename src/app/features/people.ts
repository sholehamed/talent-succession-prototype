import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { bands, competencies } from "../core/models";
import { UI } from "../shared/ui";
import { Chart } from "../shared/chart";
@Component({
  standalone: true,
  imports: [...UI, Chart],
  template: `@if (!id()) {
      <div class="page-header">
        <div>
          <div class="eyebrow">سرمایه انسانی سازمان</div>
          <h1>افراد و استعدادها</h1>
          <p>پروفایل یکپارچه، شواهد ارزیابی و مسیر توسعه</p>
          @if (jobFilter()) {
            <p>افراد مرتبط با شغل «{{ s.job(jobFilter()).title }}»
              <a routerLink="/people">نمایش همه افراد</a>
            </p>
          }
        </div>
        <span class="badge">{{ filtered().length | fa }} فرد</span>
      </div>
      <div class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search"
            ><mat-label>جستجو</mat-label><input matInput
              [ngModel]="search()"
              (ngModelChange)="search.set($event); page.set(0)"
              placeholder="نام یا کد پرسنلی…" /></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>واحد</mat-label><mat-select
              [ngModel]="unit()"
              (ngModelChange)="unit.set($event); page.set(0)"
            >
              <mat-option value="">همه واحدها</mat-option>
              @for (u of s.units(); track u) {
                <mat-option [value]="u">{{ u }}</mat-option>
              }
            </mat-select></mat-form-field>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="paged()" class="royesh-table">
    <ng-container matColumnDef="person"><th mat-header-cell *matHeaderCellDef>نام و کد</th><td mat-cell *matCellDef="let p"><div class="person-cell"><span class="avatar">{{ p.name.slice(0, 1) }}</span><div><strong>{{ p.name }}</strong><small>{{ p.code }}</small></div></div></td></ng-container>
    <ng-container matColumnDef="job"><th mat-header-cell *matHeaderCellDef>شغل فعلی</th><td mat-cell *matCellDef="let p">{{ s.job(p.jobId).title }}</td></ng-container>
    <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>واحد</th><td mat-cell *matCellDef="let p">{{ p.unit }}</td></ng-container>
    <ng-container matColumnDef="talent"><th mat-header-cell *matHeaderCellDef>عملکرد / پتانسیل</th><td mat-cell *matCellDef="let p">{{ bandLabel(p.performance) }} / {{ bandLabel(p.potential) }}</td></ng-container>
    <ng-container matColumnDef="progress"><th mat-header-cell *matHeaderCellDef>پیشرفت توسعه</th><td mat-cell *matCellDef="let p">{{ personProgress(p.id) | fa }}٪</td></ng-container>
    <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>جزئیات</th><td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/people', p.id]" [queryParams]="jobFilter() ? { job: jobFilter() } : {}">پروفایل ←</a></td></ng-container>
    <tr mat-header-row *matHeaderRowDef="personColumns"></tr>
    <tr mat-row *matRowDef="let row; columns: personColumns"></tr>
  </table>
  @if (!paged().length) { <div class="empty">فردی یافت نشد.</div> }
        </div>
        <div class="pagination">
          <span>{{ filtered().length | fa }} نتیجه</span>
          <div>
            <button
              mat-button
              [disabled]="page() === 0"
              (click)="page.update(dec)"
            >
              قبلی</button
            ><span>{{ page() + 1 | fa }}</span
            ><button
              mat-button
              [disabled]="(page() + 1) * 10 >= filtered().length"
              (click)="page.update(inc)"
            >
              بعدی
            </button>
          </div>
        </div>
      </div>
    } @else if (person(); as p) {
      @if (s.allowedPerson(p.id)) {
        <div class="page-header">
          <div class="detail-summary">
            <span class="avatar" style="width:58px;height:58px">{{
              p.name.slice(0, 1)
            }}</span>
            <div>
              <div class="eyebrow">پروفایل فرد · {{ p.code }}</div>
              <h1>{{ p.name }}</h1>
              <p>{{ s.job(p.jobId).title }} · {{ p.unit }}</p>
            </div>
          </div>
          <a mat-button class="secondary" routerLink="/people" [queryParams]="jobFilter() ? { job: jobFilter() } : {}">فهرست افراد</a>
        </div>
        <div class="grid four" style="margin-bottom:22px">
          <div class="stat">
            <span class="label">عملکرد فعلی</span
            ><strong style="font-size:23px">{{ bands[p.performance] }}</strong
            ><small>منبع: سوابق عملکرد ثبت‌شده</small>
          </div>
          <div class="stat">
            <span class="label">پتانسیل رشد</span
            ><strong style="font-size:23px">{{ bands[p.potential] }}</strong
            ><small>نظر انسانی، مستقل از عملکرد</small>
          </div>
          <div class="stat">
            <span class="label">پیشرفت توسعه</span
            ><strong>{{ personProgress(p.id) | fa }}٪</strong
            ><small>اقدام‌های انجام‌شده / کل اقدام‌ها</small>
          </div>
          <div class="stat">
            <span class="label">برنامه توسعه</span
            ><strong>{{ plans().length | fa }}</strong
            ><small>برنامه متصل به شغل هدف</small>
          </div>
        </div>
        <div class="info">
          {{ p.evidence }} · امتیازها ابزار کمکی‌اند و به معنای صلاحیت قطعی یا
          آمادگی انتصاب نیستند.
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>تحلیل شکاف با شغل هدف</h2>
            <mat-form-field appearance="outline" style="min-width:210px"
              ><mat-label>شغل هدف</mat-label><mat-select
                [ngModel]="target()"
                (ngModelChange)="selectTarget($event)"
              >
                @for (j of s.state().jobs; track j.id) {
                  <mat-option [value]="j.id">{{ j.title }}</mat-option>
                }
              </mat-select></mat-form-field>
          </div>
          <div class="grid two">
            <div>
              @defer (on viewport) {
                <app-chart
                  type="radar"
                  [categories]="competencies"
                  [series]="series()"
                />
              } @placeholder {
                <div class="empty">مقایسه شایستگی</div>
              }
            </div>
            <div>
              <table mat-table [dataSource]="competencies" class="royesh-table">
  <ng-container matColumnDef="competency"><th mat-header-cell *matHeaderCellDef>شایستگی</th><td mat-cell *matCellDef="let comp">{{ comp }}</td></ng-container>
  <ng-container matColumnDef="observed"><th mat-header-cell *matHeaderCellDef>سطح فرد</th><td mat-cell *matCellDef="let comp; let i=index">{{ s.scores(p.id)[i] | fa }}</td></ng-container>
  <ng-container matColumnDef="target"><th mat-header-cell *matHeaderCellDef>هدف</th><td mat-cell *matCellDef="let comp; let i=index">{{ s.job(target()).expected[i] | fa }}</td></ng-container>
  <ng-container matColumnDef="gap"><th mat-header-cell *matHeaderCellDef>شکاف</th><td mat-cell *matCellDef="let comp; let i=index">{{ s.gaps(p.id, target())[i] | fa }}</td></ng-container>
  <tr mat-header-row *matHeaderRowDef="gapColumns"></tr><tr mat-row *matRowDef="let row; columns: gapColumns"></tr>
</table>
              @if (s.role() === "hr") {
                <a mat-button routerLink="/evaluations/cycles"
                  [queryParams]="{ job: target(), person: p.id }">
                  ارزیابی فرد برای این شغل ←
                </a>
              }
              @if (s.editable()) {
                <button
                  mat-button
                  class="primary"
                  style="margin-top:16px"
                  (click)="createPlan()"
                >
                  ایجاد / مشاهده برنامه توسعه
                </button>
              }
            </div>
          </div>
        </div>
        <div class="grid two">
          <mat-card class="panel">
            <h2>سوابق ارزیابی</h2>
            @for (c of cycles(); track c.id) {
              <div class="metric-line">
                <div class="grow">
                  <strong>{{ c.title }}</strong
                  ><small>{{ c.status | status }}</small>
                </div>
                @if (c.status === "feedback" || c.status === "closed") {
                  <a [routerLink]="['/evaluations/reports', c.id]">گزارش ←</a>
                }
              </div>
            } @empty {
              <div class="empty">گزارش ثبت نشده است.</div>
            }
          </mat-card>
          <mat-card class="panel">
            <h2>برنامه‌های توسعه فردی</h2>
            @for (d of plans(); track d.id) {
              <div class="metric-line">
                <a class="grow" [routerLink]="['/development/idp', d.id]">{{
                  s.job(d.jobId).title
                }}</a
                ><span>{{ s.progress(d) | fa }}٪</span>
              </div>
            } @empty {
              <div class="empty">هنوز برنامه‌ای ایجاد نشده است.</div>
            }
          </mat-card>
        </div>
      } @else {
        <div class="warning">این پروفایل در محدوده نقش فعلی شما نیست.</div>
      }
    } @else {
      <div class="empty">فرد موردنظر یافت نشد.</div>
    }`,
})
export default class People {
  s = inject(Store);
  readonly gapColumns = ["competency","observed","target","gap"];
  readonly personColumns = ["person","job","unit","talent","progress","action"];
  router = inject(Router);
  route = inject(ActivatedRoute);
  id = input<string>();
  search = signal("");
  unit = signal("");
  page = signal(0);
  readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly jobFilter = computed(() => {
    const id = this.queryParams().get("job");
    return id && this.s.state().jobs.some((j) => j.id === id) ? id : "";
  });
  target = signal(this.initialTarget());
  competencies = competencies;
  bands = bands;
  bandLabel(value: string) {
    return bands[value as keyof typeof bands] ?? "—";
  }
  constructor() {
    effect(() => {
      const requested = this.jobFilter();
      const current = this.id() ?? this.route.snapshot.paramMap.get("id");
      const ownJob = this.s.state().people.find((p) => p.id === current)?.jobId;
      this.target.set(requested || ownJob || this.s.state().jobs[0]?.id || "");
    });
  }
  initialTarget() {
    const requested = this.route.snapshot.queryParamMap.get("job");
    if (requested && this.s.state().jobs.some((j) => j.id === requested)) return requested;
    const current = this.route.snapshot.paramMap.get("id");
    return this.s.state().people.find((p) => p.id === current)?.jobId
      ?? this.s.state().jobs[0]?.id ?? "";
  }
  selectTarget(jobId: string) {
    this.target.set(jobId);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { job: jobId },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
  inc = (n: number) => n + 1;
  dec = (n: number) => n - 1;
  person = computed(() =>
    this.s.state().people.find((p) => p.id === this.id()),
  );
  filtered = computed(() =>
    (this.jobFilter() ? this.s.relatedPeople(this.jobFilter()) : this.s.state().people)
      .filter(
        (p) =>
          this.s.allowedPerson(p.id) &&
          (!this.unit() || p.unit === this.unit()) &&
          (p.name + " " + p.code).includes(this.search()),
      ),
  );
  paged = computed(() =>
    this.filtered().slice(this.page() * 10, this.page() * 10 + 10),
  );
  plans = computed(() =>
    this.s.state().plans.filter((p) => p.personId === this.id()),
  );
  cycles = computed(() =>
    this.s.state().cycles.filter((c) => c.subjectId === this.id()),
  );
  series = computed(() => [
    { name: "شواهد فرد", data: this.s.scores(this.id()!) },
    { name: "انتظار شغل", data: this.s.job(this.target()).expected },
  ]);
  personProgress(id: string) {
    const actions = this.s
      .state()
      .plans.filter((p) => p.personId === id)
      .flatMap((p) => p.actions);
    return actions.length
      ? Math.round(
          (actions.filter((a) => a.status === "completed").length /
            actions.length) *
            100,
        )
      : 0;
  }
  createPlan() {
    const id = this.s.createPlan(this.id()!, this.target());
    if (id) this.router.navigate(["/development/idp", id]);
  }
}
