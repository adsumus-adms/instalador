#!/usr/bin/env node
// Chama uma ferramenta do MCP sem precisar registrá-lo. Uso (na nuvem):
//   node scripts/consultar.mjs buscar_leads '{"take":5}'
// Local (com chave): DATACRAZY_API_KEY=... node scripts/consultar.mjs buscar_leads '{"take":5}'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const [tool, json = "{}"] = process.argv.slice(2);
if (!tool) {
  console.error("Uso: node scripts/consultar.mjs <ferramenta> '<json dos argumentos>'");
  process.exit(2);
}
const root = fileURLToPath(new URL("..", import.meta.url));
const cloud = !process.env.DATACRAZY_API_KEY;
const transport = new StdioClientTransport(
  cloud
    ? { command: "sh", args: [`${root}nuvem.sh`], env: { ...process.env, DATACRAZY_SOMENTE_LEITURA: process.env.DATACRAZY_SOMENTE_LEITURA ?? "1" } }
    : { command: "node", args: [`${root}dist/index.js`], env: { ...process.env } },
);
const client = new Client({ name: "consultar", version: "1" });
await client.connect(transport);
const r = await client.callTool({ name: tool, arguments: JSON.parse(json) });
for (const c of r.content) if (c.type === "text") console.log(c.text);
await client.close();
process.exit(r.isError ? 1 : 0);
