// The adapters the kit's conformance test runs the suite on (card E8.14):
// the reference adapter, the smallest adapter the kit allows (a page, as the
// card asks of every adapter), and broken ones, each with the case that must
// catch it, so a weakened case shows up (the shape of packages/adapters'
// meta test, review finding R4-1).
import { fileURLToPath } from "node:url";
import { createKit, EngramRejected, type KitOptions } from "../../src/index.ts";
import type { KitAdapterSubject } from "./suite.ts";

const KIT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BYPASSING_ROOT = fileURLToPath(new URL("../fixtures/bypassing", import.meta.url));

/** The reference adapter: model input to the kit, the kit's answer back. */
export const reference: KitAdapterSubject = {
  name: "reference",
  root: KIT_ROOT,
  create(options) {
    const kit = createKit(options);
    let calls = 0;
    return {
      write: (input) =>
        kit.remember({
          content: String(input.content),
          scope: String(input.scope),
          ref: `reference:call/${++calls}`,
        }),
      read: async (input) => (await kit.recall(String(input.query))).text,
    };
  },
};

/** A broken adapter and the case (by name, after the subject's) that must fail on it. */
export interface Broken {
  subject: KitAdapterSubject;
  fails: string;
}

const variant = (
  name: string,
  create: KitAdapterSubject["create"],
  root = KIT_ROOT,
): KitAdapterSubject => ({ name, root, create });

export const BROKEN: Broken[] = [
  {
    // Takes the actor from the tool call when the model names one.
    subject: variant("trusts model actor", (options: KitOptions) => {
      const bound = reference.create(options);
      return {
        write: (input) =>
          input.actor
            ? reference
                .create({ ...options, actor: input.actor as KitOptions["actor"] })
                .write(input)
            : bound.write(input),
        read: bound.read,
      };
    }),
    fails: "model output cannot change the actor, its source or the item's provenance",
  },
  {
    // Reads the actor object at each call instead of fixing it at construction.
    subject: variant("late-bound actor", (options: KitOptions) => ({
      write: (input) => reference.create(options).write(input),
      read: (input) => reference.create(options).read(input),
    })),
    fails: "model output cannot change the actor, its source or the item's provenance",
  },
  {
    // Swallows a refusal and reports success.
    subject: variant("swallows refusals", (options: KitOptions) => {
      const inner = reference.create(options);
      return {
        write: (input) =>
          inner.write(input).catch((e: unknown) => {
            if (e instanceof EngramRejected) return null;
            throw e;
          }),
        read: inner.read,
      };
    }),
    fails: "a denied write surfaces as EngramRejected carrying the log's deny event",
  },
  {
    // Turns the typed rejection into a plain error.
    subject: variant("untyped refusals", (options: KitOptions) => {
      const inner = reference.create(options);
      return {
        write: (input) =>
          inner.write(input).catch((e: unknown) => {
            throw new Error(String(e));
          }),
        read: inner.read,
      };
    }),
    fails: "a denied write surfaces as EngramRejected carrying the log's deny event",
  },
  {
    // A package that depends on and imports a store adapter.
    subject: variant("imports a store", reference.create, BYPASSING_ROOT),
    fails: "its package and source reach no store except through the client",
  },
];
