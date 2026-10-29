// Fakes for the core interfaces (card E0.3). The Adapter fake is
// createFakeAdapter in @engram/adapters, the ModelCall fakes are the scripted
// models in @engram/runner, and the Plane's is createStubPlane in src/plane.ts.
export { createFakeDistiller, distillKey } from "./distiller.ts";
export { createFakeLinter } from "./linter.ts";
export {
  createFakeSimulator,
  type FakeSimulatorOptions,
  type ScriptedDecision,
} from "./simulator.ts";
