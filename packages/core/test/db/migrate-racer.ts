// A process for the first-migration race (card E1.9, migrate-race.test.ts):
// it opens a fresh log, waits until every racer is connected, migrates it at
// once, and prints one JSON line with the ids it applied and the error, if
// any. The barrier is a `ready` table the test created before the log.
// After the barrier each racer waits its own delay, so the rounds of the test
// sweep the window in which one racer reads the migrations table while
// another is inside a migration.
// Usage: node migrate-racer.ts sqlite <path> <racer> <racers> <delay ms>
//        node migrate-racer.ts postgres <url> <racer> <racers> <delay ms> <schema>
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openPostgres } from "../../src/db/postgres.ts";
import { openSqlite } from "../../src/db/sqlite.ts";

const [backend = "", target = "", racer = "1", racersArg = "2", delay = "0", schema = ""] =
  process.argv.slice(2);
const racers = Number(racersArg);

let applied: number[] = [];
let error: string | undefined;
let db: Db | undefined;
try {
  db = backend === "postgres" ? openPostgres(target, { schema }) : openSqlite(target);
  db.prepare("INSERT INTO ready VALUES (?)").run(racer);
  const deadline = Date.now() + 20_000;
  while (Number(db.prepare("SELECT count(*) AS n FROM ready").get()?.n) < racers) {
    // Spin until every racer is connected, so the migrations overlap.
    if (Date.now() > deadline) throw new Error("the other racers never connected");
  }
  const start = Date.now();
  while (Date.now() - start < Number(delay)) {
    // This racer's delay.
  }
  applied = migrate(db);
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
} finally {
  db?.close();
}
process.stdout.write(`${JSON.stringify({ racer, applied, error })}\n`);
