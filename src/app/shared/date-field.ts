import { Component, forwardRef, input } from "@angular/core";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

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
      <mat-hint>انتخاب فعلاً میلادی؛ ذخیره ISO و نمایش شمسی در گزارش‌ها</mat-hint>
    </mat-form-field>
  `,
})
export class DateField implements ControlValueAccessor {
  readonly label = input("تاریخ");
  value: Date | null = null;
  disabled = false;
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null | undefined): void {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { this.value = null; return; }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    this.value = date.getFullYear() === year && date.getMonth() === month - 1 &&
      date.getDate() === day ? date : null;
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  changed(date: Date | null): void {
    this.value = date instanceof Date && !isNaN(date.getTime()) ? date : null;
    this.onChange(this.value
      ? [this.value.getFullYear(), String(this.value.getMonth() + 1).padStart(2, "0"),
         String(this.value.getDate()).padStart(2, "0")].join("-")
      : "");
  }
}
