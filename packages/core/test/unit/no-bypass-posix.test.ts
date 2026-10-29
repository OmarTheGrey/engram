// The no-bypass check with node:path replaced by its posix half, so the
// Linux reading of paths is tested on every platform, Windows included: a
// backslash is a separator for PowerShell and cmd (they read it so on Linux
// too, as pwsh does), and an escape for bash. Linux CI caught the missing
// PowerShell rule the Windows path module had hidden (PR 3).
import { describe, expect, it, vi } from "vitest";

vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>("node:path");
  return { ...actual.posix, default: actual.posix };
});

const { shellBypass } = await import("../../src/no-bypass.ts");
const check = { cwd: "/proj", roots: ["/proj/memory"], rootStore: "files" };

describe("under a posix path module", () => {
  it("PowerShell reads a backslash as a separator", () => {
    expect(shellBypass("Get-Content memory\\a.md", { ...check, shell: "powershell" })?.route).toBe(
      "path",
    );
    expect(shellBypass('pwsh -Command "Get-Content memory\\a.md"', check)?.route).toBe("path");
  });
  it("bash keeps it as an escape", () => {
    expect(shellBypass("cat memory\\a.md", check)).toBeUndefined();
  });
  it("forward-slash paths still work", () => {
    expect(shellBypass("cat memory/a.md", check)?.route).toBe("path");
    expect(shellBypass("cd memory && cat a.md", check)?.route).toBe("path");
    expect(shellBypass("cat memor*/a.md", check)?.route).toBe("path");
    expect(shellBypass("git show :0:memory/a.md", check)?.route).toBe("path");
    expect(shellBypass("git commit -m 'fix memory leak'", check)).toBeUndefined();
  });
});
