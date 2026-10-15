import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { DraftStore } from "../message-tools.js";

interface Seen { method: string; url: string; body: string }

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

async function setup(extraEnv: Record<string, string> = {}) {
  const seen: Seen[] = [];
  const api = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method!, url: req.url!, body });
      res.writeHead(200, { "content-type": "application/json" });
      if (req.url!.startsWith("/api/v1/conversations?")) {
        // só devolve as conversas com mensagem do cliente nas últimas 24h, como o filtro openWindow=last24h
        res.end(JSON.stringify({ count: 4, data: [
          // formato real da API: contact.id é ID interno; o telefone está em phoneNumber/contactId
          { id: "C1", name: "Maria", contact: { id: "int1", phoneNumber: "5583999990001", contactId: "5583999990001", platform: "WHATSAPP" }, instance: { name: "ADSUMUS_3977", platform: "WHATSAPP", config: { phoneNumber: "+55 83 9980-3977" } }, lastReceivedMessageDate: hoursAgo(1) },
          { id: "C3", name: "Joao", contact: { id: "int3", phoneNumber: "5583999990003", platform: "WHATSAPP" }, instance: { platform: "WHATSAPP" }, lastReceivedMessageDate: hoursAgo(30) }, // data velha mesmo listada
          { id: "CI", name: "Ana", contact: { id: "int4", platform: "INSTAGRAM" }, instance: { platform: "INSTAGRAM" }, lastReceivedMessageDate: hoursAgo(1) },
          { id: "CG", name: "Grupo", isGroup: true, contact: { id: "int5", platform: "WHATSAPP" }, instance: { platform: "WHATSAPP" }, lastReceivedMessageDate: hoursAgo(1) },
        ] }));
      } else if (req.method === "POST" && req.url!.endsWith("/messages")) {
        res.end(JSON.stringify({ id: "M1", status: "SENT", body: "eco" }));
      } else res.end("{}");
    });
  });
  await new Promise<void>((r) => api.listen(0, r));
  const port = (api.address() as any).port;
  const client = new Client({ name: "t", version: "1" });
  await client.connect(new StdioClientTransport({
    command: "node",
    args: [fileURLToPath(new URL("../index.js", import.meta.url))],
    env: { ...process.env, DATACRAZY_API_KEY: "k", DATACRAZY_BASE_URL: `http://127.0.0.1:${port}`, ...extraEnv } as Record<string, string>,
  }));
  const call = async (name: string, args: Record<string, unknown>): Promise<any> => client.callTool({ name, arguments: args });
  return { seen, client, call, close: async () => { await client.close(); api.close(); } };
}

const posts = (seen: Seen[]) => seen.filter((s) => s.method === "POST");

test("sem DATACRAZY_PERMITIR_ENVIO não existe nenhuma ferramenta de mensagem", async () => {
  const { client, close } = await setup();
  const names = (await client.listTools()).tools.map((t) => t.name);
  for (const n of ["preparar_mensagem", "enviar_mensagem", "finalizar_atendimento"]) assert.ok(!names.includes(n), n);
  await close();
});

test("somente leitura vence: com SOMENTE_LEITURA=1 o envio não liga mesmo com PERMITIR_ENVIO=1", async () => {
  const { client, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1", DATACRAZY_SOMENTE_LEITURA: "1" });
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(!names.includes("enviar_mensagem"));
  await close();
});

test("fluxo em dois passos: preparar não envia; enviar só com código, conversa e texto idênticos; código é de uso único", async () => {
  const { seen, call, client, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1" });
  const tools = Object.fromEntries((await client.listTools()).tools.map((t) => [t.name, t]));
  assert.equal(tools["preparar_mensagem"].annotations?.readOnlyHint, true);
  assert.equal(tools["enviar_mensagem"].annotations?.readOnlyHint, false);
  assert.equal(tools["enviar_mensagem"].annotations?.destructiveHint, true);

  const texto = "Olá, Maria! " + "x".repeat(400); // > 300: o preview não pode ser cortado
  const p = await call("preparar_mensagem", { conversationId: "C1", body: texto });
  assert.ok(!p.isError, JSON.stringify(p));
  const prep = JSON.parse(p.content[0].text);
  assert.match(prep.codigo, /^[0-9a-f]{6}$/);
  assert.equal(prep.texto, texto, "texto completo no preview");
  assert.equal(prep.destinatario.nome, "Maria");
  assert.equal(prep.destinatario.telefone, "5583999990001", "mostra o telefone, não o ID interno");
  assert.deepEqual(prep.enviadoPor, { conexao: "ADSUMUS_3977", numero: "+55 83 9980-3977" });
  assert.equal(prep.janela24h.aberta, true);
  assert.equal(posts(seen).length, 0, "preparar não envia nada");
  assert.match(decodeURIComponent(seen[0].url), /filter\[openWindow\]=last24h/);

  // texto alterado -> recusa e nada é enviado
  const alterado = await call("enviar_mensagem", { conversationId: "C1", body: texto + "!", codigo: prep.codigo });
  assert.ok(alterado.isError);
  assert.match(alterado.content[0].text, /diferem/);
  assert.equal(posts(seen).length, 0);

  // o código foi consumido pela tentativa inválida: precisa preparar de novo
  const p2 = JSON.parse((await call("preparar_mensagem", { conversationId: "C1", body: texto })).content[0].text);
  // conversa diferente -> recusa
  const outraConversa = await call("enviar_mensagem", { conversationId: "C9", body: texto, codigo: p2.codigo });
  assert.ok(outraConversa.isError);
  assert.equal(posts(seen).length, 0);

  const p3 = JSON.parse((await call("preparar_mensagem", { conversationId: "C1", body: texto })).content[0].text);
  const ok = await call("enviar_mensagem", { conversationId: "C1", body: texto, codigo: p3.codigo });
  assert.ok(!ok.isError, JSON.stringify(ok));
  assert.equal(posts(seen).length, 1);
  assert.equal(posts(seen)[0].url, "/api/v1/conversations/C1/messages");
  assert.deepEqual(JSON.parse(posts(seen)[0].body), { body: texto }, "só o texto: sem isInternal, anexos nem agendamento");
  assert.equal(JSON.parse(ok.content[0].text).enviada, true);

  // reutilizar o mesmo código -> recusa
  const repetido = await call("enviar_mensagem", { conversationId: "C1", body: texto, codigo: p3.codigo });
  assert.ok(repetido.isError);
  assert.equal(posts(seen).length, 1, "sem envio duplicado");

  // código inventado
  const inventado = await call("enviar_mensagem", { conversationId: "C1", body: texto, codigo: "abcdef" });
  assert.ok(inventado.isError);
  assert.equal(posts(seen).length, 1);
  await close();
});

test("janela fechada ou não confirmada: nenhum código é gerado", async () => {
  const { seen, call, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1" });
  const velha = await call("preparar_mensagem", { conversationId: "C3", body: "oi" }); // listada, mas com 30h
  assert.ok(velha.isError);
  assert.match(velha.content[0].text, /fechada/);
  const desconhecida = await call("preparar_mensagem", { conversationId: "C404", body: "oi" });
  assert.ok(desconhecida.isError);
  assert.match(desconhecida.content[0].text, /NÃO confirmada/);
  assert.equal(posts(seen).length, 0);
  await close();
});

test("Instagram e grupos são recusados mesmo dentro da janela", async () => {
  const { seen, call, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1" });
  const ig = await call("preparar_mensagem", { conversationId: "CI", body: "oi" });
  assert.ok(ig.isError);
  assert.match(ig.content[0].text, /INSTAGRAM.*Só é permitido enviar por WhatsApp/);
  const grupo = await call("preparar_mensagem", { conversationId: "CG", body: "oi" });
  assert.ok(grupo.isError);
  assert.match(grupo.content[0].text, /grupo/);
  assert.equal(posts(seen).length, 0);
  await close();
});

test("entradas inválidas são recusadas antes de qualquer chamada à API", async () => {
  const { seen, call, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1" });
  for (const args of [{ conversationId: "../x", body: "oi" }, { conversationId: "C1", body: "" }, { conversationId: "C1", body: "a".repeat(1001) }])
    assert.ok((await call("preparar_mensagem", args)).isError);
  assert.ok((await call("finalizar_atendimento", { conversationId: "C1", confirmar: false })).isError);
  assert.ok((await call("finalizar_atendimento", { conversationId: "C1" })).isError);
  assert.equal(seen.length, 0);
  await close();
});

test("limite de envios por hora", async () => {
  const { seen, call, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1", DATACRAZY_MAX_ENVIOS_POR_HORA: "1" });
  const enviar = async (t: string) => {
    const p = JSON.parse((await call("preparar_mensagem", { conversationId: "C1", body: t })).content[0].text);
    return call("enviar_mensagem", { conversationId: "C1", body: t, codigo: p.codigo });
  };
  assert.ok(!(await enviar("um")).isError);
  const segundo = await enviar("dois");
  assert.ok(segundo.isError);
  assert.match(segundo.content[0].text, /Limite de 1 envios por hora/);
  assert.equal(posts(seen).length, 1);
  await close();
});

test("finalizar_atendimento chama a rota certa só com confirmar=true", async () => {
  const { seen, call, close } = await setup({ DATACRAZY_PERMITIR_ENVIO: "1" });
  const r = await call("finalizar_atendimento", { conversationId: "C1", confirmar: true });
  assert.ok(!r.isError, JSON.stringify(r));
  assert.deepEqual(posts(seen).map((s) => s.url), ["/api/v1/conversations/C1/finish"]);
  await close();
});

test("DraftStore: expira em 15 min e é de uso único", () => {
  const s = new DraftStore();
  const t0 = 1_000_000;
  const c = s.create("C1", "oi", t0);
  assert.throws(() => s.consume(c, "C1", "oi", t0 + 15 * 60_000 + 1), /expirado/);
  assert.throws(() => s.consume(c, "C1", "oi", t0 + 1), /inexistente|usado/); // já consumido
  const c2 = s.create("C1", "oi", t0);
  s.consume(c2, "C1", "oi", t0 + 60_000);
  assert.throws(() => s.consume(c2, "C1", "oi", t0 + 61_000), /inexistente|usado/);
});
