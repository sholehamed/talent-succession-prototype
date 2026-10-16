import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { Band, bands, competencies, Nomination } from "../core/models";
import { UI } from "../shared/ui";
import { Chart } from "../shared/chart";
@Component({
  standalone: true,
  imports: [...UI, Chart],
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
        <div class="nine-grid">
          @for (y of ys; track y) {
            @for (x of xs; track x) {
              <button mat-button
                class="nine-cell"
                [class.active]="cell() === x + '-' + y"
                (click)="cell.set(x + '-' + y)"
              >
                <strong>{{ members(x, y).length | fa }}</strong
                >عملکرد {{ bands[x] }} / پتانسیل {{ bands[y] }}
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
              [ngModel]="positionId()"
              (ngModelChange)="
                positionId.set($event); draft = undefined; compare.set([])
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
                <a [routerLink]="['/people', p.holderId]">{{
                  s.person(p.holderId).name
                }}</a>
              </h3>
              <p>{{ p.reason }}</p>
            </div>
            <div>
              <small>احتمال × اثر خروج</small>
              <h3>
                {{ p.probability | fa }} × {{ p.impact | fa }} =
                {{ p.probability * p.impact | fa }}
              </h3>
              <p>برآورد جایگزینی {{ p.months | fa }} ماه</p>
            </div>
            <div>
              <small>پوشش جانشین آماده</small>
              <h3>
                {{ ready() ? "دارای نامزد با آمادگی A" : "فاقد نامزد آماده" }}
              </h3>
              <a [routerLink]="['/jobs', p.jobId]">شناسنامه شغل هدف ←</a>
            </div>
          </div>
        }
      </mat-card>
      <div class="grid three">
        @for (n of nominations(); track n.id) {
          <mat-card class="panel">
            <div class="panel-head">
              <div class="person-cell">
                <span class="avatar">{{
                  s.person(n.personId).name.slice(0, 1)
                }}</span>
                <h3>
                  <a [routerLink]="['/people', n.personId]">{{
                    s.person(n.personId).name
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
              >عملکرد {{ bands[s.person(n.personId).performance] }} · پتانسیل
              {{ bands[s.person(n.personId).potential] }}</small
            >
            <div class="metric-line">
              <span class="grow">مجموع شکاف شایستگی</span
              ><b>{{ sumGap(n.personId) | fa }}</b>
            </div>
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
              @if (s.editable()) {
                <button mat-button (click)="edit(n)">ثبت نظر آمادگی</button>
              }
            </div>
          </mat-card>
        } @empty {
          <div class="panel empty">برای این پست نامزدی ثبت نشده است.</div>
        }
      </div>
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
  readonly talentColumns = ["person","unit","performance","potential","evidence"];
  bandLabel(value: string) { return bands[value as Band] ?? "—"; }
  route = inject(ActivatedRoute);
  nine = !!this.route.snapshot.data["nine"];
  unit = signal("");
  cell = signal("");
  positionId = signal(
    this.s
      .state()
      .positions.find(
        (p) => p.jobId === this.route.snapshot.queryParamMap.get("job"),
      )?.id ?? "pos1",
  );
  compare = signal<string[]>(["p1", "p2"]);
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
          p.critical &&
          (this.s.role() !== "manager" || p.unit === "دفتر پروژه‌ها"),
      ),
  );
  position = computed(() =>
    this.s.state().positions.find((p) => p.id === this.positionId()),
  );
  nominations = computed(() =>
    this.s
      .state()
      .nominations.filter((n) => n.positionId === this.positionId()),
  );
  ready = computed(() => this.nominations().some((n) => n.readiness === "A"));
  people = computed(() =>
    this.s
      .state()
      .people.filter(
        (p) =>
          (!this.unit() || p.unit === this.unit()) &&
          this.s.allowedPerson(p.id),
      ),
  );
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
  edit(n: Nomination) {
    this.draft = structuredClone(n);
  }
  newNomination() {
    this.draft = {
      id: "",
      personId: "p1",
      positionId: this.positionId(),
      readiness: "C",
      evidence: "",
      at: "",
    };
  }
  save() {
    if (this.draft && this.s.nominate(this.draft)) this.draft = undefined;
  }
}
