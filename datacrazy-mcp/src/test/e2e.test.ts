import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

interface Seen { method: string; url: string; auth?: string; body: string }

async function setup(extraEnv: Record<string, string> = {}, handler?: (req: http.IncomingMessage, res: http.ServerResponse, n: number) => boolean) {
  const seen: Seen[] = [];
  const api = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body });
      if (handler?.(req, res, seen.length)) return;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ count: 1, data: [{ id: "abc", name: "x".repeat(1000) }] }));
    });
  });
  await new Promise<void>((r) => api.listen(0, r));
  const port = (api.address() as any).port;
  const transport = new StdioClientTransport({
    command: "node",
    args: [fileURLToPath(new URL("../index.js", import.meta.url))],
    env: { ...process.env, DATACRAZY_API_KEY: "chave-teste", DATACRAZY_BASE_URL: `http://127.0.0.1:${port}`, ...extraEnv } as Record<string, string>,
  });
  const client = new Client({ name: "t", version: "1" });
  await client.connect(transport);
  return { seen, client, close: async () => { await client.close(); api.close(); } };
}

test("leitura: Bearer, filtros, resumo e retry de 429", async () => {
  let first = true;
  const { seen, client, close } = await setup({}, (req, res) => {
    if (req.url!.startsWith("/api/v1/leads") && first) {
      first = false;
      res.writeHead(429, { "retry-after": "1" }).end("{}");
      return true;
    }
    return false;
  });
  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === "buscar_leads"));
  assert.ok(!tools.some((t) => /excluir|apagar|deletar|enviar|finalizar/.test(t.name)), "sem exclusão nem mensagens");

  const r: any = await client.callTool({ name: "buscar_leads", arguments: { take: 5, filter: { tags: "t1" } } });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /…\[\+700 car\.\]/);
  assert.equal(seen.length, 2);
  assert.equal(seen[1].auth, "Bearer chave-teste");
  assert.match(decodeURIComponent(seen[1].url), /take=5/);
  assert.match(decodeURIComponent(seen[1].url), /filter\[tags\]=t1/);

  const bad: any = await client.callTool({ name: "buscar_lead_por_id", arguments: { id: "../x" } });
  assert.ok(bad.isError);
  await close();
});

test("escrita: método, rota e corpo corretos; ferramentas sinalizadas como não somente leitura", async () => {
  const { seen, client, close } = await setup();
  const { tools } = await client.listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  for (const n of ["criar_lead", "atualizar_lead", "adicionar_comentario_ao_lead", "criar_atividade", "mover_negocios", "ganhar_negocios", "perder_negocios", "restaurar_negocios"])
    assert.equal(byName[n]?.annotations?.readOnlyHint, false, n);
  assert.equal(byName["buscar_leads"].annotations?.readOnlyHint, true);

  await client.callTool({ name: "criar_lead", arguments: { name: "Fulano", phone: "5583999999999", attendantId: "att1" } });
  await client.callTool({ name: "atualizar_lead", arguments: { id: "L1", email: "a@b.com" } });
  await client.callTool({ name: "adicionar_comentario_ao_lead", arguments: { leadId: "L1", note: "ligou" } });
  await client.callTool({ name: "criar_atividade", arguments: { title: "Retornar", leadId: "L1", activityTypeId: "T1", startDate: "2026-10-20T14:00:00.000Z" } });
  await client.callTool({ name: "mover_negocios", arguments: { ids: ["B1", "B2"], destinationStageId: "S2" } });
  await client.callTool({ name: "perder_negocios", arguments: { ids: ["B1"], lossReasonId: "R1", justification: "sem interesse" } });

  const sig = seen.map((s) => `${s.method} ${s.url}`);
  assert.deepEqual(sig, [
    "POST /api/v1/leads",
    "PATCH /api/v1/leads/L1",
    "POST /api/v1/leads/L1/notes",
    "POST /api/v1/activities",
    "POST /api/v1/businesses/actions/move",
    "POST /api/v1/businesses/actions/lose",
  ]);
  assert.ok(seen.every((s) => s.auth === "Bearer chave-teste"));
  assert.deepEqual(JSON.parse(seen[0].body), { name: "Fulano", phone: "5583999999999", attendant: { id: "att1" } });
  assert.deepEqual(JSON.parse(seen[1].body), { email: "a@b.com" }); // sem o id no corpo
  assert.deepEqual(JSON.parse(seen[2].body), { note: "ligou" });
  assert.deepEqual(JSON.parse(seen[3].body), { title: "Retornar", lead: { id: "L1" }, activityType: { id: "T1" }, startDate: "2026-10-20T14:00:00.000Z" });
  assert.deepEqual(JSON.parse(seen[4].body), { ids: ["B1", "B2"], destinationStageId: "S2" });
  assert.deepEqual(JSON.parse(seen[5].body), { ids: ["B1"], lossReasonId: "R1", justification: "sem interesse" });

  // validação local: nada é enviado com entrada inválida
  const n = seen.length;
  const bad: any = await client.callTool({ name: "ganhar_negocios", arguments: { ids: [] } });
  assert.ok(bad.isError);
  const bad2: any = await client.callTool({ name: "mover_negocios", arguments: { ids: ["../x"], destinationStageId: "S" } });
  assert.ok(bad2.isError);
  assert.equal(seen.length, n);
  await close();
});

test("erro 400 de escrita mostra a mensagem de validação da API", async () => {
  const { client, close } = await setup({}, (req, res) => {
    if (req.method === "POST") {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ message: ["phone inválido"] }));
      return true;
    }
    return false;
  });
  const r: any = await client.callTool({ name: "criar_lead", arguments: { name: "X" } });
  assert.ok(r.isError);
  assert.match(r.content[0].text, /HTTP 400.*phone inválido/);
  await close();
});

test("DATACRAZY_SOMENTE_LEITURA=1 remove as ferramentas de escrita", async () => {
  const { client, close } = await setup({ DATACRAZY_SOMENTE_LEITURA: "1" });
  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === "buscar_leads"));
  assert.ok(!tools.some((t) => t.annotations?.readOnlyHint === false));
  await close();
});
