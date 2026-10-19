import { test, expect } from "@playwright/test";

test("hired employee gets KPI performance only after HR approval, with private employee history", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p1");
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button", { name: "ورود به رویش" }).click();

  // The seed candidate already has an entry assessment. Hiring creates no job performance.
  await page.goto("/hiring/cand1");
  await page.getByRole("textbox", { name: "دلیل تصمیم انسانی" })
    .fill("شواهد و نتیجه جلسه جذب تأیید شد");
  await page.getByRole("textbox", { name: "کد پرسنلی جدید (فقط برای استخدام)" }).fill("EMP-8051");
  await page.getByRole("combobox", { name: "پست سازمانی بلاتصدی (الزامی)" }).click();
  await page.getByRole("option", { name: "مدیر پروژه — پست بلاتصدی · POST-VAC-j1" }).click();
  await expect(page.locator("main")).toContainText("مدیر مستقیم: پویان فرهمند");
  await page.getByRole("button", { name: "تأیید استخدام و تشکیل پرونده" }).click();
  await expect(page).toHaveURL(/\/people\/[^/]+$/);
  await expect(page.locator("main")).toContainText("هنوز ارزیابی عملکرد پس از استخدام ثبت نشده");

  const personId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("link", { name: "ثبت یا مشاهده عملکرد" }).click();
  await expect(page).toHaveURL(new RegExp("/performance/" + personId + "$"));
  await page.getByRole("button", { name: "ارزیابی دوره جدید" }).click();
  await page.getByRole("textbox", { name: "دوره ارزیابی" }).fill("1405-autumn");
  for (const [i, value] of [90, 80, 70].entries()) {
    await page.getByRole("spinbutton", { name: "درصد تحقق هدف" }).nth(i).fill(String(value));
    await page.getByRole("textbox", { name: "شواهد و منبع ثبت‌شده" }).nth(i)
      .fill("شواهد شاخص شماره " + (i + 1) + " در صورت‌جلسه عملکرد");
  }
  await page.getByRole("textbox", { name: "جمع‌بندی و توضیح ارزیابی" })
    .fill("مطابقت تحقق KPIها با گزارش‌های دوره");
  await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
  let snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(snapshot.people.find((p: any) => p.id === personId).performance).toBeNull();
  expect(snapshot.performanceReviews.find((r: any) => r.personId === personId).status).toBe("draft");

  await page.getByRole("button", { name: "تأیید عملکرد" }).click();
  await expect(page.locator("main")).toContainText("آخرین ارزیابی تأییدشده");
  snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(snapshot.people.find((p: any) => p.id === personId).performance).toBe("high");
  expect(snapshot.performanceReviews.find((r: any) => r.personId === personId).score).toBe(80);
  await page.goto("/talent/9box");
  await expect(page.locator("main")).toContainText("تارا ساعی");

  // A newly hired account can see its own published result but cannot edit it.
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill(personId);
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button", { name: "ورود به رویش" }).click();
  await page.goto("/performance/" + personId);
  await expect(page.locator("main")).toContainText("1405-autumn");
  await expect(page.getByRole("button", { name: "ارزیابی دوره جدید" })).toHaveCount(0);
  await page.goto("/performance/p2");
  await expect(page.locator("main")).toContainText("دسترسی مشاهده پرونده او را ندارید");
});
