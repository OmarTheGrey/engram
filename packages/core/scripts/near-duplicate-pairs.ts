// Card L5: what research/scripts/near_duplicate.py checks against datasketch.
// For every fixture of the fault catalogue (fixtures/faults/*.json, the
// deterministic lints' fixtures), Plane.lint runs the near-duplicate tier
// alone over the fixture's scope, and every pair of the scope's active items
// of one class with distinct strict hashes is written out with its shingles,
// its exact Jaccard similarity and this tier's MinHash estimate, so the
// script can hash the same shingles with datasketch. No model, no network.
//
//   node packages/core/scripts/near-duplicate-pairs.ts --faults <dir> --threshold <t> --out <file>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter } from "@engram/adapters";
import { strictContentHash } from "../src/content-hash.ts";
import { migrate } from "../src/db/migrate.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { appendEvent, currentItems } from "../src/events.ts";
import {
  comparableText,
  estimate,
  findNearDuplicates,
  jaccard,
  shingleKind,
  shingles,
  signature,
  tokens,
} from "../src/lint/near-duplicate.ts";
import { createPlane } from "../src/plane.ts";
import type { FaultFixture } from "./faults.ts";

async function fixtureRows(name: string, f: FaultFixture, threshold: number) {
  const db = openSqlite(":memory:");
  migrate(db);
  for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
  const policy = {
    ...f.policy,
    lints: { enabled: ["near-duplicate-tier"], thresholds: { "near-duplicate": threshold } },
  };
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: () => `01950000-0000-7000-8000-${String(990_000 + ++n).padStart(12, "0")}`,
  });
  const report = await plane.lint(f.actor, f.at, f.scope);
  const flagged = report.findings.map((x) => ({
    item: x.item_id,
    of: (x.evidence[0] ?? "").replace("near-duplicate of ", ""),
  }));
  const active = currentItems(db)
    .filter((i) => i.scope === f.scope && i.status === "active")
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  db.close();
  const pairs = [];
  for (let j = 0; j < active.length; j++)
    for (let i = 0; i < j; i++) {
      const a = active[i];
      const b = active[j];
      if (a === undefined || b === undefined || a.class !== b.class) continue;
      if (strictContentHash(a.content) === strictContentHash(b.content)) continue;
      const ta = tokens(comparableText(a.content));
      const tb = tokens(comparableText(b.content));
      if (ta.length === 0 || tb.length === 0) continue;
      const kind = shingleKind(Math.min(ta.length, tb.length));
      const sa = shingles(ta, kind);
      const sb = shingles(tb, kind);
      pairs.push({
        earlier: a.id,
        later: b.id,
        kind,
        shingles: [[...sa].sort(), [...sb].sort()],
        jaccard: jaccard(sa, sb),
        estimate: estimate(signature(sa), signature(sb)),
      });
    }
  return {
    fixture: name,
    lint_id: f.lint_id,
    kind: f.kind,
    labelled_flags: f.lint_id === "near-duplicate-tier" ? f.flags : null,
    active: active.length,
    flagged,
    // What the pass did over the same items the lint read: candidates, vetoes,
    // and the items the candidate cap cut (review finding L5-R3).
    stats: findNearDuplicates(active, threshold, (i) => strictContentHash(i.content)).stats,
    pairs,
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { faults: { type: "string" }, threshold: { type: "string" }, out: { type: "string" } },
  });
  if (!values.faults || !values.threshold || !values.out) {
    console.error("usage: near-duplicate-pairs.ts --faults <dir> --threshold <t> --out <file>");
    return 2;
  }
  const threshold = Number(values.threshold);
  const rows = [];
  for (const file of readdirSync(values.faults)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    const f = JSON.parse(readFileSync(join(values.faults, file), "utf8")) as FaultFixture;
    rows.push(await fixtureRows(file.replace(/\.json$/, ""), f, threshold));
  }
  writeFileSync(values.out, `${JSON.stringify(rows)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith("near-duplicate-pairs.ts")) process.exitCode = await main();
