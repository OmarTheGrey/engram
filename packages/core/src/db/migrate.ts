// Forward-only migrations, each applied once inside its own transaction. One
// list for every backend (ADR 0024): a migration whose text differs by dialect
// gives one text per dialect, and the rest is shared.
import type { Db, Dialect } from "./db.ts";

export interface Migration {
  id: number;
  name: string;
  up: string | Readonly<Record<Dialect, string>>;
}

/** The text of `m` for a backend speaking `dialect`. */
export function migrationText(m: Migration, dialect: Dialect): string {
  return typeof m.up === "string" ? m.up : m.up[dialect];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "event log and item projection",
    // Postgres: seq is a bigint, and ids compare bytewise (COLLATE "C"), as
    // SQLite compares text, so ORDER BY id agrees on both backends.
    up: {
      sqlite: `
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
      postgres: `
      CREATE TABLE events (
        seq BIGINT PRIMARY KEY,
        id TEXT COLLATE "C" NOT NULL UNIQUE,
        op TEXT NOT NULL,
        item_id TEXT COLLATE "C",
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
      CREATE TABLE items (id TEXT COLLATE "C" PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL);
    `,
    },
  },
  {
    id: 2,
    name: "items keyed by store_ref",
    // Several items may hold one ref: each version of an item is its own id
    // under the ref (Adapter.history), and a retired item keeps its ref, so
    // the index is not unique (decision D1 of the review fix pass). `seq` is
    // the seq of the event that last changed the item; itemByStoreRef uses it
    // to break ties between holders that lineage does not order. Rows with a
    // null ref are items not yet stored.
    up: {
      sqlite: `
      ALTER TABLE items ADD COLUMN store_adapter TEXT;
      ALTER TABLE items ADD COLUMN store_key TEXT;
      ALTER TABLE items ADD COLUMN seq INTEGER;
      UPDATE items SET
        store_adapter = json_extract(body, '$.store_ref.adapter'),
        store_key = json_extract(body, '$.store_ref.key'),
        seq = (SELECT max(e.seq) FROM events e WHERE e.item_id = items.id
               AND e.decision = 'allow'
               AND e.op IN ('write', 'update', 'promote', 'retire', 'evict'));
      CREATE INDEX items_store_ref ON items (store_adapter, store_key, seq);
    `,
      postgres: `
      ALTER TABLE items ADD COLUMN store_adapter TEXT;
      ALTER TABLE items ADD COLUMN store_key TEXT;
      ALTER TABLE items ADD COLUMN seq BIGINT;
      UPDATE items SET
        store_adapter = body::jsonb #>> '{store_ref,adapter}',
        store_key = body::jsonb #>> '{store_ref,key}',
        seq = (SELECT max(e.seq) FROM events e WHERE e.item_id = items.id
               AND e.decision = 'allow'
               AND e.op IN ('write', 'update', 'promote', 'retire', 'evict'));
      CREATE INDEX items_store_ref ON items (store_adapter, store_key, seq);
    `,
    },
  },
  {
    id: 3,
    name: "explanations keyed by read event",
    // One row per item a read returned (card E2.2, ADR 0009), written in the
    // transaction that appends the read event, so explain(readId) returns
    // exactly what that read returned. Not a projection: the query text and
    // the policy in force are not in the log, so rebuild() leaves it alone.
    up: `
      CREATE TABLE explanations (
        read_id TEXT NOT NULL REFERENCES events (id),
        rank INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        body TEXT NOT NULL,
        PRIMARY KEY (read_id, rank)
      );
    `,
  },
  {
    id: 4,
    name: "schema version 1: read events carry their returned item ids",
    // Upgrades a version 0 log to schema version 1 (schema.ts): every stored
    // event, item and explanation, and the item an event carries, says
    // version 1; and every read event gets `item_ids`, the items it returned
    // in rank order, from its explanation rows (migration 3 wrote one per
    // returned item in the read's own transaction, so they are exactly what
    // it returned). Version 1 changes no other field, so nothing else is
    // rewritten. The `external` provenance kind is new and appears in no
    // version 0 record.
    up: {
      sqlite: `
      UPDATE events SET body = json_set(body, '$.schema_version', 1);
      UPDATE events SET body = json_set(body, '$.item.schema_version', 1)
        WHERE json_type(body, '$.item') = 'object';
      UPDATE events SET body = json_set(body, '$.item_ids', json((
          SELECT json_group_array(x.item_id ORDER BY x.rank)
          FROM explanations x WHERE x.read_id = events.id)))
        WHERE op = 'read';
      UPDATE items SET body = json_set(body, '$.schema_version', 1);
      UPDATE explanations SET body = json_set(body, '$.schema_version', 1);
    `,
      postgres: `
      UPDATE events SET body = jsonb_set(body::jsonb, '{schema_version}', '1')::text;
      UPDATE events SET body = jsonb_set(body::jsonb, '{item,schema_version}', '1')::text
        WHERE jsonb_typeof(body::jsonb -> 'item') = 'object';
      UPDATE events SET body = jsonb_set(body::jsonb, '{item_ids}', coalesce((
          SELECT jsonb_agg(x.item_id ORDER BY x.rank)
          FROM explanations x WHERE x.read_id = events.id), '[]'::jsonb))::text
        WHERE op = 'read';
      UPDATE items SET body = jsonb_set(body::jsonb, '{schema_version}', '1')::text;
      UPDATE explanations SET body = jsonb_set(body::jsonb, '{schema_version}', '1')::text;
    `,
    },
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
      db.exec(migrationText(m, db.dialect));
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(m.id, m.name);
    });
    applied.push(m.id);
  }
  return applied;
}
