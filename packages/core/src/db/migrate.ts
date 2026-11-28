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
  {
    id: 5,
    name: "the event log's hash chain",
    // Card E1.6, ADR 0038 (log/chain.ts). Side tables only: no event body,
    // item or explanation changes, and the chain begins later, when a handle
    // first keeps it (keepChain), at the next seq. `chain`: one entry per
    // position, the genesis at 0, then events (seq set, data their
    // commitments) and offboarding manifests (data the record), each with
    // its chain hash. `chain_salts`: one salt per event with committed parts,
    // deleted by an erasure. `chain_head`: the one anchor row (head hash,
    // entry count, last chained seq). `chain_checkpoints`: checkpoints of the
    // head, signed or not. Independent of every other migration's tables, so
    // it applies before or after a later one (card E8.12's 6).
    up: {
      sqlite: `
      CREATE TABLE chain (
        pos INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        seq INTEGER UNIQUE,
        data TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE TABLE chain_salts (seq INTEGER PRIMARY KEY, salt TEXT NOT NULL);
      CREATE TABLE chain_head (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        size INTEGER NOT NULL,
        hash TEXT NOT NULL,
        seq INTEGER NOT NULL
      );
      CREATE TABLE chain_checkpoints (
        n INTEGER PRIMARY KEY,
        size INTEGER NOT NULL,
        root TEXT NOT NULL,
        head TEXT NOT NULL,
        at TEXT NOT NULL,
        note TEXT NOT NULL,
        key TEXT,
        signature TEXT
      );
    `,
      postgres: `
      CREATE TABLE chain (
        pos BIGINT PRIMARY KEY,
        kind TEXT NOT NULL,
        seq BIGINT UNIQUE,
        data TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE TABLE chain_salts (seq BIGINT PRIMARY KEY, salt TEXT NOT NULL);
      CREATE TABLE chain_head (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        size BIGINT NOT NULL,
        hash TEXT NOT NULL,
        seq BIGINT NOT NULL
      );
      CREATE TABLE chain_checkpoints (
        n BIGINT PRIMARY KEY,
        size BIGINT NOT NULL,
        root TEXT NOT NULL,
        head TEXT NOT NULL,
        at TEXT NOT NULL,
        note TEXT NOT NULL,
        key TEXT,
        signature TEXT
      );
    `,
    },
  },
  {
    // Card E8.12, ADR 0042 decision 8. Id 5 is card E1.6's (the hash chain),
    // landing in parallel; the runner applies ids in order and skips any
    // already applied, so the gap is harmless.
    id: 6,
    name: "event attestations: who a served HTTP surface authenticated",
    // One row per event appended while `engram serve` or `engram mcp --http`
    // handled a request, written in the transaction that appends the event
    // (packages/server/src/attest.ts): the surface, how the requester was
    // authenticated (`jwt`, `api_key`, or `insecure_loopback` for the
    // waiver), the requester's actor id, and the issuer and subject (an API
    // key's id). Beside the event, so the event schema does not change
    // (AGENTS.md rule 5). Not a projection: rebuild() leaves it alone. It
    // holds identifiers only, never content.
    up: {
      sqlite: `
      CREATE TABLE event_attestations (
        seq INTEGER PRIMARY KEY REFERENCES events (seq),
        event_id TEXT NOT NULL UNIQUE,
        surface TEXT NOT NULL,
        method TEXT NOT NULL,
        actor TEXT NOT NULL,
        issuer TEXT,
        subject TEXT
      );
    `,
      postgres: `
      CREATE TABLE event_attestations (
        seq BIGINT PRIMARY KEY REFERENCES events (seq),
        event_id TEXT COLLATE "C" NOT NULL UNIQUE,
        surface TEXT NOT NULL,
        method TEXT NOT NULL,
        actor TEXT NOT NULL,
        issuer TEXT,
        subject TEXT
      );
    `,
    },
  },
  {
    // Card E9.11, ADR 0051 (crypto/keys.ts). One row per data key of a person
    // scope: its version, the id of the operator key that wraps it, the wrap
    // algorithm, the wrapped bytes (hex) and when it was made. Shredding sets
    // `wrapped` to NULL and `shredded_at`, keeping the row as a content-free
    // tombstone. Never the data key itself. A side table, so no event body,
    // item or explanation changes and schema_version stays (AGENTS.md rule
    // 5). Not a projection: rebuild() leaves it alone. Independent of every
    // other migration's tables.
    id: 7,
    name: "per-person data keys for crypto-shredded erasure",
    up: {
      sqlite: `
      CREATE TABLE data_keys (
        scope TEXT NOT NULL,
        version INTEGER NOT NULL,
        kek TEXT NOT NULL,
        alg TEXT NOT NULL,
        wrapped TEXT,
        created_at TEXT NOT NULL,
        shredded_at TEXT,
        PRIMARY KEY (scope, version)
      );
    `,
      postgres: `
      CREATE TABLE data_keys (
        scope TEXT COLLATE "C" NOT NULL,
        version INTEGER NOT NULL,
        kek TEXT NOT NULL,
        alg TEXT NOT NULL,
        wrapped TEXT,
        created_at TEXT NOT NULL,
        shredded_at TEXT,
        PRIMARY KEY (scope, version)
      );
    `,
    },
  },
];

/**
 * Applies pending migrations in id order; returns the ids it applied.
 *
 * Safe when several processes open one fresh log at once (card E1.9): the
 * migrations table is created, and each migration re-read and applied, inside
 * a transaction, which holds the log's lock (SQLite: BEGIN IMMEDIATE;
 * Postgres: the log's advisory lock, transaction.ts). A migration another
 * process applied after this one first read the table is skipped, not
 * applied twice, and is not in the ids returned. Every call takes the lock
 * once, for the table's creation, even on an up-to-date log; the first read
 * of the table, outside any transaction, spares such a log a lock per
 * migration. The wait is bounded: a racer behind a migration slower than the
 * busy timeout (SQLite, 5 s) or the statement timeout (Postgres) fails rather
 * than waits.
 */
export function migrate(db: Db, migrations: readonly Migration[] = MIGRATIONS): number[] {
  const create =
    "CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL)";
  const ids = () =>
    new Set(
      db
        .prepare("SELECT id FROM schema_migrations")
        .all()
        .map((r) => Number(r.id)),
    );
  // Two concurrent CREATE TABLE IF NOT EXISTS can both find the table absent
  // on Postgres, and the second then fails on the catalogue; under the lock
  // the second finds it.
  db.transaction(() => db.exec(create));
  const seen = ids();
  const applied: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (seen.has(m.id)) continue;
    const ran = db.transaction(() => {
      if (ids().has(m.id)) return false;
      db.exec(migrationText(m, db.dialect));
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(m.id, m.name);
      return true;
    });
    if (ran) applied.push(m.id);
  }
  return applied;
}
