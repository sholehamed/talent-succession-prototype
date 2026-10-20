import { Component, inject } from "@angular/core";
import { Store } from "../core/store";
import { UI } from "../shared/ui";
@Component({
  standalone: true,
  imports: UI,
  template:
    '<div class="panel empty"><h1>صفحه پیدا نشد</h1><p>نشانی واردشده در این نسخه وجود ندارد.</p><a mat-button [routerLink]="s.home()">بازگشت به داشبورد</a></div>',
})
export default class NotFound {
  readonly s = inject(Store);
}
