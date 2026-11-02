import { join } from "node:path";

const configs = join(import.meta.dirname, "../../../research/configs");

/** The example pipeline config of card RN1. */
export const EXAMPLE = join(configs, "rn1-gatemem-probe.json");

/** The pipeline config of card B3: three checkpoints under C5 on every store. */
export const B3 = join(configs, "b3-gatemem-plane.json");

/** Card X1: every condition on both of H1's arms, at fixture size, and the suite of both. */
export const X1_SUITE = join(configs, "x1-h1-probe.json");
export const X1_GATEMEM = join(configs, "x1-h1-gatemem.json");
export const X1_MEM_INV = join(configs, "x1-h1-mem-inv.json");

/** H1's full-size experiment configs (plan decision 6). */
export const H1_GATEMEM = join(configs, "h1-gatemem.json");
export const H1_MEM_INV = join(configs, "h1-mem-inv.json");
