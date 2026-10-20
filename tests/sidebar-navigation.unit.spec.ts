import { describe, expect, it } from "vitest";
import type { Role } from "../src/app/core/models";
import { primaryNavigationIcons } from "../src/app/navigation-icons.primary";
import { secondaryNavigationIcons } from "../src/app/navigation-icons.secondary";
import {
  activeNavigationPath, navigationGroupForUrl, navigationGroups,
  navigationPathVisible, visibleNavigationGroups,
} from "../src/app/navigation.config";

describe("grouped sidebar configuration", () => {
  it("uses locally bundled Material SVG icons for every group and destination", () => {
    const icons = { ...primaryNavigationIcons, ...secondaryNavigationIcons };
    const names = [
      ...navigationGroups.map(group => group.icon),
      ...navigationGroups.flatMap(group => group.children.map(item => item.icon)),
      "settings", "expand_more", "chevron_left", "menu", "account_circle",
    ];
    expect(names.length).toBeGreaterThan(30);
    for (const name of names) {
      expect(icons[name], name + " should be registered locally").toBeDefined();
      expect(icons[name]).toMatch(/<svg[^>]*viewBox="0 0 24 24"/);
      expect(icons[name]).toContain("<path");
    }
    expect(new Set(names).size).toBeGreaterThan(15);
  });


  it("preserves all original destinations and has no duplicated paths", () => {
    const all = navigationGroups.flatMap((g) => g.children.map((x) => x.path));
    expect(navigationGroups).toHaveLength(7);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(26);
    expect(all).toEqual(expect.arrayContaining([
      "/dashboard/hr", "/dashboard/development",
      "/people", "/organization/chart", "/organization/units",
      "/organization/positions", "/organization/appointments",
      "/organization/locations", "/jobs", "/career-paths",
      "/hiring", "/hiring/questions", "/hiring/committee/general",
      "/hiring/committee/specialist", "/performance", "/evaluations/campaigns",
      "/evaluations/cycles", "/evaluations/inbox", "/evaluations/questions",
      "/development", "/development/tasks", "/development/templates",
      "/talent/succession", "/talent/9box", "/knowledge", "/reports",
    ]));
    // Settings stays a single, independent entry at the bottom of the drawer.
    expect(all).not.toContain("/settings");
  });

  it("does not expose any empty groups and retains existing visibility per role", () => {
    const expected: Record<Role, string[]> = {
      hr: ["dashboards", "organization", "jobs", "hiring", "evaluations", "development", "knowledge"],
      executive: ["dashboards", "organization", "jobs", "evaluations", "development", "knowledge"],
      manager: ["dashboards", "organization", "jobs", "evaluations", "development", "knowledge"],
      owner: ["jobs", "knowledge"],
      evaluator: ["hiring", "evaluations"],
      employee: ["organization", "development", "knowledge"],
    };
    for (const role of Object.keys(expected) as Role[]) {
      const groups = visibleNavigationGroups(role);
      expect(groups.map((g) => g.id)).toEqual(expected[role]);
      expect(groups.every((g) => g.children.length > 0)).toBe(true);
      expect(groups.flatMap((g) => g.children)
        .every((child) => navigationPathVisible(child.path, role))).toBe(true);
    }
    expect(visibleNavigationGroups("hr").flatMap((g) => g.children.map((c) => c.path)))
      .not.toContain("/development/tasks");
    expect(visibleNavigationGroups("employee").flatMap((g) => g.children.map((c) => c.path)))
      .toContain("/development/tasks");
    expect(visibleNavigationGroups("manager").flatMap((g) => g.children.map((c) => c.path)))
      .not.toContain("/evaluations/campaigns");
  });

  it("routes each management role only to its own dashboard and keeps shared development", () => {
    const cases = [
      { role: "hr" as Role, path: "/dashboard/hr", label: "داشبورد منابع انسانی" },
      { role: "manager" as Role, path: "/dashboard/unit", label: "داشبورد مدیر واحد" },
      { role: "executive" as Role, path: "/dashboard/executive", label: "داشبورد مدیرعامل" },
    ];
    for (const {role, path, label} of cases) {
      const groups = visibleNavigationGroups(role);
      const dashboard = groups.find(g => g.id === "dashboards")!;
      expect(dashboard.children).toHaveLength(2);
      expect(dashboard.children[0]).toMatchObject({path, title: label});
      expect(dashboard.children[1].path).toBe("/dashboard/development");
      expect(activeNavigationPath(path, dashboard)).toBe(path);
      expect(groups.flatMap(g => g.children).filter(x => x.path.startsWith("/dashboard/")))
        .toHaveLength(2);
    }
    for (const role of ["owner", "employee", "evaluator"] as Role[])
      expect(visibleNavigationGroups(role).some(g => g.id === "dashboards")).toBe(false);
  });

  it("expands the correct permitted group for detail URLs and selects the longest child", () => {
    const groups = visibleNavigationGroups("hr");
    const find = (url: string) => navigationGroupForUrl(url, groups);
    expect(find("/evaluations/campaigns/c123?person=p2")?.id).toBe("evaluations");
    expect(find("/hiring/committee/general/entry1")?.id).toBe("hiring");
    expect(find("/organization/appointments")?.id).toBe("organization");
    expect(find("/jobs/j1?job=j1")?.id).toBe("jobs");
    expect(find("/development/idp/d1")?.id).toBe("development");
    expect(find("/settings")).toBeUndefined();
    expect(find("/no-such-page")).toBeUndefined();
    expect(navigationGroupForUrl("/hiring/committee/general/entry1",
      visibleNavigationGroups("employee"))).toBeUndefined();
    const hiring = find("/hiring/committee/general/entry1")!;
    expect(activeNavigationPath("/hiring/committee/general/entry1", hiring))
      .toBe("/hiring/committee/general");
    expect(activeNavigationPath("/hiring/questions", hiring)).toBe("/hiring/questions");
    expect(activeNavigationPath("/jobs/j1", find("/jobs/j1")!)).toBe("/jobs");
    expect(activeNavigationPath("/evaluations/c100", find("/evaluations/c100")!))
      .toBeUndefined();
  });
});
