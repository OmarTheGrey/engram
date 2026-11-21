// The Python shim's memory tools against the runner's: the same names,
// descriptions and parameters as packages/pi-extension/src/tools.ts, and the
// same text as tag.ts and writeResultText for the same read or write
// (decision D13, ADR 0015). The pi extension's files are imported by path:
// @engram/bench may not depend on @engram/pi-extension, whose tests depend
// on the runner, which depends on this package. The shim is standard
// library only, run by the research workspace's Python (`uv sync`).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, Id } from "@engram/core";
import { describe, expect, test } from "vitest";
import { tagRecall, tagUngovernedRead } from "../../../pi-extension/src/tag.ts";
import { MEMORY_READ, MEMORY_WRITE, writeResultText } from "../../../pi-extension/src/tools.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SHIM = join(REPO, "packages", "bench", "scripts", "tau2_memory.py");
const PYTHON = [
  join(REPO, ".venv", "Scripts", "python.exe"),
  join(REPO, ".venv", "bin", "python"),
].find(existsSync);

function shim(args: string[], input?: unknown): string {
  if (PYTHON === undefined) {
    throw new Error(
      `no research Python under ${join(REPO, ".venv")}; run uv sync once after clone`,
    );
  }
  const run = spawnSync(PYTHON, ["-I", SHIM, ...args], {
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  return run.stdout;
}

const render = (spec: unknown) => shim(["render"], spec);

const stored = [
  {
    id: "0190a000-0000-7000-8000-000000000001",
    scope: "team:tau2-airline",
    content: 'a <b> & "c"',
  },
  { id: "0190a000-0000-7000-8000-000000000002", scope: "person:tau2-agent", content: "plain" },
];

describe("the tau2 shim's memory tools are the runner's", () => {
  test("declares memory_write and memory_read as the pi extension does", () => {
    const tools = JSON.parse(shim(["tools"])) as {
      name: string;
      description: string;
      parameters: unknown;
    }[];
    const ours = [MEMORY_WRITE, MEMORY_READ].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: JSON.parse(JSON.stringify(t.parameters)) as unknown,
    }));
    expect(canonicalJson(tools)).toBe(canonicalJson(ours));
  });

  test("renders C2's read as tagUngovernedRead does, markup escaped", () => {
    expect(render({ kind: "store", items: stored })).toBe(tagUngovernedRead(stored));
    expect(render({ kind: "store", items: [] })).toBe(tagUngovernedRead([]));
  });

  test("renders C5's read as tagRecall does, without the read id, in rank order, cut to the limit", () => {
    const read = {
      items: stored.map((s) => ({ ...s, class: "semantic" })),
      explanations: [
        { item_id: stored[1]?.id, rank: 1, policy_id: "preset.medium/read/person" },
        { item_id: stored[0]?.id, rank: 2, policy_id: "preset.medium/read/team" },
      ],
      filtered: 3,
      event: { policy_id: "preset.medium/read/person" },
    };
    const details = {
      read_id: "READ",
      policy_id: "preset.medium/read/person",
      filtered: 3,
      explanations: [],
      items: [
        {
          item_id: stored[1]?.id ?? "",
          scope: "person:tau2-agent",
          content: "plain",
          rank: 1,
          score: 0,
          policy_id: "preset.medium/read/person",
        },
      ],
    };
    const expected = tagRecall(details).replace(' read_id="READ"', "");
    expect(render({ kind: "plane", read, limit: 1 })).toBe(expected);
  });

  test("a write's result is writeResultText's, a refusal the extension's", () => {
    const item = { id: "i1", scope: "person:tau2-agent", status: "active" };
    expect(render({ kind: "write", item })).toBe(writeResultText(item));
    expect(
      render({
        kind: "refusal",
        event: { reason: "source model not allowed", policy_id: "preset.medium/write/team" },
      }),
    ).toBe("engram: source model not allowed (preset.medium/write/team)");
  });

  test("an item id is a UUID version 7 the schema accepts, the same for the same call", () => {
    const a = render({ kind: "item_id", parts: ["run", "19", "call_1"] });
    expect(Id.safeParse(a).success).toBe(true);
    expect(render({ kind: "item_id", parts: ["run", "19", "call_1"] })).toBe(a);
    expect(render({ kind: "item_id", parts: ["run", "19", "call_2"] })).not.toBe(a);
  });
});
