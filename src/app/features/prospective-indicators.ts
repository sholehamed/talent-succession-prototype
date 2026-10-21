import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { ProspectiveIndicator } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone:true,imports:UI,
  template:`
    <div class="page-header">
      <div><div class="eyebrow">توسعه و جانشین‌پروری / بانک آینده‌نگر</div>
        <h1>مدیریت شاخص‌های ارزیابی آینده‌نگر</h1>
        <p>شاخص‌ها عمومی و مستقل از شغل‌اند؛ نسخه آغازشده ارزیابی از تغییرات بعدی تأثیر نمی‌گیرد.</p>
      </div>
      <a mat-button class="secondary" routerLink="/talent/prospective/questions">بانک سؤالات آینده‌نگر ←</a>
    </div>
    <div class="info">شاخص‌های اولیه صرفاً نمونه آموزشی هستند و معیار مصوب یا آزمون معتبر محسوب نمی‌شوند.
      غیرفعال‌سازی شاخص، دوره‌های قبلی را تغییر نمی‌دهد.</div>
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head"><h2>شاخص‌های موجود</h2>
          <small>{{ indicators().length | fa }} شاخص</small></div>
        @for (i of indicators(); track i.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ i.title }}</strong>
              <small>{{ i.description }} · {{ i.isActive ? 'فعال' : 'غیرفعال' }}</small>
            </div>
            <div class="actions">
              <button mat-button (click)="edit(i)">ویرایش</button>
              <button mat-button (click)="toggle(i)">{{ i.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن' }}</button>
            </div>
          </div>
        } @empty { <div class="empty">شاخصی تعریف نشده است.</div> }
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head"><h2>{{ id() ? 'ویرایش شاخص' : 'ثبت شاخص جدید' }}</h2>
          <button mat-button (click)="reset()">شاخص جدید</button></div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>عنوان شاخص</mat-label>
          <input matInput [ngModel]="title()" (ngModelChange)="title.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>توضیح شاخص</mat-label>
          <textarea matInput rows="3" [ngModel]="description()" (ngModelChange)="description.set($event)"></textarea>
        </mat-form-field>
        <mat-checkbox [checked]="active()" (change)="active.set($event.checked)">شاخص فعال</mat-checkbox>
        <div class="actions">
          <button mat-button class="primary" (click)="save()">ذخیره شاخص</button>
          @if (id()) { <button mat-button (click)="reset()">انصراف</button> }
        </div>
      </mat-card>
    </div>
  `,
})
export default class ProspectiveIndicators {
  readonly s=inject(Store);
  readonly id=signal("");
  readonly title=signal("");
  readonly description=signal("");
  readonly active=signal(true);
  readonly indicators=computed(()=>[...this.s.state().prospectiveIndicators]
    .sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)));
  edit(i:ProspectiveIndicator){
    this.id.set(i.id);this.title.set(i.title);this.description.set(i.description);
    this.active.set(i.isActive);
  }
  reset(){this.id.set("");this.title.set("");this.description.set("");this.active.set(true);}
  save(){
    if(this.s.saveProspectiveIndicator({
      id:this.id(),title:this.title(),description:this.description(),
      order:0,isActive:this.active(),
    }))this.reset();
  }
  toggle(i:ProspectiveIndicator){
    this.s.saveProspectiveIndicator({...i,isActive:!i.isActive});
  }
}
