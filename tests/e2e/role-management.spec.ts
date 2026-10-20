import { test, expect } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

test("HR can assign and remove a person's owner role",async({page})=>{
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill("p1");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await page.goto("/access/roles");
  await expect(page.getByRole("heading",{name:"مدیریت نقش‌های کاربران"})).toBeVisible();
  await page.getByRole("textbox",{name:"جستجوی نام، کد پرسنلی یا شناسه"}).fill("p3");
  await page.locator(".access-person").filter({hasText:"p3"}).first().click();
  await page.getByRole("checkbox",{name:"مالک خانواده شغلی"}).check();
  await page.getByRole("button",{name:"ذخیره نقش‌های فرد"}).click();
  await expect(page.locator(".access-person").first()).toContainText("مالک خانواده شغلی");
  await page.reload();
  await page.getByRole("textbox",{name:"جستجوی نام، کد پرسنلی یا شناسه"}).fill("p3");
  await page.locator(".access-person").filter({hasText:"p3"}).first().click();
  await expect(page.getByRole("checkbox",{name:"مالک خانواده شغلی"})).toBeChecked();
  await page.getByRole("checkbox",{name:"مالک خانواده شغلی"}).uncheck();
  await page.getByRole("button",{name:"ذخیره نقش‌های فرد"}).click();
  await expect(page.locator(".access-person").first()).not.toContainText("مالک خانواده شغلی");
});

test("newly granted owner can publish a job draft using their own account",async({page})=>{
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill("p1");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await page.goto("/jobs/j1");
  await page.getByRole("button",{name:"ویرایش شناسنامه",exact:true}).click();
  await page.getByLabel("هدایت تیم",{exact:true}).fill("5");
  await page.getByRole("button",{name:"ذخیره پیش‌نویس",exact:true}).click();
  await page.getByRole("button",{name:"ارسال برای تأیید",exact:true}).click();
  await page.goto("/access/roles");
  await page.getByRole("textbox",{name:"جستجوی نام، کد پرسنلی یا شناسه"}).fill("p3");
  await page.locator(".access-person").filter({hasText:"p3"}).first().click();
  await page.getByRole("checkbox",{name:"مالک خانواده شغلی"}).check();
  await page.getByRole("button",{name:"ذخیره نقش‌های فرد"}).click();
  await page.getByRole("button",{name:"خروج",exact:true}).click();
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill("p3");
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await page.goto("/jobs/j1");
  await page.getByRole("button",{name:"تأیید و انتشار نسخه",exact:true}).click();
  await expect(page.locator("main")).toContainText("نسخه ۲");
});
