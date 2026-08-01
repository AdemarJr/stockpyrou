/** IndexedDB mínimo para catálogo, caixa e fila de vendas offline. */

const DB_NAME = 'stockpyrou_offline_v1';
const DB_VERSION = 1;

export type OfflineSaleStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type OfflineSaleStockLine = {
  productId: string;
  quantity: number;
  name: string;
  bundleItems?: Array<{ productId: string; quantity: number }>;
};

export type OfflineSaleRecord = {
  id: string;
  companyId: string;
  registerId: string;
  createdAt: string;
  status: OfflineSaleStatus;
  lastError?: string;
  syncedSaleId?: string;
  payload: {
    registerId: string;
    items: unknown[];
    total: number;
    paymentMethod: string;
    paymentDetails: Record<string, unknown>;
    clientRequestId: string;
  };
  stockItems: OfflineSaleStockLine[];
  receipt: {
    id: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    paymentDetails: Record<string, unknown>;
    emitNfce: false;
    timestamp: string;
    offlinePending: true;
  };
};

export type CachedRegister = {
  companyId: string;
  register: Record<string, unknown>;
  cachedAt: string;
};

export type CachedCatalog = {
  companyId: string;
  products: unknown[];
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' });
        store.createIndex('byCompanyStatus', ['companyId', 'status'], { unique: false });
        store.createIndex('byCompany', 'companyId', { unique: false });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'companyId' });
      }
      if (!db.objectStoreNames.contains('register')) {
        db.createObjectStore('register', { keyPath: 'companyId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let req: IDBRequest<T> | undefined;
    try {
      const result = fn(store);
      if (result) req = result;
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'));
    if (req) {
      req.onerror = () => reject(req!.error || new Error('IndexedDB request error'));
    }
  });
}

export async function idbPutSale(sale: OfflineSaleRecord): Promise<void> {
  await withStore('sales', 'readwrite', (store) => store.put(sale));
}

export async function idbGetSale(id: string): Promise<OfflineSaleRecord | undefined> {
  return withStore('sales', 'readonly', (store) => store.get(id));
}

export async function idbDeleteSale(id: string): Promise<void> {
  await withStore('sales', 'readwrite', (store) => store.delete(id));
}

export async function idbListSalesByCompany(companyId: string): Promise<OfflineSaleRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readonly');
    const store = tx.objectStore('sales');
    const idx = store.index('byCompany');
    const req = idx.getAll(companyId);
    req.onsuccess = () => resolve((req.result as OfflineSaleRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutCatalog(data: CachedCatalog): Promise<void> {
  await withStore('catalog', 'readwrite', (store) => store.put(data));
}

export async function idbGetCatalog(companyId: string): Promise<CachedCatalog | undefined> {
  return withStore('catalog', 'readonly', (store) => store.get(companyId));
}

export async function idbPutRegister(data: CachedRegister): Promise<void> {
  await withStore('register', 'readwrite', (store) => store.put(data));
}

export async function idbGetRegister(companyId: string): Promise<CachedRegister | undefined> {
  return withStore('register', 'readonly', (store) => store.get(companyId));
}
