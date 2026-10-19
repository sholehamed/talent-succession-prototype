import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { DevelopmentTemplate } from "../core/development-templates";
import { competencies } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">برنامه‌ریزی رشد شایستگی</div>
        <h1>مدیریت الگوهای اقدام توسعه</h1>
        <p>تعریف اقدامات پیشنهادی برای هر شایستگی و استفاده از آن‌ها در برنامه توسعه فردی.</p>
      </div>
      <a mat-button class="secondary" routerLink="/development">برنامه‌های توسعه فردی ←</a>
    </div>
    <div class="info">
      الگوهای فعال در پیشنهادهای برنامه‌های تازه و فرم افزودن اقدام ظاهر می‌شوند.
      برنامه‌های ایجادشده، عنوان و شاخص موفقیت اقدام را به‌صورت مستقل نگه می‌دارند.
      الگوی استفاده‌شده را می‌توانید غیرفعال کنید، اما برای حفظ سوابق قابل حذف نیست.
    </div>
    <div class="grid three" style="margin-bottom:20px">
      <div class="stat"><span class="label">کل الگوها</span><strong>{{ all().length | fa }}</strong></div>
      <div class="stat"><span class="label">الگوهای فعال</span><strong>{{ activeCount() | fa }}</strong></div>
      <div class="stat"><span class="label">اقدام‌های مرتبط در برنامه‌ها</span><strong>{{ usageTotal() | fa }}</strong></div>
    </div>
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>الگوهای {{ competencies[selectedCompetency()] }}</h2>
            <small>داده‌های متصل به کاتالوگ و برنامه‌های توسعه ثبت‌شده</small>
          </div>
          <button mat-button class="secondary" (click)="newTemplate()">افزودن الگو</button>
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>انتخاب شایستگی</mat-label>
          <mat-select [ngModel]="selectedCompetency()" (ngModelChange)="chooseCompetency($event)">
            @for (name of competencies; track name; let i = $index) {
              <mat-option [value]="i">{{ name }} ({{ count(i) | fa }} فعال)</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-checkbox [ngModel]="showInactive()" (ngModelChange)="showInactive.set($event)">
          نمایش الگوهای غیرفعال
        </mat-checkbox>
        @for (t of filtered(); track t.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ t.title }}</strong>
              <small style="display:block">نوع: {{ t.kind }} · {{ t.isActive ? "فعال" : "غیرفعال" }} ·
                استفاده در {{ s.templateUsageCount(t.id) | fa }} اقدام</small>
              <p>شاخص موفقیت: {{ t.indicator }}</p>
              @if (linkedPlans(t.id); as plans) {
                @if (plans.length) {
                  <div class="actions">
                    <small>برنامه‌های مرتبط:</small>
                    @for (p of plans; track p.id) {
                      <a [routerLink]="['/development/idp', p.id]">
                        {{ s.person(p.personId).name }} · نسخه {{ s.planVersion(p) | fa }}
                      </a>
                    }
                  </div>
                }
              }
              <div class="actions">
                <button mat-button (click)="edit(t)">ویرایش</button>
                <button mat-button (click)="toggle(t)">{{ t.isActive ? "غیرفعال کردن" : "فعال کردن" }}</button>
                <button mat-button [disabled]="s.templateUsageCount(t.id) > 0"
                  (click)="pendingDelete.set(t.id)">حذف</button>
              </div>
              @if (pendingDelete() === t.id) {
                <div class="warning">
                  الگوی بدون استفاده برای همیشه از بانک حذف می‌شود.
                  <button mat-button (click)="remove(t.id)">تأیید حذف</button>
                  <button mat-button (click)="pendingDelete.set('')">انصراف</button>
                </div>
              }
            </div>
          </div>
        } @empty {
          <div class="empty">برای این شایستگی الگوی فعالی یافت نشد. می‌توانید الگوی جدید تعریف کنید.</div>
        }
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <h2>{{ draftId() ? "ویرایش الگوی توسعه" : "تعریف الگوی توسعه جدید" }}</h2>
          @if (draftId()) { <button mat-button (click)="newTemplate()">انصراف از ویرایش</button> }
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شایستگی هدف</mat-label>
          <mat-select [ngModel]="draftCompetency()" (ngModelChange)="draftCompetency.set($event)"
            [disabled]="!!draftId() && s.templateUsageCount(draftId()) > 0">
            @for (name of competencies; track name; let i = $index) {
              <mat-option [value]="i">{{ name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>عنوان اقدام پیشنهادی</mat-label>
          <input matInput [ngModel]="draftTitle()" (ngModelChange)="draftTitle.set($event)"
            placeholder="مثلاً اجرای پروژه بین‌واحدی" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>نوع اقدام</mat-label>
          <mat-select [ngModel]="draftKind()" (ngModelChange)="draftKind.set($event)">
            @for (kind of kinds; track kind) {
              <mat-option [value]="kind">{{ kind }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شاخص موفقیت اقدام</mat-label>
          <textarea matInput rows="4" [ngModel]="draftIndicator()"
            (ngModelChange)="draftIndicator.set($event)"
            placeholder="خروجی قابل مشاهده و معیار تأیید اقدام"></textarea>
        </mat-form-field>
        <mat-checkbox [ngModel]="draftActive()" (ngModelChange)="draftActive.set($event)">
          الگو فعال باشد
        </mat-checkbox>
        <div class="actions" style="margin-top:12px">
          <button mat-button class="primary" (click)="save()">
            {{ draftId() ? "ذخیره تغییرات" : "ثبت الگوی جدید" }}
          </button>
          @if (draftId()) { <button mat-button (click)="newTemplate()">انصراف</button> }
        </div>
      </mat-card>
    </div>
  `,
})
export default class DevelopmentTemplates {
  readonly s = inject(Store);
  readonly competencies = competencies;
  readonly kinds = ["تجربه عملی", "آموزش", "مربیگری", "یادگیری گروهی", "پروژه عملی", "مأموریت عملی", "مطالعه و تمرین"];
  readonly selectedCompetency = signal(0);
  readonly showInactive = signal(false);
  readonly draftId = signal("");
  readonly draftCompetency = signal(0);
  readonly draftTitle = signal("");
  readonly draftKind = signal("تجربه عملی");
  readonly draftIndicator = signal("");
  readonly draftActive = signal(true);
  readonly pendingDelete = signal("");
  readonly all = computed(() => this.s.state().developmentTemplates);
  readonly activeCount = computed(() => this.all().filter((t) => t.isActive).length);
  readonly usageTotal = computed(() => this.s.state().plans
    .reduce((sum, p) => sum + p.actions.filter((a) => !!a.templateId).length, 0));
  readonly filtered = computed(() => this.all()
    .filter((t) => t.competency === this.selectedCompetency() &&
      (t.isActive || this.showInactive())));
  count(index: number) {
    return this.all().filter((t) => t.competency === index && t.isActive).length;
  }
  linkedPlans(id: string) {
    return this.s.state().plans.filter((p) => p.actions.some((a) => a.templateId === id));
  }
  chooseCompetency(index: number) {
    this.selectedCompetency.set(index);
    this.newTemplate();
  }
  newTemplate() {
    this.draftId.set("");
    this.draftCompetency.set(this.selectedCompetency());
    this.draftTitle.set("");
    this.draftKind.set("تجربه عملی");
    this.draftIndicator.set("");
    this.draftActive.set(true);
    this.pendingDelete.set("");
  }
  edit(t: DevelopmentTemplate) {
    this.selectedCompetency.set(t.competency);
    this.showInactive.set(true);
    this.draftId.set(t.id);
    this.draftCompetency.set(t.competency);
    this.draftTitle.set(t.title);
    this.draftKind.set(t.kind);
    this.draftIndicator.set(t.indicator);
    this.draftActive.set(t.isActive);
  }
  save() {
    if (this.s.saveDevelopmentTemplate({
      id: this.draftId(),
      competency: this.draftCompetency(),
      title: this.draftTitle(),
      kind: this.draftKind(),
      indicator: this.draftIndicator(),
      isActive: this.draftActive(),
    })) {
      this.selectedCompetency.set(this.draftCompetency());
      this.newTemplate();
    }
  }
  toggle(t: DevelopmentTemplate) {
    this.s.saveDevelopmentTemplate({ ...t, isActive: !t.isActive });
  }
  remove(id: string) {
    if (this.s.deleteDevelopmentTemplate(id)) {
      if (this.draftId() === id) this.newTemplate();
      this.pendingDelete.set("");
    }
  }
}
