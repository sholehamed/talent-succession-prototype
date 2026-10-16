import { Inject, Injectable, Optional, Pipe, PipeTransform, Provider } from '@angular/core';
import {
  MatMomentDateAdapterOptions,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import moment from 'jalali-moment';

function range<T>(length: number, valueFunction: (index: number) => T): T[] {
  const valuesArray = Array(length);
  for (let i = 0; i < length; i++) {
    valuesArray[i] = valueFunction(i);
  }
  return valuesArray;
}

@Injectable()
export class JalaliDateAdapter extends DateAdapter<moment.Moment> {
  private _localeData!: {
    firstDayOfWeek: number;
    longMonths: string[];
    shortMonths: string[];
    dates: string[];
    longDaysOfWeek: string[];
    shortDaysOfWeek: string[];
    narrowDaysOfWeek: string[];
  };

  constructor(
    @Optional() @Inject(MAT_DATE_LOCALE) dateLocale: string,
    @Optional()
    @Inject(MAT_MOMENT_DATE_ADAPTER_OPTIONS)
    private _options?: MatMomentDateAdapterOptions,
  ) {
    super();
    this.setLocale(dateLocale || 'fa');
  }

  override setLocale(locale: string): void {
    super.setLocale(locale);
    moment.locale(locale);

    const momentLocaleData = moment.localeData(locale);

    this._localeData = {
      firstDayOfWeek: momentLocaleData.firstDayOfWeek(),
      longMonths: momentLocaleData.jMonths(),
      shortMonths: momentLocaleData.jMonthsShort(),
      dates: range(31, (i) => this.createPersianDateFrom3Numbers(1400, 0, i + 1).format('jD')),
      longDaysOfWeek: momentLocaleData.weekdays(),
      shortDaysOfWeek: momentLocaleData.weekdaysShort(),
      narrowDaysOfWeek: momentLocaleData.weekdaysMin(),
    };
  }

  override getYear(date: moment.Moment): number {
    return this.clone(date).jYear();
  }

  override getMonth(date: moment.Moment): number {
    return this.clone(date).jMonth();
  }

  override getDate(date: moment.Moment): number {
    return this.clone(date).jDate();
  }

  // باید 0..6 بر اساس هفته استاندارد برگرداند (نه jDay)
  override getDayOfWeek(date: moment.Moment): number {
    return this.clone(date).day();
  }

  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    return style === 'long' ? this._localeData.longMonths : this._localeData.shortMonths;
  }

  override getDateNames(): string[] {
    return Array.from({ length: 31 }, (_, i) => String(i + 1));
  }

  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    if (style === 'long') return this._localeData.longDaysOfWeek;
    if (style === 'short') return this._localeData.shortDaysOfWeek;
    return this._localeData.narrowDaysOfWeek;
  }

  override getYearName(date: moment.Moment): string {
    return this.clone(date).jYear().toString();
  }

  override getFirstDayOfWeek(): number {
    return this._localeData.firstDayOfWeek;
  }

  override getNumDaysInMonth(date: moment.Moment): number {
    return this.clone(date).jDaysInMonth();
  }

  override clone(date: moment.Moment): moment.Moment {
    return date.clone().locale(this.locale);
  }

  override createDate(year: number, month: number, date: number): moment.Moment {
    if (month < 0 || month > 11) {
      throw Error(`Invalid month index "${month}". Month index has to be between 0 and 11.`);
    }
    if (date < 1) {
      throw Error(`Invalid date "${date}". Date has to be greater than 0.`);
    }

    const result = this.createPersianDateFrom3Numbers(year, month, date);

    if (!result.isValid()) {
      throw Error(`Invalid date "${date}" for month index "${month}".`);
    }

    return result;
  }

  override today(): moment.Moment {
    // local time + شروع روز برای جلوگیری از شیفت
    return moment().locale(this.locale).startOf('day');
  }

  override parse(value: any, parseFormat: string | string[]): moment.Moment | null {
    if (value == null || value === '') return null;

    if (typeof value === 'string') {
      // parse جلالی به صورت strict
      const m = moment(value, parseFormat as any, this.locale, true).locale(this.locale);
      return m.isValid() ? m.startOf('day') : null;
    }

    const m = moment(value).locale(this.locale);
    return m.isValid() ? m : null;
  }

  override format(date: moment.Moment, displayFormat: string): string {
    if (!this.isValid(date)) {
      throw Error('JalaliDateAdapter: Cannot format invalid date.');
    }
    return this.clone(date).locale(this.locale).format(displayFormat);
  }

  override addCalendarYears(date: moment.Moment, years: number): moment.Moment {
    return this.clone(date).add(years, 'jYear');
  }

  override addCalendarMonths(date: moment.Moment, months: number): moment.Moment {
    return this.clone(date).add(months, 'jMonth');
  }

  override addCalendarDays(date: moment.Moment, days: number): moment.Moment {
    // برای DateAdapter باید day باشد
    return this.clone(date).add(days, 'day');
  }

  override toIso8601(date: moment.Moment): string {
    return this.clone(date).toISOString();
  }

  override isDateInstance(obj: any): boolean {
    return moment.isMoment(obj);
  }

  override isValid(date: moment.Moment): boolean {
    return moment.isMoment(date) && date.isValid();
  }

  override invalid(): moment.Moment {
    return moment.invalid();
  }

  override deserialize(value: any): moment.Moment | null {
    if (value == null || value === '') return null;

    if (moment.isMoment(value)) {
      return this.clone(value);
    }

    if (value instanceof Date) {
      const m = moment(value).locale(this.locale);
      return m.isValid() ? m : null;
    }

    if (typeof value === 'string') {
      // local() برای جلوگیری از جابه‌جایی روز در ISO های UTC
      const m = moment(value).local().locale(this.locale);
      return m.isValid() ? m : null;
    }

    return super.deserialize(value);
  }

  private createPersianDateFrom3Numbers(year: number, month: number, date: number): moment.Moment {
    const result = moment(`${year}/${month + 1}/${date}`, 'jYYYY/jM/jD', this.locale, true).locale(
      this.locale,
    );

    if (!result.isValid()) {
      throw Error(`Invalid Jalali date "${year}/${month + 1}/${date}"`);
    }

    return result.startOf('day');
  }
}

@Pipe({
  name: 'PersianDate',
  standalone: true,
})
export class GregorianToJalaliPipe implements PipeTransform {
  transform(value: string | Date, format: string = 'jYYYY/jMM/jDD HH:mm:ss'): string {
    if (!value) return '';

    const m = moment(value).local().locale('fa');
    if (!m.isValid()) return '';

    return m.format(format).replace('00:00:00', '').trim();
  }
}
export const JALALI_MOMENT_FORMATS = {
  parse: { dateInput: 'jYYYY/jMM/jDD' },
  display: {
    dateInput: 'jYYYY/jMM/jDD',
    monthYearLabel: 'jYYYY jMMMM',
    dateA11yLabel: 'jYYYY/jMM/jDD',
    monthYearA11yLabel: 'jYYYY jMMMM',
  },
};
export function provideJalaliDateAdapter(): Provider[] {
  return [
    { provide: MAT_DATE_LOCALE, useValue: 'fa' },
    { provide: MAT_MOMENT_DATE_ADAPTER_OPTIONS, useValue: { useUtc: false, strict: true } },
    
    // 👇 تغییر اصلی اینجاست: استفاده از آداپتور جلالی شما به جای آداپتور پیش‌فرض
    { provide: DateAdapter, useClass: JalaliDateAdapter, deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS] }, 
    
    { provide: MAT_DATE_FORMATS, useValue: JALALI_MOMENT_FORMATS },
  ];
}