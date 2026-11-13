// The adapter contract's permanent delete refusal (review of PR #41): a
// NotDeletableError, or any error marked notDeletable (a copy of the class
// from another module instance), is permanent; any other error is transient.
import { describe, expect, test } from "vitest";
import { isNotDeletable, NotDeletableError } from "../../src/adapter.ts";

describe("isNotDeletable", () => {
  test("is true for a NotDeletableError, its subclasses and an error marked notDeletable", () => {
    class ReadOnly extends NotDeletableError {}
    expect(isNotDeletable(new NotDeletableError("read-only"))).toBe(true);
    expect(isNotDeletable(new ReadOnly("read-only"))).toBe(true);
    expect(isNotDeletable(Object.assign(new Error("copy"), { notDeletable: true }))).toBe(true);
  });

  test("is false for a transient error and for anything else", () => {
    expect(isNotDeletable(new Error("store offline"))).toBe(false);
    expect(isNotDeletable(Object.assign(new Error("x"), { notDeletable: "yes" }))).toBe(false);
    expect(isNotDeletable(null)).toBe(false);
    expect(isNotDeletable("read-only")).toBe(false);
  });
});
