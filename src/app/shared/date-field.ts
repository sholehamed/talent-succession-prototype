import { Component, forwardRef, input } from "@angular/core";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import moment from "jalali-moment";

/** Keep calendar values as Moment but persist Gregorian date-only strings. */
export function parseGregorianIso(value: string | null | undefined): moment.Moment | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  // Construct in local time, not via Date.parse/UTC (which can shift the day).
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  // MatDatepicker expects the same value type as DateAdapter<moment.Moment>.
  return moment(date).locale("fa");
}

export function serializeGregorianIso(value: moment.Moment | null | undefined): string {
  if (!value || !moment.isMoment(value) || !value.isValid()) return "";

  // Never format with YYYY under fa locale: read Gregorian calendar parts instead.
  const date = value.toDate();
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Material DateAdapter boundary. The demo persists Gregorian yyyy-MM-dd strings. */
@Component({
  selector: "app-date-field",
  standalone: true,
  imports: [FormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateField), multi: true }],
  template: `
    <mat-form-field appearance="outline" class="date-field">
      <mat-label>{{ label() }}</mat-label>
      <input matInput [matDatepicker]="picker" [ngModel]="value"
        (ngModelChange)="changed($event)" [disabled]="disabled" (blur)="onTouched()" />
      <mat-datepicker-toggle matIconSuffix [for]="picker" [disabled]="disabled" />
      <mat-datepicker #picker />
      <mat-hint>انتخاب تاریخ شمسی؛ ذخیره‌سازی میلادی (ISO)</mat-hint>
    </mat-form-field>
  `,
})
export class DateField implements ControlValueAccessor {
  readonly label = input("تاریخ");
  value: moment.Moment | null = null;
  disabled = false;
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null | undefined): void {
    this.value = parseGregorianIso(value);
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  changed(value: moment.Moment | null): void {
    this.value = value && moment.isMoment(value) && value.isValid() ? value : null;
    this.onChange(serializeGregorianIso(this.value));
  }
}
