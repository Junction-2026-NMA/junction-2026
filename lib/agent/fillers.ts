// The short lines Sisu says at once while slower work runs, so there is never silence.
// They are fixed sentences, not model output, so each language needs its own. Where there is no translation
// Sisu says nothing rather than break into English mid-conversation; the screen still shows what is happening.
// Each has several phrasings, picked by the turn number, so a conversation never hears the same line twice in a
// row and a voice chat sounds less like a recording. The choice is deterministic: the same turn gets the same line.
import type { BillType } from "@/lib/types";

type Line<T> = ((value: T) => string)[];
type Lines = { offers: Record<BillType, Line<string>>; investigating: Line<string>; researching: string[] };

const LINES: Record<string, Lines> = {
  en: {
    offers: {
      electricity: [(city) => `Let me check today's electricity deals in ${city}.`, () => "One sec, I'm pulling up today's electricity prices.", (city) => `Okay, looking at what electricity costs in ${city} today.`, () => "Sure, I'll compare today's electricity offers."],
      mobile: [() => "Let me check today's mobile plans.", () => "One sec, I'm looking at mobile plans out there today.", () => "Okay, comparing today's mobile plans.", () => "Sure, checking what mobile plans cost right now."],
      internet: [(city) => `Let me check today's broadband deals in ${city}.`, () => "One sec, I'm looking at broadband offers today.", (city) => `Okay, comparing home internet deals in ${city}.`, () => "Sure, checking what broadband costs right now."],
    },
    investigating: [(name) => `Give me a moment, ${name}. I'm going through your last twelve months.`, (name) => `Okay ${name}, I'm looking through your past year now.`, () => "Sure, I'll go through your year and pick the one thing worth doing.", (name) => `On it, ${name}. Reading through your last twelve months.`],
    researching: ["Let me look into that properly. I'm reading a few sources.", "Good question. I'm checking a few sources on that.", "Hmm, let me read up on that for a second.", "Okay, I'm looking that up in a few places."],
  },
  fi: {
    offers: {
      electricity: [() => "Hetki, tarkistan tämän päivän sähkösopimukset.", () => "Selvä, katson mitä sähkö maksaa tänään.", () => "Odota hetki, vertailen sähkötarjouksia."],
      mobile: [() => "Hetki, tarkistan tämän päivän puhelinliittymät.", () => "Selvä, katson tämän päivän liittymiä.", () => "Odota hetki, vertailen puhelinliittymiä."],
      internet: [() => "Hetki, tarkistan tämän päivän laajakaistatarjoukset.", () => "Selvä, katson laajakaistatarjouksia.", () => "Odota hetki, vertailen nettiliittymiä."],
    },
    investigating: [(name) => `Hetki vain, ${name}. Käyn läpi viimeiset kaksitoista kuukauttasi.`, (name) => `Selvä ${name}, katson viime vuotesi läpi.`, () => "Okei, käyn vuotesi läpi ja etsin yhden tärkeimmän asian."],
    researching: ["Hetki, selvitän tämän kunnolla. Luen muutaman lähteen.", "Hyvä kysymys. Tarkistan pari lähdettä.", "Selvä, katson tätä muutamasta paikasta."],
  },
  sv: {
    offers: {
      electricity: [(city) => `Jag kollar dagens elavtal i ${city}.`, () => "Ett ögonblick, jag tittar på dagens elpriser.", () => "Okej, jag jämför dagens elerbjudanden."],
      mobile: [() => "Jag kollar dagens mobilabonnemang.", () => "Ett ögonblick, jag tittar på mobilabonnemang.", () => "Okej, jag jämför dagens mobilabonnemang."],
      internet: [(city) => `Jag kollar dagens bredbandserbjudanden i ${city}.`, () => "Ett ögonblick, jag tittar på bredband.", () => "Okej, jag jämför dagens bredbandserbjudanden."],
    },
    investigating: [(name) => `Ett ögonblick, ${name}. Jag går igenom dina senaste tolv månader.`, (name) => `Okej ${name}, jag tittar igenom ditt senaste år.`, () => "Visst, jag går igenom ditt år och letar efter det viktigaste."],
    researching: ["Ett ögonblick, jag tar reda på det ordentligt. Jag läser några källor.", "Bra fråga. Jag kollar några källor.", "Okej, jag slår upp det på några ställen."],
  },
  de: {
    offers: {
      electricity: [(city) => `Ich prüfe die heutigen Stromtarife in ${city}.`, () => "Einen Moment, ich schaue mir die Strompreise von heute an.", () => "Okay, ich vergleiche die heutigen Stromangebote."],
      mobile: [() => "Ich prüfe die heutigen Mobilfunktarife.", () => "Einen Moment, ich schaue mir Handytarife an.", () => "Okay, ich vergleiche die heutigen Mobilfunktarife."],
      internet: [(city) => `Ich prüfe die heutigen Internettarife in ${city}.`, () => "Einen Moment, ich schaue mir Internettarife an.", () => "Okay, ich vergleiche die heutigen Internetangebote."],
    },
    investigating: [(name) => `Einen Moment, ${name}. Ich gehe deine letzten zwölf Monate durch.`, (name) => `Okay ${name}, ich schaue mir dein letztes Jahr an.`, () => "Klar, ich gehe dein Jahr durch und suche das Wichtigste."],
    researching: ["Einen Moment, ich schaue mir das genau an. Ich lese ein paar Quellen.", "Gute Frage. Ich prüfe ein paar Quellen.", "Okay, ich schlage das kurz nach."],
  },
};

export const FILLER_LANGUAGES = Object.keys(LINES);

// Which phrasing to use. `turn` is how many times the customer has spoken before in this conversation; `recent` is
// what Sisu said in its last answers, so a line already heard is skipped. The same inputs always give the same line.
export type FillerContext = { turn?: number; recent?: string[] };

function pick<T>(options: Line<T>, value: T, context: FillerContext = {}): string | null {
  if (!options.length) return null;
  const start = Math.max(Math.floor(context.turn ?? 0), 0) % options.length;
  const last = (context.recent ?? []).slice(-2).join(" ");
  for (let step = 0; step < options.length; step++) {
    const line = options[(start + step) % options.length](value);
    if (!last.includes(line)) return line;
  }
  return options[start](value);
}

// `language` is the language of the conversation when known. Unknown means English, as before.
export function offerFiller(billType: BillType, city: string, language?: string, context?: FillerContext): string | null {
  const lines = LINES[language ?? "en"]?.offers[billType];
  return lines ? pick(lines, city, context) : null;
}

export function investigationFiller(name: string, language?: string, context?: FillerContext): string | null {
  const lines = LINES[language ?? "en"]?.investigating;
  return lines ? pick(lines, name, context) : null;
}

export function researchFiller(language?: string, context?: FillerContext): string | null {
  const lines = LINES[language ?? "en"]?.researching;
  return lines ? pick(lines.map((line) => () => line), undefined, context) : null;
}

// Every phrasing of every line in one language, for warming the speech cache.
export function allFillers(city: string, language = "en"): string[] {
  const lines = LINES[language];
  if (!lines) return [];
  return [...Object.values(lines.offers).flatMap((options) => options.map((line) => line(city))), ...lines.researching];
}
