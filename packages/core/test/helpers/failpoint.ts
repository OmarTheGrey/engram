// Failpoints for the Plane's crash windows (card E1.4): fail, stop, pause or
// skip at a named step of one handle's Db and store, from the test side, so
// a window two adjacent calls apart (the store written, the event not yet
// appended) gets a deterministic test. Core's source is not touched: the
// points sit where core already calls out, at the adapter's methods and at
// the Db's outermost transaction.
//
// Ported from EverOS (https://github.com/EverMind-AI/EverOS), file
// src/everos/core/failpoints.py at commit
// e5778edb4cbac71e359ea375f38cf805aae32b0c, Apache-2.0 (docs/absorbed.md,
// mode port). Taken: the design of a test-only point named by its step and
// its four modes: a hard kill with no cleanup, raise the first n times,
// pause until released, and skip the step. Rewritten in TypeScript for one
// process: the kill is a dead handle (the call that reaches the point and
// every later call through that handle's Db and store throws Crashed, so no
// catch block of the plane can record anything, as after exit 137), a pause
// is released by a call rather than a file, and points are armed per handle
// by a call rather than read from an environment variable. Its tests are
// ported in test/unit/plane/crash-windows.test.ts ("the failpoint helper").
//
// Points:
// - `store.write`, `store.delete`, `store.list`, `store.read`, each `:before`
//   (the store not yet called) or `:after` (the store call returned; for a
//   write, the bytes are in the store);
// - `commit:before`, inside the handle's outermost transaction once its body
//   has run, before the commit: a throw here rolls the transaction back;
//   `commit:after`, once it committed, before the caller sees its result.
//   A commit point is synchronous, as EverOS's `failpoint` is: only `crash`
//   and `raise` apply there. Its hit lists the events the transaction
//   appended, so a test can name the window by what the commit records.
import type { Adapter, StoreRef } from "../../src/adapter.ts";
import type { Db, Statement } from "../../src/db/db.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";

export type StorePoint = `store.${"write" | "delete" | "list" | "read"}:${"before" | "after"}`;
export type CommitPoint = `commit:${"before" | "after"}`;
export type Point = StorePoint | CommitPoint;

/**
 * - `crash`: the handle dies at the point (EverOS's bare name, exit 137);
 * - `{ raise: n }`: the first n hits throw FailpointError, then the point passes;
 * - `pause`: the call waits at the point until the armed point is released;
 * - `skip`: the store call is not made and returns as if it had been
 *   (`delete` does nothing, `read` finds nothing, `list` lists nothing);
 *   `:before` points of delete, read and list only.
 */
export type Mode = "crash" | "pause" | "skip" | { raise: number };

/** What a point saw when it was reached. */
export interface Hit {
  point: Point;
  /** How many times this point was reached on this handle, this hit included. */
  n: number;
  item?: MemoryItem;
  ref?: StoreRef;
  scope?: string;
  /** For a commit point: the events the transaction appended. */
  appended: MemoryEvent[];
}

/** The error of a handle that died at a failpoint, and of every later call through it. */
export class Crashed extends Error {
  constructor(point: string) {
    super(`the handle crashed at failpoint ${point}`);
    this.name = "Crashed";
  }
}

/** The error a `raise` point throws; the handle stays alive. */
export class FailpointError extends Error {
  constructor(point: string) {
    super(`failpoint ${point}`);
    this.name = "FailpointError";
  }
}

export interface Armed {
  /** Resolves with the hit when the point first fires. */
  arrived: Promise<Hit>;
  /** Lets a paused call go on. */
  release(): void;
  /** How many times the point fired. */
  readonly fired: number;
}

interface Arming {
  point: Point;
  mode: Mode;
  when: (hit: Hit) => boolean;
  fired: number;
  arrive: (hit: Hit) => void;
  gate: Promise<void>;
}

export interface Failpoints {
  /** Arms `point` in `mode` for the hits `when` accepts (every hit when absent). */
  arm(point: Point, mode: Mode, when?: (hit: Hit) => boolean): Armed;
  /** `inner` seen through this handle's points. */
  db(inner: Db): Db;
  adapter(inner: Adapter): Adapter;
  /** Whether a `crash` point has fired: every call through the handle now throws Crashed. */
  readonly dead: boolean;
  /** The point it died at, if it did. */
  readonly diedAt: Point | undefined;
  hits(point: Point): number;
}

/** One handle's failpoints, none armed. */
export function failpoints(): Failpoints {
  const armings: Arming[] = [];
  const counts = new Map<Point, number>();
  let diedAt: Point | undefined;

  const alive = () => {
    if (diedAt !== undefined) throw new Crashed(diedAt);
  };

  /** The arming that fires at this hit, if any; counts the hit. */
  const reach = (
    point: Point,
    partial: Omit<Hit, "point" | "n" | "appended"> & { appended?: MemoryEvent[] },
  ) => {
    alive();
    const n = (counts.get(point) ?? 0) + 1;
    counts.set(point, n);
    const hit: Hit = { point, n, appended: [], ...partial };
    const a = armings.find((x) => x.point === point && x.when(hit));
    return { hit, a };
  };

  /** A synchronous point (a commit's): crash or raise. */
  const fireSync = (a: Arming | undefined, hit: Hit): void => {
    if (!a) return;
    if (a.mode === "crash") {
      a.fired++;
      a.arrive(hit);
      diedAt = hit.point;
      throw new Crashed(hit.point);
    }
    if (typeof a.mode === "object") {
      if (a.fired >= a.mode.raise) return;
      a.fired++;
      a.arrive(hit);
      throw new FailpointError(hit.point);
    }
  };

  /** An asynchronous point (a store call's); resolves true when the call is to be skipped. */
  const fire = async (point: StorePoint, partial: Omit<Hit, "point" | "n" | "appended">) => {
    const { hit, a } = reach(point, partial);
    if (!a) return false;
    if (a.mode === "pause") {
      a.fired++;
      a.arrive(hit);
      await a.gate;
      alive();
      return false;
    }
    if (a.mode === "skip") {
      a.fired++;
      a.arrive(hit);
      return true;
    }
    fireSync(a, hit);
    return false;
  };

  const arm = (point: Point, mode: Mode, when: (hit: Hit) => boolean = () => true): Armed => {
    if (point.startsWith("commit:") && (mode === "pause" || mode === "skip"))
      throw new Error(`a commit point is synchronous: only crash and raise apply, not ${mode}`);
    if (mode === "skip" && (point.startsWith("store.write") || point.endsWith(":after")))
      throw new Error(`skip applies to the :before points of delete, read and list, not ${point}`);
    let arrive: (hit: Hit) => void = () => {};
    let release = () => {};
    const arrived = new Promise<Hit>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const a: Arming = { point, mode, when, fired: 0, arrive, gate };
    armings.push(a);
    return {
      arrived,
      release,
      get fired() {
        return a.fired;
      },
    };
  };

  const db = (inner: Db): Db => {
    let depth = 0;
    const head = () =>
      Number(inner.prepare("SELECT coalesce(max(seq), -1) AS seq FROM events").get()?.seq ?? -1);
    const since = (seq: number): MemoryEvent[] =>
      inner
        .prepare("SELECT body FROM events WHERE seq > ? ORDER BY seq")
        .all(seq)
        .map((r) => JSON.parse(String(r.body)) as MemoryEvent);
    const statement = (s: Statement): Statement => ({
      run: (...p) => {
        alive();
        return s.run(...p);
      },
      get: (...p) => {
        alive();
        return s.get(...p);
      },
      all: (...p) => {
        alive();
        return s.all(...p);
      },
    });
    return {
      dialect: inner.dialect,
      exec: (sql) => {
        alive();
        inner.exec(sql);
      },
      prepare: (sql) => {
        alive();
        return statement(inner.prepare(sql));
      },
      transaction<T>(fn: () => T): T {
        alive();
        if (depth > 0) return inner.transaction(fn);
        depth++;
        let appended: MemoryEvent[] = [];
        try {
          const out = inner.transaction(() => {
            const from = head();
            const result = fn();
            appended = since(from);
            const { hit, a } = reach("commit:before", { appended });
            fireSync(a, hit);
            return result;
          });
          const { hit, a } = reach("commit:after", { appended });
          fireSync(a, hit);
          return out;
        } finally {
          depth--;
        }
      },
      close: () => inner.close(),
    };
  };

  const adapter = (inner: Adapter): Adapter => {
    const wrapped = Object.create(inner) as Adapter;
    wrapped.write = async (item) => {
      await fire("store.write:before", { item, scope: item.scope });
      const ref = await inner.write(item);
      await fire("store.write:after", { item, ref, scope: item.scope });
      return ref;
    };
    wrapped.delete = async (ref) => {
      if (await fire("store.delete:before", { ref })) return;
      await inner.delete(ref);
      await fire("store.delete:after", { ref });
    };
    wrapped.read = async (ref) => {
      if (await fire("store.read:before", { ref })) return undefined;
      const got = await inner.read(ref);
      await fire("store.read:after", { ref });
      return got;
    };
    wrapped.list = async (scope) => {
      if (await fire("store.list:before", { scope })) return [];
      const listed = await inner.list(scope);
      await fire("store.list:after", { scope });
      return listed;
    };
    const search = inner.search?.bind(inner);
    if (search)
      wrapped.search = async (query, scopes) => {
        alive();
        return search(query, scopes);
      };
    const history = inner.history?.bind(inner);
    if (history)
      wrapped.history = async (ref) => {
        alive();
        return history(ref);
      };
    return wrapped;
  };

  return {
    arm,
    db,
    adapter,
    get dead() {
      return diedAt !== undefined;
    },
    get diedAt() {
      return diedAt;
    },
    hits: (point) => counts.get(point) ?? 0,
  };
}
