// The MCP handshake layer 6 runs from the harness fixtures (card E8.4,
// test/e2e/mcp.e2e.test.ts imports this file, as it imports the CLI's
// Postgres helper): launch the server a harness config names, then
// initialize, list tools, write, read, and explain that read.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface Handshake {
  server: { name: string; version: string } | undefined;
  tools: string[];
  write: { text: string; isError: boolean };
  read: string;
  readId: string;
  explanations: { item_id: string; rank: number; policy_id: string }[];
  stderr: string;
}

const textOf = (result: unknown) =>
  (result as { content: { text: string }[] }).content[0]?.text ?? "";

/** Runs `command args` in `cwd` as an MCP server over stdio and drives one session. */
export async function handshake(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  content: string,
): Promise<Handshake> {
  const transport = new StdioClientTransport({ command, args, cwd, env, stderr: "pipe" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: "engram-e2e", version: "0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const written = await client.callTool({
      name: "memory_write",
      arguments: { scope: "person:dana", content },
    });
    const read = textOf(
      await client.callTool({ name: "memory_read", arguments: { query: content } }),
    );
    const readId = /read_id="([^"]+)"/.exec(read)?.[1] ?? "";
    const explained = await client.callTool({
      name: "memory_explain",
      arguments: { read_id: readId },
    });
    return {
      server: client.getServerVersion(),
      tools: tools.map((t) => t.name),
      write: { text: textOf(written), isError: written.isError === true },
      read,
      readId,
      explanations: JSON.parse(textOf(explained)),
      stderr,
    };
  } finally {
    await client.close();
  }
}
