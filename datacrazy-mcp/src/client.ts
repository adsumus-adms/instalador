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

/** GET com tratamento de 429 (respeita Retry-After, com limite de tentativas). */
export async function apiGet(path: string, query: Query = {}): Promise<unknown> {
  const url = `${BASE_URL}${path}${buildQuery(query)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
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
    if (!res.ok) {
      // Mensagem curta apenas; o corpo pode conter dados de clientes.
      throw new DatacrazyError(`Erro da API Datacrazy: HTTP ${res.status} em ${path}`);
    }
    return res.json();
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
