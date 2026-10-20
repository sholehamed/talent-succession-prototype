import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { Role, roles } from "../core/models";
import { roleOrder } from "../core/auth";
import { UI } from "../shared/ui";

/** Assign existing application roles to an actual person; no new role definitions. */
@Component({
  standalone: true,
  imports: [...UI],
  styles: [`
    .access-layout {display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.3fr);gap:18px;align-items:start}
    .access-list {max-height:560px;overflow:auto;display:grid;gap:5px}
    .access-person {border:1px solid var(--border, #e5e7eb);background:transparent;border-radius:10px;
      text-align:right;padding:13px;width:100%;cursor:pointer;display:flex;flex-direction:column;gap:5px}
    .access-person.active {background:rgba(63,81,181,.08);border-color:currentColor}
    .role-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .role-cell {border:1px solid var(--border, #e5e7eb);border-radius:10px;padding:8px}
    .role-tags {display:flex;flex-wrap:wrap;gap:6px}
    .role-chip {font-size:12px;background:rgba(100,116,139,.12);border-radius:20px;padding:3px 9px}
    @media(max-width:850px) {.access-layout {grid-template-columns:1fr}.role-grid{grid-template-columns:1fr}}
  `],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">افراد و تشکیلات / مدیریت دسترسی</div>
        <h1>مدیریت نقش‌های کاربران</h1>
        <p>برای هر فرد می‌توانید یک یا چند نقش موجود را اختصاص دهید یا لغو کنید.</p>
      </div>
    </div>
    <div class="info">
      نقش‌های مدیریتی دیگر به شناسه کاربر ثابت وابسته نیستند. تغییرات در همین مرورگر ذخیره می‌شوند؛
      این نسخه هنوز احراز هویت و مجوز سمت سرور ندارد.
    </div>
    @if (s.canAccess(['hr'])) {
      <div class="access-layout">
        <mat-card class="panel">
          <div class="panel-head">
            <h2>انتخاب فرد</h2>
            <small>{{ filtered().length | fa }} نفر</small>
          </div>
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>جستجوی نام، کد پرسنلی یا شناسه</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </mat-form-field>
          <div class="access-list">
            @for (person of filtered(); track person.id) {
              <button type="button" class="access-person" [class.active]="person.id === selectedId()"
                (click)="selectPerson(person.id)">
                <strong>{{ person.name }}</strong>
                <small>{{ person.code }} · {{ person.unit }} · {{ person.id }}</small>
                <span class="role-tags">
                  @for (role of s.rolesOf(person.id); track role) {
                    <span class="role-chip">{{ roleLabels[role] }}</span>
                  }
                </span>
              </button>
            } @empty {
              <div class="empty">فردی با این مشخصات پیدا نشد.</div>
            }
          </div>
        </mat-card>
        <mat-card class="panel">
          @if (selected(); as person) {
            <div class="panel-head">
              <div>
                <h2>دسترسی‌های {{ person.name }}</h2>
                <small>شناسه ورود: {{ person.id }} · {{ person.code }}</small>
              </div>
            </div>
            <p>نقش‌های فعال این فرد مشخص می‌کنند چه صفحاتی و اقداماتی در دسترسش باشد.</p>
            <div class="role-grid">
              @for (role of allRoles; track role) {
                <div class="role-cell">
                  <mat-checkbox [checked]="draft().includes(role)"
                    [disabled]="person.id === s.actor() && role === 'hr'"
                    (change)="toggleRole(role,$event.checked)">
                    {{ roleLabels[role] }}
                  </mat-checkbox>
                </div>
              }
            </div>
            @if (person.id === s.actor()) {
              <p class="info">برای جلوگیری از قطع دسترسی، نقش منابع انسانیِ حساب فعلی قابل حذف نیست.</p>
            }
            @if (draft().length === 0) {
              <p class="warning" role="alert">حداقل یک نقش باید برای فرد باقی بماند.</p>
            }
            @if (changed()) {
              <p class="info">تغییرات هنوز ذخیره نشده‌اند.</p>
            }
            <div class="actions">
              <button mat-button class="primary" [disabled]="!changed() || !draft().length"
                (click)="save()">ذخیره نقش‌های فرد</button>
              <button mat-button [disabled]="!changed()" (click)="discard()">انصراف از تغییرات</button>
            </div>
          } @else {
            <div class="empty">یک فرد را برای مدیریت نقش‌ها انتخاب کنید.</div>
          }
        </mat-card>
      </div>
    } @else {
      <div class="warning" role="alert">مدیریت دسترسی‌ها فقط برای منابع انسانی مجاز است.</div>
    }
  `,
})
export default class AccessManagement {
  readonly s = inject(Store);
  readonly route = inject(ActivatedRoute);
  readonly search = signal("");
  readonly selectedId = signal(this.route.snapshot.queryParamMap.get("person") ?? "");
  readonly draft = signal<Role[]>([]);
  readonly allRoles = roleOrder;
  readonly roleLabels = roles;
  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase();
    return this.s.state().people.filter(p =>
      !q || [p.name, p.code, p.id].some(value => value.toLocaleLowerCase().includes(q)));
  });
  readonly selected = computed(() => this.s.state().people.find(p => p.id === this.selectedId()));
  readonly changed = computed(() => {
    const person = this.selected();
    return !!person && this.allRoles.some(role =>
      this.draft().includes(role) !== this.s.rolesOf(person.id).includes(role));
  });
  constructor() {
    const id = this.selectedId();
    if (id && this.s.state().people.some(p => p.id === id)) this.selectPerson(id);
  }
  selectPerson(id: string) {
    this.selectedId.set(id);
    this.draft.set([...this.s.rolesOf(id)]);
  }
  toggleRole(role: Role, checked: boolean) {
    this.draft.update(list => checked
      ? this.allRoles.filter(r => r === role || list.includes(r))
      : list.filter(r => r !== role));
  }
  discard() {
    if (this.selected()) this.draft.set([...this.s.rolesOf(this.selectedId())]);
  }
  save() {
    if (this.selected() && this.s.setPersonRoles(this.selectedId(),this.draft())) this.discard();
  }
}
