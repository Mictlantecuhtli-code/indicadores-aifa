import { formatPercentage, monthName } from '../../utils/formatters.js';

export const PGPAFS_MODAL_ID = 'modalPgpaFs';

export const PGPAFS_THRESHOLDS = [
  {
    label: 'Objetivo',
    value: 95,
    color: '#22c55e',
    borderDash: [6, 6]
  },
  {
    label: 'Nivel de alerta 1',
    value: 92,
    color: '#facc15'
  },
  {
    label: 'Nivel de alerta 2',
    value: 88,
    color: '#fb923c'
  },
  {
    label: 'Nivel de alerta 3',
    value: 80,
    color: '#ef4444'
  }
];

const PGPAFS_MONTHLY_PARTS = 15;

const STACK_COLOR_PALETTE = [
  '#1d4ed8',
  '#0ea5e9',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#f43f5e',
  '#14b8a6',
  '#6366f1',
  '#facc15',
  '#fb7185',
  '#2dd4bf',
  '#ef4444'
];

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

const MONTH_NAME_LOOKUP = new Map([
  ['enero', 1],
  ['ene', 1],
  ['febrero', 2],
  ['feb', 2],
  ['marzo', 3],
  ['mar', 3],
  ['abril', 4],
  ['abr', 4],
  ['mayo', 5],
  ['may', 5],
  ['junio', 6],
  ['jun', 6],
  ['julio', 7],
  ['jul', 7],
  ['agosto', 8],
  ['ago', 8],
  ['septiembre', 9],
  ['setiembre', 9],
  ['sep', 9],
  ['octubre', 10],
  ['oct', 10],
  ['noviembre', 11],
  ['nov', 11],
  ['diciembre', 12],
  ['dic', 12]
]);

const CURRENT_YEAR = new Date().getFullYear();

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampPercentage(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric < 0) {
    return 0;
  }

  if (numeric > 100) {
    return 100;
  }

  return numeric;
}

function clampUnit(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric < 0) {
    return 0;
  }

  if (numeric > 1) {
    return 1;
  }

  return numeric;
}

function parseSmsDocumentMonth(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const text = raw.toString();
    if (text.length === 6) {
      const year = Number(text.slice(0, 4));
      const month = Number(text.slice(4));
      if (year >= 2000 && month >= 1 && month <= 12) {
        return { year, month };
      }
    }
  }

  const text = raw.toString().trim();
  if (!text) {
    return null;
  }

  const isoYearMonth = text.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (isoYearMonth) {
    const year = Number(isoYearMonth[1]);
    const month = Number(isoYearMonth[2]);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const isoDate = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let month = null;
  for (const [key, value] of MONTH_NAME_LOOKUP.entries()) {
    if (normalized.includes(key)) {
      month = value;
      break;
    }
  }

  if (!month) {
    const numericMonth = normalized.match(/(?:^|[\s\/-])(\d{1,2})(?:$|[\s\/-])/);
    if (numericMonth) {
      const candidate = Number(numericMonth[1]);
      if (candidate >= 1 && candidate <= 12) {
        month = candidate;
      }
    }
  }

  if (!month) {
    return null;
  }

  const yearMatch = normalized.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : CURRENT_YEAR;

  return { year, month };
}

function normalizeSmsDocumentRecords(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map(record => {
      const parsedMonth = parseSmsDocumentMonth(record?.mes);
      if (!parsedMonth) {
        return null;
      }

      const nombre = (record?.nombre_documento || '').toString().trim();

      return {
        id: record?.id ?? null,
        indicador_id: record?.indicador_id ?? null,
        year: parsedMonth.year,
        month: parsedMonth.month,
        monthLabel: monthName(parsedMonth.month) || `Mes ${parsedMonth.month}`,
        rawMonth: record?.mes ?? '',
        nombre_documento: nombre || 'Documento',
        codigo_documento: record?.codigo_documento ?? null,
        porcentaje: clampPercentage(record?.porcentaje),
        proposito_principal: record?.proposito_principal ?? null,
        entidad_area: record?.entidad_area ?? null
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });
}

function groupByIndicator(records) {
  const map = new Map();

  records.forEach(record => {
    const key = record.indicador_id || 'unknown';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(record);
  });

  return map;
}

function buildMonthEntries(records) {
  const monthMap = new Map();
  const documentOrder = [];
  const documentSet = new Set();

  records.forEach(record => {
    const key = `${record.year}-${String(record.month).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        year: record.year,
        month: record.month,
        documents: new Map()
      });
    }

    const entry = monthMap.get(key);
    const docName = record.nombre_documento || 'Documento';

    if (!documentSet.has(docName)) {
      documentSet.add(docName);
      documentOrder.push(docName);
    }

    const current = entry.documents.get(docName) ?? 0;
    const nextValue = Math.min(1, current + clampUnit(record?.porcentaje));
    entry.documents.set(docName, nextValue);
  });

  const entries = Array.from(monthMap.values()).sort((a, b) => {
    if (a.year === b.year) {
      return a.month - b.month;
    }
    return a.year - b.year;
  });

  entries.forEach(entry => {
    const totalUnits = Array.from(entry.documents.values()).reduce((sum, value) => sum + value, 0);
    const normalized = PGPAFS_MONTHLY_PARTS > 0 ? totalUnits / PGPAFS_MONTHLY_PARTS : 0;
    entry.totalRatio = Math.min(normalized, 1);
    entry.total = clampPercentage(entry.totalRatio * 100);
  });

  return { entries, documentOrder };
}

function buildPeriodLabel(entries = []) {
  if (!entries.length) {
    return '';
  }

  const first = entries[0];
  const last = entries[entries.length - 1];

  if (!first || !last) {
    return '';
  }

  const firstMonth = monthName(first.month) || `Mes ${first.month}`;
  const lastMonth = monthName(last.month) || `Mes ${last.month}`;

  if (first.year === last.year) {
    if (first.month === last.month) {
      return `${firstMonth} ${first.year}`;
    }
    return `${firstMonth} – ${lastMonth} ${last.year}`;
  }

  return `${firstMonth} ${first.year} – ${lastMonth} ${last.year}`;
}

function formatMonthYear(entry) {
  if (!entry) {
    return '—';
  }

  const name = monthName(entry.month) || `Mes ${entry.month}`;
  const year = entry.year ? ` ${entry.year}` : '';
  return `${name}${year}`;
}

export function buildPgpaFsChartView(records, { indicadorId } = {}) {
  const normalized = normalizeSmsDocumentRecords(records);

  if (!normalized.length) {
    return {
      config: null,
      entries: [],
      thresholds: PGPAFS_THRESHOLDS,
      indicadorId: indicadorId ?? null,
      documentNames: []
    };
  }

  const grouped = groupByIndicator(normalized);
  let targetIndicator = indicadorId ?? null;
  let indicatorRecords = [];

  if (targetIndicator && grouped.has(targetIndicator)) {
    indicatorRecords = grouped.get(targetIndicator);
  } else {
    let bestKey = null;
    let bestCount = 0;

    for (const [key, list] of grouped.entries()) {
      if (list.length > bestCount) {
        bestKey = key;
        bestCount = list.length;
      }
    }

    targetIndicator = bestKey;
    indicatorRecords = bestKey ? grouped.get(bestKey) : normalized;
  }

  if (!indicatorRecords.length) {
    return {
      config: null,
      entries: [],
      thresholds: PGPAFS_THRESHOLDS,
      indicadorId: targetIndicator,
      documentNames: []
    };
  }

  const { entries, documentOrder } = buildMonthEntries(indicatorRecords);

  if (!entries.length) {
    return {
      config: null,
      entries: [],
      thresholds: PGPAFS_THRESHOLDS,
      indicadorId: targetIndicator,
      documentNames: []
    };
  }

  const labels = entries.map(entry => {
    const short = MONTH_SHORT_NAMES[entry.month - 1] || `Mes ${entry.month}`;
    return [short, String(entry.year)];
  });

  const barDatasets = documentOrder.map((name, index) => {
    const color = STACK_COLOR_PALETTE[index % STACK_COLOR_PALETTE.length];
    return {
      type: 'bar',
      label: name,
      data: entries.map(entry => {
        const value = entry.documents.get(name) ?? 0;
        const normalized = PGPAFS_MONTHLY_PARTS > 0 ? (value / PGPAFS_MONTHLY_PARTS) * 100 : 0;
        return clampPercentage(normalized);
      }),
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1,
      stack: 'pgpafs',
      maxBarThickness: 56,
      order: 0
    };
  });

  // Comentado para eliminar las líneas de umbrales de la gráfica
  // const thresholdDatasets = PGPAFS_THRESHOLDS.map((threshold, index) => ({
  //   type: 'line',
  //   label: `${threshold.label} (${formatPercentage(threshold.value, { decimals: 0, scale: 'percentage' })})`,
  //   data: entries.map(() => threshold.value),
  //   borderColor: threshold.color,
  //   backgroundColor: threshold.color,
  //   borderWidth: 2,
  //   borderDash: threshold.borderDash ?? [],
  //   pointRadius: 0,
  //   pointHoverRadius: 0,
  //   fill: false,
  //   yAxisID: 'percentage',
  //   order: -20 - index,
  //   z: -20,
  //   segment: {
  //     borderDash: threshold.borderDash ?? []
  //   },
  //   tooltip: {
  //     enabled: false
  //   }
  // }));

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [...barDatasets] // Eliminado thresholdDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 16,
          right: 24,
          bottom: 24,
          left: 16
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback(value, index) {
              return labels[index];
            },
            font: {
              size: 12
            }
          }
        },
        percentage: {
          stacked: true,
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: {
            callback: value => `${value}%`
          },
          title: {
            display: true,
            text: 'Porcentaje de cumplimiento (%)'
          },
          grid: {
            drawBorder: false
          }
        }
      },
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title(items) {
              if (!items?.length) {
                return '';
              }
              const { dataIndex } = items[0];
              const entry = entries[dataIndex];
              if (!entry) {
                return '';
              }
              return `${monthName(entry.month)} ${entry.year}`;
            },
            label(context) {
              if (!context?.dataset) {
                return '';
              }

              const value = Number(context.parsed?.y);
              const formatted = formatPercentage(value, { decimals: 2, scale: 'percentage' });
              return `${context.dataset.label}: ${formatted}`;
            }
          }
        }
      }
    }
  };

  return {
    config,
    entries,
    thresholds: PGPAFS_THRESHOLDS,
    indicadorId: targetIndicator,
    documentNames: documentOrder
  };
}

export function buildPgpaFsSummary(entries = []) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  const totals = entries.map(entry => {
    const total = Number.isFinite(entry.total)
      ? entry.total
      : clampPercentage(
          ((Array.from(entry.documents?.values?.() ?? []).reduce((sum, value) => sum + Number(value || 0), 0) /
            PGPAFS_MONTHLY_PARTS) || 0) * 100
        );

    return {
      year: entry.year,
      month: entry.month,
      total: clampPercentage(total)
    };
  });

  if (!totals.length) {
    return null;
  }

  const average = totals.reduce((sum, item) => sum + item.total, 0) / totals.length;
  const latest = totals[totals.length - 1];
  const best = totals.reduce((acc, item) => (item.total > acc.total ? item : acc), totals[0]);

  return {
    average,
    latest,
    best,
    periodLabel: buildPeriodLabel(entries)
  };
}

export function buildPgpaFsModalMarkup({
  activeTab = 'pgpafs',
  hasData = false,
  summary = null,
  periodLabel = ''
} = {}) {
  const pgpafsActive = activeTab === 'pgpafs';
  const capturesActive = activeTab === 'captures';
  const effectivePeriod = summary?.periodLabel || periodLabel || '';

  const summaryMarkup = summary
    ? `
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Promedio general</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatPercentage(summary.average, {
              decimals: 2,
              scale: 'percentage'
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${effectivePeriod ? escapeHtml(effectivePeriod) : 'Periodo disponible'}</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Último mes</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatPercentage(summary.latest?.total, {
              decimals: 2,
              scale: 'percentage'
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${escapeHtml(formatMonthYear(summary.latest))}</p>
          </article>
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Mejor mes</p>
            <p class="mt-3 text-3xl font-semibold text-slate-900">${formatPercentage(summary.best?.total, {
              decimals: 2,
              scale: 'percentage'
            })}</p>
            <p class="mt-2 text-xs text-slate-500">${escapeHtml(formatMonthYear(summary.best))}</p>
          </article>
        </div>
      `
    : `
        <div class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No hay valores mensuales capturados para este indicador.
        </div>
      `;

  const chartContent = hasData
    ? `
        <div class="h-96">
          <canvas id="chartPgpaFs"></canvas>
        </div>
      `
    : `
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No hay datos disponibles del programa PGPAFS para los meses consultados.
        </div>
      `;

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay data-modal-id="${PGPAFS_MODAL_ID}">
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
            <h2 class="text-2xl font-semibold text-slate-900">Porcentaje de cumplimiento del programa de gestión del peligro aviario y la fauna silvestre</h2>
            <p class="text-sm text-slate-600">Indicador 1.2 - PGPAFS</p>
          </header>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4">
              <div class="flex flex-wrap items-center gap-3" role="tablist">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    pgpafsActive ? 'bg-primary-600 text-white shadow' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }"
                  data-pgpafs-tab="pgpafs"
                  aria-selected="${pgpafsActive ? 'true' : 'false'}"
                >
                  PGPAFS
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    capturesActive ? 'bg-primary-600 text-white shadow' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }"
                  data-pgpafs-tab="captures"
                  aria-selected="${capturesActive ? 'true' : 'false'}"
                >
                  Capturas realizadas por especie
                </button>
              </div>

              <div class="space-y-2">
                <p class="text-xs font-semibold uppercase tracking-widest text-primary-600">Indicador seleccionado</p>
                <h3 class="text-lg font-semibold text-slate-900">Indicador 1.2 - PGPAFS</h3>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Área: SMS</span>
                  <span class="hidden sm:inline">·</span>
                  <span>Unidad: Porcentaje</span>
                </div>
                <p class="text-sm text-slate-600">Valores mensuales${effectivePeriod ? ` (${escapeHtml(effectivePeriod)})` : ''}</p>
              </div>
            </div>
            ${summaryMarkup}
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="space-y-6">
              <div class="space-y-6" data-pgpafs-panel="pgpafs" ${pgpafsActive ? '' : 'hidden'}>
                ${chartContent}
              </div>

              <div data-pgpafs-panel="captures" ${capturesActive ? '' : 'hidden'}>
                <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  Esta sección estará disponible próximamente.
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer class="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
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
