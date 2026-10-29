// `make ui` builds the inspector into packages/ui/dist, which `engram serve`
// serves at / beside the API (ADR 0027, card E8.5). Everything the page loads
// is bundled into dist: no font, script or style from a CDN, and the server's
// Content-Security-Policy refuses any other origin.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Every asset is a file of its own: no data: URL inlined into the bundle.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
