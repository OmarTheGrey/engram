// Card L1 (layer 3, replay): lint events change no item. After Plane.lint
// has appended its findings over a fault fixture, the projection is what it
// was before, rebuilding it from the log alone gives the same items, and
// replaying the log to the seq before the lint and to its end agree.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { FaultFixture } from "../../scripts/faults.ts";
import { appendEvent, currentItems, rebuild } from "../../src/events.ts";
import { itemsAt } from "../../src/replay.ts";
import { fresh } from "../unit/plane/helpers.ts";

const FAULTS = join(import.meta.dirname, "../../../../fixtures/faults");

for (const name of ["orphan.flag", "source-changed.flag", "duplicate.flag"]) {
  test(`lint events over ${name} leave the projection and its replay unchanged`, async () => {
    const f = JSON.parse(readFileSync(join(FAULTS, `${name}.json`), "utf8")) as FaultFixture;
    const { db, plane } = fresh(f.policy);
    for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
    const before = currentItems(db);
    const lastSeq = f.events.length - 1;

    const report = await plane.lint(f.actor, f.at, f.scope);
    expect(report.events.length).toBeGreaterThan(0);
    expect(report.events.every((e) => e.op === "lint" && e.item === undefined)).toBe(true);

    expect(currentItems(db)).toEqual(before);
    rebuild(db);
    expect(currentItems(db)).toEqual(before);
    const end = plane.events().at(-1)?.seq ?? -1;
    expect(itemsAt(db, end)).toEqual(itemsAt(db, lastSeq));
  });
}
