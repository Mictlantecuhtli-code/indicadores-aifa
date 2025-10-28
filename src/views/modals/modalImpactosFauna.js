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

function normalizeImpactosFaunaRecords(records) {
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

  normalized.sort((a, b) => {
    if (a.anio !== b.anio) {
      return a.anio - b.anio;
    }
    return a.mes - b.mes;
  });

  return normalized;
}

function computeImpactRate(record) {
  const impactos = Number(record?.impactos);
  const operaciones = Number(record?.total_operaciones);

  if (Number.isFinite(impactos) && Number.isFinite(operaciones) && operaciones > 0) {
    return (impactos / operaciones) * 100;
  }

  const tasa = Number(record?.tasa);
  return Number.isFinite(tasa) ? tasa : 0;
}

export function filterImpactosFaunaRecords(records, { showHistorical = false } = {}) {
  const normalized = normalizeImpactosFaunaRecords(records);

  if (!normalized.length) {
    return [];
  }

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
    const labelVisibility = Array.isArray(pluginOptions?.labelVisibility)
      ? pluginOptions.labelVisibility
      : null;
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

      if (labelVisibility && labelVisibility[index] === false) {
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

  const labelStride = showHistorical
    ? filtered.length >= 36
      ? 4
      : filtered.length >= 24
      ? 3
      : 2
    : 1;
  const labelVisibility = filtered.map((_, index) => (labelStride <= 1 ? true : index % labelStride === 0));
  if (labelVisibility.length) {
    labelVisibility[0] = true;
    labelVisibility[labelVisibility.length - 1] = true;
  }

  const labels = filtered.map(record => {
    const monthIndex = Math.max(0, Math.min(11, record.mes - 1));
    const monthLabel = MONTH_SHORT_NAMES[monthIndex] ?? `Mes ${record.mes}`;
    return [monthLabel, String(record.anio)];
  });

  const impactosData = filtered.map(record => record.impactos);
  const tasaData = filtered.map(record => computeImpactRate(record));
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
          order: -10,
          z: 0
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
          order: 10,
          z: 20
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
            autoSkip: false,
            callback(value, index) {
              if (labelVisibility[index] === false) {
                return '';
              }

              const label = this?.getLabelForValue?.(value);
              if (Array.isArray(label)) {
                return label;
              }

              return label ?? value;
            }
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
            color: '#334155',
            sort(a, b) {
              const priority = {
                Impactos: 0,
                'Tasa de Impactos (%)': 1
              };
              const aPriority = priority[a.text] ?? 10;
              const bPriority = priority[b.text] ?? 10;

              if (aPriority !== bPriority) {
                return aPriority - bPriority;
              }

              return a.datasetIndex - b.datasetIndex;
            }
          }
        },
        tooltip: {
          filter(context) {
            const label = context.dataset?.label ?? '';
            return label === 'Impactos' || label === 'Tasa de Impactos (%)';
          },
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
          operations: operationsData,
          labelVisibility
        }
      }
    },
    plugins: [operationsLabelsPlugin]
  };

  return { config, filteredRecords: filtered, labelVisibility };
}

export function buildImpactosFaunaSummary(records = []) {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  const latestRecord = records[records.length - 1];
  const monthLabel = monthName(latestRecord.mes) || `Mes ${latestRecord.mes}`;

  return {
    periodLabel: `${monthLabel} ${latestRecord.anio}`,
    operations: Number(latestRecord.total_operaciones) || 0,
    impacts: Number(latestRecord.impactos) || 0,
    rate: computeImpactRate(latestRecord)
  };
}

function renderRateValue(rate, { emphasize = false, placeholder = '—' } = {}) {
  if (!Number.isFinite(rate)) {
    return `<span class="text-slate-400">${placeholder}</span>`;
  }

  const formatted = formatPercentage(rate, { decimals: 4, scale: 'percentage' });
  const emphasisClass = emphasize ? 'font-semibold text-slate-900' : 'text-slate-600';
  return `<span class="${emphasisClass}">${formatted}</span>`;
}

export function buildImpactosFaunaDetailTable(records, { showHistorical = false } = {}) {
  const normalized = normalizeImpactosFaunaRecords(records);

  if (!normalized.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hay datos históricos suficientes para mostrar el detalle del periodo.
      </div>
    `;
  }

  const availableYearsDesc = Array.from(new Set(normalized.map(record => record.anio))).sort((a, b) => b - a);
  const currentYear = availableYearsDesc[0];
  const selectedYearsDesc = showHistorical
    ? availableYearsDesc.slice(0, Math.min(4, availableYearsDesc.length))
    : availableYearsDesc.slice(0, Math.min(2, availableYearsDesc.length));

  if (!selectedYearsDesc.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hay datos históricos suficientes para mostrar el detalle del periodo.
      </div>
    `;
  }

  const selectedYearsAsc = [...selectedYearsDesc].sort((a, b) => a - b);
  const previousComparisonYear = selectedYearsAsc.length >= 2 ? selectedYearsAsc[selectedYearsAsc.length - 2] : null;

  const ratesByYear = new Map();
  normalized.forEach(record => {
    if (!selectedYearsAsc.includes(record.anio)) {
      return;
    }

    const rate = computeImpactRate(record);
    if (!ratesByYear.has(record.anio)) {
      ratesByYear.set(record.anio, new Map());
    }
    ratesByYear.get(record.anio).set(record.mes, rate);
  });

  const referenceMonths = ratesByYear.get(currentYear)
    ? Array.from(ratesByYear.get(currentYear).keys())
    : Array.from(new Set(normalized.map(record => record.mes)));

  const months = showHistorical
    ? Array.from({ length: 12 }, (_, index) => index + 1)
    : referenceMonths.sort((a, b) => a - b);

  if (!months.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hay datos históricos suficientes para mostrar el detalle del periodo.
      </div>
    `;
  }

  const rows = months
    .map(month => {
      const monthLabel = monthName(month) || `Mes ${month}`;
      const currentRate = ratesByYear.get(currentYear)?.get(month);
      const previousRate = previousComparisonYear ? ratesByYear.get(previousComparisonYear)?.get(month) : Number.NaN;

      if (showHistorical) {
        const yearCells = selectedYearsAsc
          .map(year => {
            const rate = ratesByYear.get(year)?.get(month);
            const emphasize = year === currentYear;
            return `<td class="whitespace-nowrap px-4 py-3 text-right">${renderRateValue(rate, {
              emphasize,
              placeholder: '--'
            })}</td>`;
          })
          .join('');

        return `
          <tr>
            <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-600">${monthLabel}</td>
            ${yearCells}
          </tr>
        `;
      }

      const realCell = renderRateValue(currentRate, { emphasize: true });
      const previousCell = renderRateValue(previousRate, { emphasize: false });

      return `
        <tr>
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-600">${monthLabel}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right">${realCell}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right">${previousCell}</td>
        </tr>
      `;
    })
    .join('');

  if (!rows.trim()) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hay datos históricos suficientes para mostrar el detalle del periodo.
      </div>
    `;
  }

  const historicalHeaders = showHistorical
    ? selectedYearsAsc
        .map(
          year => `
            <th scope="col" class="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              ${year}
            </th>
          `
        )
        .join('')
    : '';

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Periodo
            </th>
            ${
              showHistorical
                ? historicalHeaders
                : `
                    <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Real (${currentYear})
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Mismo mes año anterior${previousComparisonYear ? ` (${previousComparisonYear})` : ''}
                    </th>
                  `
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${rows}</tbody>
      </table>
    </div>
  `;
}

export function buildImpactosFaunaModalMarkup({ showHistorical = false, summary = null, table = '' } = {}) {
  const toggleLabel = showHistorical ? 'Mostrar año en curso' : 'Mostrar últimos 4 años';
  const toggleIcon = showHistorical ? 'fa-solid fa-calendar-day' : 'fa-solid fa-clock-rotate-left';
  const summarySection = summary
    ? `
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
          <article class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Operaciones</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatNumber(summary.operations, {
              decimals: 0
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${summary.periodLabel}</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Impactos</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatNumber(summary.impacts, {
              decimals: 0
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${summary.periodLabel}</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Tasa de impactos (%)</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatPercentage(summary.rate, {
              decimals: 4,
              scale: 'percentage'
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${summary.periodLabel}</p>
          </article>
        </div>
      `
    : `
        <div class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No hay valores mensuales disponibles para mostrar.
        </div>
      `;

  const detailTable = table
    ? table
    : `
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No hay datos históricos suficientes para mostrar el detalle del periodo.
        </div>
      `;

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
            <h2 class="text-2xl font-semibold text-slate-900">Impactos con fauna vs Tasa de impactos con fauna</h2>
            <p class="text-sm text-slate-600">Indicador 1.1 · Tasa de impactos con fauna dentro del aeropuerto.</p>
          </header>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-2">
              <p class="text-xs font-semibold uppercase tracking-widest text-primary-600">Indicador seleccionado</p>
              <h3 class="text-lg font-semibold text-slate-900">Indicador 1.1 · Tasa de impactos con fauna dentro del aeropuerto.</h3>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>Área: SMS</span>
                <span class="hidden sm:inline">·</span>
                <span>Unidad: Porcentaje</span>
              </div>
              <p class="text-sm text-slate-600">Valores mensuales${summary ? ` (${summary.periodLabel})` : ''}</p>
            </div>
            ${summarySection}
          </section>

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
            <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
              <span class="flex items-center gap-2">
                <span class="h-2.5 w-8 rounded-full bg-[#93c5fd]"></span>
                Impactos · Eje izquierdo
              </span>
              <span class="flex items-center gap-2">
                <span class="flex h-2.5 w-2.5 items-center justify-center">
                  <span class="h-2.5 w-2.5 rounded-full border-2 border-[#1d4ed8] bg-white"></span>
                </span>
                Tasa de impactos · Eje derecho
              </span>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Detalle del periodo</h3>
                <p class="text-xs text-slate-500">
                  ${
                    showHistorical
                      ? 'Tasa de impactos por año (hasta los últimos cuatro años disponibles).'
                      : 'Comparativo del año en curso contra el mismo mes del año anterior.'
                  }
                </p>
              </div>
            </div>
            ${detailTable}
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
    const tasaPercent = computeImpactRate(record).toFixed(4);
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
