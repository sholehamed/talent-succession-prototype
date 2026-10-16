import { Pipe, PipeTransform } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatTabsModule } from "@angular/material/tabs";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { statusLabels } from "../core/models";
@Pipe({ name: "faDate" })
export class FaDate implements PipeTransform {
  transform(v: string | undefined) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(d);
  }
}
@Pipe({ name: "fa" })
export class Fa implements PipeTransform {
  transform(v: number | string | null | undefined) {
    return v === null || v === undefined
      ? "—"
      : typeof v === "number"
        ? v.toLocaleString("fa-IR", { maximumFractionDigits: 1 })
        : v.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  }
}
@Pipe({ name: "status" })
export class Status implements PipeTransform {
  transform(v: string) {
    return statusLabels[v] ?? v;
  }
}
export const UI = [
  CommonModule,
  FormsModule,
  RouterLink,
  MatButtonModule,
  MatTabsModule,
  MatProgressBarModule,
  FaDate,
  Fa,
  Status,
];
export function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
