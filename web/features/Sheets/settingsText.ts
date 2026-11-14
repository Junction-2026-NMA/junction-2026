// Small text helpers for Settings, the web side of Foundation's formatters in Sheets.swift.

/** The backend address to name in a sentence. "" means this site's own /api routes, so it names the site. */
export function backendAddress(baseURLString: string): string {
  if (baseURLString.trim() !== "") return baseURLString;
  return typeof window === "undefined" ? "this site" : window.location.origin;
}

/** `ListFormatter.localizedString(byJoining:)` in English: "A", "A and B", "A, B, and C". */
export function joinNames(names: readonly string[]): string {
  if (typeof Intl !== "undefined" && "ListFormat" in Intl) {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
  }
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** `date.formatted(date: .abbreviated, time: .shortened)`, e.g. "Nov 14, 2026 at 7:24 PM". */
export function formatDateTime(date: Date): string {
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${day} at ${formatTime(date)}`;
}

/** `date.formatted(date: .omitted, time: .shortened)`, e.g. "7:24 PM". */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
