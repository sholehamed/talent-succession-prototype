import { Component, computed, effect, inject, input } from "@angular/core";
import { PositionRiskInput } from "../core/models";
import { PositionRiskStatus } from "../core/position-risk";
import { Store } from "../core/store";
import { UI } from "../shared/ui";

@Component({
  selector: "app-position-risk",
  standalone: true,
  imports: UI,
  template: `
    @if (position(); as p) {
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>ارزیابی ریسک پست حیاتی</h2>
            <small>الگوی پیشنهادی ۳×۳؛ ضابطه مصوب سازمان نیست</small>
          </div>
          @if (s.canReviewPositionRisk(p.id) && risk().status !== "vacant") {
            <button mat-button class="primary" (click)="start()">
              {{ p.riskReview ? "بازبینی ریسک" : "ثبت ارزیابی ریسک" }}
            </button>
          }
        </div>
        <div class="grid three">
          <div>
            <small>وضعیت</small>
            <h3>{{ statusLabel(risk().status) }}</h3>
            <small>افق برآورد خروج: ۱۲ ماه</small>
          </div>
          <div>
            <small>احتمال × اثر خروج</small>
            @if (risk().score !== null) {
              <h3>{{ p.probability | fa }} × {{ p.impact | fa }} = {{ risk().score | fa }}</h3>
            } @else {
              <h3>—</h3>
              <small>امتیاز خام یا قدیمی، ریسک معتبر محسوب نمی‌شود.</small>
            }
          </div>
          <div>
            <small>زمان جایگزینی</small>
            <h3>{{ risk().replacementMonths === null ? "—" : (risk().replacementMonths | fa) + " ماه" }}</h3>
            @if (p.riskReview) {
              <small>آخرین بررسی: {{ p.riskReview.assessedAt | faDate }}</small>
            }
          </div>
        </div>
        @if (p.riskReview) {
          <div class="info">
            <strong>دلیل حیاتی‌بودن:</strong> {{ p.reason }}
            <p><strong>شواهد احتمال:</strong> {{ p.riskReview.probabilityEvidence }}</p>
            <p><strong>شواهد اثر:</strong> {{ p.riskReview.impactEvidence }}</p>
            <p><strong>مبنای زمان جایگزینی:</strong> {{ p.riskReview.replacementBasis }}</p>
            <p><strong>اقدام کنترلی:</strong> {{ p.riskReview.mitigationAction }}</p>
            <small>ثبت‌کننده: {{ s.state().people.find(x => x.id === p.riskReview?.assessedBy)?.name ?? "نامشخص" }}</small>
          </div>
        } @else {
          <div class="info">اعداد پیش‌فرض قدیمی صرفاً نمایشی هستند؛ برای این پست ارزیابی مستند ثبت نشده است.</div>
        }
        @if (risk().status === "vacant") {
          <div class="warning">پست بلاتصدی است. تا انتصاب متصدی جاری، ریسک خروج فرد قابل ارزیابی نیست.</div>
        } @else if (risk().status === "stale") {
          <div class="warning">متصدی یا مهلت ارزیابی تغییر کرده است. برای محاسبه ریسک جاری، ارزیابی جدید ثبت کنید.</div>
        }
        @if (draft; as d) {
          <div class="panel">
            <h3>ثبت ارزیابی کارشناسی ریسک</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>احتمال خروج طی ۱۲ ماه</mat-label>
                <mat-select [(ngModel)]="d.probability">
                  <mat-option [value]="1">۱ — کم</mat-option>
                  <mat-option [value]="2">۲ — متوسط</mat-option>
                  <mat-option [value]="3">۳ — زیاد</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>اثر خروج</mat-label>
                <mat-select [(ngModel)]="d.impact">
                  <mat-option [value]="1">۱ — محدود</mat-option>
                  <mat-option [value]="2">۲ — محسوس</mat-option>
                  <mat-option [value]="3">۳ — شدید</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>زمان جایگزینی (ماه)</mat-label>
                <input matInput type="number" min="1" step="1" [(ngModel)]="d.months"/>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>دلیل حیاتی‌بودن پست</mat-label>
                <textarea matInput [(ngModel)]="d.reason"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>شواهد و مبنای احتمال خروج</mat-label>
                <textarea matInput [(ngModel)]="d.probabilityEvidence"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>شواهد پیامد و اثر خروج</mat-label>
                <textarea matInput [(ngModel)]="d.impactEvidence"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>مبنای برآورد زمان جایگزینی</mat-label>
                <textarea matInput [(ngModel)]="d.replacementBasis"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>اقدام کنترلی برای کاهش ریسک</mat-label>
                <textarea matInput [(ngModel)]="d.mitigationAction"></textarea>
              </mat-form-field>
            </div>
            <div class="actions">
              <button mat-button class="primary" (click)="save()">ثبت ارزیابی ریسک</button>
              <button mat-button (click)="draft = undefined">انصراف</button>
            </div>
          </div>
        }
      </mat-card>
    }
  `,
})
export class PositionRisk {
  readonly s = inject(Store);
  readonly positionId = input.required<string>();
  readonly position = computed(() => this.s.positionRecord(this.positionId()));
  readonly risk = computed(() => this.s.positionRisk(this.positionId()));
  draft?: PositionRiskInput;

  constructor() {
    effect(() => {
      this.positionId(); // discard another position's draft when selection changes
      this.draft = undefined;
    });
  }

  statusLabel(status: PositionRiskStatus) {
    return {
      current: "ارزیابی مستند معتبر",
      unassessed: "فاقد ارزیابی مستند",
      stale: "نیازمند بازبینی",
      vacant: "بلاتصدی",
      inactive: "پست غیرفعال یا غیرحیاتی",
    }[status];
  }
  start() {
    const p = this.position();
    if (!p || !this.s.canReviewPositionRisk(p.id)) return;
    this.draft = {
      probability: p.riskReview ? p.probability as 1 | 2 | 3 : 1,
      impact: p.riskReview ? p.impact as 1 | 2 | 3 : 1,
      months: p.riskReview ? p.months : 6,
      reason: p.riskReview ? p.reason : "",
      probabilityEvidence: p.riskReview?.probabilityEvidence ?? "",
      impactEvidence: p.riskReview?.impactEvidence ?? "",
      replacementBasis: p.riskReview?.replacementBasis ?? "",
      mitigationAction: p.riskReview?.mitigationAction ?? "",
    };
  }
  save() {
    if (this.draft && this.s.savePositionRisk(this.positionId(), this.draft))
      this.draft = undefined;
  }
}
