# Frontend integration contract

For whoever builds the screens. Everything here runs with no API keys: start the app with `MODEL_PROVIDER=mock npm run dev` and every endpoint, event and card below works with example data marked `mock: true`.

**Nothing you already use has changed.** Every existing type in `lib/types.ts` keeps its shape, `useSisu` keeps every field it had, and the event stream still sends the same events. Everything in this document is an addition. A working example of all of it is the test bench at `/dev/agent` (`app/dev/agent/`); copy from it freely.

## The short version

```tsx
"use client";
import { useSisu } from "@/lib/agent/useSisu";

export function Coach({ customerId }: { customerId: string }) {
  const sisu = useSisu({ customerId });

  return (
    <>
      {sisu.server?.mock && <span>Mock data</span>}
      <button onClick={sisu.investigate}>Look into my finances</button>

      {sisu.messages.map((m) => (
        <article key={m.id}>
          <p>{m.text}</p>
          {m.stages.map((s) => <StageCard key={s.id} stage={s} />)}
          {m.teaching && <Quiz card={m.teaching} />}
          {m.action && (
            <ApprovalCard
              action={m.action}
              onApprove={() => sisu.approve(m.action!.id)}
              onDecline={() => sisu.decline(m.action!.id)}
            />
          )}
          {m.grounding && !m.grounding.ok && <Warning numbers={m.grounding.unverified} />}
        </article>
      ))}

      <FuturesCard monthlyBillSaving={sisu.approvedMonthlySaving} />
    </>
  );
}
```

That is the whole integration: one hook, and a card for each thing it hands you.

## 1. The `useSisu` hook

`useSisu({ customerId, focusBill?, speakReplies? })` returns:

| Field | What it is | Since |
|---|---|---|
| `status` | `"idle"`, `"recording"`, `"thinking"` or `"speaking"` | before |
| `messages` | The conversation (see section 2) | before |
| `ask(text)` | Send a typed question | before |
| `startTalking()` / `stopTalking()` | Press and release of the talk button | before |
| `cancel()` / `reset()` | Stop the answer / clear the conversation | before |
| `server` | `{ mock, provider, model }`. Show a "mock data" label when `mock` is true | before |
| `micError`, `voiceError` | Sentences to show when the microphone or voice fails | before |
| `investigate()` | Sisu works through a whole case on its own (section 4) | **new** |
| `approve(actionId)` | The Approve button. Returns the action with `impact` filled in | **new** |
| `decline(actionId)` | The Decline button | **new** |
| `confirmBill(billId, name, billType?)` | The user confirms or corrects a bill's name. Saves it and starts offer research | **new** |
| `actions` | Every action for this customer, newest first | **new** |
| `memory` | `{ consent, items }`: what Sisu remembers about this customer | **new** |
| `approvedMonthlySaving` | Euros a month freed by approved switches. Feed this to the futures chart | **new** |
| `refresh()` | Reload `actions` and `memory` from the server | **new** |

Call `reset()` when the customer changes. `actions` and `memory` reload on their own.

## 2. What is inside an assistant message

| Field | Use it for | Since |
|---|---|---|
| `text`, `pending` | The answer, growing while `pending` is true | before |
| `filler` | The "Let me check…" line shown while research runs | before |
| `tools` | The trace drawer: tool name, one-line `summary`, `tookMs`, `source`, `ok` | before |
| `research` | The offer table: `offers`, `best`, `citations`, `assumptions`, `mock` | before |
| `citations`, `timings`, `error`, `startedEarly` | Sources, timings, error sentence, early-research flag | before |
| `stages` | One card per step of Sisu's work (section 3) | **new** |
| `action` | An action awaiting approval (section 5) | **new** |
| `teaching` | A predict-then-reveal question (section 6) | **new** |
| `remembered` | Things Sisu saved this turn: show "Sisu will remember…" | **new** |
| `grounding` | Whether every number in the answer has a source (section 7) | **new** |
| `facts` | The receipts behind the numbers (section 7) | **new** |

## 3. Stages: one card per step

Every tool the model calls produces one or more `Stage` objects. They arrive while the answer is still being worked out, so the screen can show progress.

```ts
type Stage = {
  id: string;
  kind: "lead" | "evidence" | "research" | "extraction" | "calculation" | "teaching" | "action" | "impact" | "memory";
  title: string;      // "Searched today's electricity offers"
  summary: string;    // "3 pages found for ..."
  source: "bank-data" | "exa" | "context.dev" | "calculation" | "assumption" | "customer-stated" | "nemotron";
  toolCallId: string | null; // matches ToolTrace.id in message.tools
  atMs: number;       // milliseconds since the turn started
  facts: Fact[];      // receipts for the numbers on this card
  data: { kind: ...; ... }; // typed by kind, see below
};
```

| `kind` | `data` holds | Draw it as |
|---|---|---|
| `lead` | `patterns: Pattern[]` (title, detail, `yearlyImpactEur`, `evidence`) | "What Sisu noticed" list |
| `evidence` | `filter`, `count`, `totalEur`, `largest[]` | A figure with a "show transactions" link (pass `filter` to `fetchTransactions`) |
| `research` | `query`, `pages: Citation[]`, `retrievedAt`, `mock` | "Searched with Exa" with source links and the time |
| `extraction` | `offers: Offer[]`, `pagesRead`, `pagesTotal`, `problems[]` | "Read with Context.dev": the offer table |
| `calculation` | `steps: CalcStep[]`, `resultLabel`, `resultValue`, `unit`, `assumptions[]` | The working, line by line |
| `teaching` | `card: TeachingCard` | The quiz (section 6) |
| `action` | `action: AgentAction` | The approval card (section 5) |
| `impact` | `impact: ActionImpact` (`branches`, `gainVsNothingEur`, `summary`) | The futures chart moving |
| `memory` | `item: MemoryItem` | "Sisu will remember…" |

Narrow on `stage.data.kind` and TypeScript gives you the right fields.

## 4. The investigation

`sisu.investigate()` (or `POST /api/agent/investigate` with `{ customerId, mode?, text? }`) makes Sisu work through a whole case without being asked each step. The reply's `stages` fill in this order:

1. `lead`: what stands out in the customer's own history
2. `research`: Exa search for today's offers
3. `extraction`: Context.dev reads the offer pages
4. `calculation`: the saving, worked out in code
5. `impact`: what the saving adds up to over five years
6. `teaching`: one question for the customer
7. `action`: a switch prepared and waiting for approval

Measured on the real model: 4.2 to 4.6 seconds for all seven, when offers are already warm. A `filler` event arrives at once ("Give me a moment, Aino. I'm going through your last twelve months."), so there is never silence. `text` is an optional focus, for example `"my mobile bill"`.

## 5. Actions: prepare, approve, decline

Nothing is ever carried out without the user pressing Approve. Even then it is a simulation, and the card must say so.

```ts
type AgentAction = {
  id: string;
  kind: "switch_contract" | "standing_transfer";
  status: "awaiting_approval" | "executed_simulated" | "declined" | "expired";
  simulated: true;              // always. Label the card "Simulated, no real switch".
  title: string;                // "Switch electricity contract to Vaasan Sähkö Myynti Oy (Kiinteä Vaikuttaja 24 kk)"
  summary: string;              // "Estimated saving about €48 a year (€3.98 a month) against ..."
  checklist: string[];          // the steps a real switch would take
  draftMessage: string | null;  // text Sisu drafted for the provider. Never sent.
  offer: Offer | null;
  monthlyAmountEur: number;     // 3.98
  facts: Fact[];                // receipts for every figure on the card
  sources: Citation[];
  assumptions: string[];        // show these near the saving
  expiresAt: string;            // 30 minutes after it was prepared
  impact: ActionImpact | null;  // filled in when approved
};
```

The flow:

```ts
// 1. An action arrives on a message (the agent prepared it), or you prepare one from a button:
const res = await fetch("/api/actions/prepare", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerId, kind: "switch_contract", billType: "electricity", provider: "Oomi" }), // provider optional: default is the best offer
});
const { action } = await res.json(); // 201

// 2. The user presses Approve:
const approved = await sisu.approve(action.id);
approved.status;                 // "executed_simulated"
approved.impact.gainVsNothingEur; // 238.8
approved.impact.summary;          // "About €239 more after 5 years if the saving is simply kept."
approved.impact.branches;         // [{ id: "nothing", endTotal }, { id: "save", ... }, { id: "invest", endLow, endHigh }]

// 3. The futures chart: sisu.approvedMonthlySaving is now 3.98. Pass it as the monthly bill saving.
```

| Endpoint | Body | Returns | Errors |
|---|---|---|---|
| `POST /api/actions/prepare` | `{ customerId, kind, billType?, provider?, monthlyAmountEur? }` | `201 { action }` | `409` if offers have not been looked up yet, or no offer is cheaper |
| `POST /api/actions/:id/approve` | `{ customerId, confirm: true }` | `{ action }` with `impact` | `400` without `confirm: true`; `404` not this customer's; `409` already decided; `410` expired |
| `POST /api/actions/:id/decline` | `{ customerId }` | `{ action }` | same as approve |
| `GET /api/actions?customerId=` | | `{ actions, audit, auditChainValid }` | |
| `GET /api/audit?customerId=` | | `{ events, chainValid }` | |

Every error body is `{ error: "a sentence you can show" }`.

The audit trail is what makes "approved by the user" provable. One approved switch produces three entries: `action_prepared` (actor `sisu-agent` or `user`), `action_approved` (actor `user`), `action_executed_simulated` (actor `system`). Show them in a small "history" drawer if there is room.

## 6. Teaching: predict, then reveal

```ts
type TeachingCard = {
  id: string; concept: ConceptId; title: string;
  explanation: string;  // the idea, in plain words
  question: string;     // "What share of your spending do you think goes on everyday choices?"
  options: string[];    // three choices
  correctIndex: number;
  reveal: string;       // "It is about 40%: €723 a month on everyday choices, against ..."
  facts: Fact[];
};
```

Show `question` and `options`. Only after the user taps one, highlight `correctIndex` and show `reveal`. The model is deliberately not told the answer, so it cannot give it away in its spoken reply.

Cards without the agent: `GET /api/coach/teaching?customerId=&concept=`. Concepts: `three-baskets`, `safe-to-spend`, `fixed-vs-spot`, `buffer-first`, `compound-growth`, `switching-bills`, `pay-yourself-first`. Leave `concept` out to get all seven.

## 7. Receipts: every number has a source

Just before `done`, each turn sends its receipts. On the message they are `facts` and `grounding`.

```ts
type Fact = {
  id: string; label: string; value: number;
  unit: "EUR" | "EUR/month" | "EUR/year" | "kWh/year" | "c/kWh" | "months" | "count" | "percent" | "years" | "days";
  source: "bank-data" | "exa" | "context.dev" | "assumption" | "customer-stated" | "calculation";
  basis: string;             // "sum of 10 transactions"
  evidence?: EvidenceFilter; // pass to fetchTransactions(customerId, evidence) to show the rows
  url?: string;              // for web facts
};

type Grounding = {
  ok: boolean;          // false if any number in the answer has no source
  checked: number;
  unverified: number[]; // show a warning chip if this is not empty
  numbers: { value: number; status: "receipt" | "context" | "trivial" | "unverified"; factId: string | null }[];
  corrections: { said: number; corrected: number; factId: string }[];
};
```

Ideas for the screen: colour each figure by `source`; make a figure tappable when its fact has `evidence`; show "All 6 numbers have a source" under an answer; show a warning when `grounding.ok` is false. In the last live run, 152 of 152 numbers had a source.

## 8. Memory

```ts
sisu.memory; // { customerId, consent: true, items: [{ id, kind: "bill_name", key: "utilities-1", value: "Helen electricity", billType: "electricity", source: "user-confirmed-in-app", savedAt }] }
await sisu.confirmBill("utilities-1", "Helen electricity", "electricity"); // from the bill card's confirm button
```

| Endpoint | Body | Does |
|---|---|---|
| `GET /api/memory?customerId=` | | Returns `CustomerMemory` |
| `POST /api/memory` | `{ customerId, kind, key?, value, billType? }` | Saves one item. `kind`: `bill_name`, `yearly_kwh`, `preference`, `goal` |
| `POST /api/memory` | `{ customerId, consent: false }` | Switches remembering off and erases what was stored |
| `DELETE /api/memory?customerId=&itemId=` | | Forgets one item; without `itemId`, everything |

Helpers in `lib/agent/client.ts`: `fetchMemory`, `confirmBill`, `rememberKwh`, `setMemoryConsent`, `forgetMemory`.

When the user tells Sisu something in conversation ("my electricity use is 3,500 kWh a year"), the agent saves it and the message's `remembered` array holds the item. The next session uses it without being told.

## 9. Bill photo

```ts
import { readBillPhoto, rememberKwh } from "@/lib/agent/client";

const result = await readBillPhoto(customerId, file); // file from <input type="file" accept="image/*" capture="environment">
result.toConfirm;          // "Sisu read: Example Energia Oy, 2650 kWh a year, 11.9 c/kWh. Is that right? Nothing is saved until you confirm."
result.reading.yearlyKwh;  // 2650, or null if it is not printed on the bill
result.comparison?.best;   // today's best offer, compared using the real kWh
// When the user confirms:
await rememberKwh(customerId, result.reading.yearlyKwh);
```

`POST /api/agent/bill-photo` takes a multipart form with `image` (PNG, JPEG or WebP, up to 4 MB) and `customerId`. Resize large phone photos to about 1,500 pixels wide before sending. It takes about 1.5 seconds. Fields the model could not see come back `null`; `reading.problems` lists anything dropped as implausible.

## 10. Endpoints that need no model (instant)

| Endpoint | Returns |
|---|---|
| `GET /api/coach/patterns?customerId=` | `{ patterns: Pattern[] }`, ranked by yearly euros |
| `GET /api/coach/cash-flow?customerId=` | `CashFlow`: payday, bills due before it, expected balance just before it, `steps` |
| `GET /api/coach/affordability?customerId=&amountEur=` | `Affordability`: `verdict` (`comfortable`, `tight`, `not-yet`), `steps`, `monthsToSaveUp` |
| `GET /api/coach/teaching?customerId=&concept=` | `{ cards: TeachingCard[] }` |
| `GET /api/health` | `HealthReport`: the model actually being served, where, the backup, the data boundary |
| `POST /api/demo/reset` | Clears actions, memory and the audit log for the three demo customers |

These are plain code, so they answer in a few milliseconds and always give the same result. Use them for cards that should be on screen before the user asks anything.

## 11. The event stream, if you do not use the hook

`POST /api/agent/query`, `POST /api/agent/investigate` and `POST /api/voice/turn` all return server-sent events. Each message is `data: <one JSON object>`.

Order in one turn: `start`, (`transcript`), (`speculation`), (`filler`), then any mix of `tool_start`, `tool_end`, `research`, `stage`, `teaching`, `action`, `memory`, `delta`, `sentence`, then `grounding`, then `done`. Or `error` at any point.

| Event | Since | Holds |
|---|---|---|
| `start` | before | `turnId`, `provider`, `model`, `mock` |
| `transcript` | before | what was heard, `tookMs` |
| `speculation` | before | research started early for `billType` |
| `filler` | before | a sentence to say while research runs |
| `tool_start`, `tool_end` | before | the tool call and its `ToolTrace` |
| `research` | before | `ResearchResult` |
| `delta`, `sentence` | before | text as it arrives; whole sentences for speech |
| `stage` | **new** | one `Stage` |
| `teaching` | **new** | one `TeachingCard` |
| `action` | **new** | one `AgentAction` awaiting approval |
| `memory` | **new** | one `MemoryItem` just saved |
| `grounding` | **new** | `Grounding` and `facts` |
| `done` | before | final `text`, `citations`, `timings` |
| `error` | before | `message` to show |

Type the stream as `SisuEvent` (`AgentEvent` plus the new events). A client that only knows the old events can ignore the new ones safely. Use `done.text` as the final answer: it is the checked version (section 7).

`streamTurn` in `lib/agent/client.ts` reads the stream for you and yields typed events. Pass `investigate: true` to run an investigation.

## 12. Loading, error and empty states

| Situation | What you get | What to show |
|---|---|---|
| Waiting for the first word | `status === "thinking"`, `message.pending`, no `text` | A thinking indicator. Typical wait: 0.4 s, or 1.4 s when a tool runs |
| Research running | `message.filler` set, a `speculation` event | The filler line and "searching…" |
| Research partly failed | `research.errors` not empty, `research.status` still `"done"` | The offers, with a note on what could not be read |
| No offer is cheaper | `research.best === null` | "Nothing cheaper today" (the agent says so too) |
| Model fell back to the backup | `timings.modelSteps[].usedBackup` | A small "backup model" tag |
| Voice quota used up | `voiceError` | The sentence; answers continue as text |
| Too many requests | HTTP `429` with `{ error }` | The sentence |
| Bad input | HTTP `400` with `{ error }` | The sentence |
| Action expired | HTTP `410` | "Prices may have changed. Ask Sisu to prepare it again." |

## 13. Rules to keep on screen

- Label anything with `mock: true` as mock data.
- Label every action "Simulated, no real switch".
- Show `research.assumptions` and `action.assumptions` near any saving. They are part of the honest answer.
- Show `retrievedAt` beside live offers.
- A bill's name is Sisu's guess until `memory.items` holds a `bill_name` for it. Say "looks like electricity" until then.

## 14. Where the types are

All in `lib/types.ts`. The additions are at the bottom, under "Receipts, investigation stages, teaching, actions and memory". If you need a field that is missing, ask Nicholas rather than editing `lib/agent/`.
