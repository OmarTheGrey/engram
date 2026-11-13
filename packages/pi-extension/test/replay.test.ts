// Card PX2's acceptance: replaying fixtures/sessions/*.jsonl through the
// plane yields their .expected.json decisions with zero model calls. Each
// recorded session's `engram.call` entries are replayed by core under the
// session's own policy, on a scratch log and store, with no pi runtime and no
// model; every event the replay appends must carry the decision the session
// recorded, and the session's events must rebuild the Engram log they mirror.
import { readdirSync, readFileSync } from "node:fs";
import {
  currentItems,
  loadPreset,
  MemoryEvent,
  migrate,
  openSqlite,
  type Policy,
  rebuild,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  type CallEntry,
  decisionOf,
  logFromSession,
  parseSession,
  policyHash,
  replaySession,
  type SessionLine,
  sessionCalls,
  sessionEvents,
  sessionPolicy,
  sessionWorkload,
} from "../src/index.ts";

const DIR = new URL("../../../fixtures/sessions/", import.meta.url);
const SESSIONS = readdirSync(DIR)
  .filter((f) => f.endsWith(".jsonl"))
  .sort();

const read = (name: string) => readFileSync(new URL(name, DIR), "utf8");
const expectedOf = (session: string) =>
  JSON.parse(read(session.replace(/\.jsonl$/, ".expected.json"))) as { events: MemoryEvent[] };

test("there are recorded sessions to replay", () => {
  expect(SESSIONS.length).toBeGreaterThanOrEqual(2);
});

describe.each(SESSIONS)("acceptance (card PX2): %s", (session) => {
  const entries = parseSession(read(session));

  test("every call the extension made is recorded, ahead of its events", () => {
    const calls = sessionCalls(entries);
    expect(calls.length).toBeGreaterThan(0);
    // The policy, then a call, before any event: a call entry comes before
    // the events of its call.
    const first = entries.filter(
      (e) => e.type === "custom" && e.customType?.startsWith("engram.") === true,
    );
    expect(first.slice(0, 2).map((e) => e.customType)).toEqual(["engram.policy", "engram.call"]);
  });

  test("replays through the plane to its .expected.json decisions, with zero model calls", async () => {
    const policy = sessionPolicy(entries);
    const replay = await replaySession(entries);
    expect(replay.differences).toEqual([]);
    expect(replay.events.map(decisionOf)).toEqual(expectedOf(session).events.map(decisionOf));
    // Nothing in the replay reaches a model: no ModelCall is passed to it,
    // and its report says so.
    expect(replay.run.policy_id).toBe(policy.id);
    expect(replay.workload.steps.length).toBe(sessionCalls(entries).length);
  });

  test("its events are the expected file's, and every one parses under the schema", () => {
    const events = sessionEvents(entries);
    expect(events).toEqual(expectedOf(session).events);
    for (const e of events) expect(MemoryEvent.safeParse(e).success, e.id).toBe(true);
  });

  test("its events rebuild the Engram log they mirror: same events, same item state", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const rebuilt = logFromSession(db, entries);
    expect(rebuilt).toEqual(sessionEvents(entries));
    // The projection the appends left is the one the log alone rebuilds.
    const projected = currentItems(db);
    expect(projected.length).toBeGreaterThan(0);
    rebuild(db);
    expect(currentItems(db)).toEqual(projected);
    db.close();
  });
});

test("under another policy the replay names the events that change: e2-4 without its one-slot budget", async () => {
  // e2-4 ran under medium with a semantic budget of one in person scope; the
  // bundled medium allows 2000, so its eviction, and the retired-content
  // denial that followed it, are not made again.
  const entries = parseSession(read("e2-4-eviction.jsonl"));
  expect(
    sessionPolicy(entries).retention.find((r) => r.class === "semantic" && r.scope === "person")
      ?.budget,
  ).toBe(1);
  const { differences } = await replaySession(entries, loadPreset("medium"));
  expect(differences.length).toBeGreaterThan(0);
  expect(differences[0]).toMatch(/^event \d+ \(evict\): recorded/);
});

test("a session whose calls name one actor two ways is refused", () => {
  const entries = parseSession(read(SESSIONS[0] as string));
  const [call] = entries.filter((e) => e.type === "custom" && e.customType === "engram.call");
  const twisted: SessionLine[] = [
    ...entries,
    {
      type: "custom",
      customType: "engram.call",
      data: {
        ...(call?.data as CallEntry),
        actor: { id: "person:eve", level: "person", memberships: [] },
      },
    },
  ];
  expect(() => sessionWorkload(twisted)).toThrow(/bound to two different actors/);
});

describe("the recorded policy (review of PR #32)", () => {
  const customs = (entries: SessionLine[], type: string) =>
    entries.filter((e) => e.type === "custom" && e.customType === type);
  const policyEntry = (entries: SessionLine[]) =>
    customs(entries, "engram.policy")[0] as SessionLine;
  const withPolicyData = (entries: SessionLine[], data: unknown): SessionLine[] =>
    entries.map((e) => (e === policyEntry(entries) ? { ...e, data } : e));

  test("every call names the recorded policy's content hash", () => {
    for (const session of SESSIONS) {
      const entries = parseSession(read(session));
      const hash = policyHash(policyEntry(entries).data);
      for (const c of sessionCalls(entries)) expect(c.policy.hash).toBe(hash);
    }
  });

  test("a resumed session, holding the same policy twice, still replays", async () => {
    // pi recreates the extension's runtime on resume and fork, so the new
    // runtime records the policy again ahead of its first call.
    const entries = parseSession(read("s0-interception.jsonl"));
    const calls = customs(entries, "engram.call");
    const at = entries.indexOf(calls[calls.length - 1] as SessionLine);
    const resumed = [...entries.slice(0, at), policyEntry(entries), ...entries.slice(at)];
    expect((await replaySession(resumed)).differences).toEqual([]);
  });

  test("an engram.policy entry whose rules changed under the same id and version is refused", () => {
    // s0's decisions do not depend on the retention ttls, so a replay alone
    // would not notice this edit.
    const entries = parseSession(read("s0-interception.jsonl"));
    const data = structuredClone(policyEntry(entries).data) as Policy;
    data.retention = data.retention.map((r) => ({ ...r, ttl: r.ttl === null ? null : r.ttl + 1 }));
    expect(() => sessionPolicy(withPolicyData(entries, data))).toThrow(
      /engram\.call 0 was decided under preset\.medium v1 sha256:[0-9a-f]+, which no engram\.policy entry of the session holds/,
    );
  });

  test("a session whose calls were decided under two policies is refused", () => {
    const entries = parseSession(read("s0-interception.jsonl"));
    const other = loadPreset("strict");
    const call = customs(entries, "engram.call")[0]?.data as CallEntry;
    const twisted: SessionLine[] = [
      ...entries,
      { type: "custom", customType: "engram.policy", data: other },
      {
        type: "custom",
        customType: "engram.call",
        data: {
          ...call,
          policy: { id: other.id, version: other.version, hash: policyHash(other) },
        },
      },
    ];
    expect(() => sessionPolicy(twisted)).toThrow(/decided under 2 policies/);
  });

  test("a replay under the session's id and version with other rules says so", async () => {
    const entries = parseSession(read("e2-4-eviction.jsonl"));
    expect((await replaySession(entries)).policyDifference).toBeNull();
    const { policyDifference } = await replaySession(entries, loadPreset("medium"));
    expect(policyDifference).toMatch(/preset\.medium v1 with other rules than the session's/);
  });

  test("a replay is deterministic: the same session replays to the same events", async () => {
    for (const session of SESSIONS) {
      const entries = parseSession(read(session));
      const a = await replaySession(entries);
      const b = await replaySession(entries);
      expect(b.events).toEqual(a.events);
    }
  });
});
