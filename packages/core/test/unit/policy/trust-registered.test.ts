// The registered presets decide byte for byte as before card E2.11 (ADR 0040,
// decision 6): with the trust options absent, or present and `off`, every
// decision, reason and rule id, and every item the log leaves, is the same
// as on main before the card. One fixed workload reaches every path the card
// touches: sourceless writes claiming `user` (the write gate, promotion's
// confirmations and the retired-content rule), rewrites and retires of a
// more trusted item by a less trusted co-member and by the owner's agent,
// budget evictions by less trusted writers (each preset as registered, and
// with every budget tightened to one so evictions happen), adoption of a
// hand-edited record, sweeps by an agent and by a person, a check and reads.
//
// The digests were computed by this file against origin/main at commit
// 0e15f8b8, before any change of the card, and are fixed here: a change to
// any registered decision moves one.
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { allEvents, currentItems } from "../../../src/events.ts";
import { type Actor, adoptStoreItems } from "../../../src/plane.ts";
import { loadPreset, PRESETS, type PresetName } from "../../../src/policy/load.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { addSeconds } from "../../../src/time.ts";
import { AT, fresh, id, item } from "../plane/helpers.ts";

type Kind = MemoryItem["provenance"]["kind"];
const TEAM = "team:platform";
const ALICE = "person:alice";

const alice = (source?: Kind): Actor => ({
  id: ALICE,
  level: "person",
  memberships: [ALICE, TEAM],
  ...(source ? { source } : {}),
});
/** A co-member of alice's person scope and the team who owns none of her items. */
const helper = (source?: Kind, who = "agent:helper"): Actor => ({
  id: who,
  level: "person",
  memberships: [ALICE, TEAM],
  ...(source ? { source } : {}),
});

const t = (s: number) => addSeconds(AT, s) as string;

/** Every budget of `policy` tightened to one, evicting by recency. */
const tightened = (policy: Policy): Policy => ({
  ...policy,
  retention: policy.retention.map((r) => ({ ...r, budget: 1, eviction: "recency" as const })),
});

/** Runs the workload under `policy`; returns the log, the items and every result, canonically. */
async function workload(policy: Policy): Promise<string> {
  const { plane, db, deps, adapter } = fresh(policy);
  const out: unknown[] = [];
  const note = async (label: string, run: () => Promise<unknown>) => {
    try {
      out.push([label, await run()]);
    } catch (e) {
      out.push([label, "threw", e instanceof Error ? e.message : String(e)]);
    }
  };
  const write = (label: string, actor: Actor, it: MemoryItem, at: string) =>
    note(label, async () => {
      const r = await plane.write(actor, it, at);
      return [r.event.decision, r.event.policy_id, r.retention.length];
    });
  const rewrite = (n: number, change: Partial<MemoryItem>) => {
    const now = currentItems(db).find((i) => i.id === id(n));
    return { ...(now ?? item(n)), version: (now?.version ?? 1) + 1, store_ref: null, ...change };
  };

  // The owner's items: team semantic, person semantic, person episodic.
  await write(
    "w1",
    alice("user"),
    item(1, { scope: TEAM, owner: ALICE, content: "a team fact" }),
    t(0),
  );
  await write(
    "w2",
    alice("user"),
    item(2, { scope: ALICE, owner: ALICE, content: "a person fact" }),
    t(1),
  );
  await write(
    "w3",
    alice("user"),
    item(3, { scope: ALICE, owner: ALICE, class: "episodic", content: "same fact" }),
    t(2),
  );
  // Less trusted co-members rewrite and retire the owner's items.
  await write(
    "r1-tool",
    helper("tool"),
    rewrite(1, { content: "the tool's text" }) as MemoryItem,
    t(3),
  );
  await write("r1-import", helper("import"), rewrite(1, { status: "retired" }) as MemoryItem, t(4));
  await write(
    "r2-model",
    helper("model"),
    rewrite(2, { content: "the agent's text" }) as MemoryItem,
    t(5),
  );
  await write(
    "r2-owner-model",
    alice("model"),
    rewrite(2, { content: "alice's agent" }) as MemoryItem,
    t(6),
  );
  // Sourceless writes claiming user, by another actor.
  const claim = {
    kind: "user" as const,
    provenance: {
      kind: "user" as const,
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:carol",
    },
  };
  await write("u-team", helper(), item(10, { scope: TEAM, owner: "agent:helper", ...claim }), t(7));
  await write(
    "u-person",
    helper(),
    item(11, { scope: ALICE, owner: "agent:helper", ...claim }),
    t(8),
  );
  // Sourceless confirmations of item 3, then its promotion.
  for (const [n, who] of [
    [12, "agent:x"],
    [13, "agent:y"],
  ] as const)
    await write(
      `confirm-${n}`,
      helper(undefined, who),
      item(n, { scope: ALICE, owner: who, class: "episodic", content: "same fact", kind: "user" }),
      t(9),
    );
  await note("promote-3", async () => {
    const r = await plane.promote(alice("user"), id(3), ALICE, t(10));
    return [r.event.decision, r.event.policy_id];
  });
  // Episodic writes by less trusted writers, which evict under a budget of one.
  await write(
    "e-owner",
    alice("user"),
    item(20, { scope: ALICE, owner: ALICE, class: "episodic", content: "an evicted fact" }),
    t(11),
  );
  await write(
    "e-model",
    helper("model"),
    item(21, {
      scope: ALICE,
      owner: "agent:helper",
      class: "episodic",
      content: "the agent's note",
    }),
    t(12),
  );
  await write(
    "e-tool-team",
    helper("tool"),
    item(22, { scope: TEAM, owner: "agent:helper", content: "a tool's team fact" }),
    t(13),
  );
  // A sourceless write restating content an eviction may have retired.
  await write(
    "restate",
    helper(),
    item(23, {
      scope: ALICE,
      owner: ALICE,
      class: "episodic",
      content: "an evicted fact",
      kind: "user",
    }),
    t(14),
  );
  // Hand edits of a user record and a tool record, then adoption of both scopes.
  await write(
    "w40",
    alice("user"),
    item(40, { scope: ALICE, owner: ALICE, content: "alice's note" }),
    t(15),
  );
  for (const n of [40, 22]) {
    const held = currentItems(db).find((i) => i.id === id(n));
    if (held)
      await adapter.write({
        ...held,
        store_ref: null,
        content: "edited in the store",
      } as MemoryItem);
  }
  for (const scope of [ALICE, TEAM])
    await note(`adopt ${scope}`, async () => {
      const r = await adoptStoreItems(deps, alice(), scope, t(15));
      return [r.allowed, r.denied, r.unchanged, r.retired, r.denials.map((d) => d.policy_id)];
    });
  // Sweeps by the agent and by the owner, a check and reads.
  await note("sweep-model", async () => {
    const r = await plane.retain(helper("model"), ALICE, t(16));
    return [r.decision, r.events.length];
  });
  await note("sweep-user", async () => {
    const r = await plane.retain(alice("user"), TEAM, "2027-06-01T00:00:00Z");
    return [r.decision, r.events.length];
  });
  await note("check", async () =>
    plane.checkWrite(helper(), item(30, { scope: TEAM, owner: "agent:helper", ...claim }), t(17)),
  );
  await note("read", async () => {
    const r = await plane.read(alice("user"), { text: "fact", at: t(18) });
    return r.items.map((i) => i.id);
  });
  return JSON.stringify({ out, events: allEvents(db), items: currentItems(db) });
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** sha256 of the workload's canonical output on main before card E2.11. */
const BEFORE: Record<PresetName, { registered: string; tightened: string }> = {
  strict: {
    registered: "6e55d38936349ce31590043a98e3976717865ccedab3cee5aba3c26ee85334ad",
    tightened: "9e0e2dcbf31e362616629f40c016788238865982306b728c1feb6dd2c641d472",
  },
  medium: {
    registered: "301e55f903f84f7f16f1e2261356f684dfb5f4e8fa406b8de5796a06e6ee8dcc",
    tightened: "473195d54ad034164f496d3b84d7ee4a23bc2221e5a28283a7a5480b1060abe0",
  },
  permissive: {
    registered: "7ee14d1013c095f2efb983729cbf43846729fefaef2d3388bf606c24bb031690",
    tightened: "762a786678674735c7c386416e1128f78957160f0ec7267a48fc6b215187e870",
  },
};

describe("the registered presets decide as before card E2.11", () => {
  test.each(PRESETS)("preset %s, as registered and with every budget one", async (name) => {
    const preset = loadPreset(name);
    expect(preset.trust).toBeUndefined();
    const registered = sha(await workload(preset));
    const budgeted = sha(await workload(tightened(preset)));
    // Explicitly off is the same as absent.
    const off = { unattested_floor: "off", protect_trusted: "off" } as const;
    expect(sha(await workload({ ...preset, trust: off }))).toBe(registered);
    expect(sha(await workload({ ...tightened(preset), trust: off }))).toBe(budgeted);
    expect({ registered, tightened: budgeted }).toEqual(BEFORE[name]);
  });
});
