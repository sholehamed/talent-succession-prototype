import { Component, computed, inject, input, signal } from "@angular/core";
import { Store } from "../core/store";
import { JobContent, competencies } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template: ` @if (!id()) {
      <div class="page-header">
        <div>
          <div class="eyebrow">ساختار سازمان و مشاغل</div>
          <h1>شناسنامه‌های شغلی</h1>
          <p>معیار مشترک برای ارزیابی، رشد و تداوم سازمان</p>
        </div>
        <a mat-button class="secondary" routerLink="/career-paths"
          >مسیرهای رشد ↗</a
        >
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
          <table>
            <thead>
              <tr>
                <th>عنوان شغل</th>
                <th>خانواده / واحد</th>
                <th>نسخه</th>
                <th>وضعیت بازنگری</th>
                <th>آخرین بازنگری</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (j of filtered(); track j.id) {
                <tr>
                  <td>
                    <strong>{{ j.title }}</strong
                    ><small style="display:block">{{ j.code }}</small>
                  </td>
                  <td>
                    {{ j.family
                    }}<small style="display:block">{{ j.unit }}</small>
                  </td>
                  <td>{{ j.version | fa }}</td>
                  <td>
                    <span class="badge" [class]="'badge ' + j.review">{{
                      j.review | status
                    }}</span>
                  </td>
                  <td>{{ j.revised | faDate }}</td>
                  <td>
                    <a [routerLink]="['/jobs', j.id]">مشاهده شناسنامه ←</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">شغلی با این فیلتر یافت نشد.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else if (job(); as j) {
      <div class="page-header">
        <div>
          <div class="eyebrow">
            <a routerLink="/jobs">مشاغل</a> / {{ j.code }}
          </div>
          <h1>{{ j.title }}</h1>
          <p>{{ j.family }} · {{ j.unit }} · نسخه {{ j.version | fa }}</p>
        </div>
        <div class="actions">
          @if (s.editable() && !editing()) {
            <button mat-button class="secondary" (click)="edit()">
              ویرایش شناسنامه
            </button>
          }
          <a
            mat-button
            class="primary"
            [routerLink]="['/evaluations/cycles']"
            [queryParams]="{ job: j.id }"
            >شروع ارزیابی ←</a
          >
        </div>
      </div>
      <div class="flow-steps">
        <b><span class="step-number">۱</span>انتخاب شغل</b><span>←</span
        ><a routerLink="/evaluations/cycles">۲ ارزیابی فرد</a><span>←</span
        ><a routerLink="/people/p1">۳ تحلیل شکاف</a><span>←</span
        ><a routerLink="/development">۴ برنامه توسعه</a>
      </div>
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
        <mat-card class="panel">
          <h2>پیش‌نویس بازنگری</h2>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>عنوان</mat-label><input matInput [(ngModel)]="draft.title" /></mat-form-field><mat-form-field appearance="outline"><mat-label>مالک محتوا</mat-label><input matInput [(ngModel)]="draft.owner" /></mat-form-field><mat-form-field appearance="outline"><mat-label>خانواده</mat-label><input matInput [(ngModel)]="draft.family" /></mat-form-field><mat-form-field appearance="outline"><mat-label>سطح</mat-label><input matInput [(ngModel)]="draft.level" /></mat-form-field><mat-form-field appearance="outline" class="full"
              ><mat-label>مأموریت</mat-label><textarea matInput [(ngModel)]="draft.mission"></textarea></mat-form-field>
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
                    [(ngModel)]="draft.expected[i]"
                /></mat-form-field>
              }
            </div>
          </div>
          <div class="form-section">
            <div class="panel-head">
              <h3>وظایف خروجی‌محور</h3>
              <button mat-button (click)="addTask()">+ وظیفه</button>
            </div>
            @for (t of draft.tasks; track t.id) {
              <div class="form-grid">
                <mat-form-field appearance="outline"><mat-label>وظیفه</mat-label><input matInput [(ngModel)]="t.title" /></mat-form-field><mat-form-field appearance="outline"
                  ><mat-label>خروجی / شاخص نتیجه</mat-label><input matInput [(ngModel)]="t.output"
                /></mat-form-field>
              </div>
            }
          </div>
          <div class="form-section">
            <div class="panel-head">
              <h3>شاخص‌های عملکرد</h3>
              <button mat-button (click)="addKpi()">+ شاخص</button>
            </div>
            @for (k of draft.kpis; track $index) {
              <div class="panel form-grid">
                @for (field of kpiFields; track field.key) {
                  <mat-form-field appearance="outline"
                    ><mat-label>{{ field.label }}</mat-label><input matInput [(ngModel)]="k[field.key]"
                  /></mat-form-field>
                }
              </div>
            }
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>مهارت‌ها</mat-label><textarea matInput [(ngModel)]="draft.skills"></textarea></mat-form-field><mat-form-field appearance="outline"
              ><mat-label>شرایط احراز</mat-label><textarea matInput
                [(ngModel)]="draft.qualifications"
              ></textarea></mat-form-field><mat-form-field appearance="outline" class="full"
              ><mat-label>HSE و حقوقی</mat-label><textarea matInput [(ngModel)]="draft.hse"></textarea></mat-form-field>
          </div>
          <div class="actions">
            <button mat-button class="primary" (click)="save()">
              ذخیره پیش‌نویس</button
            ><button mat-button (click)="editing.set(false)">انصراف</button>
          </div>
        </mat-card>
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
              <table>
                <tr>
                  <th>شاخص / تعریف</th>
                  <th>فرمول</th>
                  <th>واحد / تناوب</th>
                  <th>منبع / مالک</th>
                </tr>
                @for (k of j.kpis; track k.title) {
                  <tr>
                    <td>
                      {{ k.title
                      }}<small style="display:block">{{ k.definition }}</small>
                    </td>
                    <td>{{ k.formula }}</td>
                    <td>{{ k.unit }} / {{ k.frequency }}</td>
                    <td>
                      {{ k.source
                      }}<small style="display:block">{{ k.owner }}</small>
                    </td>
                  </tr>
                }
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
    }`,
})
export default class Jobs {
  s = inject(Store);
  id = input<string>();
  search = signal("");
  unit = signal("");
  editing = signal(false);
  draft?: JobContent;
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
  job = computed(() => this.s.state().jobs.find((j) => j.id === this.id()));
  filtered = computed(() =>
    this.s
      .state()
      .jobs.filter(
        (j) =>
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
  save() {
    if (this.s.saveJob(this.id()!, this.draft!)) this.editing.set(false);
  }
}
