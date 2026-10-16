import { Component, inject } from "@angular/core";
import { Store } from "../core/store";
import { roles } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">کنترل جلسه ارائه</div>
        <h1>راهنما و تنظیمات دمو</h1>
        <p>سناریوی قابل تکرار، داده ساختگی و ثبت رویدادهای مشترک</p>
      </div>
    </div>
    <div class="grid two">
      <mat-card class="panel">
        <h2>سناریوی ۱۰ تا ۱۵ دقیقه‌ای</h2>
        <div class="metric-line">
          <span class="step-number">۱</span>
          <div>
            <a routerLink="/jobs/j1">مدیر پروژه را باز کنید</a
            ><small
              >شناسنامه و شایستگی‌ها؛ ویرایش، ارسال، تغییر نقش به مالک و
              تأیید</small
            >
          </div>
        </div>
        <div class="metric-line">
          <span class="step-number">۲</span>
          <div>
            <a routerLink="/evaluations/c1">دوره پاییز را شروع کنید</a
            ><small
              >در نقش HR شروع پاسخ‌گیری؛ نقش ارزیاب و انتخاب شش شخصیت برای تکمیل
              تکالیف</small
            >
          </div>
        </div>
        <div class="metric-line">
          <span class="step-number">۳</span>
          <div>
            <a routerLink="/evaluations/c1/calibration">کالیبراسیون و گزارش</a
            ><small
              >HR: پایان پاسخ‌گیری، یادداشت کالیبراسیون و آماده‌سازی
              بازخورد</small
            >
          </div>
        </div>
        <div class="metric-line">
          <span class="step-number">۴</span>
          <div>
            <a routerLink="/people/p1">شکاف و برنامه توسعه آرمان</a
            ><small
              >ایجاد سه اقدام؛ انجام یک اقدام و مشاهده ۳۳٪ پیشرفت در
              داشبورد</small
            >
          </div>
        </div>
        <div class="metric-line">
          <span class="step-number">۵</span>
          <div>
            <a routerLink="/talent/succession">ثبت نظر آمادگی جانشین</a
            ><small
              >انتخاب A همراه شواهد و مشاهده تغییر پوشش پست‌های حیاتی</small
            >
          </div>
        </div>
        <div class="metric-line">
          <span class="step-number">۶</span>
          <div>
            <a routerLink="/knowledge/aar">ثبت درس‌آموخته</a
            ><small
              >پنج محور، ارسال به بازبینی، تغییر نقش به مالک و انتشار؛ مشاهده در
              شغل</small
            >
          </div>
        </div>
      </mat-card>
      <mat-card class="panel">
        <h2>درباره این نمونه</h2>
        <p style="margin:15px 0">
          این برنامه هیچ بک‌اند، پایگاه داده یا احراز هویت واقعی ندارد.
          LocalStorage فقط داده‌های ساختگی را در مرورگر شما نگه می‌دارد. نقش‌ها
          برای نمایش گردش‌کار هستند.
        </p>
        <div class="info">
          اسناد شرح خدمات مبنای چهار ماژول اصلی‌اند. ۹ خانه، A/B/C و ماتریس ریسک
          الگوهای آموزشی‌اند؛ GIA در این نسخه اجرا نمی‌شود.
        </div>
        <h3>بازنشانی داده‌ها</h3>
        <p>
          همه ویرایش‌ها، پاسخ‌ها و رویدادها حذف و Seed اولیه دقیقاً بازیابی
          می‌شود.
        </p>
        @if (!confirm) {
          <button
            mat-button
            class="secondary"
            style="margin-top:15px"
            (click)="confirm = true"
          >
            بازنشانی دمو
          </button>
        } @else {
          <div class="warning">
            تغییرات همین مرورگر پاک می‌شوند. ادامه می‌دهید؟
            <div class="actions">
              <button mat-button (click)="s.reset(); confirm = false">
                بله، بازنشانی شود</button
              ><button mat-button (click)="confirm = false">انصراف</button>
            </div>
          </div>
        }
      </mat-card>
    </div>
    @if (s.role() === "hr") {
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>شبیه‌ساز قرارداد تبادل داده</h2>
            <small>بدون ارسال درخواست به سامانه بیرونی</small>
          </div>
          <button mat-button class="primary" (click)="s.sync()">
            اجرای همگام‌سازی Mock
          </button>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="syncContract" class="royesh-table">
 <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>موجودیت</th><td mat-cell *matCellDef="let row">{{ row.entity }}</td></ng-container>
 <ng-container matColumnDef="key"><th mat-header-cell *matHeaderCellDef>کلید مرجع</th><td mat-cell *matCellDef="let row">{{ row.key }}</td></ng-container>
 <ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>مالک داده</th><td mat-cell *matCellDef="let row">{{ row.source }}</td></ng-container>
 <ng-container matColumnDef="version"><th mat-header-cell *matHeaderCellDef>نسخه قرارداد</th><td mat-cell *matCellDef="let row">{{ row.version }}</td></ng-container>
 <ng-container matColumnDef="change"><th mat-header-cell *matHeaderCellDef>تغییر قابل مشاهده</th><td mat-cell *matCellDef="let row">{{ row.change }}</td></ng-container>
 <tr mat-header-row *matHeaderRowDef="syncColumns"></tr><tr mat-row *matRowDef="let row; columns: syncColumns"></tr>
 </table>
        </div>
        @for (run of s.state().syncs; track run.at) {
          <div class="metric-line">
            <span>{{ run.at | faDate }}</span
            ><strong>{{ run.rows | fa }} ردیف</strong
            ><span>{{ run.summary }}</span>
          </div>
        } @empty {
          <p style="margin-top:15px">هنوز همگام‌سازی اجرا نشده است.</p>
        }
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <h2>رویدادهای نمایشی</h2>
          <small>۲۵۰ رویداد آخر · محلی و غیرامنیتی</small>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="s.state().audit" class="royesh-table">
 <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>زمان</th><td mat-cell *matCellDef="let e">{{ e.at | faDate }}</td></ng-container>
 <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>نقش</th><td mat-cell *matCellDef="let e">{{ roleLabel(e.role) }}</td></ng-container>
 <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>عملیات</th><td mat-cell *matCellDef="let e">{{ e.action }}</td></ng-container>
 <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>شناسه مرجع</th><td mat-cell *matCellDef="let e">{{ e.entity }}</td></ng-container>
 <tr mat-header-row *matHeaderRowDef="auditColumns"></tr><tr mat-row *matRowDef="let row; columns: auditColumns"></tr>
 </table>
 @if (!s.state().audit.length) {<div class="empty">با اولین تغییر، رویداد ثبت می‌شود.</div>}
        </div>
      </mat-card>
    }`,
})
export default class Settings {
  s = inject(Store);
  readonly syncColumns = ["entity","key","source","version","change"];
  readonly auditColumns = ["at","role","action","entity"];
  readonly syncContract = [{ entity: "PerformanceSnapshot", key: "personId + period",
    source: "HR نمونه", version: "۱",
    change: "تغییر عملکرد نیما روشن در پروفایل و ۹ خانه؛ آمادگی جانشینی ثابت" }];
  roleLabel(value: string) { return Object.entries(roles).find(([key]) => key === value)?.[1] ?? value; }
  roles = roles;
  confirm = false;
}
