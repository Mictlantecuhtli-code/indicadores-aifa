import { buildIndicatorModalHeader } from './sharedIndicatorHeader.js';

export const SMS_CAPACITACIONES_MODAL_ID = 'modal-sms-capacitaciones';

const INDICATOR_METADATA = {
  breadcrumb: 'Indicador SMS / Objetivo 4 / Indicador 4.1',
  nombre: 'Porcentaje de Capacitaciones Realizadas al Año',
  clave: 'SMS-08',
  uuid: 'b393fa66-5c97-44fc-b818-cabeafce9063',
  descripcion: 'Capacitar al menos al 95% del personal del AIFA en materia de seguridad operacional.',
  area: 'SMS (Seguridad Operacional)',
  areaUuid: 'fa47f802-68fc-40a6-bdab-135f34d24337',
  unidadMedida: 'Porcentaje',
  frecuencia: 'Mensual',
  metaAnual: 95
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

const COLOR_PALETTE = [
  '#2563eb',
  '#f97316',
  '#22c55e',
  '#ec4899',
  '#14b8a6',
  '#a855f7',
  '#f59e0b',
  '#0ea5e9',
  '#6366f1',
  '#f43f5e',
  '#10b981',
  '#94a3b8'
];

const BAR_BACKGROUND_ALPHA = 0.85; // 15% de transparencia

const smsCapacitacionesTotalsPlugin = {
  id: 'smsCapacitacionesTotals',
  afterDatasetsDraw(chart) {
    const pluginOptions = chart?.options?.plugins?.smsCapacitacionesTotals;
    const totals = pluginOptions?.totals;

    if (!Array.isArray(totals) || !totals.length) {
      return;
    }

    const xScale = chart.scales?.x;
    const yScale = chart.scales?.y;

    if (!xScale || !yScale) {
      return;
    }

    const ctx = chart.ctx;
    const formatter = typeof pluginOptions?.formatter === 'function' ? pluginOptions.formatter : value => value;
    const fontOptions = pluginOptions?.font ?? {
      size: 12,
      family: 'Inter, "Segoe UI", system-ui, sans-serif',
      weight: '600'
    };
    const color = pluginOptions?.color ?? '#0f172a';
    const offset = Number.isFinite(pluginOptions?.offset) ? pluginOptions.offset : 8;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `${fontOptions.weight ? `${fontOptions.weight} ` : ''}${fontOptions.size}px ${fontOptions.family}`;

    totals.forEach((total, index) => {
      if (!Number.isFinite(total)) return;

      const x = xScale.getPixelForValue(index);
      const y = yScale.getPixelForValue(total);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const text = formatter(total);
      ctx.fillText(text, x, y - offset);
    });

    ctx.restore();
  }
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function buildMonthLabel(mes, anio) {
  const month = MONTHS.find(item => item.value === mes);
  const monthLabel = month ? month.label : `Mes ${mes}`;
  return `${monthLabel} ${anio}`;
}

function hexToRgba(hex, alpha = 1) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  if (Number.isNaN(bigint)) {
    return hex;
  }

  let r = 0;
  let g = 0;
  let b = 0;

  if (normalized.length === 3) {
    r = (bigint >> 8) & 0xf;
    g = (bigint >> 4) & 0xf;
    b = bigint & 0xf;
    r = (r << 4) | r;
    g = (g << 4) | g;
    b = (b << 4) | b;
  } else if (normalized.length === 6) {
    r = (bigint >> 16) & 0xff;
    g = (bigint >> 8) & 0xff;
    b = bigint & 0xff;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildAreaColors(areas) {
  return new Map(
    areas.map((area, index) => [area, COLOR_PALETTE[index % COLOR_PALETTE.length]])
  );
}

function buildAreasLegend(model) {
  if (!model?.areas?.length) {
    return '';
  }

  return model.areas
    .map(area => {
      const baseColor = model.areaColors.get(area) ?? '#2563eb';
      return `
        <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
          <span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: ${hexToRgba(baseColor, BAR_BACKGROUND_ALPHA)}; border: 1px solid ${baseColor}"></span>
          ${escapeHtml(area)}
        </span>
      `;
    })
    .join('');
}

export function buildSmsCapacitacionesModalMarkup(indicatorName, indicatorSubtitle) {
  const headerMarkup = buildIndicatorModalHeader({
    breadcrumb: INDICATOR_METADATA.breadcrumb,
    title: indicatorName || INDICATOR_METADATA.nombre,
    subtitle: indicatorSubtitle || INDICATOR_METADATA.descripcion,
    titleId: 'modal-sms-capacitaciones-title',
    subtitleId: 'modal-sms-capacitaciones-description',
    infoItems: [
      { label: 'Área responsable', value: INDICATOR_METADATA.area },
      { label: 'Unidad de medida', value: INDICATOR_METADATA.unidadMedida },
      { label: 'Frecuencia', value: INDICATOR_METADATA.frecuencia }
    ],
    highlight: {
      label: 'Meta anual',
      value: formatPercentage(INDICATOR_METADATA.metaAnual),
      description: 'Porcentaje mínimo de personal del AIFA que debe ser capacitado cada año.'
    },
    extraContent: `
      <div class="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
          <p class="font-semibold uppercase tracking-wide text-slate-500">Clave</p>
          <p class="mt-1 font-mono text-sm text-slate-700">${escapeHtml(INDICATOR_METADATA.clave)}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
          <p class="font-semibold uppercase tracking-wide text-slate-500">UUID</p>
          <p class="mt-1 break-all font-mono text-[11px] text-slate-700">${escapeHtml(INDICATOR_METADATA.uuid)}</p>
        </div>
      </div>
    `
  });

  return `
    <div
      id="${SMS_CAPACITACIONES_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[92vh] md:rounded-2xl"
        data-modal-content
        role="dialog"
        aria-labelledby="modal-sms-capacitaciones-title"
        aria-describedby="modal-sms-capacitaciones-description"
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

export function prepareSmsCapacitacionesModel(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const parsedRows = safeRows
    .map(row => ({
      anio: row?.anio != null ? Number(row.anio) : null,
      mes: row?.mes != null ? Number(row.mes) : null,
      area: row?.area ? row.area.toString().trim() : 'Sin área',
      nombreCurso:
        row?.nombre_curso != null && row.nombre_curso !== ''
          ? row.nombre_curso.toString().trim()
          : null,
      personalCapacitado:
        row?.personal_capacitado != null ? Number(row.personal_capacitado) : null,
      totalPersonal: row?.total_personal != null ? Number(row.total_personal) : null,
      porcentaje: row?.porcentaje != null ? Number(row.porcentaje) : null,
      promedioAreaMes:
        row?.promedio_area_mes != null ? Number(row.promedio_area_mes) : null
    }))
    .filter(row => Number.isFinite(row.anio) && Number.isFinite(row.mes));

  if (!parsedRows.length) {
    return {
      labels: [],
      months: [],
      areas: [],
      areaColors: new Map(),
      monthlyTotals: [],
      totalPersonalCapacitado: 0,
      totalPersonalProgramado: 0,
      overallPercentage: null,
      monthlyAveragePercentage: null,
      lastMonth: null,
      totalCourses: 0
    };
  }

  const monthMap = new Map();
  const areaSet = new Set();
  const courseSet = new Set();

  let totalPersonalCapacitado = 0;
  let totalPersonalProgramado = 0;

  parsedRows.forEach(row => {
    const monthKey = `${row.anio}-${String(row.mes).padStart(2, '0')}`;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        key: monthKey,
        anio: row.anio,
        mes: row.mes,
        label: buildMonthLabel(row.mes, row.anio),
        totalCapacitado: 0,
        totalPersonal: 0,
        areaAggregates: new Map()
      });
    }

    const monthEntry = monthMap.get(monthKey);

    const capacitado = Number.isFinite(row.personalCapacitado) ? row.personalCapacitado : 0;
    const total = Number.isFinite(row.totalPersonal) ? row.totalPersonal : 0;

    monthEntry.totalCapacitado += capacitado;
    monthEntry.totalPersonal += total;

    areaSet.add(row.area);
    if (row.nombreCurso) {
      courseSet.add(row.nombreCurso);
    }

    totalPersonalCapacitado += capacitado;
    totalPersonalProgramado += total;

    if (!monthEntry.areaAggregates.has(row.area)) {
      monthEntry.areaAggregates.set(row.area, {
        area: row.area,
        personalCapacitado: 0,
        totalPersonal: 0,
        porcentajeSum: 0,
        porcentajeCount: 0,
        promedioAreaMesSum: 0,
        promedioAreaMesCount: 0
      });
    }

    const areaAggregate = monthEntry.areaAggregates.get(row.area);
    areaAggregate.personalCapacitado += capacitado;
    areaAggregate.totalPersonal += total;

    if (Number.isFinite(row.porcentaje)) {
      areaAggregate.porcentajeSum += row.porcentaje;
      areaAggregate.porcentajeCount += 1;
    }

    if (Number.isFinite(row.promedioAreaMes)) {
      areaAggregate.promedioAreaMesSum += row.promedioAreaMes;
      areaAggregate.promedioAreaMesCount += 1;
    }
  });

  const months = Array.from(monthMap.values())
    .sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    })
    .map(entry => {
      const areaSummaries = Array.from(entry.areaAggregates.values()).map(areaEntry => {
        const porcentajePromedio = areaEntry.totalPersonal > 0
          ? (areaEntry.personalCapacitado / areaEntry.totalPersonal) * 100
          : areaEntry.porcentajeCount > 0
            ? areaEntry.porcentajeSum / areaEntry.porcentajeCount
            : null;

        const promedioAreaMes = areaEntry.promedioAreaMesCount > 0
          ? areaEntry.promedioAreaMesSum / areaEntry.promedioAreaMesCount
          : null;

        return {
          area: areaEntry.area,
          personalCapacitado: areaEntry.personalCapacitado,
          totalPersonal: areaEntry.totalPersonal,
          porcentaje: porcentajePromedio,
          promedioAreaMes
        };
      });

      const areaMap = new Map(areaSummaries.map(item => [item.area, item]));
      const porcentajeMes = entry.totalPersonal > 0
        ? (entry.totalCapacitado / entry.totalPersonal) * 100
        : null;

      return {
        key: entry.key,
        anio: entry.anio,
        mes: entry.mes,
        label: entry.label,
        totalCapacitado: entry.totalCapacitado,
        totalPersonal: entry.totalPersonal,
        porcentaje: porcentajeMes,
        areas: areaMap,
        areaSummaries
      };
    });

  const areas = Array.from(areaSet).sort((a, b) => a.localeCompare(b, 'es'));
  const areaColors = buildAreaColors(areas);
  const labels = months.map(month => month.label);
  const monthlyTotals = months.map(month => month.totalCapacitado);

  const monthsWithPercentage = months.filter(month => Number.isFinite(month.porcentaje));
  const monthlyAveragePercentage = monthsWithPercentage.length
    ? monthsWithPercentage.reduce((sum, month) => sum + month.porcentaje, 0) /
      monthsWithPercentage.length
    : null;

  const lastMonth = months[months.length - 1] ?? null;
  const overallPercentage = totalPersonalProgramado > 0
    ? (totalPersonalCapacitado / totalPersonalProgramado) * 100
    : null;

  return {
    labels,
    months,
    areas,
    areaColors,
    monthlyTotals,
    totalPersonalCapacitado,
    totalPersonalProgramado,
    overallPercentage,
    monthlyAveragePercentage,
    lastMonth,
    totalCourses: courseSet.size,
    metaAnual: INDICATOR_METADATA.metaAnual
  };
}

export function buildSmsCapacitacionesSummary(model) {
  if (!model?.months?.length) {
    return `
      <section class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No hay datos disponibles para mostrar el resumen del indicador.
      </section>
    `;
  }

  const cards = [
    {
      label: 'Porcentaje general',
      value: formatPercentage(model.overallPercentage),
      helperText:
        model.totalPersonalProgramado > 0
          ? `${formatNumber(model.totalPersonalCapacitado, 0)} personas capacitadas de ${formatNumber(model.totalPersonalProgramado, 0)} programadas.`
          : 'Sin registro del total de personal programado.'
    },
    {
      label: 'Promedio mensual',
      value: formatPercentage(model.monthlyAveragePercentage),
      helperText: `${model.months.length} mes${model.months.length === 1 ? '' : 'es'} con registro.`
    },
    {
      label: 'Último mes reportado',
      value: model.lastMonth ? model.lastMonth.label : '—',
      helperText: model.lastMonth ? `Avance: ${formatPercentage(model.lastMonth.porcentaje)}` : null
    },
    {
      label: 'Meta anual',
      value: formatPercentage(model.metaAnual),
      helperText: 'Objetivo mínimo de personal capacitado durante el año.'
    }
  ];

  const cardsMarkup = cards
    .map(card => `
      <div class="rounded-2xl border border-slate-200 bg-white/70 px-4 py-5 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(card.label)}</p>
        <p class="mt-2 text-2xl font-bold text-slate-900">${card.value}</p>
        ${card.helperText ? `<p class="mt-2 text-xs text-slate-500">${escapeHtml(card.helperText)}</p>` : ''}
      </div>
    `)
    .join('');

  const badges = `
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
        <i class="fa-solid fa-people-roof"></i>
        ${model.areas.length} área${model.areas.length === 1 ? '' : 's'} reportada${model.areas.length === 1 ? '' : 's'}
      </span>
      <span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        <i class="fa-solid fa-chalkboard-user"></i>
        ${model.totalCourses} curso${model.totalCourses === 1 ? '' : 's'} registrados
      </span>
    </div>
  `;

  return `
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h3 class="text-base font-semibold text-slate-900">Resumen del indicador</h3>
        <p class="mt-1 text-sm text-slate-600">Desempeño acumulado de las capacitaciones reportadas.</p>
      </header>
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        ${cardsMarkup}
      </div>
      ${badges}
    </section>
  `;
}

export function buildSmsCapacitacionesChartView(model) {
  if (!model?.months?.length) {
    return '';
  }

  return `
    <section class="space-y-5">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Capacitaciones SMS</h3>
          <p class="mt-1 text-sm text-slate-600">Personal capacitado por mes agrupado por área responsable.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${buildAreasLegend(model)}
        </div>
      </header>
      <div class="relative h-[420px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <canvas
          data-sms-capacitaciones-chart
          aria-label="Gráfica de personal capacitado por área"
          role="img"
        ></canvas>
      </div>
    </section>
  `;
}

export function buildSmsCapacitacionesChartConfig(model) {
  const datasets = model.areas.map(area => {
    const baseColor = model.areaColors.get(area) ?? '#2563eb';
    return {
      type: 'bar',
      label: area,
      data: model.months.map(month => {
        const areaData = month.areas.get(area);
        return areaData?.personalCapacitado ?? 0;
      }),
      backgroundColor: hexToRgba(baseColor, BAR_BACKGROUND_ALPHA),
      borderColor: baseColor,
      borderWidth: 1,
      borderRadius: 8,
      maxBarThickness: 64,
      stack: 'capacitaciones'
    };
  });

  const maxTotal = Math.max(...model.monthlyTotals, 0);

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
          top: 24,
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
              const datasetLabel = context.dataset?.label ?? '';
              const value = context.parsed?.y ?? 0;
              const month = model.months[context.dataIndex];
              const areaData = month?.areas?.get(datasetLabel);
              const total = areaData?.totalPersonal ?? 0;
              const percentage = areaData?.porcentaje;
              return `${datasetLabel}: ${formatNumber(value, 0)} capacitados` +
                (Number.isFinite(total) && total > 0
                  ? ` de ${formatNumber(total, 0)} (${formatPercentage(percentage)})`
                  : '');
            },
            footer(items) {
              const first = items?.[0];
              if (!first) return '';
              const month = model.months[first.dataIndex];
              if (!month) return '';
              const porcentaje = formatPercentage(month.porcentaje);
              return `Total mensual: ${formatNumber(month.totalCapacitado, 0)} (${porcentaje})`;
            }
          }
        },
        smsCapacitacionesTotals: {
          totals: model.monthlyTotals,
          formatter: value => formatNumber(value, 0),
          color: '#0f172a',
          font: {
            size: 12,
            family: 'Inter, "Segoe UI", system-ui, sans-serif',
            weight: '600'
          },
          offset: 10
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
          suggestedMax: Number.isFinite(maxTotal) && maxTotal > 0 ? maxTotal * 1.15 : undefined,
          ticks: {
            color: '#475569',
            callback: value => formatNumber(value, 0)
          },
          title: {
            display: true,
            text: 'Personal capacitado',
            color: '#1f2937',
            font: {
              family: 'Inter, "Segoe UI", system-ui, sans-serif',
              weight: '600'
            }
          }
        }
      }
    },
    plugins: [smsCapacitacionesTotalsPlugin]
  };
}

export function buildSmsCapacitacionesDetailTable(model) {
  if (!model?.months?.length) {
    return '';
  }

  const bodyRows = model.months
    .map(month => {
      const areaRows = Array.from(month.areas.values()).sort((a, b) => a.area.localeCompare(b.area, 'es'));
      const rowspan = Math.max(areaRows.length, 1);

      if (!areaRows.length) {
        return `
          <tr class="border-t border-slate-200">
            <th scope="rowgroup" class="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900">${escapeHtml(month.label)}</th>
            <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700" colspan="4">Sin áreas registradas</td>
            <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">${formatPercentage(month.porcentaje)}</td>
          </tr>
        `;
      }

      return areaRows
        .map((areaData, index) => {
          const monthCell = index === 0
            ? `<th scope="rowgroup" class="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900" rowspan="${rowspan}">${escapeHtml(month.label)}</th>`
            : '';

          const porcentajeMesCell = index === 0
            ? `<td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900" rowspan="${rowspan}">${formatPercentage(month.porcentaje)}</td>`
            : '';

          return `
            <tr class="border-t border-slate-200">
              ${monthCell}
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${escapeHtml(areaData.area)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">${formatNumber(areaData.personalCapacitado, 0)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">${formatNumber(areaData.totalPersonal, 0)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">${formatPercentage(areaData.porcentaje)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">${formatPercentage(areaData.promedioAreaMes)}</td>
              ${porcentajeMesCell}
            </tr>
          `;
        })
        .join('');
    })
    .join('');

  return `
    <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header class="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 class="text-base font-semibold text-slate-900">Detalle mensual por área</h3>
        <p class="mt-1 text-sm text-slate-600">Resultados reportados de personal capacitado y porcentajes por área.</p>
      </header>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mes</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Área</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Personal capacitado</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Personal total</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Avance del área</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio mensual del área</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Avance general del mes</th>
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
