import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { Action } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    <div class="page-header">
      <div><div class="eyebrow">فضای کارمند</div><h1>اقدام‌های من</h1>
        <p>اقدام‌هایی که مسئول اجرای آن‌ها هستید؛ از برنامه‌های توسعه مرتبط.</p>
      </div>
      <a mat-button class="secondary" [routerLink]="['/people', s.actor()]">پروفایل من ←</a>
    </div>
    <div class="grid three" style="margin-bottom:20px">
      <div class="stat"><span class="label">تخصیص‌یافته</span><strong>{{ assigned().length | fa }}</strong></div>
      <div class="stat"><span class="label">انجام‌شده</span><strong>{{ completed() | fa }}</strong></div>
      <div class="stat"><span class="label">در انتظار اقدام</span><strong>{{ pending() | fa }}</strong></div>
    </div>
    <div class="grid two">
      @for (item of assigned(); track item.action.id) {
        <mat-card class="panel">
          <div class="panel-head">
            <div><small>{{ item.action.kind }} · {{ item.plan.period }}</small>
              <h2>{{ item.action.title }}</h2></div>
            <span class="badge" [class]="'badge ' + item.action.status">{{ item.action.status | status }}</span>
          </div>
          <p>شایستگی: {{ competency(item.action.competency) }}</p>
          <div class="metric-line"><span>مهلت</span><strong>{{ item.action.due | faDate }}</strong></div>
          <p>شاخص موفقیت: {{ item.action.indicator }}</p>
          <p>شواهد اجرا: {{ item.action.evidence || "هنوز ثبت نشده است" }}</p>
          @if (item.plan.personId === s.actor()) {
            <a [routerLink]="['/development/idp',item.plan.id]">برنامه توسعه من ←</a>
          }
          @if (s.isCurrentPlan(item.plan) && !item.action.effectiveness) {
            <div class="actions"><button mat-button class="primary" (click)="edit(item.action)">
              ثبت پیشرفت و شواهد
            </button></div>
          } @else {
            <div class="info">این اقدام در نسخه پیشین است یا نظر اثربخشی آن ثبت شده است.</div>
          }
          @if (draftId() === item.action.id) {
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>وضعیت اقدام</mat-label>
              <mat-select [ngModel]="draftStatus()" (ngModelChange)="draftStatus.set($event)">
                @for (st of statuses; track st) {
                  <mat-option [value]="st">{{ st | status }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>شواهد انجام اقدام</mat-label>
              <textarea matInput rows="3" [ngModel]="draftEvidence()" (ngModelChange)="draftEvidence.set($event)"></textarea>
            </mat-form-field>
            <div class="actions"><button mat-button class="primary" (click)="save(item.plan.id,item.action)">ذخیره پیشرفت</button>
              <button mat-button (click)="draftId.set('')">انصراف</button></div>
          }
        </mat-card>
      } @empty {
        <div class="empty">فعلاً اقدامی به حساب شما اختصاص داده نشده است.</div>
      }
    </div>
  `,
})
export default class EmployeeTasks {
  readonly s = inject(Store);
  readonly statuses: Action["status"][] = ["planned", "progress", "completed", "blocked", "cancelled"];
  readonly draftId = signal("");
  readonly draftStatus = signal<Action["status"]>("planned");
  readonly draftEvidence = signal("");
  readonly assigned = computed(() => this.s.assignedActions());
  readonly completed = computed(() => this.assigned().filter((x) => x.action.status === "completed").length);
  readonly pending = computed(() => this.assigned().filter((x) => x.action.status !== "completed").length);
  competency(index: number) {
    return ["ارتباط مؤثر", "همکاری تیمی", "حل مسئله", "پاسخگویی", "هدایت تیم"][index] ?? "—";
  }
  edit(action: Action) {
    this.draftId.set(action.id);
    this.draftStatus.set(action.status);
    this.draftEvidence.set(action.evidence ?? "");
  }
  save(planId: string, action: Action) {
    if (this.s.saveAction(planId, {
      ...action, status: this.draftStatus(), evidence: this.draftEvidence(),
    })) this.draftId.set("");
  }
}
