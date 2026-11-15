// The values RiveComponent writes to view model properties, and how loose inputs are normalised.

import { RiveValue } from "@/web/core/RiveContract";

// The value type and its constructors are SisuCore's, ported in web/core/RiveContract.ts:
// RiveValue.string("Continue"), RiveValue.number(0.4), RiveValue.bool(true), RiveValue.enumCase("primary").
export { RiveValue };

/**
 * What RiveComponent accepts as one value: a `RiveValue`, a plain primitive, or another `{ kind, ... }` shape
 * (for example web/core's RiveValue, whichever field name it gives the payload).
 * A plain string is written to a string property, or to an enum property of that name (the case name).
 */
export type RiveValueInput =
  | RiveValue
  | string
  | number
  | boolean
  | { readonly kind: string; readonly [field: string]: unknown };

/** A complete property set, keyed by the property names in rive/contract.json. */
export type RiveValues = Readonly<Record<string, RiveValueInput>>;

/** A value ready to write. `auto` is a plain string: string or enum, decided by the property's type. */
export type NormalizedRiveValue = RiveValue | { kind: "auto"; value: string };

const kinds = new Set(["string", "number", "bool", "enumCase"]);

/** Turns any accepted input into one shape. Null for something that is not a value (it is then skipped). */
export function normalizeRiveValue(input: RiveValueInput | null | undefined): NormalizedRiveValue | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "string") return { kind: "auto", value: input };
  if (typeof input === "number") return { kind: "number", value: input };
  if (typeof input === "boolean") return { kind: "bool", value: input };
  const kind = input.kind === "boolean" ? "bool" : input.kind === "enum" ? "enumCase" : input.kind;
  if (!kinds.has(kind)) return null;
  const record = input as Record<string, unknown>;
  const payload =
    "value" in record
      ? record.value
      : (record[input.kind] ?? Object.entries(record).find(([field]) => field !== "kind")?.[1]);
  switch (kind) {
    case "string":
    case "enumCase":
      return typeof payload === "string" ? { kind, value: payload } : null;
    case "number":
      return typeof payload === "number" ? { kind, value: payload } : null;
    case "bool":
      return typeof payload === "boolean" ? { kind, value: payload } : null;
    default:
      return null;
  }
}

export function sameRiveValue(a: NormalizedRiveValue | undefined, b: NormalizedRiveValue | undefined): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.value === b.value;
}

/** A stable text form of a value set, so a parent can rebuild the object each render without rewriting. */
export function riveValuesKey(values: RiveValues | undefined): string {
  if (!values) return "";
  return Object.keys(values)
    .sort()
    .map((name) => {
      const value = normalizeRiveValue(values[name]);
      return value ? `${name}=${value.kind}:${String(value.value)}` : `${name}=-`;
    })
    .join("\u0001");
}
