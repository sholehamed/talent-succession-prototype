import { test, expect, Page } from "@playwright/test";

async function login(page:Page,id:string) {
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
}

test("HR reviews position turnover risk and report reflects it without changing readiness",async({page})=>{
  await login(page,"p1");
  await page.goto("/organization/positions");
  await page.getByRole("link",{name:"ارزیابی ریسک"}).first().click();
  await expect(page).toHaveURL(/\/talent\/succession\?position=pos1$/);
  await expect(page.locator("main")).toContainText("فاقد ارزیابی مستند");
  // A fresh seed is held in memory until the first mutation persists LocalStorage.
  const seededNominationIds=["n1","n2","n3","n6"];
  await page.getByRole("button",{name:"ثبت ارزیابی ریسک"}).click();
  await page.getByRole("combobox",{name:"احتمال خروج طی ۱۲ ماه"}).click();
  await page.getByRole("option",{name:"۲ — متوسط"}).click();
  await page.getByRole("combobox",{name:"اثر خروج"}).click();
  await page.getByRole("option",{name:"۳ — شدید"}).click();
  await page.getByRole("spinbutton",{name:"زمان جایگزینی (ماه)"}).fill("8");
  await page.getByRole("textbox",{name:"دلیل حیاتی‌بودن پست"}).fill("پایداری تحویل پروژه");
  await page.getByRole("textbox",{name:"شواهد و مبنای احتمال خروج"}).fill("احتمال تغییر سمت در سال آینده");
  await page.getByRole("textbox",{name:"شواهد پیامد و اثر خروج"}).fill("ریسک تأخیر در تحویل پروژه");
  await page.getByRole("textbox",{name:"مبنای برآورد زمان جایگزینی"}).fill("هشت ماه برای آموزش و تحویل کار");
  await page.getByRole("textbox",{name:"اقدام کنترلی برای کاهش ریسک"}).fill("تربیت جانشین و مستندسازی دانش");
  await page.getByRole("button",{name:"ثبت ارزیابی ریسک",exact:true}).last().click();
  await expect(page.locator("main")).toContainText("ارزیابی مستند معتبر");
  const data=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return {position:state.positions.find((p:any)=>p.id==="pos1"),
      nominees:state.nominations.filter((n:any)=>n.positionId==="pos1")};
  });
  expect(data.position.probability).toBe(2);
  expect(data.position.impact).toBe(3);
  expect(data.position.months).toBe(8);
  expect(data.position.riskReview.appointmentIdAtReview).toBeTruthy();
  expect(data.nominees.map((n:any)=>n.id)).toEqual(seededNominationIds);
  await page.reload();
  await expect(page.locator("main")).toContainText("ارزیابی مستند معتبر");
  await page.goto("/reports");
  await page.getByRole("button",{name:"جانشین‌پروری",exact:true}).click();
  const row=page.locator("table.report-data tbody tr").filter({hasText:"مدیر پروژه"});
  await expect(row.first()).toContainText("ارزیابی مستند معتبر");
  await row.first().getByRole("link",{name:"مشاهده"}).click();
  await expect(page).toHaveURL(/\/talent\/succession\?position=pos1$/);
});

test("manager cannot access risk of a critical post in another unit",async({page})=>{
  await login(page,"p11");
  await page.getByRole("combobox",{name:"نقش فعال"}).click();
  await page.getByRole("option",{name:"مدیر واحد",exact:true}).click();
  await page.goto("/talent/succession?position=pos2");
  await expect(page.getByRole("combobox",{name:"پست حیاتی"})).toContainText("مدیر پروژه");
  await expect(page.getByRole("combobox",{name:"پست حیاتی"})).not.toContainText("سرپرست عملیات");
  await page.getByRole("button",{name:"ثبت ارزیابی ریسک"}).click();
  await expect(page.getByRole("textbox",{name:"شواهد و مبنای احتمال خروج"})).toBeVisible();
});
