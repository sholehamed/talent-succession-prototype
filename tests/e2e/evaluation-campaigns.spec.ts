import { test, expect } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

test("HR creates and publishes chart-driven evaluation campaigns with individual cycle links", async ({ page }) => {
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
  await page.getByRole("button", { name: "ثبت پیش‌نویس کمپین" }).click();
  await expect(page).toHaveURL(/\/evaluations\/campaigns\/[^/]+$/);
  await expect(page.locator("main")).toContainText("پیش‌نویس");
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const id = before.campaigns[0].id;
  expect(before.cycles.some((x: any) => x.campaignId === id)).toBe(false);

  await page.getByRole("button", { name: "تأیید و انتشار گروهی تکالیف" }).click();
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
