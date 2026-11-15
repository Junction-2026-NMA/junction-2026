// How a parent asks RiveComponent to fire an `in` trigger. Port of ios/Sisu/Rive/RiveTriggerRequest.swift.
//
// The `triggers` prop of RiveComponent is a list of requests. A request is the trigger's name, optionally
// followed by `#` and a stamp: "reveal", "reveal#2". The stamp is any text; it is never sent to Rive. It only
// makes a request different from the one before.
//
// Rules:
// 1. The array a component starts with fires nothing. It is the baseline, so a component that React remounts
//    (a list, a tab switch) never repeats an old trigger.
// 2. Each time the array changes, every request that was not in the previous array fires once.
// 3. To fire the same trigger again, change its stamp. A counter is enough:
//        const [celebrations, setCelebrations] = useState(0);
//        <RiveComponent component="Jar" values={jar} triggers={[`celebrate#${celebrations}`]} />
//        // later: setCelebrations((n) => n + 1)   -> fires `celebrate` once
// A request made while the artboard is still loading is kept and fired when it is ready.

export const RiveTriggerRequest = {
  /** The trigger name of a request: the text before the first `#`. */
  name(request: string): string {
    const hash = request.indexOf("#");
    return hash < 0 ? request : request.slice(0, hash);
  },

  /** The trigger names to fire when the array changes from `old` to `new`, in the order of `new`. */
  namesToFire(old: readonly string[], next: readonly string[]): string[] {
    const seen = new Set(old);
    return next
      .filter((request) => !seen.has(request))
      .map((request) => RiveTriggerRequest.name(request))
      .filter((name) => name.length > 0);
  },
} as const;
