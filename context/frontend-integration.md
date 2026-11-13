# Plugging the agent into the frontend

For whoever builds the screens (lane A). Everything here works in mock mode with no API keys.

## Try it first

```bash
npm run dev
```

Open http://localhost:3000/dev/agent. Hold the big button to talk, or type. The page shows each step and its timing. Its code (`app/dev/agent/`) is a working example of everything below; copy from it freely.

## One hook does it all

```tsx
"use client";
import { useSisu } from "@/lib/agent/useSisu";

export function AskSisu({ customerId }: { customerId: string }) {
  const sisu = useSisu({ customerId, focusBill: "electricity" }); // focusBill only while a bill card is open

  return (
    <>
      {sisu.server?.mock && <span>Mock data</span>}

      {sisu.messages.map((m) => (
        <p key={m.id}>{m.role === "user" ? "You: " : "Sisu: "}{m.text}</p>
      ))}

      <button onPointerDown={sisu.startTalking} onPointerUp={sisu.stopTalking} onPointerLeave={sisu.stopTalking}>
        {sisu.status}
      </button>
      <button onClick={() => sisu.ask("How much can I safely spend this week?")}>Ask</button>
    </>
  );
}
```

| From the hook | What it is |
|---|---|
| `status` | `"idle"`, `"recording"`, `"thinking"` or `"speaking"`. Drive the button's look from this. |
| `messages` | The conversation. Each assistant message fills in live (see below). |
| `ask(text)` | Send a typed question. |
| `startTalking()` / `stopTalking()` | Press and release of the talk button. Pressing while Sisu speaks interrupts it. |
| `cancel()` / `reset()` | Stop the current answer / clear the conversation (call `reset` when the customer changes). |
| `server` | `{ mock, provider, model }`. **Show a "mock data" label when `mock` is true.** |
| `micError` | A message to show if the microphone is blocked or the recording was too short. |

Options: `speakReplies: false` turns the voice off and gives slightly longer written answers.

## What is inside an assistant message

| Field | Use it for |
|---|---|
| `text`, `pending` | The answer, growing word by word while `pending` is true. |
| `filler` | The "Let me check…" line, shown while research runs. |
| `tools` | The trace drawer: tool name, a one-line `summary`, `tookMs`, `source`, `ok`. |
| `research` | The offer card: `offers`, `best`, `baselineMonthlyEur`, `citations` (with `retrievedAt`), `assumptions`, `mock`. |
| `citations` | Source links for web-search answers. |
| `timings` | Milliseconds for each stage, for the "how Sisu worked this out" drawer. |
| `error` | A sentence to show instead of an answer. |
| `startedEarly` | Set when the server began research before the model asked. |

## Two calls that make it feel fast

```ts
import { prefetchOffers } from "@/lib/agent/client";

// The moment the user confirms what a bill is:
prefetchOffers(customerId, "electricity"); // returns at once; offers load in the background
```

The hook already calls the warm-up endpoint when it mounts, so mount it when the app opens, not when the user first taps the button.

## Feeding the futures chart

When `message.research?.best` exists, pass `best.estimatedYearlySavingEur / 12` to the futures card as the monthly bill saving.

## Rules to keep

- Show `research.assumptions` near any saving. They are part of the honest answer.
- Show `retrievedAt` beside live offers, and the mock label beside mock ones.
- The microphone only works on `localhost` or over HTTPS. On a phone, use the deployed URL, not the laptop's IP address.
- The types are in `lib/types.ts` (`AgentEvent`, `ResearchResult`, `Offer`, `ToolTrace`). If you need a field that is missing, ask Nicholas rather than editing `lib/agent/`.

For the raw event stream without React, use `streamTurn`, `createSpeaker` and `createRecorder` from `lib/agent/client.ts`.
