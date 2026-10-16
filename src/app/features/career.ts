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
          <div class="eyebrow">مسیر ارتقای شغلی</div>
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
          <mat-form-field appearance="outline"
            ><mat-label>مبدأ</mat-label><mat-select [(ngModel)]="from">
              @for (j of s.state().jobs; track j.id) {
                <mat-option [value]="j.id">{{ j.title }}</mat-option>
              }
            </mat-select></mat-form-field><mat-form-field appearance="outline"
            ><mat-label>مقصد</mat-label><mat-select [(ngModel)]="to">
              @for (j of s.state().jobs; track j.id) {
                <mat-option [value]="j.id">{{ j.title }}</mat-option>
              }
            </mat-select></mat-form-field><mat-form-field appearance="outline" class="full"
            ><mat-label>معیارهای ارتقا</mat-label><textarea matInput [(ngModel)]="criteria"></textarea></mat-form-field>
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
