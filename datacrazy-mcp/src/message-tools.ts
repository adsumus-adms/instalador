import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiRequest, DatacrazyError } from "./client.js";

// Fase 3: envio de mensagens. SAI DE VERDADE para o cliente e não dá para desfazer.
// Travas no código (não só na descrição): dois passos com código de uso único, janela de 24h conferida,
// limite por hora, um destinatário por chamada, só texto (a API não aceita template da Meta).

const TTL_MS = 15 * 60_000;
const JANELA_MS = 24 * 3600_000;
const PAGINA = 50;
const MAX_PAGINAS = 10;
const maxPorHora = () => Number(process.env.DATACRAZY_MAX_ENVIOS_POR_HORA) || 20;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "ID inválido");
const body = z.string().trim().min(1).max(1000).describe("Texto exato da mensagem (máx. 1000 caracteres)");

export const SHAPES = {
  preparar: { conversationId: id.describe("ID da conversa (veja buscar_conversas)"), body },
  enviar: {
    conversationId: id,
    body,
    codigo: z.string().regex(/^[0-9a-f]{6}$/, "Código inválido").describe("Código devolvido por preparar_mensagem para ESTE texto e ESTA conversa"),
  },
  finalizar: { conversationId: id, confirmar: z.literal(true).describe("Deve ser true: confirma que o usuário pediu para finalizar este atendimento") },
};

interface Draft { conversationId: string; body: string; expiresAt: number }

/** Rascunhos em memória: um código por (conversa, texto), uso único, expira em 15 min. */
export class DraftStore {
  private drafts = new Map<string, Draft>();
  private sent: number[] = [];

  create(conversationId: string, text: string, now = Date.now()): string {
    for (const [k, d] of this.drafts) if (d.expiresAt <= now) this.drafts.delete(k);
    const code = randomBytes(3).toString("hex");
    this.drafts.set(code, { conversationId, body: text, expiresAt: now + TTL_MS });
    return code;
  }

  /** Valida e consome o código (uso único). Lança DatacrazyError se algo não bater. */
  consume(code: string, conversationId: string, text: string, now = Date.now()): void {
    this.sent = this.sent.filter((t) => now - t < 3600_000);
    if (this.sent.length >= maxPorHora())
      throw new DatacrazyError(`Limite de ${maxPorHora()} envios por hora atingido. Aguarde antes de enviar mais.`);
    const d = this.drafts.get(code);
    if (!d) throw new DatacrazyError("Código inexistente, já usado ou expirado. Rode preparar_mensagem de novo.");
    this.drafts.delete(code); // uso único, mesmo se algo abaixo falhar
    if (d.expiresAt <= now) throw new DatacrazyError("Código expirado (15 min). Rode preparar_mensagem de novo.");
    if (d.conversationId !== conversationId || d.body !== text)
      throw new DatacrazyError("A conversa ou o texto diferem do que foi preparado. Nada foi enviado. Rode preparar_mensagem de novo.");
    this.sent.push(now);
  }
}

export const store = new DraftStore();

interface ConversaResumo {
  id: string;
  name?: string;
  isGroup?: boolean;
  lastReceivedMessageDate?: string;
  contact?: { phoneNumber?: string; contactId?: string; platform?: string };
  instance?: { name?: string; platform?: string; config?: { phoneNumber?: string } };
}

/** Procura a conversa entre as que receberam mensagem do cliente nas últimas 24h (filtro openWindow=last24h). */
async function localizarConversaNaJanela(conversationId: string): Promise<ConversaResumo | null> {
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = (await apiRequest("GET", "/api/v1/conversations", { take: PAGINA, skip: p * PAGINA, filter: { openWindow: "last24h" } })) as { data?: ConversaResumo[] };
    const lista = r.data ?? [];
    const achou = lista.find((c) => c.id === conversationId);
    if (achou) return achou;
    if (lista.length < PAGINA) break;
  }
  return null;
}

export async function prepararMensagem(a: { conversationId: string; body: string }, now = Date.now()) {
  const conv = await localizarConversaNaJanela(a.conversationId);
  if (!conv)
    throw new DatacrazyError(
      "Janela de 24h NÃO confirmada: esta conversa não está entre as que receberam mensagem do cliente nas últimas 24h. " +
        "Fora da janela o WhatsApp oficial só aceita template aprovado, e a API do Datacrazy não envia template. Nenhum código foi gerado. " +
        "Use o template direto no Datacrazy, ou espere o cliente escrever.",
    );
  if (conv.isGroup) throw new DatacrazyError("Esta conversa é um grupo. Envio a grupos não é permitido por aqui. Nenhum código foi gerado.");
  const plataforma = conv.contact?.platform ?? conv.instance?.platform;
  if (plataforma !== "WHATSAPP")
    throw new DatacrazyError(`Esta conversa é de ${plataforma ?? "canal desconhecido"}. Só é permitido enviar por WhatsApp (a janela de 24h conferida aqui é a do WhatsApp). Nenhum código foi gerado.`);
  const ultima = Date.parse(conv.lastReceivedMessageDate ?? "");
  if (!Number.isFinite(ultima) || now - ultima >= JANELA_MS)
    throw new DatacrazyError("Janela de 24h fechada (a última mensagem do cliente tem mais de 24h). Nenhum código foi gerado.");
  const codigo = store.create(a.conversationId, a.body, now);
  return {
    codigo,
    validoPorMinutos: TTL_MS / 60_000,
    // O telefone aparece para o usuário conferir o destinatário (contact.id da API é um ID interno, não o telefone).
    destinatario: { nome: conv.name ?? "(sem nome)", telefone: conv.contact?.phoneNumber ?? conv.contact?.contactId ?? "(não informado)" },
    enviadoPor: { conexao: conv.instance?.name ?? "(desconhecida)", numero: conv.instance?.config?.phoneNumber ?? "(não informado)" },
    texto: a.body,
    janela24h: { aberta: true, ultimaMensagemDoCliente: new Date(ultima).toISOString(), fechaEm: new Date(ultima + JANELA_MS).toISOString() },
    proximoPasso:
      "NADA FOI ENVIADO. Mostre ao usuário o destinatário e o texto exatos e pergunte se confirma. Só depois do 'sim' explícito dele, chame enviar_mensagem com este código, a mesma conversa e o mesmo texto.",
  };
}

export async function enviarMensagem(a: { conversationId: string; body: string; codigo: string }, now = Date.now()) {
  store.consume(a.codigo, a.conversationId, a.body, now);
  const r = (await apiRequest("POST", `/api/v1/conversations/${encodeURIComponent(a.conversationId)}/messages`, {}, { body: a.body })) as Record<string, unknown>;
  return { enviada: true, mensagemId: r.id, status: r.status, erro: r.errorMessage ?? null, aviso: "Confira o status da entrega na conversa; não envie de novo sem verificar." };
}

export async function finalizarAtendimento(a: { conversationId: string }) {
  await apiRequest("POST", `/api/v1/conversations/${encodeURIComponent(a.conversationId)}/finish`);
  return { finalizado: true, conversationId: a.conversationId };
}
