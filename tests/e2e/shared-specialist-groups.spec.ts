import {test, expect, Page} from "@playwright/test";

async function login(page:Page,id:string,role?:string) {
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
  if (role) {
    await page.getByRole("combobox",{name:"نقش فعال"}).click();
    await page.getByRole("option",{name:role,exact:true}).click();
  }
}
test("HR can build a shared two-job specialist group, persist it and only HR can edit it",async({page})=>{
  await login(page,"p1");
  await page.goto("/hiring/evaluator-groups");
  await expect(page.getByRole("heading",{name:"گروه‌های ارزیاب تخصصی"})).toBeVisible();
  await page.getByRole("textbox",{name:"نام گروه"}).fill("ارزیابی مشترک مدیران نمونه");
  const jobs=page.getByRole("combobox",{name:"شغل‌های تحت پوشش گروه"});
  await jobs.click();
  await page.getByRole("option",{name:"مدیر پروژه · دفتر پروژه‌ها"}).click();
  await page.getByRole("option",{name:"مدیر فناوری اطلاعات · فناوری اطلاعات"}).click();
  await jobs.press("Escape");
  const members=page.getByRole("combobox",{name:"اعضای گروه ارزیاب"});
  await members.click();
  await page.getByRole("option",{name:"نیما روشن · EMP-1003"}).click();
  await page.getByRole("option",{name:"علی پارسا · EMP-1005"}).click();
  await members.press("Escape");
  await page.getByRole("button",{name:"ذخیره گروه"}).click();
  await expect(page.locator("main")).toContainText("ارزیابی مشترک مدیران نمونه");
  await page.reload();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("royesh.demo.v1")!));
  const created=state.entryEvaluatorGroups.find((g:any)=>g.name==="ارزیابی مشترک مدیران نمونه");
  expect(created).toMatchObject({jobIds:["j1","j4"],memberIds:["p3","p5"],isActive:true});
  await page.getByRole("button",{name:"خروج",exact:true}).click();
  await login(page,"p5","ارزیاب");
  await page.goto("/hiring/evaluator-groups");
  await expect(page).toHaveURL(/\/evaluations\/inbox$/);
});
