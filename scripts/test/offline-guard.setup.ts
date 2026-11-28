// A setup file of every test project (vitest.shared.ts): under ENGRAM_OFFLINE=1
// it installs the offline guard (offline-guard.ts) once per worker, before any
// test file is loaded.
import { installForRun } from "./offline-guard.ts";

installForRun();
