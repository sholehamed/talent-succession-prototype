import { Component, computed, inject, input } from "@angular/core";
import { Store } from "../core/store";
import { UI } from "./ui";

/** Same-job cross-cycle comparison; no implication that an IDP caused the change. */
@Component({
  selector: "app-growth-comparison",
  standalone: true,
  imports: UI,
  template: `
    <mat-card class="panel">
      <div class="panel-head">
        <div>
          <h2>مقایسه شایستگی در دو دوره ارزیابی</h2>
          <small>مقایسه امتیاز مشاهده‌شده و فاصله تا انتظار شغل هدف</small>
        </div>
      </div>
      @if (comparison(); as value) {
        <div class="metric-line">
          <div class="grow">
            <strong>{{ value.older.title }} ← {{ value.newer.title }}</strong>
            <small style="display:block">تغییر میانگین شکاف در پنج شایستگی</small>
          </div>
          <strong>
            @if (value.meanGapImprovement > 0) { کاهش }
            @else if (value.meanGapImprovement < 0) { افزایش }
            @else { بدون تغییر }
            {{ absolute(value.meanGapImprovement) | fa }}
          </strong>
        </div>
        @if (value.expectationsChanged) {
          <div class="warning">
            سطح انتظار شغل بین این دو دوره تغییر کرده است؛ بخشی از تغییر شکاف
            ممکن است ناشی از بازنگری شناسنامه شغلی باشد.
          </div>
        }
        <div class="table-wrap">
          <table mat-table [dataSource]="value.rows" class="royesh-table">
            <ng-container matColumnDef="competency">
              <th mat-header-cell *matHeaderCellDef>شایستگی</th>
              <td mat-cell *matCellDef="let r">{{ r.competency }}</td>
            </ng-container>
            <ng-container matColumnDef="oldScore">
              <th mat-header-cell *matHeaderCellDef>امتیاز قبلی</th>
              <td mat-cell *matCellDef="let r">{{ r.oldScore | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="newScore">
              <th mat-header-cell *matHeaderCellDef>امتیاز جدید</th>
              <td mat-cell *matCellDef="let r">{{ r.newScore | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="oldGap">
              <th mat-header-cell *matHeaderCellDef>شکاف قبلی</th>
              <td mat-cell *matCellDef="let r">{{ r.oldGap | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="newGap">
              <th mat-header-cell *matHeaderCellDef>شکاف جدید</th>
              <td mat-cell *matCellDef="let r">{{ r.newGap | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="change">
              <th mat-header-cell *matHeaderCellDef>تغییر شکاف</th>
              <td mat-cell *matCellDef="let r">
                {{ r.improvement > 0 ? "کاهش" : r.improvement < 0 ? "افزایش" : "ثابت" }}
                {{ absolute(r.improvement) | fa }}
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <p class="report-note">
          این مقایسه نشان‌دهنده تغییر مشاهده‌شده در ارزیابی‌هاست؛
          تکمیل اقدامات توسعه به‌تنهایی دلیل اثبات‌شده رشد یا آمادگی انتصاب نیست.
        </p>
      } @else {
        <div class="empty">
          برای مقایسه، دو دوره ارزیابی تأییدشده از یک فرد و یک شغل هدف لازم است.
        </div>
      }
    </mat-card>
  `,
})
export class GrowthComparison {
  readonly s = inject(Store);
  readonly personId = input.required<string>();
  readonly jobId = input.required<string>();
  readonly currentCycleId = input<string | undefined>(undefined);
  readonly columns = ["competency", "oldScore", "newScore", "oldGap", "newGap", "change"];
  readonly comparison = computed(() => this.s.assessmentComparison(
    this.personId(), this.jobId(), this.currentCycleId(),
  ));
  absolute(n: number): number { return Math.abs(n); }
}
