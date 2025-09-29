export function formatNumber(value, { style = 'decimal', minimumFractionDigits = 0, maximumFractionDigits = 2 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('es-MX', {
    style,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(Number(value));
}

export function formatPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatMonth(year, month) {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}
