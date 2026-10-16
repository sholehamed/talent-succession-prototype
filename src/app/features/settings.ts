import { Component, inject } from "@angular/core";
import { Store } from "../core/store";
import { roles } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">مدیریت سامانه</div>
        <h1>تنظیمات و یکپارچه‌سازی</h1>
        <p>مدیریت اطلاعات، تبادل داده و تاریخچه تغییرات</p>
      </div>
    </div>

    <mat-card class="panel">
      <div class="panel-head">
        <div>
          <h2>مدیریت اطلاعات</h2>
          <small>تنظیمات نگهداری اطلاعات در مرورگر جاری</small>
        </div>
      </div>
      <p>
        اطلاعات ثبت‌شده در این نسخه در حافظه مرورگر ذخیره می‌شوند.
        بازنشانی، ویرایش‌ها و سوابق ذخیره‌شده در همین مرورگر را به وضعیت اولیه برمی‌گرداند.
      </p>
      @if (!confirm) {
        <div class="actions">
          <button mat-stroked-button (click)="confirm = true">بازنشانی اطلاعات</button>
        </div>
      } @else {
        <div class="warning">
          با تأیید، تغییرات ذخیره‌شده در این مرورگر پاک می‌شوند. ادامه می‌دهید؟
          <div class="actions">
            <button mat-button (click)="s.reset(); confirm = false">بله، بازنشانی شود</button>
            <button mat-button (click)="confirm = false">انصراف</button>
          </div>
        </div>
      }
    </mat-card>

    @if (s.role() === "hr") {
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>تبادل اطلاعات منابع انسانی</h2>
            <small>بررسی ساختار داده و اثر همگام‌سازی بر اطلاعات کارکنان</small>
          </div>
          <button mat-button class="primary" (click)="s.sync()">اجرای همگام‌سازی محلی</button>
        </div>
        <p class="report-note">
          اجرای این عملیات صرفاً اطلاعات ذخیره‌شده در مرورگر را به‌روزرسانی می‌کند؛
          ارتباط با سرویس خارجی در این نسخه فعال نیست.
        </p>
        <div class="table-wrap">
          <table mat-table [dataSource]="syncContract" class="royesh-table">
            <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>موجودیت</th><td mat-cell *matCellDef="let row">{{ row.entity }}</td></ng-container>
            <ng-container matColumnDef="key"><th mat-header-cell *matHeaderCellDef>کلید مرجع</th><td mat-cell *matCellDef="let row">{{ row.key }}</td></ng-container>
            <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>مالک داده</th><td mat-cell *matCellDef="let row">{{ row.source }}</td></ng-container>
            <ng-container matColumnDef="version"><th mat-header-cell *matHeaderCellDef>نسخه قرارداد</th><td mat-cell *matCellDef="let row">{{ row.version }}</td></ng-container>
            <ng-container matColumnDef="change"><th mat-header-cell *matHeaderCellDef>اثر بر اطلاعات</th><td mat-cell *matCellDef="let row">{{ row.change }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="syncColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: syncColumns"></tr>
          </table>
        </div>
        @for (run of s.state().syncs; track run.at) {
          <div class="metric-line">
            <span>{{ run.at | faDate }}</span>
            <strong>{{ run.rows | fa }} ردیف</strong>
            <span>{{ run.summary }}</span>
          </div>
        } @empty {
          <p style="margin-top:15px">هنوز همگام‌سازی اجرا نشده است.</p>
        }
      </mat-card>

      <mat-card class="panel">
        <div class="panel-head">
          <h2>تاریخچه عملیات</h2>
          <small>۲۵۰ رویداد آخر در مرورگر جاری</small>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="s.state().audit" class="royesh-table">
            <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>زمان</th><td mat-cell *matCellDef="let e">{{ e.at | faDate }}</td></ng-container>
            <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>نقش</th><td mat-cell *matCellDef="let e">{{ roleLabel(e.role) }}</td></ng-container>
            <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>عملیات</th><td mat-cell *matCellDef="let e">{{ e.action }}</td></ng-container>
            <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>شناسه مرجع</th><td mat-cell *matCellDef="let e">{{ e.entity }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="auditColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: auditColumns"></tr>
          </table>
          @if (!s.state().audit.length) {
            <div class="empty">هنوز رویدادی ثبت نشده است.</div>
          }
        </div>
      </mat-card>
    }
  `,
})
export default class Settings {
  readonly s = inject(Store);
  readonly syncColumns = ["entity", "key", "source", "version", "change"];
  readonly auditColumns = ["at", "role", "action", "entity"];
  readonly syncContract = [{
    entity: "PerformanceSnapshot",
    key: "personId + period",
    source: "منابع انسانی",
    version: "۱",
    change: "به‌روزرسانی عملکرد فرد در پروفایل و نقشه استعداد؛ بدون تغییر خودکار آمادگی جانشینی",
  }];
  confirm = false;

  roleLabel(value: string) {
    return roles[value as keyof typeof roles] ?? value;
  }
}
