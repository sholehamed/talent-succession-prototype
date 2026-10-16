import "@angular/compiler";
import { describe, expect, it } from "vitest";
import moment from "jalali-moment";
import { parseGregorianIso, serializeGregorianIso } from "../src/app/shared/date-field";

describe("DateField Gregorian ISO / Jalali Moment boundary", () => {
  it("round-trips date-only values across normal, leap, and Nowruz dates", () => {
    for (const iso of ["2024-02-29", "2025-03-20", "2026-10-17", "2028-03-20"]) {
      const value = parseGregorianIso(iso);
      expect(value).not.toBeNull();
      expect(moment.isMoment(value)).toBe(true);
      expect(serializeGregorianIso(value)).toBe(iso);
    }
  });

  it("rejects impossible Gregorian ISO input instead of shifting the date", () => {
    for (const value of ["", "2025-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "1405/07/25"]) {
      expect(parseGregorianIso(value)).toBeNull();
    }
    expect(parseGregorianIso(null)).toBeNull();
    expect(parseGregorianIso(undefined)).toBeNull();
  });

  it("serializes Material Moment selections as Gregorian local calendar dates", () => {
    const selected = moment(new Date(2026, 9, 17)).locale("fa");
    expect(serializeGregorianIso(selected)).toBe("2026-10-17");
    expect(serializeGregorianIso(null)).toBe("");
    expect(serializeGregorianIso(moment.invalid())).toBe("");
  });
});
