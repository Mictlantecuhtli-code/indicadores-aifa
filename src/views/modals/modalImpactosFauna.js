import { formatNumber, formatPercentage, monthName } from '../../utils/formatters.js';

export const IMPACTOS_FAUNA_MODAL_ID = 'modalImpactosFauna';

const MONTH_SHORT_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic'
];

function toPercentageValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function filterImpactosFaunaRecords(records, { showHistorical = false } = {}) {
  if (!Array.isArray(records)) {
    return [];
  }

  const normalized = records
    .map(record => ({
      anio: Number(record?.anio) || 0,
      mes: Number(record?.mes) || 0,
      total_operaciones: Number(record?.total_operaciones) || 0,
      impactos: Number(record?.impactos) || 0,
      tasa: Number(record?.tasa) || 0
    }))
    .filter(record => record.anio > 0 && record.mes >= 1 && record.mes <= 12);

  if (!normalized.length) {
    return [];
  }

  normalized.sort((a, b) => {
    if (a.anio !== b.anio) {
      return a.anio - b.anio;
    }
    return a.mes - b.mes;
  });

  const availableYears = Array.from(new Set(normalized.map(record => record.anio))).sort((a, b) => b - a);
  const selectedYears = showHistorical ? availableYears.slice(0, 4) : availableYears.slice(0, 1);
  const allowedYears = new Set(selectedYears);

  return normalized.filter(record => allowedYears.has(record.anio));
}

const operationsLabelsPlugin = {
  id: 'impactosFaunaOperationsLabels',
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, chartArea } = chart;
    const operations = pluginOptions?.operations ?? [];
    const meta = chart.getDatasetMeta(0);

    if (!meta) {
      return;
    }

    ctx.save();
    ctx.font = '10px "Inter", "Inter var", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    meta.data.forEach((element, index) => {
      const value = operations[index];
      if (value === null || value === undefined) {
        return;
      }

      const text = `${formatNumber(value, { decimals: 0 })} Ops.`;
      const { x, base } = element;
      const y = Math.min(chartArea.bottom - 14, (base ?? chartArea.bottom) + 6);
      ctx.fillText(text, x, y);
    });

    ctx.restore();
  }
};

export function buildImpactosFaunaChartView(records, { showHistorical = false } = {}) {
  const filtered = filterImpactosFaunaRecords(records, { showHistorical });

  if (!filtered.length) {
    return { config: null, filteredRecords: [] };
  }

  const labels = filtered.map(record => {
    const monthIndex = Math.max(0, Math.min(11, record.mes - 1));
    const monthLabel = MONTH_SHORT_NAMES[monthIndex] ?? `Mes ${record.mes}`;
    return [monthLabel, String(record.anio)];
  });

  const impactosData = filtered.map(record => record.impactos);
  const tasaData = filtered.map(record => toPercentageValue(record.tasa));
  const operationsData = filtered.map(record => record.total_operaciones);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Impactos',
          data: impactosData,
          backgroundColor: '#93c5fd',
          borderColor: '#60a5fa',
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 40,
          yAxisID: 'impactos',
          order: 1
        },
        {
          type: 'line',
          label: 'Tasa de Impactos (%)',
          data: tasaData,
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29, 78, 216, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#1d4ed8',
          pointBorderColor: '#1d4ed8',
          fill: false,
          yAxisID: 'tasa',
          order: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 32,
          left: 8,
          right: 8,
          top: 16
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#475569',
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false
          }
        },
        impactos: {
          position: 'left',
          title: {
            display: true,
            text: 'No. de Impactos',
            color: '#0f172a',
            font: {
              size: 12,
              weight: '600'
            }
          },
          ticks: {
            callback(value) {
              return Number(value).toLocaleString('es-MX', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              });
            },
            color: '#475569'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.25)'
          }
        },
        tasa: {
          position: 'right',
          title: {
            display: true,
            text: 'Tasa de Impactos (%)',
            color: '#0f172a',
            font: {
              size: 12,
              weight: '600'
            }
          },
          ticks: {
            callback(value) {
              return `${Number(value).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}%`;
            },
            color: '#475569'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxHeight: 8,
            boxWidth: 8,
            color: '#334155'
          }
        },
        tooltip: {
          callbacks: {
            title(items) {
              const item = items?.[0];
              if (!item) return '';
              const record = filtered[item.dataIndex];
              if (!record) return item.label || '';
              return `${monthName(record.mes)} ${record.anio}`;
            },
            beforeBody(items) {
              const item = items?.[0];
              if (!item) return [];
              const record = filtered[item.dataIndex];
              if (!record) return [];
              return [`Operaciones: ${formatNumber(record.total_operaciones, { decimals: 0 })}`];
            },
            label(context) {
              const datasetLabel = context.dataset?.label ?? '';
              if (context.dataset?.yAxisID === 'impactos') {
                return `${datasetLabel}: ${formatNumber(context.parsed.y, { decimals: 0 })}`;
              }
              return `${datasetLabel}: ${formatPercentage(context.parsed.y, {
                decimals: 4,
                scale: 'percentage'
              })}`;
            }
          }
        },
        operationsLabels: {
          operations: operationsData
        }
      }
    },
    plugins: [operationsLabelsPlugin]
  };

  return { config, filteredRecords: filtered };
}

export function buildImpactosFaunaModalMarkup({ showHistorical = false } = {}) {
  const toggleLabel = showHistorical ? 'Mostrar año en curso' : 'Mostrar últimos 4 años';
  const toggleIcon = showHistorical ? 'fa-solid fa-calendar-day' : 'fa-solid fa-clock-rotate-left';

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${IMPACTOS_FAUNA_MODAL_ID}">
      <div class="relative w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
        <button
          type="button"
          class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          aria-label="Cerrar"
          data-modal-close
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="space-y-6 p-6">
          <header class="space-y-2">
            <h2 class="text-2xl font-semibold text-slate-900">Impactos con fauna vs Tasa de impactos con fauna 2022–2025</h2>
            <p class="text-sm text-slate-600">Indicador 1.1 · Tasa de impactos con fauna dentro del aeropuerto.</p>
          </header>

          <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Visualización combinada</h3>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-primary-600 px-4 py-2 text-sm font-semibold transition ${
                  showHistorical ? 'bg-primary-600 text-white shadow' : 'text-primary-600 hover:bg-primary-50'
                }"
                data-impactos-fauna-toggle
                aria-pressed="${showHistorical ? 'true' : 'false'}"
              >
                <i class="${toggleIcon}"></i>
                ${toggleLabel}
              </button>
            </div>
            <div class="h-96">
              <canvas id="chartImpactosFauna" data-impactos-fauna-chart></canvas>
            </div>
          </section>
        </div>

        <footer class="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            data-impactos-fauna-export
          >
            <i class="fa-solid fa-file-csv"></i>
            Exportar CSV
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            data-modal-close
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  `;
}

export function buildImpactosFaunaCsv(records, { showHistorical = false } = {}) {
  const filtered = filterImpactosFaunaRecords(records, { showHistorical });
  if (!filtered.length) {
    return '';
  }

  const header = 'Año,Mes,Operaciones,Impactos,Tasa (%)';
  const rows = filtered.map(record => {
    const tasaPercent = toPercentageValue(record.tasa).toFixed(4);
    const monthLabel = monthName(record.mes);
    const safeMonth = monthLabel ? monthLabel.replace(/"/g, '""') : `Mes ${record.mes}`;
    return [
      record.anio,
      `"${safeMonth}"`,
      record.total_operaciones,
      record.impactos,
      tasaPercent
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
