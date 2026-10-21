import { describe, expect, it } from "vitest";
import type { Band } from "../src/app/core/models";
import { nineBoxProfile, nineBoxProfiles, NineBoxTone } from "../src/app/core/nine-box";

const columns:Band[]=["low","medium","high"];
const rows:Band[]=["high","medium","low"];
const expected=[
  ["نابغه ناکارآمد","کارکنان با پتانسیل بالا","ستاره‌ها"],
  ["مجریان ناسازگار","مجریان اصلی","مجریان با عملکرد عالی"],
  ["استخدام‌های اشتباه","مجریان مؤثر","کارکنان سخت‌کوش"],
];
const colors:NineBoxTone[][]=[
  ["amber","rose","rose"],["blush","amber","rose"],["rose","blush","amber"],
];

describe("nine-box talent map reference presentation",()=>{
  it("keeps nine unique titles in the original performance/potential positions",()=>{
    const titles:string[]=[];
    for(let y=0;y<rows.length;y++)
      for(let x=0;x<columns.length;x++){
        const result=nineBoxProfile(columns[x],rows[y]);
        expect(result.title).toBe(expected[y][x]);
        expect(result.tone).toBe(colors[y][x]);
        titles.push(result.title);
      }
    expect(Object.keys(nineBoxProfiles)).toHaveLength(9);
    expect(new Set(titles).size).toBe(9);
  });
  it("does not redefine levels, scores, membership, or filtering rules",()=>{
    expect(Object.values(nineBoxProfiles).every(cell=>
      ["amber","rose","blush"].includes(cell.tone))).toBe(true);
    const definitions=JSON.stringify(nineBoxProfiles);
    expect(definitions).not.toContain("personId");
    expect(definitions).not.toContain("jobId");
    expect(definitions).not.toContain("performanceScore");
  });
});
