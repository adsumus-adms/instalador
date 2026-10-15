import { z } from "zod";
import type { Method } from "./client.js";

// Fase 2: escrita no CRM. Sem exclusão, sem anexos e sem envio de mensagens (Fase 3).
// Cada descrição diz o efeito, para o Claude Code pedir confirmação antes de executar.

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "ID inválido");
const ids = z.array(id).min(1).max(20).describe("IDs dos negócios (máx. 20 por chamada)");
const date = z.string().datetime().describe("Data/hora ISO 8601, ex.: 2026-10-20T14:00:00.000Z");

const leadFields = {
  name: z.string().max(200).optional().describe("Nome do lead"),
  phone: z.string().max(30).optional().describe("Telefone com DDI e DDD, só números (ex.: 5583999999999)"),
  email: z.string().max(200).optional(),
  source: z.string().max(100).optional().describe("Origem do lead"),
  company: z.string().max(200).optional(),
  taxId: z.string().max(30).optional().describe("CPF ou CNPJ"),
  notes: z.string().max(2000).optional().describe("Observações do lead"),
  type: z.enum(["PERSON", "COMPANY"]).optional(),
  tags: z.array(id).max(50).optional().describe("IDs de tags (veja buscar_tags)"),
  lists: z.array(id).max(50).optional().describe("IDs de listas (veja buscar_listas)"),
  attendantId: id.optional().describe("ID do atendente (veja buscar_atendentes_crm)"),
};

export interface WriteToolDef {
  name: string;
  description: string;
  method: Method;
  path: string;
  shape: z.ZodRawShape;
  pathParams?: string[];
  /** Quando true, a ferramenta altera dados já existentes (sinaliza destructiveHint). */
  modifiesExisting: boolean;
  toBody: (args: Record<string, any>) => Record<string, unknown>;
}

function leadBody(a: Record<string, any>) {
  const { attendantId, tags, lists, ...rest } = a;
  const body: Record<string, unknown> = { ...rest };
  delete body.id;
  if (attendantId) body.attendant = { id: attendantId };
  // A API real espera [{ "id": "<uuid>" }]; uma lista de textos é aceita mas IGNORADA (confirmado em teste).
  if (tags) body.tags = tags.map((id: string) => ({ id }));
  if (lists) body.lists = lists.map((id: string) => ({ id }));
  return body;
}

function activityBody(a: Record<string, any>) {
  const { id: _id, leadId, businessId, attendantId, activityTypeId, ...rest } = a;
  const body: Record<string, unknown> = { ...rest };
  if (leadId) body.lead = { id: leadId };
  if (businessId) body.business = { id: businessId };
  if (attendantId) body.attendant = { id: attendantId };
  if (activityTypeId) body.activityType = { id: activityTypeId };
  return body;
}

const activityFields = {
  description: z.string().max(2000).optional(),
  required: z.boolean().optional().describe("Atividade obrigatória?"),
  businessId: id.optional().describe("Negócio a vincular"),
  attendantId: id.optional().describe("Atendente responsável"),
  activityTypeId: id.optional().describe("Tipo de atividade"),
};

const pick = (keys: string[]) => (a: Record<string, any>) =>
  Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));

export const WRITE_TOOLS: WriteToolDef[] = [
  {
    name: "criar_lead",
    description: "ESCREVE NO CRM: cria um NOVO lead no Datacrazy. Antes, use buscar_leads (por telefone/e-mail) para evitar duplicar um contato que já existe.",
    method: "POST",
    path: "/api/v1/leads",
    shape: { ...leadFields, name: z.string().min(1).max(200).describe("Nome do lead") },
    modifiesExisting: false,
    toBody: leadBody,
  },
  {
    name: "atualizar_lead",
    description:
      "ESCREVE NO CRM: altera campos de um lead EXISTENTE (só os campos informados). Se enviar tags (confirmado em teste real), SUBSTITUI o conjunto inteiro: leia o lead antes (buscar_lead_por_id) e envie a lista completa desejada; não enviar mantém as atuais e [] remove todas. Listas: presume-se o mesmo, não testado.",
    method: "PATCH",
    path: "/api/v1/leads/{id}",
    shape: { id, ...leadFields },
    pathParams: ["id"],
    modifiesExisting: true,
    toBody: leadBody,
  },
  {
    name: "adicionar_comentario_ao_lead",
    description: "ESCREVE NO CRM: adiciona um comentário (nota interna) a um lead. Não envia nada ao cliente.",
    method: "POST",
    path: "/api/v1/leads/{leadId}/notes",
    shape: { leadId: id, note: z.string().min(1).max(2000).describe("Texto do comentário") },
    pathParams: ["leadId"],
    modifiesExisting: false,
    toBody: pick(["note"]),
  },
  {
    name: "criar_atividade",
    description: "ESCREVE NO CRM: cria uma atividade (tarefa) vinculada a um lead. Não envia nada ao cliente.",
    method: "POST",
    path: "/api/v1/activities",
    // endDate é obrigatório na API real (confirmado em teste: sem ele dá erro 400), embora o OpenAPI não marque.
    shape: {
      title: z.string().min(1).max(200).describe("Título da atividade"),
      leadId: id.describe("Lead vinculado"),
      startDate: date.describe("Início"),
      endDate: date.describe("Fim (obrigatório na API)"),
      ...activityFields,
    },
    modifiesExisting: false,
    toBody: activityBody,
  },
  {
    name: "atualizar_atividade",
    description: "ESCREVE NO CRM: altera uma atividade EXISTENTE (só os campos informados).",
    method: "PATCH",
    path: "/api/v1/activities/{id}",
    shape: { id, title: z.string().min(1).max(200).optional(), leadId: id.optional(), startDate: date.optional(), endDate: date.optional(), ...activityFields },
    pathParams: ["id"],
    modifiesExisting: true,
    toBody: activityBody,
  },
  {
    name: "criar_negocio",
    description: "ESCREVE NO CRM: cria um NOVO negócio para um lead, na etapa informada do funil (veja buscar_pipelines e etapas_do_pipeline). ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "POST",
    path: "/api/v1/businesses",
    shape: { leadId: id, stageId: id.describe("Etapa do funil"), attendantId: id.optional(), externalId: z.string().max(100).optional() },
    modifiesExisting: false,
    toBody: pick(["leadId", "stageId", "attendantId", "externalId"]),
  },
  {
    name: "atualizar_negocio",
    description: "ESCREVE NO CRM: altera um negócio EXISTENTE (lead, etapa, atendente ou ID externo). Para mover de etapa prefira mover_negocios. ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "PATCH",
    path: "/api/v1/businesses/{id}",
    shape: { id, leadId: id.optional(), stageId: id.optional(), attendantId: id.optional(), externalId: z.string().max(100).optional() },
    pathParams: ["id"],
    modifiesExisting: true,
    toBody: pick(["leadId", "stageId", "attendantId", "externalId"]),
  },
  {
    name: "mover_negocios",
    description: "ESCREVE NO CRM: move negócios para outra etapa do funil. Pode disparar automações configuradas na etapa de destino. ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "POST",
    path: "/api/v1/businesses/actions/move",
    shape: { ids, destinationStageId: id.describe("Etapa de destino") },
    modifiesExisting: true,
    toBody: pick(["ids", "destinationStageId"]),
  },
  {
    name: "ganhar_negocios",
    description: "ESCREVE NO CRM: marca negócios como GANHOS (venda fechada). Afeta métricas e relatórios; só reabre com restaurar_negocios. ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "POST",
    path: "/api/v1/businesses/actions/win",
    shape: { ids },
    modifiesExisting: true,
    toBody: pick(["ids"]),
  },
  {
    name: "perder_negocios",
    description: "ESCREVE NO CRM: marca negócios como PERDIDOS, com motivo (veja buscar_motivos_de_perda). Afeta métricas; só reabre com restaurar_negocios. ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "POST",
    path: "/api/v1/businesses/actions/lose",
    shape: { ids, lossReasonId: id.describe("Motivo de perda"), justification: z.string().max(500).optional() },
    modifiesExisting: true,
    toBody: pick(["ids", "lossReasonId", "justification"]),
  },
  {
    name: "restaurar_negocios",
    description: "ESCREVE NO CRM: restaura negócios ganhos ou perdidos, voltando a ficar em andamento. ATENÇÃO: ainda NÃO testada no Datacrazy real; confirme com o usuário e prefira testar antes com um negócio de teste.",
    method: "POST",
    path: "/api/v1/businesses/actions/restore",
    shape: { ids },
    modifiesExisting: true,
    toBody: pick(["ids"]),
  },
];

export function resolveWrite(def: WriteToolDef, args: Record<string, unknown>): { path: string; body: Record<string, unknown> } {
  let path = def.path;
  for (const p of def.pathParams ?? []) path = path.replace(`{${p}}`, encodeURIComponent(String(args[p])));
  return { path, body: def.toBody(args) };
}
