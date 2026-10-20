import { test, expect, Page } from "@playwright/test";
const roleLabels: Record<string, string> = {
  hr: "کارشناس منابع انسانی", executive: "مدیرعامل", manager: "مدیر واحد",
  owner: "مالک خانواده شغلی", evaluator: "ارزیاب", employee: "کارمند"
};
const selectMaterial = async (p: Page, label: string, option: string) => {
  await p.getByRole("combobox", { name: label }).click();
  await p.getByRole("option", { name: option, exact: true }).click();
};
const signIn = async (p: Page, id = "p1", activeRole?: string) => {
  if (await p.getByRole("button", { name: "خروج", exact: true }).count())
    await p.getByRole("button", { name: "خروج", exact: true }).click();
  await p.goto("/login");
  await p.getByRole("textbox", { name: "شناسه کاربری" }).fill(id);
  await p.getByLabel("رمز عبور").fill("Royesh1405!");
  await p.getByRole("button", { name: "ورود به رویش" }).click();
  await expect(p.getByRole("combobox", { name: "نقش فعال" })).toBeVisible();
  if (activeRole && await p.getByRole("combobox", {name:"نقش فعال"}).inputValue().catch(() => "") !== roleLabels[activeRole]) {
    // Selecting the role is valid only among this account's granted roles.
    await selectMaterial(p, "نقش فعال", roleLabels[activeRole]);
  }
};
const role = async (p: Page, r: string) => {
  const original = new URL(p.url()).pathname;
  const id = r === "hr" || r === "employee" ? "p1"
    : r === "owner" ? "p12"
    : r === "executive" || r === "manager" ? "p11"
    : "p2";
  const currentId = (await p.locator("mat-sidenav .workspace small").textContent().catch(() => "")) ?? "";
  if (currentId.trim().split(" · ")[0] === id) {
    await selectMaterial(p, "نقش فعال", roleLabels[r]);
  } else {
    await signIn(p, id, r);
  }
  if (r !== "employee" && r !== "evaluator")
    await p.goto(original);
};
test.beforeEach(async ({page}) => signIn(page, "p1", "hr"));
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
    "/jobs",
    "/jobs/new",
    "/jobs/j1",
    "/career-paths",
    "/hiring",
    "/hiring/cand1",
    "/people",
    "/people/p1",
    "/evaluations/cycles",
    "/evaluations/questions",
    "/evaluations/c1",
    "/evaluations/reports/c0",
    "/development",
    "/development/templates",
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
  await page.getByRole("button", { name: "مشاغل و مسیر رشد" }).click();
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

  for (const person of ["p2", "p3", "p4", "p5", "p6", "p7"]) {
    await signIn(page, person, "evaluator");
    await nav(page, "/evaluations/inbox");
    const pending = page.getByRole("button", { name: "تکمیل پرسشنامه", exact: true });
    await expect(pending).toBeVisible();
    await pending.click();
    if (person === "p2") {
      await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
      await expect(page.getByRole("status")).toContainText("تمام سؤالات");
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
  // Dashboard filters can redraw the Material option during selection.
  // Use a scoped forced option click only here, not for navigation/other selectors.
  await page.getByRole("combobox", { name: "دوره ارزیابی و توسعه" }).click();
  await page.getByRole("option", { name: "پاییز ۱۴۰۵", exact: true }).click({ force: true });
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

  for (const person of ["p2","p3","p4","p5","p6","p7"]) {
    await signIn(page, person, "evaluator");
    await nav(page, "/evaluations/inbox");
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
  await selectMaterial(page, "الگوی اقدام توسعه", "راهبری تیم کوچک و تفویض مسئولیت · مأموریت عملی");
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
  // Manager is a different logged-in person, now scoped to the relevant unit.
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

test("general then specialist committees lead to documented hiring and unknown performance", async ({ page }) => {
  await nav(page, "/hiring");
  await page.getByRole("textbox", { name: "نام و نام خانوادگی داوطلب" }).fill("سارا روشن");
  await selectMaterial(page, "شغل هدف استخدام", "مدیر پروژه · دفتر پروژه‌ها");
  await page.getByRole("button", { name: "ثبت و آغاز ارزیابی" }).click();
  await expect(page).toHaveURL(/\/hiring\/[^/]+$/);
  const detailUrl = page.url();
  const candidateId = detailUrl.split("/").at(-1);
  await expect(page.locator("main h1")).toHaveText("سارا روشن");
  await expect(page.locator("main")).toContainText("در انتظار ارزیابی");
  await expect(page.getByRole("button", {name:"ثبت نسخه ارزیابی"})).toHaveCount(0);

  await selectMaterial(page, "ارزیاب کمیته عمومی", "نیما روشن · EMP-1003");
  await page.getByRole("button", { name: "ارجاع به کمیته عمومی" }).click();
  await expect(page.locator("main")).toContainText("در انتظار پاسخ");
  await signIn(page, "p3", "evaluator");
  await page.getByRole("button", { name: "جذب و استخدام" }).click();
  await expect(page.locator("mat-sidenav")).toContainText("ارزیابی عمومی");
  await expect(page.locator("mat-sidenav")).toContainText("ارزیابی تخصصی");
  await nav(page, "/hiring/committee/general");
  await expect(page.locator("main")).toContainText("سارا روشن");
  await page.getByRole("link", { name: "تکمیل پرسشنامه" }).click();
  await expect(page).toHaveURL(new RegExp(`/hiring/committee/general/${candidateId}`));
  const generalInputs = page.getByRole("combobox",{name:"امتیاز سؤال"});
  await expect(generalInputs).toHaveCount(5);
  for (let i=0;i<5;i++) {
    await generalInputs.nth(i).click();
    await page.getByRole("option", {name:"۴ از ۵"}).click();
  }
  await page.getByRole("textbox",{name:"شواهد و توضیح کمیته"}).fill("شواهد مصاحبه عمومی ثبت شد");
  await page.getByRole("button", {name:"ثبت نتیجه کمیته ارزیابی عمومی"}).click();

  await signIn(page, "p1", "hr");
  await page.goto(detailUrl);
  await expect(page.locator("main")).toContainText("شواهد مصاحبه عمومی ثبت شد");
  await selectMaterial(page,"ارزیاب کمیته تخصصی","علی پارسا · EMP-1005");
  await page.getByRole("button",{name:"ارجاع به کمیته تخصصی"}).click();

  await signIn(page,"p5","evaluator");
  await nav(page,"/hiring/committee/specialist");
  await expect(page.locator("main")).toContainText("سارا روشن");
  await page.getByRole("link",{name:"تکمیل پرسشنامه"}).click();
  const specialistInputs = page.getByRole("combobox",{name:"امتیاز سؤال"});
  await expect(specialistInputs).toHaveCount(5);
  for(let i=0;i<5;i++){
    await specialistInputs.nth(i).click();
    await page.getByRole("option",{name:"۴ از ۵"}).click();
  }
  await page.getByRole("textbox",{name:"شواهد و توضیح کمیته"}).fill("شواهد تحلیل مسئله تخصصی ثبت شد");
  await page.getByRole("button",{name:"ثبت نتیجه کمیته ارزیابی تخصصی"}).click();

  await signIn(page,"p1","hr");
  await page.goto(detailUrl);
  await expect(page.locator("main")).toContainText("شواهد تحلیل مسئله تخصصی ثبت شد");
  await selectMaterial(page,"قضاوت انسانی درباره پتانسیل","بالا");
  await page.getByRole("textbox",{name:"جمع‌بندی و شواهد منابع انسانی"}).fill("مصاحبه عمومی و سنجش تخصصی مستند است");
  await page.getByRole("textbox",{name:"استدلال پتانسیل"}).fill("توان یادگیری و رشد مشاهده شد");
  await page.getByRole("button",{name:"تأیید جمع‌بندی دو کمیته"}).click();
  await expect(page.locator("main")).toContainText("در انتظار تصمیم");
  await page.getByRole("textbox", { name: "دلیل تصمیم انسانی" })
    .fill("بررسی دو کمیته و تأیید انسانی شرایط احراز");
  await page.getByRole("textbox", { name: "کد پرسنلی جدید (فقط برای استخدام)" }).fill("EMP-8008");
  await selectMaterial(page, "پست سازمانی بلاتصدی (الزامی)", "مدیر پروژه — پست بلاتصدی · POST-VAC-j1");
  await expect(page.locator("main")).toContainText("اطلاعات تشکیلاتی پست انتخاب‌شده");
  await expect(page.locator("main")).toContainText("مدیر مستقیم: پویان فرهمند");
  await page.getByRole("textbox", { name: "شماره حکم انتصاب (اختیاری)" }).fill("HIR-8008");
  await page.getByRole("button", { name: "تأیید استخدام و تشکیل پرونده" }).click();
  await expect(page).toHaveURL(/\/people\/[^/]+$/);
  await expect(page.locator("main h1")).toHaveText("سارا روشن");
  await expect(page.locator("main")).toContainText("EMP-8008");
  await expect(page.locator("main")).toContainText("هنوز ارزیابی عملکرد پس از استخدام ثبت نشده");
  await expect(page.locator("main")).toContainText("سابقه ورود به سازمان");
  await page.getByRole("link", { name: "پرونده و شواهد ارزیابی ورودی" }).click();
  await expect(page.locator("main")).toContainText("استخدام‌شده");
  await expect(page.locator("main")).toContainText("نتایج شایستگی به تفکیک کمیته");
  await expect(page.locator("main")).toContainText("شواهد مصاحبه عمومی ثبت شد");
  await expect(page.locator("main")).toContainText("شواهد تحلیل مسئله تخصصی ثبت شد");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const candidate = state.candidates.find((x: any) => x.name === "سارا روشن");
  const hired = state.people.find((x: any) => x.code === "EMP-8008");
  expect(hired.entry.candidateId).toBe(candidate.id);
  expect(hired.entry.assessmentId).toBe(candidate.assessments[0].id);
  expect(hired.observed).toEqual([4,4,4,4,4]);
  expect(hired.performance).toBe(null);
  const appointment = state.appointments.find((a: any) => a.personId === hired.id);
  expect(appointment?.positionId).toBe("vac-j1");
  expect(appointment?.referenceNo).toBe("HIR-8008");
  expect(hired.managerId).toBe("p11");
  expect(state.positions.filter((p: any) => p.id === "vac-j1")).toHaveLength(1);
  expect(state.positions.some((p: any) => p.id === `staff-${hired.id}`)).toBe(false);
  expect(candidate.entryWorkflow.general.completedAt).toBeTruthy();
  expect(candidate.entryWorkflow.specialist.completedAt).toBeTruthy();
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

test("HR edits peer questions; evaluator sees only its snapped questionnaire even after edits", async ({ page }) => {
  await nav(page, "/evaluations/questions");
  await page.getByRole("button", { name: /هم‌سطح.*سؤال فعال/ }).click();
  await page.getByRole("textbox", { name: "متن سؤال ارزیابی" })
    .fill("در تصمیم‌های گروهی به نظرات همکاران گوش می‌دهد؟");
  await selectMaterial(page, "شایستگی مرتبط", "همکاری تیمی");
  await page.getByRole("button", { name: "ثبت سؤال جدید" }).click();
  await expect(page.locator("main")).toContainText("در تصمیم‌های گروهی به نظرات همکاران گوش می‌دهد؟");
  await expect(page.getByRole("button", { name: /هم‌سطح.*سؤال فعال/ })).toContainText("۶");

  await nav(page, "/evaluations/c1");
  await page.getByRole("button", { name: "شروع دریافت پاسخ‌ها" }).click();
  await expect(page.locator("main")).toContainText("دریافت پاسخ");
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!)
    .cycles.find((c: any) => c.id === "c1").questions);
  expect(before.filter((q: any) => q.group === "peer")).toHaveLength(6);

  await nav(page, "/evaluations/questions");
  await page.getByRole("button", { name: /هم‌سطح.*سؤال فعال/ }).click();
  const q = page.locator("mat-card.panel").filter({ has: page.getByRole("heading", { name: "سؤالات هم‌سطح" }) })
    .locator(".metric-line").filter({ hasText: "در تصمیم‌های گروهی به نظرات همکاران گوش می‌دهد؟" });
  await q.getByRole("button", { name: "ویرایش" }).click();
  await page.getByRole("textbox", { name: "متن سؤال ارزیابی" })
    .fill("متن ویرایش‌شده برای دوره‌های بعدی");
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();

  await nav(page, "/evaluations/c1");
  await signIn(page, "p3", "evaluator");
  await nav(page, "/evaluations/inbox");
  await page.getByRole("button", { name: "تکمیل پرسشنامه" }).click();
  await expect(page.locator(".question")).toHaveCount(6);
  await expect(page.locator("main")).toContainText("در تصمیم‌های گروهی به نظرات همکاران گوش می‌دهد؟");
  await expect(page.locator("main")).not.toContainText("متن ویرایش‌شده برای دوره‌های بعدی");
  await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
  await expect(page.getByRole("status")).toContainText("تمام سؤالات");
  for (let i = 0; i < 6; i++)
    await page.locator(".question").nth(i).getByRole("radio").nth(3).check();
  await page.getByRole("button", { name: "ثبت نهایی پاسخ‌ها" }).click();
  await expect(page.getByRole("button", { name: "تکمیل پرسشنامه" })).toHaveCount(0);
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const cycle = state.cycles.find((c: any) => c.id === "c1");
  const response = cycle.assignments.find((a: any) => a.personId === "p3");
  expect(response.answers).toHaveLength(6);
  expect(new Set(response.answers.map((a: any) => a.questionId)).size).toBe(6);
  expect(cycle.questions.find((q: any) => q.id === response.answers[5].questionId).text)
    .toBe("در تصمیم‌های گروهی به نظرات همکاران گوش می‌دهد؟");
});

test("HR template catalog dynamically feeds competency IDP and preserves action snapshots", async ({ page }) => {
  const title = "کارگاه تحلیل داده برای حل مسائل پروژه";
  const indicator = "تدوین دو تحلیل مسئله و دریافت تأیید مدیر";
  await nav(page, "/development/templates");
  await expect(page.getByRole("heading", { name: "مدیریت الگوهای اقدام توسعه" })).toBeVisible();
  await selectMaterial(page, "شایستگی هدف", "حل مسئله");
  await page.getByRole("textbox", { name: "عنوان اقدام پیشنهادی" }).fill(title);
  await selectMaterial(page, "نوع اقدام", "آموزش");
  await page.getByRole("textbox", { name: "شاخص موفقیت اقدام" }).fill(indicator);
  await page.getByRole("button", { name: "ثبت الگوی جدید" }).click();
  await expect(page.locator("main")).toContainText(title);
  await page.reload();
  await selectMaterial(page, "انتخاب شایستگی", "حل مسئله (۳ فعال)");
  await expect(page.locator("main")).toContainText(title);

  await nav(page, "/development/idp/d1");
  await selectMaterial(page, "شایستگی هدف", "حل مسئله");
  await selectMaterial(page, "الگوی اقدام توسعه", title + " · آموزش");
  await page.getByRole("button", { name: "افزودن اقدام توسعه" }).click();
  await expect(page.locator("main")).toContainText(title);
  await expect(page.locator("main")).toContainText(indicator);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const template = saved.developmentTemplates.find((x: any) => x.title === title);
  const action = saved.plans.find((p: any) => p.id === "d1").actions.find((a: any) => a.templateId === template.id);
  expect(action).toMatchObject({ title, indicator, kind: "آموزش", competency: 2 });
  expect(action.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await nav(page, "/development/templates");
  await selectMaterial(page, "انتخاب شایستگی", "حل مسئله (۳ فعال)");
  const templateCard = page.locator(".metric-line").filter({ hasText: title });
  await expect(templateCard.getByRole("link", { name: /سارا مهر.*نسخه/ })).toBeVisible();
  await expect(templateCard.getByRole("button", { name: "حذف" })).toBeDisabled();
  await templateCard.getByRole("button", { name: "ویرایش" }).click();
  await page.getByRole("textbox", { name: "عنوان اقدام پیشنهادی" })
    .fill("عنوان جدید فقط برای انتخاب‌های آینده");
  await page.getByRole("textbox", { name: "شاخص موفقیت اقدام" })
    .fill("شاخص جدید کاتالوگ");
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  const changed = page.locator(".metric-line").filter({hasText:"عنوان جدید فقط برای انتخاب‌های آینده"});
  await changed.getByRole("button", { name: "غیرفعال کردن" }).click();

  await nav(page, "/development/idp/d1");
  const updated = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(updated.plans.find((p: any) => p.id === "d1").actions
    .find((a: any) => a.id === action.id)).toMatchObject({title, indicator, templateId: template.id});
  await nav(page, "/development/idp/d2");
  await selectMaterial(page, "شایستگی هدف", "حل مسئله");
  await page.getByRole("combobox", { name: "الگوی اقدام توسعه" }).click();
  await expect(page.getByRole("option", { name: /عنوان جدید فقط برای انتخاب‌های آینده/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await role(page, "manager");
  await expect(page.locator("mat-sidenav a.nav-item").filter({ hasText: "الگوهای اقدام توسعه" })).toHaveCount(0);
});

test("login binds identity, personal visibility, role grants and assigned IDP work", async ({page}) => {
  await page.getByRole("button", {name:"خروج"}).click();
  await page.goto("/people/p2");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("textbox", {name:"شناسه کاربری"}).fill("p3");
  await page.getByLabel("رمز عبور").fill("wrong");
  await page.getByRole("button", {name:"ورود به رویش"}).click();
  await expect(page.getByRole("alert")).toContainText("صحیح نیست");
  await page.getByRole("textbox", {name:"رمز عبور"}).fill("Royesh1405!");
  await page.getByRole("button", {name:"ورود به رویش"}).click();
  await expect(page).toHaveURL(/\/people\/p3$/);
  await expect(page.getByRole("combobox", {name:"نقش فعال"})).toContainText("کارمند");
  await page.getByRole("combobox", {name:"نقش فعال"}).click();
  await expect(page.getByRole("option", {name:"کارشناس منابع انسانی"})).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/hiring");
  await expect(page).toHaveURL(/\/people\/p3$/);
  await page.goto("/people/p2");
  await expect(page.locator("main")).not.toContainText("سارا مهر");
  await nav(page,"/development/tasks");
  await expect(page.getByRole("heading",{name:"اقدام‌های من"})).toBeVisible();
  await page.getByRole("button",{name:"ثبت پیشرفت و شواهد"}).first().click();
  await selectMaterial(page,"وضعیت اقدام","انجام‌شده");
  await page.getByRole("textbox",{name:"شواهد انجام اقدام"}).fill("آزمایش اجرای اقدام شخصی با حساب p3");
  await page.getByRole("button",{name:"ذخیره پیشرفت"}).click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const assigned=state.plans.find((p:any)=>p.id==="d2").actions.find((a:any)=>a.assigneeId==="p3");
  expect(assigned.status).toBe("completed");
  expect(assigned.evidence).toContain("حساب p3");
  await page.reload();
  await expect(page.locator("main")).toContainText("حساب p3");
});

test("new job profile remains draft until owner publication and then appears in linked selectors", async ({ page }) => {
  const title = "تحلیلگر فرایندهای سازمانی";
  const code = "JOB-207";
  await nav(page, "/jobs");
  await page.getByRole("link", { name: /شناسنامه شغلی جدید/ }).click();
  await expect(page).toHaveURL(/\/jobs\/new$/);
  await page.getByRole("textbox", { name: "کد یکتای شغل" }).fill(code);
  await page.getByRole("textbox", { name: "عنوان", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "واحد سازمانی" }).fill("دفتر پروژه‌ها");
  await page.getByRole("textbox", { name: "خانواده" }).fill("مدیریت پروژه");
  await page.getByRole("textbox", { name: "سطح" }).fill("کارشناسی ارشد");
  await page.getByRole("textbox", { name: "مالک محتوا" }).fill("دفتر مدیریت");
  await page.getByRole("textbox", { name: "مأموریت" }).fill("مدلسازی و بهبود فرایندهای کاری و هماهنگی ذی‌نفعان");
  await page.getByRole("button", { name: "+ وظیفه" }).click();
  await page.getByRole("textbox", { name: "وظیفه" }).fill("استخراج فرایندها");
  await page.getByRole("textbox", { name: "خروجی / شاخص نتیجه" }).fill("نقشه فرایند تصویب‌شده");
  await page.getByRole("button", { name: "+ شاخص" }).click();
  const kpi = page.locator(".form-section .panel.form-grid").last();
  await kpi.getByRole("textbox", { name: "عنوان", exact: true }).fill("میزان پوشش فرایندها");
  await kpi.getByRole("textbox", { name: "تعریف عملیاتی" }).fill("فرایندهای مدل‌سازی‌شده");
  await kpi.getByRole("textbox", { name: "فرمول" }).fill("تعداد تصویب‌شده تقسیم بر کل");
  await kpi.getByRole("textbox", { name: "واحد سنجش" }).fill("درصد");
  await kpi.getByRole("textbox", { name: "تناوب" }).fill("ماهانه");
  await kpi.getByRole("textbox", { name: "منبع داده مرجع" }).fill("صورتجلسه");
  await kpi.getByRole("textbox", { name: "مالک شاخص" }).fill("مدیر دفتر");
  await page.getByRole("button", { name: "ثبت شناسنامه و ایجاد پیش‌نویس" }).click();
  await expect(page).toHaveURL(/\/jobs\/(?!new)[\w-]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator("main")).toContainText("هنوز منتشر نشده");
  const jobId = new URL(page.url()).pathname.split("/").at(-1);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(state.jobs.find((j: any) => j.id === jobId)).toMatchObject({
    code, title, version: 0, review: "draft", draft: { title },
  });
  await nav(page, "/hiring");
  await page.getByRole("combobox", { name: "شغل هدف استخدام" }).click();
  await expect(page.getByRole("option", { name: title + " · دفتر پروژه‌ها" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await nav(page, "/jobs/" + jobId);
  await page.getByRole("button", { name: "ارسال برای تأیید" }).click();
  await role(page, "owner");
  await page.getByRole("button", { name: "تأیید و انتشار نسخه" }).click();
  await expect(page.locator("main")).toContainText("نسخه ۱");
  await signIn(page, "p1", "hr");
  await nav(page, "/hiring");
  await page.getByRole("combobox", { name: "شغل هدف استخدام" }).click();
  await expect(page.getByRole("option", { name: title + " · دفتر پروژه‌ها" })).toBeVisible();
  await page.keyboard.press("Escape");
  await nav(page, "/evaluations/cycles");
  await page.getByRole("combobox", { name: "شغل هدف" }).click();
  await expect(page.getByRole("option", { name: title, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await nav(page, "/career-paths");
  await page.getByRole("combobox", { name: "مبدأ" }).click();
  await expect(page.getByRole("option", { name: title, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(state.jobs.find((j: any) => j.id === jobId).version).toBe(1);
  expect(state.jobs.find((j: any) => j.id === jobId).kpis[0].title).toBe("میزان پوشش فرایندها");
});

test("employee and owner cannot create new jobs via URL", async ({ page }) => {
  await signIn(page, "p3", "employee");
  await page.goto("/jobs/new");
  await expect(page).toHaveURL(/\/people\/p3$/);
  await signIn(page, "p12", "owner");
  await page.goto("/jobs/new");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole("link", { name: /شناسنامه شغلی جدید/ })).toHaveCount(0);
});
