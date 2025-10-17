export function formatNumber(value, { decimals = 2 } = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function resolvePercentageFractionDigits(value, override) {
  if (typeof override === 'number' && override >= 0) {
    return override;
  }

  const absolute = Math.abs(Number(value));
  if (!Number.isFinite(absolute)) {
    return 1;
  }

  if (absolute === 0) {
    return 3;
  }

  if (absolute >= 1) {
    return absolute >= 10 ? 1 : 2;
  }

  if (absolute >= 0.1) {
    return 3;
  }

  if (absolute >= 0.01) {
    return 3;
  }

  return 3;
}

function resolvePercentageValue(value, scale = 'auto') {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return Number.NaN;
  }

  if (scale === 'percentage') {
    return numeric;
  }

  if (scale === 'fraction') {
    return numeric * 100;
  }

  // Escala automática: si el valor es menor o igual a 1 en magnitud,
  // se interpreta como fracción y se convierte a porcentaje.
  return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function formatPercentage(value, { decimals, scale = 'auto' } = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const percentageValue = resolvePercentageValue(value, scale);

  if (!Number.isFinite(percentageValue)) {
    return '—';
  }

  const fractionDigits = resolvePercentageFractionDigits(percentageValue, decimals);

  return `${Number(percentageValue).toLocaleString('es-MX', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })}%`;
}

export function isPercentageUnit(unit) {
  const normalized = (unit ?? '').toString().trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return normalized === '%' || normalized.includes('%') || normalized.includes('porcentaje') || normalized.includes('por ciento');
}

export function formatValueByUnit(
  value,
  unit,
  { numberDecimals = 2, percentageDecimals, percentageScale = 'auto' } = {}
) {
  if (isPercentageUnit(unit)) {
    return formatPercentage(value, { decimals: percentageDecimals, scale: percentageScale });
  }

  return formatNumber(value, { decimals: numberDecimals });
}

export function monthName(month) {
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];
  return months[month - 1] ?? '';
}

export function formatMonth(year, month = 1) {
  if (!year) return '—';
  const name = monthName(month ?? 1);
  return `${name} ${year}`.trim();
}

export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}
