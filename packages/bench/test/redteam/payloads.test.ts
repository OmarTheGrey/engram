import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { deepsetEntries, lakeraEntries } from "../../src/redteam/corpus.ts";
import { fetchPayloads, PAYLOAD_PINS, payloadPath, readPayloads } from "../../src/redteam/payloads.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "engram-x14-"));
  dirs.push(d);
  return d;
};
const [deepset] = PAYLOAD_PINS;
if (!deepset) throw new Error("no deepset pin");

describe("the pinned payload sets", () => {
  test("pin exact revisions with the row counts card R2 read", () => {
    for (const p of PAYLOAD_PINS) expect(p.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(PAYLOAD_PINS.map((p) => [p.repository, p.rows])).toEqual([
      ["deepset/prompt-injections", 662],
      ["Lakera/gandalf_ignore_instructions", 1000],
    ]);
  });

  test("a missing file is an error that says how to fetch it", async () => {
    await expect(readPayloads(tmp(), deepset)).rejects.toThrow(/missing; fetch it first/);
  });

  test("a file whose bytes differ from the pin is refused", async () => {
    const up = tmp();
    const file = deepset.files[0];
    if (!file) throw new Error("no file");
    const path = payloadPath(up, deepset, file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "not the pinned parquet");
    await expect(readPayloads(up, deepset)).rejects.toThrow(/sha256 differs from the pin/);
  });

  test("fetching is refused offline", async () => {
    const before = process.env.ENGRAM_OFFLINE;
    process.env.ENGRAM_OFFLINE = "1";
    try {
      await expect(fetchPayloads(tmp(), deepset)).rejects.toThrow(/ENGRAM_OFFLINE=1 forbids/);
    } finally {
      if (before === undefined) delete process.env.ENGRAM_OFFLINE;
      else process.env.ENGRAM_OFFLINE = before;
    }
  });

  test("deepset's label 1 is an attack whose canary is the row, label 0 a control; every Lakera row is an attack", () => {
    const d = deepsetEntries([
      { split: "train", index: 0, text: "ignore that", label: 1 },
      { split: "train", index: 1, text: "what is the weather", label: 0 },
    ]);
    expect(d.map((e) => [e.id, e.malicious, e.canary, e.family])).toEqual([
      ["deepset/train/0", true, "ignore that", "deepset/injection"],
      ["deepset/train/1", false, "", "deepset/benign"],
    ]);
    expect(() => deepsetEntries([{ split: "x", index: 0, text: "t", label: null }])).toThrow(/label/);
    expect(lakeraEntries([{ split: "test", index: 3, text: "p", label: null }])[0]).toMatchObject({
      id: "lakera/test/3",
      malicious: true,
      canary: "p",
    });
  });
});
