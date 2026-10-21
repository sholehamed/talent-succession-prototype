import type { Band } from "./models";

/**
 * Presentation labels and color groups for the 9-box talent matrix.
 * Rows: potential HIGH -> LOW. Columns: performance LOW -> HIGH.
 *
 * Labels and colors are adapted from the user-provided 3×3 reference image.
 * They are descriptive demo language, not a validated assessment or an HR decision.
 * Keep all classification and filtering in the existing performance/potential signals.
 */
export type NineBoxTone = "amber" | "rose" | "blush";
export interface NineBoxProfile {
  readonly title: string;
  readonly tone: NineBoxTone;
}
type NineBoxKey = `${Band}-${Band}`; // performance-potential

export const nineBoxProfiles: Readonly<Record<NineBoxKey, NineBoxProfile>> = {
  "low-high":     { title: "نابغه ناکارآمد", tone: "amber" },
  "medium-high":  { title: "کارکنان با پتانسیل بالا", tone: "rose" },
  "high-high":    { title: "ستاره‌ها", tone: "rose" },
  "low-medium":   { title: "مجریان ناسازگار", tone: "blush" },
  "medium-medium":{ title: "مجریان اصلی", tone: "amber" },
  "high-medium":  { title: "مجریان با عملکرد عالی", tone: "rose" },
  "low-low":      { title: "استخدام‌های اشتباه", tone: "rose" },
  "medium-low":   { title: "مجریان مؤثر", tone: "blush" },
  "high-low":     { title: "کارکنان سخت‌کوش", tone: "amber" },
};

export function nineBoxProfile(performance: Band, potential: Band): NineBoxProfile {
  return nineBoxProfiles[`${performance}-${potential}`];
}
