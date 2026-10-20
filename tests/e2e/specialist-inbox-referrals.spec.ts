import {test, expect, Page} from "@playwright/test";
import {DEFAULT_PASSWORD} from "../../src/app/core/auth";

async function signIn(page:Page,id:string,activeRole:"hr"|"evaluator") {
  if (await page.getByRole("button",{name:"خروج",exact:true}).count())
    await page.getByRole("button",{name:"خروج",exact:true}).click();
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
  const desired=activeRole==="hr"?"کارشناس منابع انسانی":"ارزیاب";
  await page.getByRole("combobox",{name:"نقش فعال"}).click();
  await page.getByRole("option",{name:desired,exact:true}).click();
}
async function select(page:Page,label:string,option:string){
  await page.getByRole("combobox",{name:label}).click();
  await page.getByRole("option",{name:option,exact:true}).click();
}
test("a newly defined specialist group appears for each assigned member in the main evaluator inbox, never outsiders",async({page})=>{
  await signIn(page,"p1","hr");
  await page.goto("/hiring/evaluator-groups");
  await page.getByRole("textbox",{name:"نام گروه"}).fill("گروه اختصاصی آزمون کارتابل");
  const jobs=page.getByRole("combobox",{name:"شغل‌های تحت پوشش گروه"});
  await jobs.click();
  await page.getByRole("option",{name:"مدیر پروژه · دفتر پروژه‌ها"}).click();
  await jobs.press("Escape");
  const members=page.getByRole("combobox",{name:"اعضای گروه ارزیاب"});
  await members.click();
  await page.getByRole("option",{name:"نیما روشن · EMP-1003"}).click();
  await page.getByRole("option",{name:"علی پارسا · EMP-1005"}).click();
  await members.press("Escape");
  await page.getByRole("button",{name:"ذخیره گروه"}).click();

  await page.goto("/hiring");
  await page.getByRole("textbox",{name:"نام و نام خانوادگی داوطلب"}).fill("داوطلب جدید کارتابل");
  await select(page,"شغل هدف استخدام","مدیر پروژه · دفتر پروژه‌ها");
  await page.getByRole("button",{name:"ثبت و آغاز ارزیابی"}).click();
  const candidatePath=new URL(page.url()).pathname;
  const candidateId=candidatePath.split("/").at(-1)!;
  await select(page,"ارزیاب کمیته عمومی","نیما روشن · EMP-1003");
  await page.getByRole("button",{name:"ارجاع به کمیته عمومی"}).click();
  await signIn(page,"p3","evaluator");
  await page.goto("/evaluations/inbox");
  const general=page.locator("mat-card.panel").filter({
    has:page.getByRole("heading",{name:"ارزیابی عمومی بدو استخدام"}),
  });
  await expect(general).toContainText("داوطلب جدید کارتابل");
  await general.getByRole("link",{name:/تکمیل پرسشنامه/}).click();
  const inputs=page.getByRole("combobox",{name:"امتیاز سؤال"});
  await expect(inputs).toHaveCount(5);
  for (let i=0;i<5;i++) {
    await inputs.nth(i).click();
    await page.getByRole("option",{name:"۴ از ۵"}).click();
  }
  await page.getByRole("textbox",{name:"شواهد و توضیح کمیته"}).fill("مستندات مصاحبه عمومی");
  await page.getByRole("button",{name:"ثبت نتیجه کمیته ارزیابی عمومی"}).click();
  await expect(page).toHaveURL(/\/hiring\/committee\/general$/);
  const completed=await page.evaluate((id)=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return state.candidates.find((c:any)=>c.id===id)?.entryWorkflow?.general?.completedAt;
  },candidateId);
  expect(completed).toBeTruthy();

  await signIn(page,"p1","hr");
  await page.goto(candidatePath);
  await expect(page.locator("main")).toContainText("مستندات مصاحبه عمومی");
  await select(page,"گروه ارزیاب تخصصی","گروه اختصاصی آزمون کارتابل · ۲ نفر");
  await page.getByRole("button",{name:"ارجاع به کمیته تخصصی"}).click();
  const snapshot=await page.evaluate((id)=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return state.candidates.find((c:any)=>c.id===id).entryWorkflow.specialist;
  },candidateId);
  expect(snapshot.assignments.map((x:any)=>x.assignedTo)).toEqual(["p3","p5"]);

  await signIn(page,"p3","evaluator");
  await page.goto("/evaluations/inbox");
  const specialist=page.locator("mat-card.panel").filter({
    has:page.getByRole("heading",{name:"ارزیابی تخصصی بدو استخدام"}),
  });
  await expect(specialist).toContainText("داوطلب جدید کارتابل");
  await expect(specialist).toContainText("گروه اختصاصی آزمون کارتابل");
  await expect(specialist.getByRole("link",{name:/تکمیل پرسشنامه/}))
    .toHaveAttribute("href",new RegExp("/hiring/committee/specialist/"+candidateId+"$"));

  await signIn(page,"p7","evaluator");
  await page.goto("/evaluations/inbox");
  await expect(page.locator("main")).not.toContainText("داوطلب جدید کارتابل");
  await page.goto("/hiring/committee/specialist/"+candidateId);
  await expect(page.locator("main")).toContainText("پرونده پیدا نشد یا دسترسی به آن ندارید");

  await signIn(page,"p5","evaluator");
  await page.goto("/evaluations/inbox");
  await expect(page.locator("main")).toContainText("داوطلب جدید کارتابل");
  await expect(page.locator("main")).toContainText("گروه اختصاصی آزمون کارتابل");
});
