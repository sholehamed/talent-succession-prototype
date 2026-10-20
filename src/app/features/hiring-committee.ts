import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { Candidate, EntryCommitteeStage, QuestionAnswer, competencies } from "../core/models";
import { entryStageLabel } from "../core/entry-committees";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">ارزیابی بدو استخدام · کارتابل اختصاصی</div>
        <h1>{{ labels[stage] }}</h1>
        <p>فقط پرونده‌های ارجاع‌شده به شناسه شما نمایش داده می‌شوند؛ امتیاز هر شایستگی از پاسخ‌ها محاسبه می‌شود.</p>
      </div>
      <a mat-button class="secondary" routerLink="/evaluations/inbox">کارتابل همه ارزیابی‌ها ←</a>
    </div>
    @if (!selectedId) {
      <mat-card class="panel">
        <div class="panel-head">
          <h2>ارجاع‌های {{ stage === 'general' ? 'عمومی' : 'تخصصی' }} من</h2>
          <span class="badge">{{ inbox().length | fa }} پرونده</span>
        </div>
        @for (c of inbox(); track c.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ c.name }}</strong>
              <small>{{ s.job(c.jobId).title }} · {{ myCompleted(review(c)) ? 'ارزیابی ثبت‌شده' : 'در انتظار پاسخ' }}</small>
            </div>
            <a mat-button [routerLink]="['/hiring/committee', stage, c.id]">
              {{ myCompleted(review(c)) ? 'مشاهده نتیجه' : 'تکمیل پرسشنامه' }} ←
            </a>
          </div>
        } @empty {
          <div class="empty">پرونده‌ای از این کمیته به شما ارجاع نشده است.</div>
        }
      </mat-card>
    } @else if (candidate(); as c) {
      @if (review(c); as task) {
        <mat-card class="panel">
          <div class="panel-head">
            <div><h2>{{ c.name }} · {{ s.job(c.jobId).title }}</h2>
              <small>{{ labels[stage] }} · ارجاع {{ task.assignedAt | faDate }} @if (task.groupName) { · {{ task.groupName }} }</small>
            </div>
            <a [routerLink]="['/hiring/committee', stage]">بازگشت به کارتابل ←</a>
          </div>
          <div class="info">پاسخ‌ها در مقیاس ۱ تا ۵ هستند. همه سؤال‌ها و ثبت شواهد ضروری است. هر پاسخ به یکی از پنج شایستگی متصل می‌شود.</div>
          @if (!myCompleted(task)) {
            @for (q of task.questions; track q.id; let i = $index) {
              <div class="metric-line">
                <div class="grow">
                  <strong>{{ i + 1 | fa }}. {{ q.text }}</strong>
                  <small>شایستگی: {{ competencies[q.competencyIndex] }}</small>
                  <mat-form-field appearance="outline" style="width:210px; margin-top:12px">
                    <mat-label>امتیاز سؤال</mat-label>
                    <mat-select [ngModel]="answerValues()[q.id] ?? 0"
                      (ngModelChange)="score(q.id, $event)">
                      <mat-option [value]="0">انتخاب نشده</mat-option>
                      @for (v of levels; track v) { <mat-option [value]="v">{{ v | fa }} از ۵</mat-option> }
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>
            }
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>شواهد و توضیح کمیته</mat-label>
              <textarea matInput rows="3" [ngModel]="evidence()" (ngModelChange)="evidence.set($event)"></textarea>
            </mat-form-field>
            <button mat-button class="primary" (click)="submit()">ثبت نتیجه {{ labels[stage] }}</button>
          } @else {
            <div class="info">نتیجه این کمیته ثبت شده و در پرونده داوطلب محفوظ است. برای جلوگیری از تغییر نتیجه، پاسخ مجدد مجاز نیست.</div>
            <div class="grid three">
              @for (name of competencies; track name; let i = $index) {
                <div class="stat"><small class="label">{{ name }}</small><strong>{{ myScores(task)?.[i] | fa }}</strong></div>
              }
            </div>
            <p>شواهد ارزیابی شما: {{ myEvidence(task) }}</p>
          }
        </mat-card>
      } @else {
        <div class="warning">این پرونده به شما در کمیته جاری ارجاع نشده است.</div>
      }
    } @else {
      <div class="empty">پرونده پیدا نشد یا دسترسی به آن ندارید.</div>
    }
  `,
})
export default class HiringCommittee {
  readonly s = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly stage: EntryCommitteeStage =
    this.route.snapshot.paramMap.get("stage") === "specialist" ? "specialist" : "general";
  readonly selectedId = this.route.snapshot.paramMap.get("id") ?? "";
  readonly labels = entryStageLabel;
  readonly competencies = competencies;
  readonly levels = [1,2,3,4,5];
  readonly answerValues = signal<Record<string,number>>({});
  readonly evidence = signal("");
  readonly inbox = computed(() => this.s.entryQueue(this.stage));
  readonly candidate = computed(() => this.inbox().find((c) => c.id === this.selectedId));
  review(c: Candidate) {
    return this.stage === "general" ? c.entryWorkflow?.general : c.entryWorkflow?.specialist;
  }
  myAssignment(task: {assignments?: {assignedTo: string; completedAt?: string; scores?: number[]; evidence?: string}[]}) {
    return task.assignments?.find(a => a.assignedTo === this.s.actor());
  }
  myCompleted(task: ReturnType<HiringCommittee["review"]>) {
    return !!(task?.assignments ? this.myAssignment(task)?.completedAt : task?.completedAt);
  }
  myScores(task: NonNullable<ReturnType<HiringCommittee["review"]>>) {
    return task.assignments ? this.myAssignment(task)?.scores : task.scores;
  }
  myEvidence(task: NonNullable<ReturnType<HiringCommittee["review"]>>) {
    return task.assignments ? this.myAssignment(task)?.evidence : task.evidence;
  }
  score(id: string, value: number) {
    this.answerValues.update((map) => ({...map,[id]:value}));
  }
  submit() {
    const c = this.candidate(), task = c && this.review(c);
    if (!c || !task) return;
    const answers: QuestionAnswer[] = task.questions.map((q) => ({
      questionId: q.id, score: this.answerValues()[q.id] ?? 0,
    }));
    if (this.s.submitEntryReview(c.id, this.stage, answers, this.evidence()))
      this.router.navigate(["/hiring/committee", this.stage]);
  }
}
