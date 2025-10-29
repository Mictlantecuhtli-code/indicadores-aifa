import { buildIndicatorModalHeader } from './sharedIndicatorHeader.js';

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

const ALERT_LINE_CONFIGS = [
  {
    value: 80,
    label: 'Objetivo: 80%',
    color: 'rgb(34, 197, 94)',
    textClass: 'text-emerald-900'
  },
  {
    value: 60,
    label: 'Nivel de alerta 1: 60%',
    color: 'rgb(234, 179, 8)',
    textClass: 'text-yellow-900'
  },
  {
    value: 40,
    label: 'Nivel de alerta 2: 40%',
    color: 'rgb(249, 115, 22)',
    textClass: 'text-orange-900'
  },
  {
    value: 30,
    label: 'Nivel de alerta 3: 30%',
    color: 'rgb(239, 68, 68)',
    textClass: 'text-rose-900'
  }
];

const MAINTENANCE_COLOR_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.85)', border: 'rgba(37, 99, 235, 1)' },
  { bg: 'rgba(45, 212, 191, 0.85)', border: 'rgba(20, 184, 166, 1)' },
  { bg: 'rgba(251, 191, 36, 0.85)', border: 'rgba(245, 158, 11, 1)' },
  { bg: 'rgba(99, 102, 241, 0.85)', border: 'rgba(79, 70, 229, 1)' },
  { bg: 'rgba(244, 114, 182, 0.85)', border: 'rgba(236, 72, 153, 1)' },
  { bg: 'rgba(34, 197, 94, 0.85)', border: 'rgba(22, 163, 74, 1)' },
  { bg: 'rgba(147, 197, 253, 0.85)', border: 'rgba(96, 165, 250, 1)' },
  { bg: 'rgba(165, 180, 252, 0.85)', border: 'rgba(129, 140, 248, 1)' }
];

export const SMS_MANTENIMIENTOS_MODAL_ID = 'modal-sms-mantenimientos';

const INDICATOR_METADATA = {
  nombre: 'Porcentaje de Mantenimientos Programados Realizados a Pavimentos',
  clave: 'SMS-06',
  uuid: '8021dd97-bfa6-42c8-9d68-bb6e8fb5aebe',
  descripcion: 'Cumplir por lo menos el 80% de los mantenimientos programados.',
  area: 'SMS (Seguridad Operacional)',
  areaUuid: 'fa47f802-68fc-40a6-bdab-135f34d24337',
  unidadMedida: 'Porcentaje',
  frecuencia: 'Mensual',
  metaAnual: 80
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value).toFixed(2)}%`;
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

function buildMonthLabel(mes, anio) {
  const monthInfo = MONTHS.find(month => month.value === mes);
  const label = monthInfo ? monthInfo.label : `Mes ${mes}`;
  return `${label} ${anio}`;
}

function buildThresholdLegendBadges() {
  return ALERT_LINE_CONFIGS.map(line => `
    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
      <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${line.color}"></span>
      ${escapeHtml(line.label)}
    </span>
  `).join('');
}

function buildMaintenanceLegend(model) {
  if (!model?.maintenanceTypes?.length) {
    return '';
  }

  return `
    <ul class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      ${model.maintenanceTypes
        .map((type, index) => {
          const colorSet = MAINTENANCE_COLOR_PALETTE[index % MAINTENANCE_COLOR_PALETTE.length];
          return `
            <li class="flex items-start gap-3">
              <span class="mt-1 inline-flex h-3 w-3 rounded-sm" style="background-color: ${colorSet.bg}; border: 1px solid ${colorSet.border}"></span>
              <span class="text-sm text-slate-700">${escapeHtml(type)}</span>
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

const horizontalLinePlugin = {
  id: 'smsMantenimientosHorizontalLines',
  afterDraw(chart) {
    const options = chart?.config?.options?.plugins?.horizontalLines;
    const lines = options?.lines;
    if (!Array.isArray(lines) || !lines.length) return;

    const {
      ctx,
      chartArea: { left, right },
      scales: { y }
    } = chart;

    if (!ctx || !y) return;

    ctx.save();

    lines.forEach(line => {
      const yPixel = y.getPixelForValue(line.value);
      if (!Number.isFinite(yPixel)) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(left, yPixel);
      ctx.lineTo(right, yPixel);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = line.color ?? 'rgba(148, 163, 184, 0.6)';
      ctx.setLineDash(line.dash ?? [6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (line.label) {
        ctx.font = '12px "Inter", "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = line.color ?? '#475569';
        ctx.fillText(line.label, left + 6, yPixel - 6);
      }
    });

    ctx.restore();
  }
};

export function buildSmsMantenimientosModalMarkup(indicatorName, indicatorSubtitle) {
  const headerMarkup = buildIndicatorModalHeader({
    breadcrumb: 'Indicador SMS / Objetivo 3 / Indicador 3.2',
    title: indicatorName ?? INDICATOR_METADATA.nombre,
    subtitle: indicatorSubtitle ?? INDICATOR_METADATA.descripcion,
    titleId: 'modal-sms-mantenimientos-title',
    subtitleId: 'modal-sms-mantenimientos-description',
    infoItems: [
      { label: 'Área responsable', value: INDICATOR_METADATA.area },
      { label: 'Unidad de medida', value: INDICATOR_METADATA.unidadMedida },
      { label: 'Frecuencia', value: INDICATOR_METADATA.frecuencia }
    ],
    highlight: {
      label: 'Meta anual',
      value: formatPercentage(INDICATOR_METADATA.metaAnual),
      description: 'Porcentaje mínimo de mantenimientos programados ejecutados.'
    }
  });

  return `
    <div
      id="${SMS_MANTENIMIENTOS_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[92vh] md:rounded-2xl"
        data-modal-content
        role="dialog"
        aria-labelledby="modal-sms-mantenimientos-title"
        aria-describedby="modal-sms-mantenimientos-description"
      >
        ${headerMarkup}
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

export function prepareSmsMantenimientosChartModel(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const parsedRows = safeRows
    .map(row => ({
      indicadorId: row.indicador_id ?? null,
      anio: row.anio != null ? Number(row.anio) : null,
      mes: row.mes != null ? Number(row.mes) : null,
      tipoMantenimiento: row.tipo_mantenimiento ? row.tipo_mantenimiento.trim() : 'Sin clasificar',
      unidad: row.unidad ? row.unidad.trim() : null,
      totalMensual: row.total_mensual != null ? Number(row.total_mensual) : null,
      registrosConsolidados: row.registros_consolidados != null ? Number(row.registros_consolidados) : 0,
      ultimaCaptura: row.ultima_captura ? new Date(row.ultima_captura) : null
    }))
    .filter(row => Number.isFinite(row.anio) && Number.isFinite(row.mes) && Number.isFinite(row.totalMensual))
    .sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      if (a.mes !== b.mes) return a.mes - b.mes;
      return a.tipoMantenimiento.localeCompare(b.tipoMantenimiento);
    });

  if (!parsedRows.length) {
    return {
      labels: [],
      months: [],
      maintenanceTypes: [],
      percentagesByType: new Map(),
      unit: INDICATOR_METADATA.unidadMedida,
      lastCapture: null,
      totalRegistros: 0
    };
  }

  const maintenanceTypes = Array.from(new Set(parsedRows.map(row => row.tipoMantenimiento)));
  const monthMap = new Map();

  parsedRows.forEach(row => {
    const key = `${row.anio}-${String(row.mes).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        anio: row.anio,
        mes: row.mes,
        label: buildMonthLabel(row.mes, row.anio),
        totalsByType: new Map(),
        total: 0,
        registros: 0
      });
    }

    const monthEntry = monthMap.get(key);
    monthEntry.totalsByType.set(row.tipoMantenimiento, row.totalMensual);
    monthEntry.total += row.totalMensual;
    monthEntry.registros += row.registrosConsolidados;
  });

  const months = Array.from(monthMap.values()).sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });

  months.forEach(month => {
    month.percentagesByType = new Map();
    maintenanceTypes.forEach(type => {
      const totalForType = month.totalsByType.get(type) ?? 0;
      const percentage = month.total > 0 ? (totalForType / month.total) * 100 : 0;
      month.percentagesByType.set(type, percentage);
    });
  });

  const percentagesByType = new Map(
    maintenanceTypes.map(type => [type, months.map(month => month.percentagesByType.get(type) ?? 0)])
  );

  const lastCapture = parsedRows.reduce((latest, row) => {
    if (!row.ultimaCaptura || Number.isNaN(row.ultimaCaptura.getTime())) {
      return latest;
    }
    if (!latest) return row.ultimaCaptura;
    return row.ultimaCaptura > latest ? row.ultimaCaptura : latest;
  }, null);

  const totalRegistros = parsedRows.reduce((sum, row) => sum + (row.registrosConsolidados ?? 0), 0);
  const unit = parsedRows.find(row => row.unidad)?.unidad ?? INDICATOR_METADATA.unidadMedida;

  return {
    labels: months.map(month => month.label),
    months,
    maintenanceTypes,
    percentagesByType,
    unit,
    lastCapture,
    totalRegistros
  };
}

export function buildSmsMantenimientosSummary(model) {
  if (!model?.months?.length) {
    return `
      <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No hay datos disponibles para mostrar el resumen del indicador.
      </div>
    `;
  }

  const totals = model.months.map(month => month.total);
  const totalAcumulado = totals.reduce((sum, value) => sum + value, 0);
  const promedioMensual = totals.length ? totalAcumulado / totals.length : null;
  const ultimoMes = model.months[model.months.length - 1];

  return `
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-primary-600">Indicador SMS / Objetivo 3 / Indicador 3.2</p>
            <h3 class="mt-1 text-2xl font-bold text-slate-900">${escapeHtml(INDICATOR_METADATA.nombre)}</h3>
            <p class="mt-2 text-sm text-slate-600">${escapeHtml(INDICATOR_METADATA.descripcion)}</p>
          </div>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Área responsable</dt>
              <dd class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(INDICATOR_METADATA.area)}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad de medida</dt>
              <dd class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(model.unit)}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Frecuencia</dt>
              <dd class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(INDICATOR_METADATA.frecuencia)}</dd>
            </div>
          </dl>
        </div>
        <div class="space-y-4">
          <div class="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Meta anual</div>
            <div class="mt-1 text-3xl font-bold text-emerald-700">${formatPercentage(INDICATOR_METADATA.metaAnual)}</div>
            <p class="mt-1 text-xs text-emerald-700/80">Porcentaje mínimo de mantenimientos programados ejecutados.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-4 shadow-sm">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio mensual</div>
              <div class="mt-2 text-xl font-bold text-slate-900">${formatNumber(promedioMensual)}</div>
              <p class="mt-1 text-xs text-slate-500">Mantenimientos registrados por mes.</p>
            </div>
            <div class="rounded-xl bg-slate-50 p-4 shadow-sm">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Último mes reportado</div>
              <div class="mt-2 text-sm font-semibold text-slate-900">${ultimoMes ? escapeHtml(ultimoMes.label) : '-'}</div>
              <p class="mt-1 text-xs text-slate-500">Total: ${formatNumber(ultimoMes?.total)}</p>
            </div>
            <div class="rounded-xl bg-slate-50 p-4 shadow-sm sm:col-span-2">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Última actualización</div>
              <div class="mt-2 text-sm font-semibold text-slate-900">${formatDateTime(model.lastCapture)}</div>
              <p class="mt-1 text-xs text-slate-500">Registros consolidados: ${formatNumber(model.totalRegistros, 0)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function buildSmsMantenimientosChartView(model) {
  return `
    <section class="space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        ${buildThresholdLegendBadges()}
      </div>
      <div class="relative h-[420px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <canvas
          data-sms-mantenimientos-chart
          aria-label="Gráfica de porcentaje de mantenimientos programados realizados"
          role="img"
        ></canvas>
      </div>
      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-900">Tipos de mantenimiento</h3>
        <p class="mt-1 text-xs text-slate-500">Distribución porcentual mensual por tipo de mantenimiento.</p>
        <div class="mt-3">
          ${buildMaintenanceLegend(model)}
        </div>
      </div>
    </section>
  `;
}

export function buildSmsMantenimientosChartConfig(model) {
  const datasets = model.maintenanceTypes.map((type, index) => {
    const colorSet = MAINTENANCE_COLOR_PALETTE[index % MAINTENANCE_COLOR_PALETTE.length];
    return {
      type: 'bar',
      label: type,
      data: model.percentagesByType.get(type) ?? [],
      backgroundColor: colorSet.bg,
      borderColor: colorSet.border,
      borderWidth: 1,
      stack: 'monthly',
      maxBarThickness: 56,
      borderRadius: 4
    };
  });

  return {
    type: 'bar',
    data: {
      labels: model.labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      layout: {
        padding: {
          top: 16,
          bottom: 24,
          left: 8,
          right: 16
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label(context) {
              const type = context.dataset?.label ?? '';
              const percentage = context.parsed?.y ?? 0;
              const month = model.months[context.dataIndex];
              const rawTotal = month?.totalsByType?.get(type) ?? 0;
              return `${type}: ${formatPercentage(percentage)} (${formatNumber(rawTotal)} mantenimientos)`;
            },
            footer(items) {
              const firstItem = items?.[0];
              if (!firstItem) return '';
              const month = model.months[firstItem.dataIndex];
              if (!month) return '';
              return `Total mensual: ${formatNumber(month.total)}`;
            }
          }
        },
        horizontalLines: {
          lines: ALERT_LINE_CONFIGS
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#475569'
          },
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            color: '#475569',
            callback: value => `${value}%`
          },
          title: {
            display: true,
            text: 'Porcentaje',
            color: '#1f2937',
            font: {
              family: 'Inter, "Segoe UI", system-ui, sans-serif',
              weight: '600'
            }
          }
        }
      }
    },
    plugins: [horizontalLinePlugin]
  };
}

export function buildSmsMantenimientosDetailTable(model) {
  if (!model?.months?.length) {
    return '';
  }

  const headerCells = model.maintenanceTypes
    .map(
      type => `
        <th scope="col" class="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
          ${escapeHtml(type)}
        </th>
      `
    )
    .join('');

  const bodyRows = model.months
    .map(month => {
      const cells = model.maintenanceTypes
        .map(type => {
          const percentage = month.percentagesByType.get(type) ?? 0;
          const rawValue = month.totalsByType.get(type) ?? 0;
          return `
            <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">
              <div class="font-semibold">${formatPercentage(percentage)}</div>
              <div class="text-xs text-slate-500">${formatNumber(rawValue)} mantenimientos</div>
            </td>
          `;
        })
        .join('');

      return `
        <tr class="border-t border-slate-200">
          <th scope="row" class="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900">
            ${escapeHtml(month.label)}
          </th>
          ${cells}
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
            ${formatNumber(month.total)}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header class="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 class="text-base font-semibold text-slate-900">Detalle mensual consolidado</h3>
        <p class="mt-1 text-sm text-slate-600">Participación porcentual y total de mantenimientos por mes.</p>
      </header>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mes</th>
              ${headerCells}
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total mensual</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
