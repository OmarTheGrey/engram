// The pi extension keeps the chain of a log that has one (card E1.9; card
// E1.6's finding docs/log/2026-11-21-e1-6-finding-unkept-writers.md). A log
// another writer chained (the CLI, through the shared opener) is handed to
// the extension on a handle of its own, as a library caller or a harness
// would open it; the agent's writes through the extension are chained, and
// the log verifies clean. A log with no chain, as every research run's
// scratch log is, stays without one: the extension begins none.
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolCall } from "@earendil-works/pi-ai";
import { createFakeAdapter } from "@engram/adapters";
import {
  allEvents,
  keepChain,
  keepsChain,
  loadPreset,
  migrate,
  openSqlite,
  verifyChain,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { createEngramExtension } from "../src/index.ts";
import { AT, id, OMAR, startSession } from "./harness.ts";

const policy = loadPreset("medium");
const call = (callId: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id: callId, name, arguments: args },
});
const SCRIPT = [
  call("call-1", "memory_write", { scope: "person:omar", content: "omar ships on Tuesdays" }),
  call("call-2", "memory_read", { query: "ships" }),
  { text: "done" },
];

async function session(db: ReturnType<typeof openSqlite>) {
  let n = 0;
  const extension = createEngramExtension({
    db,
    adapter: createFakeAdapter(),
    policy,
    actor: OMAR,
    newId: () => id(++n),
    now: () => AT,
    recall: false,
  });
  const run = await startSession(extension, SCRIPT, ["memory_write", "memory_read"]);
  try {
    await run.session.prompt("Remember how I ship.");
  } finally {
    run.session.dispose();
  }
}

describe("the pi extension and the chain", () => {
  test("on a chained log, the extension's own handle keeps the chain and the log verifies", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "engram-pi-chain-")), "engram.db");
    const cli = openSqlite(path);
    const pi = openSqlite(path);
    try {
      migrate(cli);
      keepChain(cli, { salt: () => randomBytes(32) });
      expect(keepsChain(pi)).toBe(false);
      await session(pi);
      expect(keepsChain(pi)).toBe(true);
      const events = allEvents(cli);
      expect(events.some((e) => e.op === "write" && e.decision === "allow")).toBe(true);
      const r = verifyChain(cli);
      expect(r.first_break, JSON.stringify(r.first_break)).toBeNull();
      expect(r.counts.events).toBe(events.length);
      expect(r.counts.unchained).toBe(0);
    } finally {
      pi.close();
      cli.close();
    }
  });

  test("on a log with no chain, as a research run's, the extension begins none", async () => {
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      await session(db);
      expect(keepsChain(db)).toBe(false);
      expect(allEvents(db).length).toBeGreaterThan(0);
      expect(db.prepare("SELECT count(*) AS n FROM chain").get()?.n).toBe(0);
    } finally {
      db.close();
    }
  });
});
