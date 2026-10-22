// Forward-only migrations, each applied once inside its own transaction.
import type { Db } from "./db.ts";

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "event log and item projection",
    up: `
      CREATE TABLE events (
        seq INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        op TEXT NOT NULL,
        item_id TEXT,
        actor TEXT NOT NULL,
        scope_from TEXT,
        scope_to TEXT,
        decision TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE INDEX events_item ON events (item_id, seq);
      CREATE INDEX events_actor ON events (actor, seq);
      CREATE INDEX events_scope_from ON events (scope_from, seq);
      CREATE INDEX events_scope_to ON events (scope_to, seq);
      CREATE TABLE items (id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL);
    `,
  },
];

/** Applies pending migrations in id order; returns the ids it applied. */
export function migrate(db: Db, migrations: readonly Migration[] = MIGRATIONS): number[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
  );
  const done = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((r) => r.id),
  );
  const applied: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (done.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.up);
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(m.id, m.name);
    });
    applied.push(m.id);
  }
  return applied;
}
