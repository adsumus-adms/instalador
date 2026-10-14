const BASE_URL = (process.env.DATACRAZY_BASE_URL ?? "https://api.g1.datacrazy.io").replace(/\/+$/, "");
const MAX_RETRIES = 3;
const MAX_WAIT_S = 60;
const TIMEOUT_MS = 30_000;

export type Query = Record<string, string | number | boolean | undefined | Record<string, string | number | boolean | undefined>>;

export class DatacrazyError extends Error {}

function apiKey(): string {
  const key = process.env.DATACRAZY_API_KEY;
  if (!key) throw new DatacrazyError("Variável de ambiente DATACRAZY_API_KEY não definida.");
  return key;
}

/** Monta a query string. Objetos viram `chave[sub]=valor` (ex.: filter[tags]=...). */
export function buildQuery(query: Query): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) if (sv !== undefined) p.append(`${k}[${sk}]`, String(sv));
    } else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Method = "GET" | "POST" | "PATCH";

/**
 * Requisição à API com tratamento de 429 (respeita Retry-After, com limite de tentativas).
 * O 429 é seguro de repetir mesmo em escrita: a API recusou antes de processar.
 */
export async function apiRequest(method: Method, path: string, query: Query = {}, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}${buildQuery(query)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 5, MAX_WAIT_S);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 429) throw new DatacrazyError("Limite de requisições (429) excedido após várias tentativas. Aguarde um minuto.");
    if (res.status === 401 || res.status === 403)
      throw new DatacrazyError(`Acesso negado (${res.status}). Verifique se a DATACRAZY_API_KEY é válida e se o plano inclui a API.`);
    if (!res.ok) throw new DatacrazyError(await errorMessage(res, method, path));
    // Algumas rotas de escrita respondem 201/204 sem corpo.
    const text = await res.text();
    return text ? JSON.parse(text) : { ok: true, status: res.status };
  }
}

export const apiGet = (path: string, query: Query = {}) => apiRequest("GET", path, query);

/** Mensagem curta de erro. Em erro 4xx de escrita inclui o `message` da API (validação de campos), cortado. */
async function errorMessage(res: Response, method: Method, path: string): Promise<string> {
  const base = `Erro da API Datacrazy: HTTP ${res.status} em ${method} ${path}`;
  if (method === "GET" || res.status >= 500) return base;
  try {
    const m = ((await res.json()) as { message?: unknown }).message;
    const text = Array.isArray(m) ? m.join("; ") : typeof m === "string" ? m : "";
    return text ? `${base}: ${text.slice(0, 300)}` : base;
  } catch {
    return base;
  }
}

const MAX_STR = 300;
const MAX_ARR = 25;

/** Reduz o JSON para não encher o contexto: corta textos longos, listas grandes e profundidade. */
export function summarize(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > MAX_STR ? `${value.slice(0, MAX_STR)}…[+${value.length - MAX_STR} car.]` : value;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARR).map((v) => summarize(v, depth + 1));
    return value.length > MAX_ARR ? [...items, `…[+${value.length - MAX_ARR} itens]`] : items;
  }
  if (value && typeof value === "object") {
    if (depth >= 5) return "[objeto omitido]";
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, summarize(v, depth + 1)]));
  }
  return value;
}
