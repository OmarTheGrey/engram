// Acceptance for step-0 task S0.8 (layer 3, replay): for any sequence of
// events, the item projection maintained incrementally by appendEvent equals
// the projection rebuilt from the event log alone.
import fc from "fast-check";
import { expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent, currentItems, rebuild } from "../../src/events.ts";
import { arbEventInput, arbId, seedFor } from "../generators.ts";

const NAME = "rebuild equals incremental for any event sequence";

test(NAME, () => {
  const sequences = fc
    .uniqueArray(arbId, { minLength: 1, maxLength: 4 })
    .chain((ids) => fc.array(arbEventInput(ids), { maxLength: 30 }));
  fc.assert(
    fc.property(sequences, (events) => {
      const db = openSqlite(":memory:");
      migrate(db);
      events.forEach((e, i) => {
        appendEvent(db, { ...e, id: `${e.id.slice(0, 24)}${String(i).padStart(12, "0")}` });
      });
      const incremental = currentItems(db);
      rebuild(db);
      expect(currentItems(db)).toEqual(incremental);
      db.close();
    }),
    { numRuns: 500, seed: seedFor(NAME) },
  );
});
