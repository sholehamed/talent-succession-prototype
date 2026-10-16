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
      <section class="panel">
        <div class="form-grid">
          <label class="full"
            >عنوان<input
              [(ngModel)]="draft.title"
              placeholder="عنوان تجربه یا راهنما" /></label
          ><label
            >نوع محتوا<select
              [(ngModel)]="draft.kind"
              (ngModelChange)="kindChanged()"
            >
              <option>AAR</option>
              <option>چک‌لیست</option>
              <option>راهنما</option>
              <option>پرسش و پاسخ</option>
              <option>الگو / فرم</option>
            </select></label
          ><label
            >شغل مرتبط<select
              [(ngModel)]="draft.jobId"
              (ngModelChange)="draft.taskId = s.job(draft.jobId).tasks[0].id"
            >
              @for (j of s.state().jobs; track j.id) {
                <option [value]="j.id">{{ j.title }}</option>
              }
            </select></label
          ><label
            >وظیفه مرتبط<select [(ngModel)]="draft.taskId">
              @for (t of s.job(draft.jobId).tasks; track t.id) {
                <option [value]="t.id">{{ t.title }}</option>
              }
            </select></label
          ><label>کلیدواژه‌ها<input [(ngModel)]="draft.tags" /></label
          ><label>صاحب محتوا<input [(ngModel)]="draft.owner" /></label
          ><label
            >تاریخ بازنگری (ورودی میلادی)<input
              type="date"
              [(ngModel)]="draft.revision" /></label
          ><label
            >سطح دسترسی<select [(ngModel)]="draft.access">
              <option>داخلی</option>
              <option>واحد مرتبط</option>
            </select></label
          ><label
            >پیوست متنی نمایشی<input
              type="file"
              accept=".txt,.md"
              (change)="attach($event)"
            /><small>فقط متن تا ۵۰ کیلوبایت؛ داده ساختگی</small></label
          ><label class="full"
            >شرح محتوا<textarea [(ngModel)]="draft.body"></textarea>
          </label>
        </div>
        @if (draft.aar; as a) {
          <div class="form-section">
            <h2>مرور پس از اقدام — پنج محور</h2>
            <div class="form-grid">
              <label
                >۱. چه قصد داشتیم انجام دهیم؟<textarea
                  [(ngModel)]="a.intended"
                ></textarea></label
              ><label
                >۲. چه اتفاقی افتاد؟<textarea
                  [(ngModel)]="a.actual"
                ></textarea></label
              ><label
                >۳. چرا این اتفاق افتاد؟<textarea
                  [(ngModel)]="a.reasons"
                ></textarea></label
              ><label
                >۴. چه باید بیاموزیم یا تغییر دهیم؟<textarea
                  [(ngModel)]="a.lessons"
                ></textarea></label
              ><label class="full"
                >۵. اقدام پیگیری چیست؟<input [(ngModel)]="a.action" /></label
              ><label>مسئول اقدام<input [(ngModel)]="a.responsible" /></label
              ><label
                >مهلت اقدام<input type="date" [(ngModel)]="a.due"
              /></label>
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
      </section>
    } @else if (id()) {
      @if (item(); as k) {
        @if (canSee(k)) {
          <section class="panel">
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
          </section>
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
      <section class="panel">
        <div class="filterbar">
          <label class="search"
            >جستجوی دانش<input
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="عنوان، کلیدواژه یا وظیفه…" /></label
          ><label
            >شغل<select [ngModel]="job()" (ngModelChange)="job.set($event)">
              <option value="">همه مشاغل</option>
              @for (j of s.state().jobs; track j.id) {
                <option [value]="j.id">{{ j.title }}</option>
              }
            </select></label
          ><label
            >وضعیت<select
              [ngModel]="status()"
              (ngModelChange)="status.set($event)"
            >
              <option value="">همه</option>
              <option value="published">منتشرشده</option>
              <option value="draft">پیش‌نویس</option>
              <option value="review">در انتظار بازبینی</option>
              <option value="due">موعد بازنگری</option>
            </select></label
          >
        </div>
      </section>
      <div class="grid three">
        @for (k of filtered(); track k.id) {
          <article class="panel knowledge-card">
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
          </article>
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
