// Cuts a token stream into whole sentences, so each one can go to text to speech the moment it is finished.

const MIN_SENTENCE_CHARS = 16; // avoids speaking fragments like "Yes." on their own audio request
const BOUNDARY = /[.!?]["')\]]?\s/g;

export type SentenceSplitter = { push: (text: string) => string[]; flush: () => string[] };

export function createSentenceSplitter(): SentenceSplitter {
  let buffer = "";

  const takeReady = (): string[] => {
    const ready: string[] = [];
    BOUNDARY.lastIndex = 0;
    let start = 0;
    let match: RegExpExecArray | null;
    while ((match = BOUNDARY.exec(buffer)) !== null) {
      const end = match.index + match[0].length;
      const candidate = buffer.slice(start, end).trim();
      if (candidate.length < MIN_SENTENCE_CHARS) continue; // keep growing it
      ready.push(candidate);
      start = end;
    }
    buffer = buffer.slice(start);
    return ready;
  };

  return {
    push(text) {
      buffer += text;
      return takeReady();
    },
    flush() {
      const rest = buffer.trim();
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}

// Spoken text must not contain markdown or symbols a voice would read aloud.
export function forSpeech(text: string): string {
  return text
    .replace(/[*_#`]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
