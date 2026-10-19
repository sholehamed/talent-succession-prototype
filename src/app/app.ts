import { Component, HostListener, inject, signal } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { Store } from "./core/store";
import { Role, roles } from "./core/models";
import { UI } from "./shared/ui";
@Component({
  selector: "app-root",
  imports: [...UI, RouterOutlet, RouterLink, RouterLinkActive],
  template: ` @if (s.authenticated()) {
    <mat-sidenav-container [autosize]="true" class="app-shell" [class.collapsed]="collapsed() && !handset()">
    <mat-sidenav class="sidebar" position="start" [mode]="handset() ? 'over' : 'side'" [opened]="!handset() || mobile()">
      <a [routerLink]="s.home()" class="brand"
        ><span class="brand-icon">ت</span
        ><span>تلنت<small>سرمایه انسانی، آینده سازمان</small></span></a
      >
      <div class="workspace">
        <span class="workspace-symbol">◈</span>
        <span>{{ s.currentPerson()?.name }}<small>{{ s.currentPerson()?.id }} · {{ s.currentPerson()?.unit }}</small></span>
      </div>
      <div class="nav-label">فضای مدیریت</div>
      <mat-nav-list>
      @for (n of nav; track n.path) {
        @if (visible(n.path)) {
          <a mat-list-item
            [routerLink]="n.path"
            routerLinkActive="active"
            class="nav-item"
            (click)="mobile.set(false)"
            ><span class="nav-icon">{{ n.icon }}</span
            ><span>{{ n.title }}</span
            ><span class="nav-arrow">‹</span></a
          >
        }
      }
      </mat-nav-list>
      <div class="sidebar-bottom">
        <strong>مدیریت استعداد و جانشین‌پروری</strong>
        <p>شناسنامه‌های شغلی، ارزیابی و توسعه سرمایه انسانی</p>
        <a routerLink="/settings">تنظیمات سامانه ←</a>
      </div>
    </mat-sidenav>
    <mat-sidenav-content class="main-shell">
      <mat-toolbar class="topbar">
        <button
          mat-button
          class="menu-toggle"
          aria-label="نمایش منو"
          (click)="toggleMenu()"
        >
          ☰
        </button>
        <div class="breadcrumb">
          سرمایه انسانی <span>/</span> فضای مدیریت استعداد
        </div>
        <div class="role-picker">
          <mat-form-field appearance="outline">
            <mat-label>نقش فعال</mat-label>
            <mat-select id="role" [ngModel]="s.role()" (ngModelChange)="changeRole($event)">
              @for (r of roleEntries(); track r[0]) {
                <mat-option [value]="r[0]">{{ r[1] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <span class="avatar small">{{ s.currentPerson()?.name?.slice(0, 1) }}</span>
        <button mat-button class="secondary" (click)="logout()">خروج</button>
      </mat-toolbar>
      <main>
        <div class="page-meta">
          <span>مدیریت استعداد و جانشین‌پروری</span
          ><span>{{ today | faDate }}</span>
        </div>
        @if (s.storageWarning()) {
          <div class="warning">{{ s.storageWarning() }}</div>
        }
        <router-outlet />
      </main>
      <footer>
        رویش · مدیریت استعداد و جانشین‌پروری<span
          >اطلاعات کمکی برای تصمیم انسانی؛ بدون تصمیم‌گیری خودکار</span
        >
      </footer>
    @if (s.notice()) {
      <div class="toast" role="status">
        {{ s.notice()
        }}<button mat-button aria-label="بستن پیام" (click)="s.notice.set('')">×</button>
      </div>
    }
    </mat-sidenav-content>
  </mat-sidenav-container>
  } @else {
    <div class="auth-layout"><router-outlet /></div>
  }`,
})
export class App {
  s = inject(Store);
  router = inject(Router);
  collapsed = signal(false);
  mobile = signal(false);
  handset = signal(window.innerWidth < 900);
  @HostListener("window:resize") onResize() {
    this.handset.set(window.innerWidth < 900);
    if (!this.handset()) this.mobile.set(false);
  }
  today = new Date().toISOString();
  roleEntries = () => this.s.permittedRoles().map((role) => [role, roles[role]] as const);
  nav = [
    { path: "/dashboard/hr", title: "داشبورد مدیریتی", icon: "▦" },
    { path: "/dashboard/development", title: "داشبورد توسعه سرمایه انسانی", icon: "↗" },
    { path: "/jobs", title: "شناسنامه‌های شغلی", icon: "▤" },
    { path: "/career-paths", title: "مسیرهای رشد", icon: "↗" },
    { path: "/hiring", title: "ارزیابی بدو استخدام", icon: "⊕" },
    { path: "/people", title: "افراد و استعدادها", icon: "♧" },
    { path: "/performance", title: "ارزیابی عملکرد دوره‌ای", icon: "◫" },
    { path: "/evaluations/cycles", title: "ارزیابی چندمنبعی", icon: "◎" },
    { path: "/evaluations/questions", title: "مدیریت سؤالات ارزیابی", icon: "☷" },
    { path: "/evaluations/inbox", title: "کارتابل ارزیابی", icon: "☑" },
    { path: "/development", title: "توسعه فردی", icon: "◷" },
    { path: "/development/tasks", title: "اقدام‌های من", icon: "☑" },
    { path: "/development/templates", title: "الگوهای اقدام توسعه", icon: "▣" },
    { path: "/talent/succession", title: "جانشین‌پروری", icon: "◇" },
    { path: "/talent/9box", title: "نقشه استعداد", icon: "▦" },
    { path: "/knowledge", title: "مدیریت دانش", icon: "▥" },
    { path: "/reports", title: "گزارش‌ها و تحلیل", icon: "▧" },
    { path: "/settings", title: "تنظیمات", icon: "⚙" },
  ];
  visible(path: string) {
    if (!this.s.canAccess()) return false;
    const r = this.s.role();
    if (r === "hr") return path !== "/development/tasks";
    if (r === "evaluator")
      return ["/evaluations/inbox", "/settings"].includes(path);
    if (r === "employee")
      return ["/people", "/development", "/development/tasks",
        "/knowledge", "/settings"].includes(path);
    if (r === "owner")
      return ["/jobs", "/career-paths", "/knowledge", "/settings"].includes(path);
    if (["/hiring", "/evaluations/cycles", "/evaluations/questions",
      "/evaluations/inbox", "/development/templates", "/development/tasks"].includes(path))
      return false;
    return true;
  }
  changeRole(role: Role) {
    if (this.s.switchRole(role)) {
      this.s.notice.set("نقش فعال تغییر کرد.");
      this.router.navigateByUrl(this.s.home());
    }
  }
  logout() {
    this.s.logout();
    this.mobile.set(false);
    this.router.navigateByUrl("/login");
  }
  toggleMenu() {
    if (this.handset()) this.mobile.update((v) => !v);
    else this.collapsed.update((v) => !v);
  }
}
