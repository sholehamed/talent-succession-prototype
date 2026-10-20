import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { EntryEvaluatorGroup } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">منابع انسانی · ارزیابی بدو استخدام</div>
        <h1>گروه‌های ارزیاب تخصصی</h1>
        <p>هر گروه را یک‌بار با اعضای ارزیاب و چند شغل منتشرشده تعریف کنید؛ سپس در پرونده داوطلب فقط گروه را ارجاع دهید.</p>
      </div>
      <a mat-button class="secondary" routerLink="/hiring/questions">بانک پرسش‌ها ←</a>
    </div>
    <div class="info">
      پس از ارجاع، اعضا و پرسش‌ها در پرونده ثبت می‌شوند؛ تغییر یا غیرفعال‌سازی گروه، تکلیف‌های قبلی را تغییر نمی‌دهد.
      همه اعضای گروه جداگانه پاسخ می‌دهند و نتیجه تخصصی پس از تکمیل همه آن‌ها محاسبه می‌شود.
    </div>
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head">
          <h2>گروه‌های تعریف‌شده</h2>
          <button mat-button class="secondary" (click)="reset()">گروه جدید</button>
        </div>
        @for (g of groups(); track g.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ g.name }}</strong>
              <small>{{ g.jobIds.length | fa }} شغل · {{ g.memberIds.length | fa }} ارزیاب · {{ g.isActive ? 'فعال' : 'غیرفعال' }}</small>
              <small>{{ jobNames(g) }}</small>
            </div>
            <button mat-button (click)="edit(g)">ویرایش</button>
          </div>
        } @empty { <div class="empty">گروه ارزیابی تخصصی تعریف نشده است.</div> }
      </mat-card>
      <mat-card class="panel">
        <h2>{{ id() ? 'ویرایش گروه تخصصی' : 'تعریف گروه تخصصی' }}</h2>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>نام گروه</mat-label>
          <input matInput [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شغل‌های تحت پوشش گروه</mat-label>
          <mat-select multiple [ngModel]="jobIds()" (ngModelChange)="jobIds.set($event)">
            @for (j of s.publishedJobs(); track j.id) {
              <mat-option [value]="j.id">{{ j.title }} · {{ j.unit }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>اعضای گروه ارزیاب</mat-label>
          <mat-select multiple [ngModel]="memberIds()" (ngModelChange)="memberIds.set($event)">
            @for (p of s.state().people; track p.id) {
              <mat-option [value]="p.id">{{ p.name }} · {{ p.code }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-checkbox [ngModel]="active()" (ngModelChange)="active.set($event)">گروه فعال باشد</mat-checkbox>
        <div class="actions"><button mat-button class="primary" (click)="save()">ذخیره گروه</button></div>
      </mat-card>
    </div>
  `,
})
export default class EntryEvaluatorGroupsPage {
  readonly s = inject(Store);
  readonly groups = computed(() => this.s.state().entryEvaluatorGroups);
  readonly id = signal("");
  readonly name = signal("");
  readonly jobIds = signal<string[]>([]);
  readonly memberIds = signal<string[]>([]);
  readonly active = signal(true);
  jobNames(group: EntryEvaluatorGroup) {
    return group.jobIds.map(id => this.s.state().jobs.find(j => j.id === id)?.title ?? id).join("، ");
  }
  reset() {
    this.id.set(""); this.name.set(""); this.jobIds.set([]);
    this.memberIds.set([]); this.active.set(true);
  }
  edit(group: EntryEvaluatorGroup) {
    this.id.set(group.id); this.name.set(group.name);
    this.jobIds.set([...group.jobIds]); this.memberIds.set([...group.memberIds]);
    this.active.set(group.isActive);
  }
  save() {
    if (this.s.saveEntryEvaluatorGroup({
      id: this.id(), name: this.name(), jobIds: this.jobIds(),
      memberIds: this.memberIds(), isActive: this.active(),
    })) this.reset();
  }
}
