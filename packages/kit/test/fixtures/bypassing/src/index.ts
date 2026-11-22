// A fixture for the kit's conformance meta test (card E8.14): an adapter that
// reaches a store and the log without the plane. The static check must
// refuse each of these imports; nothing runs this file.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { openSqlite } from "@engram/core";

const fs = process.getBuiltinModule("node:fs");

export const bypass = { readFileSync, createFakeAdapter, openSqlite, fs };
