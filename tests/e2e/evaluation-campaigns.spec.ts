import { test, expect } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

test("HR enrolls people on creating period, but only explicitly starts response collection", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p1");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "ورود به رویش" }).click();

  await page.goto("/evaluations/campaigns");
  await expect(page.getByRole("heading", { name: "کمپین‌های ارزیابی دوره‌ای" })).toBeVisible();
  await page.getByRole("textbox", { name: "عنوان دوره ارزیابی" })
    .fill("ارزیابی گروهی آزمایشی");
  await page.getByRole("textbox", { name: "شناسه دوره (یکتا در هر شخص)" })
    .fill("1407-campaign-test");
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(page.getByRole("combobox", { name: "جامعه هدف" })).toBeVisible();
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(page.locator("main")).toContainText("واجد تخصیص خودکار");
  await page.getByRole("button", { name: "ایجاد دوره برای افراد منتخب" }).click();
  await expect(page).toHaveURL(/\/evaluations\/campaigns\/[^/]+$/);
  await expect(page.locator("main")).toContainText("آماده‌سازی");
  await expect(page.locator("main")).toContainText("پرونده‌های ارزیابی افراد");
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const id = before.campaigns[0].id;
  const prepared = before.cycles.filter((x: any) => x.campaignId === id);
  expect(prepared.length).toBeGreaterThan(0);
  expect(prepared.every((x: any) => x.status === "preparing")).toBe(true);
  // No collection is available to evaluators just by creating the period.
  expect(prepared.every((x: any) => x.status !== "collecting")).toBe(true);

  await page.getByRole("button", { name: "تأیید منابع انسانی و شروع پاسخ‌گیری" }).click();
  await expect(page.locator("main")).toContainText("پرونده‌های ارزیابی افراد");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const cycles = state.cycles.filter((x: any) => x.campaignId === id);
  expect(cycles.length).toBeGreaterThan(0);
  expect(state.campaigns[0].status).toBe("active");
  expect(cycles.every((x: any) =>
    x.status === "collecting" && x.questions.length > 0 &&
    x.organizationSnapshot?.positionId && x.assignments.length > 0)).toBe(true);
  await page.getByRole("link", { name: "مدیریت پرونده" }).first().click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);
  await expect(page.locator("main")).toContainText("ارزیابی گروهی آزمایشی");
});

test("ordinary evaluator cannot open HR bulk campaign pages", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p3");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "ورود به رویش" }).click();
  await page.goto("/evaluations/campaigns");
  await expect(page).not.toHaveURL(/\/evaluations\/campaigns$/);
});
