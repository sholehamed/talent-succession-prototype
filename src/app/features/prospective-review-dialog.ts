import { Component, inject, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { Store } from "../core/store";
import { ProspectiveEvaluationRun, ProspectiveNomineeSnapshot } from "../core/models";
import { UI } from "../shared/ui";

export interface ProspectiveDialogData {
  run:ProspectiveEvaluationRun;
  nominee:ProspectiveNomineeSnapshot;
}
@Component({
  standalone:true,
  imports:[...UI,MatDialogModule],
  styles:[`
    .question-card{padding:10px 4px;border-bottom:1px solid var(--border,#e5e7eb)}
    .dialog-form{min-width:min(640px,85vw);max-height:65vh;overflow:auto}
    @media(max-width:650px){.dialog-form{min-width:0;width:100%}}
  `],
  template:`
    <h2 mat-dialog-title>ارزیابی آینده‌نگر {{ data.nominee.personName }}</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        <div class="info">پست: {{ data.run.positionTitle }} · تاریخ شروع {{ data.run.startedAt | faDate }}
          <p>سؤالات این دوره ثابت هستند. امتیاز هر سؤال از ۱ تا ۵ انتخاب شود.</p>
        </div>
        @for (indicator of data.run.indicators; track indicator.id) {
          <h3>{{ indicator.title }}</h3>
          @if (indicator.description) { <p>{{ indicator.description }}</p> }
          @for (q of questionsFor(indicator.id); track q.id; let i=$index) {
            <div class="question-card">
              <strong>{{ i+1 | fa }}. {{ q.text }}</strong>
              <mat-form-field appearance="outline" style="width:100%;margin-top:8px">
                <mat-label>امتیاز سؤال</mat-label>
                <mat-select [ngModel]="answers()[q.id] ?? 0" (ngModelChange)="setAnswer(q.id,$event)">
                  <mat-option [value]="0">انتخاب کنید</mat-option>
                  @for (v of levels; track v) {
                    <mat-option [value]="v">{{ v | fa }} از ۵</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          }
        }
        <mat-form-field appearance="outline" style="width:100%;margin-top:10px">
          <mat-label>شواهد و توضیح ارزیابی آینده‌نگر</mat-label>
          <textarea matInput rows="3" [ngModel]="evidence()"
            (ngModelChange)="evidence.set($event)"></textarea>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialog.close(false)">انصراف</button>
      <button mat-button class="primary" (click)="save()">ثبت نتیجه آینده‌نگر</button>
    </mat-dialog-actions>
  `,
})
export class ProspectiveReviewDialog {
  readonly s=inject(Store);
  readonly data=inject<ProspectiveDialogData>(MAT_DIALOG_DATA);
  readonly dialog=inject(MatDialogRef<ProspectiveReviewDialog>);
  readonly levels=[1,2,3,4,5];
  readonly answers=signal<Record<string,number>>({});
  readonly evidence=signal("");
  questionsFor(id:string){return this.data.run.questions.filter(q=>q.indicatorId===id);}
  setAnswer(id:string,score:number){
    this.answers.update(old=>({...old,[id]:score}));
  }
  save(){
    const answers=this.data.run.questions.map(q=>({
      questionId:q.id,score:this.answers()[q.id]??0,
    }));
    if(this.s.submitProspectiveReview(this.data.run.id,this.data.nominee.personId,answers,this.evidence()))
      this.dialog.close(true);
  }
}
