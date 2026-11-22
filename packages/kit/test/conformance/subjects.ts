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
    // Writes through the plane, but as the caller's actor with its own source
    // (user), not through the kit, which would make it model (E8.14-2).
    subject: variant("keeps source", (options: KitOptions) => {
      const inner = reference.create(options);
      let n = 0;
      return {
        async write(input) {
          const at = options.now();
          const answer = await options.client.POST("/api/v1/items", {
            body: {
              actor: options.actor,
              item: {
                id: options.newId(),
                class: "semantic",
                scope: String(input.scope),
                owner: options.actor.id,
                content: String(input.content),
                provenance: {
                  kind: "user",
                  ref: `keeps-source:${++n}`,
                  hash: `sha256:${"0".repeat(64)}`,
                  actor: options.actor.id,
                },
                confidence: 0.5,
                valid_from: at,
                valid_to: null,
                ttl: null,
                grants: [],
                version: 1,
                lineage: [],
                status: "active",
                store_ref: null,
                schema_version: 1,
              },
            },
          });
          const event = answer.data?.event;
          if (answer.data?.item === null && event) throw new EngramRejected(event);
          return answer.data?.item;
        },
        read: inner.read,
      };
    }),
    fails: "model output cannot change the actor, its source or the item's provenance",
  },
  {
    // Shows the model nothing it read.
    subject: variant("reads nothing", (options: KitOptions) => ({
      write: reference.create(options).write,
      read: async () => "",
    })),
    fails: "a read shows the reader's own memory and nothing another person's scope holds",
  },
  {
    // A package that depends on and imports a store, the server and pi, and
    // fetches a built-in module at run time.
    subject: variant("imports a store", reference.create, BYPASSING_ROOT),
    fails: "its dependency closure and imports reach no store and no pi",
  },
];
