import { Component, computed, inject, input, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "../core/store";
import { Band, bands, Candidate, competencies } from "../core/models";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    @if (!id()) {
      <div class="page-header">
        <div>
          <div class="eyebrow">آغاز چرخه عمر استعداد</div>
          <h1>ارزیابی بدو استخدام</h1>
          <p>ثبت داوطلب، سنجش شایستگی و پتانسیل با شواهد، و تشکیل پرونده پس از تصمیم انسانی</p>
        </div>
        <span class="badge">{{ candidates().length | fa }} داوطلب</span>
      </div>
      <mat-card class="panel">
        <div class="panel-head">
          <div><h2>ثبت داوطلب جدید</h2>
            <small>ابتدا فرد و شغل مورد درخواست را مشخص کنید.</small></div>
        </div>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>نام و نام خانوادگی داوطلب</mat-label>
            <input matInput [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>شغل هدف استخدام</mat-label>
            <mat-select [ngModel]="jobId()" (ngModelChange)="jobId.set($event)">
              @for (job of s.publishedJobs(); track job.id) {
                <mat-option [value]="job.id">{{ job.title }} · {{ job.unit }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="actions">
          <button mat-button class="primary" (click)="register()">ثبت و آغاز ارزیابی</button>
        </div>
      </mat-card>
      <mat-card class="panel">
        <div class="panel-head">
          <div><h2>پرونده‌های جذب و ارزیابی</h2><small>سوابق بدون حذف پس از استخدام حفظ می‌شوند.</small></div>
        </div>
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search">
            <mat-label>جستجوی داوطلب</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>وضعیت پرونده</mat-label>
            <mat-select [ngModel]="stage()" (ngModelChange)="stage.set($event)">
              <mat-option value="">همه</mat-option>
              <mat-option value="unassessed">در انتظار ارزیابی</mat-option>
              <mat-option value="review">در انتظار تصمیم</mat-option>
              <mat-option value="hired">استخدام‌شده</mat-option>
              <mat-option value="declined">استخدام‌نشده</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="royesh-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>داوطلب</th>
              <td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong></td>
            </ng-container>
            <ng-container matColumnDef="job">
              <th mat-header-cell *matHeaderCellDef>شغل هدف</th>
              <td mat-cell *matCellDef="let c">{{ s.job(c.jobId).title }}</td>
            </ng-container>
            <ng-container matColumnDef="stage">
              <th mat-header-cell *matHeaderCellDef>وضعیت</th>
              <td mat-cell *matCellDef="let c"><span class="badge">{{ stageLabel(c) }}</span></td>
            </ng-container>
            <ng-container matColumnDef="count">
              <th mat-header-cell *matHeaderCellDef>نسخه ارزیابی</th>
              <td mat-cell *matCellDef="let c">{{ c.assessments.length | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>جزئیات</th>
              <td mat-cell *matCellDef="let c">
                <a mat-button [routerLink]="['/hiring', c.id]">بررسی پرونده ←</a>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
          @if (!filtered().length) { <div class="empty">داوطلبی با این فیلتر وجود ندارد.</div> }
        </div>
      </mat-card>
    } @else if (candidate(); as c) {
      <div class="page-header">
        <div>
          <div class="eyebrow">پرونده داوطلب · {{ c.createdAt | faDate }}</div>
          <h1>{{ c.name }}</h1>
          <p>{{ s.job(c.jobId).title }} · {{ s.job(c.jobId).unit }}</p>
        </div>
        <a mat-button class="secondary" routerLink="/hiring">بازگشت به داوطلبان ←</a>
      </div>
      <div class="grid three" style="margin-bottom:22px">
        <div class="stat">
          <span class="label">وضعیت پرونده</span>
          <strong style="font-size:22px">{{ stageLabel(c) }}</strong>
        </div>
        <div class="stat">
          <span class="label">ارزیابی‌های ثبت‌شده</span>
          <strong>{{ c.assessments.length | fa }}</strong>
          <small>هر ثبت جدید یک نسخه مستقل است.</small>
        </div>
        <div class="stat">
          <span class="label">نتیجه پتانسیل آخرین ارزیابی</span>
          <strong style="font-size:22px">{{ latest(c)?.potential ? bands[latest(c)!.potential] : "ارزیابی‌نشده" }}</strong>
          <small>قضاوت مستند انسانی؛ مستقل از عملکرد شغلی</small>
        </div>
      </div>
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <h2>مقایسه شایستگی‌ها با شناسنامه شغل</h2>
            <small>مبنای سطح مورد انتظار: شغل هدف؛ امتیاز فرد از آخرین ارزیابی ورودی</small>
          </div>
        </div>
        <div class="table-wrap">
          <table mat-table [dataSource]="competencies" class="royesh-table">
            <ng-container matColumnDef="competency">
              <th mat-header-cell *matHeaderCellDef>شایستگی</th>
              <td mat-cell *matCellDef="let comp">{{ comp }}</td>
            </ng-container>
            <ng-container matColumnDef="expected">
              <th mat-header-cell *matHeaderCellDef>سطح مورد انتظار</th>
              <td mat-cell *matCellDef="let comp; let i = index">{{ s.job(c.jobId).expected[i] | fa }}</td>
            </ng-container>
            <ng-container matColumnDef="observed">
              <th mat-header-cell *matHeaderCellDef>سطح ارزیابی‌شده</th>
              <td mat-cell *matCellDef="let comp; let i = index">{{ latest(c)?.scores?.[i] | fa }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="competencyColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: competencyColumns"></tr>
          </table>
        </div>
      </mat-card>
      @if (!c.decision) {
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>ثبت ارزیابی شایستگی و پتانسیل</h2>
              <small>پنج امتیاز ۱ تا ۵؛ برای سنجش ظرفیت رشد، شواهد و دلیل قضاوت انسانی جدا ثبت می‌شود.</small>
            </div>
          </div>
          <div class="form-grid">
            @for (comp of competencies; track comp; let i = $index) {
              <mat-form-field appearance="outline">
                <mat-label>{{ comp }}</mat-label>
                <mat-select [ngModel]="scores()[i]" (ngModelChange)="setScore(i, $event)">
                  @for (v of levels; track v) {
                    <mat-option [value]="v">{{ v | fa }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            <mat-form-field appearance="outline">
              <mat-label>نتیجه بررسی پتانسیل</mat-label>
              <mat-select [ngModel]="potential()" (ngModelChange)="potential.set($event)">
                <mat-option value="low">نیازمند رشد</mat-option>
                <mat-option value="medium">متوسط</mat-option>
                <mat-option value="high">بالا</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>شواهد مصاحبه و سنجش شایستگی‌ها</mat-label>
              <textarea matInput rows="3" [ngModel]="evidence()" (ngModelChange)="evidence.set($event)"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>استدلال ارزیاب درباره پتانسیل رشد</mat-label>
              <textarea matInput rows="3" [ngModel]="potentialReason()"
                (ngModelChange)="potentialReason.set($event)"></textarea>
            </mat-form-field>
          </div>
          <div class="actions">
            <button mat-button class="primary" (click)="saveAssessment()">ثبت نسخه ارزیابی</button>
          </div>
        </mat-card>
      }
      <mat-card class="panel">
        <div class="panel-head"><h2>تاریخچه ارزیابی‌های ورودی</h2></div>
        @for (a of c.assessments.slice().reverse(); track a.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>پتانسیل: {{ bands[a.potential] }} · {{ a.evaluatedAt | faDate }}</strong>
              <small>{{ a.assessor }} · امتیازهای شایستگی: {{ scoreText(a.scores) }}</small>
              <p>{{ a.evidence }}</p>
              <p>استدلال پتانسیل: {{ a.potentialReason }}</p>
            </div>
          </div>
        } @empty {
          <div class="empty">هنوز ارزیابی اولیه‌ای ثبت نشده است.</div>
        }
      </mat-card>
      @if (!c.decision && latest(c)) {
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>تصمیم نهایی و ورود به سازمان</h2>
              <small>تصمیم با کارشناس منابع انسانی است؛ نتیجه ارزیابی به‌تنهایی موجب استخدام نمی‌شود.</small>
            </div>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>دلیل تصمیم انسانی</mat-label>
              <textarea matInput rows="3" [ngModel]="decisionReason()"
                (ngModelChange)="decisionReason.set($event)"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>کد پرسنلی جدید (فقط برای استخدام)</mat-label>
              <input matInput [ngModel]="employeeCode()" (ngModelChange)="employeeCode.set($event)" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>پست سازمانی بلاتصدی (ترجیحی)</mat-label>
              <mat-select [ngModel]="positionId()" (ngModelChange)="positionId.set($event)">
                <mat-option value="">ایجاد پست جدید طبق مدیر انتخابی</mat-option>
                @for (position of s.vacantPositions(c.jobId, hiredAt()); track position.id) {
                  <mat-option [value]="position.id">
                    {{ position.title }} · {{ position.code }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>مدیر مستقیم (فقط برای استخدام)</mat-label>
              <mat-select [ngModel]="managerId()" (ngModelChange)="managerId.set($event)">
                @for (person of s.state().people; track person.id) {
                  <mat-option [value]="person.id">{{ person.name }} · {{ person.unit }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <app-date-field label="تاریخ استخدام (فقط برای استخدام)"
              [ngModel]="hiredAt()" (ngModelChange)="hiredAt.set($event)" />
          </div>
          <div class="actions">
            <button mat-button class="primary" (click)="decide('hired')">تأیید استخدام و تشکیل پرونده</button>
            <button mat-button class="secondary" (click)="decide('declined')">ثبت عدم استخدام</button>
          </div>
        </mat-card>
      } @else if (c.decision; as decision) {
        <mat-card class="panel">
          <div class="panel-head">
            <div><h2>نتیجه نهایی پرونده</h2><small>{{ decision.decidedAt | faDate }} · {{ decision.reviewer }}</small></div>
            <span class="badge">{{ stageLabel(c) }}</span>
          </div>
          <p>{{ decision.reason }}</p>
          @if (decision.personId) {
            <div class="info">سوابق ارزیابی ورودی به پرونده فرد متصل شده‌اند؛ عملکرد شغلی پس از استخدام هنوز سنجش نشده است.</div>
            <a mat-button class="primary" [routerLink]="['/people', decision.personId]">مشاهده پرونده کارمند ←</a>
          }
        </mat-card>
      }
    } @else {
      <div class="empty">پرونده داوطلب موردنظر یافت نشد.</div>
    }
  `,
})
export default class Hiring {
  readonly s = inject(Store);
  readonly router = inject(Router);
  readonly id = input<string>();
  readonly columns = ["name", "job", "stage", "count", "action"];
  readonly competencyColumns = ["competency", "expected", "observed"];
  readonly competencies = competencies;
  readonly bands = bands;
  readonly levels = [1, 2, 3, 4, 5];
  readonly name = signal("");
  readonly jobId = signal("j1");
  readonly search = signal("");
  readonly stage = signal("");
  readonly scores = signal<number[]>([3, 3, 3, 3, 3]);
  readonly potential = signal<Band>("medium");
  readonly evidence = signal("");
  readonly potentialReason = signal("");
  readonly decisionReason = signal("");
  readonly employeeCode = signal("");
  readonly managerId = signal("p11");
  readonly positionId = signal("");
  readonly hiredAt = signal(new Date().toISOString().slice(0, 10));
  readonly candidates = computed(() => this.s.state().candidates);
  readonly candidate = computed(() => this.candidates().find((c) => c.id === this.id()));
  readonly filtered = computed(() => this.candidates().filter(
    (c) => c.name.includes(this.search()) &&
      (!this.stage() || this.stageCode(c) === this.stage()),
  ));
  stageCode(c: Candidate) {
    if (c.decision) return c.decision.outcome;
    return c.assessments.length ? "review" : "unassessed";
  }
  stageLabel(c: Candidate) {
    return ({
      review: "در انتظار تصمیم", unassessed: "در انتظار ارزیابی",
      hired: "استخدام‌شده", declined: "استخدام‌نشده",
    } as Record<string, string>)[this.stageCode(c)];
  }
  latest(c: Candidate) { return c.assessments.at(-1); }
  scoreText(scores: number[]) { return scores.join(" / "); }
  setScore(index: number, value: number) {
    this.scores.update((s) => s.map((v, i) => i === index ? value : v));
  }
  register() {
    const id = this.s.registerCandidate(this.name(), this.jobId());
    if (id) { this.name.set(""); this.router.navigate(["/hiring", id]); }
  }
  saveAssessment() {
    if (this.s.recordEntryAssessment(
      this.id()!, this.scores(), this.potential(),
      this.evidence(), this.potentialReason(),
    )) {
      this.evidence.set("");
      this.potentialReason.set("");
    }
  }
  decide(outcome: "hired" | "declined") {
    const result = this.s.decideCandidate(
      this.id()!, outcome, this.decisionReason(),
      outcome === "hired" ? {
        code: this.employeeCode(), managerId: this.managerId(),
        positionId: this.positionId() || undefined, hiredAt: this.hiredAt(),
      } : undefined,
    );
    if (result && result !== "declined") {
      // Keep the decision in the candidate record and allow direct navigation to the new employee.
      this.router.navigate(["/people", result]);
    }
  }
}
