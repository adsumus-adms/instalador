import { z } from "zod";

// Fase 1: somente leitura (GET). Nenhuma ferramenta de escrita ou exclusão é exposta.

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "ID inválido");
const take = z.number().int().min(1).max(50).default(10).describe("Quantidade de itens (padrão 10, máx. 50)");
const skip = z.number().int().min(0).max(10000).default(0).describe("Itens a pular (paginação, máx. 10000)");
const search = z.string().max(200).optional().describe("Texto de busca");
const filter = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .describe("Filtros da API como chave/valor, ex.: {\"tags\":\"<id>\"} vira filter[tags]=<id>");

export interface ToolDef {
  name: string;
  description: string;
  path: string; // pode conter {param}
  shape: z.ZodRawShape;
  /** Parâmetros que vão na URL (path); o resto vai na query. */
  pathParams?: string[];
  /** Parâmetros cujo valor é um objeto (filter/complete) */
  objectParams?: string[];
}

const page = { skip, take };

export const TOOLS: ToolDef[] = [
  {
    name: "buscar_leads",
    description: "Lista/busca leads do Datacrazy (somente leitura). Use search + searchType (phone, email, name, taxId) para localizar um contato e filter para filtros (tags, lists, attendant, createdAtGreaterOrEqual, etc.).",
    path: "/api/v1/leads",
    shape: { ...page, search, searchType: z.enum(["phone", "email", "name", "taxId"]).optional(), filter, complete: z.object({ additionalFields: z.boolean() }).optional().describe("additionalFields=true inclui campos adicionais") },
    objectParams: ["filter", "complete"],
  },
  { name: "buscar_lead_por_id", description: "Retorna um lead pelo ID.", path: "/api/v1/leads/{id}", shape: { id }, pathParams: ["id"] },
  { name: "historico_do_lead", description: "Histórico de eventos de um lead.", path: "/api/v1/leads/{id}/history", shape: { id, ...page, search, filter }, pathParams: ["id"], objectParams: ["filter"] },
  { name: "comentarios_do_lead", description: "Comentários (notas) de um lead.", path: "/api/v1/leads/{leadId}/notes", shape: { leadId: id }, pathParams: ["leadId"] },
  { name: "atividades_do_lead", description: "Atividades de um lead.", path: "/api/v1/leads/{id}/activities", shape: { id, ...page, search }, pathParams: ["id"] },
  { name: "negocios_do_lead", description: "Negócios de um lead.", path: "/api/v1/leads/{id}/businesses", shape: { id, ...page, search }, pathParams: ["id"] },
  {
    name: "buscar_negocios",
    description: "Lista/busca negócios (somente leitura). filter aceita status, tags, attendants, minValue, maxValue, createdAtGreaterOrEqual, lastMovedAfter etc.",
    path: "/api/v1/businesses",
    shape: { ...page, search, filter },
    objectParams: ["filter"],
  },
  { name: "buscar_negocio_por_id", description: "Retorna um negócio pelo ID.", path: "/api/v1/businesses/{id}", shape: { id }, pathParams: ["id"] },
  { name: "buscar_pipelines", description: "Lista pipelines (funis) e grupos de pipelines.", path: "/api/v1/pipelines", shape: { search } },
  { name: "etapas_do_pipeline", description: "Lista as etapas de um pipeline.", path: "/api/v1/pipelines/{id}/stages", shape: { id }, pathParams: ["id"] },
  { name: "buscar_tags", description: "Lista todas as tags.", path: "/api/v1/tags", shape: {} },
  { name: "buscar_listas", description: "Lista todas as listas de leads.", path: "/api/v1/lists", shape: {} },
  { name: "buscar_produtos", description: "Lista produtos.", path: "/api/v1/products", shape: {} },
  { name: "buscar_motivos_de_perda", description: "Lista motivos de perda de negócios.", path: "/api/v1/business-loss-reasons", shape: {} },
  { name: "buscar_atividades", description: "Lista atividades do CRM.", path: "/api/v1/activities", shape: { ...page, search, filter }, objectParams: ["filter"] },
  {
    name: "buscar_conversas",
    description: "Lista conversas de atendimento (somente leitura). filter.status: unstarted, waiting, opened, automation, finished, error. Limite da API: 20 req/min.",
    path: "/api/v1/conversations",
    shape: { ...page, search, filter },
    objectParams: ["filter"],
  },
  { name: "mensagens_da_conversa", description: "Lê as mensagens de uma conversa (não envia nada). Limite da API: 20 req/min.", path: "/api/v1/conversations/{id}/messages", shape: { id, ...page }, pathParams: ["id"] },
  { name: "buscar_atendentes_crm", description: "Lista atendentes do CRM.", path: "/api/v1/attendants/crm", shape: {} },
  { name: "buscar_atendentes_multiatendimento", description: "Lista atendentes do multiatendimento.", path: "/api/v1/attendants/multi", shape: { search } },
  { name: "buscar_instancias", description: "Lista instâncias (conexões de WhatsApp).", path: "/api/v1/instances", shape: {} },
];

/** Separa os argumentos em path e query e devolve a rota final. */
export function resolve(def: ToolDef, args: Record<string, unknown>): { path: string; query: Record<string, any> } {
  let path = def.path;
  const query: Record<string, any> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    if (def.pathParams?.includes(k)) path = path.replace(`{${k}}`, encodeURIComponent(String(v)));
    else query[k] = v;
  }
  return { path, query };
}
