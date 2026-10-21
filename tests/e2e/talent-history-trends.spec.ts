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
  expect(initialHistory.filter((e:{source:string})=>e.source==="demo")).toHaveLength(540);
  await expect(page.getByTestId("talent-demo-banner")).toContainText("داده آزمایشی");
  await page.reload();
  const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!).talentHistory);
  expect(afterReload).toEqual(initialHistory);
  await expect(page.locator(".trend-grid")).toHaveCount(2);
  await expect(page.locator("button.trend-cell")).toHaveCount(18);
  await expect(page.locator(".trend-stat").last()).toContainText("۰");
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

test("12-month seeded history is available on first load and survives refresh",async({page})=>{
  await signIn(page);
  await page.goto("/talent/9box/trends");
  await expect(page.getByRole("combobox",{name:"بازه مقایسه"})).toContainText("۱۲ ماه گذشته");
  await expect(page.getByTestId("talent-demo-banner")).toContainText("داده آزمایشی");
  await expect(page.locator(".trend-stat").last()).toContainText("۰");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(36);
  await expect(page.locator("table.royesh-table tbody tr").first()).toContainText("نمایشی");
  const saved=await page.evaluate(()=>localStorage.getItem("royesh.demo.v1"));
  await page.reload();
  expect(await page.evaluate(()=>localStorage.getItem("royesh.demo.v1"))).toBe(saved);
  await expect(page.getByRole("button",{name:"نمایش سناریوی نمونه"})).toHaveCount(0);
});
test("preexisting browser save gets 15-month samples without resetting actual data",async({page})=>{
  await signIn(page);
  await page.goto("/talent/9box/trends");
  const old=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    state.talentHistory=state.talentHistory.filter((e:{source:string})=>e.source!=="demo");
    localStorage.setItem("royesh.demo.v1",JSON.stringify(state));
    return {actual:state.talentHistory,people:state.people};
  });
  await page.reload();
  const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  expect(migrated.people).toEqual(old.people);
  expect(migrated.talentHistory.filter((e:{source:string})=>e.source!=="demo")).toEqual(old.actual);
  expect(migrated.talentHistory.filter((e:{source:string})=>e.source==="demo")).toHaveLength(540);
  await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!)
    .talentHistory.filter((e:{source:string})=>e.source==="demo").length)).toBe(540);
});
