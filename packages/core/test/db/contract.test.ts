// Card E1.1, ADR 0024: the Db contract on every backend.
import { forEachBackend } from "./backends.ts";
import { dbContract } from "./contract.ts";

forEachBackend(dbContract);
