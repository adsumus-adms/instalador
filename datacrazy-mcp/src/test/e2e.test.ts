import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

test("servidor MCP consulta a API (mock) com Bearer, filtros e retry de 429", async () => {
  const seen: { url: string; auth?: string }[] = [];
  let first = true;
  const api = http.createServer((req, res) => {
    seen.push({ url: req.url!, auth: req.headers.authorization });
    if (req.url!.startsWith("/api/v1/leads") && first) {
      first = false;
      res.writeHead(429, { "retry-after": "1" }).end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ count: 1, data: [{ id: "abc", name: "x".repeat(1000) }] }));
  });
  await new Promise<void>((r) => api.listen(0, r));
  const port = (api.address() as any).port;

  const transport = new StdioClientTransport({
    command: "node",
    args: [fileURLToPath(new URL("../index.js", import.meta.url))],
    env: { ...process.env, DATACRAZY_API_KEY: "chave-teste", DATACRAZY_BASE_URL: `http://127.0.0.1:${port}` } as Record<string, string>,
  });
  const client = new Client({ name: "t", version: "1" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === "buscar_leads"));
  assert.ok(!tools.some((t) => /criar|excluir|enviar|atualizar/.test(t.name)), "Fase 1 não expõe escrita");

  const r: any = await client.callTool({ name: "buscar_leads", arguments: { take: 5, filter: { tags: "t1" } } });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /…\[\+700 car\.\]/);
  assert.equal(seen.length, 2); // 429 + retry
  assert.equal(seen[1].auth, "Bearer chave-teste");
  assert.match(decodeURIComponent(seen[1].url), /take=5/);
  assert.match(decodeURIComponent(seen[1].url), /filter\[tags\]=t1/);

  const bad: any = await client.callTool({ name: "buscar_lead_por_id", arguments: { id: "../x" } });
  assert.ok(bad.isError);

  await client.close();
  api.close();
});
