// The subject access export and the record of processing (card E9.16). The
// acceptance: `engram export --subject` round-trips (its bundle imports into
// an empty workspace and exports again with the same content), and `engram
// audit ropa` over the fixture log matches the record kept in
// docs/compliance/ropa-medium.txt. Around them: the export goes only to the
// subject, a derived item out of the subject's reach is counted and never
// named, and the record holds no content, id or scope. Synthetic content
// only (AGENTS.md rule 12).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryItem } from "@engram/core";
import { describe, expect, it } from "vitest";
import { cli, REPO, tempDir } from "./helpers.ts";

const DANA = ["--as", "person:dana", "--member", "person:dana", "--member", "team:platform"];
/** sam reviews in dana's scope and belongs to team:ops, which dana does not. */
const SAM = [
  ...["--as", "person:sam", "--member", "person:dana"],
  ...["--member", "team:platform", "--member", "team:ops"],
];
const OUT_OF_REACH = "CANARY-e916 the ops runbook";
const RECORD = join(REPO, "docs/compliance/ropa-medium.txt");

async function workspace() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  return { root, db, store: ["--store", "files", "--root", root, "--owner", "dana", "--db", db] };
}

/** dana's items, one promoted into her team and one into a team she is no member of. */
async function populate(store: string[]) {
  const write = async (...more: string[]) => {
    const r = await cli(["write", ...store, ...DANA, "--json", ...more]);
    expect(r.code, r.err).toBe(0);
    return (JSON.parse(r.out).event as { item_id: string }).item_id;
  };
  await write("--scope", "person:dana", "--content", "Dana prefers short code reviews.");
  const toTeam = await write("--scope", "person:dana", "--content", "Dana deploys on Tuesdays.");
  const toOps = await write("--scope", "person:dana", "--content", OUT_OF_REACH);
  await write("--scope", "team:platform", "--content", "The platform team ships on Thursdays.");
  const promote = async (id: string, to: string) => {
    const r = await cli(["promote", id, "--to", to, ...store, ...SAM, "--review", "--json"]);
    expect(r.code, r.out).toBe(0);
    return (JSON.parse(r.out).item as MemoryItem).id;
  };
  return { team: await promote(toTeam, "team:platform"), ops: await promote(toOps, "team:ops") };
}

const rowsOf = (text: string) =>
  text
    .split("\n")
    .filter((l) => l !== "")
    .slice(1)
    .map((l) => JSON.parse(l) as { item: MemoryItem; events: { op: string }[] });

describe("engram export --subject (card E9.16)", () => {
  it("round-trips: the bundle imports into an empty workspace and exports the same content", async () => {
    const a = await workspace();
    const { ops } = await populate(a.store);
    const file = join(await tempDir(), "dana.jsonl");
    const r = await cli([
      "export",
      "--db",
      a.db,
      ...DANA,
      "--subject",
      "person:dana",
      "--out",
      file,
    ]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const bundle = readFileSync(file, "utf8");
    const rows = rowsOf(bundle);
    expect(rows.length).toBeGreaterThan(0);
    // The report: the bundle's counts and the closure, the ops version counted only.
    expect(r.out).toMatch(/^exported \d+ items with \d+ events as person:dana/);
    expect(r.out).toContain("subject access export for person:dana at 2026-10-25T12:00:00.000Z");
    expect(r.out).toContain("derived items in other scopes: 1\n  1 more out of your reach");
    expect(r.out).toContain("not a certification");
    // The scopes it read, and the note says what a retire reason can name.
    expect(r.out).toContain("  scopes read: person:dana, team:platform\n");
    expect(r.out).toContain("a retire reason in the bundle may still name the id of a successor");
    expect(r.out).toContain("not authenticated");
    expect(r.out).toContain("your own items in scopes not read: 0\n");
    // The report never names the ops version, nor any content.
    expect(r.out).not.toContain(ops);
    expect(r.out).not.toContain(OUT_OF_REACH);
    // Pinned as it stands (finding E9.16, the successor in a retire reason):
    // the bundle carries the retire event of dana's own source item, which
    // visible.ts shows a member of the scope it left, and its reason names
    // the successor's id. Only the id: the content stays out.
    // Occurrences, not lines: the id is in the bundle exactly once.
    expect(bundle.split(ops).length - 1).toBe(1);
    const named = bundle.split("\n").filter((l) => l.includes(ops));
    expect(named[0]).toContain(
      `superseded by ${ops}, its promotion to a semantic item in team:ops`,
    );
    // Into an empty workspace, and out again: the same content.
    const b = await workspace();
    const imported = await cli(["import", file, ...b.store, ...DANA]);
    expect(imported.code, imported.out).toBe(0);
    const again = join(await tempDir(), "again.jsonl");
    const r2 = await cli([
      "export",
      "--db",
      b.db,
      ...DANA,
      "--subject",
      "person:dana",
      "--out",
      again,
    ]);
    expect(r2.code, r2.err).toBe(0);
    const contents = (rs: ReturnType<typeof rowsOf>) => rs.map((x) => x.item.content).sort();
    expect(contents(rowsOf(readFileSync(again, "utf8")))).toEqual(contents(rows));
  });

  it("is the same report for the same log and clock", async () => {
    const a = await workspace();
    await populate(a.store);
    const run = async () => {
      const file = join(await tempDir(), "dana.jsonl");
      const r = await cli([
        "export",
        "--db",
        a.db,
        ...DANA,
        "--subject",
        "person:dana",
        "--out",
        file,
      ]);
      return r.out.replace(file, "<out>").split("\n").slice(1).join("\n");
    };
    expect(await run()).toBe(await run());
  });

  it("goes only to the subject, needs --out, and never runs against a server", async () => {
    const a = await workspace();
    await populate(a.store);
    const file = join(await tempDir(), "x.jsonl");
    const other = await cli([
      "export",
      "--db",
      a.db,
      ...SAM,
      "--subject",
      "person:dana",
      "--out",
      file,
    ]);
    expect(other.code).toBe(2);
    expect(other.err).toMatch(/goes only to the subject/);
    const agent = await cli([
      "export",
      "--db",
      a.db,
      "--as",
      "agent:pi",
      "--subject",
      "agent:pi",
      "--out",
      file,
    ]);
    expect(agent.code).toBe(2);
    expect(agent.err).toMatch(/a person principal/);
    const noOut = await cli(["export", "--db", a.db, ...DANA, "--subject", "person:dana"]);
    expect(noOut.code).toBe(2);
    expect(noOut.err).toMatch(/--subject needs --out/);
    const served = await cli([
      ...["export", "--server", "http://127.0.0.1:9", ...DANA],
      ...["--subject", "person:dana", "--out", file],
    ]);
    expect(served.code).toBe(2);
    expect(served.err).toMatch(/not with --server/);
    // --as defaults to the subject.
    const own = await cli(["export", "--db", a.db, "--subject", "person:dana", "--out", file]);
    expect(own.code, own.err).toBe(0);
    expect(own.out).toContain("as person:dana");
    // With no --member, only the person scope is read, and the report says so.
    expect(own.out).toContain("  scopes read: person:dana\n");
    // The team item dana owns is then accounted for, never silently left out.
    expect(own.out).toMatch(/your own items in scopes not read: [1-9]/);
    // The person level only.
    const team = await cli([
      ...["export", "--db", a.db, ...DANA, "--level", "team"],
      ...["--subject", "person:dana", "--out", file],
    ]);
    expect(team.code).toBe(2);
    expect(team.err).toMatch(/person level/);
  });
});

describe("engram audit ropa (card E9.16)", () => {
  it("over the fixture log matches the record in docs/compliance", async () => {
    const a = await workspace();
    await populate(a.store);
    const r = await cli(["audit", "ropa", "--policy", "medium", "--db", a.db]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    expect(r.out).toBe(readFileSync(RECORD, "utf8").replace(/\r\n/g, "\n"));
  });

  it("holds no content, id, scope or actor, and --json gives the same record", async () => {
    const a = await workspace();
    const { team, ops } = await populate(a.store);
    const text = await cli(["audit", "ropa", "--policy", "medium", "--db", a.db]);
    const json = await cli(["audit", "ropa", "--policy", "medium", "--db", a.db, "--json"]);
    expect(json.code).toBe(0);
    const record = JSON.parse(json.out);
    expect(record.format).toBe("engram-ropa/1");
    expect(record.levels.map((l: { level: string }) => l.level)).toEqual([
      "person",
      "role",
      "team",
      "org",
    ]);
    for (const out of [text.out, json.out])
      for (const leak of [OUT_OF_REACH, "Dana", team, ops, "person:dana", "person:sam", "team:ops"])
        expect(out).not.toContain(leak);
  });

  it("without --db gives the policy only, and refuses a log that does not exist", async () => {
    const r = await cli(["audit", "ropa", "--policy", "strict"]);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("  items:");
    const missing = await cli(["audit", "ropa", "--db", join(await tempDir(), "none.db")]);
    expect(missing.code).toBe(1);
    expect(missing.err).toMatch(/no event log/);
  });
});
