import { Hono, type Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";
import * as zig from "./zig_service.tsx";
import type { ZigConfirmLineItem } from "./zig_service.tsx";
import * as costs from "./costs.tsx";

// Helper to verify token (Custom or Supabase)
async function verifyAnyToken(token: string) {
  // If token starts with "custom_", only try custom verification
  if (token.startsWith('custom_')) {
    return await auth.verifyCustomToken(token);
  }
  
  // Otherwise, try Supabase token first
  let profile = await auth.verifySupabaseToken(token);
  
  // If Supabase fails, try custom as fallback
  if (!profile) {
    profile = await auth.verifyCustomToken(token);
  }
  
  return profile;
}

// Helper to get companyId from profile, header, or user_companies table
async function getCompanyId(profile: any, supabase: any, headerCompanyId?: string | null): Promise<string | null> {
  // 1. Try header first (from frontend context)
  if (headerCompanyId) {
    console.log('✅ Using companyId from header:', headerCompanyId);
    return headerCompanyId;
  }
  
  // 2. Try profile
  if (profile.companyId) {
    console.log('✅ Using companyId from profile:', profile.companyId);
    return profile.companyId;
  }
  
  console.log('⚠️ No companyId in header or profile, trying to get from user_companies');
  
  // 3. Try to get from user_companies table
  const { data: userCompanies } = await supabase
    .from('user_companies')
    .select('company_id')
    .eq('user_id', profile.id)
    .limit(1);
  
  if (userCompanies && userCompanies.length > 0) {
    const companyId = userCompanies[0].company_id;
    console.log('✅ Found companyId from user_companies:', companyId);
    return companyId;
  }
  
  console.log('❌ No company association found for user');
  return null;
}

const app = new Hono();

// Enable logger
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "apikey",
      "X-Client-Info",
      "X-Zig-Confirm-Source",
    ],
  }),
);
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Health check endpoint
app.get("/make-server-8a20b27d/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== INVOICE MANAGEMENT ====================

// Check if invoice already exists
app.post("/make-server-8a20b27d/invoices/check", async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await verifyAnyToken(token);
    if (!profile) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const companyId = await getCompanyId(profile, supabaseAdmin, c.req.header('X-Company-Id'));
    if (!companyId) {
      return c.json({ error: 'No company association found' }, 400);
    }

    const { invoiceId, invoiceNumber, invoiceSeries } = await c.req.json();
    
    if (!invoiceId && !invoiceNumber) {
      return c.json({ error: 'Invoice ID or number required' }, 400);
    }

    // Check in KV store
    const key = invoiceId || `${companyId}:invoice:${invoiceSeries}-${invoiceNumber}`;
    const existingInvoice = await kv.get(`invoice:${key}`);

    if (existingInvoice) {
      return c.json({ 
        exists: true, 
        invoice: existingInvoice,
        message: `Nota fiscal ${invoiceNumber || invoiceId} já foi importada anteriormente`
      });
    }

    return c.json({ exists: false });
  } catch (error: any) {
    console.error('Invoice check error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Register invoice as imported
app.post("/make-server-8a20b27d/invoices/register", async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await verifyAnyToken(token);
    if (!profile) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const companyId = await getCompanyId(profile, supabaseAdmin, c.req.header('X-Company-Id'));
    if (!companyId) {
      return c.json({ error: 'No company association found' }, 400);
    }

    const { invoiceId, invoiceNumber, invoiceSeries, items } = await c.req.json();
    
    if (!invoiceId && !invoiceNumber) {
      return c.json({ error: 'Invoice ID or number required' }, 400);
    }

    // Store in KV
    const key = invoiceId || `${companyId}:invoice:${invoiceSeries}-${invoiceNumber}`;
    const invoiceData = {
      invoiceId,
      invoiceNumber,
      invoiceSeries,
      companyId,
      userId: profile.id,
      importedAt: new Date().toISOString(),
      itemsCount: items?.length || 0,
    };

    await kv.set(`invoice:${key}`, invoiceData);

    return c.json({ 
      success: true,
      message: 'Nota fiscal registrada com sucesso'
    });
  } catch (error: any) {
    console.error('Invoice register error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== ZIG INTEGRATION ====================
// Fluxos documentados em `zig_service.tsx` (produção = preview + confirm snapshot).

app.get("/make-server-8a20b27d/zig/stores", async (c) => {
  try {
    const redeId = c.req.query("rede") || "35c5259d-4d3a-4934-9dd2-78a057a3aa8f";
    const companyId = c.req.query("companyId") || undefined;
    const headerToken = c.req.header("X-ZIG-TOKEN") || undefined;
    const token = await zig.resolveZigTokenForStores(companyId, headerToken);
    const stores = await zig.getStores(token, redeId);
    return c.json({ stores });
  } catch (error: any) {
    console.error('Zig Stores Error:', error);
    
    // Tratamento especial para token inválido - integração não disponível
    if (error.message.startsWith('ZIG_TOKEN_INVALID:')) {
      const cleanMessage = error.message.replace('ZIG_TOKEN_INVALID:', '');
      return c.json({ 
        stores: [],
        available: false,
        warning: cleanMessage,
        needsConfiguration: true
      }, 200); // Retorna 200 OK mas com flag de não disponível
    }
    
    // Determinar o status code apropriado baseado na mensagem de erro
    let statusCode = 500;
    if (error.message.includes('Token ZIG inválido') || error.message.includes('InvalidToken')) {
      statusCode = 400;
    } else if (error.message.includes('ID da Rede')) {
      statusCode = 400;
    } else if (error.message.includes('sem permissão')) {
      statusCode = 403;
    }
    
    // Retornar erro com status apropriado
    return c.json({ 
      error: error.message, 
      details: error.toString(),
      statusCode,
      available: false
    }, statusCode);
  }
});

app.post("/make-server-8a20b27d/zig/config", async (c) => {
  try {
    const { companyId, storeId, redeId, zigToken } = await c.req.json();
    if (!companyId || !storeId) return c.json({ error: "Missing required fields" }, 400);
    
    await zig.saveConfig(companyId, storeId, redeId, zigToken);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Zig Config Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-8a20b27d/zig/config/:companyId", async (c) => {
  try {
    const companyId = c.req.param("companyId");
    const config = await zig.getConfig(companyId);
    return c.json({ config });
  } catch (error: any) {
    console.error('Zig Get Config Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-8a20b27d/zig/sync", async (c) => {
  try {
    const { companyId } = await c.req.json();
    if (!companyId) return c.json({ error: "Missing companyId" }, 400);
    
    const result = await zig.syncSales(companyId);
    return c.json(result);
  } catch (error: any) {
    console.error("Zig Sync Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Zig Preview Pending Sales (Busca vendas sem processar)
app.post("/make-server-8a20b27d/zig/preview", async (c) => {
  try {
    const { companyId, startDate, endDate } = await c.req.json();
    if (!companyId) return c.json({ error: "Missing companyId" }, 400);
    
    const result = await zig.fetchPendingSales(companyId, startDate, endDate);
    return c.json(result);
  } catch (error: any) {
    console.error("Zig Preview Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PDV / navegador: confirma baixa **só** com snapshot (lineItems ou sessão KV).
 * Não chama `confirmSales` nem GET na API ZIG — evita 500 «5 dias» em produção antiga.
 * Baixa automática usa `confirmSales` só dentro de `zig_service` (cron), não esta rota.
 */
async function handleZigConfirmHttp(c: Context) {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { companyId, transactionIds, registeredOnly, lineItems, previewSessionId } =
      body;
    if (!companyId || !transactionIds) {
      return c.json({ error: "Missing companyId or transactionIds" }, 400);
    }

    const sid =
      typeof previewSessionId === "string" && previewSessionId.trim().length > 0
        ? previewSessionId.trim()
        : undefined;

    const lineItemsArr = Array.isArray(lineItems) ? lineItems : [];

    if (lineItemsArr.length === 0 && !sid) {
      return c.json(
        {
          error:
            "Use «Buscar vendas pendentes» antes de confirmar. É necessário lineItems ou previewSessionId no corpo.",
        },
        400,
      );
    }

    const result = await zig.confirmStockFromZigPreviewSnapshot(
      companyId as string,
      transactionIds as string[],
      lineItemsArr.length > 0 ? (lineItemsArr as ZigConfirmLineItem[]) : undefined,
      sid,
      !!registeredOnly,
    );
    /** Confirma que esta rota não chama GET na API ZIG (diagnóstico no DevTools → Network). */
    c.header("X-Zig-Confirm-Handler", "snapshot-only");
    return c.json(result);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Zig Confirm Error:", error);
    return c.json({ error: err?.message || "Erro no processamento" }, 500);
  }
}

app.post("/make-server-8a20b27d/zig/confirm", handleZigConfirmHttp);
app.post("/zig/confirm", handleZigConfirmHttp);

/** Alias da mesma lógica que `/zig/confirm` (snapshot apenas). */
app.post("/make-server-8a20b27d/zig/confirm-preview", handleZigConfirmHttp);
app.post("/zig/confirm-preview", handleZigConfirmHttp);

/** GET: verifique no navegador se o deploy inclui o handler novo (deve listar `confirmStockFromZigPreviewSnapshot`). */
app.get("/make-server-8a20b27d/zig/meta", (c) =>
  c.json({
    zigConfirmPostHandler: "confirmStockFromZigPreviewSnapshot",
    callsZigApiOnConfirm: false,
  }),
);
app.get("/zig/meta", (c) =>
  c.json({
    zigConfirmPostHandler: "confirmStockFromZigPreviewSnapshot",
    callsZigApiOnConfirm: false,
  }),
);

app.get("/make-server-8a20b27d/zig/auto-baixa/:companyId", async (c) => {
  try {
    const companyId = c.req.param("companyId");
    const cfg = await zig.getAutoBaixaConfig(companyId);
    return c.json(cfg);
  } catch (error: any) {
    console.error("Zig auto-baixa get Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-8a20b27d/zig/auto-baixa", async (c) => {
  try {
    const { companyId, enabled } = await c.req.json();
    if (!companyId || typeof enabled !== "boolean") {
      return c.json({ error: "Missing companyId or enabled (boolean)" }, 400);
    }
    await zig.saveAutoBaixaConfig(companyId, enabled);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Zig auto-baixa save Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/** Executa uma vez a baixa automática de ontem (teste manual pela UI). */
app.post("/make-server-8a20b27d/zig/auto-run", async (c) => {
  try {
    const { companyId } = await c.req.json();
    if (!companyId) return c.json({ error: "Missing companyId" }, 400);
    const result = await zig.runAutoBaixaZigOntem(companyId);
    return c.json(result);
  } catch (error: any) {
    console.error("Zig auto-run Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Cron diário: chamar com header Authorization: Bearer <ZIG_AUTO_CRON_SECRET> ou X-ZIG-CRON-SECRET.
 * Processa todas as empresas com baixa automática ativa.
 */
app.post("/make-server-8a20b27d/zig/cron-auto-yesterday", async (c) => {
  try {
    const secret = Deno.env.get("ZIG_AUTO_CRON_SECRET");
    const bearer = c.req.header("Authorization")?.replace("Bearer ", "") || "";
    const xh = c.req.header("X-ZIG-CRON-SECRET") || "";
    if (!secret || (bearer !== secret && xh !== secret)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: companies, error } = await supabaseAdmin.from("companies").select("id");
    if (error) return c.json({ error: error.message }, 500);

    const results: Record<string, unknown>[] = [];
    for (const co of companies || []) {
      try {
        const r = await zig.runAutoBaixaZigOntem(co.id);
        results.push({ companyId: co.id, ...r });
      } catch (e: any) {
        results.push({ companyId: co.id, error: e.message });
      }
    }

    return c.json({ ok: true, results });
  } catch (error: any) {
    console.error("Zig cron-auto-yesterday Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== ADMIN DATA MANAGEMENT ====================

// Clear selected data for a company (admin only)
app.post("/make-server-8a20b27d/admin/clear-data", async (c) => {
  try {
    const { companyId, confirmationCode, options } = await c.req.json();
    
    console.log(`🗑️ [ADMIN] Received clear-data request:`, {
      companyId,
      companyIdType: typeof companyId,
      confirmationCode,
      options
    });
    
    if (!companyId) {
      return c.json({ error: 'Missing companyId' }, 400);
    }

    // Security check: confirmation code must be "LIMPAR"
    if (confirmationCode !== 'LIMPAR') {
      return c.json({ error: 'Invalid confirmation code' }, 400);
    }

    // Check if at least one option is selected
    if (!options || !Object.values(options).some((v: any) => v)) {
      return c.json({ error: 'No options selected' }, 400);
    }

    console.log(`🗑️ [ADMIN] Clearing selected data for company: ${companyId}`, options);
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const deletions: any = {};

    // 1. Zero stock quantities in Postgres (without deleting products)
    if (options.stockQuantities) {
      console.log(`🔄 Zeroing stock quantities for company: ${companyId}`);
      
      const { count, error } = await supabaseAdmin
        .from('products')
        .update({ current_stock: 0, updated_at: new Date().toISOString() })
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error zeroing stock:', error);
        throw new Error(`Failed to zero stock: ${error.message}`);
      }
      
      deletions.stockQuantities = count || 0;
      console.log(`✅ Zeroed stock for ${count || 0} products`);
    }

    // 2. Delete price history from Postgres
    if (options.priceHistory) {
      console.log(`🗑️ Deleting price history for company: ${companyId}`);
      
      const { count, error } = await supabaseAdmin
        .from('price_history')
        .delete()
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error deleting price history:', error);
        throw new Error(`Failed to delete price history: ${error.message}`);
      }
      
      deletions.priceHistory = count || 0;
      console.log(`✅ Deleted ${count || 0} price history records`);
    }

    // 3. Delete stock movements from Postgres
    if (options.movements) {
      console.log(`🗑️ Deleting stock movements for company: ${companyId}`);
      
      const { count, error } = await supabaseAdmin
        .from('stock_movements')
        .delete()
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error deleting movements:', error);
        throw new Error(`Failed to delete movements: ${error.message}`);
      }
      
      deletions.movements = count || 0;
      console.log(`✅ Deleted ${count || 0} stock movements`);
    }

    // 4. Delete stock entries from Postgres
    if (options.stockEntries) {
      console.log(`🗑️ Deleting stock entries for company: ${companyId}`);
      
      const { count, error } = await supabaseAdmin
        .from('stock_entries')
        .delete()
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error deleting stock entries:', error);
        throw new Error(`Failed to delete stock entries: ${error.message}`);
      }
      
      deletions.stockEntries = count || 0;
      console.log(`✅ Deleted ${count || 0} stock entries`);
    }

    // 5. Delete sales and cash movements from Postgres
    if (options.sales) {
      console.log(`🗑️ Deleting sales and cash data for company: ${companyId}`);
      
      // Delete cash movements first (foreign key dependency)
      const { count: movementsCount } = await supabaseAdmin
        .from('cash_movements')
        .delete()
        .eq('company_id', companyId);
      
      // Delete sales
      const { count: salesCount } = await supabaseAdmin
        .from('sales')
        .delete()
        .eq('company_id', companyId);
      
      // Delete cash registers
      const { count: registersCount } = await supabaseAdmin
        .from('cash_registers')
        .delete()
        .eq('company_id', companyId);
      
      deletions.sales = (salesCount || 0) + (registersCount || 0) + (movementsCount || 0);
      console.log(`✅ Deleted ${salesCount || 0} sales, ${registersCount || 0} registers, ${movementsCount || 0} cash movements`);
    }

    // 6. Delete suppliers from Postgres
    if (options.suppliers) {
      console.log(`🗑️ Deleting suppliers for company: ${companyId}`);
      
      const { count, error } = await supabaseAdmin
        .from('suppliers')
        .delete()
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error deleting suppliers:', error);
        throw new Error(`Failed to delete suppliers: ${error.message}`);
      }
      
      deletions.suppliers = count || 0;
      console.log(`✅ Deleted ${count || 0} suppliers`);
    }

    // 7. Delete products from Postgres (must be last, after dependencies)
    if (options.products) {
      console.log(`🗑️ Deleting products for company: ${companyId}`);
      
      // Delete recipe ingredients first (foreign key)
      await supabaseAdmin
        .from('recipe_ingredients')
        .delete()
        .eq('company_id', companyId);
      
      // Delete sale items
      await supabaseAdmin
        .from('sale_items')
        .delete()
        .eq('company_id', companyId);
      
      // Now delete products
      const { count, error } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error deleting products:', error);
        throw new Error(`Failed to delete products: ${error.message}`);
      }
      
      deletions.products = count || 0;
      console.log(`✅ Deleted ${count || 0} products`);
    }

    console.log('✅ [ADMIN] Data cleared successfully:', deletions);

    return c.json({
      success: true,
      message: 'Selected data cleared successfully',
      deletions
    });

  } catch (error: any) {
    console.error('❌ [ADMIN] Clear data error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== DEBUG ENDPOINTS ====================

// Get current user company details (for custom auth users)
app.get("/make-server-8a20b27d/companies/me", async (c) => {
  try {
    let token = c.req.header('X-Custom-Token');
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.includes('custom_')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const profile = await verifyAnyToken(token);

    if (!profile) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const companyId = await getCompanyId(profile, supabase);
    if (!companyId) {
      return c.json({ error: 'Company not found or unauthorized' }, 404);
    }

    // Direct KV access to bypass RLS
    const companyData = await kv.get(`company:${companyId}`);
    
    if (!companyData) {
       // Fallback to Supabase if not in KV (though custom auth usually implies KV)
       const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      const { data: company } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).single();
      
      if (!company) return c.json({ error: 'Company not found' }, 404);
      
      return c.json({
        company: {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          createdAt: company.created_at,
          status: 'active'
        }
      });
    }

    const company = companyData as any;
    return c.json({
      company: {
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        createdAt: company.created_at || company.createdAt,
        status: company.status || 'active'
      }
    });
  } catch (error: any) {
    console.error('❌ Get my company error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== AUTH ROUTES ====================

// Initialize System - Creates default admin if not exists
app.post("/make-server-8a20b27d/auth/init", async (c) => {
  try {
    console.log('🚀 System Init: Checking for default admin (v2)...');
    
    // Check if admin already exists
    const adminEmailIndex = await kv.get('user:email:admin@stockwise.com');
    
    if (adminEmailIndex) {
      console.log('✅ Admin already exists');
      return c.json({
        success: true,
        message: 'System already initialized',
        adminExists: true
      });
    }
    
    console.log('⚙️ Creating default superadmin user...');
    
    // Create SUPERADMIN user in custom system
    const result = await auth.createCustomUser(
      'admin@stockwise.com',
      'Admin@123456',
      'Administrador',
      'superadmin',
      'Super Admin'
    );
    
    if (!result.success) {
      console.error('❌ Failed to create admin:', result.error);
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }
    
    console.log('✅ Admin user created successfully!');
    
    // Also try to create in Supabase Auth (don't fail if it already exists)
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      await supabaseAdmin.auth.admin.createUser({
        email: 'admin@stockwise.com',
        password: 'Admin@123456',
        email_confirm: true,
        user_metadata: { name: 'Administrador', role: 'superadmin' }
      });
      
      console.log('✅ Admin also created in Supabase Auth');
    } catch (supabaseError: any) {
      console.log('⚠️ Supabase Auth creation skipped:', supabaseError.message);
    }
    
    return c.json({
      success: true,
      message: 'System initialized successfully with superadmin!',
      adminCreated: true,
      credentials: {
        email: 'admin@stockwise.com',
        password: 'Admin@123456',
        role: 'superadmin'
      }
    });
  } catch (error: any) {
    console.error('❌ System init error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Promote user to superadmin (for migration)
app.post("/make-server-8a20b27d/auth/promote-superadmin", async (c) => {
  try {
    const { email, secretKey } = await c.req.json();
    
    console.log('🔑 [PROMOTE] Request to promote user to superadmin:', email);
    
    // Security: require a secret key (you can change this)
    const expectedSecret = Deno.env.get('SUPERADMIN_SECRET') || 'pyroustock-superadmin-2024';
    
    if (secretKey !== expectedSecret) {
      console.error('[PROMOTE] ❌ Invalid secret key');
      return c.json({ error: 'Unauthorized - Invalid secret key' }, 401);
    }
    
    // Get user by email
    const emailIndex = await kv.get(`user:email:${email}`);
    
    if (!emailIndex || typeof emailIndex !== 'object') {
      console.error('[PROMOTE] ❌ User not found:', email);
      return c.json({ error: 'User not found' }, 404);
    }
    
    const userId = (emailIndex as any).userId;
    const profileData = await kv.get(`user:${userId}`);
    
    if (!profileData) {
      console.error('[PROMOTE] ❌ User profile not found');
      return c.json({ error: 'User profile not found' }, 404);
    }
    
    const profile = profileData as any;
    
    console.log('[PROMOTE] 👤 Current role:', profile.role);
    
    // Update role to superadmin
    profile.role = 'superadmin';
    profile.permissions = auth.getPermissionsByRole('superadmin');
    profile.updatedAt = new Date();
    
    await kv.set(`user:${userId}`, profile);
    
    console.log('[PROMOTE] ✅ User promoted to superadmin successfully!');
    
    return c.json({
      success: true,
      message: `User ${email} promoted to superadmin successfully`,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role
      }
    });
  } catch (error: any) {
    console.error('[PROMOTE] ❌ Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Custom Login (sem Supabase Auth)
app.post("/make-server-8a20b27d/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    console.log('🔐 LOGIN REQUEST:', { email, passwordLength: password?.length });

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Verificar se está bloqueado
    const isLocked = await auth.isAccountLocked(email);
    if (isLocked) {
      console.log('❌ Account locked:', email);
      return c.json({ 
        error: 'Account locked due to multiple failed login attempts. Try again in 15 minutes.' 
      }, 403);
    }

    // Tentar login
    console.log('🔍 Calling auth.loginWithPassword...');
    const result = await auth.loginWithPassword(email, password);
    console.log('🔍 Login result:', { success: result.success, hasUser: !!result.user, hasToken: !!result.token, error: result.error });

    if (!result.success) {
      await auth.trackFailedLogin(email);
      console.log('❌ Login failed for:', email);
      return c.json({ error: result.error || 'Invalid email or password' }, 401);
    }

    console.log('✅ Login successful for:', email);
    return c.json({ 
      user: result.user,
      token: result.token 
    });
  } catch (error: any) {
    console.error('💥 Error in login route:', error);
    return c.json({ error: error?.message || 'Unknown error during login' }, 500);
  }
});

// Verify custom token
app.get("/make-server-8a20b27d/auth/verify", async (c) => {
  try {
    let token = c.req.header('X-Custom-Token');
    
    // Fallback to Authorization header if it looks like a custom token
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.includes('custom_')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    if (!token) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const profile = await verifyAnyToken(token);

    if (!profile) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    return c.json({ user: profile });
  } catch (error: any) {
    console.error('Error verifying token:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Custom Logout
app.post("/make-server-8a20b27d/auth/logout", async (c) => {
  try {
    let token = c.req.header('X-Custom-Token');
    
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.includes('custom_')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    if (token) {
      await auth.logoutCustom(token);
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Error in logout:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Sign up - Create new user (admin only)
app.post("/make-server-8a20b27d/auth/signup", async (c) => {
  try {
    // Verify admin access (skip for first user creation)
    const usersListData = await kv.get('users:list');
    const hasUsers = usersListData && Array.isArray(usersListData) && usersListData.length > 0;
    
    if (hasUsers) {
      let token = c.req.header('X-Custom-Token');
      
      if (!token) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.includes('custom_')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (!token) {
        return c.json({ error: 'Unauthorized - No token provided' }, 401);
      }

      const profile = await verifyAnyToken(token);
      if (!profile || !profile.permissions?.canManageUsers) {
        return c.json({ error: 'Unauthorized - Admin access required' }, 401);
      }
    }

    const { email, password, fullName, role, position } = await c.req.json();

    if (!email || !password || !fullName || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Usar autenticação customizada
    const result = await auth.createCustomUser(email, password, fullName, role, position);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ user: result.user }, 201);
  } catch (error: any) {
    console.error('Error in signup:', error);
    return c.json({ error: error?.message || 'Unknown error during signup' }, 500);
  }
});

// Get current user profile
app.get("/make-server-8a20b27d/auth/me", async (c) => {
  try {
    console.log('🔍 /auth/me called');
    let token = c.req.header('X-Custom-Token');
    
    if (!token) {
      const authHeader = c.req.header('Authorization');
      console.log('📋 Authorization header:', authHeader?.substring(0, 20) + '...');
      if (authHeader && authHeader.includes('custom_')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    console.log('🎫 Token found:', token ? 'Yes (length: ' + token.length + ')' : 'No');
    
    if (!token) {
      console.log('❌ No token provided');
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    console.log('🔐 Verifying token...');
    const profile = await verifyAnyToken(token);

    if (!profile) {
      console.log('❌ Token verification failed - profile is null');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('✅ Token verified successfully for:', profile.email);
    return c.json({ user: profile });
  } catch (error: any) {
    console.error('💥 Error getting current user:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== USER MANAGEMENT ROUTES ====================

// Get all users (admin only)
app.get("/make-server-8a20b27d/users", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    const companyIdParam = c.req.query('companyId'); // Get company filter from query params
    console.log('📋 Getting users - Token provided:', customToken ? 'Yes' : 'No');
    console.log('🏢 Company filter requested:', companyIdParam || 'None');
    
    if (!customToken) {
      console.log('❌ No token provided');
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    console.log('👤 User profile:', profile ? profile.email : 'Not found');
    console.log('👤 User role:', profile?.role);
    console.log('👤 User permissions:', profile?.permissions);

    if (!profile) {
      console.log('❌ Profile not found');
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Super admin always has access
    const isSuperAdmin = profile.role === 'superadmin';
    const hasPermission = profile.permissions?.canManageUsers;
    
    console.log('🔐 Is super admin:', isSuperAdmin);
    console.log('🔐 Has canManageUsers permission:', hasPermission);

    if (!isSuperAdmin && !hasPermission) {
      console.log('❌ Unauthorized - User does not have permission to manage users');
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    console.log('✅ User has permission, fetching users...');
    
    // If companyId is provided, filter users by company
    if (companyIdParam) {
      console.log(`🔍 Filtering users by company: ${companyIdParam}`);
      
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      const users: any[] = [];
      
      // Get user IDs linked to this company from user_companies table
      const { data: userCompanies, error } = await supabaseAdmin
        .from('user_companies')
        .select('user_id')
        .eq('company_id', companyIdParam);
      
      if (error) {
        console.error('❌ Error fetching user companies:', error);
      } else if (userCompanies && userCompanies.length > 0) {
        const userIds = userCompanies.map(uc => uc.user_id);
        console.log(`📊 Found ${userIds.length} user IDs in user_companies for company`);
        
        // Fetch profiles for these user IDs from KV
        for (const userId of userIds) {
          try {
            const profileData = await kv.get(`user:${userId}`);
            if (profileData) {
              users.push(profileData);
            }
          } catch (profileError) {
            console.error(`❌ Error getting profile for user ${userId}:`, profileError);
            continue;
          }
        }
      }
      
      // ALSO check company_credentials table for legacy admin users
      console.log(`🔍 Checking company_credentials for legacy users...`);
      const { data: credentials, error: credError } = await supabaseAdmin
        .from('company_credentials')
        .select('*')
        .eq('company_id', companyIdParam);
      
      if (credError) {
        console.error('❌ Error fetching company credentials:', credError);
      } else if (credentials && credentials.length > 0) {
        console.log(`📋 Found ${credentials.length} credentials in legacy table for company`);
        
        for (const cred of credentials) {
          // Check if user already in list (by email) to avoid duplicates
          if (!users.find(u => u.email === cred.admin_email)) {
            // Try to get full profile from app_users first
            const { data: appUser } = await supabaseAdmin
              .from('app_users')
              .select('*')
              .eq('email', cred.admin_email)
              .eq('company_id', companyIdParam)
              .single();
            
            if (appUser) {
              // User exists in app_users, use that profile
              const role = auth.mapAppUserRole(appUser.role);
              users.push({
                id: appUser.id,
                email: appUser.email,
                fullName: appUser.full_name,
                role: role,
                companyId: appUser.company_id,
                permissions: auth.getPermissionsByRole(role),
                status: appUser.is_active ? 'active' : 'inactive',
                createdAt: new Date(appUser.created_at),
                updatedAt: new Date(),
                failedLoginAttempts: 0
              });
              console.log(`✅ Added user from app_users: ${appUser.email}`);
            } else {
              // Create virtual profile for legacy credential
              users.push({
                id: cred.id,
                email: cred.admin_email,
                fullName: 'Admin (Legacy)',
                role: 'admin',
                companyId: cred.company_id,
                permissions: auth.getPermissionsByRole('admin'),
                status: cred.is_active ? 'active' : 'inactive',
                createdAt: new Date(cred.created_at),
                updatedAt: new Date(cred.updated_at),
                failedLoginAttempts: 0,
                isLegacy: true // Mark as legacy so UI can show a badge
              });
              console.log(`✅ Added legacy credential user: ${cred.admin_email}`);
            }
          }
        }
      }
      
      console.log(`✅ Returning ${users.length} users for company ${companyIdParam}`);
      return c.json({ users });
    }
    
    // Otherwise return all users (for super admin dashboard)
    const users = await auth.getAllUsers();

    // ------------------------------------------------------------------
    // FIX: Also fetch users from company_credentials table (Legacy/Migrated)
    // ------------------------------------------------------------------
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      const { data: credentials } = await supabaseAdmin
        .from('company_credentials')
        .select('*');
      
      if (credentials && Array.isArray(credentials)) {
        console.log(`📋 Found ${credentials.length} credentials in legacy table`);
        
        for (const cred of credentials) {
          // Check if user already in list (by email) to avoid duplicates
          if (!users.find(u => u.email === cred.admin_email)) {
            // Create virtual profile for display
            users.push({
              id: cred.id, // Use credential ID as user ID
              email: cred.admin_email,
              fullName: 'Admin (Legacy)',
              role: 'admin',
              companyId: cred.company_id,
              permissions: auth.getPermissionsByRole('admin'),
              status: cred.is_active ? 'active' : 'inactive',
              createdAt: new Date(cred.created_at),
              updatedAt: new Date(cred.updated_at),
              failedLoginAttempts: 0
            });
          }
        }
      }
    } catch (credError) {
      console.error('⚠️ Error fetching legacy credentials:', credError);
      // Don't fail the whole request, just log
    }
    // ------------------------------------------------------------------

    console.log(`📊 Found ${users.length} total users (combined)`);
    
    return c.json({ users });
  } catch (error: any) {
    console.error('❌ Error getting users:', error);
    console.error('Error stack:', error?.stack);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Update user (admin only)
app.put("/make-server-8a20b27d/users/:id", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageUsers) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const userId = c.req.param('id');
    const updates = await c.req.json();

    const result = await auth.updateUser(userId, updates);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ user: result.user });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Reset user password (admin only)
app.post("/make-server-8a20b27d/users/:id/reset-password", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageUsers) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const userId = c.req.param('id');
    const { newPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Usar método customizado para resetar senha
    const result = await auth.resetCustomUserPassword(userId, newPassword);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Delete/Deactivate user (admin only)
app.delete("/make-server-8a20b27d/users/:id", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageUsers) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const userId = c.req.param('id');
    
    // Prevent self-deletion
    if (userId === profile.id) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    const result = await auth.deleteUser(userId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'User deactivated successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Admin Route: Create user and link to company
app.post("/make-server-8a20b27d/admin/create-user", async (c) => {
  try {
    const { email, password, fullName, role, companyId } = await c.req.json();

    if (!email || !password || !fullName || !role || !companyId) {
      return c.json({ error: 'Missing required fields (email, password, fullName, role, companyId)' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let userId: string;

    // Check if user already exists in Supabase Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // User already exists, just use their ID
      userId = existingUser.id;
      console.log(`[ADMIN] User already exists: ${email} (${userId}), linking to company`);
      
      // Update password to ensure the admin-provided password works
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: password });
      console.log(`[ADMIN] Updated password for existing user: ${email}`);
    } else {
      // Create new user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: fullName,
          role: role,
          company_id: companyId
        }
      });

      if (authError || !authData.user) {
        return c.json({ error: authError?.message || 'Failed to create auth user' }, 400);
      }

      userId = authData.user.id;
      console.log(`[ADMIN] Created new user: ${email} (${userId})`);
    }

    // Check if user is already linked to this company
    const { data: existingLink } = await supabaseAdmin
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    if (existingLink) {
      console.log(`[ADMIN] User ${email} is already linked to company ${companyId}`);
      return c.json({ 
        success: true, 
        message: 'User already linked to this company',
        user: { id: userId, email }
      });
    }

    // Link user to company in DB
    const { error: linkError } = await supabaseAdmin
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: role
      });

    if (linkError) {
      console.error('[ADMIN] Error linking user to company:', linkError);
      return c.json({ error: 'Failed to link user to company: ' + linkError.message }, 400);
    }

    // Sync to app_users table for hybrid login support
    try {
      const passwordHash = auth.hashPassword(password);
      const dbRole = role === 'superadmin' ? 'super_admin' : 
                     role === 'admin' ? 'admin' : 
                     role === 'gerente' ? 'manager' : 'user';

      const { error: appUserError } = await supabaseAdmin
        .from('app_users')
        .upsert({
          id: userId,
          email: email,
          password_hash: passwordHash,
          full_name: fullName,
          role: dbRole,
          company_id: companyId,
          is_active: true
        });
        
      if (appUserError) {
         console.error('[ADMIN] Failed to sync to app_users:', appUserError);
      } else {
         console.log('[ADMIN] Successfully synced user to app_users table');
      }
    } catch (syncError) {
      console.error('[ADMIN] Error syncing to app_users:', syncError);
    }

    // Also create/update custom profile in KV for compatibility with existing code
    const permissions = auth.getPermissionsByRole(role as any);
    const passwordHash = auth.hashPassword(password);
    
    await kv.set(`user:${userId}`, {
      id: userId,
      email,
      fullName,
      role,
      permissions,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash // Include password hash for KV login
    });

    // CRITICAL: Create email index for login to work
    await kv.set(`user:email:${email}`, { userId });
    console.log(`[ADMIN] Created email index for ${email}`);
    
    // CRITICAL: Add to users list
    const usersListData = await kv.get('users:list');
    const usersList = Array.isArray(usersListData) ? usersListData : [];
    if (!usersList.includes(userId)) {
      usersList.push(userId);
      await kv.set('users:list', usersList);
      console.log(`[ADMIN] Added ${email} to users list`);
    }

    console.log(`[ADMIN] Successfully linked user ${email} to company ${companyId}`);
    return c.json({ success: true, user: { id: userId, email, fullName, role } });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: Create new company
app.post("/make-server-8a20b27d/admin/create-company", async (c) => {
  try {
    const { name, cnpj, email } = await c.req.json();
    if (!name) return c.json({ error: 'Name is required' }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Insert into database (only name and cnpj - no email, no status)
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        cnpj
      })
      .select()
      .single();

    if (error) throw error;

    // Set status in KV for faster checking
    await kv.set(`company_status:${company.id}`, 'active');
    
    // Save company in KV Store with email for company login feature
    await kv.set(`company:${company.id}`, {
      id: company.id,
      name: company.name,
      cnpj: company.cnpj,
      email: email || '', // Store email in KV even if not in DB
      status: 'active', // Status only in KV
      created_at: company.created_at,
      createdAt: company.created_at
    });
    
    // Set default password if email provided
    if (email) {
      const defaultPassword = '123456';
      const hashedPassword = auth.hashPassword(defaultPassword);
      await kv.set(`company_password:${company.id}`, hashedPassword);
      console.log(`✅ Created company ${company.name} with default password for email: ${email}`);
    }

    return c.json({ success: true, company: { ...company, email, status: 'active' } });
  } catch (error: any) {
    console.error('Admin create company error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: List all companies with status
app.get("/make-server-8a20b27d/admin/companies", async (c) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let { data: companies, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Query Error:', error);
      companies = [];
    }

    // Auto-seed if empty (Requirement: Fuego Bar)
    if (!companies || companies.length === 0) {
      console.log('Seeding default company: Fuego Bar');
      const { data: newCompany, error: seedError } = await supabaseAdmin
        .from('companies')
        .insert({ name: 'Fuego Bar', cnpj: '12.345.678/0001-90' })
        .select()
        .single();
      
      if (!seedError && newCompany) {
        companies = [newCompany];
        await kv.set(`company_status:${newCompany.id}`, 'active');
      }
    }

    const companiesWithStatus = await Promise.all((companies || []).map(async (company) => {
      const status = await kv.get(`company_status:${company.id}`);
      return {
        ...company,
        status: status || 'active'
      };
    }));

    return c.json({ companies: companiesWithStatus });
  } catch (error: any) {
    console.error('Admin companies error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Superadmin Route: Get ALL companies (bypasses RLS with Service Role Key)
app.get("/make-server-8a20b27d/superadmin/companies", async (c) => {
  try {
    console.log('👑 [SUPERADMIN] Fetching ALL companies...');
    
    // Verify token
    let token = c.req.header('X-Custom-Token');
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
      }
    }
    
    console.log('[SUPERADMIN] 🔑 Token received:', token ? `Yes (${token.startsWith('custom_') ? 'Custom' : 'JWT'}, length: ${token.length})` : 'No');
    
    if (!token) {
      console.error('[SUPERADMIN] ❌ No token provided');
      return c.json({ error: 'No authorization token provided' }, 401);
    }
    
    // Verify user is superadmin
    console.log('[SUPERADMIN] 🔍 Verifying token...');
    const profile = await verifyAnyToken(token);
    
    if (!profile) {
      console.error('[SUPERADMIN] ❌ Invalid token - verification returned null');
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }
    
    console.log('[SUPERADMIN] ✅ Token verified - User:', profile.email, '- Role:', profile.role);
    
    if (profile.role !== 'superadmin') {
      console.error('[SUPERADMIN] ❌ User is not superadmin:', profile.role);
      return c.json({ error: 'Unauthorized - Superadmin access required' }, 403);
    }
    
    console.log('[SUPERADMIN] ✅ Superadmin verified:', profile.email);
    
    // Use Service Role Key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: companies, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('name');

    if (error) {
      console.error('[SUPERADMIN] ❌ Database error:', error);
      return c.json({ error: error.message }, 500);
    }

    // Get status from KV for each company
    const companiesWithStatus = await Promise.all((companies || []).map(async (company) => {
      const status = await kv.get(`company_status:${company.id}`);
      return {
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        created_at: company.created_at,
        createdAt: company.created_at,
        status: status || 'active'
      };
    }));

    console.log(`[SUPERADMIN] ✅ Returning ${companiesWithStatus.length} companies`);

    return c.json({ companies: companiesWithStatus });
  } catch (error: any) {
    console.error('[SUPERADMIN] ❌ Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: Force sync all companies to KV Store with default passwords
app.post("/make-server-8a20b27d/admin/companies/sync", async (c) => {
  try {
    console.log('🔄 Starting company sync...');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: companies, error } = await supabaseAdmin
      .from('companies')
      .select('*');

    if (error) {
      console.error('Error fetching companies:', error);
      return c.json({ error: 'Failed to fetch companies' }, 500);
    }

    if (!companies || companies.length === 0) {
      console.log('No companies to sync');
      return c.json({ success: true, message: 'No companies to sync', synced: 0 });
    }

    let syncedCount = 0;
    let passwordsSet = 0;
    
    for (const company of companies) {
      try {
        // Check if company already exists in KV (may have email stored there)
        const existingKvCompany = await kv.get(`company:${company.id}`);
        const companyEmail = existingKvCompany && typeof existingKvCompany === 'object' 
          ? (existingKvCompany as any).email 
          : '';
        
        // Sync to KV Store (preserve email if it exists)
        await kv.set(`company:${company.id}`, {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          email: companyEmail, // Use existing email from KV or empty
          status: company.status || 'active',
          created_at: company.created_at,
          createdAt: company.created_at
        });
        
        syncedCount++;
        console.log(`✅ Synced company: ${company.name} (${companyEmail || 'no email'})`);
        
        // Set default password if email exists
        if (companyEmail) {
          const existingPassword = await kv.get(`company_password:${company.id}`);
          if (!existingPassword) {
            const defaultPassword = '123456';
            const hashedPassword = auth.hashPassword(defaultPassword);
            await kv.set(`company_password:${company.id}`, hashedPassword);
            passwordsSet++;
            console.log(`🔑 Set default password for: ${companyEmail}`);
          } else {
            console.log(`⏭️ Password already exists for: ${companyEmail}`);
          }
        } else {
          console.log(`⚠️ No email for company: ${company.name} - cannot set password`);
        }
        
        // Sync status
        await kv.set(`company_status:${company.id}`, company.status || 'active');
        
      } catch (companyError: any) {
        console.error(`Error syncing company ${company.id}:`, companyError);
      }
    }
    
    console.log(`✅ Sync complete: ${syncedCount} companies synced, ${passwordsSet} passwords set`);
    
    return c.json({ 
      success: true, 
      message: `Synced ${syncedCount} companies, set ${passwordsSet} new passwords`,
      synced: syncedCount,
      passwordsSet: passwordsSet
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: Toggle company status
app.post("/make-server-8a20b27d/admin/companies/:id/status", async (c) => {
  try {
    const companyId = c.req.param('id');
    const { status } = await c.req.json();

    if (!['active', 'inactive'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    await kv.set(`company_status:${companyId}`, status);
    return c.json({ success: true, status });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: Change company password
app.post("/make-server-8a20b27d/admin/companies/:id/change-password", async (c) => {
  try {
    const companyId = c.req.param('id');
    const { newPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    // Hash the new password using the same method as auth.tsx
    const hashedPassword = auth.hashPassword(newPassword);

    // Update password in KV store
    await kv.set(`company_password:${companyId}`, hashedPassword);
    
    console.log(`[ADMIN] Password changed for company ${companyId}`);
    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('[ADMIN] Change password error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Admin Route: Delete company
app.delete("/make-server-8a20b27d/admin/companies/:id", async (c) => {
  try {
    const companyId = c.req.param('id');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log(`[ADMIN] Starting deletion process for company: ${companyId}`);

    // Step 1: Get all users linked to this company
    const { data: userCompanies, error: userCompaniesError } = await supabaseAdmin
      .from('user_companies')
      .select('user_id')
      .eq('company_id', companyId);

    if (userCompaniesError) {
      console.error('[ADMIN] Error fetching user_companies:', userCompaniesError);
    }

    // Step 2: Delete all user_companies references
    const { error: deleteUserCompaniesError } = await supabaseAdmin
      .from('user_companies')
      .delete()
      .eq('company_id', companyId);

    if (deleteUserCompaniesError) {
      console.error('[ADMIN] Error deleting user_companies:', deleteUserCompaniesError);
      throw deleteUserCompaniesError;
    }

    console.log(`[ADMIN] Deleted ${userCompanies?.length || 0} user_companies references`);

    // Step 3: Delete company from database
    const { error: deleteCompanyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (deleteCompanyError) {
      console.error('[ADMIN] Error deleting company:', deleteCompanyError);
      throw deleteCompanyError;
    }

    console.log(`[ADMIN] Deleted company from database`);

    // Step 4: Clean up KV Store data
    await kv.del(`company_status:${companyId}`);
    await kv.del(`company:${companyId}`);
    await kv.del(`company_password:${companyId}`);

    console.log(`[ADMIN] Cleaned up KV Store data for company ${companyId}`);

    return c.json({ success: true, message: 'Company deleted successfully' });
  } catch (error: any) {
    console.error('Delete company error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Public/Auth Route: Check company status
app.get("/make-server-8a20b27d/companies/:id/status", async (c) => {
  try {
    const companyId = c.req.param('id');
    const status = await kv.get(`company_status:${companyId}`);
    return c.json({ status: status || 'active' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Check if account is locked
app.post("/make-server-8a20b27d/auth/check-lockout", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const isLocked = await auth.isAccountLocked(email);
    return c.json({ isLocked });
  } catch (error: any) {
    console.error('Error checking lockout:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Track failed login
app.post("/make-server-8a20b27d/auth/track-failed-login", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    await auth.trackFailedLogin(email);
    return c.json({ message: 'Failed login tracked' });
  } catch (error: any) {
    console.error('Error tracking failed login:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== PRODUCTS ENDPOINTS ====================

// Get all products
app.get("/make-server-8a20b27d/products", async (c) => {
  try {
    const products = await kv.getByPrefix('product:');
    return c.json({ products });
  } catch (error: any) {
    console.error('Error getting products:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create product
app.post("/make-server-8a20b27d/products", async (c) => {
  try {
    const productData = await c.req.json();
    const productId = crypto.randomUUID();
    
    const product = {
      id: productId,
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await kv.set(`product:${productId}`, product);
    return c.json({ product }, 201);
  } catch (error: any) {
    console.error('Error creating product:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Update product
app.put("/make-server-8a20b27d/products/:id", async (c) => {
  try {
    const productId = c.req.param('id');
    const updates = await c.req.json();
    
    const existing = await kv.get(`product:${productId}`);
    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const updated = {
      ...existing,
      ...updates,
      id: productId,
      updatedAt: new Date(),
    };

    await kv.set(`product:${productId}`, updated);
    return c.json({ product: updated });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Delete product
app.delete("/make-server-8a20b27d/products/:id", async (c) => {
  try {
    const productId = c.req.param('id');
    await kv.del(`product:${productId}`);
    return c.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== SUPPLIERS ENDPOINTS ====================

// Get all suppliers
app.get("/make-server-8a20b27d/suppliers", async (c) => {
  try {
    const suppliers = await kv.getByPrefix('supplier:');
    return c.json({ suppliers });
  } catch (error: any) {
    console.error('Error getting suppliers:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create supplier
app.post("/make-server-8a20b27d/suppliers", async (c) => {
  try {
    const supplierData = await c.req.json();
    const supplierId = crypto.randomUUID();
    
    const supplier = {
      id: supplierId,
      ...supplierData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await kv.set(`supplier:${supplierId}`, supplier);
    return c.json({ supplier }, 201);
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== STOCK ENTRIES ENDPOINTS ====================

// Get all stock entries
app.get("/make-server-8a20b27d/stock-entries", async (c) => {
  try {
    const entries = await kv.getByPrefix('stock-entry:');
    // Sort by entryDate descending
    entries.sort((a: any, b: any) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    return c.json({ entries });
  } catch (error: any) {
    console.error('Error getting stock entries:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create stock entry
app.post("/make-server-8a20b27d/stock-entries", async (c) => {
  try {
    const entryData = await c.req.json();
    const entryId = crypto.randomUUID();
    
    const entry = {
      id: entryId,
      ...entryData,
      entryDate: new Date(),
    };

    await kv.set(`stock-entry:${entryId}`, entry);
    return c.json({ entry }, 201);
  } catch (error: any) {
    console.error('Error creating stock entry:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== STOCK MOVEMENTS ENDPOINTS ====================

// Get all stock movements
app.get("/make-server-8a20b27d/stock-movements", async (c) => {
  try {
    const movements = await kv.getByPrefix('stock-movement:');
    // Sort by date descending
    movements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return c.json({ movements });
  } catch (error: any) {
    console.error('Error getting stock movements:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create stock movement
app.post("/make-server-8a20b27d/stock-movements", async (c) => {
  try {
    const movementData = await c.req.json();
    const movementId = crypto.randomUUID();
    
    const movement = {
      id: movementId,
      ...movementData,
      date: new Date(),
    };

    await kv.set(`stock-movement:${movementId}`, movement);
    return c.json({ movement }, 201);
  } catch (error: any) {
    console.error('Error creating stock movement:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== RECIPES ENDPOINTS ====================

// Get all recipes
app.get("/make-server-8a20b27d/recipes", async (c) => {
  try {
    const recipes = await kv.getByPrefix('recipe:');
    return c.json({ recipes });
  } catch (error: any) {
    console.error('Error getting recipes:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create recipe
app.post("/make-server-8a20b27d/recipes", async (c) => {
  try {
    const recipeData = await c.req.json();
    const recipeId = crypto.randomUUID();
    
    const recipe = {
      id: recipeId,
      ...recipeData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await kv.set(`recipe:${recipeId}`, recipe);
    return c.json({ recipe }, 201);
  } catch (error: any) {
    console.error('Error creating recipe:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Update recipe
app.put("/make-server-8a20b27d/recipes/:id", async (c) => {
  try {
    const recipeId = c.req.param('id');
    const updates = await c.req.json();
    
    const existing = await kv.get(`recipe:${recipeId}`);
    if (!existing) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    const updated = {
      ...existing,
      ...updates,
      id: recipeId,
      updatedAt: new Date(),
    };

    await kv.set(`recipe:${recipeId}`, updated);
    return c.json({ recipe: updated });
  } catch (error: any) {
    console.error('Error updating recipe:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== PRICE HISTORY ENDPOINTS ====================

// Get all price history
app.get("/make-server-8a20b27d/price-history", async (c) => {
  try {
    const history = await kv.getByPrefix('price-history:');
    // Sort by date descending
    history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return c.json({ history });
  } catch (error: any) {
    console.error('Error getting price history:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// Create price history
app.post("/make-server-8a20b27d/price-history", async (c) => {
  try {
    const historyData = await c.req.json();
    const historyId = crypto.randomUUID();
    
    const history = {
      id: historyId,
      ...historyData,
      date: new Date(),
    };

    await kv.set(`price-history:${historyId}`, history);
    return c.json({ history }, 201);
  } catch (error: any) {
    console.error('Error creating price history:', error);
    return c.json({ error: error?.message || 'Unknown error' }, 500);
  }
});

// ==================== CASH REGISTER (CAIXA) ROUTES ====================

// Open cash register
app.post("/make-server-8a20b27d/cashier/open", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    console.log('💰 Opening cash register - Token provided:', customToken ? 'Yes' : 'No');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const { initialBalance, cashierId, cashierName } = body;

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const finalCashierId = cashierId || profile.id;
    const finalCashierName = cashierName || profile.fullName;

    // Check if there's already an open register for this user in SQL
    const { data: existingRegisters, error: checkError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', companyId)
      .eq('cashier_id', finalCashierId)
      .eq('status', 'open');

    if (checkError) {
      console.error('Error checking existing registers:', checkError);
      return c.json({ error: 'Erro ao verificar caixas existentes' }, 500);
    }

    if (existingRegisters && existingRegisters.length > 0) {
      const existingRegister = existingRegisters[0];
      console.log('⚠️ User already has open register:', existingRegister.id);
      
      // Return the existing register instead of error
      return c.json({ 
        success: true, 
        register: {
          id: existingRegister.id,
          companyId: existingRegister.company_id,
          cashierId: existingRegister.cashier_id,
          cashierName: existingRegister.cashier_name,
          initialBalance: parseFloat(existingRegister.initial_balance),
          currentBalance: parseFloat(existingRegister.current_balance),
          openedAt: existingRegister.opened_at,
          status: existingRegister.status,
        }
      });
    }

    // Create new register in SQL
    const { data: newRegister, error: insertError } = await supabase
      .from('cash_registers')
      .insert({
        company_id: companyId,
        cashier_id: finalCashierId,
        cashier_name: finalCashierName,
        initial_balance: parseFloat(initialBalance) || 0,
        current_balance: parseFloat(initialBalance) || 0,
        status: 'open',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting register:', insertError);
      return c.json({ error: 'Erro ao criar caixa' }, 500);
    }

    const registerData = {
      id: newRegister.id,
      companyId: newRegister.company_id,
      cashierId: newRegister.cashier_id,
      cashierName: newRegister.cashier_name,
      initialBalance: parseFloat(newRegister.initial_balance),
      currentBalance: parseFloat(newRegister.current_balance),
      openedAt: newRegister.opened_at,
      status: newRegister.status,
    };

    console.log('✅ Cash register opened:', registerData.id);

    return c.json({ success: true, register: registerData });
  } catch (error: any) {
    console.error('💥 Error opening cash register:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get current open register
app.get("/make-server-8a20b27d/cashier/current", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    console.log('💰 Getting current register - Token provided:', customToken ? 'Yes (' + customToken.substring(0, 20) + '...)' : 'No');
    
    if (!customToken) {
      console.log('❌ No token in request');
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    console.log('👤 Profile verified:', profile ? `${profile.id} - ${profile.fullName}` : 'null');
    
    if (!profile) {
      console.log('❌ Invalid token - profile is null');
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Get companyId from header, profile, or user_companies table
    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    
    if (!companyId) {
      return c.json({ error: 'User has no company association' }, 400);
    }

    console.log('🔍 Looking for open register for user:', profile.id, 'company:', companyId);
    
    // Query SQL for open register
    const { data: openRegisters, error: queryError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', companyId)
      .eq('cashier_id', profile.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('Error querying registers:', queryError);
      return c.json({ error: 'Erro ao buscar caixa' }, 500);
    }

    if (!openRegisters || openRegisters.length === 0) {
      console.log('ℹ️ No open register for user:', profile.id);
      return c.json({ register: null });
    }

    const register = openRegisters[0];

    // Get sales for this register
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('register_id', register.id)
      .order('timestamp', { ascending: true });

    if (salesError) {
      console.error('❌ Error fetching sales:', salesError);
    }

    const sales = (salesData || []).map(sale => ({
      id: sale.id,
      items: sale.items,
      total: parseFloat(sale.total),
      paymentMethod: sale.payment_method,
      paymentDetails: sale.payment_details,
      timestamp: sale.timestamp,
      cashierId: sale.cashier_id,
      cashierName: sale.cashier_name,
    }));

    console.log('📊 Sales loaded for register:', sales.length);

    const registerData = {
      id: register.id,
      companyId: register.company_id,
      cashierId: register.cashier_id,
      cashierName: register.cashier_name,
      initialBalance: parseFloat(register.initial_balance),
      currentBalance: parseFloat(register.current_balance),
      openedAt: register.opened_at,
      status: register.status,
      salesCount: sales.length,
      sales: sales,
    };

    console.log('✅ Found open register:', registerData.id, 'Sales count:', registerData.salesCount);
    return c.json({ register: registerData });
  } catch (error: any) {
    console.error('💥 Error getting current register:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Record a sale
app.post("/make-server-8a20b27d/cashier/sale", async (c) => {
  try {
    console.log('🛒 POST /cashier/sale - Starting sale registration');
    
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const body = await c.req.json();
    const { registerId, items, total, paymentMethod, paymentDetails } = body;

    console.log('📦 Sale data:', {
      registerId,
      itemsCount: items.length,
      total,
      paymentMethod,
      companyId
    });

    // Get the register from SQL
    const { data: register, error: registerError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('id', registerId)
      .eq('company_id', companyId)
      .single();
    
    if (registerError || !register) {
      console.error('❌ Error getting register:', registerError);
      return c.json({ error: 'Caixa não encontrado' }, 404);
    }

    if (register.status !== 'open') {
      console.error('❌ Register is not open:', register.status);
      return c.json({ error: 'Caixa não está aberto' }, 400);
    }

    console.log('✅ Register found and open:', register.id);

    // Insert sale into SQL
    const salePayload = {
      company_id: companyId,
      register_id: registerId,
      cashier_id: profile.id,
      cashier_name: profile.fullName,
      total: parseFloat(total),
      payment_method: paymentMethod,
      payment_details: paymentDetails || {},
      items: items,
    };
    
    console.log('💾 Inserting sale into database:', salePayload);

    const { data: newSale, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
      .select()
      .single();

    if (saleError) {
      console.error('❌ Error inserting sale:', saleError);
      return c.json({ error: 'Erro ao registrar venda: ' + saleError.message }, 500);
    }

    console.log('✅ Sale inserted successfully:', newSale.id);

    // Update register balance (only for cash and pix)
    let newBalance = parseFloat(register.current_balance);
    if (paymentMethod === 'money' || paymentMethod === 'pix') {
      newBalance += parseFloat(total);
      
      console.log('💰 Updating register balance:', {
        oldBalance: register.current_balance,
        newBalance,
        total
      });

      const { error: updateError } = await supabase
        .from('cash_registers')
        .update({ current_balance: newBalance })
        .eq('id', registerId);

      if (updateError) {
        console.error('❌ Error updating balance:', updateError);
      } else {
        console.log('✅ Balance updated successfully');
      }
    }

    const sale = {
      id: newSale.id,
      items: newSale.items,
      total: parseFloat(newSale.total),
      paymentMethod: newSale.payment_method,
      paymentDetails: newSale.payment_details,
      timestamp: newSale.timestamp,
      cashierId: newSale.cashier_id,
      cashierName: newSale.cashier_name,
    };

    const updatedRegister = {
      id: register.id,
      companyId: register.company_id,
      cashierId: register.cashier_id,
      cashierName: register.cashier_name,
      initialBalance: parseFloat(register.initial_balance),
      currentBalance: newBalance,
      openedAt: register.opened_at,
      status: register.status,
    };

    console.log('✅ Sale recorded successfully:', sale.id);
    console.log('📊 Final response data:', {
      saleId: sale.id,
      total: sale.total,
      newBalance: updatedRegister.currentBalance
    });

    return c.json({ success: true, sale, register: updatedRegister });
  } catch (error: any) {
    console.error('💥 Error recording sale:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Record withdrawal (sangria)
app.post("/make-server-8a20b27d/cashier/withdrawal", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const body = await c.req.json();
    const { registerId, amount, reason } = body;

    // Get the register from SQL
    const { data: register, error: registerError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('id', registerId)
      .eq('company_id', companyId)
      .single();
    
    if (registerError || !register) {
      return c.json({ error: 'Caixa não encontrado' }, 404);
    }

    if (register.status !== 'open') {
      return c.json({ error: 'Caixa não está aberto' }, 400);
    }

    // Insert withdrawal into cash_movements
    const { data: newMovement, error: movementError } = await supabase
      .from('cash_movements')
      .insert({
        company_id: companyId,
        register_id: registerId,
        type: 'withdrawal',
        amount: parseFloat(amount),
        reason: reason,
        performed_by_id: profile.id,
        performed_by_name: profile.fullName,
      })
      .select()
      .single();

    if (movementError) {
      console.error('Error inserting withdrawal:', movementError);
      return c.json({ error: 'Erro ao registrar sangria' }, 500);
    }

    // Update register balance
    const newBalance = parseFloat(register.current_balance) - parseFloat(amount);
    
    const { error: updateError } = await supabase
      .from('cash_registers')
      .update({ current_balance: newBalance })
      .eq('id', registerId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return c.json({ error: 'Erro ao atualizar saldo' }, 500);
    }

    const withdrawal = {
      id: newMovement.id,
      amount: parseFloat(newMovement.amount),
      reason: newMovement.reason,
      timestamp: newMovement.timestamp,
      performedBy: newMovement.performed_by_name,
    };

    const updatedRegister = {
      id: register.id,
      companyId: register.company_id,
      cashierId: register.cashier_id,
      cashierName: register.cashier_name,
      initialBalance: parseFloat(register.initial_balance),
      currentBalance: newBalance,
      openedAt: register.opened_at,
      status: register.status,
    };

    return c.json({ success: true, withdrawal, register: updatedRegister });
  } catch (error: any) {
    console.error('💥 Error recording withdrawal:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Record deposit (reforço)
app.post("/make-server-8a20b27d/cashier/deposit", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const body = await c.req.json();
    const { registerId, amount, reason } = body;

    // Get the register from SQL
    const { data: register, error: registerError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('id', registerId)
      .eq('company_id', companyId)
      .single();
    
    if (registerError || !register) {
      return c.json({ error: 'Caixa não encontrado' }, 404);
    }

    if (register.status !== 'open') {
      return c.json({ error: 'Caixa não está aberto' }, 400);
    }

    // Insert deposit into cash_movements
    const { data: newMovement, error: movementError } = await supabase
      .from('cash_movements')
      .insert({
        company_id: companyId,
        register_id: registerId,
        type: 'deposit',
        amount: parseFloat(amount),
        reason: reason,
        performed_by_id: profile.id,
        performed_by_name: profile.fullName,
      })
      .select()
      .single();

    if (movementError) {
      console.error('Error inserting deposit:', movementError);
      return c.json({ error: 'Erro ao registrar reforço' }, 500);
    }

    // Update register balance
    const newBalance = parseFloat(register.current_balance) + parseFloat(amount);
    
    const { error: updateError } = await supabase
      .from('cash_registers')
      .update({ current_balance: newBalance })
      .eq('id', registerId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return c.json({ error: 'Erro ao atualizar saldo' }, 500);
    }

    const deposit = {
      id: newMovement.id,
      amount: parseFloat(newMovement.amount),
      reason: newMovement.reason,
      timestamp: newMovement.timestamp,
      performedBy: newMovement.performed_by_name,
    };

    const updatedRegister = {
      id: register.id,
      companyId: register.company_id,
      cashierId: register.cashier_id,
      cashierName: register.cashier_name,
      initialBalance: parseFloat(register.initial_balance),
      currentBalance: newBalance,
      openedAt: register.opened_at,
      status: register.status,
    };

    return c.json({ success: true, deposit, register: updatedRegister });
  } catch (error: any) {
    console.error('💥 Error recording deposit:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Close cash register
app.post("/make-server-8a20b27d/cashier/close", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const body = await c.req.json();
    const { registerId, finalBalance, notes } = body;

    // Get the register from SQL
    const { data: register, error: registerError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('id', registerId)
      .eq('company_id', companyId)
      .single();
    
    if (registerError || !register) {
      return c.json({ error: 'Caixa não encontrado' }, 404);
    }

    if (register.status !== 'open') {
      return c.json({ error: 'Caixa já está fechado' }, 400);
    }

    // Get sales for this register
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('register_id', registerId);

    // Get movements for this register
    const { data: movements, error: movementsError } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('register_id', registerId);

    const salesData = sales || [];
    const movementsData = movements || [];

    // Calculate summary
    const totalSales = salesData.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    const totalWithdrawals = movementsData
      .filter(m => m.type === 'withdrawal')
      .reduce((sum, m) => sum + parseFloat(m.amount), 0);
    const totalDeposits = movementsData
      .filter(m => m.type === 'deposit')
      .reduce((sum, m) => sum + parseFloat(m.amount), 0);
    
    const expectedBalance = parseFloat(register.initial_balance) + totalSales + totalDeposits - totalWithdrawals;
    const difference = parseFloat(finalBalance) - expectedBalance;

    const paymentBreakdown = calculatePaymentBreakdown(salesData);

    // Update register to closed
    const { data: closedRegister, error: updateError } = await supabase
      .from('cash_registers')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', registerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error closing register:', updateError);
      return c.json({ error: 'Erro ao fechar caixa' }, 500);
    }

    const registerData = {
      id: closedRegister.id,
      companyId: closedRegister.company_id,
      cashierId: closedRegister.cashier_id,
      cashierName: closedRegister.cashier_name,
      initialBalance: parseFloat(closedRegister.initial_balance),
      currentBalance: parseFloat(closedRegister.current_balance),
      openedAt: closedRegister.opened_at,
      closedAt: closedRegister.closed_at,
      status: closedRegister.status,
      closedBy: profile.fullName,
      finalBalance: parseFloat(finalBalance),
      expectedBalance: expectedBalance,
      difference: difference,
      notes: notes,
      summary: {
        totalSales,
        totalWithdrawals,
        totalDeposits,
        salesCount: salesData.length,
        paymentBreakdown,
      },
      sales: salesData,
      withdrawals: movementsData.filter(m => m.type === 'withdrawal'),
      deposits: movementsData.filter(m => m.type === 'deposit'),
    };

    console.log('✅ Cash register closed:', registerId);

    return c.json({ success: true, register: registerData });
  } catch (error: any) {
    console.error('💥 Error closing cash register:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get closed registers (history)
app.get("/make-server-8a20b27d/cashier/history", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const limit = parseInt(c.req.query('limit') || '30');
    
    // Get closed registers from SQL
    const { data: closedRegisters, error: queryError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(limit);

    if (queryError) {
      console.error('Error getting history:', queryError);
      return c.json({ error: 'Erro ao buscar histórico' }, 500);
    }

    // For each closed register, get sales and movements
    const registers = await Promise.all(
      (closedRegisters || []).map(async (reg) => {
        // Get sales
        const { data: sales } = await supabase
          .from('sales')
          .select('*')
          .eq('register_id', reg.id);

        // Get movements
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('register_id', reg.id);

        const salesData = sales || [];
        const movementsData = movements || [];

        // Calculate totals
        const totalSales = salesData.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
        const totalWithdrawals = movementsData
          .filter(m => m.type === 'withdrawal')
          .reduce((sum, m) => sum + parseFloat(m.amount), 0);
        const totalDeposits = movementsData
          .filter(m => m.type === 'deposit')
          .reduce((sum, m) => sum + parseFloat(m.amount), 0);

        const paymentBreakdown = calculatePaymentBreakdown(salesData);
        
        const expectedBalance = parseFloat(reg.initial_balance) + totalSales - totalWithdrawals + totalDeposits;
        const finalBalance = parseFloat(reg.current_balance);
        const difference = finalBalance - expectedBalance;

        // Format sales for frontend
        const formattedSales = salesData.map(sale => ({
          id: sale.id,
          items: sale.items || [],
          total: parseFloat(sale.total),
          paymentMethod: sale.payment_method,
          timestamp: sale.timestamp,
        }));

        // Format movements
        const withdrawals = movementsData
          .filter(m => m.type === 'withdrawal')
          .map(m => ({
            id: m.id,
            amount: parseFloat(m.amount),
            reason: m.reason,
            timestamp: m.created_at,
          }));

        const deposits = movementsData
          .filter(m => m.type === 'deposit')
          .map(m => ({
            id: m.id,
            amount: parseFloat(m.amount),
            reason: m.reason,
            timestamp: m.created_at,
          }));

        return {
          id: reg.id,
          companyId: reg.company_id,
          cashierId: reg.cashier_id,
          cashierName: reg.cashier_name,
          initialBalance: parseFloat(reg.initial_balance),
          currentBalance: parseFloat(reg.current_balance),
          finalBalance: finalBalance,
          expectedBalance: expectedBalance,
          difference: difference,
          openedAt: reg.opened_at,
          closedAt: reg.closed_at,
          closedBy: reg.closed_by_name || reg.cashier_name,
          status: reg.status,
          notes: reg.notes,
          sales: formattedSales,
          withdrawals: withdrawals,
          deposits: deposits,
          summary: {
            salesCount: salesData.length,
            totalSales: totalSales,
            totalWithdrawals: totalWithdrawals,
            totalDeposits: totalDeposits,
            paymentBreakdown: paymentBreakdown,
          }
        };
      })
    );

    return c.json({ registers });
  } catch (error: any) {
    console.error('💥 Error getting register history:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Helper function
function calculatePaymentBreakdown(sales: any[]) {
  const breakdown: Record<string, { count: number; total: number }> = {
    money: { count: 0, total: 0 },
    pix: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    debit: { count: 0, total: 0 },
  };

  sales.forEach(sale => {
    const method = sale.payment_method || sale.paymentMethod || 'money';
    if (breakdown[method]) {
      breakdown[method].count++;
      breakdown[method].total += parseFloat(sale.total);
    }
  });

  return breakdown;
}

// Get all sales for reports
app.get("/make-server-8a20b27d/reports/sales", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const limit = parseInt(c.req.query('limit') || '500');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    
    // Build query
    let query = supabase
      .from('sales')
      .select('*')
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    const { data: sales, error: salesError } = await query;

    if (salesError) {
      console.error('Error getting sales:', salesError);
      return c.json({ error: 'Erro ao buscar vendas' }, 500);
    }

    const formattedSales = (sales || []).map(sale => ({
      id: sale.id,
      registerId: sale.register_id,
      items: sale.items,
      total: parseFloat(sale.total),
      discount: 0,
      paymentMethod: sale.payment_method,
      customerName: null,
      customerPhone: null,
      saleDate: sale.timestamp,
      cashierName: sale.cashier_name,
      companyId: sale.company_id,
    }));

    return c.json({ sales: formattedSales });
  } catch (error: any) {
    console.error('💥 Error getting sales for reports:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get detailed register closures for reports
app.get("/make-server-8a20b27d/reports/closures", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const limit = parseInt(c.req.query('limit') || '100');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    
    // Build query for closed registers
    let query = supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('closed_at', startDate);
    }
    if (endDate) {
      query = query.lte('closed_at', endDate);
    }

    const { data: closedRegisters, error: queryError } = await query;

    if (queryError) {
      console.error('Error getting closures:', queryError);
      return c.json({ error: 'Erro ao buscar fechamentos' }, 500);
    }

    // For each closed register, get sales and movements
    const detailedClosures = await Promise.all(
      (closedRegisters || []).map(async (reg) => {
        // Get sales
        const { data: sales } = await supabase
          .from('sales')
          .select('*')
          .eq('register_id', reg.id);

        // Get movements
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('register_id', reg.id);

        const salesData = sales || [];
        const movementsData = movements || [];

        // Calculate totals
        const totalSales = salesData.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
        const totalWithdrawals = movementsData
          .filter(m => m.type === 'withdrawal')
          .reduce((sum, m) => sum + parseFloat(m.amount), 0);
        const totalDeposits = movementsData
          .filter(m => m.type === 'deposit')
          .reduce((sum, m) => sum + parseFloat(m.amount), 0);

        const paymentBreakdown = calculatePaymentBreakdown(salesData);

        return {
          id: reg.id,
          companyId: reg.company_id,
          cashierId: reg.cashier_id,
          cashierName: reg.cashier_name,
          initialBalance: parseFloat(reg.initial_balance),
          finalBalance: parseFloat(reg.current_balance),
          openedAt: reg.opened_at,
          closedAt: reg.closed_at,
          status: reg.status,
          totalSales,
          totalWithdrawals,
          totalDeposits,
          salesCount: salesData.length,
          paymentBreakdown,
        };
      })
    );

    return c.json({ closures: detailedClosures });
  } catch (error: any) {
    console.error('💥 Error getting closures for reports:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get stock entries for reports (NEW)
app.get("/make-server-8a20b27d/reports/entries", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const headerCompanyId = c.req.header('X-Company-Id');
    const companyId = await getCompanyId(profile, supabase, headerCompanyId);
    if (!companyId) {
      return c.json({ error: 'Company ID not found' }, 400);
    }

    const limit = parseInt(c.req.query('limit') || '100');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const supplierId = c.req.query('supplierId');
    const productId = c.req.query('productId');
    
    // Build query for stock entries
    let query = supabase
      .from('stock_entries')
      .select('*, suppliers(name), products(name)')
      .eq('company_id', companyId)
      .order('entry_date', { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }
    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: entries, error: queryError } = await query;

    if (queryError) {
      console.error('Error getting entries:', queryError);
      return c.json({ error: 'Erro ao buscar entradas' }, 500);
    }

    // Format entries data
    const formattedEntries = (entries || []).map((entry: any) => ({
      id: entry.id,
      companyId: entry.company_id,
      productId: entry.product_id,
      productName: entry.products?.name || 'Produto desconhecido',
      measurementUnit: 'un', // Default unit
      supplierId: entry.supplier_id,
      supplierName: entry.suppliers?.name || 'Fornecedor desconhecido',
      quantity: parseFloat(entry.quantity),
      unitPrice: parseFloat(entry.unit_price),
      totalPrice: parseFloat(entry.total_price),
      entryDate: entry.entry_date,
      batchNumber: entry.batch_number,
      expirationDate: entry.expiration_date,
      notes: entry.notes,
      createdAt: entry.created_at,
    }));

    return c.json({ entries: formattedEntries });
  } catch (error: any) {
    console.error('💥 Error getting entries for reports:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Send receipt by email
app.post("/make-server-8a20b27d/send-receipt-email", async (c) => {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);
    if (!profile) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const { to, subject, text, companyName } = body;

    if (!to || !subject || !text) {
      return c.json({ error: 'Missing required fields: to, subject, text' }, 400);
    }

    // Check if RESEND_API_KEY is available
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.log('⚠️ RESEND_API_KEY not configured');
      return c.json({ 
        error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.',
        fallback: true 
      }, 400);
    }

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${companyName || 'PyrouStock'} <noreply@resend.dev>`,
        to: [to],
        subject: subject,
        text: text,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('❌ Resend API error:', emailData);
      return c.json({ 
        error: `Failed to send email: ${emailData.message || 'Unknown error'}`,
        fallback: true 
      }, 500);
    }

    console.log('✅ Email sent successfully:', emailData.id);
    return c.json({ success: true, emailId: emailData.id });

  } catch (error: any) {
    console.error('💥 Error sending email:', error);
    return c.json({ 
      error: error.message,
      fallback: true 
    }, 500);
  }
});

// ==================== COST MANAGEMENT ENDPOINTS ====================

// Get all cost centers
app.get("/make-server-8a20b27d/costs/centers", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const centers = await costs.getAllCostCenters(companyId);
    return c.json({ centers });
  } catch (error: any) {
    console.error('Error fetching cost centers:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create cost center
app.post("/make-server-8a20b27d/costs/centers", async (c) => {
  try {
    const data = await c.req.json();
    console.log('Creating cost center with data:', data);
    const center = await costs.createCostCenter(data);
    console.log('Cost center created successfully:', center.id);
    return c.json({ center }, 201);
  } catch (error: any) {
    console.error('Error creating cost center:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update cost center
app.put("/make-server-8a20b27d/costs/centers/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const center = await costs.updateCostCenter(id, companyId, updates);
    return c.json({ center });
  } catch (error: any) {
    console.error('Error updating cost center:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete cost center
app.delete("/make-server-8a20b27d/costs/centers/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    await costs.deleteCostCenter(id, companyId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting cost center:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all expense types
app.get("/make-server-8a20b27d/costs/expense-types", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const types = await costs.getAllExpenseTypes(companyId);
    return c.json({ types });
  } catch (error: any) {
    console.error('Error fetching expense types:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create expense type
app.post("/make-server-8a20b27d/costs/expense-types", async (c) => {
  try {
    const data = await c.req.json();
    const type = await costs.createExpenseType(data);
    return c.json({ type }, 201);
  } catch (error: any) {
    console.error('Error creating expense type:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update expense type
app.put("/make-server-8a20b27d/costs/expense-types/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const type = await costs.updateExpenseType(id, companyId, updates);
    return c.json({ type });
  } catch (error: any) {
    console.error('Error updating expense type:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete expense type
app.delete("/make-server-8a20b27d/costs/expense-types/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    await costs.deleteExpenseType(id, companyId);
    return c.json({ message: 'Expense type deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting expense type:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all expenses
app.get("/make-server-8a20b27d/costs/expenses", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const filters = {
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      costCenterId: c.req.query('costCenterId'),
      expenseTypeId: c.req.query('expenseTypeId'),
      paymentStatus: c.req.query('paymentStatus')
    };

    const expenses = await costs.getAllExpenses(companyId, filters);
    return c.json({ expenses });
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create expense
app.post("/make-server-8a20b27d/costs/expenses", async (c) => {
  try {
    const data = await c.req.json();
    const expense = await costs.createExpense(data);
    return c.json({ expense }, 201);
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update expense
app.put("/make-server-8a20b27d/costs/expenses/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const expense = await costs.updateExpense(id, companyId, updates);
    return c.json({ expense });
  } catch (error: any) {
    console.error('Error updating expense:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete expense
app.delete("/make-server-8a20b27d/costs/expenses/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    await costs.deleteExpense(id, companyId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all budgets
app.get("/make-server-8a20b27d/costs/budgets", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const budgets = await costs.getAllBudgets(companyId);
    return c.json({ budgets });
  } catch (error: any) {
    console.error('Error fetching budgets:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get budget by ID
app.get("/make-server-8a20b27d/costs/budgets/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const budget = await costs.getBudgetById(id, companyId);
    return c.json({ budget });
  } catch (error: any) {
    console.error('Error fetching budget:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create budget
app.post("/make-server-8a20b27d/costs/budgets", async (c) => {
  try {
    const data = await c.req.json();
    const budget = await costs.createBudget(data);
    return c.json({ budget }, 201);
  } catch (error: any) {
    console.error('Error creating budget:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update budget
app.put("/make-server-8a20b27d/costs/budgets/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const budget = await costs.updateBudget(id, companyId, updates);
    return c.json({ budget });
  } catch (error: any) {
    console.error('Error updating budget:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get budget items
app.get("/make-server-8a20b27d/costs/budgets/:budgetId/items", async (c) => {
  try {
    const budgetId = c.req.param('budgetId');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const items = await costs.getBudgetItems(budgetId, companyId);
    return c.json({ items });
  } catch (error: any) {
    console.error('Error fetching budget items:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create budget item
app.post("/make-server-8a20b27d/costs/budget-items", async (c) => {
  try {
    const data = await c.req.json();
    const item = await costs.createBudgetItem(data);
    return c.json({ item }, 201);
  } catch (error: any) {
    console.error('Error creating budget item:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update budget item
app.put("/make-server-8a20b27d/costs/budget-items/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const item = await costs.updateBudgetItem(id, companyId, updates);
    return c.json({ item });
  } catch (error: any) {
    console.error('Error updating budget item:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete budget item
app.delete("/make-server-8a20b27d/costs/budget-items/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    await costs.deleteBudgetItem(id, companyId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting budget item:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all cost targets
app.get("/make-server-8a20b27d/costs/targets", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const isActive = c.req.query('isActive');
    const targets = await costs.getAllCostTargets(
      companyId, 
      isActive ? isActive === 'true' : undefined
    );
    return c.json({ targets });
  } catch (error: any) {
    console.error('Error fetching cost targets:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create cost target
app.post("/make-server-8a20b27d/costs/targets", async (c) => {
  try {
    const data = await c.req.json();
    const target = await costs.createCostTarget(data);
    return c.json({ target }, 201);
  } catch (error: any) {
    console.error('Error creating cost target:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update cost target
app.put("/make-server-8a20b27d/costs/targets/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.req.header('X-Company-Id');
    const updates = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }
    
    const target = await costs.updateCostTarget(id, companyId, updates);
    return c.json({ target });
  } catch (error: any) {
    console.error('Error updating cost target:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get cost center summary (analytics)
app.get("/make-server-8a20b27d/costs/analytics/centers-summary", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const summary = await costs.getCentersSummary(companyId);
    return c.json({ summary });
  } catch (error: any) {
    console.error('Error fetching cost center summary:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get budget analysis (analytics)
app.get("/make-server-8a20b27d/costs/analytics/budget-analysis", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const analysis = await costs.getBudgetAnalysis(companyId);
    return c.json({ analysis });
  } catch (error: any) {
    console.error('Error fetching budget analysis:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get product cost analysis (analytics)
app.get("/make-server-8a20b27d/costs/analytics/product-costs", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const analysis = await costs.getProductCostAnalysis(companyId);
    return c.json({ analysis });
  } catch (error: any) {
    console.error('Error fetching product cost analysis:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get waste analysis (analytics)
app.get("/make-server-8a20b27d/costs/analytics/waste", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    const analysis = await costs.getWasteAnalysis(companyId);
    return c.json({ analysis });
  } catch (error: any) {
    console.error('Error fetching waste analysis:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Initialize cost centers for a company
app.post("/make-server-8a20b27d/costs/initialize", async (c) => {
  try {
    const { companyId } = await c.req.json();
    if (!companyId) {
      return c.json({ error: 'Company ID required' }, 400);
    }

    await costs.initializeCostCenters(companyId);
    return c.json({ success: true, message: 'Cost centers initialized' });
  } catch (error: any) {
    console.error('Error initializing cost centers:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Calculate breakeven point
app.get("/make-server-8a20b27d/costs/analytics/breakeven", async (c) => {
  try {
    const companyId = c.req.header('X-Company-Id');
    const periodStart = c.req.query('periodStart');
    const periodEnd = c.req.query('periodEnd');

    if (!companyId || !periodStart || !periodEnd) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const result = await costs.calculateBreakeven(companyId, periodStart, periodEnd);
    return c.json({ breakeven: result });
  } catch (error: any) {
    console.error('Error calculating breakeven:', error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);