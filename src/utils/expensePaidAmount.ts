/**
 * Valor já pago em despesas: coluna `paid_amount` (preferencial) ou JSON em `notes` (fallback sem migration).
 */
function parsePaidFromNotes(notes: unknown): number {
  if (notes == null || typeof notes !== 'string') return 0;
  const t = notes.trim();
  if (!t.startsWith('{')) return 0;
  try {
    const j = JSON.parse(t) as { paid_amount?: number; paidAmount?: number };
    const p = j.paid_amount ?? j.paidAmount;
    if (typeof p === 'number' && Number.isFinite(p)) return p;
    if (typeof p === 'string') return parseFloat(p) || 0;
  } catch {
    /* ignore */
  }
  return 0;
}

/** Saldo já pago: maior entre coluna e JSON em notes (compatível com fallback sem coluna + migração depois). */
export function paidAmountFromExpenseRow(e: {
  paid_amount?: unknown;
  notes?: unknown;
}): number {
  let fromCol = 0;
  const col = e.paid_amount;
  if (col != null && col !== '') {
    const n = parseFloat(String(col));
    if (Number.isFinite(n)) fromCol = n;
  }
  const fromNotes = parsePaidFromNotes(e.notes);
  return Math.round(Math.max(fromCol, fromNotes) * 100) / 100;
}

/** Saldo em aberto. */
export function remainingFromExpenseRow(e: {
  amount?: unknown;
  paid_amount?: unknown;
  notes?: unknown;
}): number {
  const total = parseFloat(String(e.amount ?? 0)) || 0;
  const paid = paidAmountFromExpenseRow(e);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

/**
 * Grava `paid_amount` em `notes` como JSON quando a coluna não existe no banco.
 * Preserva texto livre anterior em `text` ou mescla com JSON existente.
 */
export function mergeNotesWithPaidAmount(
  existingNotes: string | null | undefined,
  newPaidAmount: number
): string {
  let obj: Record<string, unknown> = {};
  if (existingNotes && String(existingNotes).trim()) {
    const t = String(existingNotes).trim();
    if (t.startsWith('{')) {
      try {
        obj = JSON.parse(t) as Record<string, unknown>;
      } catch {
        obj.user_text = existingNotes;
      }
    } else {
      obj.user_text = existingNotes;
    }
  }
  obj.paid_amount = newPaidAmount;
  return JSON.stringify(obj);
}

export function isPaidAmountColumnMissingError(message: string): boolean {
  return /paid_amount|Could not find|column.*schema cache|PGRST204/i.test(message);
}
