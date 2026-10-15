#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { apiRequest, summarize, DatacrazyError } from "./client.js";
import { TOOLS, resolve } from "./tools.js";
import { WRITE_TOOLS, resolveWrite } from "./write-tools.js";
import { SHAPES, prepararMensagem, enviarMensagem, finalizarAtendimento } from "./message-tools.js";

const server = new McpServer({ name: "datacrazy", version: "0.3.0" });
// DATACRAZY_SOMENTE_LEITURA=1 desliga todas as ferramentas de escrita.
const readOnly = ["1", "true", "sim"].includes((process.env.DATACRAZY_SOMENTE_LEITURA ?? "").toLowerCase());

// DATACRAZY_PERMITIR_ENVIO=1 liga a Fase 3 (envio de mensagens e finalizar atendimento). Desligado por padrão.
const allowSend = !readOnly && ["1", "true", "sim"].includes((process.env.DATACRAZY_PERMITIR_ENVIO ?? "").toLowerCase());

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

/** `raw` desliga o corte de textos longos (usado quando o usuário precisa ver o texto inteiro). `unknownMsg` substitui o erro genérico. */
async function run(fn: () => Promise<unknown>, opts: { raw?: boolean; unknownMsg?: string } = {}): Promise<Result> {
  try {
    const out = await fn();
    const data = opts.raw ? out : summarize(out);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 1) }] };
  } catch (e) {
    // Causa técnica só no stderr (código do erro, sem URL nem dados de clientes) para facilitar o diagnóstico.
    if (!(e instanceof DatacrazyError)) {
      const err = e as { name?: string; code?: string; cause?: { code?: string } };
      console.error(`datacrazy-mcp: falha de rede (${err.name ?? "Error"} ${err.cause?.code ?? err.code ?? ""})`);
    }
    const msg = e instanceof DatacrazyError ? e.message : (opts.unknownMsg ?? "Falha ao consultar a API do Datacrazy.");
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

if (allowSend) {
  server.registerTool(
    "preparar_mensagem",
    {
      description:
        "PASSO 1 de 2 para falar com um cliente. NÃO envia nada: confere a janela de 24h do WhatsApp, mostra destinatário e texto exatos e devolve um código de confirmação (válido 15 min). Mostre o resultado ao usuário e peça confirmação explícita antes do passo 2.",
      inputSchema: SHAPES.preparar,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => run(() => prepararMensagem(args as { conversationId: string; body: string }), { raw: true }),
  );
  server.registerTool(
    "enviar_mensagem",
    {
      description:
        "PASSO 2 de 2. ENVIA UMA MENSAGEM REAL DE WHATSAPP A UM CLIENTE; NÃO dá para desfazer. Só use depois que o usuário confirmou explicitamente o destinatário e o texto mostrados por preparar_mensagem. Exige o código, a mesma conversa e o mesmo texto. Uma conversa por chamada, só texto. Nunca use para disparo em massa.",
      inputSchema: SHAPES.enviar,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args) =>
      run(() => enviarMensagem(args as { conversationId: string; body: string; codigo: string }), {
        raw: true,
        unknownMsg: "Resultado INCERTO: a chamada falhou sem resposta clara e a mensagem pode ter sido enviada. Confira a conversa no Datacrazy antes de tentar de novo.",
      }),
  );
  server.registerTool(
    "finalizar_atendimento",
    {
      description:
        "ESCREVE NO CRM: finaliza o atendimento de uma conversa. Pode disparar automações do Datacrazy configuradas para o fim do atendimento (ex.: pesquisa de satisfação ao cliente). Só com pedido explícito do usuário. ATENÇÃO: ainda NÃO testada no Datacrazy real.",
      inputSchema: SHAPES.finalizar,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (args) => run(() => finalizarAtendimento(args as { conversationId: string })),
  );
}

await server.connect(new StdioServerTransport());
console.error(`datacrazy-mcp pronto (${TOOLS.length} de leitura, ${readOnly ? 0 : WRITE_TOOLS.length} de escrita, envio de mensagens ${allowSend ? "LIGADO" : "desligado"})`);
