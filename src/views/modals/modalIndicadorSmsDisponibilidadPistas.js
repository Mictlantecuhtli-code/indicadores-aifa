import { buildIndicatorModalHeader } from './sharedIndicatorHeader.js';

export const SMS_DISPONIBILIDAD_PISTAS_MODAL_ID = 'modal-sms-disponibilidad-pistas';

const INDICATOR_METADATA = {
  breadcrumb: 'Indicador SMS / Objetivo 3 / Indicador 3.3',
  nombre: 'Disponibilidad de Pistas',
  descripcion:
    'Medir la disponibilidad total de las pistas del AIFA dentro de los parámetros establecidos por el área de Seguridad Operacional.',
  area: 'SMS (Seguridad Operacional)',
  unidad: 'Porcentaje',
  frecuencia: 'Mensual',
  metaAnual: 90
};

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
  { value: 80, label: 'Nivel de alerta 3: 80%', color: 'rgb(239, 68, 68)', textClass: 'text-rose-900' },
  { value: 83, label: 'Nivel de alerta 2: 83%', color: 'rgb(249, 115, 22)', textClass: 'text-orange-900' },
  { value: 87, label: 'Nivel de alerta 1: 87%', color: 'rgb(234, 179, 8)', textClass: 'text-yellow-900' },
  { value: 90, label: 'Objetivo: 90%', color: 'rgb(34, 197, 94)', textClass: 'text-emerald-900', dash: [] }
];

const RUNWAY_DATASET_STYLES = [
  {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    hoverBackgroundColor: 'rgba(37, 99, 235, 0.35)',
    borderColor: 'rgba(37, 99, 235, 0.65)',
    borderWidth: 1.5
  },
  {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    hoverBackgroundColor: 'rgba(16, 185, 129, 0.35)',
    borderColor: 'rgba(16, 185, 129, 0.65)',
    borderWidth: 1.5
  },
  {
    backgroundColor: 'rgba(244, 114, 182, 0.15)',
    hoverBackgroundColor: 'rgba(244, 114, 182, 0.35)',
    borderColor: 'rgba(236, 72, 153, 0.65)',
    borderWidth: 1.5
  }
];

const META_DATASET_STYLE = {
  borderColor: 'rgba(250, 204, 21, 1)',
  backgroundColor: 'rgba(250, 204, 21, 0.2)',
  borderWidth: 2,
  pointRadius: 4,
  pointBackgroundColor: 'rgba(250, 204, 21, 1)',
  pointBorderColor: '#fff',
  pointBorderWidth: 2,
  tension: 0.35
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function parseRunwayObservation(observaciones) {
  if (!observaciones || typeof observaciones !== 'string') {
    return { runway: null, detail: observaciones ?? null };
  }

  const [runwayPart, ...rest] = observaciones.split('|');
  const runway = runwayPart?.trim() || null;
  const detailText = rest.join('|').trim();

  return {
    runway,
    detail: detailText.length ? detailText : null
  };
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

function buildMonthLabel(mes, anio) {
  const monthInfo = MONTHS.find(month => month.value === mes);
  const monthName = monthInfo ? monthInfo.label : `Mes ${mes}`;
  return `${monthName} ${anio}`;
}

function average(values) {
  const numeric = values.filter(Number.isFinite);
  if (!numeric.length) return null;
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return total / numeric.length;
}

function buildThresholdLegendBadges() {
  return ALERT_LINE_CONFIGS.map(line => `
    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${line.color}"></span>
      ${escapeHtml(line.label)}
    </span>
  `).join('');
}

export function prepareSmsDisponibilidadPistasModel(records) {
  const safeRecords = Array.isArray(records) ? records : [];

  const parsedRecords = safeRecords
    .map(row => ({
      id: row?.id ?? null,
      indicadorId: row?.indicador_id ?? null,
      anio: Number(row?.anio),
      mes: Number(row?.mes),
      valor: row?.valor != null ? Number(row.valor) : null,
      metaMensual: row?.meta_mensual != null ? Number(row.meta_mensual) : null,
      observacionesOriginal: row?.observaciones ?? null,
      fechaCaptura: row?.fecha_captura ?? null,
      fechaUltimaEdicion: row?.fecha_ultima_edicion ?? null,
      fechaValidacion: row?.fecha_validacion ?? null,
      estatusValidacion: row?.estatus_validacion ?? null
    }))
    .filter(item => Number.isFinite(item.anio) && Number.isFinite(item.mes))
    .sort((a, b) => {
      if (a.anio === b.anio) return a.mes - b.mes;
      return a.anio - b.anio;
    });

  const months = parsedRecords.map(record => {
    const { runway, detail } = parseRunwayObservation(record.observacionesOriginal);

    return {
      ...record,
      pista: runway,
      observaciones: detail,
      label: buildMonthLabel(record.mes, record.anio)
    };
  });

  const latestYear = months.length ? Math.max(...months.map(item => item.anio)) : null;
  const chartMonths = latestYear != null ? months.filter(item => item.anio === latestYear) : months;

  const monthGroups = chartMonths.reduce((acc, record) => {
    const key = `${record.anio}-${record.mes}`;
    if (!acc.has(key)) {
      acc.set(key, {
        key,
        anio: record.anio,
        mes: record.mes,
        label: record.label,
        registros: []
      });
    }

    acc.get(key).registros.push(record);
    return acc;
  }, new Map());

  const orderedMonthGroups = Array.from(monthGroups.values()).sort((a, b) => {
    if (a.anio === b.anio) return a.mes - b.mes;
    return a.anio - b.anio;
  });

  const runways = Array.from(
    new Set(
      chartMonths
        .map(record => record.pista)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const chartLabels = orderedMonthGroups.map(group => group.label);

  const chartRunwaySeries = runways.map(runway => ({
    runway,
    data: orderedMonthGroups.map(group => {
      const runwayRecord = group.registros.find(item => item.pista === runway);
      return Number.isFinite(runwayRecord?.valor) ? Number(runwayRecord.valor) : null;
    })
  }));

  const chartMetaSeries = orderedMonthGroups.map(group => {
    const recordWithMeta = group.registros.find(item => Number.isFinite(item.metaMensual));
    return recordWithMeta?.metaMensual != null ? Number(recordWithMeta.metaMensual) : null;
  });

  const chartValues = chartMonths.map(month => month.valor).filter(Number.isFinite);
  const latestMeasurement = months.length ? months[months.length - 1] : null;
  const latestUpdate = latestMeasurement?.fechaUltimaEdicion ?? latestMeasurement?.fechaCaptura ?? null;

  const stats = {
    latestYear,
    average: average(chartValues),
    min: chartValues.length ? Math.min(...chartValues) : null,
    max: chartValues.length ? Math.max(...chartValues) : null
  };

  const metaMensualPromedio = average(chartMonths.map(month => month.metaMensual).filter(Number.isFinite));

  return {
    records: months,
    chartMonths,
    chartLabels,
    chartRunwaySeries,
    chartMetaSeries,
    latestYear,
    latestMeasurement,
    latestUpdate,
    stats,
    metaMensualPromedio,
    hasMetaMensual: chartMetaSeries.some(value => Number.isFinite(value))
  };
}

export function buildSmsDisponibilidadPistasModalMarkup(indicatorName, indicatorSubtitle) {
  const headerMarkup = buildIndicatorModalHeader({
    breadcrumb: INDICATOR_METADATA.breadcrumb,
    title: indicatorName ?? INDICATOR_METADATA.nombre,
    subtitle: indicatorSubtitle ?? INDICATOR_METADATA.descripcion,
    titleId: 'modal-sms-disponibilidad-pistas-title',
    subtitleId: 'modal-sms-disponibilidad-pistas-description',
    infoItems: [
      { label: 'Área responsable', value: INDICATOR_METADATA.area },
      { label: 'Unidad de medida', value: INDICATOR_METADATA.unidad },
      { label: 'Frecuencia', value: INDICATOR_METADATA.frecuencia }
    ],
    highlight: {
      label: 'Meta anual',
      value: formatPercentage(INDICATOR_METADATA.metaAnual),
      description: 'Porcentaje mínimo de disponibilidad mensual registrada.'
    }
  });

  return `
    <div
      id="${SMS_DISPONIBILIDAD_PISTAS_MODAL_ID}"
      class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[90vh] md:rounded-2xl"
        role="dialog"
        aria-labelledby="modal-sms-disponibilidad-pistas-title"
        aria-describedby="modal-sms-disponibilidad-pistas-description"
        data-modal-content
      >
        ${headerMarkup}
        <div class="flex-1 overflow-y-auto px-6 py-6" data-modal-body>
          <div class="flex items-center justify-center py-12">
            <div class="flex items-center gap-3 text-slate-400">
              <i class="fa-solid fa-circle-notch fa-spin text-3xl"></i>
              <span class="text-lg">Cargando datos...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildSmsDisponibilidadPistasSummary(model) {
  if (!model?.chartMonths?.length) {
    return `
      <section class="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p class="text-sm text-slate-500">No hay datos suficientes para generar un resumen.</p>
      </section>
    `;
  }

  const latestLabel = model.latestMeasurement ? buildMonthLabel(model.latestMeasurement.mes, model.latestMeasurement.anio) : null;
  const metaDescripcion = model.metaMensualPromedio != null
    ? `Meta mensual promedio: ${formatPercentage(model.metaMensualPromedio)}`
    : 'Sin meta mensual registrada';

  return `
    <section aria-labelledby="sms-disponibilidad-summary" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 id="sms-disponibilidad-summary" class="text-lg font-semibold text-slate-900">Resumen ${
          model.stats.latestYear ?? ''
        }</h3>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio anual</h4>
          <p class="mt-2 text-3xl font-bold text-slate-900">${formatPercentage(model.stats.average)}</p>
          <p class="mt-1 text-xs text-slate-500">Valor promedio de disponibilidad durante ${model.stats.latestYear ?? 'el año registrado'}.</p>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Último mes reportado</h4>
          <p class="mt-2 text-3xl font-bold text-primary-700">${formatPercentage(model.latestMeasurement?.valor)}</p>
          <p class="mt-1 text-xs text-slate-500">${latestLabel ?? 'Sin registros recientes'}</p>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Última actualización</h4>
          <p class="mt-2 text-base font-semibold text-slate-900">${formatDateTime(model.latestUpdate)}</p>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(metaDescripcion)}</p>
        </article>
      </div>
    </section>
  `;
}

export function buildSmsDisponibilidadPistasChartView(model) {
  const legendBadges = buildThresholdLegendBadges();

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">${legendBadges}</div>
        ${
          model.hasMetaMensual
            ? '<span class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"><span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>Meta mensual reportada</span>'
            : ''
        }
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="relative h-[360px]">
          <canvas data-sms-disponibilidad-chart aria-label="Gráfica de disponibilidad de pistas"></canvas>
        </div>
      </div>
    </section>
  `;
}

export function buildSmsDisponibilidadPistasDetailTable(model) {
  if (!model?.records?.length) {
    return '';
  }

  const groupedByYear = model.records.reduce((acc, record) => {
    const yearGroup = acc.get(record.anio) ?? [];
    yearGroup.push(record);
    acc.set(record.anio, yearGroup);
    return acc;
  }, new Map());

  const sections = Array.from(groupedByYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, rows]) => {
      const sortedRows = rows.slice().sort((a, b) => a.mes - b.mes);
      const bodyRows = sortedRows
        .map(row => `
          <tr class="border-b border-slate-100 text-sm text-slate-600 last:border-0">
            <td class="px-4 py-2 font-medium text-slate-700">${escapeHtml(buildMonthLabel(row.mes, row.anio))}</td>
            <td class="px-4 py-2 text-slate-900">${formatPercentage(row.valor)}</td>
            <td class="px-4 py-2">${row.metaMensual != null ? formatPercentage(row.metaMensual) : '—'}</td>
            <td class="px-4 py-2">${row.pista ? escapeHtml(row.pista) : '—'}</td>
            <td class="px-4 py-2">${row.observaciones ? escapeHtml(row.observaciones) : '—'}</td>
          </tr>
        `)
        .join('');

      return `
        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header class="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <h4 class="text-sm font-semibold text-slate-900">${escapeHtml(String(year))}</h4>
          </header>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-100 text-left">
              <thead class="bg-slate-50">
                <tr class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" class="px-4 py-2">Mes</th>
                  <th scope="col" class="px-4 py-2">Disponibilidad</th>
                  <th scope="col" class="px-4 py-2">Meta mensual</th>
                  <th scope="col" class="px-4 py-2">Pista</th>
                  <th scope="col" class="px-4 py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join('');

  return `
    <section aria-labelledby="sms-disponibilidad-detalle" class="space-y-4">
      <h3 id="sms-disponibilidad-detalle" class="text-lg font-semibold text-slate-900">Detalle histórico</h3>
      <div class="space-y-4">${sections}</div>
    </section>
  `;
}

export const smsDisponibilidadHorizontalLinesPlugin = {
  id: 'smsDisponibilidadHorizontalLines',
  afterDraw(chart) {
    const lines = chart?.config?.options?.plugins?.horizontalLines?.lines;
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
      if (!Number.isFinite(yPixel)) return;

      ctx.beginPath();
      ctx.moveTo(left, yPixel);
      ctx.lineTo(right, yPixel);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = line.color ?? 'rgba(148, 163, 184, 0.7)';
      ctx.setLineDash(line.dash ?? [6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (line.label) {
        ctx.font = '12px "Inter", "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = line.color ?? '#475569';
        ctx.fillText(line.label, left + 8, yPixel - 6);
      }
    });

    ctx.restore();
  }
};

export function buildSmsDisponibilidadPistasChartConfig(model) {
  const labels = model?.chartLabels ?? [];

  const runwayDatasets = (model?.chartRunwaySeries ?? []).map((series, index) => {
    const palette = RUNWAY_DATASET_STYLES[index % RUNWAY_DATASET_STYLES.length];
    const label = series?.runway ? `Pista ${series.runway}` : `Pista ${index + 1}`;

    return {
      type: 'bar',
      label,
      data: Array.isArray(series?.data)
        ? series.data.map(value => (Number.isFinite(value) ? Number(value) : null))
        : [],
      backgroundColor: palette.backgroundColor,
      hoverBackgroundColor: palette.hoverBackgroundColor,
      borderColor: palette.borderColor,
      borderWidth: palette.borderWidth,
      borderRadius: 8,
      maxBarThickness: 48
    };
  });

  const datasets = runwayDatasets.length ? runwayDatasets : [
    {
      type: 'bar',
      label: 'Disponibilidad (%)',
      data: (model?.chartMonths ?? []).map(month => (Number.isFinite(month.valor) ? Number(month.valor) : null)),
      backgroundColor: RUNWAY_DATASET_STYLES[0].backgroundColor,
      hoverBackgroundColor: RUNWAY_DATASET_STYLES[0].hoverBackgroundColor,
      borderColor: RUNWAY_DATASET_STYLES[0].borderColor,
      borderWidth: RUNWAY_DATASET_STYLES[0].borderWidth,
      borderRadius: 8,
      maxBarThickness: 48
    }
  ];

  if (model?.hasMetaMensual) {
    datasets.push({
      type: 'line',
      label: 'Meta mensual',
      data: Array.isArray(model?.chartMetaSeries)
        ? model.chartMetaSeries.map(value => (Number.isFinite(value) ? Number(value) : null))
        : [],
      ...META_DATASET_STYLE,
      fill: false
    });
  }

  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true }
        },
        y: {
          beginAtZero: true,
          max: 105,
          ticks: {
            callback(value) {
              return `${value}%`;
            }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 16
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.parsed.y);
              if (Number.isNaN(value)) {
                return context.dataset.label;
              }

              return `${context.dataset.label}: ${value.toFixed(2)}%`;
            }
          }
        },
        horizontalLines: {
          lines: ALERT_LINE_CONFIGS
        }
      }
    },
    plugins: [smsDisponibilidadHorizontalLinesPlugin]
  };
}

