import { Component, HostListener, computed, effect, inject, signal } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterOutlet } from "@angular/router";
import { filter, map, startWith } from "rxjs";
import { Store } from "./core/store";
import { Role, roles } from "./core/models";
import {
  activeNavigationPath, navigationGroupForUrl, visibleNavigationGroups,
} from "./navigation.config";
import { UI } from "./shared/ui";
import { registerNavigationIcons } from "./navigation-icons";

@Component({
  selector: "app-root",
  imports: [...UI, RouterOutlet, RouterLink],
  template: ` @if (s.authenticated()) {
    <mat-sidenav-container [autosize]="true" class="app-shell" [class.collapsed]="collapsed() && !handset()">
    <mat-sidenav class="sidebar" position="start" [mode]="handset() ? 'over' : 'side'" [opened]="!handset() || mobile()">
      <a [routerLink]="s.home()" class="brand" (click)="mobile.set(false)"
        ><span class="brand-icon">ت</span
        ><span>تلنت<small>سرمایه انسانی، آینده سازمان</small></span></a
      >
      <div class="workspace">
        <mat-icon class="workspace-symbol" svgIcon="nav-account_circle" aria-hidden="true"/>
        <span>{{ s.currentPerson()?.name }}<small>{{ s.currentPerson()?.id }} · {{ s.currentPerson()?.unit }}</small></span>
      </div>
      <div class="nav-label">فضای مدیریت</div>
      <mat-nav-list class="nav-accordion" aria-label="منوی اصلی">
        @for (group of groups(); track group.id) {
          <div class="nav-group">
            <button type="button" class="nav-group-toggle"
              [class.current]="activeGroupId() === group.id"
              [class.expanded]="expandedGroup() === group.id && (!collapsed() || handset())"
              [attr.aria-label]="group.title"
              [attr.title]="group.title"
              [attr.aria-expanded]="expandedGroup() === group.id && (!collapsed() || handset())"
              [attr.aria-controls]="'sidebar-group-' + group.id"
              (click)="toggleGroup(group.id)">
              <mat-icon class="nav-icon nav-group-icon" [svgIcon]="'nav-' + group.icon" aria-hidden="true"/>
              <span class="nav-group-title">{{ group.title }}</span>
              <mat-icon class="nav-group-chevron" svgIcon="nav-expand_more" aria-hidden="true"/>
            </button>
            @if (expandedGroup() === group.id && (!collapsed() || handset())) {
              <div class="nav-children" role="group" [id]="'sidebar-group-' + group.id" [attr.aria-label]="group.title">
                @for (child of group.children; track child.path) {
                  <a class="nav-item nav-child-item"
                    [routerLink]="child.path"
                    [class.active]="activeLink(group.id) === child.path"
                    [attr.aria-current]="activeLink(group.id) === child.path ? 'page' : null"
                    (click)="mobile.set(false)">
                    <mat-icon class="nav-child-icon" [svgIcon]="'nav-' + child.icon" aria-hidden="true"/>
                    <span class="nav-item-title">{{ child.title }}</span>
                    <mat-icon class="nav-arrow" svgIcon="nav-chevron_left" aria-hidden="true"/>
                  </a>
                }
              </div>
            }
          </div>
        }
      </mat-nav-list>
      @if (s.canAccess()) {
        <div class="sidebar-settings">
          <a routerLink="/settings" class="nav-item nav-settings-item"
            [class.active]="currentPath() === '/settings'"
            [attr.aria-current]="currentPath() === '/settings' ? 'page' : null"
            title="تنظیمات سامانه" (click)="mobile.set(false)">
            <mat-icon class="nav-icon" svgIcon="nav-settings" aria-hidden="true"/>
            <span class="nav-settings-title">تنظیمات سامانه</span>
          </a>
        </div>
      }
      <div class="sidebar-bottom">
        <strong>مدیریت استعداد و جانشین‌پروری</strong>
        <p>شناسنامه‌های شغلی، ارزیابی و توسعه سرمایه انسانی</p>
      </div>
    </mat-sidenav>
    <mat-sidenav-content class="main-shell">
      <mat-toolbar class="topbar">
        <button mat-button class="menu-toggle" aria-label="نمایش منو" (click)="toggleMenu()"><mat-icon svgIcon="nav-menu" aria-hidden="true"/></button>
        <div class="breadcrumb">سرمایه انسانی <span>/</span> فضای مدیریت استعداد</div>
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
          <span>مدیریت استعداد و جانشین‌پروری</span><span>{{ today | faDate }}</span>
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
  private readonly iconRegistry = inject(MatIconRegistry);
  private readonly sanitizer = inject(DomSanitizer);
  readonly s = inject(Store);
  readonly router = inject(Router);
  readonly collapsed = signal(false);
  readonly mobile = signal(false);
  readonly handset = signal(typeof window !== "undefined" && window.innerWidth < 900);
  readonly expandedGroup = signal<string | null>(null);
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly currentPath = computed(() => this.currentUrl().split(/[?#]/, 1)[0]);
  readonly groups = computed(() =>
    this.s.canAccess() ? visibleNavigationGroups(this.s.role()) : [],
  );
  readonly activeGroupId = computed(() =>
    navigationGroupForUrl(this.currentUrl(), this.groups())?.id ?? null,
  );
  readonly today = new Date().toISOString();
  readonly roleEntries = () => this.s.permittedRoles().map((role) => [role, roles[role]] as const);

  constructor() {
    registerNavigationIcons(this.iconRegistry, this.sanitizer);
    // Every completed navigation (including deep links) opens its parent. Manual
    // closing stays possible until the next navigation or role change.
    effect(() => {
      this.currentUrl();
      const activeId = this.activeGroupId();
      this.expandedGroup.set(activeId);
    });
  }

  @HostListener("window:resize") onResize() {
    this.handset.set(window.innerWidth < 900);
    if (!this.handset()) this.mobile.set(false);
  }
  activeLink(groupId: string) {
    const group = this.groups().find((item) => item.id === groupId);
    return group ? activeNavigationPath(this.currentUrl(), group) : undefined;
  }
  toggleGroup(id: string) {
    if (this.collapsed() && !this.handset()) {
      this.collapsed.set(false);
      this.expandedGroup.set(id);
      return;
    }
    this.expandedGroup.update((current) => current === id ? null : id);
  }
  changeRole(role: Role) {
    if (this.s.switchRole(role)) {
      this.s.notice.set("نقش فعال تغییر کرد.");
      this.expandedGroup.set(null);
      this.router.navigateByUrl(this.s.home());
    }
  }
  logout() {
    this.s.logout();
    this.mobile.set(false);
    this.expandedGroup.set(null);
    this.router.navigateByUrl("/login");
  }
  toggleMenu() {
    if (this.handset()) this.mobile.update((value) => !value);
    else this.collapsed.update((value) => !value);
  }
}
