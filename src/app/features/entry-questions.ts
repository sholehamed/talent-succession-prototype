import { Component, computed, inject, signal } from "@angular/core";
import { Store } from "../core/store";
import { competencies, EntryCommitteeStage, EntryQuestion } from "../core/models";
import { entryStageLabel } from "../core/entry-committees";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">منابع انسانی · سنجش بدو استخدام</div>
        <h1>بانک سؤالات و ترکیب کمیته‌های استخدام</h1>
        <p>سؤالات عمومی سازمانی و تخصصی وابسته به شغل؛ هر سؤال به یکی از پنج شایستگی متصل است.</p>
      </div>
      <a mat-button class="secondary" routerLink="/evaluations/questions">بانک سؤالات ۳۶۰/۵۴۰ ←</a>
    </div>
    <div class="info">
      سؤالات زمان ارجاع به کمیته Snapshot می‌شوند؛ تغییر بانک روی پرونده‌های قبلاً ارجاع‌شده اثر ندارد.
      برای ارجاع هر کمیته، حداقل یک سؤال فعال از هر پنج شایستگی لازم است.
    </div>
    <div class="actions" style="margin-bottom:15px">
      <button mat-stroked-button [class.primary]="stage() === 'general'" (click)="setStage('general')">عمومی</button>
      <button mat-stroked-button [class.primary]="stage() === 'specialist'" (click)="setStage('specialist')">تخصصی</button>
    </div>
    @if (stage() === 'specialist') {
      <mat-form-field appearance="outline" style="width:100%;max-width:400px">
        <mat-label>شناسنامه شغلی تخصصی</mat-label>
        <mat-select [ngModel]="jobId()" (ngModelChange)="chooseJob($event)">
          @for (j of s.publishedJobs(); track j.id) {
            <mat-option [value]="j.id">{{ j.title }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
    <div class="grid two">
      <mat-card class="panel">
        <div class="panel-head">
          <div><h2>سؤالات {{ labels[stage()] }}</h2><small>{{ questions().length | fa }} سؤال · {{ activeCount() | fa }} فعال</small></div>
          <button mat-button class="secondary" (click)="reset()">سؤال جدید</button>
        </div>
        @for (q of questions(); track q.id; let i = $index) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ i + 1 | fa }}. {{ q.text }}</strong>
              <small>{{ competencies[q.competencyIndex] }} · {{ q.isActive ? 'فعال' : 'غیرفعال' }}</small>
            </div>
            <button mat-button (click)="edit(q)">ویرایش</button>
            <button mat-button (click)="toggle(q)">{{ q.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی' }}</button>
          </div>
        }
      </mat-card>
      <mat-card class="panel">
        <h2>{{ draftId() ? 'ویرایش سؤال' : 'افزودن سؤال' }}</h2>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>متن سؤال</mat-label>
          <textarea matInput rows="4" [ngModel]="text()" (ngModelChange)="text.set($event)"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شایستگی مرتبط</mat-label>
          <mat-select [ngModel]="competency()" (ngModelChange)="competency.set($event)">
            @for (c of competencies; track c; let i = $index) {
              <mat-option [value]="i">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-button class="primary" (click)="save()">ذخیره سؤال</button>
      </mat-card>
    </div>
    <mat-card class="panel">
      <div class="panel-head"><h2>اعضای {{ labels[stage()] }}</h2><small>تنها اعضای این فهرست برای ارجاع انتخاب می‌شوند.</small></div>
      <div class="grid three">
        @for (p of s.state().people; track p.id) {
          <mat-checkbox [ngModel]="member(p.id)"
            (ngModelChange)="s.setEntryCommitteeMember(stage(), p.id, $event)">
            {{ p.name }} · {{ p.code }}
          </mat-checkbox>
        }
      </div>
    </mat-card>
  `,
})
export default class EntryQuestionsPage {
  readonly s = inject(Store);
  readonly labels = entryStageLabel;
  readonly competencies = competencies;
  readonly stage = signal<EntryCommitteeStage>("general");
  readonly jobId = signal(this.s.publishedJobs()[0]?.id ?? "");
  readonly draftId = signal("");
  readonly text = signal("");
  readonly competency = signal(0);
  readonly questions = computed(() => this.s.state().entryQuestions.filter((q) =>
    q.stage === this.stage() && q.jobId === (this.stage() === "general" ? null : this.jobId()))
    .sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)));
  readonly activeCount = computed(() => this.questions().filter((q) => q.isActive).length);
  setStage(stage: EntryCommitteeStage) { this.stage.set(stage); this.reset(); }
  chooseJob(jobId: string) { this.jobId.set(jobId); this.reset(); }
  member(id: string) {
    return this.s.state().entryCommitteeMembers.some((m) => m.stage === this.stage() && m.personId === id);
  }
  reset() { this.draftId.set(""); this.text.set(""); this.competency.set(0); }
  edit(q: EntryQuestion) { this.draftId.set(q.id); this.text.set(q.text); this.competency.set(q.competencyIndex); }
  save() {
    const original = this.questions().find((q) => q.id === this.draftId());
    if (this.s.saveEntryQuestion({
      id: this.draftId(), stage: this.stage(), jobId: this.stage() === "general" ? null : this.jobId(),
      text: this.text(), competencyIndex: this.competency(), order: original?.order ?? 0,
      isActive: original?.isActive ?? true,
    })) this.reset();
  }
  toggle(q: EntryQuestion) { this.s.saveEntryQuestion({...q,isActive:!q.isActive}); }
}
