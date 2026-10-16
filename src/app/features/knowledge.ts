import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { Knowledge as Item } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">حافظه مشترک سازمان</div>
        <h1>
          {{
            editor
              ? "ثبت دانش و درس‌آموخته"
              : id()
                ? "جزئیات محتوای دانشی"
                : "مدیریت دانش"
          }}
        </h1>
        <p>تجربه‌ها را به دانش قابل استفاده برای نقش‌های شغلی تبدیل کنید</p>
      </div>
      <div class="actions">
        @if (canWrite()) {
          <a mat-button class="secondary" routerLink="/knowledge/editor"
            >+ محتوای دانشی</a
          ><a mat-button class="primary" routerLink="/knowledge/aar"
            >+ درس‌آموخته AAR</a
          >
        }
      </div>
    </div>
    @if (editor) {
      <mat-card class="panel">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full"
            ><mat-label>عنوان</mat-label><input matInput
              [(ngModel)]="draft.title"
              placeholder="عنوان تجربه یا راهنما" /></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>نوع محتوا</mat-label><mat-select
              [(ngModel)]="draft.kind"
              (ngModelChange)="kindChanged()"
            >
              <mat-option [value]="'AAR'">AAR</mat-option>
              <mat-option [value]="'چک‌لیست'">چک‌لیست</mat-option>
              <mat-option [value]="'راهنما'">راهنما</mat-option>
              <mat-option [value]="'پرسش و پاسخ'">پرسش و پاسخ</mat-option>
              <mat-option [value]="'الگو / فرم'">الگو / فرم</mat-option>
            </mat-select></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>شغل مرتبط</mat-label><mat-select
              [(ngModel)]="draft.jobId"
              (ngModelChange)="draft.taskId = s.job(draft.jobId).tasks[0].id"
            >
              @for (j of s.state().jobs; track j.id) {
                <mat-option [value]="j.title">{{ j.title }}</mat-option>
              }
            </mat-select></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>وظیفه مرتبط</mat-label><mat-select [(ngModel)]="draft.taskId">
              @for (t of s.job(draft.jobId).tasks; track t.id) {
                <mat-option [value]="t.title">{{ t.title }}</mat-option>
              }
            </mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>کلیدواژه‌ها</mat-label><input matInput [(ngModel)]="draft.tags" /></mat-form-field><mat-form-field appearance="outline"><mat-label>صاحب محتوا</mat-label><input matInput [(ngModel)]="draft.owner" /></mat-form-field><app-date-field
             label="تاریخ بازنگری (ورودی میلادی)" [(ngModel)]="draft.revision" /><mat-form-field appearance="outline"
            ><mat-label>سطح دسترسی</mat-label><mat-select [(ngModel)]="draft.access">
              <mat-option [value]="'داخلی'">داخلی</mat-option>
              <mat-option [value]="'واحد مرتبط'">واحد مرتبط</mat-option>
            </mat-select></mat-form-field><div class="upload-field">
  <span>پیوست متنی نمایشی</span>
  <input #upload type="file" accept=".txt,.md" (change)="attach($event)" hidden />
  <button mat-stroked-button type="button" (click)="upload.click()">انتخاب پیوست متنی</button>
  <small>فقط متن تا ۵۰ کیلوبایت؛ داده ساختگی</small>
</div><mat-form-field appearance="outline" class="full"
            ><mat-label>شرح محتوا</mat-label><textarea matInput [(ngModel)]="draft.body"></textarea></mat-form-field>
        </div>
        @if (draft.aar; as a) {
          <div class="form-section">
            <h2>مرور پس از اقدام — پنج محور</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline"
                ><mat-label>۱. چه قصد داشتیم انجام دهیم؟</mat-label><textarea matInput
                  [(ngModel)]="a.intended"
                ></textarea></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>۲. چه اتفاقی افتاد؟</mat-label><textarea matInput
                  [(ngModel)]="a.actual"
                ></textarea></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>۳. چرا این اتفاق افتاد؟</mat-label><textarea matInput
                  [(ngModel)]="a.reasons"
                ></textarea></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>۴. چه باید بیاموزیم یا تغییر دهیم؟</mat-label><textarea matInput
                  [(ngModel)]="a.lessons"
                ></textarea></mat-form-field><mat-form-field appearance="outline" class="full"
                ><mat-label>۵. اقدام پیگیری چیست؟</mat-label><input matInput [(ngModel)]="a.action" /></mat-form-field><mat-form-field appearance="outline"><mat-label>مسئول اقدام</mat-label><input matInput [(ngModel)]="a.responsible" /></mat-form-field><app-date-field
                 label="مهلت اقدام" [(ngModel)]="a.due" />
            </div>
          </div>
        }
        @for (a of draft.attachments; track $index) {
          <p>
            پیوست:
            {{
              a.split(
                "
"
              )[0]
            }}
          </p>
        }
        <div class="actions">
          <button mat-button class="primary" (click)="save()">
            ذخیره پیش‌نویس</button
          ><a mat-button routerLink="/knowledge">انصراف</a>
        </div>
      </mat-card>
    } @else if (id()) {
      @if (item(); as k) {
        @if (canSee(k)) {
          <mat-card class="panel">
            <div class="panel-head">
              <span class="badge">{{ k.kind }}</span
              ><span class="badge" [class]="'badge ' + k.status">{{
                k.status | status
              }}</span>
            </div>
            <h1>{{ k.title }}</h1>
            <p style="margin:12px 0">
              {{ k.owner }} · بازنگری {{ k.revision | faDate }} ·
              {{ k.access }} · {{ k.views | fa }} مشاهده
            </p>
            <p>
              <a [routerLink]="['/jobs', k.jobId]">{{
                s.job(k.jobId).title
              }}</a>
              / {{ taskTitle(k) }}
            </p>
            <div class="section-body">
              <p>{{ k.body }}</p>
            </div>
            <div class="chips">
              @for (tag of k.tags.split("،"); track tag) {
                <span class="chip">{{ tag }}</span>
              }
            </div>
            @if (k.aar; as a) {
              <div class="grid two">
                <div class="panel">
                  <h3>قصد اولیه</h3>
                  <p>{{ a.intended }}</p>
                </div>
                <div class="panel">
                  <h3>رخداد واقعی</h3>
                  <p>{{ a.actual }}</p>
                </div>
                <div class="panel">
                  <h3>علت‌ها</h3>
                  <p>{{ a.reasons }}</p>
                </div>
                <div class="panel">
                  <h3>یادگیری و تغییر</h3>
                  <p>{{ a.lessons }}</p>
                </div>
              </div>
              <div class="info">
                <strong>{{ a.action }}</strong>
                <p>
                  مسئول: {{ a.responsible }} · مهلت: {{ a.due | faDate }} ·
                  {{ a.done ? "انجام‌شده" : "در انتظار اقدام" }}
                </p>
                @if (["hr", "manager", "owner"].includes(s.role())) {
                  <button mat-button (click)="s.completeAar(k.id)">
                    {{ a.done ? "بازگشت به پیگیری" : "ثبت انجام اقدام" }}
                  </button>
                }
              </div>
            }
            @for (a of k.attachments; track $index) {
              <details>
                <summary>
                  {{
                    a.split(
                      "
"
                    )[0]
                  }}
                </summary>
                <pre style="white-space:pre-wrap">{{ a }}</pre>
              </details>
            }
            <div class="actions">
              @if (k.status === "draft" && canWrite()) {
                <button
                  mat-button
                  class="primary"
                  (click)="s.knowledgeTransition(k.id, 'review')"
                >
                  ارسال برای بازبینی</button
                ><a
                  mat-button
                  routerLink="/knowledge/editor"
                  [queryParams]="{ edit: k.id }"
                  >ویرایش پیش‌نویس</a
                >
              }
              @if (k.status === "review" && s.canApprove()) {
                <button
                  mat-button
                  class="primary"
                  (click)="s.knowledgeTransition(k.id, 'published')"
                >
                  تأیید و انتشار دانش</button
                ><button
                  mat-button
                  (click)="s.knowledgeTransition(k.id, 'draft')"
                >
                  درخواست اصلاح
                </button>
              }
              @if (k.status === "published" && s.canApprove()) {
                <button
                  mat-button
                  (click)="s.knowledgeTransition(k.id, 'archived')"
                >
                  بایگانی محتوا
                </button>
              }
              <a mat-button routerLink="/knowledge">بازگشت به مخزن</a>
            </div>
          </mat-card>
        } @else {
          <div class="warning">
            محتوا هنوز منتشر نشده یا در محدوده نقش فعلی نیست.
          </div>
        }
      } @else {
        <div class="empty">محتوا یافت نشد.</div>
      }
    } @else {
      <div class="grid four" style="margin-bottom:22px">
        <div class="stat">
          <div class="label">دانش منتشرشده</div>
          <strong>{{ published().length | fa }}</strong
          ><small>تأییدشده و قابل استفاده</small>
        </div>
        <div class="stat">
          <div class="label">درس‌آموخته منتشرشده</div>
          <strong>{{ aarCount() | fa }}</strong
          ><small>متصل به وظیفه شغلی</small>
        </div>
        <div class="stat">
          <div class="label">در انتظار بازبینی</div>
          <strong>{{ reviewCount() | fa }}</strong
          ><small>نیازمند نظر مالک محتوا</small>
        </div>
        <div class="stat">
          <div class="label">موعد بازنگری</div>
          <strong>{{ dueCount() | fa }}</strong
          ><small>دانش منتشرشده با تاریخ گذشته</small>
        </div>
      </div>
      <mat-card class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search"
            ><mat-label>جستجوی دانش</mat-label><input matInput
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="عنوان، کلیدواژه یا وظیفه…" /></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>شغل</mat-label><mat-select [ngModel]="job()" (ngModelChange)="job.set($event)">
              <mat-option value="">همه مشاغل</mat-option>
              @for (j of s.state().jobs; track j.id) {
                <mat-option [value]="j.title">{{ j.title }}</mat-option>
              }
            </mat-select></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>وضعیت</mat-label><mat-select
              [ngModel]="status()"
              (ngModelChange)="status.set($event)"
            >
              <mat-option value="">همه</mat-option>
              <mat-option value="published">منتشرشده</mat-option>
              <mat-option value="draft">پیش‌نویس</mat-option>
              <mat-option value="review">در انتظار بازبینی</mat-option>
              <mat-option value="due">موعد بازنگری</mat-option>
            </mat-select></mat-form-field>
        </div>
      </mat-card>
      <div class="grid three">
        @for (k of filtered(); track k.id) {
          <mat-card class="panel knowledge-card">
            <div class="panel-head">
              <span class="card-kind">▤ {{ k.kind }}</span
              ><span class="badge" [class]="'badge ' + k.status">{{
                k.status | status
              }}</span>
            </div>
            <h3>
              <a [routerLink]="['/knowledge', k.id]">{{ k.title }}</a>
            </h3>
            <p>{{ k.body.slice(0, 110) }}…</p>
            <small>{{ s.job(k.jobId).title }} · {{ taskTitle(k) }}</small>
            <div class="actions">
              <a mat-button [routerLink]="['/knowledge', k.id]"
                >مطالعه و پیگیری ←</a
              ><small>{{ k.views | fa }} مشاهده</small>
            </div>
          </mat-card>
        } @empty {
          <div class="panel empty">محتوایی مطابق فیلتر یافت نشد.</div>
        }
      </div>
    }`,
})
export default class Knowledge {
  s = inject(Store);
  route = inject(ActivatedRoute);
  router = inject(Router);
  id = input<string>();
  editor = !!this.route.snapshot.data["editor"];
  search = signal("");
  job = signal(this.route.snapshot.queryParamMap.get("job") ?? "");
  status = signal("");
  draft: Item = {
    id: "",
    title: "",
    kind: this.route.snapshot.data["aar"] ? "AAR" : "راهنما",
    jobId: "j1",
    taskId: "t0-1",
    tags: "",
    owner: "آرمان راد",
    revision: "2027-03-21",
    access: "داخلی",
    body: "",
    status: "draft",
    views: 0,
    viewers: [],
    attachments: [],
  };
  item = computed(() =>
    this.s.state().knowledge.find((k) => k.id === this.id()),
  );
  published = computed(() =>
    this.s.state().knowledge.filter((k) => k.status === "published"),
  );
  aarCount = computed(
    () => this.published().filter((k) => k.kind === "AAR").length,
  );
  reviewCount = computed(
    () => this.s.state().knowledge.filter((k) => k.status === "review").length,
  );
  dueCount = computed(
    () =>
      this.published().filter(
        (k) => k.revision < new Date().toISOString().slice(0, 10),
      ).length,
  );
  filtered = computed(() =>
    this.s
      .state()
      .knowledge.filter(
        (k) =>
          this.canSee(k) &&
          (!this.job() || k.jobId === this.job()) &&
          (!this.status() ||
            (this.status() === "due"
              ? k.status === "published" &&
                k.revision < new Date().toISOString().slice(0, 10)
              : k.status === this.status())) &&
          `${k.title} ${k.body} ${k.tags} ${this.taskTitle(k)}`.includes(
            this.search(),
          ),
      ),
  );
  constructor() {
    const edit = this.route.snapshot.queryParamMap.get("edit");
    if (edit) {
      const k = this.s
        .state()
        .knowledge.find((k) => k.id === edit && k.status === "draft");
      if (k) this.draft = structuredClone(k);
    }
    this.kindChanged();
    let viewed = "";
    effect(() => {
      const id = this.id();
      if (id && id !== viewed) {
        viewed = id;
        this.s.viewKnowledge(id);
      }
    });
  }
  canWrite() {
    return ["hr", "manager", "employee"].includes(this.s.role());
  }
  canSee(k: Item) {
    return (
      ["hr", "owner", "manager"].includes(this.s.role()) ||
      (k.status === "published" &&
        (k.access === "داخلی" || this.s.job(k.jobId).unit === "دفتر پروژه‌ها"))
    );
  }
  taskTitle(k: Item) {
    return (
      this.s.job(k.jobId).tasks.find((t) => t.id === k.taskId)?.title ?? ""
    );
  }
  kindChanged() {
    if (this.draft.kind === "AAR" && !this.draft.aar)
      this.draft.aar = {
        intended: "",
        actual: "",
        reasons: "",
        lessons: "",
        action: "",
        responsible: "",
        due: "2026-12-21",
        done: false,
      };
    if (this.draft.kind !== "AAR") delete this.draft.aar;
  }
  save() {
    const id = this.s.saveKnowledge(this.draft);
    if (id) this.router.navigate(["/knowledge", id]);
  }
  async attach(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 50000 || !/\.(txt|md)$/i.test(file.name)) {
      this.s.fail("پیوست باید متن با حجم کمتر از ۵۰ کیلوبایت باشد.");
      return;
    }
    this.draft.attachments.push(file.name + "\n" + (await file.text()));
  }
}
