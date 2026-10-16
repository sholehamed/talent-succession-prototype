import { Component, computed, inject, input, signal } from "@angular/core";
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
        </div>
        <span class="badge">{{ filtered().length | fa }} فرد ساختگی</span>
      </div>
      <div class="panel">
        <div class="filterbar">
          <label class="search"
            >جستجو<input
              [ngModel]="search()"
              (ngModelChange)="search.set($event); page.set(0)"
              placeholder="نام یا کد پرسنلی…" /></label
          ><label
            >واحد<select
              [ngModel]="unit()"
              (ngModelChange)="unit.set($event); page.set(0)"
            >
              <option value="">همه واحدها</option>
              @for (u of s.units(); track u) {
                <option>{{ u }}</option>
              }
            </select></label
          >
        </div>
        <div class="table-wrap">
          <table>
            <tr>
              <th>نام و کد</th>
              <th>شغل فعلی</th>
              <th>واحد</th>
              <th>عملکرد / پتانسیل</th>
              <th>پیشرفت توسعه</th>
              <th></th>
            </tr>
            @for (p of paged(); track p.id) {
              <tr>
                <td>
                  <div class="person-cell">
                    <span class="avatar">{{ p.name.slice(0, 1) }}</span>
                    <div>
                      <strong>{{ p.name }}</strong
                      ><small>{{ p.code }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ s.job(p.jobId).title }}</td>
                <td>{{ p.unit }}</td>
                <td>{{ bands[p.performance] }} / {{ bands[p.potential] }}</td>
                <td>{{ personProgress(p.id) | fa }}٪</td>
                <td><a [routerLink]="['/people', p.id]">پروفایل ←</a></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty">فردی یافت نشد.</td>
              </tr>
            }
          </table>
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
          <a mat-button class="secondary" routerLink="/people">فهرست افراد</a>
        </div>
        <div class="grid four" style="margin-bottom:22px">
          <div class="stat">
            <span class="label">عملکرد فعلی</span
            ><strong style="font-size:23px">{{ bands[p.performance] }}</strong
            ><small>منبع: سابقه عملکرد ساختگی</small>
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
            <label style="min-width:210px"
              >شغل هدف<select
                [ngModel]="target()"
                (ngModelChange)="target.set($event)"
              >
                @for (j of s.state().jobs; track j.id) {
                  <option [value]="j.id">{{ j.title }}</option>
                }
              </select></label
            >
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
              <table>
                <tr>
                  <th>شایستگی</th>
                  <th>سطح فرد</th>
                  <th>هدف</th>
                  <th>شکاف</th>
                </tr>
                @for (comp of competencies; track comp; let i = $index) {
                  <tr>
                    <td>{{ comp }}</td>
                    <td>{{ s.scores(p.id)[i] | fa }}</td>
                    <td>{{ s.job(target()).expected[i] | fa }}</td>
                    <td>{{ s.gaps(p.id, target())[i] | fa }}</td>
                  </tr>
                }
              </table>
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
          <section class="panel">
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
          </section>
          <section class="panel">
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
          </section>
        </div>
      } @else {
        <div class="warning">این پروفایل در محدوده نقش نمایشی شما نیست.</div>
      }
    } @else {
      <div class="empty">فرد موردنظر یافت نشد.</div>
    }`,
})
export default class People {
  s = inject(Store);
  router = inject(Router);
  route = inject(ActivatedRoute);
  id = input<string>();
  search = signal("");
  unit = signal("");
  page = signal(0);
  target = signal(this.route.snapshot.queryParamMap.get("job") ?? "j1");
  competencies = competencies;
  bands = bands;
  inc = (n: number) => n + 1;
  dec = (n: number) => n - 1;
  person = computed(() =>
    this.s.state().people.find((p) => p.id === this.id()),
  );
  filtered = computed(() =>
    this.s
      .state()
      .people.filter(
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
