// The vendored copy of pi's event types must match the installed pi exactly.
// These are compile-time checks: `make lint` (tsc) fails on drift.
import type * as Pi from "@earendil-works/pi-coding-agent";
import { expectTypeOf, test } from "vitest";
import type * as Vendored from "../src/vendor/pi-types.ts";

test("vendored pi event types equal the installed pi declarations", () => {
  expectTypeOf<Vendored.ContextEvent>().toEqualTypeOf<Pi.ContextEvent>();
  expectTypeOf<Vendored.ContextEventResult>().toEqualTypeOf<Pi.ContextEventResult>();
  expectTypeOf<Vendored.UserBashEvent>().toEqualTypeOf<Pi.UserBashEvent>();
  expectTypeOf<Vendored.UserBashEventResult>().toEqualTypeOf<Pi.UserBashEventResult>();
  expectTypeOf<Vendored.BashToolCallEvent>().toEqualTypeOf<Pi.BashToolCallEvent>();
  expectTypeOf<Vendored.CustomToolCallEvent>().toEqualTypeOf<Pi.CustomToolCallEvent>();
  expectTypeOf<Vendored.ToolCallEventResult>().toEqualTypeOf<Pi.ToolCallEventResult>();
});
