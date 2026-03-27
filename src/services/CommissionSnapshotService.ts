import type {
  CommissionGroupConfig,
  CommissionGroupResult,
  CommissionRoleKey,
  CommissionSnapshot
} from '../types/commission';

const STORAGE_PREFIX = 'stockpyrou_commission_snapshots_v1';
const LABELS_PREFIX = 'stockpyrou_commission_labels_v1';

/** Rótulos padrão das três equipes (podem ser sobrescritos por empresa). */
export const DEFAULT_GROUP_LABELS: Record<CommissionRoleKey, string> = {
  vendedores: 'Vendedores',
  garcons: 'Garçons',
  cozinha: 'Cozinha'
};

function labelsStorageKey(companyId: string): string {
  return `${LABELS_PREFIX}_${companyId}`;
}

export function loadGroupLabels(companyId: string): Record<CommissionRoleKey, string> {
  try {
    const raw = localStorage.getItem(labelsStorageKey(companyId));
    if (!raw) return { ...DEFAULT_GROUP_LABELS };
    const parsed = JSON.parse(raw) as Partial<Record<CommissionRoleKey, string>>;
    return {
      ...DEFAULT_GROUP_LABELS,
      ...parsed
    };
  } catch {
    return { ...DEFAULT_GROUP_LABELS };
  }
}

export function persistGroupLabels(
  companyId: string,
  labels: Record<CommissionRoleKey, string>
): void {
  localStorage.setItem(labelsStorageKey(companyId), JSON.stringify(labels));
}

function storageKey(companyId: string): string {
  return `${STORAGE_PREFIX}_${companyId}`;
}

function parseStored(raw: string | null): CommissionSnapshot[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as CommissionSnapshot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function computeGroups(
  totalSales: number,
  groups: CommissionGroupConfig[]
): CommissionGroupResult[] {
  const sales = Math.max(0, totalSales);
  return groups.map((g) => {
    const pct = Math.max(0, g.percent);
    const people = Math.max(0, Math.floor(g.peopleCount));
    const poolAmount = sales * (pct / 100);
    const perPersonAmount = people > 0 ? poolAmount / people : 0;
    return {
      ...g,
      poolAmount,
      perPersonAmount
    };
  });
}

export class CommissionSnapshotService {
  static list(companyId: string): CommissionSnapshot[] {
    const list = parseStored(localStorage.getItem(storageKey(companyId)));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static save(
    companyId: string,
    snapshot: Omit<CommissionSnapshot, 'id' | 'createdAt'>
  ): CommissionSnapshot {
    const full: CommissionSnapshot = {
      ...snapshot,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const all = parseStored(localStorage.getItem(storageKey(companyId)));
    all.unshift(full);
    localStorage.setItem(storageKey(companyId), JSON.stringify(all));
    return full;
  }

  static delete(companyId: string, id: string): void {
    const all = parseStored(localStorage.getItem(storageKey(companyId))).filter((s) => s.id !== id);
    localStorage.setItem(storageKey(companyId), JSON.stringify(all));
  }

  /** Exporta um snapshot como CSV (separador ; para Excel em PT-BR). */
  static toCsv(snapshot: CommissionSnapshot): string {
    const lines: string[] = [
      'Referência;Total vendas;Grupo;%;Pessoas;Total comissão grupo;Por pessoa'
    ];
    for (const g of snapshot.groups) {
      lines.push(
        [
          snapshot.referenceMonth,
          snapshot.totalSales.toFixed(2).replace('.', ','),
          g.label,
          String(g.percent).replace('.', ','),
          String(g.peopleCount),
          g.poolAmount.toFixed(2).replace('.', ','),
          g.perPersonAmount.toFixed(2).replace('.', ',')
        ].join(';')
      );
    }
    return lines.join('\r\n');
  }
}
