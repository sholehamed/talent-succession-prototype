import { inject } from "@angular/core";
import { CanActivateFn, Router, Routes } from "@angular/router";
import { Store } from "./core/store";
import { Role } from "./core/models";
const permit =
  (roles: Role[]): CanActivateFn =>
  () => {
    const s = inject(Store);
    if (roles.includes(s.role())) return true;
    s.notice.set("این بخش برای نقش فعلی در دسترس نیست.");
    return inject(Router).parseUrl("/settings");
  };
const management: Role[] = ["hr", "manager", "executive"];
export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "dashboard/hr" },
  {
    path: "dashboard/development",
    canActivate: [permit(management)],
    loadComponent: () => import("./features/development-dashboard"),
  },
  {
    path: "dashboard/:view",
    canActivate: [permit(management)],
    loadComponent: () => import("./features/dashboard"),
  },
  { path: "jobs", loadComponent: () => import("./features/jobs") },
  { path: "jobs/:id", loadComponent: () => import("./features/jobs") },
  { path: "career-paths", loadComponent: () => import("./features/career") },
  {
    path: "hiring",
    canActivate: [permit(["hr"])],
    loadComponent: () => import("./features/hiring"),
  },
  {
    path: "hiring/:id",
    canActivate: [permit(["hr"])],
    loadComponent: () => import("./features/hiring"),
  },
  {
    path: "people",
    canActivate: [permit([...management, "employee"])],
    loadComponent: () => import("./features/people"),
  },
  {
    path: "people/:id",
    canActivate: [permit([...management, "employee"])],
    loadComponent: () => import("./features/people"),
  },
  {
    path: "evaluations/questions",
    canActivate: [permit(["hr"])],
    loadComponent: () => import("./features/evaluation-questions"),
  },
  {
    path: "evaluations/cycles",
    canActivate: [permit(["hr"])],
    data: { view: "cycles" },
    loadComponent: () => import("./features/evaluations"),
  },
  {
    path: "evaluations/inbox",
    canActivate: [permit(["evaluator"])],
    data: { view: "inbox" },
    loadComponent: () => import("./features/evaluations"),
  },
  {
    path: "evaluations/reports/:id",
    canActivate: [permit([...management, "employee"])],
    data: { view: "report" },
    loadComponent: () => import("./features/evaluations"),
  },
  {
    path: "evaluations/:id/calibration",
    canActivate: [permit(["hr"])],
    data: { view: "calibration" },
    loadComponent: () => import("./features/evaluations"),
  },
  {
    path: "evaluations/:id",
    canActivate: [permit(["hr"])],
    loadComponent: () => import("./features/evaluations"),
  },
  {
    path: "development",
    canActivate: [permit([...management, "employee"])],
    loadComponent: () => import("./features/development"),
  },
  {
    path: "development/idp/:id",
    canActivate: [permit([...management, "employee"])],
    loadComponent: () => import("./features/development"),
  },
  {
    path: "talent/9box",
    canActivate: [permit(management)],
    data: { nine: true },
    loadComponent: () => import("./features/talent"),
  },
  {
    path: "talent/succession",
    canActivate: [permit(management)],
    loadComponent: () => import("./features/talent"),
  },
  { path: "positions/critical", redirectTo: "talent/succession" },
  { path: "knowledge", loadComponent: () => import("./features/knowledge") },
  {
    path: "knowledge/editor",
    canActivate: [permit(["hr", "manager", "employee"])],
    data: { editor: true },
    loadComponent: () => import("./features/knowledge"),
  },
  {
    path: "knowledge/aar",
    canActivate: [permit(["hr", "manager", "employee"])],
    data: { editor: true, aar: true },
    loadComponent: () => import("./features/knowledge"),
  },
  {
    path: "knowledge/:id",
    loadComponent: () => import("./features/knowledge"),
  },
  {
    path: "reports",
    canActivate: [permit(management)],
    data: { reports: true },
    loadComponent: () => import("./features/dashboard"),
  },
  { path: "settings", loadComponent: () => import("./features/settings") },
  { path: "demo/settings", redirectTo: "settings" },
  { path: "**", loadComponent: () => import("./features/not-found") },
];
