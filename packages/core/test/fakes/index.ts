// Fakes for the core interfaces (card E0.3). The Adapter fake is
// createFakeAdapter in @engram/adapters, the ModelCall fakes are the scripted
// models in @engram/runner. The Plane is never faked: tests drive createPlane
// in src/plane.ts over the fake adapter.
export { createFakeDistiller, distillKey } from "./distiller.ts";
export { createFakeLinter } from "./linter.ts";
export {
  createFakeSimulator,
  type FakeSimulatorOptions,
  type ScriptedDecision,
} from "./simulator.ts";
