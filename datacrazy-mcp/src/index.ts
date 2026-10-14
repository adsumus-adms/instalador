#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { apiRequest, summarize, DatacrazyError } from "./client.js";
import { TOOLS, resolve } from "./tools.js";
import { WRITE_TOOLS, resolveWrite } from "./write-tools.js";

const server = new McpServer({ name: "datacrazy", version: "0.2.0" });
// DATACRAZY_SOMENTE_LEITURA=1 desliga todas as ferramentas de escrita.
const readOnly = ["1", "true", "sim"].includes((process.env.DATACRAZY_SOMENTE_LEITURA ?? "").toLowerCase());

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    const data = summarize(await fn());
    return { content: [{ type: "text", text: JSON.stringify(data, null, 1) }] };
  } catch (e) {
    const msg = e instanceof DatacrazyError ? e.message : "Falha ao consultar a API do Datacrazy.";
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
}

for (const def of TOOLS) {
  server.registerTool(
    def.name,
    { description: def.description, inputSchema: def.shape, annotations: { readOnlyHint: true, openWorldHint: true } },
    async (args: Record<string, unknown>) =>
      run(() => {
        const { path, query } = resolve(def, args);
        return apiRequest("GET", path, query);
      }),
  );
}

if (!readOnly) {
  for (const def of WRITE_TOOLS) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.shape,
        annotations: { readOnlyHint: false, destructiveHint: def.modifiesExisting, idempotentHint: false, openWorldHint: true },
      },
      async (args: Record<string, unknown>) =>
        run(() => {
          const { path, body } = resolveWrite(def, args);
          return apiRequest(def.method, path, {}, body);
        }),
    );
  }
}

await server.connect(new StdioServerTransport());
console.error(`datacrazy-mcp pronto (${TOOLS.length} de leitura, ${readOnly ? 0 : WRITE_TOOLS.length} de escrita)`);
