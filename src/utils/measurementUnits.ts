import type { MeasurementUnit, UnitConversion } from '../types';

/** ml contidos em 1 unidade de volume */
function volumeToMl(u: MeasurementUnit): number | null {
  if (u === 'ml') return 1;
  if (u === 'l' || u === 'lt') return 1000;
  return null;
}

/** gramas contidos em 1 unidade de massa */
function massToGrams(u: MeasurementUnit): number | null {
  if (u === 'g') return 1;
  if (u === 'kg') return 1000;
  return null;
}

/** metros contidos em 1 unidade de comprimento */
function lengthToMeters(u: MeasurementUnit): number | null {
  if (u === 'm') return 1;
  if (u === 'cm') return 0.01;
  if (u === 'mm') return 0.001;
  return null;
}

/**
 * Quantas unidades-base equivalem a 1 unidade de entrada.
 * qtyBase = qtyEntrada * fator
 */
export function resolveConversionFactorToBase(
  entryUnit: MeasurementUnit,
  baseUnit: MeasurementUnit,
  conversions: UnitConversion[] | undefined,
): number {
  if (!entryUnit || !baseUnit) return 1;
  if (entryUnit === baseUnit) return 1;

  const list = Array.isArray(conversions) ? conversions : [];
  const explicit = list.find((c) => c.unit === entryUnit && c.baseUnit === baseUnit);
  const eq = Number(explicit?.equivalentTo ?? 0);
  if (explicit && eq > 0) return eq;

  const vE = volumeToMl(entryUnit);
  const vB = volumeToMl(baseUnit);
  if (vE != null && vB != null) return vE / vB;

  const mE = massToGrams(entryUnit);
  const mB = massToGrams(baseUnit);
  if (mE != null && mB != null) return mE / mB;

  const lE = lengthToMeters(entryUnit);
  const lB = lengthToMeters(baseUnit);
  if (lE != null && lB != null) return lE / lB;

  return 1;
}

/** Unidades que o usuário pode usar no recebimento (base + conversões explícitas + família métrica). */
export function selectableUnitsForProduct(
  baseUnit: MeasurementUnit,
  conversions: UnitConversion[] | undefined,
): MeasurementUnit[] {
  const set = new Set<MeasurementUnit>([baseUnit]);
  for (const c of Array.isArray(conversions) ? conversions : []) {
    if (c?.baseUnit === baseUnit && c.unit) set.add(c.unit);
  }
  const vol: MeasurementUnit[] = ['l', 'lt', 'ml'];
  if (vol.includes(baseUnit)) vol.forEach((u) => set.add(u));
  const mass: MeasurementUnit[] = ['kg', 'g'];
  if (mass.includes(baseUnit)) mass.forEach((u) => set.add(u));
  const len: MeasurementUnit[] = ['m', 'cm', 'mm'];
  if (len.includes(baseUnit)) len.forEach((u) => set.add(u));
  return Array.from(set);
}
