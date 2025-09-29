import { monthName } from '../utils/formatters.js';

const chartRegistry = new Map();

function buildDataset(label, data, options = {}) {
  return {
    label,
    data,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2,
    spanGaps: true,
    ...options
  };
}

export function renderIndicatorChart(canvasId, history = [], targets = []) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartRegistry.has(canvasId)) {
    chartRegistry.get(canvasId).destroy();
    chartRegistry.delete(canvasId);
  }

  const labels = [];
  const realValues = [];
  const metaBajo = [];
  const metaMedio = [];
  const metaAlto = [];

  const rows = new Map();

  history.forEach((item) => {
    const key = `${item.anio}-${item.mes}`;
    if (!rows.has(key)) {
      rows.set(key, {
        label: `${monthName(item.mes)} ${item.anio}`,
        real: null,
        meta_bajo: null,
        meta_medio: null,
        meta_alto: null
      });
    }
    const row = rows.get(key);
    row.real = item.valor ? Number(item.valor) : null;
  });

  targets.forEach((item) => {
    const key = `${item.anio}-${item.mes}`;
    if (!rows.has(key)) {
      rows.set(key, {
        label: `${monthName(item.mes)} ${item.anio}`,
        real: null,
        meta_bajo: null,
        meta_medio: null,
        meta_alto: null
      });
    }
    const row = rows.get(key);
    const scenario = typeof item.escenario === 'string' ? item.escenario.toLowerCase() : 'medio';
    row[`meta_${scenario}`] = item.valor ? Number(item.valor) : null;
  });

  const sortedRows = Array.from(rows.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([, value]) => value);

  sortedRows.forEach((row) => {
    labels.push(row.label);
    realValues.push(row.real);
    metaBajo.push(row.meta_bajo);
    metaMedio.push(row.meta_medio);
    metaAlto.push(row.meta_alto);
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        buildDataset('Valor real', realValues, {
          borderColor: '#1E3A8A',
          backgroundColor: 'rgba(30, 58, 138, 0.15)',
          fill: true
        }),
        buildDataset('Meta escenario bajo', metaBajo, {
          borderColor: '#F97316',
          borderDash: [6, 4],
          fill: false
        }),
        buildDataset('Meta escenario medio', metaMedio, {
          borderColor: '#10B981',
          borderDash: [6, 4],
          fill: false
        }),
        buildDataset('Meta escenario alto', metaAlto, {
          borderColor: '#0EA5E9',
          borderDash: [6, 4],
          fill: false
        })
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          ticks: {
            color: '#475569'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.25)'
          }
        },
        x: {
          ticks: {
            color: '#475569'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  chartRegistry.set(canvasId, chart);
}
