/**
 * SafeDate - Utilitários para manipulação segura de datas
 * 
 * Resolve problemas de:
 * - Timezone inconsistente entre browsers
 * - Safari interpretando datas diferente
 * - new Date('YYYY-MM-DD') usando UTC vs Local
 * - Datas inválidas quebrando toISOString()
 */

/**
 * Converte Date para string YYYY-MM-DD (timezone local)
 * Seguro em todos os browsers
 */
export function toDateString(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('[SafeDate] Invalid date provided to toDateString:', date);
    return toDateString(new Date());
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Converte string YYYY-MM-DD para Date (timezone local)
 * Evita problemas de UTC/Local do Safari
 */
export function fromDateString(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    console.warn('[SafeDate] Invalid date string:', dateStr);
    return new Date();
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    console.warn('[SafeDate] Invalid date format (expected YYYY-MM-DD):', dateStr);
    return new Date();
  }

  const [year, month, day] = parts.map(Number);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.warn('[SafeDate] Invalid date numbers:', { year, month, day });
    return new Date();
  }

  // Cria date em timezone local (não UTC)
  return new Date(year, month - 1, day);
}

/**
 * Adiciona dias a uma data (evita problemas de timezone)
 */
export function addDays(date: Date, days: number): Date {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('[SafeDate] Invalid date provided to addDays:', date);
    date = new Date();
  }

  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtrai dias de uma data
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Adiciona meses a uma data
 */
export function addMonths(date: Date, months: number): Date {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('[SafeDate] Invalid date provided to addMonths:', date);
    date = new Date();
  }

  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Obtém o primeiro dia do mês
 */
export function startOfMonth(date: Date): Date {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date();
  }

  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Obtém o último dia do mês
 */
export function endOfMonth(date: Date): Date {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date();
  }

  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Obtém data de hoje como string YYYY-MM-DD
 */
export function today(): string {
  return toDateString(new Date());
}

/**
 * Obtém data de ontem como string YYYY-MM-DD
 */
export function yesterday(): string {
  return toDateString(subtractDays(new Date(), 1));
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
export function formatDateBR(date: Date | string): string {
  let dateObj: Date;

  if (typeof date === 'string') {
    dateObj = fromDateString(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    console.warn('[SafeDate] Invalid date provided to formatDateBR:', date);
    return '';
  }

  if (isNaN(dateObj.getTime())) {
    console.warn('[SafeDate] Invalid date object:', dateObj);
    return '';
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formata data/hora para exibição (DD/MM/YYYY HH:MM)
 */
export function formatDateTimeBR(date: Date | string): string {
  let dateObj: Date;

  if (typeof date === 'string') {
    // Se for ISO string, usa Date direto
    if (date.includes('T')) {
      dateObj = new Date(date);
    } else {
      dateObj = fromDateString(date);
    }
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    console.warn('[SafeDate] Invalid date provided to formatDateTimeBR:', date);
    return '';
  }

  if (isNaN(dateObj.getTime())) {
    console.warn('[SafeDate] Invalid date object:', dateObj);
    return '';
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Verifica se uma data é válida
 */
export function isValidDate(date: any): boolean {
  if (!date) return false;
  if (!(date instanceof Date)) return false;
  return !isNaN(date.getTime());
}

/**
 * Compara duas datas (retorna -1, 0 ou 1)
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? fromDateString(date1) : date1;
  const d2 = typeof date2 === 'string' ? fromDateString(date2) : date2;

  if (!isValidDate(d1) || !isValidDate(d2)) {
    console.warn('[SafeDate] Invalid dates for comparison:', { date1, date2 });
    return 0;
  }

  const time1 = d1.getTime();
  const time2 = d2.getTime();

  if (time1 < time2) return -1;
  if (time1 > time2) return 1;
  return 0;
}

/**
 * Verifica se data está entre duas outras datas (inclusive)
 */
export function isBetween(date: Date | string, start: Date | string, end: Date | string): boolean {
  const d = typeof date === 'string' ? fromDateString(date) : date;
  const s = typeof start === 'string' ? fromDateString(start) : start;
  const e = typeof end === 'string' ? fromDateString(end) : end;

  if (!isValidDate(d) || !isValidDate(s) || !isValidDate(e)) {
    return false;
  }

  const time = d.getTime();
  const startTime = s.getTime();
  const endTime = e.getTime();

  return time >= startTime && time <= endTime;
}

/**
 * Obtém diferença em dias entre duas datas
 */
export function diffInDays(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? fromDateString(date1) : date1;
  const d2 = typeof date2 === 'string' ? fromDateString(date2) : date2;

  if (!isValidDate(d1) || !isValidDate(d2)) {
    console.warn('[SafeDate] Invalid dates for diff:', { date1, date2 });
    return 0;
  }

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Export objeto com todas as funções (para uso como safeDate.*)
export const safeDate = {
  toDateString,
  fromDateString,
  addDays,
  subtractDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  today,
  yesterday,
  formatDateBR,
  formatDateTimeBR,
  isValidDate,
  compareDates,
  isBetween,
  diffInDays
};

export default safeDate;
