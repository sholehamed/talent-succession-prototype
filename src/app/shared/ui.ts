import { Pipe, PipeTransform } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatTabsModule } from "@angular/material/tabs";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatCardModule } from "@angular/material/card";
import { MatRadioModule } from "@angular/material/radio";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatListModule } from "@angular/material/list";
import { MatTableModule } from "@angular/material/table";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { DateField } from "./date-field";
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
  MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
  MatCardModule, MatRadioModule, MatCheckboxModule, MatSidenavModule,
  MatToolbarModule, MatListModule, MatTableModule, MatIconModule, MatTooltipModule,
  DateField,
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
