import { test, expect, Page } from "@playwright/test";
const roleLabels: Record<string, string> = {
  hr: "کارشناس منابع انسانی", executive: "مدیرعامل", manager: "مدیر واحد",
  owner: "مالک خانواده شغلی", evaluator: "ارزیاب", employee: "کارمند"
};
const selectMaterial = async (p: Page, label: string, option: string) => {
  await p.getByRole("combobox", { name: label }).click();
  await p.getByRole("option", { name: option, exact: true }).click();
};
const role = async (p: Page, r: string) => selectMaterial(p, "نقش کاربری", roleLabels[r]);
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
    "/hiring",
    "/hiring/cand1",
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
    "/settings",
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
test("Material sidenav collapses cleanly and opens mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await nav(page, "/dashboard/hr");
  const content = page.locator("mat-sidenav-content");
  const before = await content.boundingBox();
  await page.getByRole("button", { name: "نمایش منو" }).click();
  await expect(page.locator("mat-sidenav-container")).toHaveClass(/collapsed/);
  await expect(page.locator("mat-sidenav .nav-item .nav-icon").first()).toBeVisible();
  await expect(page.locator("mat-sidenav .nav-item .nav-arrow").first()).toBeHidden();
  await expect.poll(async () => (await content.boundingBox())?.width ?? 0)
    .toBeGreaterThan((before?.width ?? 0) + 90);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("mat-sidenav")).not.toHaveClass(/mat-drawer-opened/);
  await page.getByRole("button", { name: "نمایش منو" }).click();
  await expect(page.locator("mat-sidenav")).toHaveClass(/mat-drawer-opened/);
  await page.locator("mat-sidenav a.nav-item").filter({ hasText: "شناسنامه‌های شغلی" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.locator("mat-sidenav")).not.toHaveClass(/mat-drawer-opened/);
});

test("application shows product UI without presentation labels", async ({ page }) => {
  for (const path of [
    "/dashboard/hr", "/jobs/j1", "/people/p1", "/evaluations/cycles",
    "/knowledge", "/talent/succession", "/settings",
  ]) {
    await nav(page, path);
    await expect(page.locator("main")).not.toContainText(
      /دمو|نسخه نمایشی|نسخه تعاملی ارائه|سناریوی آماده|راهنمای جلسه ارائه|داده(?:‌| )?ساختگی|فرد ساختگی/
    );
  }
  await expect(page.locator("mat-toolbar")).not.toContainText("نسخه نمایشی");
  await expect(page.locator("mat-sidenav")).toContainText("تنظیمات");
  await page.goto("/demo/settings");
  await expect(page).toHaveURL(/\/settings$/);
});

test("job to person to evaluation navigation preserves selected context for different jobs", async ({ page }) => {
  await nav(page, "/jobs/j1");
  await expect(page.getByRole("heading", { name: "افراد مرتبط با شغل" })).toBeVisible();
  await page.getByRole("link", { name: "افراد و تحلیل شکاف", exact: true }).click();
  await expect(page).toHaveURL(/\/people\?job=j1$/);
  await expect(page.getByRole("row").filter({ hasText: "آرمان راد" })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "آرمان راد" })
    .getByRole("link", { name: "پروفایل" }).click();
  await expect(page).toHaveURL(/\/people\/p1\?job=j1$/);
  await expect(page.getByRole("combobox", { name: "شغل هدف" })).toContainText("مدیر پروژه");
  await page.getByRole("link", { name: "ارزیابی فرد برای این شغل" }).click();
  await expect(page).toHaveURL(/\/evaluations\/cycles\?job=j1&person=p1$/);
  await expect(page.getByRole("combobox", { name: "ارزیابی‌شونده" })).toContainText("آرمان راد");
  await expect(page.getByRole("combobox", { name: "شغل هدف" })).toContainText("مدیر پروژه");

  await nav(page, "/jobs/j2");
  await page.getByRole("link", { name: "افراد و تحلیل شکاف", exact: true }).click();
  await expect(page).toHaveURL(/\/people\?job=j2$/);
  await expect(page.getByRole("row").filter({ hasText: "سارا مهر" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "آرمان راد" })).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "سارا مهر" })
    .getByRole("link", { name: "پروفایل" }).click();
  await expect(page).toHaveURL(/\/people\/p2\?job=j2$/);
  await expect(page.getByRole("combobox", { name: "شغل هدف" })).toContainText("سرپرست عملیات");
  await page.getByRole("link", { name: "برنامه‌های این شغل" }).click();
  await expect(page).toHaveURL(/\/development\?person=p2&job=j2$/);
  await expect(page.locator("main")).toContainText("برنامه‌ای یافت نشد");
  await nav(page, "/people/p2?job=j2");
  await page.getByRole("button", { name: "ایجاد / مشاهده برنامه توسعه" }).click();
  await expect(page).toHaveURL(/\/development\/idp\/[^/]+$/);
  await expect(page.locator("main")).toContainText("سارا مهر");
  await expect(page.locator("main")).toContainText("سرپرست عملیات");
  await page.getByRole("link", { name: "پروفایل و تحلیل شکاف" }).click();
  await expect(page).toHaveURL(/\/people\/p2\?job=j2$/);
  await page.getByRole("link", { name: "برنامه‌های این شغل" }).click();
  await expect(page.getByRole("row").filter({ hasText: "سارا مهر" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "آرمان راد" })).toHaveCount(0);

  await nav(page, "/people/p2");
  await expect(page.getByRole("combobox", { name: "شغل هدف" })).toContainText("سرپرست عملیات");
  await nav(page, "/people/p2?job=nonexistent");
  await expect(page.getByRole("combobox", { name: "شغل هدف" })).toContainText("سرپرست عملیات");
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
    await selectMaterial(page, "انتخاب ارزیاب", ({
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
    .getByRole("button", { name: "ایجاد برنامه توسعه این دوره" })
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
test("development dashboard shows distinct KPIs with correct empty states and filters", async ({ page }) => {
  await nav(page, "/dashboard/development");
  await expect(page.getByRole("heading", { name: "داشبورد توسعه سرمایه انسانی" })).toBeVisible();
  await expect(page.locator(".stat")).toHaveCount(3);
  await expect(page.locator(".stat").nth(0)).toContainText("پیشرفت اقدامات توسعه");
  await expect(page.locator(".stat").nth(0)).toContainText("۳۳٪");
  await expect(page.locator(".stat").nth(1)).toContainText("اثربخشی تأییدشده توسط مدیر");
  await expect(page.locator(".stat").nth(1)).toContainText("—");
  await expect(page.locator(".stat").nth(2)).toContainText("تغییر شایستگی بین دوره‌ها");
  await expect(page.locator(".stat").nth(2)).toContainText("—");

  await selectMaterial(page, "دوره ارزیابی و توسعه", "تابستان ۱۴۰۵");
  await expect(page.locator(".stat").nth(0)).toContainText("—");
  await expect(page.locator("main")).toContainText("دو دوره ارزیابی منتشرشده");
  await selectMaterial(page, "دوره ارزیابی و توسعه", "پاییز ۱۴۰۵");
  await selectMaterial(page, "واحد سازمانی", "عملیات");
  await page.getByRole("link", { name: "مشاهده برنامه‌ها" }).click();
  await expect(page).toHaveURL(/\/development\?unit=/);
  await expect(page.locator("main")).toContainText("عملیات");

  await nav(page, "/dashboard/hr");
  await expect(page.getByRole("link", { name: "داشبورد توسعه سرمایه انسانی" })).toBeVisible();
});

test("two evaluation cycles create distinct IDP versions with preserved history", async ({ page }) => {
  // Existing approved summer assessment
  await nav(page, "/evaluations/reports/c0");
  await page.getByRole("button", { name: "ایجاد برنامه توسعه این دوره" }).click();
  await expect(page).toHaveURL(/\/development\/idp\/[^/]+$/);
  const firstUrl = page.url();
  await expect(page.locator("main")).toContainText("نسخه ۱");
  await expect(page.locator("main")).toContainText("ارزیابی تابستان ۱۴۰۵");
  await page.getByRole("button", { name: "ویرایش و پیگیری" }).first().click();
  await selectMaterial(page, "وضعیت", "انجام‌شده");
  await page.getByRole("button", { name: "ذخیره اقدام" }).click();
  await expect(page.locator("main")).toContainText("۳۳٪");

  await nav(page, "/evaluations/reports/c0");
  await page.getByRole("button", { name: /مشاهده برنامه توسعه نسخه/ }).click();
  await expect(page).toHaveURL(/\/development\/idp\/[^/]+$/);
  expect(page.url()).toBe(firstUrl);

  // Move the newer seed assessment through the real evaluation workflow.
  await nav(page, "/evaluations/c1");
  await page.getByRole("button", { name: "شروع دریافت پاسخ‌ها" }).click();
  await page.getByRole("button", { name: "ورود به نقش ارزیاب و کارتابل" }).click();
  for (const evaluator of [
    "سارا مهر", "نیما روشن", "مهسا سپهر", "علی پارسا", "نازنین آذر", "کیان نیک"
  ]) {
    await selectMaterial(page, "انتخاب ارزیاب", evaluator);
    await page.getByRole("button", { name: "تکمیل پرسشنامه" }).click();
    for (let i = 0; i < 5; i++)
      await page.locator(".question").nth(i).getByRole("radio").nth(3).check();
    await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
  }
  await role(page, "hr");
  await nav(page, "/evaluations/c1");
  await page.getByRole("button", { name: "پایان پاسخ‌گیری و کالیبراسیون" }).click();
  await page.getByRole("link", { name: "ورود به کالیبراسیون ←" }).click();
  await page.getByLabel("جمع‌بندی بازبینی").fill("سوابق و شواهد دوره جدید مرور شد");
  await page.getByRole("button", { name: "تأیید کالیبراسیون و آماده‌سازی بازخورد" }).click();
  await page.getByRole("button", { name: "ایجاد برنامه توسعه این دوره" }).click();
  await expect(page.locator("main")).toContainText("نسخه ۲");
  await expect(page.locator("main")).toContainText("ارزیابی پاییز ۱۴۰۵");
  await expect(page.locator("main")).toContainText("مبنای شایستگی در زمان ایجاد این نسخه");
  await expect(page.locator("main")).toContainText("مقایسه شایستگی در دو دوره ارزیابی");
  await expect(page.locator("main")).toContainText("تغییر میانگین شکاف");
  const secondUrl = page.url();
  expect(secondUrl).not.toBe(firstUrl);

  await nav(page, "/people/p1?job=j1");
  await expect(page.getByRole("link", { name: /مدیر پروژه · نسخه/ })).toHaveCount(2);
  await nav(page, new URL(firstUrl).pathname);
  await expect(page.locator("main")).toContainText("نسخه قبلی برنامه");
  await expect(page.getByRole("button", { name: "ویرایش و پیگیری" })).toHaveCount(0);
  await expect(page.locator("main")).toContainText("۳۳٪");

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const first = state.plans.find((p: any) => p.cycleId === "c0");
  const second = state.plans.find((p: any) => p.cycleId === "c1");
  expect(first.version).toBe(1);
  expect(second.version).toBe(2);
  expect(first.period).toBe("1405-summer");
  expect(second.period).toBe("1405-autumn");
  expect(first.baseline).toBeTruthy();
  expect(second.baseline).toBeTruthy();
  await page.reload();
  await expect(page.locator("main")).toContainText("نسخه قبلی برنامه");

  await nav(page, "/dashboard/development");
  await expect(page.locator(".stat").nth(2)).not.toContainText("—");
  await expect(page.getByRole("row").filter({ hasText: "آرمان راد" })).toBeVisible();
  await expect(page.locator("main")).toContainText("ارزیابی پاییز ۱۴۰۵");
  await selectMaterial(page, "دوره ارزیابی و توسعه", "تابستان ۱۴۰۵");
  await expect(page.locator(".stat").nth(2)).toContainText("—");
});

test("IDP supports competency-led additions, evidence and separate manager effectiveness review", async ({ page }) => {
  await nav(page, "/evaluations/reports/c0");
  await page.getByRole("button", { name: "ایجاد برنامه توسعه این دوره" }).click();
  await expect(page).toHaveURL(/\/development\/idp\/[^/]+$/);
  await expect(page.locator("main")).toContainText("انتخاب اقدام متناسب با شایستگی");
  await selectMaterial(page, "شایستگی هدف", "هدایت تیم");
  await selectMaterial(page, "الگوی اقدام توسعه", "راهبری تیم کوچک و تفویض مسئولیت");
  await page.getByRole("button", { name: "افزودن اقدام توسعه" }).click();
  const card = page.locator("mat-card.panel")
    .filter({ has: page.getByRole("heading", { name: "راهبری تیم کوچک و تفویض مسئولیت" }) });
  await expect(card).toContainText("توزیع مسئولیت‌ها");
  await card.getByRole("button", { name: "ویرایش و پیگیری" }).click();
  await page.getByLabel("شواهد انجام اقدام").fill("خروجی پروژه و بازخورد مکتوب تیم ثبت شد");
  await selectMaterial(page, "وضعیت", "انجام‌شده");
  await page.getByRole("button", { name: "ذخیره اقدام" }).click();
  await expect(card).toContainText("بررسی اثربخشی هنوز انجام نشده");

  await role(page, "manager");
  // A full page reload would reset the temporary client-side role to HR.
  // Continue in the active Angular session.
  await expect(page).toHaveURL(/\/development\/idp\/[^/]+$/);
  await page.locator("mat-card.panel")
    .filter({ has: page.getByRole("heading", { name: "راهبری تیم کوچک و تفویض مسئولیت" }) })
    .getByRole("button", { name: "ثبت / اصلاح نظر اثربخشی" }).click();
  await selectMaterial(page, "نتیجه بررسی اثربخشی", "تاحدی مؤثر");
  await page.getByLabel("شواهد و توضیح مدیر").fill("خروجی تأیید شد؛ بازخورد اعضا بهبود نسبی را نشان می‌دهد");
  await page.getByRole("button", { name: "ثبت نظر اثربخشی" }).click();
  await expect(card).toContainText("نظر مدیر: تاحدی مؤثر");

  await page.reload();
  await expect(card).toContainText("بازخورد اعضا بهبود نسبی");
  await expect(card.getByRole("button", { name: "ویرایش و پیگیری" })).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const action = state.plans.find((p: any) => p.cycleId === "c0").actions
    .find((a: any) => a.templateId === "leadership-delegate");
  expect(action.effectiveness.outcome).toBe("partial");
  expect(action.evidence).toContain("بازخورد مکتوب");

  await nav(page, "/dashboard/development");
  await selectMaterial(page, "دوره ارزیابی و توسعه", "تابستان ۱۴۰۵");
  await expect(page.locator(".stat").nth(0)).toContainText("۲۵٪");
  await expect(page.locator(".stat").nth(1)).toContainText("۰٪");
  await expect(page.locator(".stat").nth(1)).toContainText("۱ از ۱");
  await expect(page.locator("main")).toContainText("تاحدی مؤثر");
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
  await nav(page, "/settings");
  await page.getByRole("button", { name: "اجرای همگام‌سازی محلی" }).click();
  await expect(page.locator("main")).toContainText("۱ ردیف");
  await page.getByRole("button", { name: "بازنشانی اطلاعات", exact: true }).click();
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
  await page.locator('.nav-item[href="/settings"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("main")).not.toContainText("سناریوی ۱۰ تا ۱۵ دقیقه‌ای");
  await page.evaluate(() => localStorage.setItem("royesh.demo.v1", "{broken"));
  await page.reload();
  await expect(page.locator("main")).toContainText(
    "اطلاعات مرورگر قابل خواندن نیست",
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
  const displayedJalali = await page.locator("app-date-field input").inputValue();
  expect(displayedJalali).toMatch(/\d/);
  await page.getByRole("button", { name: "ذخیره اقدام" }).click();
  const due = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!)
    .plans.find((p: any) => p.id === "d1").actions[0].due);
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.reload();
  await page.getByRole("button", { name: "ویرایش و پیگیری" }).first().click();
  await expect(page.locator("app-date-field input")).toHaveValue(displayedJalali);
});

test("candidate entry assessment leads to documented hiring and an employee with unknown performance", async ({ page }) => {
  await nav(page, "/hiring");
  await page.getByRole("textbox", { name: "نام و نام خانوادگی داوطلب" }).fill("سارا روشن");
  await selectMaterial(page, "شغل هدف استخدام", "مدیر پروژه · دفتر پروژه‌ها");
  await page.getByRole("button", { name: "ثبت و آغاز ارزیابی" }).click();
  await expect(page).toHaveURL(/\/hiring\/[^/]+$/);
  await expect(page.locator("main h1")).toHaveText("سارا روشن");
  await expect(page.locator("main")).toContainText("در انتظار ارزیابی");

  await selectMaterial(page, "ارتباط مؤثر", "۴");
  await selectMaterial(page, "نتیجه بررسی پتانسیل", "بالا");
  await page.getByRole("textbox", { name: "شواهد مصاحبه و سنجش شایستگی‌ها" })
    .fill("مصاحبه رفتاری و اجرای تمرین برنامه‌ریزی در نقش مدیر پروژه");
  await page.getByRole("textbox", { name: "استدلال ارزیاب درباره پتانسیل رشد" })
    .fill("یادگیری سریع و سازگاری با سناریوی جدید مستند شد");
  await page.getByRole("button", { name: "ثبت نسخه ارزیابی" }).click();
  await expect(page.locator("main")).toContainText("تاریخچه ارزیابی‌های ورودی");
  await expect(page.locator("main")).toContainText("یادگیری سریع و سازگاری");
  await expect(page.locator("main")).toContainText("در انتظار تصمیم");

  await page.getByRole("textbox", { name: "دلیل تصمیم انسانی" })
    .fill("بررسی شواهد و تأیید انسانی شرایط احراز");
  await page.getByRole("textbox", { name: "کد پرسنلی جدید (فقط برای استخدام)" }).fill("EMP-8008");
  await selectMaterial(page, "مدیر مستقیم (فقط برای استخدام)", "رویا رسا · دفتر پروژه‌ها");
  await page.getByRole("button", { name: "تأیید استخدام و تشکیل پرونده" }).click();
  await expect(page).toHaveURL(/\/people\/[^/]+$/);
  await expect(page.locator("main h1")).toHaveText("سارا روشن");
  await expect(page.locator("main")).toContainText("EMP-8008");
  await expect(page.locator("main")).toContainText("هنوز ارزیابی عملکرد پس از استخدام ثبت نشده");
  await expect(page.locator("main")).toContainText("سابقه ورود به سازمان");
  await page.getByRole("link", { name: "پرونده و شواهد ارزیابی ورودی" }).click();
  await expect(page.locator("main")).toContainText("استخدام‌شده");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const candidate = state.candidates.find((x: any) => x.name === "سارا روشن");
  const hired = state.people.find((x: any) => x.code === "EMP-8008");
  expect(hired.entry.candidateId).toBe(candidate.id);
  expect(hired.entry.assessmentId).toBe(candidate.assessments[0].id);
  expect(hired.performance).toBe(null);
  expect(candidate.decision.personId).toBe(hired.id);
  await nav(page, "/talent/9box");
  await expect(page.locator("main")).toContainText("هنوز ارزیابی عملکرد یا پتانسیل لازم");
});

test("non-hiring decision archives candidate without adding a person", async ({ page }) => {
  await nav(page, "/hiring/cand1");
  await expect(page.locator("main")).toContainText("تارا ساعی");
  await page.getByRole("textbox", { name: "دلیل تصمیم انسانی" })
    .fill("مطابقت شواهد با موقعیت فعلی در کمیته تأیید نشد");
  await page.getByRole("button", { name: "ثبت عدم استخدام" }).click();
  await expect(page.locator("main")).toContainText("استخدام‌نشده");
  await expect(page.getByRole("button", { name: "ثبت نسخه ارزیابی" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("main")).toContainText("مطابقت شواهد با موقعیت فعلی");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(state.candidates.find((x: any) => x.id === "cand1").decision.outcome).toBe("declined");
});
