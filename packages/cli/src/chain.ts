// The CLI keeps the event log's hash chain (card E1.6, ADR 0038): every
// command that opens the log in process (connect.ts, serve.ts, log.ts) makes
// its handle one that keeps the chain, with salts from node:crypto, and so
// begins the chain on a log that has none. Core draws no randomness; this is
// where the salts come from.
import { randomBytes } from "node:crypto";
import { type Db, keepChain } from "@engram/core";

/** Makes `db` a handle that keeps the chain, beginning it if it has not begun. */
export function keepLogChain(db: Db): void {
  keepChain(db, { salt: () => randomBytes(32) });
}
