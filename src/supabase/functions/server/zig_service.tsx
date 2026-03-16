import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from './kv_store.tsx';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ZIG_API_URL = "https://api.zigcore.com.br/integration";
// Token fornecido pelo usuário para integração
const FALLBACK_TOKEN = "58e415ba224c896515f7a6aec1e5a5b6d52cafbb64030e666a7afee436cb8d52";

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

export const getStores = async (redeId?: string): Promise<ZigStore[]> => {
  const token = Deno.env.get("ZIG_API_KEY") || FALLBACK_TOKEN;
  
  // Log para debug (mascarando o token)
  console.log(`ZIG: Usando token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
  
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
        throw new Error("ZIG_TOKEN_INVALID:Token ZIG não configurado ou inválido. Configure um token válido nas variáveis de ambiente (ZIG_API_KEY) para habilitar a integração ZIG.");
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

export const saveConfig = async (companyId: string, storeId: string, redeId?: string) => {
  await kv.set(`zig_config:${companyId}`, { storeId, redeId });
};

export const getConfig = async (companyId: string) => {
  return await kv.get(`zig_config:${companyId}`);
};

// Fetch Pending Sales (Preview - Sem processar)
export const fetchPendingSales = async (companyId: string, startDate?: string, endDate?: string) => {
  const token = Deno.env.get("ZIG_API_KEY") || FALLBACK_TOKEN;

  const config = await kv.get(`zig_config:${companyId}`);
  if (!config || !config.storeId) {
    throw new Error("Integração ZIG não configurada. Selecione uma loja nas configurações.");
  }

  // Se não fornecido, busca últimos 5 dias (respeitando limite da API)
  let apiStartDate: Date;
  let apiEndDate: Date;
  
  if (startDate && endDate) {
    apiStartDate = new Date(startDate);
    apiEndDate = new Date(endDate);
  } else {
    apiEndDate = new Date();
    apiStartDate = new Date();
    apiStartDate.setDate(apiStartDate.getDate() - 5);
  }

  // Validar limite de 5 dias da API ZIG
  const daysDiff = Math.ceil((apiEndDate.getTime() - apiStartDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 5) {
    throw new Error(`A API ZIG permite buscar no máximo 5 dias por vez. Você selecionou ${daysDiff} dias. Por favor, selecione um período menor.`);
  }

  const startStr = apiStartDate.toISOString().split('T')[0];
  const endStr = apiEndDate.toISOString().split('T')[0];

  let url = `${ZIG_API_URL}/erp/saida-produtos?dtinicio=${startStr}&dtfim=${endStr}&loja=${config.storeId}`;
  
  console.log(`ZIG: Buscando vendas pendentes da loja ${config.storeId} (${startStr} a ${endStr})`);

  try {
    const res = await fetch(url, { 
      headers: getHeaders(token)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Falha ao buscar vendas ZIG (${res.status}): ${txt}`);
    }

    const sales: ZigSale[] = await res.json();
    
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
            unit: product.measurement_unit
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
                unit: ingProduct?.measurement_unit || 'un',
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
                unit: addProduct.measurement_unit
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

    return { 
      sales: salesWithProducts,
      salesByDate: salesByDate,
      totalSales: salesWithProducts.length,
      totalValue: salesWithProducts.reduce((sum, s) => sum + (s.totalValue || 0), 0),
      dateRange: { start: startStr, end: endStr }
    };
  } catch (error: any) {
    console.error("ZIG: Erro ao buscar vendas pendentes:", error);
    throw error;
  }
};

// Confirm and Process Sales (Dar baixa efetivamente)
export const confirmSales = async (companyId: string, transactionIds: string[]) => {
  const token = Deno.env.get("ZIG_API_KEY") || FALLBACK_TOKEN;

  const config = await kv.get(`zig_config:${companyId}`);
  if (!config || !config.storeId) {
    throw new Error("Integração ZIG não configurada.");
  }

  const lastSyncKey = `zig_last_sync:${companyId}`;
  const lastSyncVal = await kv.get(lastSyncKey);
  
  let startDate = new Date();
  startDate.setHours(startDate.getHours() - 24); 
  
  if (lastSyncVal) {
    startDate = new Date(lastSyncVal);
  }
  
  const apiStartDate = new Date(startDate);
  apiStartDate.setDate(apiStartDate.getDate() - 1);

  const endDate = new Date();
  const startStr = apiStartDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  let url = `${ZIG_API_URL}/erp/saida-produtos?dtinicio=${startStr}&dtfim=${endStr}&loja=${config.storeId}`;
  
  console.log(`ZIG: Confirmando e processando ${transactionIds.length} vendas`);

  try {
    const res = await fetch(url, { 
      headers: getHeaders(token)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Falha ao buscar vendas ZIG (${res.status}): ${txt}`);
    }

    const sales: ZigSale[] = await res.json();
    
    if (!Array.isArray(sales)) {
      throw new Error("Formato de resposta inválido da API ZIG.");
    }

    // Filtrar apenas as vendas que foram confirmadas
    const salesToProcess = sales.filter(sale => 
      transactionIds.includes(sale.transactionId) ||
      (sale.additions && sale.additions.some(add => 
        transactionIds.includes(`${sale.transactionId}-add-${add.productSku}`)
      ))
    );

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

    let processedCount = 0;
    const processedKeyPrefix = `zig_processed:${companyId}:`;

    for (const sale of salesToProcess) {
      if (!sale.productSku) continue;
      
      const product = products.find(p => p.barcode === sale.productSku || (p.sku && p.sku === sale.productSku));
      
      if (product && transactionIds.includes(sale.transactionId)) {
        await processStockDeduction(companyId, product, sale.count, recipesData, sale.transactionId);
        await kv.set(`${processedKeyPrefix}${sale.transactionId}`, true);
        processedCount++;
      }
      
      if (sale.additions && sale.additions.length > 0) {
        for (const addition of sale.additions) {
          if (!addition.productSku) continue;
          
          const additionId = `${sale.transactionId}-add-${addition.productSku}`;
          if (!transactionIds.includes(additionId)) continue;
          
          const addProduct = products.find(p => p.barcode === addition.productSku || (p.sku && p.sku === addition.productSku));
          if (addProduct) {
            await processStockDeduction(companyId, addProduct, addition.count, recipesData, additionId);
            await kv.set(`${processedKeyPrefix}${additionId}`, true);
          }
        }
      }
    }

    await kv.set(lastSyncKey, endDate.toISOString());

    return { 
      processed: processedCount,
      message: `${processedCount} vendas processadas com sucesso.` 
    };
  } catch (error: any) {
    console.error("ZIG: Erro ao confirmar vendas:", error);
    throw error;
  }
};

// Sync Logic (DEPRECATED - manter para compatibilidade)
export const syncSales = async (companyId: string) => {
  const token = Deno.env.get("ZIG_API_KEY") || FALLBACK_TOKEN;

  const config = await kv.get(`zig_config:${companyId}`);
  if (!config || !config.storeId) {
    throw new Error("Integração ZIG não configurada. Selecione uma loja nas configurações.");
  }

  const lastSyncKey = `zig_last_sync:${companyId}`;
  const lastSyncVal = await kv.get(lastSyncKey);
  
  let startDate = new Date();
  startDate.setHours(startDate.getHours() - 24); 
  
  if (lastSyncVal) {
    startDate = new Date(lastSyncVal);
  }
  
  // Subtrai 1 dia do start date para garantir que não haja problemas com timezone
  const apiStartDate = new Date(startDate);
  apiStartDate.setDate(apiStartDate.getDate() - 1);

  const endDate = new Date();
  const startStr = apiStartDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  let url = `${ZIG_API_URL}/erp/saida-produtos?dtinicio=${startStr}&dtfim=${endStr}&loja=${config.storeId}`;
  
  console.log(`ZIG: Sincronizando vendas da loja ${config.storeId}`);

  try {
    const res = await fetch(url, { 
      headers: getHeaders(token)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Falha ao buscar vendas ZIG (${res.status}): ${txt}`);
    }

    const sales: ZigSale[] = await res.json();
    
    if (!Array.isArray(sales)) {
      return { processed: 0, message: "Nenhuma venda retornada." };
    }

    const newSales = [];
    const processedKeyPrefix = `zig_processed:${companyId}:`;
    
    for (const sale of sales) {
      const isProcessed = await kv.get(`${processedKeyPrefix}${sale.transactionId}`);
      if (isProcessed) continue;

      newSales.push(sale);
    }

    if (newSales.length === 0) {
      await kv.set(lastSyncKey, endDate.toISOString());
      return { processed: 0, message: "Sincronização concluída. Nenhuma nova venda." };
    }

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId);
      
    if (!products) throw new Error("Erro ao carregar produtos do StockWise.");

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

    let processedCount = 0;

    for (const sale of newSales) {
      if (!sale.productSku) continue;
      
      const product = products.find(p => p.barcode === sale.productSku || (p.sku && p.sku === sale.productSku));
      
      if (product) {
        await processStockDeduction(companyId, product, sale.count, recipesData, sale.transactionId);
        processedCount++;
      }
      
      if (sale.additions && sale.additions.length > 0) {
        for (const addition of sale.additions) {
          if (!addition.productSku) continue;
          
          const addProduct = products.find(p => p.barcode === addition.productSku || (p.sku && p.sku === addition.productSku));
          if (addProduct) {
            await processStockDeduction(companyId, addProduct, addition.count, recipesData, `${sale.transactionId}-add-${addition.productSku}`);
          }
        }
      }

      await kv.set(`${processedKeyPrefix}${sale.transactionId}`, true);
    }

    await kv.set(lastSyncKey, endDate.toISOString());

    return { 
      processed: processedCount, 
      total_found: newSales.length,
      message: "Sincronização realizada com sucesso." 
    };
  } catch (error: any) {
    console.error("ZIG: Erro fatal na sincronização:", error);
    throw error;
  }
};

async function processStockDeduction(
  companyId: string, 
  product: any, 
  qty: number, 
  recipes: any[], 
  refId: string
) {
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

async function deductStock(productId: string, qty: number, reason: string) {
  const { data: p, error: pError } = await supabase
    .from('products')
    .select('current_stock, cost_price, company_id')
    .eq('id', productId)
    .single();

  if (pError || !p) return;

  const newStock = (p.current_stock || 0) - qty;
  
  await supabase
    .from('products')
    .update({ 
      current_stock: newStock,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId);
  
  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      company_id: p.company_id,
      product_id: productId,
      movement_type: 'saida',
      quantity: qty,
      unit_cost: p.cost_price || 0,
      total_value: (p.cost_price || 0) * qty,
      notes: `${reason} - Integração automática ZIG`,
      movement_date: new Date().toISOString()
    });
    
  if (movementError) {
    console.error("ZIG: Erro ao registrar stock movement:", movementError);
  }
}