import { join } from "node:path";

/** The example pipeline config of card RN1. */
export const EXAMPLE = join(
  import.meta.dirname,
  "../../../research/configs/rn1-gatemem-probe.json",
);

/** The pipeline config of card B3: three checkpoints under C5 on every store. */
export const B3 = join(import.meta.dirname, "../../../research/configs/b3-gatemem-plane.json");
