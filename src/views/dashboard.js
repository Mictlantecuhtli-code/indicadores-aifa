import { getAreas } from '../services/supabaseClient.js';
import { renderError, renderLoading } from '../ui/feedback.js';

const OPTION_BLUEPRINTS = [
  {
    id: 'monthly-yoy',
    type: 'monthly',
    scenario: null,
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'quarterly-yoy',
    type: 'quarterly',
    scenario: null,
    buildLabel: entity =>
      `Cantidad de ${entity} real trimestral del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'annual-yoy',
    type: 'annual',
    scenario: null,
    buildLabel: entity =>
      `Cantidad de ${entity} real anual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'scenario-low',
    type: 'scenario',
    scenario: 'BAJO',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Bajo`
  },
  {
    id: 'scenario-mid',
    type: 'scenario',
    scenario: 'MEDIO',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Mediano`
  },
  {
    id: 'scenario-high',
    type: 'scenario',
    scenario: 'ALTO',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Alto`
  }
];

const OPTION_ICON_CLASSES = {
  monthly: 'fa-solid fa-chart-line',
  quarterly: 'fa-solid fa-chart-column',
  annual: 'fa-solid fa-calendar-days',
  scenario: 'fa-solid fa-bullseye'
};

const GROUP_DEFINITIONS = {
  operations: {
    id: 'operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    dataKey: 'operations',
    iconClass: 'fa-solid fa-plane-up'
  },
  passengers: {
    id: 'passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    dataKey: 'passengers',
    iconClass: 'fa-solid fa-users-between-lines'
  },
  'cargo-operations': {
    id: 'cargo-operations',
    title: 'Carga Operaciones',
    entity: 'Carga Operaciones',
    dataKey: 'cargo-operations',
    iconClass: 'fa-solid fa-boxes-stacked'
  },
  'cargo-weight': {
    id: 'cargo-weight',
    title: 'Carga Toneladas',
    entity: 'Carga Toneladas',
    dataKey: 'cargo-weight',
    iconClass: 'fa-solid fa-weight-hanging'
  },
  'fbo-operations': {
    id: 'fbo-operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    dataKey: 'fbo-operations',
    iconClass: 'fa-solid fa-plane'
  },
  'fbo-passengers': {
    id: 'fbo-passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    dataKey: 'fbo-passengers',
    iconClass: 'fa-solid fa-user-group'
  }
};

const ACCORDION_SECTIONS = [
  {
    id: 'operativos',
    type: 'indicators',
    title: 'Indicadores Operativos',
    iconClass: 'fa-solid fa-gauge-high',
    groupIds: ['operations', 'passengers', 'cargo-operations', 'cargo-weight']
  },
  {
    id: 'fbo',
    type: 'indicators',
    title: 'Indicadores FBO (Aviación General)',
    iconClass: 'fa-solid fa-plane-circle-check',
    groupIds: ['fbo-operations', 'fbo-passengers']
  },
  {
    id: 'direcciones',
    type: 'directions',
    title: 'Direcciones',
    iconClass: 'fa-solid fa-sitemap'
  }
];

const DEFAULT_ACCORDION_ID = 'operativos';

const CURRENT_YEAR = 2024;

const MONTHS = [
  { index: 0, label: 'Enero', short: 'Ene' },
  { index: 1, label: 'Febrero', short: 'Feb' },
  { index: 2, label: 'Marzo', short: 'Mar' },
  { index: 3, label: 'Abril', short: 'Abr' },
  { index: 4, label: 'Mayo', short: 'May' },
  { index: 5, label: 'Junio', short: 'Jun' },
  { index: 6, label: 'Julio', short: 'Jul' },
  { index: 7, label: 'Agosto', short: 'Ago' },
  { index: 8, label: 'Septiembre', short: 'Sep' },
  { index: 9, label: 'Octubre', short: 'Oct' },
  { index: 10, label: 'Noviembre', short: 'Nov' },
  { index: 11, label: 'Diciembre', short: 'Dic' }
];

const QUARTER_LABELS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Trimestre 4'];

const SCENARIO_LABELS = {
  BAJO: 'Escenario Bajo',
  MEDIO: 'Escenario Mediano',
  ALTO: 'Escenario Alto'
};

function createSeries({
  unit,
  monthlyCurrent,
  monthlyPrevious,
  scenarioLow,
  scenarioMid,
  scenarioHigh,
  annualHistory = [],
  currentYear = CURRENT_YEAR
}) {
  const currentTotal = monthlyCurrent.reduce((acc, value) => acc + value, 0);
  const history = [...annualHistory, { year: currentYear, value: currentTotal }];
  return {
    unit,
    monthlyCurrent,
    monthlyPrevious,
    scenarioLow,
    scenarioMid,
    scenarioHigh,
    annualHistory: history
  };
}

const INDICATOR_SERIES = {
  operations: createSeries({
    unit: 'Operaciones',
    monthlyCurrent: [1180, 1245, 1320, 1385, 1430, 1495, 1540, 1585, 1510, 1455, 1385, 1320],
    monthlyPrevious: [1055, 1120, 1195, 1230, 1285, 1330, 1375, 1405, 1340, 1285, 1210, 1155],
    scenarioLow: [1100, 1160, 1225, 1280, 1335, 1385, 1425, 1460, 1405, 1350, 1290, 1235],
    scenarioMid: [1140, 1205, 1275, 1335, 1390, 1445, 1490, 1530, 1475, 1415, 1350, 1290],
    scenarioHigh: [1185, 1255, 1330, 1395, 1455, 1510, 1560, 1605, 1540, 1480, 1415, 1355],
    annualHistory: [
      { year: 2021, value: 13780 },
      { year: 2022, value: 14690 },
      { year: 2023, value: 15440 }
    ]
  }),
  passengers: createSeries({
    unit: 'Pasajeros',
    monthlyCurrent: [48250, 49580, 51240, 52860, 54120, 55640, 56890, 57950, 56420, 54980, 53310, 51740],
    monthlyPrevious: [43820, 45100, 46740, 48030, 49450, 50860, 51920, 52880, 51400, 50060, 48410, 46890],
    scenarioLow: [46000, 47300, 48900, 50350, 51700, 53150, 54200, 55100, 53600, 52250, 50600, 49050],
    scenarioMid: [47200, 48550, 50180, 51620, 52980, 54520, 55680, 56650, 55180, 53800, 52120, 50550],
    scenarioHigh: [48600, 50020, 51740, 53290, 54760, 56340, 57590, 58680, 57120, 55740, 54050, 52480],
    annualHistory: [
      { year: 2021, value: 452000 },
      { year: 2022, value: 470500 },
      { year: 2023, value: 489800 }
    ]
  }),
  'cargo-operations': createSeries({
    unit: 'Operaciones',
    monthlyCurrent: [240, 255, 268, 275, 282, 295, 305, 312, 298, 286, 274, 265],
    monthlyPrevious: [210, 222, 234, 240, 248, 258, 266, 272, 260, 248, 236, 228],
    scenarioLow: [220, 232, 244, 252, 260, 270, 278, 284, 272, 260, 248, 238],
    scenarioMid: [230, 244, 256, 264, 272, 282, 290, 296, 284, 272, 260, 250],
    scenarioHigh: [240, 254, 268, 276, 284, 296, 304, 310, 298, 286, 274, 264],
    annualHistory: [
      { year: 2021, value: 2400 },
      { year: 2022, value: 2565 },
      { year: 2023, value: 2720 }
    ]
  }),
  'cargo-weight': createSeries({
    unit: 'Toneladas',
    monthlyCurrent: [525, 548, 572, 590, 612, 635, 654, 670, 648, 628, 604, 586],
    monthlyPrevious: [480, 502, 524, 540, 562, 584, 600, 616, 592, 570, 546, 528],
    scenarioLow: [500, 522, 546, 564, 586, 608, 624, 640, 616, 596, 572, 554],
    scenarioMid: [515, 538, 562, 580, 602, 626, 642, 658, 634, 612, 588, 570],
    scenarioHigh: [530, 554, 578, 596, 620, 644, 662, 680, 656, 634, 610, 592],
    annualHistory: [
      { year: 2021, value: 6600 },
      { year: 2022, value: 6900 },
      { year: 2023, value: 7200 }
    ]
  }),
  'fbo-operations': createSeries({
    unit: 'Operaciones',
    monthlyCurrent: [215, 228, 238, 246, 254, 262, 270, 276, 268, 258, 246, 238],
    monthlyPrevious: [198, 207, 216, 222, 230, 236, 242, 246, 238, 230, 220, 214],
    scenarioLow: [204, 214, 224, 232, 240, 248, 256, 262, 254, 244, 234, 226],
    scenarioMid: [210, 220, 230, 238, 246, 254, 262, 268, 260, 250, 240, 232],
    scenarioHigh: [218, 228, 238, 246, 254, 262, 270, 276, 268, 258, 248, 240],
    annualHistory: [
      { year: 2021, value: 2650 },
      { year: 2022, value: 2785 },
      { year: 2023, value: 2895 }
    ]
  }),
  'fbo-passengers': createSeries({
    unit: 'Pasajeros',
    monthlyCurrent: [980, 1025, 1070, 1105, 1140, 1180, 1215, 1240, 1205, 1165, 1120, 1085],
    monthlyPrevious: [910, 950, 990, 1020, 1055, 1085, 1120, 1145, 1110, 1070, 1025, 990],
    scenarioLow: [940, 980, 1020, 1050, 1085, 1120, 1150, 1180, 1140, 1100, 1060, 1020],
    scenarioMid: [960, 1005, 1045, 1080, 1115, 1150, 1185, 1210, 1175, 1135, 1090, 1050],
    scenarioHigh: [985, 1030, 1075, 1110, 1145, 1185, 1220, 1245, 1210, 1170, 1125, 1085],
    annualHistory: [
      { year: 2021, value: 10200 },
      { year: 2022, value: 10850 },
      { year: 2023, value: 11520 }
    ]
  })
};

let activeModalChart = null;
let modalContainer = null;

function sum(values = []) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(value));
}

function formatDecimal(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function formatPercentage(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function formatSignedNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const absolute = Math.abs(Number(value));
  const formatted = formatNumber(absolute);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function computeMonthlyComparison(series) {
  return MONTHS.map((month, index) => {
    const current = series.monthlyCurrent[index] ?? null;
    const comparison = series.monthlyPrevious[index] ?? null;
    const diff = current != null && comparison != null ? current - comparison : null;
    const pct = diff != null && comparison ? diff / comparison : null;
    return { label: month.label, short: month.short, current, comparison, diff, pct };
  });
}

function computeQuarterlyComparison(series) {
  return QUARTER_LABELS.map((label, quarterIndex) => {
    const start = quarterIndex * 3;
    const current = sum(series.monthlyCurrent.slice(start, start + 3));
    const comparison = sum(series.monthlyPrevious.slice(start, start + 3));
    const diff = current - comparison;
    const pct = comparison ? diff / comparison : null;
    return { label, current, comparison, diff, pct };
  });
}

function computeScenarioComparison(series, scenario) {
  const key = scenario === 'BAJO' ? 'scenarioLow' : scenario === 'ALTO' ? 'scenarioHigh' : 'scenarioMid';
  const reference = series[key] ?? [];
  return MONTHS.map((month, index) => {
    const current = series.monthlyCurrent[index] ?? null;
    const comparison = reference[index] ?? null;
    const diff = current != null && comparison != null ? current - comparison : null;
    const pct = diff != null && comparison ? diff / comparison : null;
    return { label: month.label, short: month.short, current, comparison, diff, pct };
  });
}

function computeAnnualComparison(series) {
  const current = sum(series.monthlyCurrent);
  const comparison = sum(series.monthlyPrevious);
  const diff = current - comparison;
  const pct = comparison ? diff / comparison : null;
  return [{ label: `${CURRENT_YEAR}`, current, comparison, diff, pct }];
}

function getScenarioSeries(series, scenario) {
  if (scenario === 'BAJO') return series.scenarioLow;
  if (scenario === 'ALTO') return series.scenarioHigh;
  return series.scenarioMid;
}

function destroyActiveModalChart() {
  if (activeModalChart) {
    activeModalChart.destroy();
    activeModalChart = null;
  }
}

function renderModalChart(canvas, config) {
  if (!canvas) return;
  const Chart = typeof window !== 'undefined' ? window.Chart : null;
  if (!Chart) {
    const fallback = document.createElement('div');
    fallback.className =
      'flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500';
    fallback.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i>No se pudo cargar la biblioteca de gráficas.';
    canvas.replaceWith(fallback);
    return;
  }
  destroyActiveModalChart();
  activeModalChart = new Chart(canvas, config);
}

function buildMonthlyChartConfig(series) {
  return {
    type: 'line',
    data: {
      labels: MONTHS.map(month => month.short),
      datasets: [
        {
          label: `${CURRENT_YEAR}`,
          data: series.monthlyCurrent,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 3
        },
        {
          label: `${CURRENT_YEAR - 1}`,
          data: series.monthlyPrevious,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatNumber(value)
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
}

function buildQuarterlyChartConfig(series) {
  const quarterlyCurrent = computeQuarterlyComparison(series).map(item => item.current);
  const quarterlyPrevious = computeQuarterlyComparison(series).map(item => item.comparison);
  return {
    type: 'bar',
    data: {
      labels: QUARTER_LABELS,
      datasets: [
        {
          label: `${CURRENT_YEAR}`,
          data: quarterlyCurrent,
          backgroundColor: 'rgba(37, 99, 235, 0.65)'
        },
        {
          label: `${CURRENT_YEAR - 1}`,
          data: quarterlyPrevious,
          backgroundColor: 'rgba(16, 185, 129, 0.45)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatNumber(value)
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
}

function buildScenarioChartConfig(series, scenario) {
  const scenarioSeries = getScenarioSeries(series, scenario);
  const label = SCENARIO_LABELS[scenario] ?? 'Meta';
  return {
    type: 'line',
    data: {
      labels: MONTHS.map(month => month.short),
      datasets: [
        {
          label: 'Real',
          data: series.monthlyCurrent,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 3
        },
        {
          label,
          data: scenarioSeries,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.15)',
          borderDash: [6, 4],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatNumber(value)
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
}

function buildAnnualChartConfig(series) {
  const labels = series.annualHistory.map(item => String(item.year));
  const values = series.annualHistory.map(item => item.value);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total anual',
          data: values,
          backgroundColor: 'rgba(37, 99, 235, 0.7)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatNumber(value)
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  };
}

function buildChartConfig(series, type, scenario) {
  if (type === 'monthly') return buildMonthlyChartConfig(series);
  if (type === 'quarterly') return buildQuarterlyChartConfig(series);
  if (type === 'annual') return buildAnnualChartConfig(series);
  return buildScenarioChartConfig(series, scenario);
}

function findLatestIndex(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] != null && !Number.isNaN(Number(values[index]))) {
      return index;
    }
  }
  return values.length - 1;
}

function buildSummary(series, type, scenario) {
  if (type === 'monthly') {
    const latestIndex = findLatestIndex(series.monthlyCurrent);
    const month = MONTHS[latestIndex] ?? MONTHS[MONTHS.length - 1];
    const current = series.monthlyCurrent[latestIndex] ?? null;
    const comparison = series.monthlyPrevious[latestIndex] ?? null;
    const diff = current != null && comparison != null ? current - comparison : null;
    const pct = diff != null && comparison ? diff / comparison : null;
    return {
      title: `Comparativo mensual (${month.label})`,
      currentLabel: 'Real',
      comparisonLabel: `${CURRENT_YEAR - 1}`,
      currentValue: current,
      comparisonValue: comparison,
      diff,
      pct
    };
  }

  if (type === 'quarterly') {
    const quarterly = computeQuarterlyComparison(series);
    const latest = quarterly[quarterly.length - 1];
    return {
      title: 'Comparativo trimestral',
      currentLabel: `${CURRENT_YEAR}`,
      comparisonLabel: `${CURRENT_YEAR - 1}`,
      currentValue: latest?.current ?? null,
      comparisonValue: latest?.comparison ?? null,
      diff: latest?.diff ?? null,
      pct: latest?.pct ?? null
    };
  }

  if (type === 'annual') {
    const rows = computeAnnualComparison(series);
    const latest = rows[0];
    return {
      title: 'Acumulado anual',
      currentLabel: `${CURRENT_YEAR}`,
      comparisonLabel: `${CURRENT_YEAR - 1}`,
      currentValue: latest?.current ?? null,
      comparisonValue: latest?.comparison ?? null,
      diff: latest?.diff ?? null,
      pct: latest?.pct ?? null
    };
  }

  const latestIndex = findLatestIndex(series.monthlyCurrent);
  const month = MONTHS[latestIndex] ?? MONTHS[MONTHS.length - 1];
  const referenceSeries = getScenarioSeries(series, scenario);
  const current = series.monthlyCurrent[latestIndex] ?? null;
  const comparison = referenceSeries[latestIndex] ?? null;
  const diff = current != null && comparison != null ? current - comparison : null;
  const pct = diff != null && comparison ? diff / comparison : null;
  return {
    title: `${SCENARIO_LABELS[scenario] ?? 'Meta'} (${month.label})`,
    currentLabel: 'Real',
    comparisonLabel: 'Meta',
    currentValue: current,
    comparisonValue: comparison,
    diff,
    pct
  };
}

function buildTableRows(series, type, scenario) {
  let rows = [];
  if (type === 'monthly') {
    rows = computeMonthlyComparison(series);
  } else if (type === 'quarterly') {
    rows = computeQuarterlyComparison(series);
  } else if (type === 'annual') {
    rows = computeAnnualComparison(series);
  } else {
    rows = computeScenarioComparison(series, scenario);
  }

  return rows
    .map(row => `
      <tr class="border-b border-slate-100">
        <td class="px-4 py-2 text-left text-sm text-slate-600">${escapeHtml(row.label)}</td>
        <td class="px-4 py-2 text-right text-sm font-semibold text-slate-800">${formatNumber(row.current)}</td>
        <td class="px-4 py-2 text-right text-sm text-slate-600">${formatNumber(row.comparison)}</td>
        <td class="px-4 py-2 text-right text-sm font-semibold ${
          row.diff > 0
            ? 'text-emerald-600'
            : row.diff < 0
            ? 'text-rose-600'
            : 'text-slate-500'
        }">${formatSignedNumber(row.diff)}</td>
        <td class="px-4 py-2 text-right text-sm text-slate-600">${formatPercentage(row.pct)}</td>
      </tr>
    `)
    .join('');
}

function getTrendColorClasses(value) {
  if (value > 0) {
    return {
      text: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-600'
    };
  }
  if (value < 0) {
    return {
      text: 'text-rose-600',
      badge: 'bg-rose-50 text-rose-600'
    };
  }
  return {
    text: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-600'
  };
}

function ensureModalContainer() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.setAttribute('data-modal-root', '');
    document.body.appendChild(modalContainer);
  }
  return modalContainer;
}

function closeIndicatorModal() {
  destroyActiveModalChart();
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
  document.body.classList.remove('overflow-hidden');
}

function buildModalMarkup({ label, series, type, scenario }) {
  const summary = buildSummary(series, type, scenario);
  const rowsMarkup = buildTableRows(series, type, scenario);
  const trendClasses = getTrendColorClasses(summary.diff ?? 0);
  const scenarioLabel = type === 'scenario' ? SCENARIO_LABELS[scenario] ?? 'Meta' : `${CURRENT_YEAR - 1}`;

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
      <div class="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          aria-label="Cerrar"
          data-modal-close
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="space-y-6 p-6">
          <header class="space-y-2">
            <p class="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
            <h2 class="text-2xl font-semibold text-slate-900">${escapeHtml(label)}</h2>
            <p class="text-sm text-slate-500">Unidad de medida: ${escapeHtml(series.unit ?? '—')}</p>
          </header>

          <section class="space-y-4">
            <header class="flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">${escapeHtml(
                summary.title
              )}</h3>
              <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">${
                type === 'scenario' ? 'Seguimiento vs meta' : 'Comparativo año contra año'
              }</span>
            </header>

            <div class="grid gap-4 sm:grid-cols-3">
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${escapeHtml(summary.currentLabel)}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatNumber(summary.currentValue)}</p>
              </article>
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">${escapeHtml(scenarioLabel)}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${formatNumber(summary.comparisonValue)}</p>
              </article>
              <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-widest text-slate-400">Variación</p>
                <p class="mt-2 text-2xl font-semibold ${trendClasses.text}">${formatSignedNumber(summary.diff)}</p>
                <p class="text-xs text-slate-500">${formatPercentage(summary.pct)}</p>
              </article>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Visualización</h3>
              <span class="rounded-full px-3 py-1 text-xs font-semibold ${trendClasses.badge}">${
                type === 'scenario' ? SCENARIO_LABELS[scenario] ?? 'Meta' : `${CURRENT_YEAR} vs ${CURRENT_YEAR - 1}`
              }</span>
            </div>
            <div class="h-72">
              <canvas data-modal-chart aria-label="Gráfica del indicador"></canvas>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Detalle del periodo</h3>
            </div>
            <div class="max-h-72 overflow-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th class="px-4 py-2 text-left">Periodo</th>
                    <th class="px-4 py-2 text-right">Real</th>
                    <th class="px-4 py-2 text-right">Comparativo</th>
                    <th class="px-4 py-2 text-right">Variación</th>
                    <th class="px-4 py-2 text-right">% Variación</th>
                  </tr>
                </thead>
                <tbody>${rowsMarkup}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function openIndicatorModal({ label, series, type, scenario }) {
  if (!series) return;
  const root = ensureModalContainer();
  root.innerHTML = buildModalMarkup({ label, series, type, scenario });
  document.body.classList.add('overflow-hidden');

  const overlay = root.querySelector('[data-modal-overlay]');
  const closeButton = root.querySelector('[data-modal-close]');
  const canvas = root.querySelector('[data-modal-chart]');

  const handleClose = () => {
    overlay?.removeEventListener('click', overlayListener);
    closeButton?.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', escListener);
    closeIndicatorModal();
  };

  const overlayListener = event => {
    if (event.target === overlay) {
      handleClose();
    }
  };

  const escListener = event => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  overlay?.addEventListener('click', overlayListener);
  closeButton?.addEventListener('click', handleClose);
  document.addEventListener('keydown', escListener);

  const chartConfig = buildChartConfig(series, type, scenario);
  renderModalChart(canvas, chartConfig);
}

function escapeHtml(value) {
  if (value == null) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHex(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(prefixed)) {
    if (prefixed.length === 4) {
      return `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`;
    }
    return prefixed;
  }
  return null;
}

function getBadgeStyles(color) {
  const normalized = normalizeHex(color) ?? '#1e293b';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.65 ? '#0f172a' : '#ffffff';
  return `background-color: ${normalized}; color: ${textColor};`;
}

function buildOptionMarkup(option) {
  const iconClass = OPTION_ICON_CLASSES[option.type] ?? 'fa-solid fa-circle-dot';
  return `
    <li>
      <button
        type="button"
        class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-option-button
        data-option-id="${option.id}"
        data-option-type="${option.type}"
        data-option-scenario="${option.scenario ?? ''}"
        data-option-label="${escapeHtml(option.label)}"
        data-option-datakey="${option.dataKey ?? ''}"
      >
        <span class="mt-0.5 text-slate-500">
          <i class="${iconClass} h-4 w-4"></i>
        </span>
        <span>${escapeHtml(option.label)}</span>
      </button>
    </li>
  `;
}

function buildGroupMarkup(groupId, rootId) {
  const definition = GROUP_DEFINITIONS[groupId];
  if (!definition) return '';

  const options = OPTION_BLUEPRINTS.map(blueprint => ({
    id: `${definition.id}-${blueprint.id}`,
    label: blueprint.buildLabel(definition.entity),
    type: blueprint.type,
    scenario: blueprint.scenario,
    dataKey: definition.dataKey
  }));

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
        data-group-button
        data-group-root="${rootId}"
        data-group-id="${definition.id}"
        aria-expanded="false"
      >
        <span class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <i class="${definition.iconClass} h-5 w-5"></i>
          </span>
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(definition.title)}</span>
        </span>
        <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-group-chevron></i>
      </button>
      <div class="border-t border-slate-100 bg-slate-50/60 px-5 py-4" data-group-panel="${definition.id}" hidden>
        <ul class="space-y-2">
          ${options.map(buildOptionMarkup).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildIndicatorSectionContent(section) {
  return `
    <div class="space-y-3">
      ${section.groupIds.map(groupId => buildGroupMarkup(groupId, section.id)).join('')}
    </div>
  `;
}

function buildDirectionChildrenList(children) {
  if (!children?.length) return '';
  return `
    <ul class="space-y-2">
      ${children
        .map(child => `
          <li class="space-y-2">
            <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <span>${escapeHtml(child.nombre ?? '—')}</span>
              <span
                class="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
                style="${getBadgeStyles(child.color_hex)}"
              >
                ${escapeHtml(child.clave ?? '—')}
              </span>
            </div>
            ${child.children?.length
              ? `<div class="ml-4 border-l border-slate-200 pl-4">${buildDirectionChildrenList(child.children)}</div>`
              : ''}
          </li>
        `)
        .join('')}
    </ul>
  `;
}

function buildDirectionItem(area) {
  const hasChildren = Array.isArray(area.children) && area.children.length > 0;
  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2 ${
          hasChildren ? 'hover:bg-slate-50' : 'cursor-default'
        }"
        data-direction-button
        data-direction-id="${area.id}"
        ${hasChildren ? 'aria-expanded="false"' : 'aria-disabled="true"'}
      >
        <span class="flex items-center gap-3">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(area.nombre ?? '—')}</span>
          <span
            class="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold"
            style="${getBadgeStyles(area.color_hex)}"
          >
            ${escapeHtml(area.clave ?? '—')}
          </span>
        </span>
        ${
          hasChildren
            ? '<i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-direction-chevron></i>'
            : ''
        }
      </button>
      ${
        hasChildren
          ? `<div class="border-t border-slate-100 bg-slate-50/60 px-5 py-4" data-direction-panel="${area.id}" hidden>${buildDirectionChildrenList(
              area.children
            )}</div>`
          : ''
      }
    </div>
  `;
}

function buildDirectionsMarkup(tree) {
  if (!tree?.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No hay direcciones registradas.
      </div>
    `;
  }

  return `
    <div class="space-y-3">
      ${tree.map(buildDirectionItem).join('')}
    </div>
  `;
}

function buildSectionsMarkup() {
  return ACCORDION_SECTIONS.map(section => {
    const isInitiallyOpen = section.id === DEFAULT_ACCORDION_ID;
    const content =
      section.type === 'indicators'
        ? buildIndicatorSectionContent(section)
        : '<div data-directions-container class="min-h-[4rem]"></div>';

    return `
      <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-accordion-section="${
        section.id
      }">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aifa-light focus-visible:ring-offset-2"
          data-accordion-button
          data-accordion-id="${section.id}"
          aria-expanded="${isInitiallyOpen ? 'true' : 'false'}"
        >
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <i class="${section.iconClass} h-6 w-6"></i>
            </span>
            <div>
              <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(section.title)}</h2>
            </div>
          </div>
          <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform ${
            isInitiallyOpen ? 'rotate-180' : ''
          }" data-accordion-chevron></i>
        </button>
        <div class="border-t border-slate-100 bg-slate-50/60 px-6 py-5" data-accordion-panel="${section.id}" ${
          isInitiallyOpen ? '' : 'hidden'
        }>
          ${content}
        </div>
      </section>
    `;
  }).join('');
}

function buildDashboardMarkup() {
  return `
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900">Panel directivos</h1>
        <p class="text-sm text-slate-500">
          Seleccione una categoría para explorar las opciones de indicadores y direcciones disponibles.
        </p>
      </header>
      <div class="space-y-5" data-accordion-root data-accordion-default="${DEFAULT_ACCORDION_ID}">
        ${buildSectionsMarkup()}
      </div>
    </div>
  `;
}

function initAccordionControls(container) {
  const root = container.querySelector('[data-accordion-root]');
  if (!root) return;

  const buttons = Array.from(root.querySelectorAll('[data-accordion-button]'));
  if (!buttons.length) return;

  const defaultId = root.dataset.accordionDefault ?? null;
  const hasDefault = buttons.some(button => button.dataset.accordionId === defaultId);
  let openId = hasDefault ? defaultId : buttons[0]?.dataset.accordionId ?? null;

  const applyState = () => {
    buttons.forEach(button => {
      const id = button.dataset.accordionId;
      const panel = root.querySelector(`[data-accordion-panel="${id}"]`);
      const chevron = button.querySelector('[data-accordion-chevron]');
      const isOpen = openId === id;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (panel) {
        if (isOpen) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
      }
    });
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.accordionId;
      openId = openId === id ? null : id;
      applyState();
    });
  });
}

  applyState();
}

function initGroupControls(container) {
  const groups = new Map();

  container.querySelectorAll('[data-group-button]').forEach(button => {
    const rootId = button.dataset.groupRoot;
    const groupId = button.dataset.groupId;
    if (!rootId || !groupId) return;
    if (!groups.has(rootId)) {
      groups.set(rootId, { openId: null, items: [] });
    }
    groups.get(rootId).items.push({ button, groupId });
  });

  const updateGroup = entry => {
    entry.items.forEach(({ button, groupId }) => {
      const panel = container.querySelector(`[data-group-panel="${groupId}"]`);
      const chevron = button.querySelector('[data-group-chevron]');
      const isOpen = entry.openId === groupId;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (panel) {
        if (isOpen) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
      }
    });
  };

  groups.forEach(entry => updateGroup(entry));

  groups.forEach(entry => {
    entry.items.forEach(({ button, groupId }) => {
      button.addEventListener('click', () => {
        entry.openId = entry.openId === groupId ? null : groupId;
        updateGroup(entry);
      });
    });
  });
}

function initDirectionControls(container) {
  container.querySelectorAll('[data-direction-button]').forEach(button => {
    const directionId = button.dataset.directionId;
    if (!directionId) return;
    const panel = container.querySelector(`[data-direction-panel="${directionId}"]`);
    if (!panel) return;
    let isOpen = false;
    button.addEventListener('click', () => {
      isOpen = !isOpen;
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
      const chevron = button.querySelector('[data-direction-chevron]');
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
      }
    });
  });
}

function initOptionModals(container) {
  container.querySelectorAll('[data-option-button]').forEach(button => {
    button.addEventListener('click', () => {
      const dataKey = button.dataset.optionDatakey;
      const type = button.dataset.optionType;
      const scenario = button.dataset.optionScenario || null;
      const label = button.dataset.optionLabel || button.textContent.trim();

      if (!dataKey || !type) {
        console.warn('Opción sin datos configurados', button);
        return;
      }

      const series = INDICATOR_SERIES[dataKey];
      if (!series) {
        console.warn('No hay serie configurada para', dataKey);
        return;
      }

      openIndicatorModal({ label, series, type, scenario });
    });
  });
}

function buildAreaTree(areas) {
  if (!Array.isArray(areas)) return [];

  const nodes = new Map();
  areas.forEach(area => {
    if (!area) return;
    nodes.set(area.id, { ...area, children: [] });
  });

  const roots = [];
  nodes.forEach(node => {
    if (node.parent_area_id && nodes.has(node.parent_area_id)) {
      nodes.get(node.parent_area_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = list => {
    list.sort((a, b) => {
      const nameA = a?.nombre ?? '';
      const nameB = b?.nombre ?? '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
    list.forEach(child => {
      if (Array.isArray(child.children) && child.children.length) {
        sortTree(child.children);
      }
    });
  };

  sortTree(roots);
  return roots;
}

async function renderDirections(container) {
  if (!container) return;
  renderLoading(container, 'Cargando direcciones...');

  try {
    const areas = await getAreas();
    const tree = buildAreaTree(areas ?? []);
    container.innerHTML = buildDirectionsMarkup(tree);
    initDirectionControls(container);
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}

export async function renderDashboard(container) {
  if (!container) return;

  container.innerHTML = buildDashboardMarkup();

  initAccordionControls(container);
  initGroupControls(container);
  initOptionModals(container);


  const directionsContainer = container.querySelector('[data-directions-container]');
  if (directionsContainer) {
    await renderDirections(directionsContainer);
  }
}
