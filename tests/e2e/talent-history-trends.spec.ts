import {test,expect,Page} from "@playwright/test";
async function signIn(page:Page,id="p1",role="کارشناس منابع انسانی"){
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
  if(role!=="کارشناس منابع انسانی"){
    await page.getByRole("combobox",{name:"نقش فعال"}).click();
    await page.getByRole("option",{name:role,exact:true}).click();
  }
}
test("nine-box navigation opens automatic comparison without any snapshot action",async({page})=>{
  await signIn(page);
  await page.goto("/talent/9box");
  await page.getByRole("link",{name:"مشاهده روند تغییرات نقشه استعداد"}).click();
  await expect(page).toHaveURL(/\/talent\/9box\/trends$/);
  await expect(page.getByRole("heading",{name:"تحلیل روند جابه‌جایی استعدادها"})).toBeVisible();
  const initialHistory=await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return saved.talentHistory;
  });
  expect(initialHistory.length).toBeGreaterThan(0);
  await page.reload();
  const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!).talentHistory);
  expect(afterReload).toEqual(initialHistory);
  await expect(page.locator(".trend-grid")).toHaveCount(2);
  await expect(page.locator("button.trend-cell")).toHaveCount(18);
  await expect(page.locator("main")).toContainText("سابقه ناکافی");
  await expect(page.locator("main")).toContainText("ستاره‌ها");
  await expect(page.getByRole("button",{name:/ثبت Snapshot|ثبت وضعیت|شروع دوره/})).toHaveCount(0);
  await page.getByRole("combobox",{name:"بازه مقایسه"}).click();
  await page.getByRole("option",{name:"۶ ماه گذشته"}).click();
  await expect(page.locator(".trend-grid")).toHaveCount(2);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test("unit scope, date validation and matrix filters apply to historical comparison",async({page})=>{
  await signIn(page);
  await page.goto("/talent/9box/trends");
  const before=await page.locator("table.royesh-table tbody tr").count();
  expect(before).toBeGreaterThan(0);
  await page.getByRole("combobox",{name:"واحد سازمانی"}).click();
  await page.getByRole("option",{name:"دفتر پروژه‌ها",exact:true}).click();
  await page.getByRole("textbox",{name:"جستجوی کارمند"}).fill("NO-SUCH-EMPLOYEE");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(0);
  await page.getByRole("textbox",{name:"جستجوی کارمند"}).fill("");
  await page.getByRole("button",{name:"پاک‌کردن فیلترهای افراد"}).click();
  await expect(page.getByRole("combobox",{name:"واحد سازمانی"})).toContainText("همه واحدهای مجاز");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(before);
  const selected=page.locator("button.trend-cell").nth(11);
  await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"پاک‌کردن فیلتر خانه"}).click();
  await expect(selected).toHaveAttribute("aria-pressed","false");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(before);
  const dateInput=page.getByRole("textbox",{name:"تاریخ مبنا (شمسی)"});
  await expect(dateInput).toBeVisible();
  await page.locator("app-date-field").first().locator("button").click();
  await expect(page.locator(".mat-calendar")).toBeVisible();
  await page.keyboard.press("Escape");
  await dateInput.fill("1409/01/01");
  await dateInput.press("Tab");
  await expect(page.getByRole("alert")).toContainText("تاریخ مبنا");
  await expect(page.locator(".trend-grid")).toHaveCount(0);
});

test("manager can see scoped movements, employee cannot open the comparison route",async({page})=>{
  await signIn(page,"p11","مدیر واحد");
  await page.goto("/talent/9box/trends");
  await expect(page.getByRole("heading",{name:"تحلیل روند جابه‌جایی استعدادها"})).toBeVisible();
  const entries=await page.locator("table.royesh-table tbody tr").count();
  expect(entries).toBeGreaterThan(0);
  await page.getByRole("button",{name:"خروج",exact:true}).click();
  await signIn(page,"p3","کارمند");
  await page.goto("/talent/9box/trends");
  await expect(page).not.toHaveURL(/\/talent\/9box\/trends$/);
});

test("Jalali dates and isolated demo movements never overwrite the stored history",async({page})=>{
  await signIn(page);
  await page.goto("/talent/9box/trends");
  const original=await page.evaluate(()=>localStorage.getItem("royesh.demo.v1"));
  await expect(page.getByRole("textbox",{name:"تاریخ پایان (شمسی)"})).toBeVisible();
  await page.getByRole("button",{name:"نمایش سناریوی نمونه"}).click();
  await expect(page.getByTestId("talent-demo-banner")).toContainText("حالت نمایشی فعال است");
  const totals=await page.locator(".trend-stat strong").allTextContents();
  const ascii=(t:string)=>t.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  expect(totals.slice(0,3).some(t=>Number(ascii(t))>0)).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem("royesh.demo.v1"))).toBe(original);
  await page.getByRole("button",{name:"بازگشت به تاریخچه ثبت‌شده"}).click();
  await expect(page.getByTestId("talent-demo-banner")).not.toContainText("حالت نمایشی فعال است");
  expect(await page.evaluate(()=>localStorage.getItem("royesh.demo.v1"))).toBe(original);
  await page.reload();
  await expect(page.getByRole("button",{name:"نمایش سناریوی نمونه"})).toBeVisible();
});
