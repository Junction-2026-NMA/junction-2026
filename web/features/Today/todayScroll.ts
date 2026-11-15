// Scrolling Today to a section (SwiftUI ScrollViewReader `proxy.scrollTo(id, anchor:)`) and the screenshot
// harness's launch options: `scroll=overview|focus|baskets|recent|end` and
// `sheet=maths|settings|transactions|buffer|basket` (basket: the everyday spending basket).
import type { AppModel } from "@/web/app/AppModel";
import type { BasketId } from "@/web/core/Models";

/** Brings the section with `data-scroll-id={id}` to the top (or the bottom) of Today's scroll view. */
export function scrollToSection(stack: HTMLElement | null, id: string, anchor: "top" | "bottom", animated: boolean): void {
  const scroller = stack?.closest<HTMLElement>(".sisu-screen-scroll");
  const target = stack?.querySelector<HTMLElement>(`[data-scroll-id="${id}"]`);
  if (!scroller || (!target && anchor === "top")) return;
  const behavior: ScrollBehavior = animated ? "smooth" : "auto";
  if (anchor === "bottom" || !target) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    return;
  }
  const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top: Math.max(offset, 0), behavior });
}

/** Launch options are applied once per page load (on iOS, once when Today's content first appears). */
let launchApplied = false;

export function applyTodayLaunch(model: AppModel, stack: HTMLElement | null,
  open: { basket: (id: BasketId) => void; buffer: () => void }): void {
  if (launchApplied) return;
  launchApplied = true;
  const target = model.launch.scroll;
  if (target) scrollToSection(stack, target, target === "end" ? "bottom" : "top", false);
  const overview = model.getSnapshot().overview;
  switch (model.launch.sheet) {
    case "maths": model.setTodaySheet("maths"); break;
    case "settings": model.setTodaySheet("settings"); break;
    case "buffer": open.buffer(); break;
    case "basket": {
      const basket = overview?.baskets.find((b) => b.id === "everyday") ?? overview?.baskets[0];
      if (basket) open.basket(basket.id);
      break;
    }
    case "transactions":
      if (overview) model.showEvidence("All transactions", { from: overview.windowFrom, to: overview.windowTo });
      break;
    default: break;
  }
}
