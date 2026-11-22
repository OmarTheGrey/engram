# The memory bundle, version 1

A bundle is how a person's memories leave Engram and come back in (card E9.8, decision item 55 of `docs/tasks/lead-decisions.md`). `engram export` writes one, `engram import` reads one. Portability is what Article 20 of the GDPR asks for, and a new user arrives with memories somewhere else.

## What is in it

The rows are chosen by core (`bundleRows`, `packages/core/src/portable.ts`), never by a surface:

- every item in the exporting actor's own person scope (the scope whose id is the actor's id), whoever wrote it there;
- the actor's own items (`owner` is the actor) in every other scope the read matrix lets the actor read: a member of the scope, at a level its own level may read;
- of every status: active, candidate and retired. A retired version is the history a later version's lineage names.

Another member's item in a shared scope is never in it, and neither is anything in a scope the actor does not belong to or may not read at its level. Export writes no item, and records itself (`Plane.export`, review finding E9.8-3): one `read` event by the exporter, of decision allow under its read matrix rule, naming no item and no scope, so only its maker sees it, with a reason that counts the rows and events and names the policy (`exported <n> items with <m> events as a bundle under <policy> v<version>: ...`). It carries no `item_ids`, so an export never counts toward an item's utility (ADR 0025).

## The file

JSONL in UTF-8: one JSON object per line, a final newline. The first line is the header:

```json
{"format":"engram-bundle","version":1,"exported_at":"2026-11-21T12:00:00.000Z","exported_by":"person:dana","policy":"preset.medium v1","rows":3}
```

| field | meaning |
|---|---|
| `format` | always `engram-bundle` |
| `version` | the format version, `1`; an importer refuses any other |
| `exported_at` | the server's clock at the export, UTC ISO 8601 |
| `exported_by` | the actor id that exported |
| `policy` | the policy the rows were chosen under, `<id> v<version>` |
| `rows` | how many rows follow; an importer refuses a bundle that holds another number |

Every other line is one row, ordered by item id (a UUIDv7: the order the plane minted them in, unless a caller chose an id). An importer refuses a bundle that holds one item id twice, naming both lines, and a file over 64 MiB, before reading it.

```json
{"item":{...a MemoryItem...},"events":[{...a MemoryEvent without "item"...}]}
```

- `item` is the item as the plane's projection holds it: a `MemoryItem` of `sdk/schema/MemoryItem.json`, schema version 1, with its provenance, validity window (`valid_from`, `valid_to`, `ttl`), lineage, grants and status.
- `events` are the events naming the item's id that the actor may see (`eventVisibleTo`, `packages/core/src/visible.ts`), in log order, each a `MemoryEvent` of `sdk/schema/MemoryEvent.json` without its `item` field. The row already holds the item as it stands, and an earlier state may hold content a later version took out.

The HTTP route `POST /api/v1/export` answers with the same header fields and a `rows` list (`ExportResponse` in `sdk/openapi.json`); the CLI writes that as the lines above.

## Encryption

`engram export --recipient <age1...>` (repeatable) or `--passphrase-file <file>` encrypts the bundle with [age](https://age-encryption.org/v1) through typage (`age-encryption`, pinned in `docs/deps.md`) and writes it ASCII armored, starting `-----BEGIN AGE ENCRYPTED FILE-----`. `engram import` recognises an armored or binary age file and decrypts it with `--identity <file>` (lines `AGE-SECRET-KEY-1...`, `#` comments allowed) or `--passphrase-file <file>`. A passphrase is read from the first line of a file, never from a flag, which a shell history would keep. The standard `age` tool reads and writes the same files.

## What an import does with a row

A bundle never states its own trust, as adoption never raises trust (ADR 0004, its amendments of card RV4 and of 2026-11-21). Each row is one `Plane.write` through the write route, and the gate decides it:

- **The actor** is the dedicated import actor `import:<importer>` (for `--owner dana`, `import:person:dana`): at the importer's level, a member of exactly the importer's scopes. Its source is the least trusted of the kind the row claims and `import` (core's `importedWrite`, `packages/core/src/portable.ts`; review finding E9.8-1), as adoption records a record it did not write (ADR 0004, amendment of card RV4). So a row may claim `user`, `document` or `import` and is recorded `import`; a `tool`, `model`, `compaction` or `external` row keeps its kind, and the gate's rules for that kind hold for it as for a direct write: a model or external row aimed at a team scope is refused there, model content never leaves person scope, and none of it may restate retired content. The plane records that kind with the import actor as provenance actor (ADR 0004, decision D4); a model or compaction row keeps the `model` it names.
- **The owner** is the importer. The import actor is the author, so the importer, who owns the row, cannot approve its promotion (ADR 0026: neither owner nor author approves).
- **Status** `candidate`, whatever the row says; a retired row stays `retired`, never more. No read returns a candidate until a reviewer promotes it (`engram promote <id> --to <scope> --review`, by a user-sourced member of the scope who is not its owner).
- **Grants** are dropped. The owner adds them again after review.
- **A new id**, version 1, `store_ref` null. Provenance `ref` is `engram-bundle:<the row's old id>`.
- **Content, class, confidence and validity** are the row's.
- **Lineage** is mapped onto the new ids: rows are written so that each comes after the rows its lineage names, and a pointer to a row imported earlier takes that row's new id. A pointer to a version the bundle does not hold, or to a row the gate denied, is dropped and counted (`lineage_dropped`).
- **Scope** is the row's own, or `--scope <scope>` for every row.
- **What decides** is core: the CLI parses the file and makes one write call per row with the actor and item `importedWrite` returns (AGENTS.md rule 1).
- **Over `--server`**, a credential's source replaces the one the CLI sends (ADR 0042), so the server's write and check routes map any write whose bound actor's source is `import` the same way, in core (`servedImport`, findings E9.8-8 and the one before it): the kind the least trusted of the item's claim, the kind the plane already holds for its id, and `import` (as adoption's `adoptedItem`), so a rewrite never raises an agent's `model` item; status candidate unless retired; no grants; owner the importer. A client, or an import key, can only lower trust.

The events in a row are carried for the record and are not replayed: the new workspace's log records the import's own decisions. `engram import --json` prints the id map from each old id to its new one.

The round trip holds (`packages/cli/test/import-export.test.ts`): export, import into an empty workspace, promote, export again, and the content and validity come back equal, and the lineage equal under the id map.

## A pasted Claude memory list

`engram import --claude <file>` reads the text Claude shows a person as their memory, pasted into a file. Claude fixes no format (its help centre, support.claude.com article 12123587): a person views their memory in Settings or asks Claude to write it out, and copies the text. The parser (`packages/cli/src/import/claude.ts`) reads only the lines inside code fences when the text holds one (Claude's remarks around the block are not memories); a heading names a section; each bullet, each `[date] - content` line and each paragraph is one memory; an ISO date becomes its `valid_from`, unless it is after the import time, when the import time is and the report says so. A pasted memory is recorded as kind `import`. Every memory is a `semantic` candidate in the importer's person scope (or `--scope`) at confidence 0.7 (or `--confidence`), written by the import actor as above, with `ref` `claude-memory:<section>:line-<n>`.

There is no ChatGPT parser: no ChatGPT export has been seen to contain saved memories (`docs/log/2026-11-21-e9-8-decision-no-chatgpt-parser.md`).

## Changing the format

A change a version 1 reader would misread is version 2, with this document updated and the importer reading both or refusing the old one with a message. A field added to `MemoryItem` or `MemoryEvent` follows the schema's own rule (AGENTS.md rule 5).
