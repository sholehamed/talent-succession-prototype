import { test, expect, Page } from "@playwright/test";

async function signInAsHr(page:Page){
  await page.goto("/login");
  await page.getByRole("textbox",{name:"شناسه کاربری"}).fill("p1");
  await page.getByLabel("رمز عبور").fill("Royesh1405!");
  await page.getByRole("button",{name:"ورود به رویش"}).click();
  await expect(page.getByRole("combobox",{name:"نقش فعال"})).toBeVisible();
}
test.beforeEach(async ({page})=>signInAsHr(page));

const cellTitles=[
  "نابغه ناکارآمد","کارکنان با پتانسیل بالا","ستاره‌ها",
  "مجریان ناسازگار","مجریان اصلی","مجریان با عملکرد عالی",
  "استخدام‌های اشتباه","مجریان مؤثر","کارکنان سخت‌کوش",
];
const tones=[
  "amber","rose","rose",
  "blush","amber","rose",
  "rose","blush","amber",
];

function expectedCount(label:string):number{
  const count=label.match(/([0-9]+) نفر/);
  if(!count)throw new Error("Missing 9-box count in "+label);
  return Number(count[1]);
}

test("reference titles/colors enrich all nine cells without changing the existing count-and-filter behavior",async({page})=>{
  await page.goto("/talent/9box");
  const cells=page.locator("button.nine-cell");
  await expect(cells).toHaveCount(9);
  const initialRows=await page.locator("table.royesh-table tbody tr").count();
  for(let i=0;i<9;i++){
    await expect(cells.nth(i).locator(".nine-cell__title")).toHaveText(cellTitles[i]);
    await expect(cells.nth(i)).toHaveClass(new RegExp("nine-cell--"+tones[i]));
    await expect(cells.nth(i).locator(".nine-cell__count")).toBeVisible();
    await expect(cells.nth(i).locator(".nine-cell__details")).toContainText("عملکرد");
    await expect(cells.nth(i).locator(".nine-cell__details")).toContainText("پتانسیل");
    await expect(cells.nth(i)).toHaveAttribute("aria-pressed","false");
  }
  const backgrounds=await cells.evaluateAll(list=>list.map(e=>getComputedStyle(e).backgroundColor));
  expect(new Set([backgrounds[0],backgrounds[1],backgrounds[3]]).size).toBe(3);

  // The original position-to-filter rule is unchanged: "high-high" is the top-right tile.
  const stars=cells.nth(2);
  const n=expectedCount((await stars.getAttribute("aria-label"))!);
  await stars.click();
  await expect(stars).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(n);
  if(n){
    await expect(page.locator("table.royesh-table tbody tr").first()).toContainText("بالا");
  }
  // Selecting a second tile replaces the filter; it doesn't combine filters.
  const next=cells.nth(4);
  const nextCount=expectedCount((await next.getAttribute("aria-label"))!);
  await next.click();
  await expect(stars).toHaveAttribute("aria-pressed","false");
  await expect(next).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(nextCount);

  await page.getByRole("button",{name:"نمایش همه افراد"}).click();
  await expect(cells.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(initialRows);
});

test("unit filtering and narrow-screen 3x3 layout continue working",async({page})=>{
  await page.goto("/talent/9box");
  const cells=page.locator("button.nine-cell");
  await page.getByRole("combobox",{name:"واحد سازمانی"}).click();
  await page.getByRole("option",{name:"دفتر پروژه‌ها",exact:true}).click();
  const count=expectedCount((await cells.nth(4).getAttribute("aria-label"))!);
  await cells.nth(4).click();
  await expect(page.locator("table.royesh-table tbody tr")).toHaveCount(count);
  await page.setViewportSize({width:390,height:844});
  await expect(cells).toHaveCount(9);
  await expect(page.locator(".nine-grid")).toHaveCSS("grid-template-columns",/px/);
  expect(await page.locator(".nine-grid-wrap").evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await expect(cells.nth(4)).toHaveAttribute("aria-pressed","true");
});
