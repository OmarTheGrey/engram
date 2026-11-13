// Test-only pi extension for install.test.ts: RPC mode has no command that
// lists tools, so `/probe-tools` reports every registered tool's name as one
// notify event ("tools:<name>,<name>,...") on the RPC stdout.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function probeTools(pi: ExtensionAPI): void {
  pi.registerCommand("probe-tools", {
    description: "List registered tool names (test probe)",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `tools:${pi
          .getAllTools()
          .map((t) => t.name)
          .join(",")}`,
        "info",
      );
    },
  });
}
