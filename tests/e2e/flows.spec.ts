import { test, expect, Page } from "@playwright/test";
const roleLabels: Record<string, string> = {
  hr: "کارشناس منابع انسانی", executive: "مدیرعامل", manager: "مدیر واحد",
  owner: "مالک خانواده شغلی", evaluator: "ارزیاب", employee: "کارمند"
};
const selectMaterial = async (p: Page, label: string, option: string) => {
  await p.getByRole("combobox", { name: label }).click();
  await p.getByRole("option", { name: option, exact: true }).click();
};
const role = async (p: Page, r: string) => selectMaterial(p, "نقش دمو", roleLabels[r]);
const nav = async (p: Page, url: string) => {
  await p.goto(url);
  await expect(p.locator("app-root")).not.toBeEmpty();
  await expect(p.locator("main h1, main .empty").first()).toBeVisible();
};
test("all main routes render, RTL, lazy charts and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/dashboard/hr",
    "/dashboard/executive",
    "/dashboard/unit",
    "/jobs",
    "/jobs/j1",
    "/career-paths",
    "/people",
    "/people/p1",
    "/evaluations/cycles",
    "/evaluations/c1",
    "/evaluations/reports/c0",
    "/development",
    "/development/idp/d1",
    "/talent/succession",
    "/talent/9box",
    "/positions/critical",
    "/knowledge",
    "/knowledge/k1",
    "/knowledge/editor",
    "/knowledge/aar",
    "/reports",
    "/demo/settings",
    "/unknown",
  ]) {
    await nav(page, path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
  }
  await nav(page, "/dashboard/hr");
  await expect(page.locator(".apexcharts-canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect.poll(async()=>page.locator(".apexcharts-canvas").evaluate(e=>e.getBoundingClientRect().width)).toBeLessThan(390);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("job approval preserves publication until approved and persists", async ({
  page,
}) => {
  await nav(page, "/jobs/j1");
  await page
    .getByRole("button", { name: "ویرایش شناسنامه", exact: true })
    .click();
  await page.getByLabel("هدایت تیم", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "ذخیره پیش‌نویس", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("نسخه ۱");
  await page
    .getByRole("button", { name: "ارسال برای تأیید", exact: true })
    .click();
  await role(page, "owner");
  await page
    .getByRole("button", { name: "تأیید و انتشار نسخه", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("نسخه ۲");
  await page.reload();
  await expect(page.locator("main")).toContainText("نسخه ۲");
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("royesh.demo.v1")!),
  );
  expect(state.jobs[0].expected[4]).toBe(5);
  expect(state.jobs[0].draft).toBeUndefined();
});
test("full evaluation, calibration, IDP and shared progress", async ({
  page,
}) => {
  await nav(page, "/evaluations/c1");
  await page
    .getByRole("button", { name: "شروع دریافت پاسخ‌ها", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ورود به نقش ارزیاب و کارتابل" })
    .click();
  for (const person of ["p2", "p3", "p4", "p5", "p6", "p7"]) {
    await selectMaterial(page, "شخصیت ارزیاب نمایشی", ({
      p2: "سارا مهر", p3: "نیما روشن", p4: "مهسا سپهر",
      p5: "علی پارسا", p6: "نازنین آذر", p7: "کیان نیک"
    } as Record<string,string>)[person]);
    const pending = page.getByRole("button", { name: "تکمیل پرسشنامه", exact: true });
    await expect(pending).toBeVisible();
    await pending.click();
    if (person === "p2") {
      await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
      await expect(page.getByRole("status")).toContainText("پنج سؤال");
    }
    for (let i = 0; i < 5; i++)
      await page
        .locator(".question").nth(i).getByRole("radio")
        .nth(i === 4 ? 1 : 3)
        .check();
    await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
    await expect(
      page.getByRole("button", { name: "تکمیل پرسشنامه", exact: true }),
    ).toHaveCount(0);
  }
  await role(page, "hr");
  await nav(page, "/evaluations/c1");
  await page
    .getByRole("button", { name: "پایان پاسخ‌گیری و کالیبراسیون" })
    .click();
  await page.getByRole("link", { name: "ورود به کالیبراسیون ←" }).click();
  await page
    .getByLabel("جمع‌بندی بازبینی")
    .fill("شواهد مرور شد. هدایت تیم نیازمند تجربه عملی است.");
  await page
    .getByRole("button", { name: "تأیید کالیبراسیون و آماده‌سازی بازخورد" })
    .click();
  await expect(page.locator("h1")).toContainText("گزارش ارزیابی");
  await expect(page.locator("main")).not.toContainText("سارا مهر");
  await page
    .getByRole("button", { name: "ایجاد / مشاهده برنامه توسعه سه‌اقدامی" })
    .click();
  await page.getByRole("button", { name: "ویرایش و پیگیری" }).first().click();
  await selectMaterial(page, "وضعیت", "انجام‌شده");
  await page.getByRole("button", { name: "ذخیره اقدام", exact: true }).click();
  await expect(page.locator("main")).toContainText("۳۳٪");
  await page.reload();
  await expect(page.locator("main")).toContainText("۳۳٪");
  await nav(page, "/people/p1");
  await expect(page.locator("main")).toContainText("۳۳٪");
  await nav(page, "/dashboard/hr");
  await expect(page.locator("main")).toContainText("۱۰۰");
});
test("AAR review, publication and job linkage", async ({ page }) => {
  await nav(page, "/knowledge/aar");
  await page
    .getByLabel("عنوان", { exact: true })
    .fill("درس‌آموخته آزمایش یکپارچه");
  await page
    .getByLabel("شرح محتوا", { exact: true })
    .fill("شرح ساختگی تجربه برای ارائه");
  for (const label of [
    "۱. چه قصد داشتیم انجام دهیم؟",
    "۲. چه اتفاقی افتاد؟",
    "۳. چرا این اتفاق افتاد؟",
    "۴. چه باید بیاموزیم یا تغییر دهیم؟",
    "۵. اقدام پیگیری چیست؟",
    "مسئول اقدام",
  ])
    await page
      .getByLabel(label, { exact: true })
      .fill("شرح نمونه برای " + label);
  await page
    .getByRole("button", { name: "ذخیره پیش‌نویس", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ارسال برای بازبینی", exact: true })
    .click();
  await role(page, "owner");
  await page
    .getByRole("button", { name: "تأیید و انتشار دانش", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("منتشرشده");
  await nav(page, "/jobs/j1");
  await expect(
    page.getByRole("link", { name: "درس‌آموخته آزمایش یکپارچه" }),
  ).toBeVisible();
});
test("human readiness changes dashboard; filters, mock sync and reset work", async ({
  page,
}) => {
  await nav(page, "/talent/succession");
  await page
    .getByRole("button", { name: "ثبت نظر آمادگی", exact: true })
    .first()
    .click();
  await selectMaterial(page, "آمادگی برای همین پست", "A — اکنون آماده");
  await page
    .getByLabel("شواهد و نظر بررسی‌کننده")
    .fill("جلسه انسانی و شواهد پروژه نمونه بررسی شد");
  await page
    .getByRole("button", { name: "ثبت نظر انسانی", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("دارای نامزد با آمادگی A");
  await nav(page, "/dashboard/hr");
  await expect(page.locator(".stat").nth(3)).toContainText("۴۰");
  await selectMaterial(page, "دوره ارزیابی و توسعه", "تابستان ۱۴۰۵");
  await expect(page.locator(".stat").nth(2)).toContainText("۰");
  await nav(page, "/demo/settings");
  await page.getByRole("button", { name: "اجرای همگام‌سازی Mock" }).click();
  await expect(page.locator("main")).toContainText("۱ ردیف");
  await page.getByRole("button", { name: "بازنشانی دمو", exact: true }).click();
  await page.getByRole("button", { name: "بله، بازنشانی شود" }).click();
  await expect(page.locator("main")).toContainText(
    "هنوز همگام‌سازی اجرا نشده است.",
  );
});
test("role restrictions, invalid ids and corrupted persistence fail gracefully", async ({
  page,
}) => {
  await nav(page, "/dashboard/hr");
  await role(page, "employee");
  await expect(page).toHaveURL(/people\/p1/);
  await page.locator('.nav-item[href="/demo/settings"]').click();
  await page.getByRole("link", { name: "دوره پاییز را شروع کنید" }).click();
  await expect(page).toHaveURL(/demo\/settings/);
  await page.evaluate(() => localStorage.setItem("royesh.demo.v1", "{broken"));
  await page.reload();
  await expect(page.locator("main")).toContainText(
    "ذخیره مرورگر قابل خواندن نیست",
  );
  await nav(page, "/people/missing");
  await expect(page.locator("main")).toContainText("فرد موردنظر یافت نشد");
});

test("Material datepicker writes an ISO day into the existing IDP model", async ({ page }) => {
  await nav(page, "/development/idp/d1");
  await page.getByRole("button", { name: "ویرایش و پیگیری" }).first().click();
  await expect(page.locator("app-date-field mat-datepicker-toggle")).toBeVisible();
  await page.locator("app-date-field mat-datepicker-toggle button").click();
  await expect(page.locator("mat-datepicker-content")).toBeVisible();
  await page.locator("mat-datepicker-content .mat-calendar-body-cell").first().click();
  await page.getByRole("button", { name: "ذخیره اقدام" }).click();
  const due = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!)
    .plans.find((p: any) => p.id === "d1").actions[0].due);
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
