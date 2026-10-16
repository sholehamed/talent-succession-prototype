# Angular Material migration notes

Material fields use mat-form-field / matInput / mat-select; the main people and development lists use MatTable.

The Knowledge revision date, AAR follow-up deadline, and IDP deadline use app-date-field, a reusable ControlValueAccessor wrapping MatDatepicker. The app state contract is Gregorian yyyy-MM-dd. The popup calendar remains Gregorian using NativeDateAdapter; the faDate pipe displays Persian dates in output. For a true Jalali calendar, replace the global DateAdapter and MAT_DATE_FORMATS providers in src/main.ts and keep the date-field component and ISO storage contract intact.

Role selection is for a demo, not authentication. Browser storage contains synthetic records only.
