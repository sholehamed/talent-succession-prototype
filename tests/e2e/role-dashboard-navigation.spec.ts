import { test, expect, Page } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

async function signIn(page: Page, id: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill(id);
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "ورود به رویش" }).click();
  await expect(page.getByRole("combobox", { name: "نقش فعال" })).toBeVisible();
}

async function expectDashboard(page: Page, path: string, heading: string, menu: string) {
  await expect(page).toHaveURL(new RegExp(path.replaceAll("/", "\\/") + "$"));
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: menu, exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main .chips")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "منابع انسانی", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "مدیرعامل", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "مدیر واحد", exact: true })).toHaveCount(0);
}

test("HR sees only HR dashboard; restricted manager/executive URLs redirect, reports survive", async ({page}) => {
  await signIn(page, "p1");
  await expectDashboard(page, "/dashboard/hr", "داشبورد منابع انسانی", "داشبورد منابع انسانی");
  await page.goto("/dashboard/unit");
  await expectDashboard(page, "/dashboard/hr", "داشبورد منابع انسانی", "داشبورد منابع انسانی");
  await page.goto("/dashboard/executive");
  await expectDashboard(page, "/dashboard/hr", "داشبورد منابع انسانی", "داشبورد منابع انسانی");
  await page.goto("/dashboard/undefined");
  await expect(page.getByRole("heading", { name: /صفحه/ })).toBeVisible();
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "گزارش‌ها و تحلیل", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /خروجی CSV/ })).toBeVisible();
  await expect(page.locator("main .chips")).toHaveCount(0);
  await page.goto("/dashboard/development");
  await expect(page.getByRole("heading", { name: "داشبورد توسعه سرمایه انسانی" })).toBeVisible();
});

test("executive and manager role switch updates dashboard link, heading, scope and denies peer routes", async ({page}) => {
  await signIn(page, "p11");
  await expectDashboard(page, "/dashboard/executive", "داشبورد مدیرعامل", "داشبورد مدیرعامل");
  await expect(page.getByRole("link", { name: "داشبورد منابع انسانی", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "داشبورد مدیر واحد", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/hr");
  await expectDashboard(page, "/dashboard/executive", "داشبورد مدیرعامل", "داشبورد مدیرعامل");
  await page.goto("/dashboard/unit");
  await expectDashboard(page, "/dashboard/executive", "داشبورد مدیرعامل", "داشبورد مدیرعامل");

  await page.getByRole("combobox", { name: "نقش فعال" }).click();
  await page.getByRole("option", { name: "مدیر واحد", exact: true }).click();
  await expectDashboard(page, "/dashboard/unit", "داشبورد مدیر واحد", "داشبورد مدیر واحد");
  const orgUnit = page.locator("mat-sidenav .workspace small");
  const unitName = (await orgUnit.textContent())?.split(" · ")[1]?.trim();
  expect(unitName).toBeTruthy();
  await expect(page.getByRole("combobox", { name: "واحد سازمانی" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "واحد سازمانی" })).toContainText(unitName!);
  await expect(page.getByRole("link", { name: "داشبورد مدیرعامل", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/executive");
  await expectDashboard(page, "/dashboard/unit", "داشبورد مدیر واحد", "داشبورد مدیر واحد");
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "گزارش‌ها و تحلیل", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "واحد سازمانی" })).toBeDisabled();
  await page.goto("/dashboard/development");
  await expect(page.getByRole("heading", { name: "داشبورد توسعه سرمایه انسانی" })).toBeVisible();
});

test("direct manager login gets own dashboard; non-management identities cannot open any dashboard", async ({page}) => {
  await signIn(page, "p2");
  await expectDashboard(page, "/dashboard/unit", "داشبورد مدیر واحد", "داشبورد مدیر واحد");
  await page.goto("/dashboard/hr");
  await expectDashboard(page, "/dashboard/unit", "داشبورد مدیر واحد", "داشبورد مدیر واحد");
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await signIn(page, "p12");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.locator(".nav-group-toggle[aria-label='داشبوردها']")).toHaveCount(0);
  await page.goto("/dashboard/executive");
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto("/dashboard/development");
  await expect(page).toHaveURL(/\/jobs$/);
});
