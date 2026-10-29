import { createFakeAdapter } from "@engram/adapters";
import { createPlane, loadPreset, type MemoryEvent, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  actionRead,
  CHANNEL_WRITERS,
  OPERATIONS,
  OPERATOR,
  writePhase,
} from "../../src/mem-inv-bench/plane.ts";
import type { Case } from "../../src/mem-inv-bench/schema.ts";
import { visibleCase } from "../../src/mem-inv-bench/strip.ts";
import { cases } from "./fixture.ts";

const ids = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};

/** One case through a fresh plane on the fake store: the write phase, then the action-time read. */
async function run(c: Case, preset: "medium" | "strict" = "medium") {
  const db = openSqlite(":memory:");
  migrate(db);
  const newId = ids();
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset(preset),
    newId,
  });
  const view = visibleCase(c);
  const writes = await writePhase(plane, view, newId);
  const read = await actionRead(plane, view);
  const events = plane.events();
  db.close();
  return { writes, read, events };
}

const byChannel = (ch: string) => {
  const c = cases().find((x) => x.channel === ch);
  if (!c) throw new Error(`fixture lacks a ${ch} case`);
  return c;
};

describe("MEM-INV-Bench's origin channels map to provenance kinds and actors", () => {
  test("the mapping: user to user, trusted registries and tools to tool, untrusted feeds to document, the agent to model", () => {
    const kinds = Object.fromEntries(
      Object.entries(CHANNEL_WRITERS).map(([ch, w]) => [ch, `${w.kind} ${w.actor} ${w.scope}`]),
    );
    expect(kinds).toEqual({
      user: `user ${OPERATOR} ${OPERATOR}`,
      erp: `tool agent:erp ${OPERATIONS}`,
      bank: `tool agent:bank ${OPERATIONS}`,
      tool: `tool agent:lookup ${OPERATIONS}`,
      web: `document agent:web ${OPERATIONS}`,
      inbox: `document agent:inbox ${OPERATIONS}`,
      agent: `model ${OPERATOR} ${OPERATOR}`,
    });
  });

  test("each write event carries the kind and actor of the entry's channel, set by the plane", async () => {
    for (const ch of ["direct", "summarize", "tool_echo", "corroborate", "legit"]) {
      const c = byChannel(ch);
      const { writes } = await run(c);
      for (const w of writes) {
        const writer = CHANNEL_WRITERS[w.channel];
        const item = w.result.event.item;
        expect(w.result.event.op, `${c.case_id} ${w.entry_id}`).toBe("write");
        expect(item?.provenance.kind, `${c.case_id} ${w.entry_id}`).toBe(writer.kind);
        expect(item?.provenance.actor, `${c.case_id} ${w.entry_id}`).toBe(writer.actor);
        expect(w.result.event.actor).toBe(writer.actor);
        expect(item?.scope).toBe(writer.scope);
      }
    }
  });

  test("under medium the poisoned write is allowed, with a reason and a policy id, and the action-time read returns it", async () => {
    const c = byChannel("direct");
    const { writes, read } = await run(c);
    const poisoned = writes.find((w) => w.channel === "web");
    expect(poisoned?.result.event).toMatchObject({
      decision: "allow",
      policy_id: "preset.medium/write/team",
    });
    expect(poisoned?.result.event.reason).toMatch(/source document passes the team write rule/);
    expect(read.event).toMatchObject({ op: "read", decision: "allow", actor: OPERATOR });
    // The plane ranks what it admits (most recent first here); upstream lists in write order.
    expect(read.items.map((i) => i.content).sort()).toEqual(c.memory.map((e) => e.text).sort());
  });

  test("the self-summary is model content kept in the operator's person scope (source isolation)", async () => {
    const { writes } = await run(byChannel("summarize"));
    const note = writes.find((w) => w.channel === "agent");
    expect(note?.result.event).toMatchObject({
      decision: "allow",
      policy_id: "preset.medium/write/person",
    });
    expect(note?.result.item?.scope).toBe(OPERATOR);
  });

  test("under strict the team's writes land as candidates and the action-time read admits none of them", async () => {
    const c = byChannel("summarize");
    const { writes, read } = await run(c, "strict");
    const team = writes.filter((w) => CHANNEL_WRITERS[w.channel].scope === OPERATIONS);
    expect(team.length).toBeGreaterThan(0);
    for (const w of team) expect(w.result.item?.status).toBe("candidate");
    expect(read.items.map((i) => i.scope)).toEqual([OPERATOR]);
    expect(read.filtered).toBe(team.length);
  });

  test("every decision of a case is one event with a reason and a policy id", async () => {
    const { events } = await run(byChannel("corroborate"));
    const decided = events.filter((e: MemoryEvent) => e.op === "write" || e.op === "read");
    expect(decided).toHaveLength(byChannel("corroborate").memory.length + 1);
    for (const e of decided) {
      expect(e.reason.length).toBeGreaterThan(0);
      expect(e.policy_id.length).toBeGreaterThan(0);
    }
  });
});
