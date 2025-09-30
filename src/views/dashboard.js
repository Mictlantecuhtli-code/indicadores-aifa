import { getIndicators, getIndicatorHistory, getIndicatorTargets } from '../services/supabaseClient.js';
import { formatNumber, formatPercentage, formatDate, monthName } from '../utils/formatters.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { INDICATOR_SECTIONS, buildIndicatorOptions, normalizeText } from '../config/dashboardConfig.js';

const PALETTES = {
  indigo: {
    border: 'border-indigo-100',
    background: 'bg-indigo-50/80',
    icon: 'text-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    optionIdle: 'border-indigo-100 hover:border-indigo-200 hover:bg-white',
    optionActive: 'border-indigo-200 bg-white shadow-lg shadow-indigo-200/60 text-indigo-900',
    chevron: 'text-indigo-500'
  },
  blue: {
    border: 'border-blue-100',
    background: 'bg-blue-50/80',
    icon: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    optionIdle: 'border-blue-100 hover:border-blue-200 hover:bg-white',
    optionActive: 'border-blue-200 bg-white shadow-lg shadow-blue-200/60 text-blue-900',
    chevron: 'text-blue-500'
  },
  amber: {
    border: 'border-amber-100',
    background: 'bg-amber-50/80',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    optionIdle: 'border-amber-100 hover:border-amber-200 hover:bg-white',
    optionActive: 'border-amber-200 bg-white shadow-lg shadow-amber-200/60 text-amber-900',
    chevron: 'text-amber-500'
  },
  orange: {
    border: 'border-orange-100',
    background: 'bg-orange-50/80',
    icon: 'text-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    optionIdle: 'border-orange-100 hover:border-orange-200 hover:bg-white',
    optionActive: 'border-orange-200 bg-white shadow-lg shadow-orange-200/60 text-orange-900',
    chevron: 'text-orange-500'
  },
  emerald: {
    border: 'border-emerald-100',
    background: 'bg-emerald-50/80',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    optionIdle: 'border-emerald-100 hover:border-emerald-200 hover:bg-white',
    optionActive: 'border-emerald-200 bg-white shadow-lg shadow-emerald-200/60 text-emerald-900',
    chevron: 'text-emerald-500'
  },
  teal: {
    border: 'border-teal-100',
    background: 'bg-teal-50/80',
    icon: 'text-teal-500',
    badge: 'bg-teal-100 text-teal-700',
    optionIdle: 'border-teal-100 hover:border-teal-200 hover:bg-white',
    optionActive: 'border-teal-200 bg-white shadow-lg shadow-teal-200/60 text-teal-900',
    chevron: 'text-teal-500'
  },
  violet: {
    border: 'border-violet-100',
    background: 'bg-violet-50/80',
    icon: 'text-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    optionIdle: 'border-violet-100 hover:border-violet-200 hover:bg-white',
    optionActive: 'border-violet-200 bg-white shadow-lg shadow-violet-200/60 text-violet-900',
    chevron: 'text-violet-500'
  },
  sky: {
    border: 'border-sky-100',
    background: 'bg-sky-50/80',
    icon: 'text-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    optionIdle: 'border-sky-100 hover:border-sky-200 hover:bg-white',
    optionActive: 'border-sky-200 bg-white shadow-lg shadow-sky-200/60 text-sky-900',
    chevron: 'text-sky-500'
  },
  slate: {
    border: 'border-slate-200',
    background: 'bg-slate-50/80',
    icon: 'text-slate-500',
    badge: 'bg-slate-100 text-slate-600',
    optionIdle: 'border-slate-200 hover:border-slate-300 hover:bg-white',
    optionActive: 'border-slate-300 bg-white shadow-lg shadow-slate-200/60 text-slate-900',
    chevron: 'text-slate-500'
  }
};

const CARD_ICON_CLASSES = {
  'plane-operations': 'fa-solid fa-plane-up',
  'plane-passengers': 'fa-solid fa-users-between-lines',
  'cargo-operations': 'fa-solid fa-boxes-stacked',
  'cargo-weight': 'fa-solid fa-weight-hanging',
  'fbo-operations': 'fa-solid fa-plane',
  'fbo-passengers': 'fa-solid fa-user-group'
};

const OPTION_ICON_CLASSES = {
  'calendar-month': 'fa-solid fa-calendar-days',
  'calendar-quarter': 'fa-solid fa-calendar-week',
  'calendar-year': 'fa-solid fa-calendar',
  'target-low': 'fa-solid fa-bullseye',
  'target-mid': 'fa-solid fa-chart-line',
  'target-high': 'fa-solid fa-bullseye-pointer'
};

const VIEW_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'comparativo', label: 'Comparativo real vs meta' },
  { id: 'tendencias', label: 'Tendencias' }
];

const SCENARIOS = [
  { id: 'BAJO', label: 'Escenario bajo' },
  { id: 'MEDIO', label: 'Escenario medio' },
  { id: 'ALTO', label: 'Escenario alto' }
];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const SERIES_COLORS = ['#1E3A8A', '#0EA5E9', '#10B981', '#F97316', '#9333EA', '#DC2626'];

let activeChart = null;

const detailState = {
  indicatorId: null,
  history: [],
  targets: [],
  chartType: 'line',
  activeTab: 'dashboard',
  scenario: 'MEDIO'
};

function withAlpha(color, alpha = 0.15) {
  if (!color?.startsWith('#') || (color.length !== 7 && color.length !== 4)) {
    return color;
  }
  const hex = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function sortHistory(records = []) {
  return [...records]
    .filter(item => item != null)
    .sort((a, b) => {
      const yearDiff = (a?.anio ?? 0) - (b?.anio ?? 0);
      if (yearDiff !== 0) {
        return yearDiff;
      }
      return (a?.mes ?? 0) - (b?.mes ?? 0);
    });
}

function buildKey(year, month = 0) {
  return `${year}-${String(month ?? 0).padStart(2, '0')}`;
}

function formatMonthLabel(year, month = 1) {
  return `${monthName(month ?? 1)} ${year}`;
}

function buildTargetsIndex(targets = []) {
  const map = new Map();
  targets.forEach(item => {
    const scenario = (item?.escenario ?? '').toUpperCase();
    if (!scenario) return;
    if (!map.has(scenario)) {
      map.set(scenario, new Map());
    }
    const key = buildKey(item.anio, item.mes ?? 0);
    map.get(scenario).set(key, Number(item.valor) || null);
  });
  return map;
}

function calculateProjection(history, months = 6) {
  const numericHistory = history
    .filter(item => item?.valor != null && !Number.isNaN(Number(item.valor)))
    .map((item, index) => ({ ...item, index, valor: Number(item.valor) }));

  if (numericHistory.length < 2) return [];

  const n = numericHistory.length;
  const sumX = numericHistory.reduce((acc, item) => acc + item.index, 0);
  const sumY = numericHistory.reduce((acc, item) => acc + item.valor, 0);
  const sumXY = numericHistory.reduce((acc, item) => acc + item.index * item.valor, 0);
  const sumX2 = numericHistory.reduce((acc, item) => acc + item.index * item.index, 0);
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) return [];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const last = numericHistory[numericHistory.length - 1];
  let year = last.anio;
  let month = last.mes ?? 1;

  const projection = [];
  for (let i = 1; i <= months; i += 1) {
    const nextIndex = last.index + i;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const value = slope * nextIndex + intercept;
    projection.push({
      period: formatMonthLabel(year, month),
      year,
      month,
      projected: value
    });
  }

  return projection;
}

function prepareDashboardChart(history, chartType = 'line') {
  const sorted = sortHistory(history);
  const years = Array.from(new Set(sorted.map(item => item.anio))).sort((a, b) => a - b);
  const selectedYears = years.slice(-4);

  const labels = MONTH_LABELS;
  const datasets = selectedYears.map((year, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length];
    const data = Array.from({ length: 12 }).map((_, monthIndex) => {
      const month = monthIndex + 1;
      const record = sorted.find(item => item.anio === year && (item.mes ?? 0) === month);
      return record ? Number(record.valor) || null : null;
    });

    return {
      label: `${year}`,
      data,
      type: chartType === 'bar' ? 'bar' : 'line',
      backgroundColor: chartType === 'bar' ? withAlpha(color, 0.65) : withAlpha(color, 0.15),
      borderColor: color,
      borderWidth: 2,
      tension: 0.3,
      fill: chartType === 'line'
    };
  });

  return { labels, datasets };
}

function prepareComparativoChart(history, targets, scenario = 'MEDIO', chartType = 'line') {
  const sorted = sortHistory(history);
  const lastRecords = sorted.slice(-12);
  const targetIndex = buildTargetsIndex(targets);
  const scenarioTargets = targetIndex.get(scenario?.toUpperCase() ?? 'MEDIO') ?? new Map();

  const labels = lastRecords.map(item => formatMonthLabel(item.anio, item.mes ?? 1));
  const realValues = lastRecords.map(item => (item?.valor != null ? Number(item.valor) : null));
  const metaValues = lastRecords.map(item => scenarioTargets.get(buildKey(item.anio, item.mes ?? 0)) ?? null);

  const colorReal = SERIES_COLORS[0];
  const colorMeta = SERIES_COLORS[2];

  const datasets = [
    {
      label: 'Valor real',
      data: realValues,
      type: chartType === 'bar' ? 'bar' : 'line',
      backgroundColor: chartType === 'bar' ? withAlpha(colorReal, 0.7) : withAlpha(colorReal, 0.2),
      borderColor: colorReal,
      borderWidth: 2,
      tension: 0.25,
      fill: chartType === 'line'
    },
    {
      label: `Meta (${scenario ?? 'MEDIO'})`,
      data: metaValues,
      type: chartType === 'bar' ? 'bar' : 'line',
      backgroundColor: chartType === 'bar' ? withAlpha(colorMeta, 0.4) : 'transparent',
      borderColor: colorMeta,
      borderWidth: 2,
      tension: 0.25,
      fill: false,
      borderDash: chartType === 'line' ? [6, 4] : undefined
    }
  ];

  const lastReal = realValues.length ? realValues[realValues.length - 1] : null;
  const lastMeta = metaValues.length ? metaValues[metaValues.length - 1] : null;
  const compliance = lastReal != null && lastMeta ? lastReal / lastMeta : null;

  return { labels, datasets, compliance };
}

function prepareTrendChart(history, chartType = 'line') {
  const sorted = sortHistory(history);
  const projection = calculateProjection(sorted, 6);

  const labels = [
    ...sorted.map(item => formatMonthLabel(item.anio, item.mes ?? 1)),
    ...projection.map(item => item.period)
  ];

  const realColor = SERIES_COLORS[0];
  const projectionColor = SERIES_COLORS[4];

  const realData = [
    ...sorted.map(item => (item?.valor != null ? Number(item.valor) : null)),
    ...projection.map(() => null)
  ];

  const projectionData = [
    ...Array(sorted.length).fill(null),
    ...projection.map(item => item.projected)
  ];

  const datasets = [
    {
      label: 'Valor real',
      data: realData,
      type: chartType === 'bar' ? 'bar' : 'line',
      backgroundColor: chartType === 'bar' ? withAlpha(realColor, 0.7) : withAlpha(realColor, 0.2),
      borderColor: realColor,
      borderWidth: 2,
      tension: 0.25,
      fill: chartType === 'line'
    },
    {
      label: 'Proyección',
      data: projectionData,
      type: 'line',
      backgroundColor: 'transparent',
      borderColor: projectionColor,
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 3,
      pointHoverRadius: 4,
      tension: 0.2,
      fill: false
    }
  ];

  return { labels, datasets };
}

function updateChartTypeButtons() {
  document.querySelectorAll('[data-chart-type]').forEach(button => {
    const isActive = button.dataset.chartType === detailState.chartType;
    button.classList.toggle('bg-white', isActive);
    button.classList.toggle('text-aifa-blue', isActive);
    button.classList.toggle('shadow', isActive);
    button.classList.toggle('border', true);
    button.classList.toggle('border-transparent', !isActive);
    button.classList.toggle('border-aifa-blue', isActive);
  });
}

function updateTabButtons() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    const isActive = button.dataset.tab === detailState.activeTab;
    button.classList.toggle('bg-aifa-blue', isActive);
    button.classList.toggle('text-white', isActive);
    button.classList.toggle('shadow', isActive);
    button.classList.toggle('text-slate-500', !isActive);
    button.classList.toggle('border', true);
    button.classList.toggle('border-aifa-blue', isActive);
    button.classList.toggle('border-transparent', !isActive);
  });
}

function updateScenarioButtons() {
  document.querySelectorAll('[data-scenario]').forEach(button => {
    const isActive = button.dataset.scenario === detailState.scenario;
    button.classList.toggle('bg-aifa-blue', isActive);
    button.classList.toggle('text-white', isActive);
    button.classList.toggle('border-aifa-blue', isActive);
    button.classList.toggle('border-slate-200', !isActive);
    button.classList.toggle('text-slate-500', !isActive);
  });
}

function toggleScenarioControls(visible) {
  const controls = document.querySelector('[data-scenario-controls]');
  if (!controls) return;
  controls.classList.toggle('hidden', !visible);
}

function updateComplianceBadge(compliance) {
  const badge = document.querySelector('[data-compliance-badge]');
  if (!badge) return;

  if (compliance == null) {
    badge.classList.add('hidden');
    badge.textContent = '';
    badge.classList.remove('bg-emerald-50', 'text-emerald-600', 'bg-amber-50', 'text-amber-600', 'bg-rose-50', 'text-rose-600');
    return;
  }

  badge.classList.remove('hidden');
  badge.classList.remove('bg-emerald-50', 'text-emerald-600', 'bg-amber-50', 'text-amber-600', 'bg-rose-50', 'text-rose-600');

  if (compliance >= 1.02) {
    badge.classList.add('bg-emerald-50', 'text-emerald-600');
  } else if (compliance >= 0.9) {
    badge.classList.add('bg-amber-50', 'text-amber-600');
  } else {
    badge.classList.add('bg-rose-50', 'text-rose-600');
  }

  badge.textContent = `Cumplimiento actual: ${formatPercentage(compliance)}`;
}

function destroyActiveChart() {
  if (activeChart) {
    activeChart.destroy();
    activeChart = null;
  }
}

function setDetailLoading() {
  const chartContainer = document.querySelector('[data-chart-container]');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div class="flex h-72 items-center justify-center text-sm text-slate-500">
        <i class="fa-solid fa-spinner animate-spin mr-2"></i>
        Cargando información del indicador...
      </div>
    `;
  }

  const historyBody = document.querySelector('[data-history-body]');
  if (historyBody) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">Cargando mediciones...</td>
      </tr>
    `;
  }
}

function resetDetailView() {
  detailState.indicatorId = null;
  detailState.history = [];
  detailState.targets = [];
  detailState.activeTab = 'dashboard';
  detailState.chartType = 'line';
  detailState.scenario = 'MEDIO';

  destroyActiveChart();
  updateChartTypeButtons();
  updateTabButtons();
  updateScenarioButtons();
  toggleScenarioControls(false);
  updateComplianceBadge(null);

  const chartContainer = document.querySelector('[data-chart-container]');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div class="flex h-72 items-center justify-center text-sm text-slate-500">
        Seleccione un indicador con información disponible.
      </div>
    `;
  }

  const historyBody = document.querySelector('[data-history-body]');
  if (historyBody) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">Seleccione un indicador asignado.</td>
      </tr>
    `;
  }
}

function updateHistoryTable(history) {
  const historyBody = document.querySelector('[data-history-body]');
  if (!historyBody) return;
  historyBody.innerHTML = buildHistoryTable(history ?? []);
}

function renderDetailChart() {
  const chartContainer = document.querySelector('[data-chart-container]');
  if (!chartContainer) return;

  if (!detailState.indicatorId) {
    resetDetailView();
    return;
  }

  const tab = detailState.activeTab;
  let chartData = { labels: [], datasets: [] };
  let compliance = null;

  if (tab === 'dashboard') {
    chartData = prepareDashboardChart(detailState.history, detailState.chartType);
  } else if (tab === 'comparativo') {
    const prepared = prepareComparativoChart(
      detailState.history,
      detailState.targets,
      detailState.scenario,
      detailState.chartType
    );
    chartData = prepared;
    compliance = prepared.compliance ?? null;
  } else {
    chartData = prepareTrendChart(detailState.history, detailState.chartType);
  }

  const hasData = chartData.datasets.some(dataset => dataset.data.some(value => value != null));
  if (!chartData.labels.length || !hasData) {
    destroyActiveChart();
    chartContainer.innerHTML = `
      <div class="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500">
        No hay datos suficientes para mostrar esta visualización.
      </div>
    `;
    toggleScenarioControls(tab === 'comparativo' && hasData);
    updateComplianceBadge(compliance);
    return;
  }

  chartContainer.innerHTML = '<canvas id="indicator-analytics-chart" class="h-72 w-full"></canvas>';
  const canvas = document.getElementById('indicator-analytics-chart');
  if (!canvas) return;

  destroyActiveChart();

  const baseType = detailState.chartType === 'bar' ? 'bar' : 'line';
  activeChart = new Chart(canvas, {
    type: baseType,
    data: {
      labels: chartData.labels,
      datasets: chartData.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? context.parsed ?? null;
              if (value == null || Number.isNaN(value)) {
                return `${context.dataset.label}: sin dato`;
              }
              return `${context.dataset.label}: ${formatNumber(value)}`;
            }
          }
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

  toggleScenarioControls(tab === 'comparativo' && hasData);
  updateComplianceBadge(compliance);
}

function buildIndicatorCard(category, options) {
  const assignedOptions = options.filter(option => option.indicator);
  if (!assignedOptions.length) {
    return '';
  }
  const palette = PALETTES[category.palette] ?? PALETTES.slate;
  const iconClass = CARD_ICON_CLASSES[category.icon] ?? 'fa-solid fa-chart-line';
  const assignedCount = assignedOptions.length;
  const headerStatus = `${assignedCount} indicador${assignedCount === 1 ? '' : 'es'} disponibles`;

  return `
    <article class="overflow-hidden rounded-2xl border ${palette.border} bg-white shadow-sm" data-card="${category.id}">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition ${palette.background} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aifa-light"
        data-toggle-card="${category.id}"
        aria-expanded="false"
      >
        <div class="flex flex-1 items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow ${palette.icon}">
            <i class="${iconClass}"></i>
          </span>
          <div>
            <p class="text-base font-semibold text-slate-800">${category.label}</p>
            <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${palette.badge}">
              ${headerStatus}
            </span>
          </div>
        </div>
        <i class="fa-solid fa-chevron-down transition-transform ${palette.chevron}" data-chevron="${category.id}"></i>
      </button>
      <div class="grid transition-[grid-template-rows] duration-300 ease-in-out grid-rows-[0fr]" data-card-body="${category.id}">
        <div class="min-h-0 overflow-hidden border-t border-slate-100 bg-white px-5 py-4">
          <div class="flex flex-col gap-3">
            ${assignedOptions
              .map(option => {
                const optionIcon = OPTION_ICON_CLASSES[option.icon] ?? 'fa-solid fa-chart-line';
                const idle = palette.optionIdle;
                const active = palette.optionActive;
                return `
                  <button
                    type="button"
                    class="flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${idle} focus:ring-aifa-light"
                    data-option="${option.id}"
                    data-theme-idle="${idle}"
                    data-theme-active="${active}"
                    data-card-owner="${category.id}"
                    data-indicator-id="${option.indicator?.id ?? ''}"
                  >
                    <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ${
                      option.indicator ? palette.icon : 'text-slate-400'
                    }">
                      <i class="${optionIcon}"></i>
                    </span>
                    <div class="flex flex-1 flex-col gap-1">
                      <span class="font-medium leading-snug">${option.label}</span>
                      <span class="text-xs text-slate-500">
                        Último valor: ${formatNumber(option.indicator.ultima_medicion_valor)} ${option.indicator.unidad_medida ?? ''}
                      </span>
                    </div>
                    ${
                      option.indicator?.ultima_medicion_fecha
                        ? `<div class="text-right text-xs text-slate-400">
                            Actualizado<br />
                            ${formatDate(option.indicator.ultima_medicion_fecha)}
                          </div>`
                        : ''
                    }
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    </article>
  `;
}

function buildHistoryTable(history = []) {
  const ordered = sortHistory(history);

  if (!ordered.length) {
    return `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">No hay mediciones registradas para este indicador.</td>
      </tr>
    `;
  }

  return ordered
    .slice(-12)
    .map(item => `
      <tr class="hover:bg-slate-50/80">
        <td class="px-4 py-2 text-left text-slate-600">${monthName(item.mes ?? 1)} ${item.anio}</td>
        <td class="px-4 py-2 text-right font-medium text-slate-800">${formatNumber(item.valor)}</td>
        <td class="px-4 py-2 text-right text-slate-500">${item.escenario ?? '—'}</td>
      </tr>
    `)
    .join('');
}

function toggleAccordion(id) {
  document.querySelectorAll('[data-card-body]').forEach(panel => {
    const panelId = panel.getAttribute('data-card-body');
    const header = document.querySelector(`[data-toggle-card="${panelId}"]`);
    const chevron = document.querySelector(`[data-chevron="${panelId}"]`);
    const isTarget = panelId === id;

    if (isTarget) {
      const expanded = panel.style.gridTemplateRows === '1fr';
      if (expanded) {
        panel.style.gridTemplateRows = '0fr';
        panel.setAttribute('aria-hidden', 'true');
        if (header) header.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.classList.remove('rotate-180');
      } else {
        panel.style.gridTemplateRows = '1fr';
        panel.setAttribute('aria-hidden', 'false');
        if (header) header.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.classList.add('rotate-180');
      }
    } else {
      panel.style.gridTemplateRows = '0fr';
      panel.setAttribute('aria-hidden', 'true');
      if (header) header.setAttribute('aria-expanded', 'false');
      if (chevron) chevron.classList.remove('rotate-180');
    }
  });
}

function ensureCardOpen(cardId) {
  if (!cardId) return;
  const panel = document.querySelector(`[data-card-body="${cardId}"]`);
  if (!panel) return;
  panel.style.gridTemplateRows = '1fr';
  panel.setAttribute('aria-hidden', 'false');
  const header = document.querySelector(`[data-toggle-card="${cardId}"]`);
  const chevron = document.querySelector(`[data-chevron="${cardId}"]`);
  if (header) header.setAttribute('aria-expanded', 'true');
  if (chevron) chevron.classList.add('rotate-180');
}

function updateActiveOption(optionId) {
  document.querySelectorAll('[data-option]').forEach(button => {
    const idle = button.dataset.themeIdle ? button.dataset.themeIdle.split(' ') : [];
    const active = button.dataset.themeActive ? button.dataset.themeActive.split(' ') : [];

    button.classList.remove(...active);
    if (idle.length) {
      idle.forEach(cls => {
        if (!button.classList.contains(cls)) {
          button.classList.add(cls);
        }
      });
    }
    if (button.dataset.option === optionId) {
      button.classList.remove(...idle);
      if (active.length) {
        active.forEach(cls => {
          if (!button.classList.contains(cls)) {
            button.classList.add(cls);
          }
        });
      }
      button.setAttribute('data-active', 'true');
    } else {
      button.removeAttribute('data-active');
    }
  });
}

function updateIndicatorInfo(indicator) {
  const name = document.querySelector('[data-indicator-name]');
  const description = document.querySelector('[data-indicator-description]');
  const unit = document.querySelector('[data-indicator-unit]');
  const value = document.querySelector('[data-indicator-value]');
  const valueDate = document.querySelector('[data-indicator-value-date]');
  const targetValue = document.querySelector('[data-indicator-target]');
  const targetScenario = document.querySelector('[data-indicator-target-scenario]');
  const alertBanner = document.querySelector('[data-indicator-alert]');

  if (!indicator) {
    if (name) name.textContent = 'Seleccione un indicador asignado';
    if (description) {
      description.textContent = '';
      description.classList.add('hidden');
    }
    if (unit) unit.textContent = '—';
    if (value) value.textContent = '—';
    if (valueDate) valueDate.textContent = '';
    if (targetValue) targetValue.textContent = '—';
    if (targetScenario) targetScenario.textContent = '';
    if (alertBanner) {
      alertBanner.textContent = '';
      alertBanner.classList.add('hidden');
    }
    return;
  }

  if (name) name.textContent = indicator.nombre ?? 'Indicador sin nombre';
  if (description) {
    description.textContent = indicator.descripcion ?? '';
    description.classList.toggle('hidden', !indicator.descripcion);
  }
  if (unit) unit.textContent = indicator.unidad_medida ?? '—';
  if (value) value.textContent = formatNumber(indicator.ultima_medicion_valor);
  if (valueDate) {
    valueDate.textContent = indicator.ultima_medicion_fecha
      ? `Actualizado ${formatDate(indicator.ultima_medicion_fecha)}`
      : '';
  }
  if (targetValue) targetValue.textContent = formatNumber(indicator.meta_vigente_valor);
  if (targetScenario) {
    targetScenario.textContent = indicator.meta_vigente_escenario
      ? `Escenario ${indicator.meta_vigente_escenario}`
      : '';
  }
  if (alertBanner) {
    if (indicator.ultima_medicion_alerta) {
      alertBanner.textContent = indicator.ultima_medicion_alerta;
      alertBanner.classList.remove('hidden');
    } else {
      alertBanner.textContent = '';
      alertBanner.classList.add('hidden');
    }
  }
}

async function loadIndicatorDetails(indicatorId) {
  if (!indicatorId) {
    resetDetailView();
    return;
  }

  setDetailLoading();

  try {
    const [history, targets] = await Promise.all([
      getIndicatorHistory(indicatorId, { limit: 120 }),
      getIndicatorTargets(indicatorId)
    ]);

    detailState.history = sortHistory(history ?? []);
    detailState.targets = targets ?? [];

    updateHistoryTable(detailState.history);
    updateScenarioButtons();
    renderDetailChart();
  } catch (error) {
    console.error(error);
    const chartContainer = document.querySelector('[data-chart-container]');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-600">
          No fue posible cargar la información histórica del indicador.
        </div>
      `;
    }

    const historyBody = document.querySelector('[data-history-body]');
    if (historyBody) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="3" class="px-4 py-6 text-center text-red-500">Ocurrió un error al cargar las mediciones.</td>
        </tr>
      `;
    }

    updateComplianceBadge(null);
    toggleScenarioControls(false);
  }
}

function selectIndicator(optionId, indicator) {
  if (optionId && indicator) {
    updateActiveOption(optionId);
    ensureCardOpen(document.querySelector(`[data-option="${optionId}"]`)?.dataset.cardOwner ?? null);
  }

  if (!indicator) {
    updateIndicatorInfo(null);
    resetDetailView();
    return;
  }

  detailState.indicatorId = indicator.id;
  detailState.activeTab = 'dashboard';
  detailState.scenario = 'MEDIO';

  updateIndicatorInfo(indicator);
  updateChartTypeButtons();
  updateTabButtons();
  updateScenarioButtons();
  toggleScenarioControls(false);
  updateComplianceBadge(null);

  loadIndicatorDetails(indicator.id);
}

function bindInteractions() {
  document.querySelectorAll('[data-toggle-card]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-toggle-card');
      if (!id) return;
      toggleAccordion(id);
    });
  });

  document.querySelectorAll('[data-option]').forEach(button => {
    button.addEventListener('click', () => {
      const optionId = button.dataset.option;
      const indicatorId = button.dataset.indicatorId;
      if (!indicatorId) return;
      const indicator = button.__indicatorRef;
      selectIndicator(optionId, indicator);
    });
  });

  document.querySelectorAll('[data-chart-type]').forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.chartType;
      if (!type || detailState.chartType === type) return;
      detailState.chartType = type;
      updateChartTypeButtons();
      renderDetailChart();
    });
  });

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      if (!tab || detailState.activeTab === tab) return;
      detailState.activeTab = tab;
      updateTabButtons();
      if (tab !== 'comparativo') {
        updateComplianceBadge(null);
      }
      renderDetailChart();
    });
  });

  document.querySelectorAll('[data-scenario]').forEach(button => {
    button.addEventListener('click', () => {
      const scenario = button.dataset.scenario;
      if (!scenario || detailState.scenario === scenario) return;
      detailState.scenario = scenario;
      updateScenarioButtons();
      if (detailState.activeTab === 'comparativo') {
        renderDetailChart();
      }
    });
  });
}

function hydrateOptionReferences(sections) {
  sections.forEach(section => {
    section.categories.forEach(category => {
      category.options.forEach(option => {
        const button = document.querySelector(`[data-option="${option.id}"]`);
        if (button) {
          button.__indicatorRef = option.indicator ?? null;
        }
      });
    });
  });
}

export async function renderDashboard(container) {
  renderLoading(container, 'Preparando panel de análisis...');

  try {
    const indicators = await getIndicators();

    const indicatorIndex = indicators.map(record => ({
      record,
      normalizedName: normalizeText(record.nombre),
      normalizedDescription: normalizeText(record.descripcion),
      normalizedArea: normalizeText(record.area_nombre ?? record.area)
    }));

    const sections = INDICATOR_SECTIONS.map(section => {
      const categories = section.categories
        .map(category => {
          const options = buildIndicatorOptions(category)
            .map(option => {
              const normalizedOption = normalizeText(option.label);
              const match = indicatorIndex.find(entry => {
                if (!entry.normalizedName && !entry.normalizedDescription) return false;
                const haystacks = [entry.normalizedName, entry.normalizedDescription].filter(Boolean);
                const sectionName = normalizeText(category.label);
                const areaName = entry.normalizedArea;
                const optionWords = normalizedOption.split(' ').filter(Boolean);
                return haystacks.some(text => {
                  if (text.includes(normalizedOption)) return true;
                  const containsAllWords = optionWords.every(part => text.includes(part));
                  if (containsAllWords && sectionName && text.includes(sectionName)) {
                    return true;
                  }
                  if (containsAllWords && areaName && text.includes(areaName)) {
                    return true;
                  }
                  return false;
                });
              });
              return { ...option, indicator: match?.record ?? null };
            })
            .filter(option => option.indicator);

          if (!options.length) return null;
          return { ...category, options };
        })
        .filter(Boolean);

      if (!categories.length) return null;
      return { ...section, categories };
    })
      .filter(Boolean);

    const sectionsMarkup = sections
      .map(section => {
        const cards = section.categories
          .map(category => buildIndicatorCard(category, category.options))
          .filter(Boolean)
          .join('');

        if (!cards) return '';

        return `
          <section class="space-y-4" data-section="${section.id}">
            <header>
              <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-500">${section.title}</h2>
              <p class="text-xs text-slate-400">${section.description ?? ''}</p>
            </header>
            <div class="space-y-3">
              ${cards}
            </div>
          </section>
        `;
      })
      .filter(Boolean)
      .join('');

    const tabsMarkup = VIEW_TABS.map(tab => `
      <button
        type="button"
        data-tab="${tab.id}"
        class="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 transition hover:border-aifa-blue hover:text-aifa-blue"
      >
        ${tab.label}
      </button>
    `).join('');

    const scenarioButtons = SCENARIOS.map(scenario => `
      <button
        type="button"
        data-scenario="${scenario.id}"
        class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-aifa-blue hover:text-aifa-blue"
      >
        ${scenario.label}
      </button>
    `).join('');

    container.innerHTML = `
      <div class="space-y-8">
        <header class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 class="text-2xl font-bold text-slate-900">Panel de indicadores para directivos</h1>
          <p class="mt-1 text-sm text-slate-500">Selecciona un indicador disponible para explorar su desempeño histórico, comparar contra las metas y evaluar tendencias proyectadas.</p>
        </header>

        <div class="grid gap-6 xl:grid-cols-[420px,1fr]">
          <div class="space-y-6" data-indicator-sections>
            ${sectionsMarkup || `
              <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500">
                No se encontraron indicadores asignados a las opciones del panel.
              </div>
            `}
          </div>

          <div class="space-y-6">
            <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-[220px] flex-1">
                  <p class="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
                  <h2 class="mt-1 text-xl font-semibold text-slate-800" data-indicator-name>Seleccione un indicador asignado</h2>
                  <p class="mt-2 max-w-2xl text-sm text-slate-500 hidden" data-indicator-description></p>
                </div>
                <div class="flex flex-col items-end gap-3">
                  <div class="rounded-2xl bg-aifa-blue/10 px-4 py-2 text-right">
                    <p class="text-xs uppercase tracking-widest text-aifa-blue">Unidad</p>
                    <p class="text-sm font-semibold text-aifa-blue" data-indicator-unit>—</p>
                  </div>
                  <div class="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-500">
                    <span class="hidden sm:inline">Tipo de gráfica</span>
                    <div class="flex items-center gap-1">
                      <button type="button" data-chart-type="line" class="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:text-aifa-blue">Líneas</button>
                      <button type="button" data-chart-type="bar" class="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:text-aifa-blue">Barras</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-6 grid gap-4 md:grid-cols-2">
                <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p class="text-xs uppercase tracking-widest text-slate-400">Valor actual</p>
                  <p class="mt-2 text-2xl font-semibold text-slate-800" data-indicator-value>—</p>
                  <p class="text-xs text-slate-500" data-indicator-value-date></p>
                </div>
                <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p class="text-xs uppercase tracking-widest text-slate-400">Meta vigente</p>
                  <p class="mt-2 text-2xl font-semibold text-slate-800" data-indicator-target>—</p>
                  <p class="text-xs text-slate-500" data-indicator-target-scenario></p>
                </div>
              </div>

              <div class="mt-6 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="flex flex-wrap items-center gap-2" role="tablist">
                    ${tabsMarkup}
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <div class="hidden items-center gap-2" data-scenario-controls>
                      <span class="text-xs uppercase tracking-widest text-slate-400">Escenario</span>
                      <div class="flex items-center gap-1">
                        ${scenarioButtons}
                      </div>
                    </div>
                    <div class="hidden rounded-full px-3 py-1 text-xs font-semibold" data-compliance-badge></div>
                  </div>
                </div>
                <div class="rounded-2xl border border-slate-100 bg-white p-4" data-chart-container>
                  <div class="flex h-72 items-center justify-center text-sm text-slate-500">
                    Seleccione un indicador con información disponible.
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Historial reciente</h3>
              <div class="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                  <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th class="px-4 py-2 text-left">Periodo</th>
                      <th class="px-4 py-2 text-right">Valor</th>
                      <th class="px-4 py-2 text-right">Escenario</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100" data-history-body>
                    <tr>
                      <td colspan="3" class="px-4 py-6 text-center text-slate-400">Seleccione un indicador asignado.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    resetDetailView();
    hydrateOptionReferences(sections);
    bindInteractions();

    let firstAssigned = null;
    sections.forEach(section => {
      section.categories.forEach(category => {
        const match = category.options.find(option => option.indicator);
        if (!firstAssigned && match) {
          firstAssigned = { option: match, cardId: category.id };
        }
      });
    });

    if (firstAssigned) {
      ensureCardOpen(firstAssigned.cardId);
      selectIndicator(firstAssigned.option.id, firstAssigned.option.indicator);
    }
  } catch (error) {
    console.error(error);
    renderError(container, 'No fue posible cargar el panel de indicadores.');
    showToast('Error al cargar la información del panel', { type: 'error' });
  }
}
