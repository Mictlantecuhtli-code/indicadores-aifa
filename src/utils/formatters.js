export function formatNumber(value, { decimals = 2 } = {}) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatPercentage(value) {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(value * 100, { decimals: 1 })}%`;
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
