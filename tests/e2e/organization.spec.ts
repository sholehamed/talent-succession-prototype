import { test, expect } from "@playwright/test";

test("HR creates organization structure, staffs a vacancy and preserves old evaluation flow", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p1");
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button", { name: "ورود به رویش" }).click();

  await page.goto("/organization/chart");
  await expect(page.getByRole("heading", { name: "چارت سازمانی" })).toBeVisible();
  await expect(page.locator("main")).toContainText("پست بلاتصدی");

  await page.goto("/organization/locations");
  await page.getByRole("textbox", { name: "کد", exact: true }).fill("LOC-E2E");
  await page.getByRole("textbox", { name: "نام محل خدمت" }).fill("مرکز غرب");
  await page.getByRole("button", { name: "ذخیره محل خدمت" }).click();
  await expect(page.locator("main")).toContainText("مرکز غرب");

  await page.goto("/organization/units");
  await page.getByRole("textbox", { name: "کد واحد" }).fill("UNIT-E2E");
  await page.getByRole("textbox", { name: "عنوان واحد" }).fill("گروه فناوری غرب");
  await page.getByRole("button", { name: "ذخیره واحد" }).click();
  await expect(page.locator("main")).toContainText("گروه فناوری غرب");

  await page.goto("/organization/positions");
  await page.getByRole("textbox", { name: "کد پست" }).fill("POST-E2E");
  await page.getByRole("textbox", { name: "عنوان پست" }).fill("کارشناس فناوری غرب");
  await page.getByRole("combobox", { name: "شناسنامه شغلی" }).click();
  await page.getByRole("option", { name: "تحلیلگر سیستم" }).click();
  await page.getByRole("combobox", { name: "واحد سازمانی" }).click();
  await page.getByRole("option", { name: "گروه فناوری غرب" }).click();
  await page.getByRole("combobox", { name: "محل خدمت" }).click();
  await page.getByRole("option", { name: "مرکز غرب" }).click();
  await page.getByRole("button", { name: "ثبت پست سازمانی" }).click();
  await expect(page.locator("main")).toContainText("POST-E2E");

  await page.goto("/organization/appointments");
  await page.getByRole("combobox", { name: "شخص" }).click();
  await page.getByRole("option", { name: "آرمان راد · EMP-1001" }).click();
  await page.getByRole("combobox", { name: "پست بلاتصدی مقصد" }).click();
  await page.getByRole("option", { name: "کارشناس فناوری غرب · POST-E2E" }).click();
  await page.getByRole("textbox", { name: "شماره حکم / مرجع" }).fill("AP-E2E");
  await page.getByRole("button", { name: "ثبت انتصاب" }).click();
  const snapshot = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const employee = snapshot.people.find((p: any) => p.id === "p1");
  const position = snapshot.positions.find((p: any) => p.code === "POST-E2E");
  expect(employee.jobId).toBe("j9");
  expect(snapshot.appointments.some((a: any) =>
    a.personId === "p1" && a.positionId === position.id && !a.effectiveTo)).toBe(true);
  expect(snapshot.cycles.find((c: any) => c.id === "c1").jobId).toBe("j1");
  expect(snapshot.nominations.some((n: any) => n.positionId === "pos1")).toBe(true);

  await page.goto("/people/p1");
  await expect(page.locator("main")).toContainText("کارشناس فناوری غرب");
  await expect(page.locator("main")).toContainText("مرکز غرب");
  await expect(page.locator("main")).toContainText("گروه فناوری غرب");
  await expect(page.locator("main")).toContainText("AP-E2E");
  await page.reload();
  await expect(page.locator("main")).toContainText("کارشناس فناوری غرب");
  await page.goto("/organization/chart");
  await expect(page.locator("main")).toContainText("کارشناس فناوری غرب");
});

test("blocks non-HR access to global staffing history while allowing read-only chart", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "شناسه کاربری" }).fill("p11");
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button", { name: "ورود به رویش" }).click();

  await page.goto("/organization/chart");
  await expect(page.getByRole("heading", { name: "چارت سازمانی" })).toBeVisible();
  await expect(page.locator('main a[href="/organization/appointments"]')).toHaveCount(0);
  await page.goto("/organization/appointments");
  await expect(page).not.toHaveURL(/\/organization\/appointments$/);
  await expect(page.locator("main")).not.toContainText("تاریخچه انتصاب‌ها");
});
