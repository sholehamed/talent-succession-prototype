import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { primaryNavigationIcons } from "./navigation-icons.primary";
import { secondaryNavigationIcons } from "./navigation-icons.secondary";

/** Material SVG icons are embedded locally, not loaded from Google Fonts or a CDN. */
export function registerNavigationIcons(registry: MatIconRegistry, sanitizer: DomSanitizer): void {
  for (const [name, svg] of Object.entries({
    ...primaryNavigationIcons,
    ...secondaryNavigationIcons,
  })) {
    registry.addSvgIconLiteral("nav-" + name, sanitizer.bypassSecurityTrustHtml(svg));
  }
}
