import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { UI, download } from "../shared/ui";
import { Chart } from "../shared/chart";
import { competencies } from "../core/models";
@Component({
  standalone: true,
  imports: [...UI, Chart],
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">نمای یکپارچه سرمایه انسانی</div>
        <h1>
          {{
            reports
              ? "گزارش‌ها و تحلیل مدیریتی"
              : view() === "executive"
                ? "داشبورد مدیرعامل"
                : view() === "unit"
                  ? "داشبورد مدیر واحد"
                  : "داشبورد منابع انسانی"
          }}
        </h1>
        <p>تصویری روشن از وضعیت استعدادها، توسعه و آمادگی سازمان</p>
      </div>
      <div class="actions">
        <button mat-button class="secondary" (click)="export()">
          ↓ دریافت گزارش CSV
        </button>
        @if (s.role() === "hr") {
          <a mat-button class="primary" routerLink="/evaluations/c1"
            >ادامه چرخه ارزیابی ←</a
          >
        }
      </div>
    </div>
    <div class="chips">
      <button mat-button
        class="chip"
        [class.selected]="view() === 'hr'"
        (click)="view.set('hr')"
      >
        منابع انسانی</button
      ><button mat-button
        class="chip"
        [class.selected]="view() === 'executive'"
        (click)="view.set('executive')"
      >
        مدیرعامل</button
      ><button mat-button
        class="chip"
        [class.selected]="view() === 'unit'"
        (click)="view.set('unit'); unit.set('دفتر پروژه‌ها')"
      >
        مدیر واحد
      </button>
    </div>
    <div class="filterbar">
      <mat-form-field appearance="outline"
        ><mat-label>دوره ارزیابی و توسعه</mat-label><mat-select
          [ngModel]="period()"
          (ngModelChange)="period.set($event)"
        >
          <mat-option value="1405-autumn">پاییز ۱۴۰۵</mat-option>
          <mat-option value="1405-summer">تابستان ۱۴۰۵</mat-option>
          <mat-option value="">همه دوره‌ها</mat-option>
        </mat-select></mat-form-field><mat-form-field appearance="outline"
        ><mat-label>واحد سازمانی</mat-label><mat-select
          [ngModel]="unit()"
          (ngModelChange)="unit.set($event)"
          [disabled]="s.role() === 'manager'"
        >
          <mat-option value="">همه واحدها</mat-option>
          @for (u of s.units(); track u) {
            <mat-option [value]="u">{{ u }}</mat-option>
          }
        </mat-select></mat-form-field><span class="muted" style="font-size:10px;margin-right:auto"
        >● به‌روز از داده‌های همین مرورگر</span
      >
    </div>
    <div class="grid four" style="margin-bottom:24px">
      <a class="stat" routerLink="/jobs"
        ><span class="stat-icon">▤</span>
        <div class="label">پوشش شناسنامه شغلی</div>
        <strong>{{ coverage() | fa }}<small> ٪</small></strong
        ><small
          ><span style="color:#238d71"
            >{{ jobs().length | fa }} شناسنامه منتشرشده</span
          >
          · وضعیت فعلی</small
        ></a
      ><a
        class="stat"
        [routerLink]="s.role() === 'hr' ? '/evaluations/cycles' : '/reports'"
        ><span class="stat-icon" style="background:#edf3fc;color:#7397c8"
          >◎</span
        >
        <div class="label">مشارکت در ارزیابی</div>
        <strong>{{ participation() | fa }}<small> ٪</small></strong
        ><small
          >{{ responseCount() | fa }} پاسخ از {{ assignmentCount() | fa }} تکلیف
          در دوره</small
        ></a
      ><a class="stat" routerLink="/development"
        ><span class="stat-icon" style="background:#f3eff9;color:#9b83bd"
          >↗</span
        >
        <div class="label">پیشرفت برنامه‌های توسعه</div>
        <strong>{{ idpProgress() | fa }}<small> ٪</small></strong
        ><small
          >{{ doneActions() | fa }} اقدام انجام‌شده از
          {{ actions().length | fa }} اقدام</small
        ></a
      ><a class="stat" routerLink="/talent/succession"
        ><span class="stat-icon" style="background:#fff5e5;color:#c9a15a"
          >◇</span
        >
        <div class="label">پوشش جانشین آماده</div>
        <strong>{{ readyCoverage() | fa }}<small> ٪</small></strong
        ><small
          >{{ readyPositions() | fa }} از {{ positions().length | fa }} پست
          حیاتی · وضعیت فعلی</small
        ></a
      >
    </div>
    <div class="grid wide">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>
              {{
                view() === "executive"
                  ? "شواهد رشد و آمادگی سازمان"
                  : "شکاف شایستگی‌های کلیدی"
              }}
            </h2>
            <small>میانگین سطح افراد و انتظار شغل هدف · واحد انتخاب‌شده</small>
          </div>
          <span class="badge">مقیاس ۱ تا ۵</span>
        </div>
        @defer (on viewport) {
          <app-chart
            type="bar"
            [categories]="competencies"
            [series]="gapSeries()"
          />
        } @placeholder {
          <div class="empty">در حال آماده‌سازی نمودار</div>
        }
        <p class="report-note">
          منبع: آخرین گزارش منتشرشده یا شواهد عملکردی ثبت‌شده؛ مستقل از فیلتر دوره
          فعالیت.
        </p>
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>وضعیت چرخه ارزیابی</h2>
            <small>{{ cycles().length | fa }} دوره در بازه انتخاب‌شده</small>
          </div>
          <span class="badge green">۳۶۰ / ۵۴۰</span>
        </div>
        @for (c of cycles(); track c.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ c.title }}</strong
              ><small
                >{{ s.person(c.subjectId).name }} ·
                {{ c.status | status }}</small
              >
              <div class="bar" style="margin-top:12px">
                <span
                  [style.width.%]="
                    c.assignments.length
                      ? (answered(c.id) / c.assignments.length) * 100
                      : 0
                  "
                ></span>
              </div>
            </div>
            <span
              >{{ answered(c.id) | fa }} / {{ c.assignments.length | fa }}</span
            >
          </div>
        } @empty {
          <div class="empty">دوره‌ای در این فیلتر وجود ندارد.</div>
        }
        <div style="padding:20px 0;border-bottom:1px solid var(--line)">
          <h3>اقدام بعدی پیشنهادی</h3>
          <p style="font-size:12px;margin-top:8px">{{ pendingText() }}</p>
        </div>
        <div class="metric-line">
          <span class="grow">پاسخ‌های ثبت‌شده</span
          ><strong>{{ responseCount() | fa }}</strong>
        </div>
        <div class="metric-line">
          <span class="grow">تکالیف باقی‌مانده</span
          ><strong>{{ assignmentCount() - responseCount() | fa }}</strong>
        </div>
      </mat-card>
    </div>
    <div class="grid wide">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>پیگیری برنامه‌های توسعه</h2>
            <small>پیشرفت اقدام‌های ثبت‌شده در برنامه‌های توسعه</small>
          </div>
          <a routerLink="/development" style="font-size:11px"
            >همه برنامه‌ها ←</a
          >
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="plans().slice(0, 5)" class="royesh-table">
 <ng-container matColumnDef="person"><th mat-header-cell *matHeaderCellDef>فرد / شغل هدف</th><td mat-cell *matCellDef="let p">
   <div class="person-cell"><span class="avatar small">{{ s.person(p.personId).name.slice(0, 1) }}</span>
    <div>{{ s.person(p.personId).name }}<small>{{ s.job(p.jobId).title }}</small></div></div>
 </td></ng-container>
 <ng-container matColumnDef="done"><th mat-header-cell *matHeaderCellDef>اقدام تکمیل‌شده</th><td mat-cell *matCellDef="let p">{{ completed(p.id) | fa }} از {{ p.actions.length | fa }}</td></ng-container>
 <ng-container matColumnDef="progress"><th mat-header-cell *matHeaderCellDef>پیشرفت</th><td mat-cell *matCellDef="let p">
  <div class="progress-cell"><div class="bar"><span [style.width.%]="s.progress(p)"></span></div>{{ s.progress(p) | fa }}٪</div>
 </td></ng-container>
 <ng-container matColumnDef="link"><th mat-header-cell *matHeaderCellDef>جزئیات</th><td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/development/idp', p.id]">پیگیری ←</a></td></ng-container>
 <tr mat-header-row *matHeaderRowDef="developmentColumns"></tr><tr mat-row *matRowDef="let row; columns: developmentColumns"></tr>
 </table>
 @if (!plans().length) { <div class="empty">برنامه‌ای برای این دوره و واحد ثبت نشده است.</div> }
        </div>
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>نیازمند توجه</h2>
            <small>پست‌های حیاتی فاقد جانشین آماده</small>
          </div>
          <span class="badge amber"
            >{{ positions().length - readyPositions() | fa }} پست</span
          >
        </div>
        @for (p of unready().slice(0, 3); track p.id) {
          <div class="risk-box">
            <a
              routerLink="/talent/succession"
              [queryParams]="{ job: p.jobId }"
              >{{ s.job(p.jobId).title }}</a
            ><small
              >{{ p.unit }} · احتمال {{ p.probability | fa }} / اثر
              {{ p.impact | fa }}</small
            >
          </div>
        } @empty {
          <p>برای تمام پست‌های این فیلتر نامزد A ثبت شده است.</p>
        }
        <div class="metric-line">
          <div class="grow">
            <h3>دانش سازمانی</h3>
            <small>وضعیت فعلی، خارج از فیلتر دوره</small>
          </div>
          <a routerLink="/knowledge">مخزن ←</a>
        </div>
        <div class="metric-line">
          <span class="grow">درس‌آموخته منتشرشده</span
          ><strong>{{ knowledge().length | fa }}</strong>
        </div>
        <div class="metric-line">
          <span class="grow">مشاهده‌های دانشی</span
          ><strong>{{ knowledgeViews() | fa }}</strong>
        </div>
      </mat-card>
    </div>
    @if (reports) {
      <mat-card class="panel">
        <h2>جدول منشأ شاخص‌ها و شکاف فردی</h2>
        <div class="table-wrap">
          <table mat-table [dataSource]="people()" class="royesh-table">
 <ng-container matColumnDef="person"><th mat-header-cell *matHeaderCellDef>فرد</th><td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/people', p.id]">{{ p.name }}</a></td></ng-container>
 <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>واحد</th><td mat-cell *matCellDef="let p">{{ p.unit }}</td></ng-container>
 @for (comp of competencies; track comp; let i = $index) {
  <ng-container [matColumnDef]="'gap' + i"><th mat-header-cell *matHeaderCellDef>{{ comp }}</th>
  <td mat-cell *matCellDef="let p" [style.background]="s.gaps(p.id, p.jobId)[i] > 1 ? '#fff4df' : s.gaps(p.id, p.jobId)[i] > 0 ? '#f4f8ed' : '#ecf7f2'">
    {{ s.gaps(p.id, p.jobId)[i] | fa }}
  </td></ng-container>
 }
 <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>منشأ</th><td mat-cell *matCellDef="let p">گزارش منتشرشده / شواهد عملکردی</td></ng-container>
 <tr mat-header-row *matHeaderRowDef="gapColumns"></tr><tr mat-row *matRowDef="let row; columns: gapColumns"></tr>
 </table>
        </div>
      </mat-card>
      <div class="info">
        فرمول‌ها: پوشش شناسنامه = شغل دارای نسخه منتشرشده ÷ کل شغل؛ مشارکت =
        پاسخ ÷ تکلیف؛ توسعه = اقدام کامل ÷ کل اقدام؛ جانشینی = پست حیاتی با
        نامزد A ÷ کل پست حیاتی. شاخص‌ها بر اساس داده‌های موجود در سامانه محاسبه می‌شوند.
      </div>
    }`,
})
export default class Dashboard {
  s = inject(Store);
  readonly developmentColumns = ["person","done","progress","link"];
  readonly gapColumns = ["person","unit",...competencies.map((_, i) => "gap" + i),"source"];
  route = inject(ActivatedRoute);
  reports = !!this.route.snapshot.data["reports"];
  view = signal(this.route.snapshot.paramMap.get("view") ?? "hr");
  period = signal("1405-autumn");
  unit = signal(
    this.s.role() === "manager" ||
      this.route.snapshot.paramMap.get("view") === "unit"
      ? "دفتر پروژه‌ها"
      : "",
  );
  competencies = competencies;
  people = computed(() =>
    this.s.state().people.filter((p) => !this.unit() || p.unit === this.unit()),
  );
  jobs = computed(() =>
    this.s.state().jobs.filter((j) => !this.unit() || j.unit === this.unit()),
  );
  cycles = computed(() =>
    this.s
      .state()
      .cycles.filter(
        (c) =>
          (!this.period() || c.period === this.period()) &&
          this.people().some((p) => p.id === c.subjectId),
      ),
  );
  plans = computed(() =>
    this.s
      .state()
      .plans.filter(
        (p) =>
          (!this.period() || p.period === this.period()) &&
          this.people().some((x) => x.id === p.personId),
      ),
  );
  actions = computed(() => this.plans().flatMap((p) => p.actions));
  doneActions = computed(
    () => this.actions().filter((a) => a.status === "completed").length,
  );
  idpProgress = computed(() =>
    this.actions().length
      ? Math.round((this.doneActions() / this.actions().length) * 100)
      : 0,
  );
  assignmentCount = computed(() =>
    this.cycles().reduce((v, c) => v + c.assignments.length, 0),
  );
  responseCount = computed(() =>
    this.cycles().reduce(
      (v, c) => v + c.assignments.filter((a) => a.scores).length,
      0,
    ),
  );
  participation = computed(() =>
    this.assignmentCount()
      ? Math.round((this.responseCount() / this.assignmentCount()) * 100)
      : 0,
  );
  coverage = computed(() =>
    this.jobs().length
      ? Math.round(
          (this.jobs().filter((j) => j.version > 0).length /
            this.jobs().length) *
            100,
        )
      : 0,
  );
  positions = computed(() =>
    this.s
      .state()
      .positions.filter(
        (p) => p.critical && (!this.unit() || p.unit === this.unit()),
      ),
  );
  unready = computed(() =>
    this.positions().filter(
      (p) =>
        !this.s
          .state()
          .nominations.some(
            (n) => n.positionId === p.id && n.readiness === "A",
          ),
    ),
  );
  readyPositions = computed(
    () => this.positions().length - this.unready().length,
  );
  readyCoverage = computed(() =>
    this.positions().length
      ? Math.round((this.readyPositions() / this.positions().length) * 100)
      : 0,
  );
  knowledge = computed(() =>
    this.s
      .state()
      .knowledge.filter(
        (k) =>
          k.status === "published" &&
          k.kind === "AAR" &&
          (!this.unit() || this.s.job(k.jobId).unit === this.unit()),
      ),
  );
  knowledgeViews = computed(() =>
    this.s
      .state()
      .knowledge.filter(
        (k) =>
          k.status === "published" &&
          (!this.unit() || this.s.job(k.jobId).unit === this.unit()),
      )
      .reduce((v, k) => v + k.views, 0),
  );
  gapSeries = computed(() => {
    const people = this.people();
    return [
      {
        name: "سطح مشاهده‌شده",
        data: competencies.map((_, i) =>
          people.length
            ? +(
                people.reduce((v, p) => v + this.s.scores(p.id)[i], 0) /
                people.length
              ).toFixed(1)
            : 0,
        ),
      },
      {
        name: "انتظار شغل",
        data: competencies.map((_, i) =>
          people.length
            ? +(
                people.reduce(
                  (v, p) => v + this.s.job(p.jobId).expected[i],
                  0,
                ) / people.length
              ).toFixed(1)
            : 0,
        ),
      },
    ];
  });
  pendingText = computed(() =>
    this.cycles().some((c) => c.status === "preparing")
      ? "ارزیاب‌ها را کنترل و دریافت پاسخ را آغاز کنید."
      : this.cycles().some((c) => c.status === "collecting")
        ? "تکالیف باقی‌مانده را در کارتابل ارزیاب پیگیری کنید."
        : this.cycles().some((c) => c.status === "calibration")
          ? "شواهد گروه‌ها را مرور و نظر کالیبراسیون را ثبت کنید."
          : "برنامه‌های توسعه و بازخوردهای منتشرشده را پیگیری کنید.",
  );
  answered(id: string) {
    return this.s.cycle(id)!.assignments.filter((a) => a.scores).length;
  }
  completed(id: string) {
    return this.s
      .state()
      .plans.find((p) => p.id === id)!
      .actions.filter((a) => a.status === "completed").length;
  }
  export() {
    download(
      "royesh-management-report.csv",
      [
        "شاخص,مقدار,دوره,واحد",
        ...[
          ["پوشش شناسنامه", this.coverage()],
          ["مشارکت ارزیابی", this.participation()],
          ["پیشرفت توسعه", this.idpProgress()],
          ["پوشش جانشینی", this.readyCoverage()],
        ].map(
          (r) =>
            `${r[0]},${r[1]},${this.period() || "همه"},${this.unit() || "همه"}`,
        ),
      ].join("\n"),
      "text/csv;charset=utf-8",
    );
  }
}
