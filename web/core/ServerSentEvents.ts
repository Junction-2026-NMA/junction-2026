// An incremental parser for server-sent events (the `text/event-stream` format the agent endpoints answer
// in). Port of SisuCore/ServerSentEvents.swift. The streams are POSTs, so they are read with fetch and a
// ReadableStream (EventSource cannot POST); the bytes of each chunk go through `SSEParser.feed`.
import { SisuEvent } from "./CoachModels";

/** One message of an event stream: the joined `data:` lines, and the optional `event:` and `id:` fields. */
export interface ServerSentEvent {
  data: string;
  event?: string | null;
  id?: string | null;
}

const LF = 0x0a;
const CR = 0x0d;
const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });
const encoder = new TextEncoder();

/** Feed it bytes (in chunks of any size) or whole lines; it gives back each message as soon as its blank
 * separator line has arrived.
 * - Lines end with LF, CRLF or CR. A line split across two chunks is carried over, also in the middle of a
 *   multi-byte character or between the CR and the LF.
 * - Several `data:` lines of one message are joined with a newline.
 * - Lines that start with `:` are comments (keep-alives) and are ignored, like `retry:` and unknown fields.
 * - One space after the colon is dropped.
 * - A message without any `data:` line is not reported. */
export class SSEParser {
  private line: number[] = [];
  private lastWasCR = false;
  private dataLines: string[] = [];
  private eventName: string | null = null;
  private lastId: string | null = null;
  private atStart = true;

  /** Feeds raw bytes (or text) and returns the messages they complete. */
  feed(input: Uint8Array | string): ServerSentEvent[] {
    const bytes = typeof input === "string" ? encoder.encode(input) : input;
    const out: ServerSentEvent[] = [];
    for (const byte of bytes) {
      if (byte === LF) {
        if (this.lastWasCR) { this.lastWasCR = false; continue; }
        const event = this.endLine();
        if (event) out.push(event);
      } else if (byte === CR) {
        this.lastWasCR = true;
        const event = this.endLine();
        if (event) out.push(event);
      } else {
        this.lastWasCR = false;
        this.line.push(byte);
      }
    }
    return out;
  }

  /** Feeds one complete line, without its line ending. Returns a message when the line is the blank separator. */
  feedLine(text: string): ServerSentEvent | null {
    return this.process(text);
  }

  /** Call when the stream has ended: a last line without a line ending is read, and a message that was not
   * followed by a blank line is still reported. */
  finish(): ServerSentEvent[] {
    const out: ServerSentEvent[] = [];
    if (this.line.length > 0) {
      const event = this.endLine();
      if (event) out.push(event);
    }
    const last = this.dispatch();
    if (last) out.push(last);
    this.lastWasCR = false;
    return out;
  }

  private endLine(): ServerSentEvent | null {
    const text = utf8.decode(Uint8Array.from(this.line));
    this.line = [];
    return this.process(text);
  }

  private process(raw: string): ServerSentEvent | null {
    let text = raw;
    if (this.atStart) {
      this.atStart = false;
      if (text.startsWith("﻿")) text = text.slice(1);
    }
    if (text === "") return this.dispatch();
    if (text.startsWith(":")) return null;
    const colon = text.indexOf(":");
    const field = colon >= 0 ? text.slice(0, colon) : text;
    let value = colon >= 0 ? text.slice(colon + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") this.dataLines.push(value);
    else if (field === "event") this.eventName = value;
    else if (field === "id") this.lastId = value;
    return null;
  }

  private dispatch(): ServerSentEvent | null {
    const lines = this.dataLines;
    const event = this.eventName;
    this.dataLines = [];
    this.eventName = null;
    if (lines.length === 0) return null;
    return { data: lines.join("\n"), event, id: this.lastId };
  }
}

/** Turns the bytes of an agent stream into `SisuEvent`s. */
export class SisuEventStreamParser {
  private readonly parser = new SSEParser();

  /** Messages that are not a JSON object with a `type` are skipped; unknown types come back as `unknown`. */
  feed(input: Uint8Array | string): SisuEvent[] {
    return decodeAll(this.parser.feed(input));
  }

  finish(): SisuEvent[] {
    return decodeAll(this.parser.finish());
  }

  /** Parses a whole recorded stream at once. */
  static events(data: Uint8Array | string): SisuEvent[] {
    const parser = new SisuEventStreamParser();
    return [...parser.feed(data), ...parser.finish()];
  }
}

function decodeAll(messages: ServerSentEvent[]): SisuEvent[] {
  return messages.map((m) => SisuEvent.decode(m.data)).filter((e): e is SisuEvent => e !== null);
}
