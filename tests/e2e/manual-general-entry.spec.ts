import { test, expect, Page } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

async function login(page:Page,id:string,role:"hr"|"evaluator"){
  if(await page.getByRole("button",{name:"خروج",exact:true}).count())
    await page.getByRole("button",{name:"خروج",exact:true}).click();
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
  await page.getByRole("combobox",{name:"نقش فعال"}).click();
  await page.getByRole("option",{name:role==="hr"?"کارشناس منابع انسانی":"ارزیاب",exact:true}).click();
}
async function select(page:Page,label:string,option:string){
  await page.getByRole("combobox",{name:label,exact:true}).click();
  await page.getByRole("option",{name:option,exact:true}).click();
}

test("HR enters general indicators manually and the specialist group receives tasks immediately",async({page})=>{
  await login(page,"p1","hr");
  await page.goto("/hiring");
  await page.getByRole("textbox",{name:"نام و نام خانوادگی داوطلب"}).fill("داوطلب مسیر دستی");
  await select(page,"شغل هدف استخدام","مدیر پروژه · دفتر پروژه‌ها");
  await page.getByRole("button",{name:"ثبت و آغاز ارزیابی"}).click();
  await expect(page).toHaveURL(/\/hiring\/[^/]+$/);
  const candidatePath=new URL(page.url()).pathname;
  const id=candidatePath.split("/").at(-1)!;
  await expect(page.getByRole("checkbox",{name:"ثبت دستی نتیجه ارزیابی عمومی"})).not.toBeChecked();
  await page.getByRole("checkbox",{name:"ثبت دستی نتیجه ارزیابی عمومی"}).check();
  await expect(page.getByRole("combobox",{name:"ارزیاب کمیته عمومی"})).toHaveCount(0);
  const indicators=page.getByRole("combobox",{name:/^امتیاز /});
  await expect(indicators).toHaveCount(5);
  for(let i=0;i<5;i++){
    await indicators.nth(i).click();
    await page.getByRole("option",{name:["۲ از ۵","۳ از ۵","۴ از ۵","۵ از ۵","۱ از ۵"][i],exact:true}).click();
  }
  await page.getByRole("textbox",{name:"شواهد و توضیحات ارزیابی عمومی"})
    .fill("شواهد مصاحبه حضوری ثبت‌شده توسط منابع انسانی");
  await select(page,"گروه ارزیاب تخصصی","ارزیابان مشاغل مدیریتی · ۲ نفر");
  await page.getByRole("button",{name:"ثبت ارزیابی عمومی و ارجاع به کمیته تخصصی"}).click();
  await expect(page.locator("main")).toContainText("۱. ارزیابی عمومی (ثبت دستی)");
  await expect(page.locator("main")).toContainText("شواهد مصاحبه حضوری ثبت‌شده");
  await expect(page.locator("main")).toContainText("ارزیابان مشاغل مدیریتی");
  const saved=await page.evaluate(candidateId=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return state.candidates.find((x:any)=>x.id===candidateId);
  },id);
  expect(saved.entryWorkflow.general).toMatchObject({
    method:"manual",enteredBy:"p1",scores:[2,3,4,5,1],questions:[],
  });
  expect(saved.entryWorkflow.general.completedAt).toBeTruthy();
  expect(saved.entryWorkflow.specialist.assignments.map((x:any)=>x.assignedTo)).toEqual(["p5","p6"]);
  expect(saved.assessments).toHaveLength(0);

  await login(page,"p3","evaluator");
  await page.goto("/evaluations/inbox");
  await expect(page.locator("main")).not.toContainText("داوطلب مسیر دستی");

  for(const evaluator of ["p5","p6"]){
    await login(page,evaluator,"evaluator");
    await page.goto("/evaluations/inbox");
    await expect(page.locator("main")).toContainText("داوطلب مسیر دستی");
    await page.goto("/hiring/committee/specialist/"+id);
    const inputs=page.getByRole("combobox",{name:"امتیاز سؤال"});
    await expect(inputs).toHaveCount(5);
    for(let i=0;i<5;i++){
      await inputs.nth(i).click();
      await page.getByRole("option",{name:"۴ از ۵",exact:true}).click();
    }
    await page.getByRole("textbox",{name:"شواهد و توضیح کمیته"}).fill("ارزیابی تخصصی و شواهد "+evaluator);
    await page.getByRole("button",{name:"ثبت نتیجه کمیته ارزیابی تخصصی"}).click();
  }
  await login(page,"p1","hr");
  await page.goto(candidatePath);
  await expect(page.locator("main")).toContainText("امتیازهای کمیته تخصصی");
  await page.getByRole("textbox",{name:"جمع‌بندی و شواهد منابع انسانی"}).fill("تأیید مستند دو مرحله");
  await page.getByRole("textbox",{name:"استدلال پتانسیل"}).fill("شواهد رفتار و ظرفیت یادگیری");
  await page.getByRole("button",{name:"تأیید جمع‌بندی دو کمیته"}).click();
  const final=await page.evaluate(candidateId=>{
    const state=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return state.candidates.find((x:any)=>x.id===candidateId).assessments;
  },id);
  expect(final).toHaveLength(1);
  expect(final[0].scores).toEqual([3,3.5,4,4.5,2.5]);
  expect(final[0].generalMethod).toBe("manual");
  await page.reload();
  await expect(page.locator("main")).toContainText("نتیجه عمومی دستی و کمیته تخصصی");
});
