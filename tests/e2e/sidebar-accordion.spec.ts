import { test, expect } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p1");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "ورود به رویش" }).click();
  await expect(page.getByRole("combobox", { name: "نقش فعال" })).toBeVisible();
});

test("sidebar accordion keeps exactly one section open, supports closing and deep links", async ({ page }) => {
  await page.goto("/dashboard/hr");
  const dashboard = page.getByRole("button", { name: "داشبوردها", exact: true });
  const jobs = page.getByRole("button", { name: "مشاغل و مسیر رشد", exact: true });
  const evaluation = page.getByRole("button", { name: "ارزیابی‌ها", exact: true });
  await expect(page.locator(".nav-group-toggle")).toHaveCount(7);
  await expect(dashboard).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('.nav-group-toggle[aria-expanded="true"]')).toHaveCount(1);

  await jobs.click();
  await expect(dashboard).toHaveAttribute("aria-expanded", "false");
  await expect(jobs).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "شناسنامه‌های شغلی" })).toBeVisible();
  await evaluation.click();
  await expect(jobs).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "شناسنامه‌های شغلی" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "کمپین‌های ارزیابی دوره‌ای" })).toBeVisible();
  await evaluation.click();
  await expect(page.locator('.nav-group-toggle[aria-expanded="true"]')).toHaveCount(0);

  await page.goto("/hiring/questions");
  await expect(page.getByRole("button", { name: "جذب و استخدام" }))
    .toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "بانک سؤالات استخدام" }))
    .toHaveAttribute("aria-current", "page");
  await page.goto("/jobs/j1?job=j1");
  await expect(jobs).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "شناسنامه‌های شغلی" }))
    .toHaveAttribute("aria-current", "page");
  await page.goto("/evaluations/campaigns");
  await expect(evaluation).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "کمپین‌های ارزیابی دوره‌ای" }))
    .toHaveAttribute("aria-current", "page");
  await page.goto("/settings");
  await expect(page.locator('.nav-group-toggle[aria-expanded="true"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "تنظیمات سامانه" }))
    .toHaveAttribute("aria-current", "page");
});

test("collapsed groups remain keyboard-clickable and role changes hide forbidden headings", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/dashboard/hr");
  await page.getByRole("button", { name: "نمایش منو" }).click();
  await expect(page.locator("mat-sidenav-container")).toHaveClass(/collapsed/);
  const jobs = page.getByRole("button", { name: "مشاغل و مسیر رشد" });
  await expect(jobs).toBeVisible();
  await jobs.click();
  await expect(page.locator("mat-sidenav-container")).not.toHaveClass(/collapsed/);
  await expect(jobs).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "شناسنامه‌های شغلی" })).toBeVisible();

  await page.getByRole("combobox", { name: "نقش فعال" }).click();
  await page.getByRole("option", { name: "کارمند", exact: true }).click();
  await expect(page.getByRole("button", { name: "ارزیابی‌ها", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "داشبوردها", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "افراد و تشکیلات" })).toBeVisible();
  await expect(page.getByRole("button", { name: "توسعه و جانشین‌پروری" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تنظیمات سامانه" })).toBeVisible();
});
