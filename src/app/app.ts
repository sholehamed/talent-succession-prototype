import { Component, inject, signal } from "@angular/core";
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
  template: ` <div class="app-shell" [class.collapsed]="collapsed()">
    <aside class="sidebar" [class.mobile-open]="mobile()">
      <a routerLink="/dashboard/hr" class="brand"
        ><span class="brand-icon">ر</span
        ><span>رویش<small>سرمایه انسانی، آینده سازمان</small></span></a
      >
      <div class="workspace">
        <span class="workspace-symbol">◈</span
        ><span>سازمان نمونه آفاق<small>فضای کاری نمایشی</small></span
        ><b>⌄</b>
      </div>
      <div class="nav-label">فضای مدیریت</div>
      @for (n of nav; track n.path) {
        @if (visible(n.path)) {
          <a
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
      <div class="sidebar-bottom">
        <div class="demo-dot"></div>
        <strong>نسخه تعاملی ارائه</strong>
        <p>تمام افراد و داده‌ها ساختگی‌اند.</p>
        <a routerLink="/demo/settings">راهنمای دمو و تنظیمات ←</a>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
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
        <span class="demo-pill">● نسخه نمایشی</span>
        <div class="role-picker">
          <label for="role">نقش دمو</label
          ><select
            id="role"
            [ngModel]="s.role()"
            (ngModelChange)="changeRole($event)"
          >
            @for (r of roleEntries; track r[0]) {
              <option [value]="r[0]">{{ r[1] }}</option>
            }
          </select>
        </div>
        <span class="avatar small">{{ s.role() === "hr" ? "HR" : "آ" }}</span>
      </header>
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
        رویش · نمونه کاربردی مدیریت استعداد<span
          >اطلاعات کمکی برای تصمیم انسانی؛ بدون تصمیم‌گیری خودکار</span
        >
      </footer>
    </div>
    @if (s.notice()) {
      <div class="toast" role="status">
        {{ s.notice()
        }}<button aria-label="بستن پیام" (click)="s.notice.set('')">×</button>
      </div>
    }
  </div>`,
})
export class App {
  s = inject(Store);
  router = inject(Router);
  collapsed = signal(false);
  mobile = signal(false);
  today = new Date().toISOString();
  roleEntries = Object.entries(roles);
  nav = [
    { path: "/dashboard/hr", title: "داشبورد مدیریتی", icon: "▦" },
    { path: "/jobs", title: "شناسنامه‌های شغلی", icon: "▤" },
    { path: "/career-paths", title: "مسیرهای رشد", icon: "↗" },
    { path: "/people", title: "افراد و استعدادها", icon: "♧" },
    { path: "/evaluations/cycles", title: "ارزیابی چندمنبعی", icon: "◎" },
    { path: "/evaluations/inbox", title: "کارتابل ارزیابی", icon: "☑" },
    { path: "/development", title: "توسعه فردی", icon: "◷" },
    { path: "/talent/succession", title: "جانشین‌پروری", icon: "◇" },
    { path: "/talent/9box", title: "نقشه استعداد", icon: "▦" },
    { path: "/knowledge", title: "مدیریت دانش", icon: "▥" },
    { path: "/reports", title: "گزارش‌ها و تحلیل", icon: "▧" },
    { path: "/demo/settings", title: "کنترل دمو", icon: "⚙" },
  ];
  visible(path: string) {
    const r = this.s.role();
    if (r === "hr") return true;
    if (
      ["/jobs", "/career-paths", "/knowledge", "/demo/settings"].includes(path)
    )
      return true;
    if (r === "evaluator") return path === "/evaluations/inbox";
    if (r === "owner") return false;
    if (r === "employee") return ["/people", "/development"].includes(path);
    if (r === "executive")
      return !["/evaluations/cycles", "/evaluations/inbox"].includes(path);
    return !["/evaluations/cycles", "/evaluations/inbox"].includes(path);
  }
  changeRole(r: Role) {
    this.s.role.set(r);
    this.s.notice.set("نقش نمایشی تغییر کرد؛ کنترل دسترسی واقعی نیست.");
    const path = this.router.url;
    if (r === "evaluator") this.router.navigateByUrl("/evaluations/inbox");
    else if (r === "employee") this.router.navigateByUrl("/people/p1");
    else if (
      r === "owner" &&
      !path.startsWith("/jobs") &&
      !path.startsWith("/knowledge")
    )
      this.router.navigateByUrl("/jobs");
    else if (
      !this.visible(
        "/" +
          path
            .split("/")
            .filter(Boolean)
            .slice(0, path.startsWith("/evaluations") ? 2 : 1)
            .join("/"),
      )
    )
      this.router.navigateByUrl("/dashboard/hr");
  }
  toggleMenu() {
    if (window.innerWidth < 900) this.mobile.update((v) => !v);
    else this.collapsed.update((v) => !v);
  }
}
