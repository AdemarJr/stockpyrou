/**
 * SafeStorage - Wrapper seguro para localStorage com fallback
 * 
 * Resolve problemas de:
 * - Safari modo privado (bloqueia localStorage)
 * - Firefox modo privado (lança SecurityError)
 * - Quotas excedidas
 * - Browsers que não suportam localStorage
 */

class SafeStorageClass {
  private isAvailable: boolean;
  private memoryFallback: Map<string, string>;

  constructor() {
    this.memoryFallback = new Map();
    this.isAvailable = this.checkAvailability();
  }

  /**
   * Verifica se localStorage está disponível
   */
  private checkAvailability(): boolean {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[SafeStorage] localStorage not available, using memory fallback:', e);
      return false;
    }
  }

  /**
   * Obtém um item do storage
   */
  getItem(key: string): string | null {
    try {
      if (this.isAvailable) {
        return localStorage.getItem(key);
      } else {
        return this.memoryFallback.get(key) || null;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Error getting item "${key}":`, e);
      return this.memoryFallback.get(key) || null;
    }
  }

  /**
   * Define um item no storage
   */
  setItem(key: string, value: string): boolean {
    try {
      if (this.isAvailable) {
        localStorage.setItem(key, value);
        // Também salva no fallback por segurança
        this.memoryFallback.set(key, value);
        return true;
      } else {
        this.memoryFallback.set(key, value);
        return true;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Error setting item "${key}":`, e);
      // Se falhar, usa memória
      this.memoryFallback.set(key, value);
      return false;
    }
  }

  /**
   * Remove um item do storage
   */
  removeItem(key: string): boolean {
    try {
      if (this.isAvailable) {
        localStorage.removeItem(key);
      }
      this.memoryFallback.delete(key);
      return true;
    } catch (e) {
      console.warn(`[SafeStorage] Error removing item "${key}":`, e);
      this.memoryFallback.delete(key);
      return false;
    }
  }

  /**
   * Limpa todo o storage
   */
  clear(): boolean {
    try {
      if (this.isAvailable) {
        localStorage.clear();
      }
      this.memoryFallback.clear();
      return true;
    } catch (e) {
      console.warn('[SafeStorage] Error clearing storage:', e);
      this.memoryFallback.clear();
      return false;
    }
  }

  /**
   * Obtém número de items no storage
   */
  get length(): number {
    try {
      if (this.isAvailable) {
        return localStorage.length;
      }
      return this.memoryFallback.size;
    } catch (e) {
      return this.memoryFallback.size;
    }
  }

  /**
   * Obtém chave por índice
   */
  key(index: number): string | null {
    try {
      if (this.isAvailable) {
        return localStorage.key(index);
      }
      const keys = Array.from(this.memoryFallback.keys());
      return keys[index] || null;
    } catch (e) {
      const keys = Array.from(this.memoryFallback.keys());
      return keys[index] || null;
    }
  }

  /**
   * Verifica se localStorage está disponível (getter)
   */
  get available(): boolean {
    return this.isAvailable;
  }
}

// Singleton instance
export const safeStorage = new SafeStorageClass();

// Compatibilidade com código existente que usa localStorage diretamente
export default safeStorage;
