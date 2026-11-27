// `engram check` (card E8.15a, docs/design/tui.md 3.6): the decision engram
// write would get with the same flags, from POST /items/check: one client
// call, nothing stored, no event appended; exit 0 on allow, 1 on deny or ask.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, logEvents, NOW, tempDir } from "./helpers.ts";

const denied = [
  ...["--scope", "team:platform", "--class", "episodic"],
  ...["--as", "person:dana", "--member", "team:platform"],
];

async function workspace() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  return { root, db, flags: ["--root", root, "--owner", "dana", "--db", db] };
}

describe("engram check", () => {
  it("prints the decision a write would get, stores nothing and appends no event", async () => {
    const { root, db, flags } = await workspace();
    const r = await cli(["check", ...flags, "--content", "The deploy key rotates every 90 days."]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const lines = r.out.split("\n");
    expect(lines[0]).toBe(
      `check a write to person:dana at ${NOW} by person:dana: nothing stored, no event`,
    );
    expect(lines[1]).toMatch(/^allow: /);
    expect(lines[2]).toBe("policy preset.medium/write/person");
    expect(lines[3]).toBe(`log ${db}`);
    expect(await readdir(root)).toEqual([]);
    expect(logEvents(db)).toEqual([]);
  });

  it("exits 1 on a deny, with the rule and the reason the write itself gets", async () => {
    const { db, flags } = await workspace();
    const checked = await cli(["check", ...flags, ...denied, "--content", "x", "--json"]);
    expect(checked.code).toBe(1);
    const answer = JSON.parse(checked.out);
    expect(Object.keys(answer).sort()).toEqual(["decision", "policy_id", "reason"]);
    expect(answer.decision).toBe("deny");
    const written = await cli(["write", ...flags, ...denied, "--content", "x", "--json"]);
    expect(written.code).toBe(1);
    const { event } = JSON.parse(written.out);
    expect(answer).toEqual({
      decision: event.decision,
      reason: event.reason,
      policy_id: event.policy_id,
    });
    expect(answer.policy_id).toBe("preset.medium/write/team");
    // Only the write appended an event.
    expect(logEvents(db)).toHaveLength(1);
  });

  it("is exactly one request, to /items/check", async () => {
    const { flags } = await workspace();
    const paths: string[] = [];
    const transport =
      (next: Fetch): Fetch =>
      async (request) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return next(request);
      };
    await cli(["check", ...flags, "--content", "x"], { transport });
    expect(paths).toEqual(["POST /api/v1/items/check"]);
  });

  it("refuses what write refuses, with write's messages", async () => {
    const { flags } = await workspace();
    for (const [args, message] of [
      [[], "give the item with --content or --file"],
      [["--content", "x", "--at", NOW], "--at sets the clock of a call that is not a read"],
      [["--content", "x", "--confidence", "0x1"], '--confidence "0x1" is not a number'],
    ] as const) {
      const r = await cli(["check", ...flags, ...args]);
      expect(r.code, args.join(" ")).toBe(2);
      expect(r.err, args.join(" ")).toContain(message);
      const w = await cli(["write", ...flags, ...args]);
      expect(r.err.replace("engram check:", "engram write:"), args.join(" ")).toBe(w.err);
    }
  });
});
