import { test, expect, Page } from "@playwright/test";
import { DEFAULT_PASSWORD } from "../../src/app/core/auth";

async function signIn(page:Page,id:string,role:"hr"|"manager"|"executive"="hr"){
  if(await page.getByRole("button",{name:"خروج",exact:true}).count())
    await page.getByRole("button",{name:"خروج",exact:true}).click();
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
  await page.getByRole("combobox",{name:"نقش فعال"}).click();
  await page.getByRole("option",{name:role==="hr"?"کارشناس منابع انسانی":
    role==="manager"?"مدیر واحد":"مدیرعامل",exact:true}).click();
}
test("HR manages the independent bank, snapshots successors, scores in a modal, compares, closes and restarts",async({page})=>{
  await signIn(page,"p1");
  await page.goto("/talent/prospective/indicators");
  await expect(page.getByRole("heading",{name:"مدیریت شاخص‌های ارزیابی آینده‌نگر"})).toBeVisible();
  await page.getByRole("textbox",{name:"عنوان شاخص"}).fill("آینده‌نگری بین‌واحدی");
  await page.getByRole("textbox",{name:"توضیح شاخص"}).fill("نمونه طراحی جدید");
  await page.getByRole("button",{name:"ذخیره شاخص"}).click();
  await expect(page.locator("main")).toContainText("آینده‌نگری بین‌واحدی");
  await page.goto("/talent/prospective/questions");
  await expect(page.getByRole("heading",{name:"بانک سؤالات ارزیابی آینده‌نگر"})).toBeVisible();
  await page.getByRole("combobox",{name:"شاخص مرتبط"}).click();
  await page.getByRole("option",{name:"آینده‌نگری بین‌واحدی"}).click();
  await page.getByRole("textbox",{name:"متن سؤال"}).fill("آیا گزینه‌های بلندمدت را بررسی می‌کند؟");
  await page.getByRole("button",{name:"ذخیره سؤال"}).click();
  await page.goto("/talent/succession?position=pos1");
  await expect(page.getByRole("heading",{name:"ارزیابی آینده‌نگر جانشینان"})).toBeVisible();
  const oldNominations=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return s.nominations.filter((n:any)=>n.positionId==="pos1").map((n:any)=>({
      personId:n.personId,readiness:n.readiness,
    }));
  });
  expect(oldNominations.length).toBeGreaterThanOrEqual(3);
  await page.getByRole("button",{name:"شروع ارزیابی آینده‌نگر"}).click();
  await expect(page.locator("main")).toContainText("در انتظار تکمیل");
  const start=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    const r=s.prospectiveRuns.find((x:any)=>x.positionId==="pos1");
    return r;
  });
  expect(start.nominees.map((n:any)=>({personId:n.personId,readiness:n.readiness})))
    .toEqual(oldNominations);
  expect(start.questions.length).toBe(11);
  expect(start.results).toHaveLength(0);
  expect(start.positionId).toBe("pos1");
  await expect(page.getByRole("button",{name:"شروع ارزیابی آینده‌نگر"})).toBeDisabled();

  for(const nominee of start.nominees){
    // Each completed candidate loses its button and receives a score in the same card.
    const card=page.locator("mat-card.panel").filter({has:page.locator('a[href="/people/'+nominee.personId+'"]')}).first();
    await card.getByRole("button",{name:"تکمیل ارزیابی آینده‌نگر"}).click();
    const dialog=page.getByRole("dialog");
    await expect(dialog.getByRole("heading",{name:/ارزیابی آینده‌نگر/})).toBeVisible();
    const answers=dialog.getByRole("combobox",{name:"امتیاز سؤال"});
    await expect(answers).toHaveCount(11);
    for(let i=0;i<11;i++){
      await answers.nth(i).click();
      await page.getByRole("option",{name:"۴ از ۵",exact:true}).click();
    }
    await dialog.getByRole("textbox",{name:"شواهد و توضیح ارزیابی آینده‌نگر"}).fill("شواهد مستند "+nominee.personId);
    await dialog.getByRole("button",{name:"ثبت نتیجه آینده‌نگر"}).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toContainText("امتیاز آینده‌نگر");
    await expect(card.getByRole("button",{name:"تکمیل ارزیابی آینده‌نگر"})).toHaveCount(0);
  }
  await expect(page.getByRole("heading",{name:"مقایسه نتایج آینده‌نگر نامزدهای Snapshot"})).toBeVisible();
  const persisted=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return s.prospectiveRuns.find((r:any)=>r.positionId==="pos1");
  });
  expect(persisted.results).toHaveLength(start.nominees.length);
  expect(persisted.results.every((r:any)=>r.score===4)).toBe(true);
  await page.getByRole("button",{name:"بستن دوره ارزیابی"}).click();
  await page.reload();
  await expect(page.locator("main")).toContainText("بسته‌شده");
  await page.getByRole("button",{name:"شروع ارزیابی آینده‌نگر"}).click();
  const periods=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("royesh.demo.v1")!);
    return s.prospectiveRuns.filter((r:any)=>r.positionId==="pos1");
  });
  expect(periods).toHaveLength(2);
  expect(periods[0].status).toBe("closed");
  expect(periods[0].results).toHaveLength(start.nominees.length);
});

test("executive can compare previous results but cannot edit the bank or start assessment",async({page})=>{
  await signIn(page,"p1");
  await page.goto("/talent/succession?position=pos1");
  await page.getByRole("button",{name:"شروع ارزیابی آینده‌نگر"}).click();
  await signIn(page,"p11","executive");
  await page.goto("/talent/succession?position=pos1");
  await expect(page.getByRole("heading",{name:"ارزیابی آینده‌نگر جانشینان"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"مقایسه نتایج آینده‌نگر نامزدهای Snapshot"})).toBeVisible();
  await expect(page.getByRole("button",{name:"شروع ارزیابی آینده‌نگر"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"تکمیل ارزیابی آینده‌نگر"})).toHaveCount(0);
  await page.goto("/talent/prospective/questions");
  await expect(page).not.toHaveURL(/talent\/prospective\/questions/);
});
