import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { OrganizationUnit, Position, WorkLocation } from "../core/models";
import { UI } from "../shared/ui";

/** Lightweight organizational chart and effective-dated appointments for the prototype. */
@Component({
  standalone: true,
  imports: UI,
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">ساختار سازمانی / تشکیلات</div>
        <h1>{{ pageTitle }}</h1>
        <p>شغل به پست، پست به ساختار و انتصاب به شخص متصل است.</p>
      </div>
      <a mat-button class="secondary" routerLink="/people">پروفایل کارکنان ←</a>
    </div>
    <div class="actions" style="margin-bottom:22px">
      <a mat-stroked-button routerLink="/organization/chart">چارت سازمانی</a>
      <a mat-stroked-button routerLink="/organization/units">واحدهای سازمانی</a>
      <a mat-stroked-button routerLink="/organization/locations">محل خدمت</a>
      <a mat-stroked-button routerLink="/organization/positions">پست‌های سازمانی</a>
      @if (s.canManageOrganization()) {
        <a mat-stroked-button routerLink="/organization/appointments">انتصاب‌ها</a>
      }
    </div>
    @if (view === "chart") {
      <div class="grid three" style="margin-bottom:22px">
        <div class="stat"><span class="label">تعداد پست‌ها</span><strong>{{ s.state().positions.length | fa }}</strong></div>
        <div class="stat"><span class="label">پست بلاتصدی</span><strong>{{ s.vacantPositions().length | fa }}</strong></div>
        <div class="stat"><span class="label">انتصاب‌های ثبت‌شده</span><strong>{{ s.state().appointments.length | fa }}</strong></div>
      </div>
      <div class="info">خطوط سلسله‌مراتب از «پست بالاسری» استخراج می‌شوند، نه عنوان شغلی یا مدیر ذخیره‌شده روی شخص. در صورت بلاتصدی‌بودن پست بالاسری، رابطه پستی همچنان وجود دارد.</div>
      <mat-card class="panel">
        <div class="panel-head">
          <h2>سلسله‌مراتب پست‌ها</h2>
          <a routerLink="/organization/positions">مدیریت ساختار ←</a>
        </div>
        @for (node of s.positionTree(); track node.position.id) {
          <div class="metric-line" [style.padding-right.px]="node.depth * 24 + 12">
            <span class="grow">
              <strong>{{ node.depth ? '↳ ' : '◈ ' }}{{ node.position.title }}</strong>
              <small>{{ node.position.code }} · {{ unitName(node.position.unitId) }} · {{ locationName(node.position.locationId) }}</small>
            </span>
            <span>{{ s.currentPositionHolder(node.position.id)?.name ?? 'بلاتصدی' }}</span>
            @if (node.position.critical) { <span class="badge">حیاتی</span> }
          </div>
        }
      </mat-card>
    } @else if (view === "locations") {
      @if (s.canManageOrganization()) {
        <mat-card class="panel">
          <h2>{{ location.id ? 'ویرایش محل خدمت' : 'ایجاد محل خدمت' }}</h2>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>کد</mat-label>
              <input matInput [(ngModel)]="location.code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>نام محل خدمت</mat-label>
              <input matInput [(ngModel)]="location.name" /></mat-form-field>
          </div>
          <mat-checkbox [(ngModel)]="location.isActive">فعال</mat-checkbox>
          <div class="actions">
            <button mat-button class="primary" (click)="saveLocation()">ذخیره محل خدمت</button>
            <button mat-button (click)="resetLocation()">فرم جدید</button>
          </div>
        </mat-card>
      }
      <mat-card class="panel">
        <h2>محل‌های خدمت</h2>
        @for (x of s.state().workLocations; track x.id) {
          <div class="metric-line">
            <div class="grow"><strong>{{ x.name }}</strong><small>{{ x.code }} · {{ x.isActive ? 'فعال' : 'غیرفعال' }}</small></div>
            @if (s.canManageOrganization()) { <button mat-button (click)="location = clone(x)">ویرایش</button> }
          </div>
        }
      </mat-card>
    } @else if (view === "units") {
      @if (s.canManageOrganization()) {
        <mat-card class="panel">
          <h2>{{ unit.id ? 'ویرایش واحد سازمانی' : 'تعریف واحد سازمانی' }}</h2>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>کد واحد</mat-label><input matInput [(ngModel)]="unit.code"/></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>عنوان واحد</mat-label><input matInput [(ngModel)]="unit.name"/></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>واحد بالاسری</mat-label>
              <mat-select [(ngModel)]="unit.parentUnitId">
                <mat-option [value]="null">واحد ریشه</mat-option>
                @for (x of s.state().organizationUnits; track x.id) {
                  @if (x.id !== unit.id && x.isActive) { <mat-option [value]="x.id">{{ x.name }}</mat-option> }
                }
              </mat-select>
            </mat-form-field>
          </div>
          <mat-checkbox [(ngModel)]="unit.isActive">فعال</mat-checkbox>
          <div class="actions"><button mat-button class="primary" (click)="saveUnit()">ذخیره واحد</button>
            <button mat-button (click)="resetUnit()">فرم جدید</button></div>
        </mat-card>
      }
      <mat-card class="panel"><h2>واحدها و زیرواحدها</h2>
        @for (x of s.state().organizationUnits; track x.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ x.name }}</strong>
              <small>{{ x.code }} · بالاسری: {{ unitName(x.parentUnitId) }} · {{ x.isActive ? 'فعال' : 'غیرفعال' }}</small>
            </div>
            @if (s.canManageOrganization()) { <button mat-button (click)="unit = clone(x)">ویرایش</button> }
          </div>
        }
      </mat-card>
    } @else if (view === "positions") {
      @if (s.canManageOrganization()) {
        <mat-card class="panel">
          <div class="panel-head">
            <h2>{{ position.id ? 'ویرایش پست سازمانی' : 'تعریف پست جدید از شناسنامه شغلی' }}</h2>
            <button mat-button (click)="resetPosition()">پست جدید</button>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>کد پست</mat-label><input matInput [(ngModel)]="position.code"/></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>عنوان پست</mat-label><input matInput [(ngModel)]="position.title"/></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>شناسنامه شغلی</mat-label>
              <mat-select [(ngModel)]="position.jobId">
                @for (j of s.publishedJobs(); track j.id) { <mat-option [value]="j.id">{{ j.title }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>واحد سازمانی</mat-label>
              <mat-select [(ngModel)]="position.unitId">
                @for (u of s.state().organizationUnits; track u.id) {
                  @if (u.isActive) { <mat-option [value]="u.id">{{ u.name }}</mat-option> }
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>محل خدمت</mat-label>
              <mat-select [(ngModel)]="position.locationId">
                @for (l of s.state().workLocations; track l.id) {
                  @if (l.isActive) { <mat-option [value]="l.id">{{ l.name }}</mat-option> }
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>پست بالاسری</mat-label>
              <mat-select [(ngModel)]="position.parentPositionId">
                <mat-option [value]="null">ریشه تشکیلات</mat-option>
                @for (p of s.state().positions; track p.id) {
                  @if (p.id !== position.id && p.isActive !== false) {
                    <mat-option [value]="p.id">{{ p.title }} · {{ p.code }}</mat-option>
                  }
                }
              </mat-select>
            </mat-form-field>
          </div>
          <mat-checkbox [(ngModel)]="position.isActive">پست فعال</mat-checkbox>
          <mat-checkbox [(ngModel)]="position.critical">پست حیاتی</mat-checkbox>
          <div class="actions"><button mat-button class="primary" (click)="savePosition()">ثبت پست سازمانی</button></div>
        </mat-card>
      }
      <mat-card class="panel">
        <div class="panel-head">
          <h2>فهرست پست‌های سازمانی</h2>
          <span>{{ s.state().positions.length | fa }} پست</span>
        </div>
        @for (p of s.state().positions; track p.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ p.title }}</strong>
              <small>{{ p.code }} · {{ s.job(p.jobId).title }} · {{ unitName(p.unitId) }}</small>
              <small>بالاسری: {{ positionName(p.parentPositionId) }} · {{ locationName(p.locationId) }}</small>
            </div>
            <span>{{ s.currentPositionHolder(p.id)?.name ?? 'بلاتصدی' }}</span>
            @if (p.critical && p.isActive !== false) {
              <a mat-button [routerLink]="['/talent/succession']"
                [queryParams]="{ position: p.id }">ارزیابی ریسک ←</a>
            }
            @if (s.canManageOrganization()) { <button mat-button (click)="position = clone(p)">ویرایش</button> }
          </div>
        }
      </mat-card>
    } @else if (view === "appointments") {
      @if (s.canManageOrganization()) {
        <mat-card class="panel">
          <h2>ثبت انتصاب یا انتقال به پست بلاتصدی</h2>
          <div class="info">برای انتقال، انتصاب اصلی قبلی به‌صورت خودکار در روز پیش از تاریخ انتصاب جدید پایان می‌یابد. تاریخچه حذف نمی‌شود.</div>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>شخص</mat-label>
              <mat-select [(ngModel)]="appointmentPersonId">
                @for (p of s.state().people; track p.id) { <mat-option [value]="p.id">{{ p.name }} · {{ p.code }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>پست بلاتصدی مقصد</mat-label>
              <mat-select [(ngModel)]="appointmentPositionId">
                @for (p of s.vacantPositions(); track p.id) {
                  <mat-option [value]="p.id">{{ p.title }} · {{ p.code }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>تاریخ شروع (میلادی)</mat-label>
              <input matInput type="date" [(ngModel)]="appointmentDate" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>شماره حکم / مرجع</mat-label>
              <input matInput [(ngModel)]="appointmentReference"/></mat-form-field>
          </div>
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>توضیح انتصاب</mat-label><textarea matInput [(ngModel)]="appointmentNote"></textarea>
          </mat-form-field>
          <div class="actions"><button mat-button class="primary" (click)="saveAppointment()">ثبت انتصاب</button></div>
        </mat-card>
      }
      <mat-card class="panel">
        <div class="panel-head"><h2>تاریخچه انتصاب‌ها</h2><span>{{ s.state().appointments.length | fa }} رکورد</span></div>
        @for (a of history(); track a.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ personName(a.personId) }} ← {{ positionName(a.positionId) }}</strong>
              <small>از {{ a.effectiveFrom | fa }} تا {{ a.effectiveTo ?? 'جاری' | fa }} · حکم: {{ a.referenceNo || '—' }}</small>
            </div>
            @if (s.canManageOrganization() && !a.effectiveTo) {
              <button mat-button (click)="finish(a.id)">پایان انتصاب</button>
            }
          </div>
        }
      </mat-card>
    }
  `,
})
export default class Organization {
  readonly s = inject(Store);
  private readonly route = inject(ActivatedRoute);
  readonly view: string = this.route.snapshot.data["view"] ?? "chart";
  readonly titles: Record<string, string> = {
    chart: "چارت سازمانی", units: "واحدهای سازمانی",
    locations: "محل‌های خدمت", positions: "پست‌های سازمانی",
    appointments: "انتصاب‌های کارکنان",
  };
  get pageTitle() { return this.titles[this.view] ?? this.titles["chart"]; }
  readonly history = computed(() => [...this.s.state().appointments]
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
  location: WorkLocation = this.blankLocation();
  unit: OrganizationUnit = this.blankUnit();
  position: Position = this.blankPosition();
  appointmentPersonId = "";
  appointmentPositionId = "";
  appointmentDate = new Date().toISOString().slice(0, 10);
  appointmentReference = "";
  appointmentNote = "";
  clone<T>(value: T): T { return structuredClone(value); }
  unitName(id: string | null | undefined) {
    return this.s.state().organizationUnits.find((u) => u.id === id)?.name ?? "ریشه";
  }
  locationName(id: string | undefined) {
    return this.s.state().workLocations.find((l) => l.id === id)?.name ?? "—";
  }
  positionName(id: string | null | undefined) {
    return this.s.state().positions.find((p) => p.id === id)?.title ?? "ریشه";
  }
  personName(id: string) { return this.s.state().people.find((p) => p.id === id)?.name ?? "—"; }
  blankLocation(): WorkLocation { return {id:"",code:"",name:"",isActive:true}; }
  blankUnit(): OrganizationUnit {
    return {id:"",code:"",name:"",parentUnitId:null,isActive:true};
  }
  blankPosition(): Position {
    return {
      id:"",code:"",title:"",jobId:"",unitId:"",locationId:"",
      unit:"",holderId:"",parentPositionId:null,isActive:true,critical:false,
      reason:"",probability:1,impact:1,months:6,
    };
  }
  resetLocation() { this.location = this.blankLocation(); }
  resetUnit() { this.unit = this.blankUnit(); }
  resetPosition() { this.position = this.blankPosition(); }
  saveLocation() {
    if (this.s.saveWorkLocation(this.location)) this.resetLocation();
  }
  saveUnit() { if (this.s.saveOrganizationUnit(this.unit)) this.resetUnit(); }
  savePosition() { if (this.s.saveOrganizationPosition(this.position)) this.resetPosition(); }
  saveAppointment() {
    if (this.s.appointPerson(this.appointmentPersonId, this.appointmentPositionId,
      this.appointmentDate, this.appointmentReference, this.appointmentNote)) {
      this.appointmentPersonId = "";
      this.appointmentPositionId = "";
      this.appointmentReference = "";
      this.appointmentNote = "";
    }
  }
  finish(id: string) {
    this.s.endPositionAppointment(id, new Date().toISOString().slice(0, 10));
  }
}
