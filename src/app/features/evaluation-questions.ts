import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { competencies, EvaluationQuestion, Group, groups } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">ارزیابی چندمنبعی</div>
        <h1>مدیریت سؤالات ارزیابی</h1>
        <p>پرسشنامه مستقل برای هر گروه ارزیاب، با ارتباط به شایستگی مشترک.</p>
      </div>
      <a mat-button class="secondary" routerLink="/evaluations/cycles">بازگشت به دوره‌ها ←</a>
    </div>
    <div class="info">
      تغییرات این بخش برای دوره‌هایی است که هنوز پاسخ‌گیری را شروع نکرده‌اند.
      سؤالات دوره‌های آغازشده همراه با ترتیب و متن خودشان ثابت می‌مانند.
    </div>
    <div class="grid four" style="margin-bottom:20px">
      @for (g of groupEntries; track g[0]) {
        <button mat-button class="stat" [class.active]="selectedGroup() === g[0]"
          (click)="chooseGroup(g[0])" [attr.aria-pressed]="selectedGroup() === g[0]">
          <span class="label">{{ g[1] }}</span>
          <strong>{{ count(g[0]) | fa }}</strong>
          <small>سؤال فعال</small>
        </button>
      }
    </div>
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>سؤالات {{ groups[selectedGroup()] }}</h2>
            <small>ترتیب ثبت‌شده در همین گروه، ترتیب نمایش به ارزیاب است.</small>
          </div>
          <button mat-button class="secondary" (click)="newQuestion()">افزودن سؤال</button>
        </div>
        @for (q of visibleQuestions(); track q.id; let i = $index) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ i + 1 | fa }}. {{ q.text }}</strong>
              <small style="display:block">شایستگی: {{ competencies[q.competencyIndex] }} · {{ q.isActive ? "فعال" : "غیرفعال" }}</small>
              <div class="actions">
                <button mat-button (click)="edit(q)">ویرایش</button>
                <button mat-button (click)="toggle(q)">{{ q.isActive ? "غیرفعال کردن" : "فعال کردن" }}</button>
                <button mat-button [disabled]="i === 0" (click)="move(q.id, -1)">↑ بالاتر</button>
                <button mat-button [disabled]="i === visibleQuestions().length - 1" (click)="move(q.id, 1)">↓ پایین‌تر</button>
                <button mat-button (click)="pendingDelete.set(q.id)">حذف</button>
              </div>
              @if (pendingDelete() === q.id) {
                <div class="warning">
                  سؤال از بانک جاری حذف می‌شود؛ نسخه‌های دوره‌های قبلی تغییر نمی‌کنند.
                  <button mat-button (click)="remove(q.id)">تأیید حذف</button>
                  <button mat-button (click)="pendingDelete.set('')">انصراف</button>
                </div>
              }
            </div>
          </div>
        } @empty {
          <div class="empty">برای این گروه سؤال تعریف نشده است.</div>
        }
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <h2>{{ draftId() ? "ویرایش سؤال" : "سؤال جدید" }}</h2>
          @if (draftId()) { <button mat-button (click)="newQuestion()">انصراف از ویرایش</button> }
        </div>
        <p>گروه ارزیاب: <strong>{{ groups[selectedGroup()] }}</strong></p>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>متن سؤال ارزیابی</mat-label>
          <textarea matInput rows="4" [ngModel]="questionText()" (ngModelChange)="questionText.set($event)"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شایستگی مرتبط</mat-label>
          <mat-select [ngModel]="competencyIndex()" (ngModelChange)="competencyIndex.set($event)">
            @for (c of competencies; track c; let i = $index) {
              <mat-option [value]="i">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="actions">
          <button mat-button class="primary" (click)="save()">{{ draftId() ? "ذخیره تغییرات" : "ثبت سؤال جدید" }}</button>
        </div>
      </mat-card>
    </div>
  `,
})
export default class EvaluationQuestions {
  readonly s = inject(Store);
  readonly groupEntries = Object.entries(groups) as [Group, string][];
  readonly groups = groups;
  readonly competencies = competencies;
  readonly selectedGroup = signal<Group>("supervisor");
  readonly questionText = signal("");
  readonly competencyIndex = signal(0);
  readonly draftId = signal("");
  readonly pendingDelete = signal("");
  readonly allQuestions = computed(() => this.s.state().questions);
  readonly visibleQuestions = computed(() => this.allQuestions()
    .filter((q) => q.group === this.selectedGroup())
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
  count(group: Group) {
    return this.allQuestions().filter((q) => q.group === group && q.isActive).length;
  }
  chooseGroup(group: Group) {
    this.selectedGroup.set(group);
    this.newQuestion();
  }
  newQuestion() {
    this.draftId.set("");
    this.questionText.set("");
    this.competencyIndex.set(0);
    this.pendingDelete.set("");
  }
  edit(q: EvaluationQuestion) {
    this.draftId.set(q.id);
    this.questionText.set(q.text);
    this.competencyIndex.set(q.competencyIndex);
  }
  save() {
    const old = this.allQuestions().find((q) => q.id === this.draftId());
    const ok = this.s.saveEvaluationQuestion({
      id: this.draftId(),
      group: this.selectedGroup(),
      text: this.questionText(),
      competencyIndex: this.competencyIndex(),
      order: old?.order ?? 0,
      isActive: old?.isActive ?? true,
    });
    if (ok) this.newQuestion();
  }
  toggle(q: EvaluationQuestion) {
    this.s.saveEvaluationQuestion({ ...q, isActive: !q.isActive });
  }
  move(id: string, direction: -1 | 1) {
    this.s.moveEvaluationQuestion(id, direction);
  }
  remove(id: string) {
    if (this.s.deleteEvaluationQuestion(id)) {
      if (this.draftId() === id) this.newQuestion();
      this.pendingDelete.set("");
    }
  }
}
