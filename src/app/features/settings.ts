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
          <table>
            <tr>
              <th>موجودیت</th>
              <th>کلید مرجع</th>
              <th>مالک داده</th>
              <th>نسخه قرارداد</th>
              <th>تغییر قابل مشاهده</th>
            </tr>
            <tr>
              <td>PerformanceSnapshot</td>
              <td>personId + period</td>
              <td>HR نمونه</td>
              <td>۱</td>
              <td>
                تغییر عملکرد نیما روشن در پروفایل و ۹ خانه؛ آمادگی جانشینی ثابت
              </td>
            </tr>
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
          <table>
            <tr>
              <th>زمان</th>
              <th>نقش</th>
              <th>عملیات</th>
              <th>شناسه مرجع</th>
            </tr>
            @for (e of s.state().audit; track e.id) {
              <tr>
                <td>{{ e.at | faDate }}</td>
                <td>{{ roles[e.role] }}</td>
                <td>{{ e.action }}</td>
                <td>{{ e.entity }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="empty">
                  با اولین تغییر، رویداد ثبت می‌شود.
                </td>
              </tr>
            }
          </table>
        </div>
      </mat-card>
    }`,
})
export default class Settings {
  s = inject(Store);
  roles = roles;
  confirm = false;
}
