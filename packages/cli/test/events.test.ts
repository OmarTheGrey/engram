// `engram events` (card E8.15a, docs/design/tui.md 3.6): the inspector's
// timeline from the command line, POST /events: the events the actor may
// see (visibleEvents), one client call, nothing appended.
import { join } from "node:path";
import type { MemoryEvent } from "@engram/core";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, logEvents, tempDir } from "./helpers.ts";

/** A log with one write of dana's allowed and one denied, and one of sam's. */
async function history() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  const store = ["--root", root, "--db", db];
  const dana = await cli(["write", ...store, "--owner", "dana", "--content", "Dana's note."]);
  expect(dana.code).toBe(0);
  const denied = await cli([
    "write",
    ...store,
    ...["--owner", "dana", "--content", "x", "--scope", "team:platform", "--class", "episodic"],
    ...["--member", "team:platform"],
  ]);
  expect(denied.code).toBe(1);
  const sam = await cli(["write", ...store, "--as", "person:sam", "--content", "Sam's note."]);
  expect(sam.code).toBe(0);
  return db;
}

const events = (out: string) => (JSON.parse(out) as { events: MemoryEvent[] }).events;

describe("engram events", () => {
  it("lists the events the actor may see, each with its decision, rule and reason", async () => {
    const db = await history();
    const r = await cli(["events", "--owner", "dana", "--db", db]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const all = logEvents(db);
    const dana = all.filter((e) => e.actor === "person:dana");
    const lines = r.out.split("\n");
    expect(lines[0]).toBe(`events person:dana may see: ${dana.length} events`);
    for (const e of dana) {
      expect(r.out).toContain(
        `  ${e.seq} ${e.ts} ${e.op} ${e.decision} by ${e.actor} in ${e.scope_to ?? e.scope_from ?? "-"}, item ${e.item_id ?? "none"}`,
      );
      expect(r.out).toContain(`    ${e.reason} (${e.policy_id})`);
    }
    expect(r.out).not.toContain("Sam");
    expect(r.out).not.toContain("person:sam");
    expect(lines.at(-2)).toBe(`log ${db}`);
  });

  it("gives the route's answer with --json, and only the events after --after", async () => {
    const db = await history();
    const full = await cli(["events", "--owner", "dana", "--db", db, "--json"]);
    expect(full.code).toBe(0);
    const seen = events(full.out);
    expect(Object.keys(JSON.parse(full.out))).toEqual(["events"]);
    expect(seen.map((e) => e.actor)).toEqual(seen.map(() => "person:dana"));
    const first = seen[0] as MemoryEvent;
    const after = await cli(["events", "--owner", "dana", "--db", db, "--json", "--after", "0"]);
    expect(events(after.out)).toEqual(seen.filter((e) => e.seq > 0));
    const text = await cli(["events", "--owner", "dana", "--db", db, "--after", String(first.seq)]);
    expect(text.out.split("\n")[0]).toBe(
      `events person:dana may see after seq ${first.seq}: ${seen.length - 1} event${seen.length - 1 === 1 ? "" : "s"}`,
    );
  });

  it("is exactly one request, and appends no event", async () => {
    const db = await history();
    const before = logEvents(db).length;
    const paths: string[] = [];
    const transport =
      (next: Fetch): Fetch =>
      async (request) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return next(request);
      };
    await cli(["events", "--owner", "dana", "--db", db], { transport });
    expect(paths).toEqual(["POST /api/v1/events"]);
    expect(logEvents(db)).toHaveLength(before);
  });

  it("needs an actor and a seq that is a whole number, and a log that exists", async () => {
    const db = await history();
    for (const args of [
      ["--db", db],
      ["--owner", "dana", "--db", db, "--after", "-1"],
      ["--owner", "dana", "--db", db, "--after", "x"],
      ["--owner", "dana", "--db", db, "--after", "1.5"],
    ]) {
      const r = await cli(["events", ...args]);
      expect(r.code, args.join(" ")).toBe(2);
    }
    const missing = join(await tempDir(), "none.db");
    const r = await cli(["events", "--owner", "dana", "--db", missing]);
    expect(r.code).not.toBe(0);
    expect(r.err).toContain(missing);
  });
});
