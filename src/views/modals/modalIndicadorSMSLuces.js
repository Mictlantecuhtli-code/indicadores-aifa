const MONTHS = [
  { value: 1, label: 'Enero', short: 'Ene' },
  { value: 2, label: 'Febrero', short: 'Feb' },
  { value: 3, label: 'Marzo', short: 'Mar' },
  { value: 4, label: 'Abril', short: 'Abr' },
  { value: 5, label: 'Mayo', short: 'May' },
  { value: 6, label: 'Junio', short: 'Jun' },
  { value: 7, label: 'Julio', short: 'Jul' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Septiembre', short: 'Sep' },
  { value: 10, label: 'Octubre', short: 'Oct' },
  { value: 11, label: 'Noviembre', short: 'Nov' },
  { value: 12, label: 'Diciembre', short: 'Dic' }
];

const ALERT_LINE_CONFIGS = [
  {
    value: 80,
    label: 'Nivel de alerta 3: 80%',
    color: 'rgb(239, 68, 68)',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-900 font-semibold'
  },
  {
    value: 83,
    label: 'Nivel de alerta 2: 83%',
    color: 'rgb(249, 115, 22)',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-900 font-semibold'
  },
  {
    value: 87,
    label: 'Nivel de alerta 1: 87%',
    color: 'rgb(234, 179, 8)',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-900 font-semibold'
  },
  {
    value: 90,
    label: 'Objetivo: 90%',
    color: 'rgb(34, 197, 94)',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-900'
  }
];

const SUBSYSTEM_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },
  { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgba(251, 146, 60, 1)' },
  { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgba(34, 197, 94, 1)' },
  { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgba(168, 85, 247, 1)' },
  { bg: 'rgba(244, 114, 182, 0.8)', border: 'rgba(244, 114, 182, 1)' },
  { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgba(20, 184, 166, 1)' },
  { bg: 'rgba(163, 163, 163, 0.8)', border: 'rgba(163, 163, 163, 1)' },
  { bg: 'rgba(244, 208, 63, 0.8)', border: 'rgba(244, 208, 63, 1)' }
];

export const SMS_LUCES_MODAL_ID = 'modal-sms-luces';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPercentage(value) {
  if (value == null || isNaN(value)) return '-';
  return `${Number(value).toFixed(2)}%`;
}

function parseObservation(observaciones) {
  if (!observaciones) {
    return { pista: null, subsistema: null };
  }

  const [rawPista, rawSubsystem] = observaciones.split('|');
  const pista = rawPista ? rawPista.trim() : null;
  const subsistema = rawSubsystem ? rawSubsystem.trim() : null;

  return { pista, subsistema };
}

function buildMonthLabel(mes, anio) {
  const monthInfo = MONTHS.find(month => month.value === mes);
  const monthName = monthInfo ? monthInfo.label : `Mes ${mes}`;
  return `${monthName} ${anio}`;
}

function average(values) {
  const numeric = values.filter(value => Number.isFinite(value));
  if (!numeric.length) return null;
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return total / numeric.length;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildLegendBadges() {
  return ALERT_LINE_CONFIGS.map(line => `
    <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${line.bgClass} ${line.textClass}">
      <span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: ${line.color}"></span>
      ${escapeHtml(line.label)}
    </span>
  `).join('');
}

const monthGroupingPlugin = {
  id: 'smsLucesMonthGrouping',
  afterDraw(chart) {
    const groups = chart?.config?.options?.plugins?.monthGrouping?.groups;
    if (!groups || !groups.length) return;

    const { ctx, chartArea, scales } = chart;
    if (!ctx || !chartArea || !scales?.x) return;

    ctx.save();
    ctx.font = '12px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const { bottom } = chartArea;
    const xScale = scales.x;

    groups.forEach(group => {
      const startPixel = xScale.getPixelForTick(group.startIndex ?? 0);
      const endPixel = xScale.getPixelForTick(group.endIndex ?? 0);
      if (!Number.isFinite(startPixel) || !Number.isFinite(endPixel)) {
        return;
      }

      const center = (startPixel + endPixel) / 2;
      ctx.fillText(group.label, center, bottom + 12);
    });

    ctx.restore();
  }
};

export function buildSmsLucesChartModel(records) {
  const safeRecords = Array.isArray(records) ? records : [];

  const parsedRecords = safeRecords
    .map(row => {
      const { pista, subsistema } = parseObservation(row.observaciones);
      return {
        pista,
        subsistema,
        anio: Number(row.anio),
        mes: Number(row.mes),
        valor: row.valor != null ? Number(row.valor) : null,
        metaMensual: row.meta_mensual != null ? Number(row.meta_mensual) : null
      };
    })
    .filter(item => item.pista && item.subsistema && Number.isFinite(item.anio) && Number.isFinite(item.mes));

  if (!parsedRecords.length) {
    return {
      records: [],
      labels: [],
      groups: [],
      subsystems: [],
      valuesBySubsystem: new Map(),
      widthPercent: 100,
      latestYear: null
    };
  }

  const years = [...new Set(parsedRecords.map(item => item.anio))];
  const latestYear = Math.max(...years);
  const latestYearRecords = parsedRecords
    .filter(item => item.anio === latestYear)
    .sort((a, b) => {
      if (a.mes !== b.mes) return a.mes - b.mes;
      if (a.pista !== b.pista) return a.pista.localeCompare(b.pista);
      return a.subsistema.localeCompare(b.subsistema);
    });

  if (!latestYearRecords.length) {
    return {
      records: [],
      labels: [],
      groups: [],
      subsystems: [],
      valuesBySubsystem: new Map(),
      widthPercent: 100,
      latestYear
    };
  }

  const months = [...new Set(latestYearRecords.map(item => item.mes))].sort((a, b) => a - b);
  const labels = [];
  const groups = [];
  const labelIndexMap = new Map();
  let runningIndex = 0;

  months.forEach(monthNumber => {
    const pistas = [...new Set(latestYearRecords
      .filter(item => item.mes === monthNumber)
      .map(item => item.pista))].sort((a, b) => a.localeCompare(b));

    if (!pistas.length) return;

    const monthLabel = buildMonthLabel(monthNumber, latestYear);
    const startIndex = runningIndex;

    pistas.forEach(pista => {
      const key = `${latestYear}-${String(monthNumber).padStart(2, '0')}__${pista}`;
      labels.push({
        key,
        pista,
        mes: monthNumber,
        anio: latestYear,
        monthLabel
      });
      labelIndexMap.set(key, runningIndex);
      runningIndex += 1;
    });

    groups.push({
      label: monthLabel,
      month: monthNumber,
      year: latestYear,
      startIndex,
      endIndex: runningIndex - 1
    });
  });

  const subsystems = [...new Set(latestYearRecords.map(item => item.subsistema))].sort((a, b) => a.localeCompare(b));
  const valuesBySubsystem = new Map();

  subsystems.forEach(subsystem => {
    valuesBySubsystem.set(subsystem, Array(labels.length).fill(null));
  });

  const aggregate = new Map();

  latestYearRecords.forEach(record => {
    const labelKey = `${latestYear}-${String(record.mes).padStart(2, '0')}__${record.pista}`;
    const subsystemKey = `${labelKey}||${record.subsistema}`;

    if (!Number.isFinite(record.valor)) {
      return;
    }

    const entry = aggregate.get(subsystemKey) || { total: 0, count: 0 };
    entry.total += record.valor;
    entry.count += 1;
    aggregate.set(subsystemKey, entry);
  });

  aggregate.forEach((entry, key) => {
    const [labelKey, subsystem] = key.split('||');
    const labelIndex = labelIndexMap.get(labelKey);
    if (!valuesBySubsystem.has(subsystem) || labelIndex == null) {
      return;
    }

    const averagedValue = entry.total / entry.count;
    const subsystemValues = valuesBySubsystem.get(subsystem);
    subsystemValues[labelIndex] = round(averagedValue, 2);
  });

  const widthPercent = Math.max((groups.length / 2) * 100, 100);

  return {
    records: latestYearRecords,
    labels,
    labelIndexMap,
    groups,
    subsystems,
    valuesBySubsystem,
    widthPercent,
    latestYear
  };
}

export function buildSmsLucesModalMarkup(indicatorName, indicatorSubtitle) {
  return `
    <div
      id="${SMS_LUCES_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[90vh] md:rounded-xl"
        data-modal-content
        role="dialog"
        aria-labelledby="modal-sms-luces-title"
        aria-describedby="modal-sms-luces-description"
      >
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div class="flex-1">
            <h2 id="modal-sms-luces-title" class="text-2xl font-bold text-slate-900">
              ${escapeHtml(indicatorName)}
            </h2>
            <p id="modal-sms-luces-description" class="mt-1 text-sm text-slate-600">
              ${escapeHtml(indicatorSubtitle)}
            </p>
          </div>
          <button
            type="button"
            class="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aifa-light"
            data-close-modal
            aria-label="Cerrar modal"
          >
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-6" data-modal-body>
          <div class="flex items-center justify-center py-8">
            <div class="flex items-center gap-2 text-slate-400">
              <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
              <span>Cargando datos...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildSmsLucesSummary(model) {
  if (!model || !model.records.length) {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No hay datos disponibles para mostrar un resumen.
      </div>
    `;
  }

  const values = model.records
    .map(record => record.valor)
    .filter(value => Number.isFinite(value));

  const promedioGeneral = round(average(values), 2);
  const cumplimiento = values.filter(value => value >= ALERT_LINE_CONFIGS[3].value).length;
  const cumplimientoPorcentaje = values.length ? round((cumplimiento / values.length) * 100, 2) : null;
  const cumplimientoTexto = values.length
    ? `${cumplimiento} / ${values.length} (${formatPercentage(cumplimientoPorcentaje)})`
    : 'Sin datos disponibles';

  const pistas = new Set(model.records.map(record => record.pista));
  const months = new Set(model.records.map(record => record.mes));

  const subsystemStats = model.subsystems
    .map(subsystem => {
      const subsystemValues = (model.valuesBySubsystem.get(subsystem) || []).filter(value => Number.isFinite(value));
      return subsystemValues.length
        ? { subsystem, average: round(average(subsystemValues), 2) }
        : null;
    })
    .filter(Boolean);

  const bestSubsystem = subsystemStats.reduce((best, current) => {
    if (!best) return current;
    if (!current) return best;
    return current.average > best.average ? current : best;
  }, null);

  const worstSubsystem = subsystemStats.reduce((worst, current) => {
    if (!worst) return current;
    if (!current) return worst;
    return current.average < worst.average ? current : worst;
  }, null);

  return `
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="text-base font-semibold text-slate-900">Panorama general</h3>
        <dl class="mt-4 space-y-2 text-sm text-slate-700">
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Último año analizado</dt>
            <dd class="font-semibold text-slate-900">${model.latestYear ?? '-'}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Meses con datos</dt>
            <dd class="font-semibold text-slate-900">${months.size}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Pistas evaluadas</dt>
            <dd class="font-semibold text-slate-900">${pistas.size}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Promedio general</dt>
            <dd class="font-semibold text-slate-900">${formatPercentage(promedioGeneral)}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Cumplimiento de la meta (≥ 90%)</dt>
            <dd class="font-semibold text-slate-900">${cumplimientoTexto}</dd>
          </div>
        </dl>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="text-base font-semibold text-slate-900">Desempeño por subsistema</h3>
        <dl class="mt-4 space-y-2 text-sm text-slate-700">
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Mejor desempeño</dt>
            <dd class="text-right">
              <span class="block font-semibold text-slate-900">${escapeHtml(bestSubsystem?.subsystem ?? 'Sin datos')}</span>
              <span class="text-xs text-slate-500">${formatPercentage(bestSubsystem?.average)}</span>
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Mayor oportunidad de mejora</dt>
            <dd class="text-right">
              <span class="block font-semibold text-slate-900">${escapeHtml(worstSubsystem?.subsystem ?? 'Sin datos')}</span>
              <span class="text-xs text-slate-500">${formatPercentage(worstSubsystem?.average)}</span>
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-slate-500">Meta anual</dt>
            <dd class="font-semibold text-emerald-600">${formatPercentage(90)}</dd>
          </div>
        </dl>
      </div>
    </div>
  `;
}

export function buildSmsLucesChartView(model) {
  const widthPercent = model?.widthPercent ?? 100;
  const legendBadges = buildLegendBadges();

  return `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        ${legendBadges}
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div class="overflow-x-auto">
          <div class="min-w-full" style="min-width: 100%; width: ${widthPercent}%">
            <canvas data-sms-luces-chart style="height: 420px; width: 100%"></canvas>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          Usa la barra de desplazamiento horizontal para explorar todos los meses (dos meses por vista).
        </p>
      </div>
    </div>
  `;
}

export function buildSmsLucesChartConfig(model) {
  const labels = model.labels.map(label => label.pista);
  const datasets = model.subsystems.map((subsystem, index) => {
    const colorSet = SUBSYSTEM_COLORS[index % SUBSYSTEM_COLORS.length];
    const values = (model.valuesBySubsystem.get(subsystem) || []).map(value => value != null ? Number(value) : null);

    return {
      type: 'bar',
      label: subsystem,
      data: values,
      backgroundColor: colorSet.bg,
      borderColor: colorSet.border,
      borderWidth: 1.5,
      borderRadius: 6,
      barPercentage: 0.75,
      categoryPercentage: 0.7,
      order: 1
    };
  });

  const thresholdDatasets = ALERT_LINE_CONFIGS.map((lineConfig, index) => ({
    label: lineConfig.label,
    data: labels.map(() => lineConfig.value),
    type: 'line',
    borderColor: lineConfig.color,
    borderWidth: 2,
    borderDash: index === ALERT_LINE_CONFIGS.length - 1 ? [] : [6, 6],
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: 0,
    tension: 0,
    order: 99,
    isThreshold: true
  }));

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [...datasets, ...thresholdDatasets]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 48
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          stacked: false,
          grid: {
            display: false
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: value => `${value}%`
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            usePointStyle: true,
            padding: 18
          }
        },
        tooltip: {
          callbacks: {
            title: items => {
              if (!items.length) return '';
              const index = items[0].dataIndex;
              const label = model.labels[index];
              return label ? `${label.monthLabel} • ${label.pista}` : items[0].label;
            },
            label: context => {
              if (context.dataset?.isThreshold) {
                return context.dataset.label;
              }

              const value = Number(context.parsed.y);
              const formatted = Number.isFinite(value) ? `${value.toFixed(2)}%` : '-';
              return `${context.dataset.label}: ${formatted}`;
            }
          }
        },
        monthGrouping: {
          groups: model.groups
        }
      }
    },
    plugins: [monthGroupingPlugin]
  };

  return config;
}
