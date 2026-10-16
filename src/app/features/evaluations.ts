import { Component, computed, inject, input, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { Group, competencies, groups } from "../core/models";
import { UI } from "../shared/ui";
import { Chart } from "../shared/chart";
@Component({
  standalone: true,
  imports: [...UI, Chart],
  template: ` <div class="page-header">
      <div>
        <div class="eyebrow">سنجش رفتار، بازخورد و رشد</div>
        <h1>
          {{
            view === "inbox"
              ? "کارتابل ارزیابی"
              : view === "report"
                ? "گزارش ارزیابی و تحلیل شکاف"
                : view === "calibration"
                  ? "کالیبراسیون و بازخورد"
                  : "ارزیابی چندمنبعی"
          }}
        </h1>
        <p>ارزیابی چندمنبعی شایستگی‌ها · نتایج پشتیبان تصمیم انسانی</p>
      </div>
      <a mat-button class="secondary" routerLink="/evaluations/cycles"
        >دوره‌های ارزیابی</a
      >
    </div>
    @if (view === "cycles") {
      <div class="grid two">
        <mat-card class="panel">
          <h2>دوره‌های ارزیابی</h2>
          @for (c of s.state().cycles; track c.id) {
            <div class="metric-line">
              <div class="grow">
                <a [routerLink]="['/evaluations', c.id]"
                  ><strong>{{ c.title }}</strong></a
                ><small
                  >{{ s.person(c.subjectId).name }} · {{ c.mode | fa }} درجه ·
                  {{ s.job(c.jobId).title }}</small
                >
              </div>
              <span class="badge" [class]="'badge ' + c.status">{{
                c.status | status
              }}</span
              ><span
                >{{ answered(c.id) | fa }} /
                {{ c.assignments.length | fa }}</span
              >
            </div>
          }
        </mat-card>
        @if (s.role() === "hr") {
          <mat-card class="panel">
            <h2>ایجاد دوره جدید</h2>
            <mat-form-field appearance="outline"
              ><mat-label>عنوان دوره</mat-label><input matInput
                [(ngModel)]="title"
                placeholder="ارزیابی پاییز ۱۴۰۵"
            /></mat-form-field>
            <div class="form-grid">
              <mat-form-field appearance="outline"
                ><mat-label>ارزیابی‌شونده</mat-label><mat-select [(ngModel)]="subject">
                  @for (p of s.state().people; track p.id) {
                    <mat-option [value]="p.id">{{ p.name }}</mat-option>
                  }
                </mat-select></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>شغل هدف</mat-label><mat-select [(ngModel)]="target">
                  @for (j of s.state().jobs; track j.id) {
                    <mat-option [value]="j.id">{{ j.title }}</mat-option>
                  }
                </mat-select></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>نوع ارزیابی</mat-label><mat-select [(ngModel)]="mode">
                  <mat-option [value]="360">۳۶۰ درجه</mat-option>
                  <mat-option [value]="540">۵۴۰ درجه</mat-option>
                </mat-select></mat-form-field>
            </div>
            <button mat-button class="primary" (click)="create()">
              ایجاد دوره
            </button>
          </mat-card>
        }
      </div>
      <div class="info">
        برای آغاز پاسخ‌گیری، دوره‌ای را در وضعیت آماده‌سازی انتخاب کنید و
        ترکیب ارزیابان و حداقل گروه‌های لازم را بررسی کنید.
      </div>
    } @else if (view === "inbox") {
      <div class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline"
            ><mat-label>انتخاب ارزیاب</mat-label><mat-select
              [ngModel]="s.actor()"
              (ngModelChange)="s.actor.set($event); selected.set('')"
            >
              @for (p of evaluators(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select></mat-form-field>
        </div>
        @for (item of inbox(); track item.a.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ item.c.title }}</strong
              ><small
                >ارزیابی {{ s.person(item.c.subjectId).name }} ·
                {{ groups[item.a.group] }}</small
              >
            </div>
            <span class="badge">{{
              item.a.scores ? "ثبت‌شده" : "در انتظار پاسخ"
            }}</span>
            @if (!item.a.scores) {
              <button mat-button (click)="openAnswer(item.c.id, item.a.id)">
                تکمیل پرسشنامه
              </button>
            }
          </div>
        } @empty {
          <div class="empty">
            تکلیف فعالی برای این شخصیت وجود ندارد. دوره باید در مرحله دریافت
            پاسخ باشد.
          </div>
        }
      </div>
      @if (selected()) {
        <mat-card class="panel">
          <h2>بازخورد رفتاری</h2>
          <p>در تجربه همکاری، فرد تا چه اندازه رفتار زیر را نشان داده است؟</p>
          @for (c of competencies; track c; let i = $index) {
            <div class="question">
              <strong>{{ i + 1 | fa }}. {{ questions[i] }}</strong
              ><small style="display:block">شایستگی: {{ c }}</small>
              <div class="score-row">
     <mat-radio-group [ngModel]="scores[i]" (ngModelChange)="scores[i] = $event">
       @for (anchor of anchors; track anchor; let n = $index) {
         <mat-radio-button [value]="n + 1">{{ n + 1 | fa }} · {{ anchor }}</mat-radio-button>
       }
     </mat-radio-group>
   </div>
            </div>
          }
          <button
            mat-button
            class="primary"
            style="margin-top:20px"
            (click)="send()"
          >
            ثبت نهایی پاسخ‌ها
          </button>
        </mat-card>
      }
    } @else if (cycle(); as c) {
      @if (view === "detail") {
        <div class="detail-summary">
          <span class="avatar">{{ c.mode | fa }}</span>
          <div>
            <h2>{{ c.title }}</h2>
            <p>
              {{ s.person(c.subjectId).name }} · شغل هدف:
              <a [routerLink]="['/jobs', c.jobId]">{{
                s.job(c.jobId).title
              }}</a>
            </p>
          </div>
          <span class="badge" [class]="'badge ' + c.status">{{
            c.status | status
          }}</span>
        </div>
        <div class="flow-steps">
          <span [class.muted]="c.status !== 'preparing'"
            >۱ انتخاب ارزیابان</span
          >
          ← <span>۲ دریافت پاسخ</span> ← <span>۳ کالیبراسیون</span> ←
          <span>۴ بازخورد و توسعه</span>
        </div>
        <div class="grid four" style="margin-bottom:20px">
          @for (g of groupEntries; track g[0]) {
            @if (c.mode === 540 || g[0] !== "external") {
              <div class="stat">
                <div class="label">{{ g[1] }}</div>
                <strong>{{ count(g[0]) | fa }}</strong
                ><small
                  >حداقل
                  {{
                    (g[0] === "peer" || g[0] === "subordinate" ? 2 : 1) | fa
                  }}
                  ارزیاب</small
                >
              </div>
            }
          }
        </div>
        <mat-card class="panel">
          <div class="panel-head">
            <h2>ارزیابان و وضعیت تکالیف</h2>
            <span
              >{{ answered(c.id) | fa }} از
              {{ c.assignments.length | fa }} پاسخ</span
            >
          </div>
          <mat-progress-bar
            mode="determinate"
            [value]="
              c.assignments.length
                ? (answered(c.id) / c.assignments.length) * 100
                : 0
            "
          />
          <div class="table-wrap">
            <table mat-table [dataSource]="c.assignments" class="royesh-table">
 <ng-container matColumnDef="evaluator"><th mat-header-cell *matHeaderCellDef>ارزیاب</th><td mat-cell *matCellDef="let a">{{ s.person(a.personId).name }}</td></ng-container>
 <ng-container matColumnDef="group"><th mat-header-cell *matHeaderCellDef>گروه</th><td mat-cell *matCellDef="let a">{{ groupLabel(a.group) }}</td></ng-container>
 <ng-container matColumnDef="state"><th mat-header-cell *matHeaderCellDef>وضعیت</th><td mat-cell *matCellDef="let a">{{ a.scores ? "ثبت‌شده" : "در انتظار پاسخ" }}</td></ng-container>
 <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>عملیات</th><td mat-cell *matCellDef="let a">
   @if (c.status === "preparing" && s.role() === "hr") {
     <button mat-button (click)="s.removeEvaluator(c.id, a.id)">حذف</button>
   }
 </td></ng-container>
 <tr mat-header-row *matHeaderRowDef="evaluatorColumns"></tr><tr mat-row *matRowDef="let row; columns: evaluatorColumns"></tr>
 </table>
          </div>
          @if (c.status === "preparing" && s.role() === "hr") {
            <div class="filterbar">
              <mat-form-field appearance="outline" class="search"
                ><mat-label>ارزیاب</mat-label><mat-select [(ngModel)]="evaluator">
                  @for (p of s.state().people; track p.id) {
                    <mat-option [value]="p.id">{{ p.name }}</mat-option>
                  }
                </mat-select></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>گروه</mat-label><mat-select [(ngModel)]="group">
                  @for (g of groupEntries; track g[0]) {
                    @if (c.mode === 540 || g[0] !== "external") {
                      <mat-option [value]="g[0]">{{ g[1] }}</mat-option>
                    }
                  }
                </mat-select></mat-form-field><button
                mat-button
                class="secondary"
                (click)="s.addEvaluator(c.id, evaluator, group)"
              >
                افزودن ارزیاب
              </button>
            </div>
            @if (!s.canStart(c)) {
              <div class="warning">
                شروع دوره نیازمند حداقل ۱ سرپرست، ۲ هم‌سطح، ۲ زیردست و برای ۵۴۰
                یک ذی‌نفع بیرونی است.
              </div>
            }
            <button
              mat-button
              class="primary"
              [disabled]="!s.canStart(c)"
              (click)="s.advance(c.id)"
            >
              شروع دریافت پاسخ‌ها
            </button>
          }
          @if (c.status === "collecting") {
            <div class="actions">
              <button mat-button class="secondary" (click)="asEvaluator()">
                ورود به نقش ارزیاب و کارتابل
              </button>
              @if (s.role() === "hr") {
                <button
                  mat-button
                  class="primary"
                  [disabled]="answered(c.id) !== c.assignments.length"
                  (click)="s.advance(c.id)"
                >
                  پایان پاسخ‌گیری و کالیبراسیون
                </button>
              }
            </div>
          }
          @if (c.status === "calibration") {
            <a
              mat-button
              class="primary"
              [routerLink]="['/evaluations', c.id, 'calibration']"
              >ورود به کالیبراسیون ←</a
            >
          }
          @if (c.status === "feedback" || c.status === "closed") {
            <a
              mat-button
              class="primary"
              [routerLink]="['/evaluations/reports', c.id]"
              >گزارش، شکاف و برنامه توسعه ←</a
            >
            @if (c.status === "feedback" && s.role() === "hr") {
              <button mat-button (click)="s.advance(c.id)">بستن دوره</button>
            }
          }
        </mat-card>
      } @else if (view === "report" || view === "calibration") {
        @if (
          s.allowedPerson(c.subjectId) &&
          ((view === "calibration" && c.status === "calibration") ||
            ["feedback", "closed"].includes(c.status))
        ) {
          <div class="info">
            روش محاسبه: میانگین ساده گروه‌های قابل انتشار؛ گروه
            هم‌سطح/زیردست با کمتر از دو پاسخ پنهان می‌شود. این مدل تأیید علمی یا
            قانون کارفرما نیست.
          </div>
          <div class="grid two">
            <mat-card class="panel">
              <div class="panel-head">
                <div>
                  <h2>{{ s.person(c.subjectId).name }}</h2>
                  <small>{{ c.title }} · {{ s.job(c.jobId).title }}</small>
                </div>
              </div>
              @defer (on viewport) {
                <app-chart
                  type="radar"
                  [categories]="competencies"
                  [series]="chartSeries()"
                />
              } @placeholder {
                <div class="empty">نمودار شایستگی</div>
              }
            </mat-card>
            <mat-card class="panel">
              <h2>شکاف نسبت به شغل هدف</h2>
              <table mat-table [dataSource]="competencies" class="royesh-table">
 <ng-container matColumnDef="competency"><th mat-header-cell *matHeaderCellDef>شایستگی</th><td mat-cell *matCellDef="let comp">{{ comp }}</td></ng-container>
 <ng-container matColumnDef="expected"><th mat-header-cell *matHeaderCellDef>انتظار</th><td mat-cell *matCellDef="let comp; let i = index">{{ s.job(c.jobId).expected[i] | fa }}</td></ng-container>
 <ng-container matColumnDef="observed"><th mat-header-cell *matHeaderCellDef>مشاهده</th><td mat-cell *matCellDef="let comp; let i = index">{{ report().scores?.[i] | fa }}</td></ng-container>
 <ng-container matColumnDef="gap"><th mat-header-cell *matHeaderCellDef>شکاف</th><td mat-cell *matCellDef="let comp; let i = index">
 <span class="badge" [class.amber]="reportGap(i) > 0">{{ reportGap(i) | fa }}</span></td></ng-container>
 <tr mat-header-row *matHeaderRowDef="competencyColumns"></tr><tr mat-row *matRowDef="let row; columns: competencyColumns"></tr>
 </table>
              <p class="report-note">
                نقاط رشد: {{ growth() }}. نمره ۴ یا بالاتر صرفاً شاهد رفتاری
                مثبت در داده‌های ارزیابی است.
              </p>
            </mat-card>
          </div>
          <mat-card class="panel">
            <h2>بازخورد گروهی بدون هویت ارزیاب</h2>
            <div class="table-wrap">
              <table mat-table [dataSource]="report().rows" class="royesh-table">
 <ng-container matColumnDef="group"><th mat-header-cell *matHeaderCellDef>گروه</th><td mat-cell *matCellDef="let row">{{ groupLabel(row.group) }}</td></ng-container>
 <ng-container matColumnDef="count"><th mat-header-cell *matHeaderCellDef>پاسخ</th><td mat-cell *matCellDef="let row">{{ row.count | fa }}</td></ng-container>
 @for (comp of competencies; track comp; let i = $index) {
  <ng-container [matColumnDef]="'score' + i"><th mat-header-cell *matHeaderCellDef>{{ comp }}</th><td mat-cell *matCellDef="let row">
    {{ row.scores ? (row.scores[i] | fa) : "نمونه ناکافی" }}
  </td></ng-container>
 }
 <tr mat-header-row *matHeaderRowDef="groupColumns"></tr><tr mat-row *matRowDef="let row; columns: groupColumns"></tr>
 </table>
            </div>
          </mat-card>
          @if (view === "calibration" && s.role() === "hr") {
            <mat-card class="panel">
              <h2>ثبت نظر کالیبراسیون</h2>
              <p>
                تفاوت میان گروه‌ها، شواهد رفتاری و احتمال سوگیری را بررسی کنید.
                نمره خام بدون دستکاری حفظ می‌شود.
              </p>
              <mat-form-field appearance="outline"
                ><mat-label>جمع‌بندی بازبینی</mat-label><textarea matInput
                  [(ngModel)]="notes"
                  placeholder="شواهد مرورشده و پیشنهاد بازخورد…"
                ></textarea></mat-form-field><button mat-button class="primary" (click)="calibrate()">
                تأیید کالیبراسیون و آماده‌سازی بازخورد
              </button>
            </mat-card>
          } @else {
            <mat-card class="panel">
              <h2>بازخورد و اقدام بعدی</h2>
              <p>{{ c.notes }}</p>
              <div class="actions" style="margin-top:15px">
                @if (s.editable()) {
                  <button
                    mat-button
                    class="primary"
                    (click)="createPlan(c.subjectId, c.jobId, c.id)"
                  >
                    ایجاد / مشاهده برنامه توسعه سه‌اقدامی
                  </button>
                }
                <a mat-button [routerLink]="['/people', c.subjectId]"
                  >پروفایل فرد ←</a
                >
              </div>
            </mat-card>
          }
        } @else {
          <div class="warning">
            گزارش برای نقش فعلی یا پیش از تکمیل کالیبراسیون قابل انتشار نیست.
          </div>
        }
      }
    } @else {
      <div class="empty">دوره موردنظر یافت نشد.</div>
    }`,
})
export default class Evaluations {
  s = inject(Store);
  readonly evaluatorColumns = ["evaluator","group","state","action"];
  readonly competencyColumns = ["competency","expected","observed","gap"];
  readonly groupColumns = ["group","count",...competencies.map((_, i) => "score" + i)];
  groupLabel(value: string) { return groups[value as Group] ?? "—"; }
  router = inject(Router);
  route = inject(ActivatedRoute);
  id = input<string>();
  view = this.route.snapshot.data["view"] ?? "detail";
  title = "";
  subject = "p1";
  target = this.route.snapshot.queryParamMap.get("job") ?? "j1";
  mode: 360 | 540 = 540;
  evaluator = "p2";
  group: Group = "peer";
  notes = "";
  competencies = competencies;
  groups = groups;
  groupEntries = Object.entries(groups) as [Group, string][];
  scores: number[] = [0, 0, 0, 0, 0];
  selected = signal("");
  answerCycle = "";
  anchors = [
    "به‌ندرت",
    "با کمک مستمر",
    "مستقل و قابل اتکا",
    "فراتر از انتظار",
    "الگوی دیگران",
  ];
  questions = [
    "پیام و انتظار خود را روشن و قابل فهم منتقل می‌کند.",
    "برای حل مسائل مشترک با دیگران همکاری می‌کند.",
    "علت مسئله و راه‌حل‌های جایگزین را بررسی می‌کند.",
    "مسئولیت نتیجه و پیگیری تعهدات را می‌پذیرد.",
    "به اعضای تیم بازخورد و فرصت رشد می‌دهد.",
  ];
  cycle = computed(() => this.s.cycle(this.id() ?? ""));
  report = computed(() =>
    this.cycle() ? this.s.aggregate(this.cycle()!) : { rows: [], scores: null },
  );
  evaluators = computed(() =>
    this.s
      .state()
      .people.filter((p) =>
        this.s
          .state()
          .cycles.some((c) => c.assignments.some((a) => a.personId === p.id)),
      ),
  );
  inbox = computed(() =>
    this.s
      .state()
      .cycles.filter((c) => c.status === "collecting")
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.personId === this.s.actor())
          .map((a) => ({ a, c })),
      ),
  );
  chartSeries = computed(() => {
    const c = this.cycle()!;
    const previous = this.s
      .state()
      .cycles.find(
        (x) =>
          x.subjectId === c.subjectId &&
          x.id !== c.id &&
          x.created < c.created &&
          x.status === "closed",
      );
    return [
      { name: "دوره جاری", data: this.report().scores ?? [] },
      { name: "انتظار شغل", data: this.s.job(c.jobId).expected },
      ...(previous
        ? [
            {
              name: "دوره پیشین",
              data: this.s.aggregate(previous).scores ?? [],
            },
          ]
        : []),
    ];
  });
  growth = computed(
    () =>
      competencies.filter((_, i) => this.reportGap(i) > 0).join("، ") ||
      "شکاف مثبت مشاهده نشد",
  );
  count(g: Group) {
    return this.cycle()?.assignments.filter((a) => a.group === g).length ?? 0;
  }
  answered(id: string) {
    return this.s.cycle(id)?.assignments.filter((a) => a.scores).length ?? 0;
  }
  create() {
    const id = this.s.createCycle(
      this.title,
      this.subject,
      this.target,
      this.mode,
    );
    if (id) this.router.navigate(["/evaluations", id]);
    else this.s.fail("عنوان دوره را وارد کنید.");
  }
  asEvaluator() {
    this.s.role.set("evaluator");
    this.s.actor.set(
      this.cycle()!.assignments.find((a) => !a.scores)?.personId ?? "p2",
    );
    this.router.navigateByUrl("/evaluations/inbox");
  }
  openAnswer(c: string, a: string) {
    this.answerCycle = c;
    this.selected.set(a);
    this.scores = [0, 0, 0, 0, 0];
  }
  send() {
    if (this.s.submit(this.answerCycle, this.selected(), this.scores))
      this.selected.set("");
  }
  reportGap(i: number) {
    return Math.max(
      0,
      this.s.job(this.cycle()!.jobId).expected[i] -
        (this.report().scores?.[i] ?? 0),
    );
  }
  calibrate() {
    if (this.s.advance(this.id()!, this.notes))
      this.router.navigate(["/evaluations/reports", this.id()]);
  }
  createPlan(p: string, j: string, c: string) {
    const id = this.s.createPlan(p, j, c);
    if (id) this.router.navigate(["/development/idp", id]);
  }
}
