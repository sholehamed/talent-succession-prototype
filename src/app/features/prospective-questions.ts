import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { ProspectiveQuestion } from "../core/models";
import { UI } from "../shared/ui";
@Component({
  standalone:true,imports:UI,
  template:`
    <div class="page-header">
      <div><div class="eyebrow">توسعه و جانشین‌پروری / بانک آینده‌نگر</div>
        <h1>بانک سؤالات ارزیابی آینده‌نگر</h1>
        <p>هر سؤال به یک شاخص عمومی مرتبط است؛ به شغل یا بانک سؤال ۳۶۰/۵۴۰ متصل نیست.</p>
      </div>
      <a mat-button class="secondary" routerLink="/talent/prospective/indicators">مدیریت شاخص‌ها ←</a>
    </div>
    <div class="info">قبل از آغاز دوره، هر شاخص فعال باید حداقل یک سؤال فعال داشته باشد.
      پرسش‌های دوره آغازشده در Snapshot ثابت باقی می‌مانند.</div>
    <mat-card class="panel" style="margin-bottom:18px">
      <mat-form-field appearance="outline" style="width:100%;max-width:440px">
        <mat-label>نمایش سؤالات شاخص</mat-label>
        <mat-select [ngModel]="selectedIndicator()" (ngModelChange)="changeIndicator($event)">
          @for (i of indicators(); track i.id) {
            <mat-option [value]="i.id">{{ i.title }}{{ i.isActive ? '' : ' (غیرفعال)' }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-card>
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head"><h2>سؤالات شاخص</h2>
          <small>{{ questions().length | fa }} سؤال</small></div>
        @for (q of questions(); track q.id; let index=$index) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ index+1 | fa }}. {{ q.text }}</strong>
              <small>{{ q.isActive ? 'فعال' : 'غیرفعال' }}</small>
            </div>
            <div class="actions">
              <button mat-button (click)="edit(q)">ویرایش</button>
              <button mat-button (click)="toggle(q)">{{ q.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن' }}</button>
            </div>
          </div>
        } @empty { <div class="empty">برای این شاخص هنوز سؤالی ثبت نشده است.</div> }
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head"><h2>{{ id() ? 'ویرایش سؤال' : 'سؤال جدید' }}</h2>
          <button mat-button (click)="reset()">سؤال جدید</button></div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شاخص مرتبط</mat-label>
          <mat-select [ngModel]="questionIndicator()" (ngModelChange)="questionIndicator.set($event)">
            @for (i of indicators(); track i.id) {
              <mat-option [value]="i.id">{{ i.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>متن سؤال</mat-label>
          <textarea matInput rows="4" [ngModel]="text()" (ngModelChange)="text.set($event)"></textarea>
        </mat-form-field>
        <mat-checkbox [checked]="active()" (change)="active.set($event.checked)">سؤال فعال</mat-checkbox>
        <div class="actions">
          <button mat-button class="primary" (click)="save()">ذخیره سؤال</button>
          @if (id()) { <button mat-button (click)="reset()">انصراف</button> }
        </div>
      </mat-card>
    </div>
  `,
})
export default class ProspectiveQuestions {
  readonly s=inject(Store);
  readonly indicators=computed(()=>[...this.s.state().prospectiveIndicators].sort((a,b)=>a.order-b.order));
  readonly selectedIndicator=signal("pros-ind-1");
  readonly questionIndicator=signal("pros-ind-1");
  readonly id=signal("");
  readonly text=signal("");
  readonly active=signal(true);
  readonly questions=computed(()=>this.s.state().prospectiveQuestions
    .filter(q=>q.indicatorId===this.selectedIndicator())
    .sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)));
  changeIndicator(id:string){this.selectedIndicator.set(id);this.reset();}
  edit(q:ProspectiveQuestion){
    this.id.set(q.id);this.questionIndicator.set(q.indicatorId);
    this.text.set(q.text);this.active.set(q.isActive);
  }
  reset(){this.id.set("");this.text.set("");this.active.set(true);
    this.questionIndicator.set(this.selectedIndicator());}
  save(){
    if(this.s.saveProspectiveQuestion({
      id:this.id(),indicatorId:this.questionIndicator(),
      text:this.text(),isActive:this.active(),order:0,
    })){this.selectedIndicator.set(this.questionIndicator());this.reset();}
  }
  toggle(q:ProspectiveQuestion){
    this.s.saveProspectiveQuestion({...q,isActive:!q.isActive});
  }
}
