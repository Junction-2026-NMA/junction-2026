// Scrolling Today to a section (SwiftUI ScrollViewReader `proxy.scrollTo(id, anchor:)`) and the screenshot
// harness's launch options (`scroll=baskets|bill|insights|cashflow|end`, `sheet=maths|settings|transactions`).
import type { AppModel } from "@/web/app/AppModel";
import { BasketKind } from "@/web/core/Presentation";

/** Brings the section with `data-scroll-id={id}` to the top (or the bottom) of Today's scroll view. */
export function scrollToSection(stack: HTMLElement | null, id: string, anchor: "top" | "bottom", animated: boolean): void {
  const scroller = stack?.closest<HTMLElement>(".sisu-screen-scroll");
  const target = stack?.querySelector<HTMLElement>(`[data-scroll-id="${id}"]`);
  if (!scroller || !target) return;
  const behavior: ScrollBehavior = animated ? "smooth" : "auto";
  if (anchor === "bottom") {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    return;
  }
  const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top: Math.max(offset, 0), behavior });
}

/** Launch options are applied once per page load (on iOS, once when Today's content first appears). */
let launchApplied = false;

export function applyTodayLaunch(model: AppModel, stack: HTMLElement | null): void {
  if (launchApplied) return;
  launchApplied = true;
  const target = model.launch.scroll;
  if (target) scrollToSection(stack, target, target === "end" ? "bottom" : "top", false);
  switch (model.launch.sheet) {
    case "maths": model.setTodaySheet("maths"); break;
    case "settings": model.setTodaySheet("settings"); break;
    case "transactions": {
      const overview = model.getSnapshot().overview;
      const basket = overview?.baskets[0];
      if (overview && basket) {
        model.showEvidence(`${BasketKind.label(BasketKind.of(basket.id), "en")}: ${basket.label}`,
          { from: overview.windowFrom, to: overview.windowTo, basket: basket.id });
      }
      break;
    }
    default: break;
  }
}
