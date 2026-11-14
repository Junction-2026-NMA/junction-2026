# Frontend handoff: Liito does what Sisu is doing, and Sisu draws charts

**For the frontend agent and whoever owns `app/page.tsx` and `components/`.** Read this before touching the mascot or the chat screen. Everything here is on `overnight/fable-lead` (pull request 2) and works in mock mode with no keys.

## The task

1. **Make Liito act out what Sisu is really doing.** One value tells you: `activity`. Never drive Liito from a timer or a guess.
2. **Draw the charts Sisu sends.** One component draws any of them: `VisualCard`.
3. **Put the money plan on the main screen** (optional but it is the demo's best moment): `/plan` is a working example.

See all three working first:

| Page | What it shows |
|---|---|
| `http://localhost:3000/plan` | Sisu working live, then one Approve all. The top line prints `Liito: <pose> · <label>` as it changes |
| `http://localhost:3000/visuals` | Every chart, animated, for each demo customer |
| `http://localhost:3000/dev/agent` | Chat. Type "show me a pie chart of my budget". The green pill prints Liito's pose live |

## 1. Liito: one value, eight poses

Both hooks return `activity`:

```tsx
import { useSisu } from "@/lib/agent/useSisu";   // chat and voice
import { usePlan } from "@/lib/agent/usePlan";   // the money plan

const sisu = useSisu({ customerId });
sisu.activity; // { state, liito, label, detail }

const { view } = usePlan();
view.activity; // the same shape
```

```ts
type SisuActivity = {
  state: "idle" | "listening" | "thinking" | "reading_account" | "searching_web" | "reading_pages"
       | "calculating" | "found_something" | "setting_up" | "waiting_for_approval" | "speaking"
       | "approved" | "declined" | "error";
  liito: "sleepy" | "curious" | "focused" | "gliding" | "found-something" | "cheering" | "proud" | "cosy";
  label: string;        // plain words for a caption: "Searching the web with Exa"
  detail: string | null; // e.g. the search query, the page being read, an action's warning
};
```

`liito` is already the pose from the brand kit (`brand/08-liito-character-spec.md` on the `brand-kit` branch). Map it to your animation clip and show `label` beside it.

| `state` | When it is true (a real event, never a timer) | `liito` pose | What Liito should be seen doing |
|---|---|---|---|
| `idle` | nothing is happening | `sleepy` | resting |
| `listening` | the talk button is held | `curious` | head tilted, listening |
| `thinking` | the model is working, no tool yet | `curious` | with the three bouncing dots |
| `reading_account` | a bank-data tool is running, or the plan is scanning transactions | `focused` | leaning in over the rows |
| `searching_web` | an Exa search is running | `gliding` | gliding off to fetch it |
| `reading_pages` | Context.dev is reading a page (`detail` is the site) | `focused` | reading |
| `calculating` | a sum or a scenario is being worked out in code | `focused` | counting |
| `found_something` | a pattern or a cheaper offer was found (`label` says what) | `found-something` | holding up the finding |
| `setting_up` | an action is being prepared | `focused` | putting it in place |
| `waiting_for_approval` | an action waits for the customer (`detail` is its warning, if any) | `found-something` | presenting, looking at the customer |
| `speaking` | the answer is being said | `curious` | talking |
| `approved` | the customer just approved | `cheering` | arms up. Use `proud` instead when a whole plan was approved |
| `declined` | the customer said no | `cosy` | relaxed. Never disappointed |
| `error` | something failed (`label` is the message) | `cosy` | calm |

Rules: one Liito per screen. Change pose only when `activity.state` changes. Cross-fade or glide between poses in about 250 ms so quick steps still read. In the money plan the steps come every 250 to 400 ms, which is the point: Liito is visibly busy.

If you read the event stream yourself instead of using the hooks, the same logic is two pure functions in `lib/agent/activity.ts`: `nextActivity(current, event)` for a chat turn and `nextPlanActivity(current, event)` for the plan.

## 2. Charts: `VisualCard`

```tsx
import { VisualCard } from "@/app/visuals/VisualCard";

{message.visuals.map((visual) => <VisualCard key={visual.id} visual={visual} />)}
```

`message.visuals` is filled by `useSisu` from the stream's new `visual` event. The agent sends one when the customer asks for a picture, and with advice, a scenario and an offer search.

| `visual.kind` | The picture | Sent when |
|---|---|---|
| `budget_donut` | a ring of where the money goes, by category; touch a part to see it | "show me a pie chart of my budget", and with advice |
| `peer_bars` | each category beside people the same age | "compare me with people my age" |
| `month_bars` | spending per month with a mark at that month's income; over-spent months are red | "show me my months" |
| `waterfall` | how safe-to-spend is built up | "show how you worked that out" |
| `futures_lines` | three futures over the years, with the invested range as a band | any what-if |
| `offer_bars` | the customer's bill beside today's offers | any offer search |

Every visual has `title`, `caption`, `summary` (a code-written sentence: use it as alt text) and `facts` (a receipt for each number). `GET /api/agent/visuals?customerId=…` returns all of them at once with no model call, for a screen that wants a chart without asking the agent.

The charts are plain SVG in `app/visuals/` with their motion in `app/visuals/visuals.css`. Restyle freely: the colours are CSS variables on `.viz` (`--viz-1` to `--viz-6`, `--viz-main`, `--viz-quiet`). Keep the six category colours in their order (they are checked to be colour-blind safe in that order), keep the legend, and keep text in ink colours, not chart colours.

## 3. The money plan on the main screen

`app/plan/` is three pieces you can lift: `Stage` (the dark panel where the work plays), `PlanCard` (what was found, Approve all) and `usePlan`. Section 9b of `docs/FRONTEND_INTEGRATION_CONTRACT.md` lists every event. Put Liito on or beside the stage and drive it from `view.activity`: it will scan, glide to the web, read, count and present in step with the real work.

## Do not

- Do not fake a step, a number or a delay. Every state above comes from a real event.
- Do not show the plan's total without its split into "needs nothing from you" and "needs spending to come down".
- Do not hide `action.warning` on an action card.
- Do not let the model's text be the source of a chart's numbers. Use the `Visual` it sent.
