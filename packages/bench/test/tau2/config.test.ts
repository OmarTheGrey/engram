import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  keyPreset,
  keyStore,
  readTau2Config,
  TAU2_PIN,
  Tau2Config,
  taskItem,
} from "../../src/tau2/config.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FIXTURE = join(REPO, "research", "configs", "b11-tau2-fixture.json");
const raw = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;

describe("tau2's run config", () => {
  test("the fixture config parses and its paths resolve against its folder", () => {
    const config = readTau2Config(FIXTURE);
    expect(config.cassettes).toBe(join(REPO, "fixtures", "cassettes", "b11-tau2-fixture"));
    expect(config.script).toBe(join(REPO, "fixtures", "bench", "tau2", "script.json"));
    expect(config.conditions).toEqual(["C1", "C2", "C5"]);
  });

  test("names the pin of PINS.md and refuses any other commit", () => {
    expect(TAU2_PIN.commit).toBe("fc0055dc4e0a316c3f83133267fbd6faaa770992");
    expect(readFileSync(join(REPO, "packages", "bench", "PINS.md"), "utf8")).toContain(
      `tag \`${TAU2_PIN.tag}\`, \`${TAU2_PIN.commit}\``,
    );
    const moved = { ...raw(), pin: { ...TAU2_PIN, commit: "96a3ef9" } };
    expect(Tau2Config.safeParse(moved).success).toBe(false);
  });

  test("offers only H5's conditions, C1, C2 and C5", () => {
    expect(Tau2Config.safeParse({ ...raw(), conditions: ["C3"] }).success).toBe(false);
    expect(Tau2Config.safeParse({ ...raw(), conditions: ["C1", "C1"] }).success).toBe(false);
  });

  test("keys the preset only under C5 and the store only under C2 and C5, as the runner does", () => {
    expect(["C1", "C2", "C5"].map((c) => keyPreset(c as "C1", "medium"))).toEqual([
      "none",
      "none",
      "medium",
    ]);
    expect(["C1", "C2", "C5"].map((c) => keyStore(c as "C1", "files"))).toEqual([
      "none",
      "files",
      "files",
    ]);
  });

  test("an item names the domain, the task and the role", () => {
    expect(taskItem("airline", "19", "user")).toBe("airline/19/user");
  });

  test("a relative path in a config elsewhere resolves against that config", () => {
    const dir = mkdtempSync(join(tmpdir(), "tau2-config-"));
    writeFileSync(join(dir, "c.json"), JSON.stringify({ ...raw(), cassettes: "cas" }));
    expect(readTau2Config(join(dir, "c.json")).cassettes).toBe(join(dir, "cas"));
  });
});
