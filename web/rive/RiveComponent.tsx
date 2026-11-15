"use client";
// One Rive component as a React component. This is the only component the screens need from the Rive layer.
// Port of ios/Sisu/Rive/RiveComponentView.swift (+ RiveComponentRequest.swift).
//
//     <RiveComponent component="Button" values={RiveValues.button("Continue")}
//                    onTrigger={(name) => { /* name === "pressed" */ }} />
//
// - values: the artboard's `in` properties by name, written when the artboard appears and again whenever one
//   changes. A property you do not set keeps the Rive file's default, so set them all (web/shared/RiveValues).
// - triggers: requests to fire `in` triggers (see RiveTriggerRequest): triggers={[`celebrate#${count}`]}
//   fires `celebrate` each time `count` changes. The first array fires nothing.
// - onTrigger: called with the name of each `out` trigger the artboard fires. `listening` adds out triggers
//   the contract does not list. If you fire a trigger you also listen to, onTrigger hears your own fire.
// - Placeholder: when the component cannot be shown (file or artboard missing) a pale-mint block with its
//   name is drawn. A placeholder for a component with exactly one `out` trigger fires it when tapped.
// - Size: from the contract (see sizing.ts). `sizing` replaces the component's own; className/style from the
//   parent come last, so `sizing="contain" style={{ width: 96, height: 54 }}` scales a fixed component.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { riveContract, type RiveComponentName, type RiveSizing } from "./contract";
import { RiveCanvas } from "./RiveCanvas";
import { RiveComponentModel } from "./RiveComponentModel";
import { useRiveLibraryStatus } from "./RiveLibrary";
import { RivePlaceholder } from "./RivePlaceholder";
import { RiveTriggerRequest } from "./RiveTriggerRequest";
import { riveValuesKey, type RiveValues } from "./RiveValue";
import { riveBoxStyle } from "./sizing";
import "./rive.css";

export interface RiveComponentProps {
  /** The artboard name, for example "Button" (RiveComponents.button). */
  component: RiveComponentName;
  values?: RiveValues;
  triggers?: readonly string[];
  onTrigger?: (name: string) => void;
  /** Also listen to these `out` triggers (RiveComponentView.listening(to:)). */
  listening?: readonly string[];
  /** Use this sizing instead of the component's own (RiveComponentView.sizing(_:)). */
  sizing?: RiveSizing;
  className?: string;
  style?: CSSProperties;
  /** Makes the component one accessible element with this label (see riveAccessible in web/shared). */
  ariaLabel?: string;
  /** Read after the label, like accessibilityValue. */
  ariaValue?: string;
  /** Exposed as a button: focusable, Enter and Space call onActivate. */
  isButton?: boolean;
  /** The accessibility action: what Enter/Space (or assistive technology) does. */
  onActivate?: () => void;
  /** Let touch drags that start on the canvas scroll the page. Default true, false for VoiceButton. */
  touchScroll?: boolean;
  /** data-testid, like accessibilityIdentifier. */
  testId?: string;
  /**
   * Reduced motion: let the state machine run this long after the artboard loads and after each change of
   * `values` (so a blend lands on the new pose), then pause it, so nothing loops. Unset: plays as usual. Opt-in
   * (Liito's badges); the other components keep their own motion.
   */
  stillAfterMs?: number;
}

const EMPTY: readonly string[] = [];

export function RiveComponent(props: RiveComponentProps) {
  const { component, values, triggers = EMPTY, onTrigger, listening = EMPTY, className, style } = props;
  const contract = riveContract(component);
  const library = useRiveLibraryStatus(contract?.file ?? "sisu_ui");
  const [model] = useState(() => new RiveComponentModel(component));
  const phase = useSyncExternalStore(model.subscribe, model.getPhase, model.getPhase);

  const requestKey = `${component}|${listening.join(",")}`;
  const sizing = props.sizing ?? contract?.sizing ?? "fill";

  useEffect(() => {
    model.configure(component, onTrigger ?? null);
  });

  // The file itself is missing or broken: every component of it is a placeholder.
  useEffect(() => {
    if (!contract) model.fail(`'${component}' is not in rive/contract.json`, requestKey);
    else if (library.kind === "unavailable") model.fail(library.reason, requestKey);
  }, [model, contract, component, library, requestKey]);

  // Compared by content, so a parent may build the object on every render.
  const valuesKey = riveValuesKey(values);
  useEffect(() => {
    model.setValues(values ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, valuesKey]);

  const previousTriggers = useRef(triggers);
  const triggersKey = triggers.join("\u0001");
  useEffect(() => {
    const names = RiveTriggerRequest.namesToFire(previousTriggers.current, triggers);
    previousTriggers.current = triggers;
    model.fire(names);
    // `triggers` is compared by content through triggersKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, triggersKey]);

  const unavailable =
    !contract || library.kind === "unavailable" || (phase.kind === "unavailable" && phase.key === requestKey);
  const box = riveBoxStyle(contract?.designSize ?? { width: 0, height: 0 }, sizing);
  const outTriggers = [...(contract?.outTriggers ?? []), ...listening];

  const placeholderTap = (() => {
    const own = contract?.outTriggers ?? [];
    if (!onTrigger || own.length !== 1) return undefined;
    const only = own[0];
    return () => onTrigger(only);
  })();

  const label = props.ariaLabel;
  const accessibleName = label && props.ariaValue ? `${label}, ${props.ariaValue}` : label;
  const activate = props.onActivate;
  const onKeyDown = props.isButton
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate?.();
      }
    : undefined;

  return (
    <div
      className={className ? `sisu-rive ${className}` : "sisu-rive"}
      style={{ ...box, ...style }}
      data-rive={component}
      data-rive-phase={unavailable ? "unavailable" : phase.kind}
      data-testid={props.testId}
      role={label ? (props.isButton ? "button" : "img") : undefined}
      aria-label={accessibleName}
      tabIndex={props.isButton ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      {unavailable ? (
        <RivePlaceholder name={component} onTap={placeholderTap} />
      ) : library.kind === "available" && contract ? (
        <RiveCanvas
          key={requestKey}
          file={library.file}
          artboard={contract.name}
          sizing={sizing}
          outTriggers={outTriggers}
          model={model}
          requestKey={requestKey}
          touchScroll={props.touchScroll ?? component !== "VoiceButton"}
          stillAfterMs={props.stillAfterMs}
          stillKey={valuesKey}
        />
      ) : null}
    </div>
  );
}
