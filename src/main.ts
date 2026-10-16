import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { App } from "./app/app";
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from "@angular/material/core";
import { routes } from "./app/app.routes";
bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideNativeDateAdapter(),
    // Change the DateAdapter/MAT_DATE_FORMATS here for a Jalali popup calendar.
    { provide: MAT_DATE_LOCALE, useValue: "en-GB" },
  ],
}).catch(console.error);
