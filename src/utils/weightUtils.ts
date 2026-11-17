export type WeightUnit = 'lbs' | 'kg';

const KG_TO_LBS = 2.2046226218;

export function convertFromKg(kg: number, unit: WeightUnit): number {
  if (!kg || kg <= 0) return 0;
  const raw = unit === 'kg' ? kg : kg * KG_TO_LBS;
  return Math.round(raw * 10) / 10;
}

export function convertToKg(value: number, unit: WeightUnit): number {
  if (!value || value <= 0) return 0;
  return unit === 'kg' ? value : value / KG_TO_LBS;
}

export function formatWeightNumber(kg: number, unit: WeightUnit): string {
  const val = convertFromKg(kg, unit);
  if (val <= 0) return '0';
  return Number.isInteger(val) ? String(val) : val.toFixed(1).replace(/\.0$/, '');
}

export function formatWeightWithUnit(kg: number, unit: WeightUnit): string {
  const val = convertFromKg(kg, unit);
  if (val <= 0) return '—';
  const numStr = Number.isInteger(val) ? String(val) : val.toFixed(1).replace(/\.0$/, '');
  return `${numStr} ${unit}`;
}
