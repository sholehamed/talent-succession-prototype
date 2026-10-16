import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { App } from "./app/app";
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from "@angular/material/core";
import { routes } from "./app/app.routes";
import { provideJalaliDateAdapter } from "./app/shared/JalaliDateAdapter";
bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideJalaliDateAdapter()
  ],
}).catch(console.error);
