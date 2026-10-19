import { Component, computed, inject, input, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "../core/store";
import { Band, bands, Candidate, EntryCommitteeStage, Position, competencies } from "../core/models";
import { combinedEntryScores } from "../core/entry-committees";
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
        <div class="actions">
          <a mat-button class="secondary" routerLink="/hiring/questions">بانک سؤالات و اعضای کمیته‌ها ←</a>
          <span class="badge">{{ candidates().length | fa }} داوطلب</span>
        </div>
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
              <mat-option value="general">کمیته عمومی</mat-option>
              <mat-option value="specialist">کمیته تخصصی</mat-option>
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
          <small>سوابق قبلی و نتایج دو کمیته حفظ می‌شوند.</small>
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
      @if (!c.decision || c.entryWorkflow) {
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>گردش ارجاع کمیته‌های بدو استخدام</h2>
              <small>ابتدا عمومی، سپس تخصصی؛ نمره‌ها فقط از پاسخ به بانک سؤالات استخراج می‌شوند.</small>
            </div>
            <a routerLink="/hiring/questions">بانک سؤالات ←</a>
          </div>
          @if (!c.entryWorkflow && !c.assessments.length) {
            <div class="info">مرحله اول: یک عضو کمیته عمومی را انتخاب و پرسشنامه را به او ارجاع کنید.</div>
            <mat-form-field appearance="outline" style="width:100%;max-width:380px">
              <mat-label>ارزیاب کمیته عمومی</mat-label>
              <mat-select [ngModel]="generalAssignee()" (ngModelChange)="generalAssignee.set($event)">
                @for (member of s.entryMembers('general'); track member.id) {
                  <mat-option [value]="member.id">{{ member.name }} · {{ member.code }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-button class="primary" (click)="refer('general')">ارجاع به کمیته عمومی</button>
          } @else if (c.entryWorkflow; as w) {
            <div class="metric-line">
              <div class="grow">
                <strong>۱. ارزیابی عمومی</strong>
                <small>ارزیاب: {{ s.person(w.general.assignedTo).name }} · {{ w.general.completedAt ? 'تکمیل‌شده' : 'در انتظار پاسخ' }}</small>
              </div>
              <span class="badge">{{ w.general.completedAt ? 'ثبت شده' : 'در جریان' }}</span>
            </div>
            @if (w.general.completedAt) {
              <p>امتیازهای کمیته عمومی: {{ scoreText(w.general.scores ?? []) }} · شواهد: {{ w.general.evidence }}</p>
            }
            <div class="metric-line">
              <div class="grow">
                <strong>۲. ارزیابی تخصصی</strong>
                @if (w.specialist) {
                  <small>ارزیاب: {{ s.person(w.specialist.assignedTo).name }} · {{ w.specialist.completedAt ? 'تکمیل‌شده' : 'در انتظار پاسخ' }}</small>
                } @else { <small>در انتظار ارجاع منابع انسانی</small> }
              </div>
              <span class="badge">{{ w.specialist?.completedAt ? 'ثبت شده' : w.specialist ? 'در جریان' : 'ارجاع نشده' }}</span>
            </div>
            @if (w.general.completedAt && !w.specialist) {
              <mat-form-field appearance="outline" style="width:100%;max-width:380px">
                <mat-label>ارزیاب کمیته تخصصی</mat-label>
                <mat-select [ngModel]="specialistAssignee()" (ngModelChange)="specialistAssignee.set($event)">
                  @for (member of s.entryMembers('specialist'); track member.id) {
                    <mat-option [value]="member.id">{{ member.name }} · {{ member.code }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-button class="primary" (click)="refer('specialist')">ارجاع به کمیته تخصصی</button>
            }
            @if (w.specialist?.completedAt) {
              <p>امتیازهای کمیته تخصصی: {{ scoreText(w.specialist?.scores ?? []) }} · شواهد: {{ w.specialist?.evidence }}</p>
              <div class="panel-head">
                <h3>نتایج شایستگی به تفکیک کمیته</h3>
                <small>امتیاز هر شایستگی از میانگین سؤال‌های همان مرحله محاسبه شده است.</small>
              </div>
              <div class="table-wrap">
                <table class="royesh-table" style="width:100%">
                  <thead><tr>
                    <th>شایستگی</th><th>انتظار شغل</th>
                    <th>کمیته عمومی</th><th>کمیته تخصصی</th><th>جمع‌بندی</th>
                  </tr></thead>
                  <tbody>
                    @for (name of competencies; track name; let i = $index) {
                      <tr>
                        <td>{{ name }}</td>
                        <td>{{ s.job(c.jobId).expected[i] | fa }}</td>
                        <td>{{ w.general.scores?.[i] | fa }}</td>
                        <td>{{ w.specialist.scores?.[i] | fa }}</td>
                        <td><strong>{{ combined(c)?.[i] | fa }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="info">جمع‌بندی کمیته‌ها میانگین مساوی دو مرحله است؛ پتانسیل رشد به‌صورت مستقل و انسانی تأیید می‌شود.</div>
              @if (!latest(c)) {
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>قضاوت انسانی درباره پتانسیل</mat-label>
                    <mat-select [ngModel]="potential()" (ngModelChange)="potential.set($event)">
                      <mat-option value="low">نیازمند رشد</mat-option>
                      <mat-option value="medium">متوسط</mat-option>
                      <mat-option value="high">بالا</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>جمع‌بندی و شواهد منابع انسانی</mat-label>
                    <textarea matInput rows="2" [ngModel]="evidence()" (ngModelChange)="evidence.set($event)"></textarea>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>استدلال پتانسیل</mat-label>
                    <textarea matInput rows="2" [ngModel]="potentialReason()" (ngModelChange)="potentialReason.set($event)"></textarea>
                  </mat-form-field>
                </div>
                <button mat-button class="primary" (click)="finalize()">تأیید جمع‌بندی دو کمیته</button>
              }
            }
          }
        </mat-card>
      }
      @if (!c.decision && !c.entryWorkflow && c.assessments.length > 0) {
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
              @if (a.source === 'committees') { <small>منبع: جمع‌بندی عمومی و تخصصی</small> }
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
            <app-date-field label="تاریخ استخدام و انتصاب (فقط برای استخدام)"
              [ngModel]="hiredAt()" (ngModelChange)="hiredAt.set($event)" />
            <mat-form-field appearance="outline">
              <mat-label>پست سازمانی بلاتصدی (الزامی)</mat-label>
              <mat-select [ngModel]="positionId()" (ngModelChange)="positionId.set($event)" required>
                <mat-option value="">انتخاب پست سازمانی</mat-option>
                @for (position of s.hireablePositions(c.jobId, hiredAt()); track position.id) {
                  <mat-option [value]="position.id">
                    {{ position.title }} · {{ position.code }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>شماره حکم انتصاب (اختیاری)</mat-label>
              <input matInput [ngModel]="appointmentReference()" (ngModelChange)="appointmentReference.set($event)" />
            </mat-form-field>
          </div>
          @if (selectedPosition(); as post) {
            <div class="info">
              <strong>اطلاعات تشکیلاتی پست انتخاب‌شده (فقط خواندنی)</strong>
              <div>شناسنامه شغلی: {{ s.job(post.jobId).title }}</div>
              <div>واحد سازمانی: {{ positionUnit(post) }}</div>
              <div>محل خدمت: {{ positionLocation(post) }}</div>
              <div>پست بالاسری: {{ parentPosition(post) }}</div>
              <div>مدیر مستقیم: {{ positionManager(post) }}</div>
            </div>
          } @else if (!s.hireablePositions(c.jobId, hiredAt()).length) {
            <div class="warning">
              برای این شغل و تاریخ انتخاب‌شده پست قابل انتصاب وجود ندارد.
              ابتدا در <a routerLink="/organization/positions">مدیریت پست‌های سازمانی</a>
              یک پست فعال و بلاتصدی تعریف کنید. پست در مرحله استخدام ساخته نمی‌شود.
            </div>
          } @else {
            <div class="info">پست سازمانی را انتخاب کنید؛ بالاسری و مدیر از چارت به‌صورت خودکار نمایش داده می‌شوند.</div>
          }
          <div class="form-grid">
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
  readonly appointmentReference = signal("");
  readonly generalAssignee = signal("");
  readonly specialistAssignee = signal("");
  readonly positionId = signal("");
  readonly hiredAt = signal(new Date().toISOString().slice(0, 10));
  readonly candidates = computed(() => this.s.state().candidates);
  readonly candidate = computed(() => this.candidates().find((c) => c.id === this.id()));
  readonly selectedPosition = computed(() => this.s.hireablePositions(
    this.candidate()?.jobId ?? "", this.hiredAt(),
  ).find((p) => p.id === this.positionId()));
  positionUnit(post: Position) {
    return this.s.state().organizationUnits.find((u) => u.id === post.unitId)?.name ?? post.unit;
  }
  positionLocation(post: Position) {
    return this.s.state().workLocations.find((l) => l.id === post.locationId)?.name ?? "نامشخص";
  }
  parentPosition(post: Position) {
    return post.parentPositionId
      ? this.s.positionRecord(post.parentPositionId)?.title ?? "نامشخص"
      : "بدون پست بالاسری";
  }
  positionManager(post: Position) {
    return post.parentPositionId
      ? this.s.currentPositionHolder(post.parentPositionId, this.hiredAt())?.name ?? "پست بالاسری بلاتصدی"
      : "بدون مدیر مستقیم";
  }
  readonly filtered = computed(() => this.candidates().filter(
    (c) => c.name.includes(this.search()) &&
      (!this.stage() || this.stageCode(c) === this.stage()),
  ));
  stageCode(c: Candidate) {
    if (c.decision) return c.decision.outcome;
    if (c.assessments.length) return "review";
    if (c.entryWorkflow?.specialist) return "specialist";
    if (c.entryWorkflow) return "general";
    return "unassessed";
  }
  stageLabel(c: Candidate) {
    return ({
      review: "در انتظار تصمیم", unassessed: "در انتظار ارزیابی",
      hired: "استخدام‌شده", declined: "استخدام‌نشده",
      general: "در کمیته عمومی", specialist: "در کمیته تخصصی",
    } as Record<string, string>)[this.stageCode(c)];
  }
  latest(c: Candidate) { return c.assessments.at(-1); }
  combined(c: Candidate) {
    const w = c.entryWorkflow;
    return w?.specialist ? combinedEntryScores(w.general, w.specialist) : null;
  }
  refer(stage: EntryCommitteeStage) {
    const c = this.candidate();
    if (!c) return;
    this.s.referEntry(c.id, stage,
      stage === "general" ? this.generalAssignee() : this.specialistAssignee());
  }
  finalize() {
    const c = this.candidate();
    if (!c) return;
    this.s.finalizeEntryReview(c.id, this.potential(), this.potentialReason(), this.evidence());
  }
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
        code: this.employeeCode(), positionId: this.positionId(),
        hiredAt: this.hiredAt(), referenceNo: this.appointmentReference(),
      } : undefined,
    );
    if (result && result !== "declined") {
      // Keep the decision in the candidate record and allow direct navigation to the new employee.
      this.router.navigate(["/people", result]);
    }
  }
}
