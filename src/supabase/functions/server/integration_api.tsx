// Financial Integration API for PyrouStock
// Provides REST endpoints for external financial systems

import type { Context } from "npm:hono";
import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Helper: Verify Integration API Key
export async function verifyIntegrationApiKey(apiKey: string | null): Promise<{ valid: boolean; companyId?: string; permissions?: string[] }> {
  if (!apiKey || !apiKey.startsWith('pyroustock_integration_')) {
    return { valid: false };
  }

  try {
    const keyData = await kv.get(`integration_key:${apiKey}`);
    
    if (!keyData || typeof keyData !== 'object') {
      return { valid: false };
    }

    const key = keyData as any;
    
    // Check if key is active
    if (key.status !== 'active') {
      return { valid: false };
    }

    // Update last used timestamp
    await kv.set(`integration_key:${apiKey}`, {
      ...key,
      lastUsedAt: new Date().toISOString()
    });

    return {
      valid: true,
      companyId: key.companyId,
      permissions: key.permissions || []
    };
  } catch (error) {
    console.error('Error verifying integration API key:', error);
    return { valid: false };
  }
}

// Middleware: Require Integration API Key
async function requireIntegrationAuth(c: Context) {
  const authHeader = c.req.header('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const verification = await verifyIntegrationApiKey(apiKey);
  
  if (!verification.valid) {
    return c.json({
      success: false,
      error: 'Invalid API Key',
      code: 'INVALID_API_KEY',
      message: 'A chave de API fornecida é inválida ou foi revogada'
    }, 401);
  }

  return verification;
}

// Helper: Verify any token for API key management
async function verifyAnyToken(token: string) {
  let profile = await auth.verifyCustomToken(token);
  if (!profile) {
    profile = await auth.verifySupabaseToken(token);
  }
  return profile;
}

// ==================== INTEGRATION ENDPOINTS ====================

// 1. GET /integration/sales - List Sales
export async function getSales(c: Context) {
  try {
    const authResult = await requireIntegrationAuth(c);
    if (!authResult.valid) return authResult;

    const companyId = c.req.query('companyId') || authResult.companyId;
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!companyId) {
      return c.json({ success: false, error: 'companyId is required' }, 400);
    }

    if (!authResult.permissions?.includes('read_sales')) {
      return c.json({ success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' }, 403);
    }

    let query = supabase
      .from('cash_sales')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: sales, error, count } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    const transformedSales = (sales || []).map((sale: any) => {
      const items = sale.items || [];
      const totalCost = items.reduce((sum: number, item: any) => sum + ((item.costPrice || 0) * item.quantity), 0);
      const totalProfit = sale.total - totalCost;
      const profitMargin = sale.total > 0 ? ((totalProfit / sale.total) * 100) : 0;

      return {
        id: sale.id,
        companyId: sale.company_id,
        date: sale.created_at,
        total: sale.total,
        paymentMethod: sale.payment_method,
        items: items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.total,
          costPrice: item.costPrice || 0,
          profit: (item.unitPrice - (item.costPrice || 0)) * item.quantity
        })),
        totalCost,
        totalProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        userId: sale.user_id,
        userName: sale.user_name,
        cashierId: sale.register_id,
        receiptNumber: sale.receipt_number,
        whatsappSent: sale.whatsapp_sent || false
      };
    });

    return c.json({
      success: true,
      data: transformedSales,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > (offset + limit)
      }
    });
  } catch (error: any) {
    console.error('Integration API - Sales error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
}

// 2. GET /integration/cashier-closures - List Cashier Closures
export async function getCashierClosures(c: Context) {
  try {
    const authResult = await requireIntegrationAuth(c);
    if (!authResult.valid) return authResult;

    const companyId = c.req.query('companyId') || authResult.companyId;
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!companyId) {
      return c.json({ success: false, error: 'companyId is required' }, 400);
    }

    if (!authResult.permissions?.includes('read_cashier')) {
      return c.json({ success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' }, 403);
    }

    let query = supabase
      .from('cash_registers')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) query = query.gte('closed_at', startDate);
    if (endDate) query = query.lte('closed_at', endDate);

    const { data: closures, error, count } = await query;

    if (error) {
      console.error('Error fetching closures:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    const transformedClosures = await Promise.all((closures || []).map(async (closure: any) => {
      const { data: movements } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('register_id', closure.id);

      const withdrawals = (movements || [])
        .filter((m: any) => m.type === 'withdrawal')
        .map((m: any) => ({
          id: m.id,
          amount: m.amount,
          reason: m.reason,
          date: m.created_at,
          userId: m.user_id
        }));

      const reinforcements = (movements || [])
        .filter((m: any) => m.type === 'deposit')
        .map((m: any) => ({
          id: m.id,
          amount: m.amount,
          reason: m.reason,
          date: m.created_at,
          userId: m.user_id
        }));

      const openTime = new Date(closure.opened_at);
      const closeTime = new Date(closure.closed_at);
      const durationMs = closeTime.getTime() - openTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        id: closure.id,
        companyId: closure.company_id,
        openDate: closure.opened_at,
        closeDate: closure.closed_at,
        duration: `${hours}h ${minutes}m`,
        openingBalance: closure.opening_balance,
        closingBalance: closure.closing_balance,
        totalSales: closure.total_sales || 0,
        totalExpected: closure.expected_balance || 0,
        totalCounted: closure.counted_balance || 0,
        difference: (closure.counted_balance || 0) - (closure.expected_balance || 0),
        withdrawals,
        reinforcements,
        paymentBreakdown: {
          money: closure.money_sales || 0,
          pix: closure.pix_sales || 0,
          credit: closure.credit_sales || 0,
          debit: closure.debit_sales || 0
        },
        openedBy: closure.opened_by,
        closedBy: closure.closed_by,
        userName: closure.opened_by_name,
        notes: closure.notes
      };
    }));

    return c.json({
      success: true,
      data: transformedClosures,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > (offset + limit)
      }
    });
  } catch (error: any) {
    console.error('Integration API - Closures error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
}

// 3. GET /integration/products - List Products
export async function getProducts(c: Context) {
  try {
    const authResult = await requireIntegrationAuth(c);
    if (!authResult.valid) return authResult;

    const companyId = c.req.query('companyId') || authResult.companyId;
    const category = c.req.query('category');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!companyId) {
      return c.json({ success: false, error: 'companyId is required' }, 400);
    }

    if (!authResult.permissions?.includes('read_products')) {
      return c.json({ success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' }, 403);
    }

    const allProducts = await kv.getByPrefix(`product:${companyId}:`);
    let products = Array.isArray(allProducts) ? allProducts : [];
    
    if (category) {
      products = products.filter((p: any) => p.category === category);
    }

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);

    const transformedProducts = paginatedProducts.map((product: any) => {
      const stockValue = product.currentStock * product.averageCost;
      const potentialRevenue = product.currentStock * (product.sellingPrice || 0);
      const potentialProfit = potentialRevenue - stockValue;
      const profitMargin = product.sellingPrice > 0 
        ? (((product.sellingPrice - product.averageCost) / product.sellingPrice) * 100) 
        : 0;

      return {
        id: product.id,
        companyId: product.companyId,
        name: product.name,
        category: product.category,
        measurementUnit: product.measurementUnit,
        currentStock: product.currentStock,
        minStock: product.minStock,
        safetyStock: product.safetyStock,
        averageCost: product.averageCost,
        sellingPrice: product.sellingPrice || 0,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        stockValue: parseFloat(stockValue.toFixed(2)),
        potentialRevenue: parseFloat(potentialRevenue.toFixed(2)),
        potentialProfit: parseFloat(potentialProfit.toFixed(2)),
        isPerishable: product.isPerishable,
        barcode: product.barcode,
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    return c.json({
      success: true,
      data: transformedProducts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > (offset + limit)
      }
    });
  } catch (error: any) {
    console.error('Integration API - Products error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
}

// API Key Management
export async function generateApiKey(c: Context) {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageSettings) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const { companyId, name, permissions } = await c.req.json();

    if (!companyId || !name || !permissions) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const keyId = crypto.randomUUID();
    const apiKey = `pyroustock_integration_${keyId.replace(/-/g, '')}`;

    await kv.set(`integration_key:${apiKey}`, {
      id: keyId,
      apiKey,
      name,
      companyId,
      permissions,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: profile.id,
      lastUsedAt: null
    });

    const keysList = await kv.get(`integration_keys:${companyId}`) || [];
    if (Array.isArray(keysList)) {
      keysList.push(apiKey);
      await kv.set(`integration_keys:${companyId}`, keysList);
    } else {
      await kv.set(`integration_keys:${companyId}`, [apiKey]);
    }

    return c.json({
      success: true,
      apiKey,
      name,
      companyId,
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      warning: '⚠️ Guarde esta chave em local seguro. Ela não será exibida novamente!'
    }, 201);
  } catch (error: any) {
    console.error('Generate API key error:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function listApiKeys(c: Context) {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageSettings) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const companyId = c.req.query('companyId');
    if (!companyId) {
      return c.json({ error: 'companyId is required' }, 400);
    }

    const keysList = await kv.get(`integration_keys:${companyId}`) || [];
    const keys = [];

    if (Array.isArray(keysList)) {
      for (const apiKey of keysList) {
        const keyData = await kv.get(`integration_key:${apiKey}`);
        if (keyData && typeof keyData === 'object') {
          const key = keyData as any;
          keys.push({
            id: key.id,
            name: key.name,
            keyPreview: `${apiKey.substring(0, 25)}...${apiKey.substring(apiKey.length - 4)}`,
            permissions: key.permissions,
            createdAt: key.createdAt,
            lastUsedAt: key.lastUsedAt,
            status: key.status
          });
        }
      }
    }

    return c.json({
      success: true,
      data: keys
    });
  } catch (error: any) {
    console.error('List API keys error:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function revokeApiKey(c: Context) {
  try {
    const customToken = c.req.header('X-Custom-Token');
    
    if (!customToken) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const profile = await verifyAnyToken(customToken);

    if (!profile || !profile.permissions?.canManageSettings) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const keyId = c.req.param('keyId');
    const companyId = c.req.query('companyId');
    
    if (!companyId) {
      return c.json({ error: 'companyId is required' }, 400);
    }

    const keysList = await kv.get(`integration_keys:${companyId}`) || [];
    
    if (Array.isArray(keysList)) {
      for (const apiKey of keysList) {
        const keyData = await kv.get(`integration_key:${apiKey}`);
        if (keyData && typeof keyData === 'object') {
          const key = keyData as any;
          if (key.id === keyId) {
            await kv.set(`integration_key:${apiKey}`, {
              ...key,
              status: 'revoked',
              revokedAt: new Date().toISOString(),
              revokedBy: profile.id
            });

            return c.json({
              success: true,
              message: 'API Key revogada com sucesso'
            });
          }
        }
      }
    }

    return c.json({ error: 'API Key not found' }, 404);
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    return c.json({ error: error.message }, 500);
  }
}
