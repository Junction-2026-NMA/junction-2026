// Keeps one Rive component's view model instance and moves values and triggers in and out.
// Port of ios/Sisu/Rive/RiveComponentModel.swift. No React here: RiveComponent owns one model for its lifetime
// and hands it each loaded Rive instance (`adopt`) and takes it back (`tearDown`).
import { DataType, type Rive, type ViewModelInstance } from "@rive-app/react-canvas";
import { normalizeRiveValue, sameRiveValue, type NormalizedRiveValue, type RiveValues } from "./RiveValue";

export type RivePhase =
  | { kind: "loading" }
  /** On screen. `shown` is the artboard drawn. */
  | { kind: "ready"; shown: string }
  /** The request with this key could not be loaded. The view draws a placeholder. */
  | { kind: "unavailable"; key: string };

type PropertyType = "string" | "number" | "boolean" | "enum" | "trigger";

const dataTypes: Record<PropertyType, string> = {
  string: DataType.string,
  number: DataType.number,
  boolean: DataType.boolean,
  enum: DataType.enumType,
  trigger: DataType.trigger,
};

export class RiveComponentModel {
  private phaseValue: RivePhase = { kind: "loading" };
  private instance: ViewModelInstance | null = null;
  /** The properties of the bound view model by name, as DataType values. Null when the file would not list them. */
  private properties: Map<string, string> | null = null;
  private values = new Map<string, NormalizedRiveValue>();
  private written = new Map<string, NormalizedRiveValue>();
  private queuedTriggers: string[] = [];
  private listeners: (() => void)[] = [];
  private phaseSubscribers = new Set<() => void>();

  /** Called with the name of each out trigger the Rive file fires. Replaced by the view on every render. */
  onTrigger: ((name: string) => void) | null = null;

  /** The component name, for log lines. */
  label: string;

  constructor(label: string) {
    this.label = label;
  }

  /** The component name and the out-trigger callback of the latest render. */
  configure(label: string, onTrigger: ((name: string) => void) | null): void {
    this.label = label;
    this.onTrigger = onTrigger;
  }

  get phase(): RivePhase {
    return this.phaseValue;
  }

  /** For useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.phaseSubscribers.add(listener);
    return () => this.phaseSubscribers.delete(listener);
  };

  getPhase = (): RivePhase => this.phaseValue;

  // MARK: Called by the view

  /** A new artboard is being loaded. Drops the old instance; queued triggers wait for the new one. */
  startLoading(): void {
    this.tearDown();
    this.setPhase({ kind: "loading" });
  }

  /** The request with this key cannot be shown. Queued triggers are dropped. */
  fail(reason: string, key: string): void {
    this.tearDown();
    this.queuedTriggers = [];
    const phase = this.phaseValue;
    if (phase.kind === "unavailable" && phase.key === key) return;
    log(`${this.label} cannot be shown: ${reason}`);
    this.setPhase({ kind: "unavailable", key });
  }

  /** The values the artboard should show. Only properties whose value changed are written. */
  setValues(next: RiveValues): void {
    const values = new Map<string, NormalizedRiveValue>();
    for (const [name, input] of Object.entries(next)) {
      const value = normalizeRiveValue(input);
      if (value) values.set(name, value);
    }
    this.values = values;
    this.write();
  }

  /** Fires `in` triggers by name. While the artboard is loading they wait; if it cannot load they are dropped. */
  fire(names: readonly string[]): void {
    if (names.length === 0 || this.phaseValue.kind === "unavailable") return;
    const instance = this.instance;
    if (!instance) {
      this.queuedTriggers = [...this.queuedTriggers, ...names];
      return;
    }
    for (const name of names) {
      const trigger = this.has(name, "trigger") ? safe(() => instance.trigger(name)) : null;
      if (!trigger) {
        log(`no trigger named '${name}' on ${this.label}; not fired`);
        continue;
      }
      safe(() => trigger.trigger());
    }
  }

  /** The loaded Rive instance is on screen: bind its view model, write values, listen, fire what waited. */
  adopt(rive: Rive, shown: string, outTriggers: readonly string[], key: string): void {
    this.tearDown();
    const instance = rive.viewModelInstance;
    if (!instance) {
      this.fail(`${shown} has no bound view model instance`, key);
      return;
    }
    this.instance = instance;
    this.properties = readProperties(instance);
    this.written = new Map();
    // Values first, so the first frame already shows them instead of the file's default text.
    this.write();
    const queued = this.queuedTriggers;
    this.queuedTriggers = [];
    const names = outTriggers.filter((name, index) => outTriggers.indexOf(name) === index);
    this.listeners = names.flatMap((name) => this.listen(name, instance, shown));
    this.setPhase({ kind: "ready", shown });
    this.fire(queued);
  }

  /** Stops listening and forgets the instance. Safe to call twice. */
  tearDown(): void {
    for (const stop of this.listeners) safe(stop);
    this.listeners = [];
    this.instance = null;
    this.properties = null;
    this.written = new Map();
  }

  // MARK: Values and triggers

  private write(): void {
    const instance = this.instance;
    if (!instance) return;
    for (const [name, value] of this.values) {
      if (sameRiveValue(this.written.get(name), value)) continue;
      this.written.set(name, value);
      if (!this.writeOne(instance, name, value)) {
        // A contract mismatch: the app sets a property the artboard does not have.
        log(`no ${value.kind} property named '${name}' on ${this.label}; value skipped`);
      }
    }
  }

  private writeOne(instance: ViewModelInstance, name: string, value: NormalizedRiveValue): boolean {
    return safe(() => {
      switch (value.kind) {
        case "string":
          return this.setString(instance, name, value.value);
        case "enumCase":
          return this.setEnum(instance, name, value.value);
        case "auto":
          return this.setString(instance, name, value.value) || this.setEnum(instance, name, value.value);
        case "number": {
          const property = this.has(name, "number") ? instance.number(name) : null;
          if (property) property.value = value.value;
          return property !== null;
        }
        case "bool": {
          const property = this.has(name, "boolean") ? instance.boolean(name) : null;
          if (property) property.value = value.value;
          return property !== null;
        }
      }
    }) ?? false;
  }

  private setString(instance: ViewModelInstance, name: string, text: string): boolean {
    const property = this.has(name, "string") ? instance.string(name) : null;
    if (property) property.value = text;
    return property !== null;
  }

  private setEnum(instance: ViewModelInstance, name: string, caseName: string): boolean {
    const property = this.has(name, "enum") ? instance.enum(name) : null;
    if (property) property.value = caseName;
    return property !== null;
  }

  /** True when the bound view model has a property of that name and type. When the file would not list its
   *  properties, everything is allowed through and the runtime decides. */
  private has(name: string, type: PropertyType): boolean {
    if (!this.properties) return true;
    return this.properties.get(name) === dataTypes[type];
  }

  private listen(name: string, instance: ViewModelInstance, shown: string): (() => void)[] {
    const trigger = this.has(name, "trigger") ? safe(() => instance.trigger(name)) : null;
    if (!trigger) {
      log(`${shown} has no trigger named '${name}'; not listening`);
      return [];
    }
    const callback = () => this.onTrigger?.(name);
    trigger.on(callback);
    return [() => trigger.off(callback)];
  }

  private setPhase(phase: RivePhase): void {
    this.phaseValue = phase;
    for (const listener of this.phaseSubscribers) listener();
  }
}

function readProperties(instance: ViewModelInstance): Map<string, string> | null {
  const list = safe(() => instance.properties);
  if (!list || list.length === 0) return null;
  const map = new Map<string, string>();
  for (const property of list) if (!map.has(property.name)) map.set(property.name, String(property.type));
  return map;
}

function safe<T>(body: () => T): T | null {
  try {
    return body();
  } catch (error) {
    log(`runtime error: ${String(error)}`);
    return null;
  }
}

function log(message: string): void {
  if (process.env.NODE_ENV !== "production") console.debug(`[Rive] ${message}`);
}
