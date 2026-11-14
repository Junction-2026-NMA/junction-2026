// The short lines Sisu says at once while slower work runs, so there is never silence.
// They are fixed sentences, not model output, so each language needs its own. Where there is no translation
// Sisu says nothing rather than break into English mid-conversation; the screen still shows what is happening.
import type { BillType } from "@/lib/types";

type Lines = { offers: Record<BillType, (city: string) => string>; investigating: (name: string) => string };

const LINES: Record<string, Lines> = {
  en: {
    offers: {
      electricity: (city) => `Let me check today's electricity deals in ${city}.`,
      mobile: () => "Let me check today's mobile plans.",
      internet: (city) => `Let me check today's broadband deals in ${city}.`,
    },
    investigating: (name) => `Give me a moment, ${name}. I'm going through your last twelve months.`,
  },
  fi: {
    offers: {
      electricity: () => "Hetki, tarkistan tämän päivän sähkösopimukset.",
      mobile: () => "Hetki, tarkistan tämän päivän puhelinliittymät.",
      internet: () => "Hetki, tarkistan tämän päivän laajakaistatarjoukset.",
    },
    investigating: (name) => `Hetki vain, ${name}. Käyn läpi viimeiset kaksitoista kuukauttasi.`,
  },
  sv: {
    offers: {
      electricity: (city) => `Jag kollar dagens elavtal i ${city}.`,
      mobile: () => "Jag kollar dagens mobilabonnemang.",
      internet: (city) => `Jag kollar dagens bredbandserbjudanden i ${city}.`,
    },
    investigating: (name) => `Ett ögonblick, ${name}. Jag går igenom dina senaste tolv månader.`,
  },
  de: {
    offers: {
      electricity: (city) => `Ich prüfe die heutigen Stromtarife in ${city}.`,
      mobile: () => "Ich prüfe die heutigen Mobilfunktarife.",
      internet: (city) => `Ich prüfe die heutigen Internettarife in ${city}.`,
    },
    investigating: (name) => `Einen Moment, ${name}. Ich gehe deine letzten zwölf Monate durch.`,
  },
};

export const FILLER_LANGUAGES = Object.keys(LINES);

// `language` is the language of the conversation when known. Unknown means English, as before.
export function offerFiller(billType: BillType, city: string, language?: string): string | null {
  return LINES[language ?? "en"]?.offers[billType](city) ?? null;
}

export function investigationFiller(name: string, language?: string): string | null {
  return LINES[language ?? "en"]?.investigating(name) ?? null;
}
