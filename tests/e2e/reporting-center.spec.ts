import {test, expect, Page} from "@playwright/test";
import {DEFAULT_PASSWORD} from "../../src/app/core/auth";
async function login(page:Page,id="p1") {
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill(id);
  await page.getByLabel("رمز عبور").fill(DEFAULT_PASSWORD);
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
}
test("independent reports navigate from sidebar, filter real data and export XLSX",async({page})=>{
  await login(page);
  await page.goto("/reports");
  await expect(page.getByRole("heading",{name:"گزارش‌ها و تحلیل",exact:true})).toBeVisible();
  await expect(page.locator("main .stat")).toHaveCount(4);
  await expect(page.getByRole("link",{name:"مرکز گزارش‌ها و تحلیل",exact:true})).toHaveAttribute("aria-current","page");
  const summary=page.locator("main .stat").first().locator("strong");
  await expect(summary).not.toBeEmpty();
  await page.getByRole("combobox",{name:"واحد سازمانی"}).click();
  await page.getByRole("option",{name:"دفتر پروژه‌ها"}).click();
  const rows=page.locator("table.report-data tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("دفتر پروژه‌ها");
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/خروجی Excel/}).click();
  const downloaded=await downloadPromise;
  expect(downloaded.suggestedFilename()).toMatch(/\.xlsx$/);
  const file=await downloaded.path();
  const {readFile}=await import("node:fs/promises");
  const bytes=await readFile(file!);
  expect(bytes.toString("hex",0,4)).toBe("504b0304");
  expect(bytes.toString("utf8")).toContain("xl/worksheets/sheet3.xml");
});
test("hiring filters and all rows are included in the printable RTL PDF view",async({page})=>{
  await login(page);
  await page.goto("/reports");
  await page.getByRole("button",{name:"ارزیابی بدو استخدام",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"وضعیت"})).toBeVisible();
  await expect(page.getByLabel("از تاریخ ثبت (میلادی)")).toBeVisible();
  await page.getByRole("combobox",{name:"وضعیت"}).click();
  await page.getByRole("option",{name:"در انتظار ارجاع"}).click();
  await expect(page.locator("table.report-data tbody tr").first()).toContainText("در انتظار ارجاع");
  await page.evaluate(()=>{
    window.print=()=>{document.body.setAttribute("data-print-invoked","yes");};
  });
  await page.getByRole("button",{name:"چاپ / ذخیره PDF"}).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-invoked","yes");
  const print=page.locator("#royesh-report-print-root");
  await expect(print).toHaveAttribute("dir","rtl");
  await expect(print.locator("table tbody tr")).toHaveCount(await page.locator("table.report-data tbody tr").count());
  await expect(print).toContainText("ارزیابی بدو استخدام");
});
test("manager keeps own unit and cannot open HR hiring reports, employee cannot open /reports",async({page})=>{
  await login(page,"p2");
  await page.goto("/reports");
  await expect(page.getByRole("combobox",{name:"واحد سازمانی"})).toBeDisabled();
  await expect(page.getByRole("button",{name:"ارزیابی بدو استخدام",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"خروج",exact:true}).click();
  await login(page,"p5");
  await page.goto("/reports");
  await expect(page).not.toHaveURL(/\/reports$/);
});
