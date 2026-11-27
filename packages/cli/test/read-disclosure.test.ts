// Card RD1 over the CLI: `engram read --json` (and so the TUI's J view on
// branch cliupgrade, which prints the CLI's bytes) shows a grantee only its
// own grant and names no lineage id it may not read. Core decides
// (visible.ts); the CLI prints the read route's answer.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, tempDir } from "./helpers.ts";

const NOTE = "01920000-0000-7000-8000-00000000d001";
const ITEM = "01920000-0000-7000-8000-00000000d002";
const UNTIL = "2026-12-31T00:00:00.000Z";
const grant = (to: string) => ({ to, class: "semantic", mode: "read", expires: UNTIL });

/** Dana's person note, and her item granted to sam then eve whose lineage names the note. */
async function seeded() {
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const root = await tempDir();
  const store = ["--root", root, "--owner", "dana", "--db", db];
  const note = await cli(["write", ...store, "--id", NOTE, "--content", "Dana's sister is Mira."]);
  expect(note.code, note.err).toBe(0);
  const file = join(dir, "item.json");
  await writeFile(
    file,
    JSON.stringify({ grants: [grant("person:sam"), grant("person:eve")], lineage: [NOTE] }),
  );
  const written = await cli([
    "write",
    ...store,
    ...["--id", ITEM, "--content", "Dana prefers written standups.", "--file", file],
  ]);
  expect(written.code, written.err).toBe(0);
  return { db, root };
}

const readAs = async ({ db, root }: { db: string; root: string }, who: string[]) => {
  const r = await cli(["read", ...who, "--root", root, "--owner", "dana", "--db", db, "--json"]);
  expect(r.code, r.err).toBe(0);
  return { json: r.out, read: JSON.parse(r.out) };
};

describe("engram read --json discloses what the reader may see (RD1)", () => {
  it("sam sees his grant only and no ancestor id; eve hers; dana both and the note", async () => {
    const db = await seeded();
    type Shown = { id: string; grants: { to: string }[]; lineage: string[] };
    const item = (read: { items: { item: Shown }[] }) =>
      read.items.map((r) => r.item).find((i) => i.id === ITEM);
    const sam = await readAs(db, ["--as", "person:sam"]);
    expect(item(sam.read)?.grants.map((g) => g.to)).toEqual(["person:sam"]);
    expect(item(sam.read)?.lineage).toEqual([]);
    expect(sam.json).not.toContain(NOTE);
    expect(sam.json).not.toContain("person:eve");
    const eve = await readAs(db, ["--as", "person:eve"]);
    expect(item(eve.read)?.grants.map((g) => g.to)).toEqual(["person:eve"]);
    expect(eve.json).not.toContain("person:sam");
    expect(eve.json).not.toContain(NOTE);
    const dana = await readAs(db, []);
    expect(item(dana.read)?.grants.map((g) => g.to)).toEqual(["person:sam", "person:eve"]);
    expect(item(dana.read)?.lineage).toEqual([NOTE]);
  });
});
