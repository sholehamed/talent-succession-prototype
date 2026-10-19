import { Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "../core/store";
import { UI } from "../shared/ui";

@Component({
  standalone: true,
  imports: [...UI],
  template: `
    <div class="page-header" style="max-width:520px;margin:35px auto 20px">
      <div>
        <div class="eyebrow">ورود به فضای کاری رویش</div>
        <h1>ورود کاربران</h1>
        <p>برای دسترسی به فضای کاری و امکانات متناسب با نقش خود وارد شوید.</p>
      </div>
    </div>
    <mat-card class="panel" style="max-width:520px;margin:0 auto">
      <h2>ورود به حساب کاربری</h2>
      <form (ngSubmit)="submit()">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>شناسه کاربری</mat-label>
          <input matInput autocomplete="username" name="username" [ngModel]="username()"
            (ngModelChange)="username.set($event)" required />
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
  `,
})
export default class Login {
  readonly s = inject(Store);
  private readonly router = inject(Router);
  readonly username = signal("");
  readonly password = signal("");
  readonly error = signal("");
  submit() {
    this.error.set("");
    if (this.s.login(this.username(), this.password()))
      this.router.navigateByUrl(this.s.home());
    else this.error.set(this.s.notice());
  }
}
