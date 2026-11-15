// Two decisions at the same moment on a hosted site. Each request may reach a different server instance; both load
// the visitor's state, and the one that stores second has its change replayed on top of the first (lib/store/state.ts).
// The decision must be made again there, so a second approval of the same action, or a transfer the first one
// already spent, is refused instead of overdrawing the demo bank or being logged twice.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { EETU, freshState, stubFetch } from "./helpers";
import { POST as approveRoute } from "@/app/api/actions/[id]/approve/route";
import { POST as approveAllRoute } from "@/app/api/actions/approve-all/route";
import { accountsFor, listActions, approveActionStored, declineActionStored, saveDraft } from "@/lib/actions";
import { buildTransferDraft, impactOf } from "@/lib/actions/drafts";
import { verifyChain } from "@/lib/store/audit";
import { inSession, newSessionId } from "@/lib/store/session";
import { type SisuState, forgetStoredState, openSession, settleSession, updateState } from "@/lib/store/state";
import { buildOverview } from "@/lib/finance/overview";
import { runPlan } from "@/lib/agent/plan";
import type { AgentAction } from "@/lib/types";

const STORE_ENV = ["SISU_STORE", "SISU_STORE_TOKEN", "SISU_SESSIONS", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const saved = { ...process.env };
function restoreEnv(): void {
  for (const key of STORE_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

type Row = { state: SisuState; version: number };

// The two database functions (deploy/supabase/sisu_sessions.sql) with the same rules, plus `loadOnce`: the next load
// returns an older row, as when this instance read the state just before another instance stored its change.
function fakeSupabase() {
  const rows = new Map<string, Row>();
  let stale: Row | null = null;
  const restore = stubFetch(async (url, init) => {
    const name = url.split("/rpc/")[1] ?? "";
    const body = JSON.parse(String(init?.body)) as { p_session: string; p_state?: SisuState; p_expected?: number };
    const row = rows.get(body.p_session);
    if (name === "sisu_load") {
      const served = stale ?? row;
      stale = null;
      return Response.json(served ? structuredClone(served) : null);
    }
    if (row ? row.version !== body.p_expected : false) return Response.json({ ok: false, ...structuredClone(row) });
    const version = (row?.version ?? 0) + 1;
    rows.set(body.p_session, { state: structuredClone(body.p_state!), version });
    return Response.json({ ok: true, version });
  });
  return { rows, restore, loadOnce: (row: Row) => (stale = structuredClone(row)) };
}

const balance = buildOverview(EETU)!.balance;
// Two transfers that fit one at a time but not together.
const FIRST = Math.round(balance * 0.6);
const SECOND = Math.round(balance * 0.5);
let caller = 0;
const post = (path: string, session: string, body: unknown) =>
  new Request(`https://sisu.test${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${++caller % 250}`, "x-sisu-session": session }, body: JSON.stringify(body) });

function transfer(amountEur: number): AgentAction {
  const draft = buildTransferDraft(EETU, amountEur, { preparedBy: "user", once: true });
  assert.ok(draft.ok, draft.ok ? "" : draft.reason);
  const result = saveDraft(EETU, draft.draft);
  assert.ok(result.ok);
  return result.action;
}

describe("hosted: two decisions at the same moment", () => {
  let supabase = fakeSupabase();
  let session = "";
  let waiting: Row; // the stored row with both transfers waiting
  let first: AgentAction;
  let second: AgentAction;

  beforeEach(async () => {
    restoreEnv();
    forgetStoredState();
    freshState();
    Object.assign(process.env, { SUPABASE_URL: "https://project.supabase.test/", SUPABASE_PUBLISHABLE_KEY: "test-key" });
    supabase = fakeSupabase();
    session = newSessionId();
    await openSession(session);
    [first, second] = inSession(session, () => [transfer(FIRST), transfer(SECOND)]);
    await settleSession(session);
    waiting = structuredClone(supabase.rows.get(session)!);
  });
  afterEach(() => {
    supabase.restore();
    restoreEnv();
    forgetStoredState();
  });

  // Instance one stores `stored` first; instance two had loaded the state before that, so it still sees both waiting.
  async function secondInstanceSeesOldState(): Promise<void> {
    const newer = structuredClone(supabase.rows.get(session)!);
    forgetStoredState();
    supabase.rows.set(session, waiting);
    await openSession(session);
    supabase.rows.set(session, newer);
  }
  const stored = () => supabase.rows.get(session)!.state;
  const count = (type: string, actionId: string) => stored().audit.filter((event) => event.type === type && event.actionId === actionId).length;

  it("competing switches on separate instances execute only one offer for the same bill", async () => {
    await inSession(session, async () => {
      updateState((state) => ({ ...state, actions: [], audit: [] }));
      for await (const event of runPlan(EETU, { fresh: false })) void event;
      first = listActions(EETU).find((action) => action.kind === "switch_contract")!;
      assert.ok(first?.offer);
      const alternate = saveDraft(EETU, { ...first, offer: { ...first.offer!, provider: "Competing provider" } });
      assert.ok(alternate.ok);
      second = alternate.action;
      await settleSession();
    });
    waiting = structuredClone(supabase.rows.get(session)!);
    assert.ok((await inSession(session, () => approveActionStored(EETU, first.id, impactOf))).ok);
    await secondInstanceSeesOldState();
    const late = await inSession(session, () => approveActionStored(EETU, second.id, impactOf));
    assert.ok(!late.ok && late.status === 409, JSON.stringify(late));
    assert.equal(stored().actions.find((action) => action.id === second.id)?.status, "awaiting_approval");
    assert.equal(count("action_executed_simulated", first.id), 1);
    assert.equal(count("action_approved", second.id), 0);
    assert.ok(verifyChain(stored().audit));
  });

  it("a transfer the first approval already spent is refused, and the account is not overdrawn", async () => {
    const one = await inSession(session, () => approveActionStored(EETU, first.id, impactOf));
    assert.ok(one.ok);
    await secondInstanceSeesOldState();
    const two = await inSession(session, () => approveActionStored(EETU, second.id, impactOf));
    assert.equal(two.ok, false);
    assert.ok(!two.ok && two.status === 409 && /cannot be moved/.test(two.reason), JSON.stringify(two));
    assert.equal(stored().actions.find((a) => a.id === second.id)?.status, "awaiting_approval", "still waiting, nothing moved");
    assert.equal(count("action_approved", second.id), 0);
    const accounts = inSession(session, () => accountsFor(EETU)!);
    assert.equal(accounts.current.nowEur, Math.round((balance - FIRST) * 100) / 100);
    assert.ok(accounts.current.nowEur >= 0);
    assert.ok(verifyChain(stored().audit));
  });

  it("the same action approved twice at once is approved, carried out and logged once", async () => {
    assert.ok((await inSession(session, () => approveActionStored(EETU, first.id, impactOf))).ok);
    await secondInstanceSeesOldState();
    const again = await inSession(session, () => approveActionStored(EETU, first.id, impactOf));
    assert.deepEqual(again, { ok: false, status: 409, reason: "This action was already approved." });
    assert.equal(count("action_approved", first.id), 1);
    assert.equal(count("action_executed_simulated", first.id), 1);
    assert.equal(inSession(session, () => accountsFor(EETU)!.movements.length), 1);
  });

  it("a decline and an approval of the same action at once: the one stored second is refused", async () => {
    assert.ok((await inSession(session, () => declineActionStored(EETU, first.id))).ok);
    await secondInstanceSeesOldState();
    const late = await inSession(session, () => approveActionStored(EETU, first.id, impactOf));
    assert.deepEqual(late, { ok: false, status: 409, reason: "This action was already declined." });
    assert.equal(stored().actions.find((a) => a.id === first.id)?.status, "declined");
    assert.equal(inSession(session, () => accountsFor(EETU)!.current.movedOutEur), 0, "no money moved");
  });

  it("the approve route answers with the stored decision: 409 when another instance spent the money first", async () => {
    assert.equal((await approveRoute(post(`/api/actions/${first.id}/approve`, session, { customerId: EETU, confirm: true }), { params: Promise.resolve({ id: first.id }) })).status, 200);
    forgetStoredState();
    supabase.loadOnce(waiting); // this request's instance reads the state from before that approval was stored
    const response = await approveRoute(post(`/api/actions/${second.id}/approve`, session, { customerId: EETU, confirm: true }), { params: Promise.resolve({ id: second.id }) });
    assert.equal(response.status, 409);
    assert.match(((await response.json()) as { error: string }).error, /cannot be moved/);
    assert.equal(stored().actions.find((a) => a.id === second.id)?.status, "awaiting_approval");
  });

  it("approve all on an out-of-date state checks each action against what was really stored", async () => {
    assert.equal((await approveRoute(post(`/api/actions/${first.id}/approve`, session, { customerId: EETU, confirm: true }), { params: Promise.resolve({ id: first.id }) })).status, 200);
    forgetStoredState();
    supabase.loadOnce(waiting);
    const response = await approveAllRoute(post("/api/actions/approve-all", session, { customerId: EETU, actionIds: [first.id, second.id], confirm: true }));
    const body = (await response.json()) as { approved: AgentAction[]; failed: { actionId: string; reason: string }[] };
    assert.equal(response.status, 409, "nothing new could be approved");
    assert.deepEqual(body.approved, []);
    assert.deepEqual(body.failed.map((f) => f.actionId), [first.id, second.id]);
    assert.equal(body.failed[0].reason, "This action was already approved.");
    assert.match(body.failed[1].reason, /cannot be moved/);
    assert.equal(count("action_approved", first.id), 1);
    assert.equal(count("action_approved", second.id), 0);
  });
});
