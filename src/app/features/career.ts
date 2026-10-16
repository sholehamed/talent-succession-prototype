import { Component, inject } from "@angular/core";
import { Store } from "../core/store";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">رشد در سازمان</div>
        <h1>مسیرهای رشد شغلی</h1>
        <p>هر گام با معیار روشن و ارجاع به شناسنامه مقصد</p>
      </div>
    </div>
    <div class="grid two">
      @for (p of s.state().paths; track p.from + p.to) {
        <div class="panel">
          <div class="eyebrow">مسیر ارتقا · نمونه پیشنهادی</div>
          <h2>
            <a [routerLink]="['/jobs', p.from]">{{ s.job(p.from).title }}</a> ←
            <a [routerLink]="['/jobs', p.to]">{{ s.job(p.to).title }}</a>
          </h2>
          <p style="margin:15px 0">{{ p.criteria }}</p>
          <a
            mat-button
            [routerLink]="['/people/p1']"
            [queryParams]="{ job: p.to }"
            >بررسی شکاف فرد با مقصد ←</a
          >
        </div>
      }
    </div>
    @if (s.editable()) {
      <div class="panel">
        <h2>تعریف یا به‌روزرسانی مسیر</h2>
        <div class="form-grid">
          <label
            >مبدأ<select [(ngModel)]="from">
              @for (j of s.state().jobs; track j.id) {
                <option [value]="j.id">{{ j.title }}</option>
              }
            </select></label
          ><label
            >مقصد<select [(ngModel)]="to">
              @for (j of s.state().jobs; track j.id) {
                <option [value]="j.id">{{ j.title }}</option>
              }
            </select></label
          ><label class="full"
            >معیارهای ارتقا<textarea [(ngModel)]="criteria"></textarea>
          </label>
        </div>
        <button
          mat-button
          class="primary"
          (click)="s.savePath(from, to, criteria)"
        >
          ذخیره مسیر رشد
        </button>
      </div>
    }`,
})
export default class Career {
  s = inject(Store);
  from = "j7";
  to = "j1";
  criteria = "";
}
