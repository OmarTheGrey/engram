// visibleEvents leaks nothing (plan decision 5): over generated logs and
// viewers, every event returned was made by the viewer or names a scope the
// viewer is a member of, and every such event is returned, in log order. In
// particular an event that names no scope (a read, a bypass) reaches only the
// actor who made it.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { MemoryEvent } from "../../src/schema.ts";
import { visibleEvents } from "../../src/visible.ts";
import { arbActor, arbEventInput, arbId, seedFor } from "../generators.ts";

const RUNS = 1000;

const arbLog = fc
  .uniqueArray(arbId, { minLength: 1, maxLength: 3 })
  .chain((ids) => fc.array(arbEventInput(ids), { maxLength: 30 }))
  .map((inputs) => inputs.map((e, seq) => ({ ...e, seq }) as MemoryEvent));

const allowed = (viewer: { id: string; memberships: string[] }, e: MemoryEvent) =>
  e.actor === viewer.id ||
  (e.scope_from !== null && viewer.memberships.includes(e.scope_from)) ||
  (e.scope_to !== null && viewer.memberships.includes(e.scope_to));

describe("visibleEvents", () => {
  const name = "returns exactly the viewer's own events and those naming a member scope";
  test(name, () => {
    fc.assert(
      fc.property(arbActor, arbLog, (viewer, log) => {
        const seen = visibleEvents(viewer, log);
        for (const e of seen) expect(allowed(viewer, e)).toBe(true);
        expect(seen).toEqual(log.filter((e) => allowed(viewer, e)));
      }),
      { numRuns: RUNS, seed: seedFor(name) },
    );
  });

  const unscoped = "shows an event that names no scope to its maker only";
  test(unscoped, () => {
    fc.assert(
      fc.property(arbActor, arbLog, (viewer, log) => {
        for (const e of visibleEvents(viewer, log))
          if (e.scope_from === null && e.scope_to === null) expect(e.actor).toBe(viewer.id);
      }),
      { numRuns: RUNS, seed: seedFor(unscoped) },
    );
  });
});
