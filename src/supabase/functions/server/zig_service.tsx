import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

/**
 * Integração ZIG ↔ Stockpyrou
 *
 * **Caminho de produção (PDV / `ZigSalesBaixa`)** — preferir sempre:
 * 1. `fetchPendingSales` → GET na API ZIG (`/erp/saida-produtos`), intervalo partido por dia civil; gera `previewSessionId` + KV `zig_preview_session:…`.
 * 2. `confirmStockFromZigPreviewSnapshot` (rota HTTP `POST …/zig/confirm`) → **não** chama a ZIG; só usa `lineItems` e/ou sessão KV; baixa em `products` / `stock_movements` e marca `zig_processed:…`.
 *
 * **Baixa automática (`runAutoBaixaZigOntem`)** — cron / job: busca **ontem** na ZIG, só transações em que todos os itens já existem no Stockpyrou; usa `confirmSales` com intervalo de datas (GET ZIG por dia).
 *
 * (Removido) `syncSales` era legado de sincronização por intervalo e causava confusão com o fluxo de preview/confirm.
 *
 * **Regra geral:** confirmação pelo browser deve passar **só** por `confirmStockFromZigPreviewSnapshot`. Se o erro citar «Falha ao buscar vendas ZIG» no **confirm**, a Edge Function em produção está desatualizada ou o body não trouxe `lineItems` / `previewSessionId`.
 */

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ZIG_API_URL = "https://api.zigcore.com.br/integration";

type ZigKvConfig = {
  storeId?: string;
  redeId?: string;
  zigToken?: string;
};

/** Token ZIG: 1) KV por empresa (`zigToken`), 2) variável de ambiente `ZIG_API_KEY` (dev/legado). */
export async function getZigTokenForCompany(companyId: string): Promise<string> {
  const cfg = (await kv.get(`zig_config:${companyId}`)) as ZigKvConfig | null;
  const fromKv = cfg?.zigToken?.trim();
  if (fromKv) return fromKv;
  const env = Deno.env.get("ZIG_API_KEY")?.trim();
  if (env) return env;
  throw new Error(
    "Token ZIG não configurado. Informe e salve o token em Integrações > ZIG (ou defina ZIG_API_KEY no servidor).",
  );
}

/**
 * Para listar lojas: header `X-ZIG-TOKEN` (setup) ou `companyId` na query (token já salvo no KV).
 */
export async function resolveZigTokenForStores(
  companyId: string | undefined,
  headerToken: string | undefined,
): Promise<string> {
  const h = headerToken?.trim();
  if (h) return h;
  if (companyId) return await getZigTokenForCompany(companyId);
  throw new Error(
    "Informe o token ZIG (campo na tela) ou salve a configuração da empresa antes de listar lojas.",
  );
}

function maskToken(t: string): string {
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

// Types
interface ZigSale {
  transactionId: string;
  transactionDate: string;
  productId: string;
  productSku: string;
  unitValue: number;
  count: number;
  productName: string;
  type: string;
  additions?: { productSku: string; count: number }[];
}

interface ZigStore {
  id: string;
  name: string;
}

// Helpers
const getHeaders = (token: string) => {
  // A API da Zig espera o token DIRETO, SEM "Bearer "
  return {
    "Authorization": token,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
};

/**
 * A API ZIG limita o intervalo por chamada. Buscamos **um dia civil por requisição**.
 * Preferimos primeiro `dtinicio = dtfim` (documentação); se falhar, tentamos `dtfim` = dia seguinte (intervalo semiaberto) e filtramos pela data civil.
 */
const MS_PER_UTC_DAY = 86_400_000;

function parseDateOnly(iso: string): Date {
  const part = iso.trim().split("T")[0];
  const [y, m, d] = part.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Hoje (calendário) em America/Sao_Paulo como YYYY-MM-DD. */
export function getTodayYmdSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return formatDateOnly(dt);
}

/** Ontem (calendário) em America/Sao_Paulo como YYYY-MM-DD. */
export function getYesterdayYmdSaoPaulo(): string {
  return addDaysToYmd(getTodayYmdSaoPaulo(), -1);
}

const SAO_PAULO_TZ = "America/Sao_Paulo";

const ymdFormatterSaoPaulo = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Instante UTC cuja data civil em São Paulo é `ymd` (YYYY-MM-DD). */
function utcInstantForLocalYmdSaoPaulo(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(NaN);
  for (let hh = 0; hh < 24; hh++) {
    const t = new Date(Date.UTC(y, m - 1, d, hh, 0, 0));
    if (ymdFormatterSaoPaulo.format(t) === ymd) return t;
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Cada dia civil entre startYmd e endYmd **no calendário de São Paulo** (inclusive).
 * A ZIG valida o intervalo provavelmente nesse fuso — evita 500 por “>5 dias” com datas UTC erradas.
 */
function eachYmdInRangeSaoPaulo(startYmd: string, endYmd: string): string[] {
  if (startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = utcInstantForLocalYmdSaoPaulo(startYmd);
  if (Number.isNaN(cur.getTime())) return [];
  for (let guard = 0; guard < 400; guard++) {
    const ymd = ymdFormatterSaoPaulo.format(cur);
    out.push(ymd);
    if (ymd === endYmd) break;
    cur = new Date(cur.getTime() + MS_PER_UTC_DAY);
  }
  return out;
}

/**
 * Documentação oficial (PDF): GET /erp/saida-produtos com dtinicio, dtfim em **YYYY-MM-DD** e loja.
 * Não há `rede` neste endpoint. Buscamos um dia civil por vez; ver `fetchOneSaidaChunkForDay` para o fallback de intervalo.
 */
/** Texto útil para regex (corpo cru ou campo `message` em JSON de erro ZIG). */
function zigSaidaErrorPlainText(body: string): string {
  const t = body.trim();
  try {
    const j = JSON.parse(t) as { message?: unknown };
    if (typeof j?.message === "string" && j.message.length > 0) return j.message;
  } catch {
    /* ignore */
  }
  return t;
}

function isZigRangeLimitError(status: number, body: string): boolean {
  if (status !== 500 && status !== 400) return false;
  const text = zigSaidaErrorPlainText(body);
  return /5\s*dias|mais do que\s*5|requisitar\s+mais|limite.*dia|intervalo.*dia/i.test(text);
}

type SaidaFetchResult =
  | { ok: true; data: ZigSale[] }
  | { ok: false; status: number; body: string };

async function fetchSaidaProdutosOnce(
  token: string,
  storeId: string,
  dtinicio: string,
  dtfim: string,
): Promise<SaidaFetchResult> {
  const params = new URLSearchParams();
  params.set("dtinicio", dtinicio);
  params.set("dtfim", dtfim);
  params.set("loja", storeId);
  const url = `${ZIG_API_URL}/erp/saida-produtos?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      ...getHeaders(token),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const txt = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: txt };
  }
  try {
    const parsed = JSON.parse(txt) as ZigSale[];
    return { ok: true, data: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { ok: false, status: res.status, body: txt || "JSON inválido" };
  }
}

/** Mantém só linhas cuja data civil da transação é `ymd`; se nada bater mas houver linhas, devolve o bruto (API pode omitir formato). */
function filterSalesToLocalYmd(sales: ZigSale[], ymd: string): ZigSale[] {
  const filtered = sales.filter((s) => (s.transactionDate || "").split("T")[0] === ymd);
  if (filtered.length > 0 || sales.length === 0) return filtered;
  return sales;
}

/**
 * Mensagem para o operador: o erro vem da API ZIG (intervalo dtinicio/dtfim), não do PostgreSQL nem do volume de vendas.
 */
function zigSaidaRangeLimitHelp(lastStatus: number, lastBody: string): string {
  const detail = lastBody.length > 800 ? `${lastBody.slice(0, 800)}…` : lastBody;
  return (
    `A ZIG devolveu erro de «limite de dias por chamada» (${lastStatus}). ` +
      `Isso refere-se ao **intervalo de datas numa única requisição HTTP** na API deles — não ao seu banco de dados, nem ao fato de ser «só hoje» ou «poucos produtos». ` +
      `O Stockpyrou já consulta **um dia civil por vez**. ` +
      `Se continuar assim, é bug ou regra estranha no servidor ZIG: encaminhe esta resposta ao suporte deles. Detalhe: ${detail}`
  );
}

/**
 * Um dia civil por vez (`ymd` em YYYY-MM-DD, calendário São Paulo).
 *
 * Ordem: primeiro **dtinicio = dtfim** (exemplo da documentação ZIG). Depois, **[dtinicio, dtfim)** com `dtfim` = dia seguinte (comum em APIs BR).
 * A primeira estratégia antiga (semiaberto primeiro) fazia a ZIG devolver 500 «>5 dias» em alguns ambientes mesmo para um único dia civil.
 */
async function fetchOneSaidaChunkForDay(
  token: string,
  storeId: string,
  ymd: string,
): Promise<ZigSale[]> {
  const ymdNext = addDaysToYmd(ymd, 1);
  const strategies: [string, string, string][] = [
    [ymd, ymd, "dtinicio = dtfim (um dia)"],
    [ymd, ymdNext, "dtfim exclusivo (dia civil)"],
  ];

  let lastFail: SaidaFetchResult | null = null;

  for (const [di, df, label] of strategies) {
    console.log(`ZIG: saída-produtos loja=${storeId} ${di}…${df} (${label})`);
    const r = await fetchSaidaProdutosOnce(token, storeId, di, df);
    if (r.ok) {
      return filterSalesToLocalYmd(r.data, ymd);
    }
    lastFail = r;

    if (isZigRangeLimitError(r.status, r.body)) {
      console.warn(`ZIG: estratégia «${label}» recusada com limite de intervalo; tentando próxima se houver`);
      continue;
    }

    throw new Error(`Falha ao buscar vendas ZIG (${r.status}): ${r.body}`);
  }

  if (lastFail && isZigRangeLimitError(lastFail.status, lastFail.body)) {
    throw new Error(zigSaidaRangeLimitHelp(lastFail.status, lastFail.body));
  }

  throw new Error(
    `Falha ao buscar vendas ZIG (${lastFail?.status ?? "?"}): ${lastFail?.body ?? "sem resposta"}`,
  );
}

/** Mescla resultados deduplicando por transactionId (mantém primeira ocorrência). */
function mergeSalesIntoMap(merged: Map<string, ZigSale>, chunk: ZigSale[]) {
  for (const sale of chunk) {
    if (sale?.transactionId && !merged.has(sale.transactionId)) {
      merged.set(sale.transactionId, sale);
    }
  }
}

/** Pausa entre chamadas ao gateway ZIG. */
const ZIG_INTER_CALL_DELAY_MS = 150;

/**
 * Várias chamadas GET, **uma por dia civil (SP)**; cada dia tenta primeiro dtinicio = dtfim (YYYY-MM-DD), com fallback documentado em `fetchOneSaidaChunkForDay`.
 */
async function fetchZigSaidaProdutosRange(
  token: string,
  storeId: string,
  startIso: string,
  endIso: string,
): Promise<ZigSale[]> {
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  if (start.getTime() > end.getTime()) {
    return [];
  }
  const startYmd = formatDateOnly(start);
  const endYmd = formatDateOnly(end);
  const days = eachYmdInRangeSaoPaulo(startYmd, endYmd);
  const merged = new Map<string, ZigSale>();

  console.log(
    `ZIG: saída-produtos ${startYmd} → ${endYmd} (${days.length} dia(s) ${SAO_PAULO_TZ}; 1 GET/dia, YYYY-MM-DD), loja=${storeId}`,
  );

  for (let i = 0; i < days.length; i++) {
    const ymd = days[i];
    if (i > 0) {
      await new Promise((r) => setTimeout(r, ZIG_INTER_CALL_DELAY_MS));
    }
    const chunk = await fetchOneSaidaChunkForDay(token, storeId, ymd);
    mergeSalesIntoMap(merged, chunk);
  }

  return Array.from(merged.values());
}

export const getStores = async (token: string, redeId?: string): Promise<ZigStore[]> => {
  // Log para debug (mascarando o token)
  console.log(`ZIG: Usando token: ${maskToken(token)}`);
  
  const FALLBACK_REDE_ID = "35c5259d-4d3a-4934-9dd2-78a057a3aa8f";
  
  // Limpeza do parâmetro redeId
  const cleanRedeId = (redeId === 'undefined' || redeId === 'null' || !redeId || redeId.trim() === '') ? FALLBACK_REDE_ID : redeId.trim();

  // VALIDAÇÃO CRÍTICA: Se não houver redeId, a API da ZIG para este token retorna 500 "cannot be null"
  // Interceptamos aqui para dar um erro amigável 400 em vez de um 500 de erro de sistema
  if (!cleanRedeId) {
    throw new Error("O 'ID da Rede' é obrigatório para listar as lojas com este token de integração. Por favor, preencha o campo ID da Rede.");
  }

  let url = `${ZIG_API_URL}/erp/lojas?rede=${cleanRedeId}`;
  
  console.log(`ZIG: Buscando lojas para Rede: ${cleanRedeId}`);
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: getHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error(`ZIG API Error (${response.status}):`, errorData);
      
      // Tratamento específico para erro 400 - Token inválido
      // Em vez de lançar erro, retorna uma mensagem que será tratada pelo frontend
      if (response.status === 400 && (errorData.type === 'InvalidToken' || errorData.message?.toLowerCase().includes('token'))) {
        console.warn("⚠️ Token ZIG inválido - Integração ZIG não disponível");
        throw new Error("ZIG_TOKEN_INVALID:Token ZIG inválido ou ausente. Salve o token em Integrações > ZIG ou defina ZIG_API_KEY no servidor.");
      }
      
      if (response.status === 500 && (errorData.message?.includes('lojas.args.rede') || errorText.includes('rede'))) {
        throw new Error("O 'ID da Rede' informado é inválido ou obrigatório para este token.");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Token de integração ZIG inválido ou sem permissão para esta rede.");
      }

      throw new Error(`Erro ZIG (${response.status}): ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    const stores = Array.isArray(data) ? data : (data.lojas || []);
    
    return stores.map((s: any) => ({
      id: s.id || s.loja_id || s.id_loja,
      name: s.name || s.nome || s.nome_fantasia || `Loja ${s.id}`
    }));
  } catch (error: any) {
    console.error("ZIG: Erro ao buscar lojas:", error);
    throw error;
  }
};

export const saveConfig = async (
  companyId: string,
  storeId: string,
  redeId?: string,
  zigToken?: string,
) => {
  const prev = ((await kv.get(`zig_config:${companyId}`)) as ZigKvConfig | null) || {};
  const next: ZigKvConfig = { ...prev, storeId, redeId };
  const t = zigToken?.trim();
  if (t) next.zigToken = t;
  await kv.set(`zig_config:${companyId}`, next);
};

export const getConfig = async (companyId: string) => {
  const raw = (await kv.get(`zig_config:${companyId}`)) as ZigKvConfig | null;
  if (!raw) return null;
  const tok = raw.zigToken?.trim();
  return {
    storeId: raw.storeId,
    redeId: raw.redeId,
    hasZigToken: !!tok,
    zigTokenMasked: tok ? maskToken(tok) : undefined,
  };
};

export type ZigConfirmLineItem = {
  transactionId: string;
  productSku: string;
  productName: string;
  quantity: number;
};

// Fetch Pending Sales (Preview - Sem processar)
export const fetchPendingSales = async (companyId: string, startDate?: string, endDate?: string) => {
  const token = await getZigTokenForCompany(companyId);

  const config = await kv.get(`zig_config:${companyId}`);
  if (!config || !config.storeId) {
    throw new Error("Integração ZIG não configurada. Selecione uma loja nas configurações.");
  }

  // Intervalo: períodos longos são buscados em várias chamadas (regra ZIG: no máx. 5 dias por chamada).
  let apiStartDate: Date;
  let apiEndDate: Date;

  if (startDate && endDate) {
    apiStartDate = parseDateOnly(startDate);
    apiEndDate = parseDateOnly(endDate);
  } else {
    const endYmd = getTodayYmdSaoPaulo();
    const startYmd = addDaysToYmd(endYmd, -4); // 5 dias inclusivos (hoje em SP)
    apiStartDate = parseDateOnly(startYmd);
    apiEndDate = parseDateOnly(endYmd);
  }

  const startStr = formatDateOnly(apiStartDate);
  const endStr = formatDateOnly(apiEndDate);

  console.log(
    `ZIG: Buscando vendas pendentes da loja ${config.storeId} (${startStr} a ${endStr}, 1 requisição/dia)`,
  );

  try {
    const sales: ZigSale[] = await fetchZigSaidaProdutosRange(
      token,
      config.storeId,
      startStr,
      endStr,
    );

    if (!Array.isArray(sales)) {
      return { sales: [], salesByDate: {}, totalSales: 0, totalValue: 0 };
    }

    const newSales = [];
    const processedKeyPrefix = `zig_processed:${companyId}:`;
    
    for (const sale of sales) {
      const isProcessed = await kv.get(`${processedKeyPrefix}${sale.transactionId}`);
      if (isProcessed) continue;
      newSales.push(sale);
    }

    if (newSales.length === 0) {
      return { sales: [], salesByDate: {}, totalSales: 0, totalValue: 0 };
    }

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId);
      
    if (!products) throw new Error("Erro ao carregar produtos do sistema.");

    let recipesData = [];
    try {
      const { data: recipes, error: recipeError } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*)')
        .eq('company_id', companyId);
        
      if (!recipeError && recipes) {
        recipesData = recipes;
      }
    } catch (e) {
      console.log("Recipes table might not exist, ignoring recipes.");
    }

    // Carregar mapeamentos salvos
    const productMappings = await kv.get(`zig_product_mappings:${companyId}`) || {};

    // Função para encontrar produto com match inteligente
    const findProduct = (sale: ZigSale) => {
      // 1. Verificar mapeamento manual
      if (productMappings[sale.productSku]) {
        return products.find(p => p.id === productMappings[sale.productSku]);
      }
      
      // 2. Match por SKU/Barcode
      let product = products.find(p => 
        p.barcode === sale.productSku || 
        (p.sku && p.sku === sale.productSku)
      );
      
      if (product) return product;
      
      // 3. Match por nome similar (normalizado)
      const normalizeName = (name: string) => 
        name.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
      
      const zigNameNorm = normalizeName(sale.productName);
      
      product = products.find(p => {
        const productNameNorm = normalizeName(p.name);
        return productNameNorm === zigNameNorm || 
               productNameNorm.includes(zigNameNorm) ||
               zigNameNorm.includes(productNameNorm);
      });
      
      return product;
    };

    // Mapear vendas com produtos encontrados e agrupar por data
    const salesWithProducts = [];
    const salesByDate: Record<string, any[]> = {};
    
    for (const sale of newSales) {
      if (!sale.productSku) continue;
      
      const product = findProduct(sale);
      const saleDate = sale.transactionDate.split('T')[0]; // YYYY-MM-DD
      
      if (product) {
        const recipe = recipesData.find(r => r.product_id === product.id);
        
        const saleData = {
          transactionId: sale.transactionId,
          transactionDate: sale.transactionDate,
          saleDate: saleDate,
          productSku: sale.productSku,
          productName: sale.productName,
          quantity: sale.count,
          unitValue: sale.unitValue,
          totalValue: sale.unitValue * sale.count,
          systemProduct: {
            id: product.id,
            name: product.name,
            currentStock: product.current_stock,
            unit: product.unit
          },
          hasRecipe: !!recipe,
          matchType: productMappings[sale.productSku] ? 'manual' : 
                     (product.barcode === sale.productSku || product.sku === sale.productSku) ? 'sku' : 'name',
          recipe: recipe ? {
            ingredients: recipe.recipe_ingredients?.map((ing: any) => {
              const ingProduct = products.find(p => p.id === (ing.product_id || ing.ingredient_id));
              return {
                productId: ing.product_id || ing.ingredient_id,
                productName: ingProduct?.name || 'Desconhecido',
                quantity: ing.quantity || ing.amount,
                unit: ingProduct?.unit || 'un',
                quantityNeeded: (ing.quantity || ing.amount) * sale.count
              };
            }) || []
          } : null
        };
        
        salesWithProducts.push(saleData);
        
        if (!salesByDate[saleDate]) salesByDate[saleDate] = [];
        salesByDate[saleDate].push(saleData);
        
      } else {
        const saleData = {
          transactionId: sale.transactionId,
          transactionDate: sale.transactionDate,
          saleDate: saleDate,
          productSku: sale.productSku,
          productName: sale.productName,
          quantity: sale.count,
          unitValue: sale.unitValue,
          totalValue: sale.unitValue * sale.count,
          systemProduct: null,
          hasRecipe: false,
          recipe: null,
          notFound: true,
          matchType: 'none'
        };
        
        salesWithProducts.push(saleData);
        
        if (!salesByDate[saleDate]) salesByDate[saleDate] = [];
        salesByDate[saleDate].push(saleData);
      }
      
      // Processar adicionais
      if (sale.additions && sale.additions.length > 0) {
        for (const addition of sale.additions) {
          if (!addition.productSku) continue;
          
          const addProduct = products.find(p => 
            p.barcode === addition.productSku || 
            (p.sku && p.sku === addition.productSku)
          );
          
          if (addProduct) {
            const addSaleData = {
              transactionId: `${sale.transactionId}-add-${addition.productSku}`,
              transactionDate: sale.transactionDate,
              saleDate: saleDate,
              productSku: addition.productSku,
              productName: `${sale.productName} (Adicional)`,
              quantity: addition.count,
              unitValue: 0,
              totalValue: 0,
              systemProduct: {
                id: addProduct.id,
                name: addProduct.name,
                currentStock: addProduct.current_stock,
                unit: addProduct.unit
              },
              hasRecipe: false,
              recipe: null,
              isAddition: true,
              matchType: 'sku'
            };
            
            salesWithProducts.push(addSaleData);
            salesByDate[saleDate].push(addSaleData);
          }
        }
      }
    }

    const previewSessionId = crypto.randomUUID();
    const previewLines: ZigConfirmLineItem[] = salesWithProducts.map((s) => ({
      transactionId: s.transactionId,
      productSku: s.productSku,
      productName: s.productName,
      quantity: s.quantity,
    }));
    await kv.set(`zig_preview_session:${companyId}:${previewSessionId}`, {
      lineItems: previewLines,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000,
    });

    return {
      sales: salesWithProducts,
      salesByDate: salesByDate,
      totalSales: salesWithProducts.length,
      totalValue: salesWithProducts.reduce((sum, s) => sum + (s.totalValue || 0), 0),
      dateRange: { start: startStr, end: endStr },
      previewSessionId,
    };
  } catch (error: any) {
    console.error("ZIG: Erro ao buscar vendas pendentes:", error);
    throw error;
  }
};

type DeductionGroup = {
  productSku: string;
  productName: string;
  totalQty: number;
  transactionIds: string[];
};

function addToDeductionGroup(
  groups: Map<string, DeductionGroup>,
  productSku: string,
  productName: string,
  qty: number,
  transactionId: string,
) {
  if (!productSku) return;
  const prev = groups.get(productSku);
  if (!prev) {
    groups.set(productSku, {
      productSku,
      productName,
      totalQty: qty || 0,
      transactionIds: [transactionId],
    });
    return;
  }
  prev.totalQty += qty || 0;
  if (!prev.productName && productName) prev.productName = productName;
  prev.transactionIds.push(transactionId);
}

function buildDeductionGroupsFromZigSales(
  sales: ZigSale[],
  selectedSet: Set<string>,
): Map<string, DeductionGroup> {
  const groups = new Map<string, DeductionGroup>();
  for (const sale of sales) {
    if (sale.productSku && selectedSet.has(sale.transactionId)) {
      addToDeductionGroup(
        groups,
        sale.productSku,
        sale.productName,
        sale.count,
        sale.transactionId,
      );
    }
    if (sale.additions && sale.additions.length > 0) {
      for (const addition of sale.additions) {
        if (!addition.productSku) continue;
        const additionId = `${sale.transactionId}-add-${addition.productSku}`;
        if (!selectedSet.has(additionId)) continue;
        addToDeductionGroup(
          groups,
          addition.productSku,
          `${sale.productName} (Adicional)`,
          addition.count,
          additionId,
        );
      }
    }
  }
  return groups;
}

function buildDeductionGroupsFromLineItems(
  lines: ZigConfirmLineItem[],
  selectedSet: Set<string>,
): Map<string, DeductionGroup> {
  const groups = new Map<string, DeductionGroup>();
  for (const line of lines) {
    if (!line.productSku?.trim()) continue;
    if (!selectedSet.has(line.transactionId)) continue;
    addToDeductionGroup(
      groups,
      line.productSku.trim(),
      line.productName || line.productSku,
      line.quantity,
      line.transactionId,
    );
  }
  return groups;
}

type ExecuteDeductionOpts = {
  registeredOnly: boolean;
  previewSessionIdToClear?: string;
};

/** Baixa de estoque + KV processado; não chama a API ZIG. */
async function executeZigStockDeductionFromGroups(
  companyId: string,
  groups: Map<string, DeductionGroup>,
  opts: ExecuteDeductionOpts,
): Promise<{ processed: number; createdProducts: number; message: string }> {
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId);

  if (!products) throw new Error("Erro ao carregar produtos do sistema.");

  let recipesData: any[] = [];
  try {
    const { data: recipes, error: recipeError } = await supabase
      .from("recipes")
      .select("*, recipe_ingredients(*)")
      .eq("company_id", companyId);

    if (!recipeError && recipes) {
      recipesData = recipes;
    }
  } catch {
    console.log("Recipes table might not exist, ignoring recipes.");
  }
  const processedKeyPrefix = `zig_processed:${companyId}:`;

  if (groups.size === 0) {
    return {
      processed: 0,
      createdProducts: 0,
      message: "Nenhuma transação selecionada para processar.",
    };
  }

  const productMappings = (await kv.get(`zig_product_mappings:${companyId}`)) || {};

  const normalizeName = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const findProduct = (sku: string, zigName?: string) => {
    if (productMappings && productMappings[sku]) {
      return products.find((p: any) => p.id === productMappings[sku]);
    }
    let product = products.find((p: any) =>
      p.barcode === sku || (p.sku && p.sku === sku),
    );
    if (product) return product;
    if (!zigName) return null;
    const zigNameNorm = normalizeName(zigName);
    product = products.find((p: any) => {
      const productNameNorm = normalizeName(p.name || "");
      return (
        productNameNorm === zigNameNorm ||
        productNameNorm.includes(zigNameNorm) ||
        zigNameNorm.includes(productNameNorm)
      );
    });
    return product || null;
  };

  const createdBySku = new Map<string, any>();
  let processedGroups = 0;
  let createdProducts = 0;

  const ensureProduct = async (productSku: string, productName: string) => {
    const alreadyCreated = createdBySku.get(productSku);
    if (alreadyCreated) return alreadyCreated;

    const existing = findProduct(productSku, productName);
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name: productName || productSku,
        category: "outro",
        unit: "un",
        min_stock: 0,
        current_stock: 0,
        cost_price: 0,
        sale_price: 0,
        supplier_id: null,
        barcode: productSku,
        description: null,
        image_url: null,
        status: "active",
        safety_stock: 0,
      })
      .select()
      .single();

    if (createError || !created) {
      throw new Error(createError?.message || "Erro ao criar produto no sistema.");
    }

    createdProducts++;
    products.push(created);
    createdBySku.set(productSku, created);
    return created;
  };

  for (const group of groups.values()) {
    const ref = group.transactionIds.slice(0, 5).join(", ");
    const reason = `Venda ZIG (Lote) - Ref: ${ref}${group.transactionIds.length > 5 ? "..." : ""}`;

    let product: any;
    if (opts.registeredOnly) {
      product = findProduct(group.productSku, group.productName);
      if (!product) {
        console.warn(
          `ZIG: registeredOnly — ignorando SKU sem cadastro: ${group.productSku}`,
        );
        continue;
      }
    } else {
      product = await ensureProduct(group.productSku, group.productName);
    }

    await processStockDeduction(companyId, product, group.totalQty, recipesData, reason);

    for (const id of Array.from(new Set(group.transactionIds))) {
      await kv.set(`${processedKeyPrefix}${id}`, true);
    }

    processedGroups++;
  }

  const sid = opts.previewSessionIdToClear;
  if (sid) {
    try {
      await kv.del(`zig_preview_session:${companyId}:${sid}`);
    } catch {
      /* ignore */
    }
  }

  return {
    processed: processedGroups,
    createdProducts,
    message:
      `${processedGroups} produtos baixados em lote com sucesso${createdProducts > 0 ? ` (produtos criados: ${createdProducts})` : ""}.`,
  };
}

/**
 * Rota dedicada ao PDV: **nunca** chama GET na API ZIG — só snapshot (lineItems ou KV).
 * Use quando `/zig/confirm` ainda acionar código antigo em produção.
 */
export async function confirmStockFromZigPreviewSnapshot(
  companyId: string,
  transactionIds: string[],
  lineItems: ZigConfirmLineItem[] | undefined,
  previewSessionId: string | undefined,
  registeredOnly: boolean,
): Promise<{ processed: number; createdProducts: number; message: string }> {
  const config = await kv.get(`zig_config:${companyId}`);
  if (!config?.storeId) {
    throw new Error("Integração ZIG não configurada.");
  }

  let snapshotLines: ZigConfirmLineItem[] | undefined;
  const sid = previewSessionId?.trim();

  if (sid) {
    const sess = await kv.get(`zig_preview_session:${companyId}:${sid}`) as {
      lineItems?: ZigConfirmLineItem[];
      expiresAt?: number;
    } | null;
    if (!sess?.lineItems || !Array.isArray(sess.lineItems)) {
      throw new Error(
        "Sessão de preview inválida ou expirada. Busque as vendas na ZIG novamente e confirme em seguida.",
      );
    }
    if (typeof sess.expiresAt === "number" && Date.now() > sess.expiresAt) {
      throw new Error("Sessão de preview expirada. Busque as vendas na ZIG novamente.");
    }
    snapshotLines = sess.lineItems;
  } else if (lineItems?.length) {
    snapshotLines = lineItems;
  }

  if (!snapshotLines?.length) {
    throw new Error(
      "É necessário o preview: busque «Buscar vendas pendentes» e confirme, ou envie lineItems / previewSessionId válidos.",
    );
  }

  const selectedSet = new Set(transactionIds);
  const groups = buildDeductionGroupsFromLineItems(snapshotLines, selectedSet);

  console.log(
    `ZIG: confirm snapshot — baixa no Stockpyrou apenas (${transactionIds.length} id(s)), sem API ZIG`,
  );

  return await executeZigStockDeductionFromGroups(companyId, groups, {
    registeredOnly,
    previewSessionIdToClear: sid,
  });
}

export type ConfirmSalesOptions = {
  /** Se true, não cria produto novo — só baixa quando já existe cadastro (SKU/nome/mapeamento). */
  registeredOnly?: boolean;
  /**
   * Linhas do último preview (mesmo período das transações selecionadas).
   * Se presente, **não** chama a API ZIG na confirmação — só baixa no estoque local.
   */
  lineItems?: ZigConfirmLineItem[];
  /**
   * ID retornado em `fetchPendingSales` — linhas gravadas no KV no servidor.
   * Preferir em relação ao body `lineItems` (evita confirmação sem snapshot quando o POST não repete o array).
   */
  previewSessionId?: string;
  /**
   * Confirmação a partir do modal de preview (PDV). Se true e não houver snapshot válido,
   * **não** chama a ZIG — retorna erro claro (evita 500 "5 dias" com deploy antigo ou sessão perdida).
   */
  fromPreview?: boolean;
  /**
   * `true` quando a chamada vem de `POST /zig/confirm` (navegador). Nunca refaz GET na ZIG sem snapshot;
   * `false`/omitido para baixa automática interna (`runAutoBaixaZigOntem`), que ainda busca na ZIG.
   */
  confirmViaHttp?: boolean;
};

// Confirm and Process Sales (Dar baixa efetivamente)
export const confirmSales = async (
  companyId: string,
  transactionIds: string[],
  startDate?: string,
  endDate?: string,
  options?: ConfirmSalesOptions,
) => {
  const config = await kv.get(`zig_config:${companyId}`);
  if (!config || !config.storeId) {
    throw new Error("Integração ZIG não configurada.");
  }

  let apiStartDate: Date;
  let apiEndDate: Date;

  if (startDate && endDate) {
    apiStartDate = parseDateOnly(startDate);
    apiEndDate = parseDateOnly(endDate);
  } else {
    const now = new Date();
    apiEndDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    apiStartDate = new Date(apiEndDate);
    apiStartDate.setUTCDate(apiStartDate.getUTCDate() - 1);
  }

  const startStr = formatDateOnly(apiStartDate);
  const endStr = formatDateOnly(apiEndDate);

  let snapshotLines: ZigConfirmLineItem[] | undefined;
  const sid = options?.previewSessionId?.trim();
  if (sid) {
    const sess = await kv.get(`zig_preview_session:${companyId}:${sid}`) as {
      lineItems?: ZigConfirmLineItem[];
      expiresAt?: number;
    } | null;
    if (!sess?.lineItems || !Array.isArray(sess.lineItems)) {
      throw new Error(
        "Sessão de preview inválida ou expirada. Busque as vendas na ZIG novamente e confirme em seguida.",
      );
    }
    if (typeof sess.expiresAt === "number" && Date.now() > sess.expiresAt) {
      throw new Error(
        "Sessão de preview expirada. Busque as vendas na ZIG novamente.",
      );
    }
    snapshotLines = sess.lineItems;
  } else if (Array.isArray(options?.lineItems) && options!.lineItems!.length > 0) {
    snapshotLines = options!.lineItems;
  }

  const usePreviewSnapshot = Array.isArray(snapshotLines) && snapshotLines.length > 0;

  if (options?.confirmViaHttp === true && !usePreviewSnapshot) {
    throw new Error(
      "Confirmação pelo app sem snapshot de vendas: clique em «Buscar vendas pendentes», aguarde o preview e confirme em seguida. " +
        "Esta rota não chama a API ZIG de novo (evita o erro «5 dias»). Se o preview funcionar e isto continuar, publique a Edge Function `make-server-8a20b27d`.",
    );
  }

  const hasSnapshotPayload =
    (Array.isArray(options?.lineItems) && options.lineItems.length > 0) ||
    !!options?.previewSessionId?.trim();

  if (!usePreviewSnapshot && (options?.fromPreview || hasSnapshotPayload)) {
    throw new Error(
      "Não foi possível usar o snapshot do preview na confirmação (sessão expirada ou dados incompletos). " +
        "Clique em «Buscar vendas pendentes» de novo e confirme em seguida.",
    );
  }

  console.log(
    usePreviewSnapshot
      ? `ZIG: Confirmando baixa só no Stockpyrou (${transactionIds.length} id(s), snapshot do preview — sem nova chamada ZIG)${sid ? " [sessão KV]" : ""}`
      : `ZIG: Confirmando e processando ${transactionIds.length} transações (selecionadas); intervalo ${startStr} → ${endStr}${options?.registeredOnly ? " [apenas produtos cadastrados]" : ""}`,
  );

  try {
    const selectedSet = new Set(transactionIds);

    let groups: Map<string, DeductionGroup>;

    if (usePreviewSnapshot) {
      groups = buildDeductionGroupsFromLineItems(snapshotLines!, selectedSet);
    } else {
      const token = await getZigTokenForCompany(companyId);
      const sales: ZigSale[] = await fetchZigSaidaProdutosRange(
        token,
        config.storeId,
        startStr,
        endStr,
      );
      if (!Array.isArray(sales)) {
        throw new Error("Formato de resposta inválido da API ZIG.");
      }
      groups = buildDeductionGroupsFromZigSales(sales, selectedSet);
    }

    return await executeZigStockDeductionFromGroups(companyId, groups, {
      registeredOnly: !!options?.registeredOnly,
      previewSessionIdToClear: sid,
    });
  } catch (error: any) {
    console.error("ZIG: Erro ao confirmar vendas:", error);
    throw error;
  }
};

// --- Baixa automática (dia seguinte = vendas de "ontem" em SP) — só produtos já cadastrados ---

export async function getAutoBaixaConfig(companyId: string): Promise<{ enabled: boolean }> {
  const row = await kv.get(`zig_auto_baixa:${companyId}`);
  return { enabled: !!(row && row.enabled) };
}

export async function saveAutoBaixaConfig(companyId: string, enabled: boolean): Promise<void> {
  await kv.set(`zig_auto_baixa:${companyId}`, { enabled });
}

function findProductLineForSale(
  sale: ZigSale,
  products: any[],
  productMappings: Record<string, string>,
): any | null {
  if (productMappings[sale.productSku]) {
    return products.find((p) => p.id === productMappings[sale.productSku]);
  }
  let product = products.find(
    (p) => p.barcode === sale.productSku || (p.sku && p.sku === sale.productSku),
  );
  if (product) return product;

  const normalizeName = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const zigNameNorm = normalizeName(sale.productName || "");
  product = products.find((p) => {
    const productNameNorm = normalizeName(p.name || "");
    return (
      productNameNorm === zigNameNorm ||
      productNameNorm.includes(zigNameNorm) ||
      zigNameNorm.includes(productNameNorm)
    );
  });
  return product || null;
}

function findProductBySkuOnly(
  sku: string,
  products: any[],
  productMappings: Record<string, string>,
): any | null {
  if (productMappings[sku]) {
    return products.find((p) => p.id === productMappings[sku]);
  }
  return (
    products.find((p) => p.barcode === sku || (p.sku && p.sku === sku)) ||
    null
  );
}

/** Todas as linhas da transação (principal + adicionais) precisam existir no Stockpyrou. */
function transactionFullyRegistered(
  rows: ZigSale[],
  products: any[],
  productMappings: Record<string, string>,
): boolean {
  let hasLine = false;
  for (const s of rows) {
    if (!s.productSku) continue;
    hasLine = true;
    if (!findProductLineForSale(s, products, productMappings)) return false;
    if (s.additions?.length) {
      for (const a of s.additions) {
        if (!a.productSku) continue;
        if (!findProductBySkuOnly(a.productSku, products, productMappings)) return false;
      }
    }
  }
  return hasLine;
}

/**
 * Busca vendas de ontem (America/Sao_Paulo), considera só transações em que **todos** os itens
 * (incluindo adicionais) têm produto cadastrado no Stockpyrou, e dá baixa com `registeredOnly`.
 */
export async function runAutoBaixaZigOntem(companyId: string) {
  const auto = await getAutoBaixaConfig(companyId);
  if (!auto.enabled) {
    return {
      skipped: true,
      message: "Baixa automática desativada para esta empresa.",
      processed: 0,
    };
  }

  const config = await kv.get(`zig_config:${companyId}`);
  if (!config?.storeId) {
    return {
      skipped: true,
      message: "Integração ZIG não configurada (loja).",
      processed: 0,
    };
  }

  const token = await getZigTokenForCompany(companyId);
  const yesterdayStr = getYesterdayYmdSaoPaulo();

  const sales: ZigSale[] = await fetchZigSaidaProdutosRange(
    token,
    config.storeId,
    yesterdayStr,
    yesterdayStr,
  );

  if (!Array.isArray(sales) || sales.length === 0) {
    return {
      skipped: false,
      message: `Nenhuma venda ZIG em ${yesterdayStr}.`,
      processed: 0,
      date: yesterdayStr,
    };
  }

  const processedKeyPrefix = `zig_processed:${companyId}:`;
  const newSales: ZigSale[] = [];
  for (const sale of sales) {
    const done = await kv.get(`${processedKeyPrefix}${sale.transactionId}`);
    if (!done) newSales.push(sale);
  }

  if (newSales.length === 0) {
    return {
      skipped: false,
      message: "Nenhuma venda nova de ontem pendente de processamento.",
      processed: 0,
      date: yesterdayStr,
    };
  }

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId);

  if (!products?.length) {
    return {
      skipped: true,
      message: "Nenhum produto cadastrado no Stockpyrou.",
      processed: 0,
    };
  }

  const productMappings =
    (await kv.get(`zig_product_mappings:${companyId}`)) || {};

  const txMap = new Map<string, ZigSale[]>();
  for (const s of newSales) {
    if (!txMap.has(s.transactionId)) txMap.set(s.transactionId, []);
    txMap.get(s.transactionId)!.push(s);
  }

  const idSet = new Set<string>();
  for (const [, rows] of txMap) {
    if (!transactionFullyRegistered(rows, products, productMappings)) {
      continue;
    }
    for (const s of rows) {
      idSet.add(s.transactionId);
      if (s.additions?.length) {
        for (const a of s.additions) {
          if (a.productSku) {
            idSet.add(`${s.transactionId}-add-${a.productSku}`);
          }
        }
      }
    }
  }

  const transactionIds = Array.from(idSet);
  if (transactionIds.length === 0) {
    return {
      skipped: false,
      message:
        "Nenhuma transação de ontem com todos os itens cadastrados no Stockpyrou (verifique SKUs e mapeamentos).",
      processed: 0,
      date: yesterdayStr,
    };
  }

  const result = await confirmSales(
    companyId,
    transactionIds,
    yesterdayStr,
    yesterdayStr,
    { registeredOnly: true },
  );

  return {
    skipped: false,
    message: result.message,
    processed: result.processed,
    createdProducts: result.createdProducts,
    date: yesterdayStr,
    transactionCount: transactionIds.length,
  };
}

async function processStockDeduction(
  companyId: string, 
  product: any, 
  qty: number, 
  recipes: any[], 
  refId: string
) {
  const bundleItems = parseBundleItemsFromProduct(product);
  if (bundleItems.length > 0) {
    for (const b of bundleItems) {
      const neededQty = b.quantity * qty;
      if (!b.productId || !Number.isFinite(neededQty) || neededQty <= 0) continue;
      await deductStock(
        b.productId,
        neededQty,
        `Venda ZIG (Combo: ${product.name}) - Ref: ${refId}`,
      );
    }
    return;
  }

  const recipe = recipes.find(r => r.product_id === product.id);

  if (recipe && recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0) {
    for (const ing of recipe.recipe_ingredients) {
      const neededQty = (ing.quantity || ing.amount) * qty;
      await deductStock(ing.product_id || ing.ingredient_id, neededQty, `Venda ZIG (Receita: ${product.name}) - Ref: ${refId}`);
    }
  } else {
    await deductStock(product.id, qty, `Venda ZIG - Ref: ${refId}`);
  }
}

function parseBundleItemsFromProduct(product: any): Array<{ productId: string; quantity: number }> {
  try {
    const desc = product?.description;
    const parsed =
      typeof desc === "string" && desc.trim().startsWith("{") ? JSON.parse(desc) :
      (desc && typeof desc === "object" ? desc : null);
    const items = parsed?.bundleItems;
    if (!Array.isArray(items)) return [];
    return items
      .map((x: any) => ({
        productId: String(x?.productId || ""),
        quantity: Number(x?.quantity || 0),
      }))
      .filter((x) => x.productId && Number.isFinite(x.quantity) && x.quantity > 0);
  } catch {
    return [];
  }
}

async function deductStock(productId: string, qty: number, reason: string) {
  const { data: p, error: pError } = await supabase
    .from('products')
    .select('current_stock, cost_price, company_id')
    .eq('id', productId)
    .single();

  if (pError || !p) {
    throw new Error(
      pError?.message || `Produto ${productId} não encontrado para baixa de estoque.`,
    );
  }

  const newStock = (p.current_stock || 0) - qty;

  const { error: updError } = await supabase
    .from('products')
    .update({
      current_stock: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);

  if (updError) {
    throw new Error(updError.message || 'Erro ao atualizar estoque do produto.');
  }

  const { error: movementError } = await supabase.from('stock_movements').insert({
    company_id: p.company_id,
    product_id: productId,
    movement_type: 'saida',
    quantity: qty,
    unit_cost: p.cost_price || 0,
    total_value: (p.cost_price || 0) * qty,
    notes: `${reason} - Integração automática ZIG`,
    movement_date: new Date().toISOString(),
    type: 'saida',
  });

  if (movementError) {
    console.error('ZIG: Erro ao registrar stock movement:', movementError);
    throw new Error(
      movementError.message || 'Erro ao registrar movimentação de estoque (ZIG).',
    );
  }
}