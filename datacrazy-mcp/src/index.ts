#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { apiGet, summarize, DatacrazyError } from "./client.js";
import { TOOLS, resolve } from "./tools.js";

const server = new McpServer({ name: "datacrazy", version: "0.1.0" });

for (const def of TOOLS) {
  server.registerTool(
    def.name,
    { description: def.description, inputSchema: def.shape, annotations: { readOnlyHint: true, openWorldHint: true } },
    async (args: Record<string, unknown>) => {
      try {
        const { path, query } = resolve(def, args);
        const data = summarize(await apiGet(path, query));
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
      } catch (e) {
        const msg = e instanceof DatacrazyError ? e.message : "Falha ao consultar a API do Datacrazy.";
        return { isError: true, content: [{ type: "text" as const, text: msg }] };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
console.error(`datacrazy-mcp pronto (${TOOLS.length} ferramentas, somente leitura)`);
