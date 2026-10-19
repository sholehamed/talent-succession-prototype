import { Component, computed, inject, input, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { JobContent, competencies } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template: ` @if (creating()) {
      <div class="page-header">
        <div>
          <div class="eyebrow"><a routerLink="/jobs">شناسنامه‌های شغلی</a> / شغل جدید</div>
          <h1>ایجاد شناسنامه شغلی</h1>
          <p>ثبت اطلاعات پایه، سطوح شایستگی، وظایف و شاخص‌های عملکرد</p>
        </div>
        <a mat-button class="secondary" routerLink="/jobs">بازگشت به مشاغل ←</a>
      </div>
      <div class="info">شناسنامه ابتدا در وضعیت پیش‌نویس ثبت می‌شود؛ پس از بررسی و تأیید مالک خانواده شغلی منتشر خواهد شد و در انتخابگرهای استخدام، ارزیابی و مسیر رشد قابل استفاده است.</div>
      <ng-container *ngTemplateOutlet="jobEditor"></ng-container>
    } @else if (!id()) {
      <div class="page-header">
        <div>
          <div class="eyebrow">ساختار سازمان و مشاغل</div>
          <h1>شناسنامه‌های شغلی</h1>
          <p>معیار مشترک برای ارزیابی، رشد و تداوم سازمان</p>
        </div>
        <div class="actions">
          @if (s.editable()) {
            <a mat-button class="primary" routerLink="/jobs/new">+ شناسنامه شغلی جدید</a>
          }
          <a mat-button class="secondary" routerLink="/career-paths">مسیرهای رشد ↗</a>
        </div>
      </div>
      <div class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search"
            ><mat-label>جستجوی شغل</mat-label><input matInput
              placeholder="عنوان یا کد شغل…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)" /></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>واحد سازمانی</mat-label><mat-select
              [ngModel]="unit()"
              (ngModelChange)="unit.set($event)"
            >
              <mat-option value="">همه واحدها</mat-option>
              @for (u of s.units(); track u) {
                <mat-option [value]="u">{{ u }}</mat-option>
              }
            </mat-select></mat-form-field>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="royesh-table">
 <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>عنوان شغل</th><td mat-cell *matCellDef="let j"><strong>{{ j.title }}</strong><small style="display:block">{{ j.code }}</small></td></ng-container>
 <ng-container matColumnDef="family"><th mat-header-cell *matHeaderCellDef>خانواده / واحد</th><td mat-cell *matCellDef="let j">{{ j.family }}<small style="display:block">{{ j.unit }}</small></td></ng-container>
 <ng-container matColumnDef="version"><th mat-header-cell *matHeaderCellDef>نسخه</th><td mat-cell *matCellDef="let j">{{ j.version | fa }}</td></ng-container>
 <ng-container matColumnDef="review"><th mat-header-cell *matHeaderCellDef>وضعیت بازنگری</th><td mat-cell *matCellDef="let j"><span class="badge" [class]="'badge ' + j.review">{{ j.review | status }}</span></td></ng-container>
 <ng-container matColumnDef="revised"><th mat-header-cell *matHeaderCellDef>آخرین بازنگری</th><td mat-cell *matCellDef="let j">{{ j.revised | faDate }}</td></ng-container>
 <ng-container matColumnDef="link"><th mat-header-cell *matHeaderCellDef>جزئیات</th><td mat-cell *matCellDef="let j"><a mat-button [routerLink]="['/jobs', j.id]">مشاهده شناسنامه ←</a></td></ng-container>
 <tr mat-header-row *matHeaderRowDef="jobColumns"></tr><tr mat-row *matRowDef="let row; columns: jobColumns"></tr>
 </table>
 @if (!filtered().length) { <div class="empty">شغلی با این فیلتر یافت نشد.</div> }
        </div>
      </div>
    } @else if (job(); as j) {
      <div class="page-header">
        <div>
          <div class="eyebrow">
            <a routerLink="/jobs">مشاغل</a> / {{ j.code }}
          </div>
          <h1>{{ j.title }}</h1>
          <p>{{ j.family }} · {{ j.unit }} · {{ j.version ? "نسخه " + j.version : "پیش‌نویس اولیه" }}</p>
        </div>
        <div class="actions">
          @if (s.editable() && !editing()) {
            <button mat-button class="secondary" (click)="edit()">
              ویرایش شناسنامه
            </button>
          }
          @if (j.version > 0 && s.role() === "hr") {
          <a
            mat-button
            class="primary"
            [routerLink]="['/evaluations/cycles']"
            [queryParams]="{ job: j.id }"
            >شروع ارزیابی ←</a
          >
          }
        </div>
      </div>
      @if (j.version > 0) {
      <div class="actions" style="margin-bottom:22px">
        <a mat-stroked-button routerLink="/evaluations/cycles" [queryParams]="{ job: j.id }">
          دوره‌های ارزیابی این شغل
        </a>
        <a mat-stroked-button routerLink="/people" [queryParams]="{ job: j.id }">
          افراد و تحلیل شکاف
        </a>
        <a mat-stroked-button routerLink="/development" [queryParams]="{ job: j.id }">
          برنامه‌های توسعه این شغل
        </a>
      </div>
      } @else {
        <div class="warning">این شناسنامه هنوز منتشر نشده است؛ تا تأیید مالک، در چرخه‌های عملیاتی استفاده نمی‌شود.</div>
      }
      @if (s.canReport()) {
        <mat-card class="panel" style="margin-bottom:22px">
          <div class="panel-head">
            <div>
              <h2>افراد مرتبط با شغل</h2>
              <small>شاغلان، افراد مسیر رشد و نامزدهای جانشینی این شغل</small>
            </div>
            <a mat-button [routerLink]="['/people']" [queryParams]="{ job: j.id }">
              مشاهده همه افراد مرتبط ←
            </a>
          </div>
          @for (person of relatedPeople().slice(0, 5); track person.id) {
            <div class="metric-line">
              <div class="grow">
                <strong>{{ person.name }}</strong>
                <small>{{ s.job(person.jobId).title }} · {{ person.unit }}</small>
              </div>
              <a [routerLink]="['/people', person.id]" [queryParams]="{ job: j.id }">
                تحلیل شکاف ←
              </a>
              @if (s.role() === "hr") {
                <a [routerLink]="['/evaluations/cycles']"
                  [queryParams]="{ job: j.id, person: person.id }">
                  ارزیابی ←
                </a>
              }
            </div>
          } @empty {
            <div class="empty">فرد مرتبطی برای این شغل یافت نشد.</div>
          }
        </mat-card>
      }
      @if (j.draft) {
        <div class="warning">
          نسخه منتشرشده تا تأیید مالک ثابت می‌ماند. وضعیت پیش‌نویس:
          {{ j.review | status }}
          <div class="actions">
            @if (
              s.editable() && (j.review === "draft" || j.review === "rejected")
            ) {
              <button mat-button (click)="s.reviewJob(j.id, 'submit')">
                ارسال برای تأیید
              </button>
            }
            @if (s.canApprove() && j.review === "review") {
              <button
                mat-button
                class="primary"
                (click)="s.reviewJob(j.id, 'approve')"
              >
                تأیید و انتشار نسخه</button
              ><button mat-button (click)="s.reviewJob(j.id, 'reject')">
                بازگشت برای اصلاح
              </button>
            }
          </div>
          @if (s.canApprove()) {
            <p>
              تغییر پیشنهادی: {{ j.draft.title }} · سطوح شایستگی:
              {{ j.draft.expected.join(" / ") | fa }}
            </p>
            <p>{{ j.draft.mission }}</p>
            <details><summary>مشاهده همه جزئیات پیش‌نویس برای بازبینی</summary>
              <p>{{j.draft.family}} · {{j.draft.unit}} · {{j.draft.level}} · {{j.draft.owner}}</p>
              @for(t of j.draft.tasks; track t.id){<p><strong>{{t.title}}</strong> — {{t.output}}</p>}
              @for(k of j.draft.kpis; track $index){<p><strong>{{k.title}}</strong> — {{k.definition}} · {{k.formula}} · {{k.unit}} · {{k.frequency}} · {{k.source}} · {{k.owner}}</p>}
              <p>{{j.draft.skills}}</p><p>{{j.draft.qualifications}}</p><p>{{j.draft.hse}}</p>
            </details>
          }
        </div>
      }
      @if (editing() && draft) {
        <ng-container *ngTemplateOutlet="jobEditor"></ng-container>
      }
      <div class="panel">
        <mat-tab-group
          ><mat-tab label="اطلاعات پایه"
            ><div class="section-body grid two">
              <div>
                <h3>کد و عنوان</h3>
                <p>{{ j.code }} · {{ j.title }}</p>
                <h3>خانواده / واحد</h3>
                <p>{{ j.family }} / {{ j.unit }}</p>
              </div>
              <div>
                <h3>سطح شغلی</h3>
                <p>{{ j.level }}</p>
                <h3>مالک محتوا</h3>
                <p>{{ j.owner }}</p>
              </div>
            </div></mat-tab
          ><mat-tab label="مأموریت"
            ><div class="section-body">
              <p>{{ j.mission }}</p>
            </div></mat-tab
          ><mat-tab label="وظایف"
            ><div class="section-body">
              @for (t of j.tasks; track t.id) {
                <div class="metric-line">
                  <div>
                    <h3>{{ t.title }}</h3>
                    <p>{{ t.output }}</p>
                  </div>
                </div>
              }
            </div></mat-tab
          ><mat-tab label="KPI"
            ><div class="section-body table-wrap">
              <table mat-table [dataSource]="j.kpis" class="royesh-table">
 <ng-container matColumnDef="metric"><th mat-header-cell *matHeaderCellDef>شاخص / تعریف</th><td mat-cell *matCellDef="let k">{{ k.title }}<small style="display:block">{{ k.definition }}</small></td></ng-container>
 <ng-container matColumnDef="formula"><th mat-header-cell *matHeaderCellDef>فرمول</th><td mat-cell *matCellDef="let k">{{ k.formula }}</td></ng-container>
 <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>واحد / تناوب</th><td mat-cell *matCellDef="let k">{{ k.unit }} / {{ k.frequency }}</td></ng-container>
 <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>منبع / مالک</th><td mat-cell *matCellDef="let k">{{ k.source }}<small style="display:block">{{ k.owner }}</small></td></ng-container>
 <tr mat-header-row *matHeaderRowDef="kpiColumns"></tr><tr mat-row *matRowDef="let row; columns: kpiColumns"></tr>
 </table>
            </div></mat-tab
          ><mat-tab label="شایستگی‌ها"
            ><div class="section-body">
              @for (c of competencies; track c; let i = $index) {
                <div class="metric-line">
                  <div class="grow">
                    <strong>{{ c }}</strong
                    ><small
                      >نمونه رفتار: عملکرد مستقل و انتقال تجربه به تیم</small
                    >
                  </div>
                  <span>{{ j.expected[i] | fa }} از ۵</span>
                  <div class="bar" style="width:120px">
                    <span [style.width.%]="j.expected[i] * 20"></span>
                  </div>
                </div>
              }</div></mat-tab
          ><mat-tab label="مهارت‌ها"
            ><div class="section-body">{{ j.skills }}</div></mat-tab
          ><mat-tab label="شرایط احراز"
            ><div class="section-body">{{ j.qualifications }}</div></mat-tab
          ><mat-tab label="HSE و حقوقی"
            ><div class="section-body">{{ j.hse }}</div></mat-tab
          ><mat-tab label="مسیر رشد"
            ><div class="section-body">
              @for (p of paths(); track p.from + p.to) {
                <p>
                  <a [routerLink]="['/jobs', p.from]">{{
                    s.job(p.from).title
                  }}</a>
                  ←
                  <a [routerLink]="['/jobs', p.to]">{{ s.job(p.to).title }}</a>
                </p>
                <p>{{ p.criteria }}</p>
              } @empty {
                <p>مسیر مرتبط ثبت نشده است.</p>
              }
              <a routerLink="/career-paths">مدیریت مسیرها ←</a>
            </div></mat-tab
          ><mat-tab label="جانشینی"
            ><div class="section-body">
              <a routerLink="/talent/succession" [queryParams]="{ job: j.id }"
                >مشاهده نامزدها، شکاف و برنامه توسعه ←</a
              >
            </div></mat-tab
          ><mat-tab label="نسخه‌ها"
            ><div class="section-body">
              @for (v of j.history; track v.version) {
                <div class="metric-line">
                  نسخه {{ v.version | fa }} · {{ v.at | faDate }} ·
                  {{ v.summary }}
                </div>
              }
            </div></mat-tab
          ></mat-tab-group
        >
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>دانش مرتبط با وظایف این شغل</h2>
          <a routerLink="/knowledge" [queryParams]="{ job: j.id }"
            >مشاهده مخزن ←</a
          >
        </div>
        @for (k of knowledge(); track k.id) {
          <div class="metric-line">
            <span class="badge">{{ k.kind }}</span
            ><a [routerLink]="['/knowledge', k.id]">{{ k.title }}</a>
          </div>
        } @empty {
          <p>هنوز محتوای منتشرشده‌ای وجود ندارد.</p>
        }
      </div>
    } @else {
      <div class="empty">
        شغل یافت نشد. <a routerLink="/jobs">بازگشت به مشاغل</a>
      </div>
    }
    <ng-template #jobEditor>
      @if (draft; as form) {
        <mat-card class="panel">
          <h2>{{ creating() ? "ثبت شناسنامه شغلی جدید" : "پیش‌نویس بازنگری" }}</h2>
          @if (creating()) {
            <mat-form-field appearance="outline" style="width:100%"><mat-label>کد یکتای شغل</mat-label>
              <input matInput [ngModel]="newCode()" (ngModelChange)="newCode.set($event)" placeholder="JOB-201" />
            </mat-form-field>
          }
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>عنوان</mat-label><input matInput [(ngModel)]="form.title" /></mat-form-field><mat-form-field appearance="outline"><mat-label>مالک محتوا</mat-label><input matInput [(ngModel)]="form.owner" /></mat-form-field><mat-form-field appearance="outline"><mat-label>واحد سازمانی</mat-label><input matInput [(ngModel)]="form.unit" /></mat-form-field><mat-form-field appearance="outline"><mat-label>خانواده</mat-label><input matInput [(ngModel)]="form.family" /></mat-form-field><mat-form-field appearance="outline"><mat-label>سطح</mat-label><input matInput [(ngModel)]="form.level" /></mat-form-field><mat-form-field appearance="outline" class="full"
              ><mat-label>مأموریت</mat-label><textarea matInput [(ngModel)]="form.mission"></textarea></mat-form-field>
          </div>
          <div class="form-section">
            <h3>شایستگی‌ها — سطح ۱ تا ۵</h3>
            <div class="grid three">
              @for (c of competencies; track c; let i = $index) {
                <mat-form-field appearance="outline"
                  ><mat-label>{{ c
                  }}</mat-label><input matInput
                    type="number"
                    min="1"
                    max="5"
                    [(ngModel)]="form.expected[i]"
                /></mat-form-field>
              }
            </div>
          </div>
          <div class="form-section">
            <div class="panel-head">
              <h3>وظایف خروجی‌محور</h3>
              <button mat-button (click)="addTask()">+ وظیفه</button>
            </div>
            @for (t of form.tasks; track t.id) {
              <div class="form-grid">
                <mat-form-field appearance="outline"><mat-label>وظیفه</mat-label><input matInput [(ngModel)]="t.title" /></mat-form-field><mat-form-field appearance="outline"
                  ><mat-label>خروجی / شاخص نتیجه</mat-label><input matInput [(ngModel)]="t.output"
                /></mat-form-field>
                <button mat-button type="button" (click)="removeTask(t.id)">حذف وظیفه</button>
              </div>
            }
          </div>
          <div class="form-section">
            <div class="panel-head">
              <h3>شاخص‌های عملکرد</h3>
              <button mat-button (click)="addKpi()">+ شاخص</button>
            </div>
            @for (k of form.kpis; track $index; let i = $index) {
              <div class="panel form-grid">
                @for (field of kpiFields; track field.key) {
                  <mat-form-field appearance="outline"
                    ><mat-label>{{ field.label }}</mat-label><input matInput [(ngModel)]="k[field.key]"
                  /></mat-form-field>
                }
                <button mat-button type="button" (click)="removeKpi(i)">حذف شاخص</button>
              </div>
            }
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>مهارت‌ها</mat-label><textarea matInput [(ngModel)]="form.skills"></textarea></mat-form-field><mat-form-field appearance="outline"
              ><mat-label>شرایط احراز</mat-label><textarea matInput
                [(ngModel)]="form.qualifications"
              ></textarea></mat-form-field><mat-form-field appearance="outline" class="full"
              ><mat-label>HSE و حقوقی</mat-label><textarea matInput [(ngModel)]="form.hse"></textarea></mat-form-field>
          </div>
          <div class="actions">
            <button mat-button class="primary" (click)="save()">
              {{ creating() ? "ثبت شناسنامه و ایجاد پیش‌نویس" : "ذخیره پیش‌نویس" }}</button
            ><button mat-button (click)="cancel()">{{ creating() ? "بازگشت به مشاغل" : "انصراف" }}</button>
          </div>
        </mat-card>
      }
    </ng-template>`,
})
export default class Jobs {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly creating = () => this.route.snapshot.routeConfig?.path === "jobs/new";
  readonly newCode = signal("");

  s = inject(Store);
  readonly jobColumns = ["title","family","version","review","revised","link"];
  readonly kpiColumns = ["metric","formula","unit","source"];
  id = input<string>();
  search = signal("");
  unit = signal("");
  editing = signal(false);
  draft?: JobContent = this.creating() ? {
    title: "", family: "", unit: this.s.role() === "manager" ? this.s.currentPerson()?.unit ?? "" : "",
    level: "", mission: "", owner: "",
    tasks: [], kpis: [], expected: [3,3,3,3,3], skills: "", qualifications: "", hse: "",
  } : undefined;
  competencies = competencies;
  kpiFields: { key: keyof JobContent["kpis"][number]; label: string }[] = [
    { key: "title", label: "عنوان" },
    { key: "definition", label: "تعریف عملیاتی" },
    { key: "formula", label: "فرمول" },
    { key: "unit", label: "واحد سنجش" },
    { key: "frequency", label: "تناوب" },
    { key: "source", label: "منبع داده مرجع" },
    { key: "owner", label: "مالک شاخص" },
  ];
  job = computed(() => this.s.state().jobs.find((j) =>
    j.id === this.id() && (this.s.role() !== "manager" || j.unit === this.s.currentPerson()?.unit)));
  relatedPeople = computed(() => this.s.relatedPeople(this.id() ?? ""));
  filtered = computed(() =>
    this.s
      .state()
      .jobs.filter(
        (j) =>
          (this.s.role() !== "manager" || j.unit === this.s.currentPerson()?.unit) &&
          (!this.unit() || j.unit === this.unit()) &&
          `${j.title} ${j.code}`.includes(this.search()),
      ),
  );
  paths = computed(() =>
    this.s
      .state()
      .paths.filter((p) => p.from === this.id() || p.to === this.id()),
  );
  knowledge = computed(() =>
    this.s
      .state()
      .knowledge.filter(
        (k) => k.jobId === this.id() && k.status === "published",
      ),
  );
  edit() {
    const j = this.job()!;
    this.draft = structuredClone(
      j.draft ?? {
        title: j.title,
        family: j.family,
        unit: j.unit,
        level: j.level,
        mission: j.mission,
        tasks: j.tasks,
        kpis: j.kpis,
        expected: j.expected,
        skills: j.skills,
        qualifications: j.qualifications,
        hse: j.hse,
        owner: j.owner,
      },
    );
    this.editing.set(true);
  }
  addTask() {
    this.draft!.tasks.push({ id: crypto.randomUUID(), title: "", output: "" });
  }
  removeTask(id: string) {
    if (this.draft) this.draft.tasks = this.draft.tasks.filter((t) => t.id !== id);
  }
  removeKpi(index: number) {
    this.draft?.kpis.splice(index, 1);
  }
    addKpi() {
    this.draft!.kpis.push({
      title: "",
      definition: "",
      formula: "",
      unit: "",
      frequency: "",
      source: "",
      owner: "",
    });
  }
  cancel() {
    if (this.creating()) this.router.navigateByUrl("/jobs");
    else this.editing.set(false);
  }
  save() {
    if (!this.draft) return;
    if (this.creating()) {
      const id = this.s.createJob(this.newCode(), this.draft);
      if (id) this.router.navigate(["/jobs", id]);
    } else if (this.s.saveJob(this.id()!, this.draft)) {
      this.editing.set(false);
    }
  }
}
