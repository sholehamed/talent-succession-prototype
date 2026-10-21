import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { Band, bands, competencies, Nomination } from "../core/models";
import { nineBoxProfile } from "../core/nine-box";
import { UI } from "../shared/ui";
import { Chart } from "../shared/chart";
import { PositionRisk } from "./position-risk";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { ProspectiveReviewDialog } from "./prospective-review-dialog";
@Component({
  standalone: true,
  imports: [...UI, Chart, PositionRisk, MatDialogModule],
  template: `<div class="page-header">
      <div>
        <div class="eyebrow">تداوم سازمان، توسعه فرصت‌ها</div>
        <h1>
          {{ nine ? "نقشه استعداد ۹ خانه‌ای" : "جانشین‌پروری و پست‌های کلیدی" }}
        </h1>
        <p>
          {{
            nine
              ? "عملکرد و پتانسیل دو محور مستقل‌اند؛ انتخاب هر خانه افراد آن را نمایش می‌دهد."
              : "شواهد، شکاف‌ها و نظر انسانی برای آمادگی هر فرد در هر پست"
          }}
        </p>
      </div>
      <a
        mat-button
        class="secondary"
        [routerLink]="nine ? '/talent/succession' : '/talent/9box'"
        >{{ nine ? "بررسی جانشینی" : "نقشه استعداد" }} ←</a
      >
    </div>
    <div class="info">
      این الگو از مرجع آموزشی اقتباس شده و الزام مصوب کارفرما نیست. جایگاه ۹
      خانه‌ای یا نتیجه آزمون به‌تنهایی حکم انتصاب ایجاد نمی‌کند.
    </div>
    @if (nine) {
      <div class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline"
            ><mat-label>واحد سازمانی</mat-label><mat-select
              [ngModel]="unit()"
              (ngModelChange)="unit.set($event)"
            >
              <mat-option value="">همه واحدها</mat-option>
              @for (u of s.units(); track u) {
                <mat-option [value]="u">{{ u }}</mat-option>
              }
            </mat-select></mat-form-field><button mat-button (click)="cell.set('')">نمایش همه افراد</button>
        </div>
        <p style="margin-bottom:12px">
          ↑ پتانسیل رشد · عملکرد از چپ به راست افزایش می‌یابد →
        </p>
        @if (unclassified().length) {
          <div class="info">{{ unclassified().length | fa }} فرد هنوز ارزیابی عملکرد یا پتانسیل لازم برای جانمایی در ماتریس را ندارند؛ نمایش در یک خانه بدون داده معتبر انجام نمی‌شود.</div>
        }
        <div class="nine-grid" role="group" aria-label="ماتریس ۹ خانه‌ای استعداد">
          @for (y of ys; track y) {
            @for (x of xs; track x) {
              <button mat-button
                class="nine-cell"
                [ngClass]="'nine-cell--' + nineBoxProfile(x, y).tone"
                [class.active]="cell() === x + '-' + y"
                [attr.aria-pressed]="cell() === x + '-' + y"
                [attr.aria-label]="nineBoxProfile(x, y).title + '، عملکرد ' + bands[x]
                  + '، پتانسیل ' + bands[y] + '، ' + members(x, y).length + ' نفر'"
                (click)="cell.set(x + '-' + y)"
              >
                <span class="nine-cell__heading">
                  <span class="nine-cell__title">{{ nineBoxProfile(x, y).title }}</span>
                  <strong class="nine-cell__count">{{ members(x, y).length | fa }}</strong>
                </span>
                <span class="nine-cell__details">
                  عملکرد {{ bands[x] }} / پتانسیل {{ bands[y] }}
                </span>
              </button>
            }
          }
        </div>
      </div>
      <mat-card class="panel">
        <h2>افراد خانه انتخاب‌شده</h2>
        <div class="table-wrap">
          <table mat-table [dataSource]="selectedPeople()" class="royesh-table">
 <ng-container matColumnDef="person"><th mat-header-cell *matHeaderCellDef>فرد</th><td mat-cell *matCellDef="let p"><a mat-button [routerLink]="['/people', p.id]">{{ p.name }}</a></td></ng-container>
 <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>واحد</th><td mat-cell *matCellDef="let p">{{ p.unit }}</td></ng-container>
 <ng-container matColumnDef="performance"><th mat-header-cell *matHeaderCellDef>عملکرد</th><td mat-cell *matCellDef="let p">{{ bandLabel(p.performance) }}</td></ng-container>
 <ng-container matColumnDef="potential"><th mat-header-cell *matHeaderCellDef>پتانسیل</th><td mat-cell *matCellDef="let p">{{ bandLabel(p.potential) }}</td></ng-container>
 <ng-container matColumnDef="evidence"><th mat-header-cell *matHeaderCellDef>شواهد</th><td mat-cell *matCellDef="let p">{{ p.evidence }}</td></ng-container>
 <tr mat-header-row *matHeaderRowDef="talentColumns"></tr><tr mat-row *matRowDef="let row; columns: talentColumns"></tr>
 </table>
 @if (!selectedPeople().length) {<div class="empty">فردی در این خانه نیست.</div>}
        </div>
      </mat-card>
    } @else {
      <mat-card class="panel">
        <div class="filterbar">
          <mat-form-field appearance="outline" class="search"
            ><mat-label>پست حیاتی</mat-label><mat-select
              [ngModel]="position()?.id ?? ''"
              (ngModelChange)="
                selectPosition($event)
              "
            >
              @for (p of critical(); track p.id) {
                <mat-option [value]="p.id">{{ p.title }}</mat-option>
              }
            </mat-select></mat-form-field>
        </div>
        @if (position(); as p) {
          <div class="grid three">
            <div>
              <small>دارنده فعلی</small>
              <h3>
                @if (s.currentPositionHolder(p.id); as holder) {
                  <a [routerLink]="['/people', holder.id]">{{ holder.name }}</a>
                } @else {
                  <span>بلاتصدی</span>
                }
              </h3>
              <p>{{ p.reason }}</p>
            </div>
            <div>
              <small>ارزیابی ریسک خروج</small>
              <h3>{{ riskStatus(p.id) }}</h3>
              <p>امتیاز معتبر و زمان جایگزینی در بخش ارزیابی ریسک</p>
            </div>
            <div>
              <small>پوشش جانشین آماده</small>
              <h3>
                {{ ready() ? "دارای نامزد با آمادگی A" : "فاقد نامزد آماده" }}
              </h3>
              <a [routerLink]="['/jobs', p.jobId]">شناسنامه شغل هدف ←</a>
            </div>
          </div>
        } @else {
          <div class="empty">پست حیاتی مجازی برای این نقش وجود ندارد.</div>
        }
      </mat-card>
      @if (position(); as p) {
        <app-position-risk [positionId]="p.id" />
        <mat-card class="panel">
          <div class="panel-head">
            <div>
              <h2>ارزیابی آینده‌نگر جانشینان</h2>
              <small>بانک مستقل از شغل؛ فهرست نامزدها و سؤالات در زمان شروع Snapshot می‌شوند.</small>
            </div>
            @if (s.canManageProspective(p.id)) {
              <button mat-button class="primary"
                [disabled]="!!activeProspectiveRun() || !nominations().length"
                (click)="startProspective()">شروع ارزیابی آینده‌نگر</button>
            }
          </div>
          @if (runs().length) {
            <mat-form-field appearance="outline" style="width:100%;max-width:470px">
              <mat-label>دوره ارزیابی آینده‌نگر</mat-label>
              <mat-select [ngModel]="run()?.id ?? ''" (ngModelChange)="selectedRunId.set($event)">
                @for (r of runs(); track r.id) {
                  <mat-option [value]="r.id">{{ r.startedAt | faDate }} · {{ r.positionTitle }} ·
                    {{ r.status === 'active' ? 'در جریان' : 'بسته‌شده' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (run(); as r) {
              <div class="info">
                در {{ r.startedAt | faDate }} تعداد {{ r.nominees.length | fa }} نامزد
                برای «{{ r.positionTitle }}» ثبت شده بودند؛
                {{ r.results.length | fa }} نفر ارزیابی شده‌اند.
                تغییر نامزدها و بانک سؤال بعدی، این Snapshot را تغییر نمی‌دهد.
              </div>
              @if (r.status === 'active' && s.canManageProspective(p.id)) {
                <button mat-button [disabled]="r.results.length !== r.nominees.length"
                  (click)="closeProspective()">بستن دوره ارزیابی</button>
              }
            }
          } @else {
            <div class="info">هنوز ارزیابی آینده‌نگر آغاز نشده است. پس از تعیین نامزدها، دوره را شروع کنید.</div>
          }
          @if (s.role() === 'hr') {
            <div class="actions">
              <a mat-button routerLink="/talent/prospective/indicators">مدیریت شاخص‌ها ←</a>
              <a mat-button routerLink="/talent/prospective/questions">بانک سؤالات ←</a>
            </div>
          }
        </mat-card>
      }
      <div class="grid three">
        @for (n of cardNominations(); track n.id) {
          <mat-card class="panel">
            <div class="panel-head">
              <div class="person-cell">
                <span class="avatar">{{
                  nomineeName(n.personId).slice(0, 1)
                }}</span>
                <h3>
                  <a [routerLink]="['/people', n.personId]">{{
                    nomineeName(n.personId)
                  }}</a>
                </h3>
              </div>
              <span class="badge" [class.green]="n.readiness === 'A'">{{
                n.readiness
              }}</span>
            </div>
            <p>{{ readiness[n.readiness] }}</p>
            <p style="margin:12px 0">{{ n.evidence }}</p>
            <small
              >عملکرد {{ bandLabel(s.person(n.personId).performance) }} · پتانسیل
              {{ bandLabel(s.person(n.personId).potential) }}</small
            >
            <div class="metric-line">
              <span class="grow">مجموع شکاف شایستگی</span
              ><b>{{ sumGap(n.personId) | fa }}</b>
            </div>
            @if (run(); as r) {
              @if (isProspectiveNominee(n.personId)) {
                @if (prospectiveResult(n.personId); as result) {
                  <div class="metric-line">
                    <span class="grow">امتیاز آینده‌نگر (از ۵)</span>
                    <strong>{{ result.score | fa }}</strong>
                  </div>
                  <small>تکمیل‌شده: {{ result.completedAt | faDate }}</small>
                } @else {
                  <div class="info">ارزیابی آینده‌نگر: در انتظار تکمیل</div>
                  @if (r.status === 'active' && s.canManageProspective(r.positionId)) {
                    <button mat-button class="primary" (click)="evaluateProspective(n.personId)">
                      تکمیل ارزیابی آینده‌نگر
                    </button>
                  }
                }
              } @else {
                <small>این نامزد پس از شروع دوره انتخاب شده و در Snapshot جاری نیست.</small>
              }
            }
            <div class="actions">
              <button
                mat-button
                [class.selected]="compare().includes(n.personId)"
                (click)="toggle(n.personId)"
              >
                {{
                  compare().includes(n.personId)
                    ? "حذف از مقایسه"
                    : "افزودن به مقایسه"
                }}
              </button>
              @if (s.editable() && currentNomination(n.personId)) {
                <button mat-button (click)="editCurrentNomination(n.personId)">ثبت نظر آمادگی</button>
              }
            </div>
          </mat-card>
        } @empty {
          <div class="panel empty">برای این پست نامزدی ثبت نشده است.</div>
        }
      </div>
      @if (run(); as r) {
        <mat-card class="panel">
          <div class="panel-head">
            <h2>مقایسه نتایج آینده‌نگر نامزدهای Snapshot</h2>
            <small>همه نامزدهای ثبت‌شده در تاریخ شروع، حتی پس از تغییر فهرست فعلی</small>
          </div>
          <div class="table-wrap">
            <table class="royesh-table" style="width:100%">
              <thead>
                <tr>
                  <th>نامزد در زمان شروع</th><th>آمادگی آن تاریخ</th>
                  @for (indicator of r.indicators; track indicator.id) {
                    <th>{{ indicator.title }}</th>
                  }
                  <th>امتیاز کل / ۵</th>
                </tr>
              </thead>
              <tbody>
                @for (nominee of r.nominees; track nominee.personId) {
                  <tr>
                    <td>{{ nominee.personName }}</td>
                    <td>{{ nominee.readiness }}</td>
                    @for (indicator of r.indicators; track indicator.id) {
                      <td>{{ prospectiveIndicatorScore(nominee.personId,indicator.id) | fa }}</td>
                    }
                    <td>{{ prospectiveResult(nominee.personId)?.score | fa }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="info">نمرات از میانگین برابر شاخص‌ها محاسبه می‌شوند؛
            نتیجه آزمون جایگزین قضاوت انسانی درباره آمادگی A/B/C نیست.</div>
        </mat-card>
      }
      @if (compare().length) {
        <mat-card class="panel">
          <h2>مقایسه شواهد شایستگی با شغل هدف</h2>
          @defer (on viewport) {
            <app-chart
              type="radar"
              [categories]="competencies"
              [series]="series()"
            />
          } @placeholder {
            <div class="empty">مقایسه نامزدها</div>
          }
          <div class="actions">
            @for (id of compare(); track id) {
              <a
                [routerLink]="['/people', id]"
                [queryParams]="{ job: position()!.jobId }"
                >شکاف و IDP {{ s.person(id).name }} ←</a
              >
            }
          </div>
        </mat-card>
      }
      @if (s.editable()) {
        <mat-card class="panel">
          <div class="panel-head">
            <h2>ثبت نامزد و نظر انسانی</h2>
            <button mat-button (click)="newNomination()">+ نامزد جدید</button>
          </div>
          @if (draft) {
            <div class="form-grid">
              <mat-form-field appearance="outline"
                ><mat-label>فرد</mat-label><mat-select [(ngModel)]="draft.personId">
                  @for (p of s.state().people; track p.id) {
                    <mat-option [value]="p.id">{{ p.name }}</mat-option>
                  }
                </mat-select></mat-form-field><mat-form-field appearance="outline"
                ><mat-label>آمادگی برای همین پست</mat-label><mat-select [(ngModel)]="draft.readiness">
                  <mat-option value="A">A — اکنون آماده</mat-option>
                  <mat-option value="B">B — طی ۶ تا ۱۸ ماه</mat-option>
                  <mat-option value="C">C — بیش از ۱۸ ماه</mat-option>
                </mat-select></mat-form-field><mat-form-field appearance="outline" class="full"
                ><mat-label>شواهد و نظر بررسی‌کننده</mat-label><textarea matInput
                  [(ngModel)]="draft.evidence"
                  placeholder="تجربه، بازخورد، ملاحظات و دلیل تصمیم…"
                ></textarea></mat-form-field>
            </div>
            <button mat-button class="primary" (click)="save()">
              ثبت نظر انسانی
            </button>
          } @else {
            <p>
              سطح آمادگی به رابطه فرد و پست متصل است؛ یک فرد می‌تواند برای دو
              پست آمادگی متفاوت داشته باشد.
            </p>
          }
        </mat-card>
      }
    }`,
})
export default class Talent {
  s = inject(Store);
  readonly dialog=inject(MatDialog);
  readonly talentColumns = ["person","unit","performance","potential","evidence"];
  bandLabel(value: string | null) { return bands[value as Band] ?? "—"; }
  readonly nineBoxProfile = nineBoxProfile;
  route = inject(ActivatedRoute);
  nine = !!this.route.snapshot.data["nine"];
  unit = signal("");
  cell = signal("");
  positionId = signal(
    this.route.snapshot.queryParamMap.get("position") ??
    this.s.state().positions.find(p =>
      p.jobId === this.route.snapshot.queryParamMap.get("job") && p.critical)?.id ??
    "pos1",
  );
  compare = signal<string[]>(["p1", "p2"]);
  readonly selectedRunId=signal("");
  draft?: Nomination;
  bands = bands;
  competencies = competencies;
  xs: Band[] = ["low", "medium", "high"];
  ys: Band[] = ["high", "medium", "low"];
  readiness = {
    A: "اکنون آماده — نظر انسانی",
    B: "آمادگی طی ۶ تا ۱۸ ماه",
    C: "آمادگی در بیش از ۱۸ ماه",
  };
  critical = computed(() =>
    this.s
      .state()
      .positions.filter(
        (p) =>
          p.critical && p.isActive !== false &&
          (this.s.role() !== "manager" ||
            (!!p.unitId && p.unitId === this.s.currentUnit(this.s.actor())?.id)),
      ),
  );
  position = computed(() =>
    this.critical().find(p => p.id === this.positionId()) ?? this.critical()[0],
  );
  riskStatus(id: string) {
    return {
      current: "ارزیابی معتبر",
      unassessed: "فاقد ارزیابی مستند",
      stale: "نیازمند بازبینی",
      vacant: "بلاتصدی",
      inactive: "غیرفعال",
    }[this.s.positionRisk(id).status];
  }
  selectPosition(id: string) {
    this.selectedRunId.set("");
    this.positionId.set(id);
    this.draft = undefined;
    this.compare.set([]);
  }
  nominations = computed(() =>
    this.s
      .state()
      .nominations.filter((n) => !!this.position() && n.positionId === this.position()!.id),
  );
  ready = computed(() => this.nominations().some((n) => n.readiness === "A"));
  readonly runs=computed(()=>this.position()
    ? this.s.prospectiveRunsForPosition(this.position()!.id) : []);
  readonly run=computed(()=>this.runs().find(r=>r.id===this.selectedRunId())??this.runs()[0]);
  readonly activeProspectiveRun=computed(()=>this.runs().find(r=>r.status==="active"));
  readonly cardNominations=computed<Nomination[]>(()=>{
    const run=this.run();
    if(!run)return this.nominations();
    return run.nominees.map(n=>({
      id:n.nominationId,personId:n.personId,positionId:run.positionId,
      readiness:n.readiness,evidence:n.nominationEvidence,at:n.nominatedAt,
    }));
  });
  nomineeName(personId:string){
    return this.run()?.nominees.find(n=>n.personId===personId)?.personName ??
      this.s.state().people.find(p=>p.id===personId)?.name ?? "نامزد تاریخی";
  }
  isProspectiveNominee(personId:string){
    return !!this.run()?.nominees.some(n=>n.personId===personId);
  }
  prospectiveResult(personId:string){
    return this.run()?.results.find(r=>r.personId===personId);
  }
  prospectiveIndicatorScore(personId:string,indicatorId:string){
    return this.prospectiveResult(personId)?.indicatorScores.find(i=>i.indicatorId===indicatorId)?.score;
  }
  startProspective(){
    const pos=this.position();
    if(!pos)return;
    const id=this.s.startProspectiveRun(pos.id);
    if(id){this.selectedRunId.set(id);this.compare.set([]);}
  }
  closeProspective(){
    const r=this.run();
    if(r)this.s.closeProspectiveRun(r.id);
  }
  evaluateProspective(personId:string){
    const run=this.run();
    const nominee=run?.nominees.find(n=>n.personId===personId);
    if(!run||!nominee||run.status!=="active"||!this.s.canManageProspective(run.positionId))return;
    this.dialog.open(ProspectiveReviewDialog,{
      width:"740px",maxWidth:"95vw",direction:"rtl",
      data:{run:structuredClone(run),nominee:structuredClone(nominee)},
    });
  }
  people = computed(() =>
    this.s
      .state()
      .people.filter(
        (p) =>
          (!this.unit() || p.unit === this.unit()) &&
          this.s.allowedPerson(p.id),
      ),
  );
  unclassified = computed(() => this.people().filter((p) => !p.performance || !p.potential));
  selectedPeople = computed(() =>
    this.people().filter(
      (p) => !this.cell() || this.cell() === p.performance + "-" + p.potential,
    ),
  );
  series = computed(() => [
    { name: "انتظار شغل", data: this.s.job(this.position()!.jobId).expected },
    ...this.compare().map((id) => ({
      name: this.s.person(id).name,
      data: this.s.scores(id),
    })),
  ]);
  members(x: Band, y: Band) {
    return this.people().filter(
      (p) => p.performance === x && p.potential === y,
    );
  }
  sumGap(id: string) {
    return this.s.gaps(id, this.position()!.jobId).reduce((a, b) => a + b, 0);
  }
  toggle(id: string) {
    if (this.compare().includes(id))
      this.compare.update((v) => v.filter((x) => x !== id));
    else if (this.compare().length < 3) this.compare.update((v) => [...v, id]);
    else this.s.fail("حداکثر سه نفر را هم‌زمان مقایسه کنید.");
  }
  currentNomination(personId:string){
    return this.nominations().find(n=>n.personId===personId);
  }
  editCurrentNomination(personId:string){
    const current=this.currentNomination(personId);
    if(current)this.edit(current);
  }
  edit(n: Nomination) {
    this.draft = structuredClone(n);
  }
  newNomination() {
    this.draft = {
      id: "",
      personId: "p1",
      positionId: this.position()?.id ?? "",
      readiness: "C",
      evidence: "",
      at: "",
    };
  }
  save() {
    if (this.draft && this.s.nominate(this.draft)) this.draft = undefined;
  }
}
