import { getAreas, getIndicators, getIndicatorHistory, getIndicatorTargets } from '../services/supabaseClient.js';
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

const CURRENT_YEAR = new Date().getFullYear();

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

const INDICATOR_MAPPING = {
  'operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['comercial', 'aviacion comercial'],
    excludePatterns: ['carga', 'fbo', 'general', 'toneladas'],
    priority: 1
  },
  'passengers': {
    patterns: ['pasajeros', 'pasajero'],
    areaPatterns: ['comercial', 'aviacion comercial'],
    excludePatterns: ['carga', 'fbo', 'general'],
    priority: 1
  },
  'cargo-operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['carga', 'aviacion carga'],
    excludePatterns: ['pasajeros', 'fbo', 'general', 'toneladas'],
    priority: 2
  },
  'cargo-weight': {
    patterns: ['toneladas', 'tonelada', 'peso', 'kg'],
    areaPatterns: ['carga', 'aviacion carga'],
    excludePatterns: ['operaciones', 'pasajeros', 'fbo', 'general'],
    priority: 2
  },
  'fbo-operations': {
    patterns: ['operaciones', 'operacion'],
    areaPatterns: ['fbo', 'general', 'aviacion general', 'ejecutiva'],
    excludePatterns: ['carga', 'comercial', 'pasajeros', 'toneladas'],
    priority: 3
  },
  'fbo-passengers': {
    patterns: ['pasajeros', 'pasajero'],
    areaPatterns: ['fbo', 'general', 'aviacion general', 'ejecutiva'],
    excludePatterns: ['carga', 'comercial', 'operaciones'],
    priority: 3
  }
};

let activeModalChart = null;
let modalContainer = null;
// Funciones auxiliares para obtener y procesar datos reales

async function getIndicatorRealData(indicatorId) {
  if (!indicatorId) return null;
  
  try {
    const [history, targets, indicator] = await Promise.all([
      getIndicatorHistory(indicatorId, { limit: 120 }),
      getIndicatorTargets(indicatorId),
      getIndicators().then(indicators => indicators.find(i => i.id === indicatorId))
    ]);
    
    return {
      indicator,
      history: history || [],
      targets: targets || []
    };
  } catch (error) {
    console.error('Error obteniendo datos del indicador:', error);
    return null;
  }
}

function getLastLoadedMonth(history = []) {
  if (!history.length) return null;
  
  const sorted = [...history].sort((a, b) => {
    if (a.anio !== b.anio) return b.anio - a.anio;
    return b.mes - a.mes;
  });
  
  return sorted[0] ? { year: sorted[0].anio, month: sorted[0].mes } : null;
}

function filterCompleteQuarters(history = [], currentYear) {
  const lastLoaded = getLastLoadedMonth(history);
  if (!lastLoaded || lastLoaded.year !== currentYear) {
    return 4;
  }
  
  const lastMonth = lastLoaded.month;
  return Math.floor(lastMonth / 3);
}

function getDataByYear(history = [], year) {
  return history
    .filter(item => item.anio === year)
    .sort((a, b) => a.mes - b.mes);
}

function aggregateQuarterlyData(history = [], year, maxQuarter = 4) {
  const quarters = [];
  
  for (let q = 1; q <= maxQuarter; q++) {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    
    const quarterData = history.filter(
      item => item.anio === year && item.mes >= startMonth && item.mes <= endMonth
    );
    
    if (quarterData.length === 3) {
      const total = quarterData.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
      quarters.push({
        quarter: q,
        label: `Q${q}`,
        value: total,
        months: quarterData
      });
    }
  }
  
  return quarters;
}

function findIndicatorByDataKey(indicators, dataKey) {
  const config = INDICATOR_MAPPING[dataKey];
  if (!config) {
    console.warn(`No hay configuración de mapeo para: ${dataKey}`);
    return null;
  }
  
  const normalize = (text) => {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const scored = indicators.map(ind => {
    const normalizedName = normalize(ind.nombre);
    const normalizedDesc = normalize(ind.descripcion);
    const normalizedArea = normalize(ind.area_nombre);
    const searchText = `${normalizedName} ${normalizedDesc} ${normalizedArea}`;
    
    let score = 0;
    
    if (config.excludePatterns.some(pattern => searchText.includes(pattern))) {
      return { indicator: ind, score: -1000 };
    }
    
    config.patterns.forEach(pattern => {
      if (normalizedName.includes(pattern)) score += 100;
      if (normalizedDesc.includes(pattern)) score += 50;
    });
    
    config.areaPatterns.forEach(pattern => {
      if (normalizedArea.includes(pattern)) score += 80;
      if (searchText.includes(pattern)) score += 40;
    });
    
    const mainPattern = config.patterns[0];
    if (normalizedName.startsWith(mainPattern)) score += 50;
    
    return { indicator: ind, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  if (scored[0] && scored[0].score > 0) {
    if (window.DEBUG_INDICATORS) {
      console.log(`✅ Match encontrado para ${dataKey}:`, {
        indicador: scored[0].indicator.nombre,
        score: scored[0].score
      });
    }
    return scored[0].indicator;
  }
  
  if (window.DEBUG_INDICATORS) {
    console.warn(`❌ No se encontró match para ${dataKey}`);
  }
  
  return null;
}

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

function findLatestIndex(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] != null && !Number.isNaN(Number(values[index]))) {
      return index;
    }
  }
  return values.length - 1;
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
function buildSummary(realData, type, scenario) {
  if (!realData || !realData.history.length) {
    return {
      title: 'Sin datos disponibles',
      currentLabel: 'Actual',
      comparisonLabel: 'Anterior',
      currentValue: null,
      comparisonValue: null,
      diff: null,
      pct: null
    };
  }

  const { history } = realData;
  const currentYear = CURRENT_YEAR;
  const lastLoaded = getLastLoadedMonth(history);
  
  if (!lastLoaded) {
    return {
      title: 'Sin datos disponibles',
      currentLabel: 'Actual',
      comparisonLabel: 'Anterior',
      currentValue: null,
      comparisonValue: null,
      diff: null,
      pct: null
    };
  }

  if (type === 'monthly') {
    const latestMonth = lastLoaded.month;
    const latestYear = lastLoaded.year;
    const month = MONTHS[latestMonth - 1] || MONTHS[MONTHS.length - 1];
    
    const currentItem = history.find(
      item => item.anio === latestYear && item.mes === latestMonth
    );
    const comparisonItem = history.find(
      item => item.anio === latestYear - 1 && item.mes === latestMonth
    );
    
    const current = currentItem ? Number(currentItem.valor) : null;
    const comparison = comparisonItem ? Number(comparisonItem.valor) : null;
    const diff = current != null && comparison != null ? current - comparison : null;
    const pct = diff != null && comparison ? diff / comparison : null;
    
    return {
      title: `Comparativo mensual (${month.label} ${latestYear})`,
      currentLabel: `${latestYear}`,
      comparisonLabel: `${latestYear - 1}`,
      currentValue: current,
      comparisonValue: comparison,
      diff,
      pct
    };
  }

  if (type === 'quarterly') {
    const completeQuarters = filterCompleteQuarters(history, currentYear);
    
    if (completeQuarters === 0) {
      return {
        title: 'Sin trimestres completos',
        currentLabel: `${currentYear}`,
        comparisonLabel: `${currentYear - 1}`,
        currentValue: null,
        comparisonValue: null,
        diff: null,
        pct: null
      };
    }
    
    const currentQuarters = aggregateQuarterlyData(history, currentYear, completeQuarters);
    const previousQuarters = aggregateQuarterlyData(history, currentYear - 1, completeQuarters);
    
    const latest = currentQuarters[currentQuarters.length - 1];
    const previousLatest = previousQuarters[previousQuarters.length - 1];
    
    return {
      title: `Comparativo trimestral (Q${latest?.quarter || 1} ${currentYear})`,
      currentLabel: `${currentYear}`,
      comparisonLabel: `${currentYear - 1}`,
      currentValue: latest?.value || null,
      comparisonValue: previousLatest?.value || null,
      diff: latest && previousLatest ? latest.value - previousLatest.value : null,
      pct: latest && previousLatest && previousLatest.value ? 
        (latest.value - previousLatest.value) / previousLatest.value : null
    };
  }

  if (type === 'annual') {
    const currentData = getDataByYear(history, currentYear);
    const previousData = getDataByYear(history, currentYear - 1);
    
    const current = sum(currentData.map(item => item.valor));
    const comparison = sum(previousData.map(item => item.valor));
    const diff = current - comparison;
    const pct = comparison ? diff / comparison : null;
    
    return {
      title: `Acumulado anual (${currentYear})`,
      currentLabel: `${currentYear}`,
      comparisonLabel: `${currentYear - 1}`,
      currentValue: current,
      comparisonValue: comparison,
      diff,
      pct
    };
  }

  // Para escenarios
  const latestMonth = lastLoaded.month;
  const latestYear = lastLoaded.year;
  const month = MONTHS[latestMonth - 1];
  
  const currentItem = history.find(
    item => item.anio === latestYear && item.mes === latestMonth
  );
  
  const targetItem = realData.targets.find(
    item => item.anio === latestYear && 
           item.mes === latestMonth && 
           item.escenario === scenario
  );
  
  const current = currentItem ? Number(currentItem.valor) : null;
  const comparison = targetItem ? Number(targetItem.valor) : null;
  const diff = current != null && comparison != null ? current - comparison : null;
  const pct = diff != null && comparison ? diff / comparison : null;
  
  return {
    title: `${SCENARIO_LABELS[scenario] || 'Meta'} (${month?.label || ''} ${latestYear})`,
    currentLabel: 'Real',
    comparisonLabel: 'Meta',
    currentValue: current,
    comparisonValue: comparison,
    diff,
    pct
  };
}

function buildTableRows(realData, type, scenario) {
  if (!realData || !realData.history.length) {
    return '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td></tr>';
  }

  const { history } = realData;
  const currentYear = CURRENT_YEAR;
  const lastLoaded = getLastLoadedMonth(history);
  
  if (!lastLoaded) {
    return '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td></tr>';
  }

  let rows = [];

  if (type === 'monthly') {
    const currentData = getDataByYear(history, currentYear);
    const previousData = getDataByYear(history, currentYear - 1);
    
    const previousMap = new Map();
    previousData.forEach(item => {
      previousMap.set(item.mes, Number(item.valor) || 0);
    });
    
    rows = currentData.map(item => {
      const current = Number(item.valor) || 0;
      const comparison = previousMap.get(item.mes) || null;
      const diff = comparison !== null ? current - comparison : null;
      const pct = diff !== null && comparison ? diff / comparison : null;
      
      return {
        label: MONTHS[item.mes - 1]?.label || `Mes ${item.mes}`,
        current,
        comparison,
        diff,
        pct
      };
    });
  } 
  else if (type === 'quarterly') {
    const completeQuarters = filterCompleteQuarters(history, currentYear);
    
    if (completeQuarters === 0) {
      return '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No hay trimestres completos disponibles</td></tr>';
    }
    
    const currentQuarters = aggregateQuarterlyData(history, currentYear, completeQuarters);
    const previousQuarters = aggregateQuarterlyData(history, currentYear - 1, completeQuarters);
    
    const previousMap = new Map();
    previousQuarters.forEach(q => {
      previousMap.set(q.quarter, q.value);
    });
    
    rows = currentQuarters.map(q => {
      const current = q.value;
      const comparison = previousMap.get(q.quarter) || null;
      const diff = comparison !== null ? current - comparison : null;
      const pct = diff !== null && comparison ? diff / comparison : null;
      
      return {
        label: `Trimestre ${q.quarter}`,
        current,
        comparison,
        diff,
        pct
      };
    });
  } 
  else if (type === 'annual') {
    const years = Array.from(new Set(history.map(item => item.anio))).sort((a, b) => b - a).slice(0, 5);
    
    rows = years.map((year, index) => {
      const yearData = getDataByYear(history, year);
      const current = sum(yearData.map(item => item.valor));
      const previousYear = years[index + 1];
      const previousYearData = previousYear ? getDataByYear(history, previousYear) : [];
      const comparison = previousYearData.length ? sum(previousYearData.map(item => item.valor)) : null;
      const diff = comparison !== null ? current - comparison : null;
      const pct = diff !== null && comparison ? diff / comparison : null;
      
      return {
        label: `${year}`,
        current,
        comparison,
        diff,
        pct
      };
    });
  } 
  else {
    // Para escenarios
    const currentData = getDataByYear(history, currentYear);
    
    const targetMap = new Map();
    realData.targets
      .filter(item => item.anio === currentYear && item.escenario === scenario)
      .forEach(item => {
        targetMap.set(item.mes, Number(item.valor) || 0);
      });
    
    rows = currentData.map(item => {
      const current = Number(item.valor) || 0;
      const comparison = targetMap.get(item.mes) || null;
      const diff = comparison !== null ? current - comparison : null;
      const pct = diff !== null && comparison ? diff / comparison : null;
      
      return {
        label: MONTHS[item.mes - 1]?.label || `Mes ${item.mes}`,
        current,
        comparison,
        diff,
        pct
      };
    });
  }

  if (!rows.length) {
    return '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No hay datos disponibles para este periodo</td></tr>';
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

function buildMonthlyChartConfig(realData, chartType = 'line') {
  if (!realData || !realData.history.length) {
    return null;
  }

  const currentYear = CURRENT_YEAR;
  const currentData = getDataByYear(realData.history, currentYear);
  const previousData = getDataByYear(realData.history, currentYear - 1);

  const currentValues = Array(12).fill(null);
  const previousValues = Array(12).fill(null);

  currentData.forEach(item => {
    if (item.mes >= 1 && item.mes <= 12) {
      currentValues[item.mes - 1] = Number(item.valor) || null;
    }
  });

  previousData.forEach(item => {
    if (item.mes >= 1 && item.mes <= 12) {
      previousValues[item.mes - 1] = Number(item.valor) || null;
    }
  });

  const config = {
    type: chartType,
    data: {
      labels: MONTHS.map(month => month.short),
      datasets: [
        {
          label: `${currentYear}`,
          data: currentValues,
          borderColor: '#2563eb',
          backgroundColor: chartType === 'bar' ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
          borderWidth: 2,
          spanGaps: true
        },
        {
          label: `${currentYear - 1}`,
          data: previousValues,
          borderColor: '#10b981',
          backgroundColor: chartType === 'bar' ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2,
          spanGaps: true
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

  if (chartType === 'line') {
    config.data.datasets.forEach(dataset => {
      dataset.tension = 0.3;
      dataset.fill = true;
      dataset.pointRadius = 3;
    });
  }

  return config;
}

function buildQuarterlyChartConfig(realData) {
  if (!realData || !realData.history.length) {
    return null;
  }

  const currentYear = CURRENT_YEAR;
  const completeQuarters = filterCompleteQuarters(realData.history, currentYear);

  if (completeQuarters === 0) {
    return null;
  }

  const currentQuarters = aggregateQuarterlyData(realData.history, currentYear, completeQuarters);
  const previousQuarters = aggregateQuarterlyData(realData.history, currentYear - 1, completeQuarters);

  const labels = currentQuarters.map(q => `Q${q.quarter}`);
  const currentValues = currentQuarters.map(q => q.value);
  const previousValues = previousQuarters.map(q => q.value);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: `${currentYear}`,
          data: currentValues,
          backgroundColor: 'rgba(37, 99, 235, 0.65)'
        },
        {
          label: `${currentYear - 1}`,
          data: previousValues,
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

function buildScenarioChartConfig(realData, scenario, chartType = 'line') {
  if (!realData || !realData.history.length) {
    return null;
  }

  const currentYear = CURRENT_YEAR;
  const currentData = getDataByYear(realData.history, currentYear);

  const targetMap = new Map();
  realData.targets
    .filter(item => item.anio === currentYear && item.escenario === scenario)
    .forEach(item => {
      targetMap.set(item.mes, Number(item.valor) || null);
    });

  const realValues = Array(12).fill(null);
  const targetValues = Array(12).fill(null);

  currentData.forEach(item => {
    if (item.mes >= 1 && item.mes <= 12) {
      realValues[item.mes - 1] = Number(item.valor) || null;
    }
  });

  for (let mes = 1; mes <= 12; mes++) {
    if (targetMap.has(mes)) {
      targetValues[mes - 1] = targetMap.get(mes);
    }
  }

  const label = SCENARIO_LABELS[scenario] || 'Meta';

  const config = {
    type: chartType,
    data: {
      labels: MONTHS.map(month => month.short),
      datasets: [
        {
          label: 'Real',
          data: realValues,
          borderColor: '#2563eb',
          backgroundColor: chartType === 'bar' ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
          borderWidth: 2,
          spanGaps: true
        },
        {
          label,
          data: targetValues,
          borderColor: '#f97316',
          backgroundColor: chartType === 'bar' ? '#f97316' : 'rgba(249, 115, 22, 0.15)',
          borderWidth: 2,
          spanGaps: true
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

  if (chartType === 'line') {
    config.data.datasets[0].tension = 0.3;
    config.data.datasets[0].fill = true;
    config.data.datasets[0].pointRadius = 3;
    
    config.data.datasets[1].borderDash = [6, 4];
    config.data.datasets[1].tension = 0.3;
    config.data.datasets[1].fill = false;
    config.data.datasets[1].pointRadius = 3;
  }

  return config;
}

function buildAnnualChartConfig(realData) {
  if (!realData || !realData.history.length) {
    return null;
  }

  const years = Array.from(new Set(realData.history.map(item => item.anio)))
    .sort((a, b) => a - b)
    .slice(-5);

  const values = years.map(year => {
    const yearData = getDataByYear(realData.history, year);
    return sum(yearData.map(item => item.valor));
  });

  return {
    type: 'bar',
    data: {
      labels: years.map(String),
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

function buildChartConfig(realData, type, scenario, chartType = 'line') {
  if (!realData) return null;
  
  if (type === 'monthly') {
    return buildMonthlyChartConfig(realData, chartType);
  } else if (type === 'quarterly') {
    return buildQuarterlyChartConfig(realData);
  } else if (type === 'annual') {
    return buildAnnualChartConfig(realData);
  } else {
    return buildScenarioChartConfig(realData, scenario, chartType);
  }
}

function buildChartTypeToggle(currentType, type) {
  if (type !== 'monthly' && type !== 'scenario') {
    return '';
  }
  
  return `
    <div class="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" data-chart-toggle>
      <button
        type="button"
        data-chart-type="line"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          currentType === 'line' 
            ? 'bg-primary-600 text-white shadow' 
            : 'text-slate-500 hover:bg-slate-100'
        }"
      >
        <i class="fa-solid fa-chart-line"></i>
        Líneas
      </button>
      <button
        type="button"
        data-chart-type="bar"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
          currentType === 'bar' 
            ? 'bg-primary-600 text-white shadow' 
            : 'text-slate-500 hover:bg-slate-100'
        }"
      >
        <i class="fa-solid fa-chart-column"></i>
        Barras
      </button>
    </div>
  `;
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

function buildModalMarkup({ label, realData, type, scenario, chartType = 'line' }) {
  const summary = buildSummary(realData, type, scenario);
  const rowsMarkup = buildTableRows(realData, type, scenario);
  const trendClasses = getTrendColorClasses(summary.diff ?? 0);
  const scenarioLabel = type === 'scenario' ? SCENARIO_LABELS[scenario] ?? 'Meta' : summary.comparisonLabel;
  const chartToggle = buildChartTypeToggle(chartType, type);

  return `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
      <div class="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
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
            <p class="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
            <h2 class="text-2xl font-semibold text-slate-900">${escapeHtml(label)}</h2>
            ${realData?.indicator ? `
              <div class="flex flex-wrap gap-3 text-sm text-slate-500">
                <span><strong>Área:</strong> ${escapeHtml(realData.indicator.area_nombre || '—')}</span>
                <span><strong>Unidad:</strong> ${escapeHtml(realData.indicator.unidad_medida || '—')}</span>
              </div>
            ` : ''}
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
            <div class="mb-3 flex items-center justify-between flex-wrap gap-3">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Visualización</h3>
              ${chartToggle}
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

async function openIndicatorModal({ label, dataKey, type, scenario }) {
  const root = ensureModalContainer();
  
  root.innerHTML = `
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div class="rounded-2xl bg-white p-8 shadow-2xl">
        <div class="flex items-center gap-3 text-slate-600">
          <svg class="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>Cargando datos del indicador...</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.classList.add('overflow-hidden');

  try {
    const indicators = await getIndicators();
    const foundIndicator = findIndicatorByDataKey(indicators, dataKey);

    if (!foundIndicator) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
            <div class="text-center">
              <i class="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Indicador no encontrado</h3>
              <p class="text-sm text-slate-600 mb-4">No se encontró un indicador configurado para esta opción.</p>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                data-modal-close
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const closeBtn = root.querySelector('[data-modal-close]');
      closeBtn?.addEventListener('click', closeIndicatorModal);
      return;
    }

    const realData = await getIndicatorRealData(foundIndicator.id);
    
    if (!realData || !realData.history.length) {
      root.innerHTML = `
        <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
          <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
            <div class="text-center">
              <i class="fa-solid fa-chart-simple text-4xl text-slate-300 mb-4"></i>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Sin datos disponibles</h3>
              <p class="text-sm text-slate-600 mb-4">No hay datos históricos registrados para este indicador.</p>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                data-modal-close
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const closeBtn = root.querySelector('[data-modal-close]');
      closeBtn?.addEventListener('click', closeIndicatorModal);
      return;
    }

    let currentChartType = 'line';

    const renderModal = (chartType) => {
      root.innerHTML = buildModalMarkup({ 
        label: foundIndicator.nombre, 
        realData, 
        type, 
        scenario,
        chartType 
      });

      const overlay = root.querySelector('[data-modal-overlay]');
      const closeButton = root.querySelector('[data-modal-close]');
      const canvas = root.querySelector('[data-modal-chart]');
      const chartToggle = root.querySelector('[data-chart-toggle]');

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

      if (chartToggle) {
        chartToggle.querySelectorAll('[data-chart-type]').forEach(btn => {
          btn.addEventListener('click', () => {
            const newChartType = btn.dataset.chartType;
            if (newChartType !== currentChartType) {
              currentChartType = newChartType;
              renderModal(newChartType);
            }
          });
        });
      }

      const chartConfig = buildChartConfig(realData, type, scenario, chartType);
      if (chartConfig) {
        renderModalChart(canvas, chartConfig);
      }
    };

    renderModal(currentChartType);

  } catch (error) {
    console.error('Error al abrir modal:', error);
    root.innerHTML = `
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 px-4 py-6" data-modal-overlay>
        <div class="rounded-2xl bg-white p-8 shadow-2xl max-w-md">
          <div class="text-center">
            <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Error al cargar datos</h3>
            <p class="text-sm text-slate-600 mb-4">${escapeHtml(error.message || 'Ocurrió un error inesperado')}</p>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              data-modal-close
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const closeBtn = root.querySelector('[data-modal-close]');
    closeBtn?.addEventListener('click', closeIndicatorModal);
  }
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
    button.addEventListener('click', async () => {
      const dataKey = button.dataset.optionDatakey;
      const type = button.dataset.optionType;
      const scenario = button.dataset.optionScenario || null;
      const label = button.dataset.optionLabel || button.textContent.trim();

      if (!dataKey || !type) {
        console.warn('Opción sin datos configurados', button);
        return;
      }

      await openIndicatorModal({ label, dataKey, type, scenario });
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
