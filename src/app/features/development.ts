import { Component, computed, inject, input, signal } from "@angular/core";
import { Store } from "../core/store";
import { Action, competencies } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
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
      <div class="panel">
        <div class="filterbar">
          <label class="search"
            >جستجوی فرد<input
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="نام فرد…"
          /></label>
        </div>
        <div class="table-wrap">
          <table>
            <tr>
              <th>فرد</th>
              <th>شغل هدف</th>
              <th>اقدام‌ها</th>
              <th>پیشرفت</th>
              <th></th>
            </tr>
            @for (p of plans(); track p.id) {
              <tr>
                <td>{{ s.person(p.personId).name }}</td>
                <td>{{ s.job(p.jobId).title }}</td>
                <td>{{ p.actions.length | fa }}</td>
                <td>
                  <div class="progress-cell">
                    <span>{{ s.progress(p) | fa }}٪</span>
                    <div class="bar">
                      <span [style.width.%]="s.progress(p)"></span>
                    </div>
                  </div>
                </td>
                <td>
                  <a [routerLink]="['/development/idp', p.id]"
                    >پیگیری برنامه ←</a
                  >
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">
                  برنامه‌ای یافت نشد؛ از پروفایل فرد یا گزارش ارزیابی یک برنامه
                  ایجاد کنید.
                </td>
              </tr>
            }
          </table>
        </div>
      </div>
    } @else if (plan(); as p) {
      @if (s.allowedPerson(p.personId)) {
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>
                {{ s.person(p.personId).name }} ← {{ s.job(p.jobId).title }}
              </h2>
              <small
                >مدیر مستقیم:
                {{ s.person(s.person(p.personId).managerId).name }} · ۳ اقدام
                اولیه بر اساس بیشترین شکاف‌ها</small
              >
            </div>
            <strong>{{ s.progress(p) | fa }}٪</strong>
          </div>
          <mat-progress-bar [value]="s.progress(p)" />
          <div class="actions" style="margin-top:15px">
            <a [routerLink]="['/people', p.personId]">پروفایل و تحلیل شکاف ←</a>
            @if (p.cycleId) {
              <a [routerLink]="['/evaluations/reports', p.cycleId]"
                >گزارش ارزیابی ←</a
              >
            }
          </div>
        </section>
        <div class="grid three">
          @for (a of p.actions; track a.id; let i = $index) {
            <section class="panel">
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
              @if (s.editable() || s.role() === "employee") {
                <button mat-button class="secondary" (click)="edit(a)">
                  ویرایش و پیگیری
                </button>
              }
            </section>
          }
        </div>
        @if (draft) {
          <section class="panel">
            <h2>پیگیری اقدام</h2>
            <div class="form-grid">
              <label>عنوان اقدام<input [(ngModel)]="draft.title" /></label
              ><label>مسئول<input [(ngModel)]="draft.owner" /></label
              ><label
                >مهلت (انتخاب تاریخ میلادی؛ نمایش شمسی)<input
                  type="date"
                  [(ngModel)]="draft.due" /></label
              ><label
                >وضعیت<select [(ngModel)]="draft.status">
                  @for (st of statuses; track st) {
                    <option [value]="st">{{ st | status }}</option>
                  }
                </select></label
              ><label class="full"
                >شاخص موفقیت<textarea [(ngModel)]="draft.indicator"></textarea>
              </label>
            </div>
            <div class="actions">
              <button mat-button class="primary" (click)="save()">
                ذخیره اقدام</button
              ><button mat-button (click)="draft = undefined">انصراف</button>
            </div>
          </section>
        }
        <div class="info">
          درصد پیشرفت از تعداد اقدام‌های انجام‌شده محاسبه می‌شود؛ تکمیل فعالیت
          به‌تنهایی اثبات افزایش شایستگی یا آمادگی انتصاب نیست.
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
  id = input<string>();
  search = signal("");
  draft?: Action;
  competencies = competencies;
  statuses = ["planned", "progress", "completed", "blocked", "cancelled"];
  plan = computed(() => this.s.state().plans.find((p) => p.id === this.id()));
  plans = computed(() =>
    this.s
      .state()
      .plans.filter(
        (p) =>
          this.s.allowedPerson(p.personId) &&
          this.s.person(p.personId).name.includes(this.search()),
      ),
  );
  edit(a: Action) {
    this.draft = structuredClone(a);
  }
  save() {
    if (this.s.saveAction(this.id()!, this.draft!)) this.draft = undefined;
  }
}
