// `engram export` and `engram import` (card E9.8, decision item 55,
// docs/bundle.md). The acceptance is the round-trip invariant: export,
// import into an empty workspace, promote, export again; content and
// validity come back equal, and lineage equal under the id map the import
// returns. Then the import actor: every row a write by `import:<importer>`
// with source import, never the user source `engram write` sets, a
// candidate, no grants, the gate deciding. Synthetic content only (rule 12).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Actor,
  eventVisibleTo,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
} from "@engram/core";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, logEvents, REPO, tempDir } from "./helpers.ts";

interface Row {
  item: MemoryItem;
  events: { op: string; decision: string; actor: string; seq: number }[];
}

/** The rows of a bundle's text, after its header line. */
function rowsOf(text: string): { header: Record<string, unknown>; rows: Row[] } {
  const [head, ...rest] = text.split("\n").filter((l) => l !== "");
  return { header: JSON.parse(head ?? "{}"), rows: rest.map((l) => JSON.parse(l) as Row) };
}

async function workspace() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  const store = ["--store", "files", "--root", root, "--owner", "dana", "--db", db];
  return { root, db, store };
}

const DANA = ["--as", "person:dana", "--member", "person:dana", "--member", "team:platform"];
/** sam, a user-sourced member of dana's scope and the team: a reviewer who is neither owner nor author. */
const SAM = ["--as", "person:sam", "--member", "person:dana", "--member", "team:platform"];
const LEE = ["--as", "person:lee", "--member", "person:dana", "--member", "person:lee"];

/** The medium preset with card E2.11's trust options on, as a policy file (the CLI names only the registered presets). */
const TRUST = join(REPO, "packages/core/policies/medium-trust.yaml");

const EPISODE = "01950000-0000-7000-8000-000000000001";
const FACT = "Dana deploys on Tuesdays.";

/** Workspace A: what dana takes out, and what she must not. */
async function populate(store: string[]) {
  const write = async (who: string[], ...more: string[]) => {
    const r = await cli(["write", ...store, ...who, ...more]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
  };
  await write(DANA, "--scope", "person:dana", "--content", "Dana prefers short code reviews.");
  await write(
    DANA,
    ...["--scope", "person:dana", "--confidence", "0.8"],
    ...["--valid-from", "2026-09-01T00:00:00.000Z", "--valid-to", "2027-03-01T00:00:00.000Z"],
    ...["--content", "Dana is on the release rota until March."],
  );
  // An episode, confirmed by two others, promoted to semantic: a new id
  // whose lineage names the episode (retired) and both confirmers.
  await write(
    DANA,
    "--id",
    EPISODE,
    "--scope",
    "person:dana",
    "--class",
    "episodic",
    "--content",
    FACT,
  );
  await write(SAM, "--scope", "person:dana", "--class", "episodic", "--content", FACT);
  await write(LEE, "--scope", "person:dana", "--class", "episodic", "--content", FACT);
  const p = await cli(["promote", EPISODE, "--to", "person:dana", ...store, ...DANA, "--json"]);
  expect(p.code).toBe(0);
  const promoted = JSON.parse(p.out).item as MemoryItem;
  expect(promoted.lineage).toHaveLength(3);
  // dana's own team item, and sam's, which is not dana's to take.
  await write(
    DANA,
    "--scope",
    "team:platform",
    "--content",
    "The platform team ships on Thursdays.",
  );
  await write(SAM, "--scope", "team:platform", "--content", "Sam owns the staging cluster.");
  // lee's own scope, which dana is no member of.
  await write(LEE, "--scope", "person:lee", "--content", "Lee keeps notes in plain text.");
  return promoted;
}

const exportAs = (store: string[], who = DANA) => {
  const db = store[store.indexOf("--db") + 1] as string;
  return cli(["export", "--db", db, ...who]);
};

describe("engram export", () => {
  it("writes the actor's person scope whole and its own items elsewhere, each with its events", async () => {
    const a = await workspace();
    const promoted = await populate(a.store);
    const r = await exportAs(a.store);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const { header, rows } = rowsOf(r.out);
    expect(header).toMatchObject({
      format: "engram-bundle",
      version: 1,
      exported_by: "person:dana",
      policy: "preset.medium v1",
      rows: 7,
    });
    const contents = rows.map((x) => x.item.content);
    expect(contents).not.toContain("Sam owns the staging cluster.");
    expect(contents).not.toContain("Lee keeps notes in plain text.");
    expect(contents).toContain("The platform team ships on Thursdays.");
    // Every status: the promoted episode comes along, retired.
    expect(rows.find((x) => x.item.id === EPISODE)?.item.status).toBe("retired");
    expect(rows.find((x) => x.item.id === promoted.id)?.item.lineage).toEqual(promoted.lineage);
    const episode = rows.find((x) => x.item.id === EPISODE);
    expect(episode?.events.map((e) => e.op)).toEqual(["write", "retire"]);
    for (const row of rows) for (const e of row.events) expect("item" in e).toBe(false);
    // Rows in id order, which is creation order.
    const ids = rows.map((x) => x.item.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("appends exactly one read event, which only the exporter sees (review finding E9.8-3)", async () => {
    const a = await workspace();
    await populate(a.store);
    const before = logEvents(a.db).length;
    expect((await exportAs(a.store)).code).toBe(0);
    const after = logEvents(a.db);
    expect(after).toHaveLength(before + 1);
    const event = after.at(-1);
    expect(event).toMatchObject({
      op: "read",
      actor: "person:dana",
      item_id: null,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      policy_id: "preset.medium/read/person",
    });
    expect(event?.reason).toMatch(
      /^exported 7 items with \d+ events as a bundle under preset\.medium v1/,
    );
    expect(event?.item_ids).toBeUndefined();
    // The event names no scope, so only its maker sees it (visible.ts), even
    // a member of the exported scope.
    const policy = loadPreset("medium");
    const as = (id: string): Actor => ({ id, level: "person", memberships: ["person:dana"] });
    expect(eventVisibleTo(as("person:dana"), event as MemoryEvent, policy)).toBe(true);
    expect(eventVisibleTo(as("person:sam"), event as MemoryEvent, policy)).toBe(false);
  });

  it("writes to --out with a summary, and refuses a log that does not exist", async () => {
    const a = await workspace();
    await populate(a.store);
    const out = join(await tempDir(), "dana.jsonl");
    const r = await cli(["export", "--db", a.db, ...DANA, "--out", out]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(
      /^exported 7 items with \d+ events as person:dana under preset\.medium v1 to /,
    );
    expect(rowsOf(readFileSync(out, "utf8")).rows).toHaveLength(7);
    const missing = await cli(["export", "--db", join(await tempDir(), "none.db"), ...DANA]);
    expect(missing.code).toBe(1);
    expect(missing.err).toContain("no event log");
  });
});

describe("the round trip: export, import into an empty workspace, promote, export again", () => {
  it("brings content and validity back equal, and lineage equal under the id map", async () => {
    const a = await workspace();
    await populate(a.store);
    const first = await exportAs(a.store);
    const bundle = join(await tempDir(), "bundle.jsonl");
    writeFileSync(bundle, first.out, "utf8");
    const before = rowsOf(first.out).rows;

    const b = await workspace();
    const imported = await cli(["import", bundle, ...b.store, ...DANA, "--json"]);
    expect(imported.err).toBe("");
    expect(imported.code).toBe(0);
    const report = JSON.parse(imported.out);
    expect(report).toMatchObject({ rows: 7, allowed: 7, denied: 0, lineage_dropped: 0 });
    const map = report.id_map as Record<string, string>;
    expect(Object.keys(map).sort()).toEqual(before.map((r) => r.item.id).sort());
    // An import mints new ids.
    for (const [from, to] of Object.entries(map)) expect(to).not.toBe(from);

    // A reviewer promotes each semantic candidate in place (ADR 0026): sam,
    // who neither owns the rows (dana does) nor wrote them (the import actor did).
    const candidates = before.filter(
      (r) => r.item.class === "semantic" && r.item.status === "active",
    );
    expect(candidates.length).toBe(4);
    for (const r of candidates) {
      const to = map[r.item.id] as string;
      const p = await cli(["promote", to, "--to", r.item.scope, "--review", ...b.store, ...SAM]);
      expect(p.out).toContain("allow");
      expect(p.code).toBe(0);
    }

    const second = rowsOf((await exportAs(b.store)).out).rows;
    expect(second).toHaveLength(before.length);
    const after = new Map(second.map((r) => [r.item.id, r.item]));
    for (const { item } of before) {
      const again = after.get(map[item.id] as string);
      expect(again, item.id).toBeDefined();
      expect(again?.content).toEqual(item.content);
      expect(again?.class).toBe(item.class);
      expect(again?.scope).toBe(item.scope);
      expect([again?.valid_from, again?.valid_to, again?.ttl]).toEqual([
        item.valid_from,
        item.valid_to,
        item.ttl,
      ]);
      expect(again?.lineage).toEqual(item.lineage.map((id) => map[id]));
      // What was active is active again after the review; the confirmers stay
      // candidates (an episodic item is promoted only to a new semantic
      // version), the retired episode stays retired.
      const expected =
        item.status === "retired" ? "retired" : item.class === "semantic" ? "active" : "candidate";
      expect(again?.status).toBe(expected);
    }
  });
});

describe("engram import: the import actor", () => {
  /** A bundle of one row that claims everything a row could claim. */
  async function claiming() {
    const a = await workspace();
    await cli([
      "write",
      ...a.store,
      ...DANA,
      ...["--scope", "person:dana", "--content", "Dana reads the changelog on Mondays."],
    ]);
    const text = (await exportAs(a.store)).out;
    const { header, rows } = rowsOf(text);
    const row = rows[0] as Row;
    const grant = {
      to: "person:sam",
      class: "semantic",
      mode: "read",
      expires: "2027-01-01T00:00:00.000Z",
    };
    row.item = {
      ...row.item,
      status: "active",
      version: 4,
      grants: [grant],
      provenance: { ...row.item.provenance, kind: "user", actor: "person:dana" },
    } as MemoryItem;
    const file = join(await tempDir(), "claims.jsonl");
    writeFileSync(file, [JSON.stringify(header), JSON.stringify(row)].join("\n"), "utf8");
    return file;
  }

  it("writes every row as import:<importer> with source import, a candidate with no grants", async () => {
    const file = await claiming();
    const b = await workspace();
    const bodies: { actor: { id: string; source?: string }; item: Record<string, unknown> }[] = [];
    const transport =
      (fetch: Fetch): Fetch =>
      async (request) => {
        if (new URL(request.url).pathname === "/api/v1/items")
          bodies.push(JSON.parse(await request.clone().text()));
        return fetch(request);
      };
    const r = await cli(["import", file, ...b.store, ...DANA, "--json"], { transport });
    expect(r.code).toBe(0);
    expect(bodies).toHaveLength(1);
    // The CLI's write sets source user; the import actor never inherits it.
    for (const body of bodies) {
      expect(body.actor).toEqual({
        id: "import:person:dana",
        level: "person",
        memberships: ["person:dana", "team:platform"],
        source: "import",
      });
      expect(body.item).toMatchObject({ status: "candidate", grants: [], version: 1 });
    }
    const write = logEvents(b.db).find((e) => e.op === "write");
    expect(write).toMatchObject({ actor: "import:person:dana", decision: "allow" });
    expect(write?.item).toMatchObject({
      owner: "person:dana",
      status: "candidate",
      grants: [],
      provenance: { kind: "import", actor: "import:person:dana" },
    });
    expect(write?.item?.provenance.ref).toMatch(/^engram-bundle:/);
    expect(write?.reason).toContain("provenance set by the plane: source import");
  });

  it("leaves a candidate the owner cannot approve: only a reviewer promotes it", async () => {
    const file = await claiming();
    const b = await workspace();
    const r = JSON.parse((await cli(["import", file, ...b.store, ...DANA, "--json"])).out);
    const id = Object.values(r.id_map)[0] as string;
    const read = await cli(["read", "changelog", ...b.store, ...DANA]);
    expect(read.out).toContain("0 items returned");
    const own = await cli(["promote", id, "--to", "person:dana", "--review", ...b.store, ...DANA]);
    expect(own.code).toBe(1);
    expect(own.out).toContain("cannot approve its own item");
    const done = await cli(["promote", id, "--to", "person:dana", "--review", ...b.store, ...SAM]);
    expect(done.code).toBe(0);
  });

  it("lets the gate decide: a scope whose rule refuses import denies the row, exit 1", async () => {
    const a = await workspace();
    await populate(a.store);
    const bundle = join(await tempDir(), "bundle.jsonl");
    writeFileSync(bundle, (await exportAs(a.store)).out, "utf8");
    const b = await workspace();
    // strict's team rule takes user, document and tool sources only.
    const r = await cli(["import", bundle, ...b.store, ...DANA, "--policy", "strict", "--json"]);
    expect(r.code).toBe(1);
    const report = JSON.parse(r.out);
    const team = report.decisions.filter((d: { decision: string }) => d.decision === "deny");
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ policy_id: "preset.strict/write/team" });
    expect(team[0].reason).toContain("source import is not allowed in team scope");
  });

  it("drops and counts a lineage pointer to a version the bundle does not hold", async () => {
    const b = await workspace();
    const file = join(REPO, "fixtures/bundles/synthetic-v1.jsonl");
    const r = await cli(["import", file, ...b.store, ...DANA, "--json"]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report).toMatchObject({ rows: 3, allowed: 3, lineage_dropped: 1 });
    const events = logEvents(b.db).filter((e) => e.op === "write");
    const last = events.at(-1)?.item;
    expect(last?.lineage).toEqual([report.id_map["01950000-0000-7000-8000-00000000a001"]]);
    expect(events.map((e) => e.item?.status)).toEqual(["retired", "candidate", "candidate"]);
  });

  /** A bundle of the one row `claiming` writes, with its kind and scope changed. */
  async function rowOf(kind: string, scope: string) {
    const file = await claiming();
    const [head, line] = readFileSync(file, "utf8").split("\n");
    const row = JSON.parse(line as string) as Row;
    row.item = {
      ...row.item,
      scope,
      grants: [],
      provenance: {
        ...row.item.provenance,
        kind,
        ...(kind === "model" || kind === "compaction" ? { model: "faux/scripted" } : {}),
      },
    } as MemoryItem;
    writeFileSync(file, `${head}\n${JSON.stringify(row)}\n`, "utf8");
    return file;
  }

  it.each([
    ["model", "source model is not allowed in team scope"],
    ["external", "source external is not allowed in team scope"],
  ])(
    "never raises trust: a %s row aimed at team scope is denied as a direct write is (E9.8-1)",
    async (kind, reason) => {
      const file = await rowOf(kind, "team:platform");
      const b = await workspace();
      const r = await cli(["import", file, ...b.store, ...DANA, "--json"]);
      expect(r.code).toBe(1);
      const [d] = JSON.parse(r.out).decisions;
      expect(d).toMatchObject({ kind, decision: "deny", policy_id: "preset.medium/write/team" });
      expect(d.reason).toContain(reason);
    },
  );

  it("never raises trust: a model row in person scope lands as a model candidate", async () => {
    const file = await rowOf("model", "person:dana");
    const b = await workspace();
    const r = await cli(["import", file, ...b.store, ...DANA, "--json"]);
    expect(r.code).toBe(0);
    const write = logEvents(b.db).find((e) => e.op === "write");
    expect(write).toMatchObject({ actor: "import:person:dana", decision: "allow" });
    expect(write?.item?.provenance).toMatchObject({ kind: "model", model: "faux/scripted" });
    expect(write?.item?.status).toBe("candidate");
  });

  it("never raises trust: under strict a compaction row is refused in person scope", async () => {
    const file = await rowOf("compaction", "person:dana");
    const b = await workspace();
    const r = await cli(["import", file, ...b.store, ...DANA, "--policy", "strict", "--json"]);
    expect(r.code).toBe(1);
    const [d] = JSON.parse(r.out).decisions;
    expect(d).toMatchObject({ kind: "compaction", policy_id: "preset.strict/write/person" });
  });

  it("under medium-trust (card E2.11's options on) the import actor's attested kind stands", async () => {
    const b = await workspace();
    const file = join(REPO, "fixtures/bundles/synthetic-v1.jsonl");
    const r = await cli(["import", file, ...b.store, ...DANA, "--policy", TRUST, "--json"]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ rows: 3, allowed: 3 });
    for (const e of logEvents(b.db).filter((x) => x.op === "write"))
      expect(e.item?.provenance.kind).toBe("import");
    const model = await rowOf("model", "person:dana");
    const c = await workspace();
    const m = await cli(["import", model, ...c.store, ...DANA, "--policy", TRUST]);
    expect(m.code).toBe(0);
    expect(logEvents(c.db).find((e) => e.op === "write")?.item?.provenance.kind).toBe("model");
  });

  it("writes every row into --scope when given", async () => {
    const b = await workspace();
    const file = join(REPO, "fixtures/bundles/synthetic-v1.jsonl");
    const r = await cli([
      "import",
      file,
      ...b.store,
      ...DANA,
      "--scope",
      "team:platform",
      "--json",
    ]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ rows: 3, allowed: 3 });
    const writes = logEvents(b.db).filter((e) => e.op === "write");
    expect(writes.map((e) => e.item?.scope)).toEqual([
      "team:platform",
      "team:platform",
      "team:platform",
    ]);
  });

  it("refuses a bundle holding one item id twice, naming the line (E9.8-2)", async () => {
    const text = readFileSync(join(REPO, "fixtures/bundles/synthetic-v1.jsonl"), "utf8");
    const [head, first, second] = text.split("\n");
    const header = JSON.parse(head as string);
    const file = join(await tempDir(), "twice.jsonl");
    writeFileSync(
      file,
      [JSON.stringify({ ...header, rows: 3 }), first, second, first, ""].join("\n"),
    );
    const b = await workspace();
    const r = await cli(["import", file, ...b.store, ...DANA]);
    expect(r.code).toBe(2);
    expect(r.err).toContain(
      "line 4: item 01950000-0000-7000-8000-00000000a001 is already on line 2",
    );
    expect(existsSync(b.db)).toBe(false);
  });

  it("refuses an input over 64 MiB before reading it", async () => {
    const dir = await tempDir();
    const big = join(dir, "big.jsonl");
    // A sparse file: its size is past the bound, its bytes never written.
    const { openSync, ftruncateSync, closeSync } = await import("node:fs");
    const fd = openSync(big, "w");
    ftruncateSync(fd, 64 * 1024 * 1024 + 1);
    closeSync(fd);
    const b = await workspace();
    for (const args of [[big], ["--claude", big]]) {
      const r = await cli(["import", ...args, ...b.store, ...DANA]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(
        "is 67108865 bytes; engram import reads files of at most 67108864 bytes (64 MiB)",
      );
    }
    expect(existsSync(b.db)).toBe(false);
  });

  it.each([
    [["import"], "give exactly one source"],
    [["import", "a.jsonl", "--claude", "b.txt"], "give exactly one source"],
    [["import", "a.jsonl", "--scope", "everywhere"], "--scope everywhere is not a scope"],
    [["import", "a.jsonl", "--confidence", "0.5"], "--confidence applies to --claude only"],
  ])("refuses %j as bad usage, exit 2", async (args, text) => {
    const r = await cli([...args, "--owner", "dana"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain(text);
  });

  it("refuses a file that is not a version 1 bundle, before any write", async () => {
    const dir = await tempDir();
    const b = await workspace();
    const cases: [string, string][] = [
      ['{"format":"engram-bundle","version":2}\n', "bundle version 2"],
      ['{"hello":1}\n', "not an Engram bundle"],
      [
        '{"format":"engram-bundle","version":1,"exported_at":"2026-10-25T12:00:00.000Z","exported_by":"person:dana","policy":"x","rows":2}\n',
        "the header counts 2 rows and the bundle holds 0",
      ],
    ];
    for (const [i, [text, message]] of cases.entries()) {
      const file = join(dir, `bad-${i}.jsonl`);
      writeFileSync(file, text, "utf8");
      const r = await cli(["import", file, ...b.store, ...DANA]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(message);
    }
    // Refused before the log was opened: nothing was written.
    expect(existsSync(b.db)).toBe(false);
  });
});

describe("encrypted bundles (age)", () => {
  async function bundled() {
    const a = await workspace();
    await populate(a.store);
    return a;
  }

  it("round-trips a bundle encrypted to a recipient key, and refuses it without the identity", async () => {
    const a = await bundled();
    const dir = await tempDir();
    const identity = await generateIdentity();
    const recipient = await identityToRecipient(identity);
    writeFileSync(join(dir, "key.txt"), `# synthetic test key\n${identity}\n`, "utf8");
    const out = join(dir, "bundle.age");
    const e = await cli(["export", "--db", a.db, ...DANA, "--out", out, "--recipient", recipient]);
    expect(e.code).toBe(0);
    expect(e.out).toContain("encrypted to 1 recipient");
    const sealed = readFileSync(out, "utf8");
    expect(sealed.startsWith("-----BEGIN AGE ENCRYPTED FILE-----")).toBe(true);
    expect(sealed).not.toContain("Dana");

    const b = await workspace();
    const none = await cli(["import", out, ...b.store, ...DANA]);
    expect(none.code).toBe(2);
    expect(none.err).toContain("encrypted with age");
    const other = join(dir, "other.txt");
    writeFileSync(other, `${await generateIdentity()}\n`, "utf8");
    const wrong = await cli(["import", out, ...b.store, ...DANA, "--identity", other]);
    expect(wrong.code).toBe(1);
    expect(wrong.err).toContain("could not be decrypted");
    const ok = await cli([
      "import",
      out,
      ...b.store,
      ...DANA,
      "--identity",
      join(dir, "key.txt"),
      "--json",
    ]);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.out)).toMatchObject({ rows: 7, allowed: 7 });
  });

  it("round-trips a bundle encrypted with a passphrase file", async () => {
    const a = await bundled();
    const dir = await tempDir();
    const pass = join(dir, "pass.txt");
    writeFileSync(pass, "synthetic correct horse battery\n", "utf8");
    const e = await cli(["export", "--db", a.db, ...DANA, "--passphrase-file", pass]);
    expect(e.code).toBe(0);
    expect(e.out.startsWith("-----BEGIN AGE ENCRYPTED FILE-----")).toBe(true);
    const file = join(dir, "bundle.age");
    writeFileSync(file, e.out, "utf8");
    const b = await workspace();
    const ok = await cli([
      "import",
      file,
      ...b.store,
      ...DANA,
      "--passphrase-file",
      pass,
      "--json",
    ]);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.out)).toMatchObject({ rows: 7, allowed: 7 });
  }, 60_000);

  it("refuses both a recipient and a passphrase", async () => {
    const a = await bundled();
    const dir = await tempDir();
    const pass = join(dir, "pass.txt");
    writeFileSync(pass, "synthetic\n", "utf8");
    const recipient = await identityToRecipient(await generateIdentity());
    const r = await cli([
      "export",
      ...["--db", a.db, ...DANA, "--passphrase-file", pass, "--recipient", recipient],
    ]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("not both");
  });
});
