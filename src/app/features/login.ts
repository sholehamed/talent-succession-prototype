import { Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "../core/store";
import { DEFAULT_PASSWORD } from "../core/auth";
import { UI } from "../shared/ui";
import { roles } from "../core/models";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    <div class="page-header" style="max-width:880px;margin:35px auto 20px">
      <div>
        <div class="eyebrow">ورود به فضای کاری رویش</div>
        <h1>ورود کاربران</h1>
        <p>برای مشاهده کارتابل، برنامه رشد و صفحات متناسب با نقش خود وارد شوید.</p>
      </div>
    </div>
    <div class="grid two" style="max-width:880px;margin:auto">
      <mat-card class="panel">
        <h2>ورود با شناسه فردی</h2>
        <p>نام کاربری همان شناسه فرد در سامانه است.</p>
        <form (ngSubmit)="submit()">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>شناسه کاربری</mat-label>
            <input matInput autocomplete="username" name="username" [ngModel]="username()"
              (ngModelChange)="username.set($event)" placeholder="p1" required />
          </mat-form-field>
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>رمز عبور</mat-label>
            <input matInput type="password" name="password" autocomplete="current-password"
              [ngModel]="password()" (ngModelChange)="password.set($event)" required />
          </mat-form-field>
          @if (error()) { <div class="warning" role="alert">{{ error() }}</div> }
          <button mat-button class="primary" type="submit">ورود به رویش</button>
        </form>
      </mat-card>
      <mat-card class="panel">
        <h2>حساب‌های قابل استفاده</h2>
        <div class="info">
          رمز مشترک این نسخه: <strong dir="ltr">{{ demoPassword }}</strong>
          <p>برای استفاده عملی از اطلاعات محرمانه، احراز هویت و سطح دسترسی باید در سرور پیاده‌سازی شوند.</p>
        </div>
        @for (p of examplePeople(); track p.id) {
          <div class="metric-line">
            <div class="grow">
              <strong>{{ p.name }}</strong>
              <small style="display:block">{{ p.id }} · {{ p.title }}</small>
            </div>
            <button mat-button (click)="username.set(p.id)">انتخاب</button>
          </div>
        }
        <small>همه افراد ثبت‌شده با شناسه خودشان و همین رمز می‌توانند وارد شوند.</small>
      </mat-card>
    </div>
  `,
})
export default class Login {
  readonly s = inject(Store);
  private readonly router = inject(Router);
  readonly username = signal("");
  readonly password = signal("");
  readonly error = signal("");
  readonly demoPassword = DEFAULT_PASSWORD;
  readonly examplePeople = () => ["p1", "p2", "p11", "p12", "p3"]
    .map((id) => this.s.state().people.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name,
      title: idRoleDescription(p.id) }));
  submit() {
    this.error.set("");
    if (this.s.login(this.username(), this.password()))
      this.router.navigateByUrl(this.s.home());
    else this.error.set(this.s.notice());
  }
}
function idRoleDescription(id: string) {
  const managerRole: Record<string, keyof typeof roles> = {
    p1: "hr", p2: "manager", p11: "executive", p12: "owner",
  };
  return roles[managerRole[id] ?? "employee"];
}
