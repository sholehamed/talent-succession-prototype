import { test, expect } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

test("login has no account directory and still authenticates a management account", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "ورود کاربران" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "شناسه کاربری" })).toBeVisible();
  const text = await page.locator("app-root").innerText();
  expect(text).not.toContain("حساب‌های قابل استفاده");
  expect(text).not.toContain("رمز مشترک");
  expect(text).not.toContain(DEFAULT_PASSWORD);
  expect(text).not.toContain("آرمان راد");
  expect(text).not.toContain("پویان فرهمند");
  await expect(page.getByRole("button", { name: "انتخاب" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p1");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "ورود به رویش" }).click();
  await expect(page).toHaveURL(/\/dashboard\/hr$/);
});
