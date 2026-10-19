import type { Role } from "./core/models";

export interface NavigationItem {
  path: string;
  title: string;
}
export interface NavigationGroup {
  id: string;
  title: string;
  icon: string;
  /** URL sections which belong to the group, including detail URLs. */
  sections: string[];
  children: NavigationItem[];
}

/** The original sidebar URLs, regrouped without changing routes. */
export const navigationGroups: NavigationGroup[] = [
  {
    id: "dashboards", title: "داشبوردها", icon: "▦", sections: ["dashboard"],
    children: [
      { path: "/dashboard/hr", title: "داشبورد مدیریتی" },
      { path: "/dashboard/development", title: "داشبورد توسعه سرمایه انسانی" },
    ],
  },
  {
    id: "organization", title: "افراد و تشکیلات", icon: "♧", sections: ["people", "organization"],
    children: [
      { path: "/people", title: "افراد و استعدادها" },
      { path: "/organization/chart", title: "چارت سازمانی" },
      { path: "/organization/units", title: "واحدهای سازمانی" },
      { path: "/organization/positions", title: "پست‌های سازمانی" },
      { path: "/organization/appointments", title: "انتصاب کارکنان" },
      { path: "/organization/locations", title: "محل‌های خدمت" },
    ],
  },
  {
    id: "jobs", title: "مشاغل و مسیر رشد", icon: "▤", sections: ["jobs", "career-paths"],
    children: [
      { path: "/jobs", title: "شناسنامه‌های شغلی" },
      { path: "/career-paths", title: "مسیرهای رشد" },
    ],
  },
  {
    id: "hiring", title: "جذب و استخدام", icon: "⊕", sections: ["hiring"],
    children: [
      { path: "/hiring", title: "ارزیابی بدو استخدام" },
      { path: "/hiring/questions", title: "بانک سؤالات استخدام" },
      { path: "/hiring/committee/general", title: "ارزیابی عمومی" },
      { path: "/hiring/committee/specialist", title: "ارزیابی تخصصی" },
    ],
  },
  {
    id: "evaluations", title: "ارزیابی‌ها", icon: "◎", sections: ["evaluations", "performance"],
    children: [
      { path: "/evaluations/campaigns", title: "کمپین‌های ارزیابی دوره‌ای" },
      { path: "/evaluations/cycles", title: "ارزیابی چندمنبعی ۳۶۰/۵۴۰" },
      { path: "/performance", title: "ارزیابی عملکرد KPI" },
      { path: "/evaluations/inbox", title: "کارتابل ارزیابی" },
      { path: "/evaluations/questions", title: "مدیریت سؤالات ارزیابی" },
    ],
  },
  {
    id: "development", title: "توسعه و جانشین‌پروری", icon: "↗", sections: ["development", "talent"],
    children: [
      { path: "/development", title: "توسعه فردی" },
      { path: "/development/tasks", title: "اقدام‌های من" },
      { path: "/development/templates", title: "الگوهای اقدام توسعه" },
      { path: "/talent/succession", title: "جانشین‌پروری" },
      { path: "/talent/9box", title: "نقشه استعداد ۹ خانه" },
    ],
  },
  {
    id: "knowledge", title: "دانش و گزارش‌ها", icon: "▥", sections: ["knowledge", "reports"],
    children: [
      { path: "/knowledge", title: "مدیریت دانش" },
      { path: "/reports", title: "گزارش‌ها و تحلیل" },
    ],
  },
];

/** Keep existing demo role visibility exactly; routing guards remain authoritative. */
export function navigationPathVisible(path: string, role: Role): boolean {
  if (role === "hr") return path !== "/development/tasks";
  if (path === "/organization/appointments") return false;
  if (role === "evaluator") return [
    "/evaluations/inbox", "/hiring/committee/general", "/hiring/committee/specialist",
  ].includes(path);
  if (role === "employee") return [
    "/people", "/development", "/development/tasks", "/knowledge",
  ].includes(path);
  if (role === "owner") return [
    "/jobs", "/career-paths", "/knowledge",
  ].includes(path);
  if ([
    "/hiring", "/hiring/questions", "/hiring/committee/general",
    "/hiring/committee/specialist", "/evaluations/campaigns",
    "/evaluations/cycles", "/evaluations/questions", "/evaluations/inbox",
    "/development/templates", "/development/tasks",
  ].includes(path)) return false;
  return true;
}

/** No headings with zero permitted children; never leak hidden destinations. */
export function visibleNavigationGroups(role: Role): NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      children: group.children.filter((child) => navigationPathVisible(child.path, role)),
    }))
    .filter((group) => group.children.length > 0);
}

/** Deep routes use the same parent as their list page; preserve query/fragment URLs. */
export function navigationGroupForUrl(
  url: string, groups: NavigationGroup[],
): NavigationGroup | undefined {
  const pathname = url.split(/[?#]/, 1)[0];
  if (pathname === "/settings" || pathname === "/demo/settings") return undefined;
  const section = pathname.split("/")[1];
  return groups.find((group) => group.sections.includes(section));
}

/** Choose the longest matching destination, e.g. /hiring/questions over /hiring. */
export function activeNavigationPath(url: string, group: NavigationGroup): string | undefined {
  const pathname = url.split(/[?#]/, 1)[0];
  return group.children
    .filter((child) => pathname === child.path || pathname.startsWith(child.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
}
