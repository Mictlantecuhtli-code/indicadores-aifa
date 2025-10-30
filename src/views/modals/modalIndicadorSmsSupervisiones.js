import { buildIndicatorModalHeader } from './sharedIndicatorHeader.js';

export const SMS_SUPERVISIONES_MODAL_ID = 'modal-sms-supervisiones';

const INDICATOR_METADATA = {
  breadcrumb: 'Indicador SMS / Objetivo 4 / Indicador 4.2',
  nombre: 'Porcentaje de Supervisiones Realizadas al Año',
  clave: 'SMS-09',
  uuid: '68f3993d-43fa-4f4e-ac6c-7b96ae6d4e5f',
  descripcion: 'Realizar 5 supervisiones anuales en materia de seguridad operacional.',
  area: 'SMS (Seguridad Operacional)',
  areaUuid: 'fa47f802-68fc-40a6-bdab-135f34d24337',
  unidadMedida: 'Porcentaje',
  frecuencia: 'Mensual',
  metaAnual: 100
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

const STATUS_BAR_ALPHA = 0.85; // 15% de transparencia

const STATUS_CONFIGS = {
  realizada: { label: 'Realizada', baseColor: '#2563eb' },
  completada: { label: 'Realizada', baseColor: '#2563eb' },
  pendiente: { label: 'Pendiente', baseColor: '#f59e0b' },
  programada: { label: 'Programada', baseColor: '#0ea5e9' },
  en_proceso: { label: 'En proceso', baseColor: '#14b8a6' },
  reprogramada: { label: 'Reprogramada', baseColor: '#8b5cf6' },
  cancelada: { label: 'Cancelada', baseColor: '#ef4444' }
};

const DEFAULT_STATUS_CONFIG = {
  label: 'Sin estatus',
  backgroundColor: 'rgba(148, 163, 184, 0.35)',
  borderColor: 'rgba(100, 116, 139, 0.75)'
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function formatDateLong(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(date);
}

function formatDateMedium(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

function buildMonthLabel(mes, anio) {
  const monthInfo = MONTHS.find(month => month.value === mes);
  const label = monthInfo ? monthInfo.label : `Mes ${mes}`;
  return anio ? `${label} ${anio}` : label;
}

function normalizeStatusKey(value) {
  if (!value) return 'sin_estatus';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    || 'sin_estatus';
}

function hexToRgba(hex, alpha = 1) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return hex;
  }

  let r = 0;
  let g = 0;
  let b = 0;

  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else {
    r = parseInt(normalized.substring(0, 2), 16);
    g = parseInt(normalized.substring(2, 4), 16);
    b = parseInt(normalized.substring(4, 6), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getStatusVisual(statusKey, fallbackLabel = '') {
  const key = statusKey || 'sin_estatus';
  const baseConfig = STATUS_CONFIGS[key];
  if (baseConfig) {
    return {
      key,
      label: baseConfig.label,
      backgroundColor: hexToRgba(baseConfig.baseColor, STATUS_BAR_ALPHA),
      borderColor: baseConfig.baseColor
    };
  }

  return {
    key,
    label: fallbackLabel?.trim() || DEFAULT_STATUS_CONFIG.label,
    backgroundColor: DEFAULT_STATUS_CONFIG.backgroundColor,
    borderColor: DEFAULT_STATUS_CONFIG.borderColor
  };
}

function buildStatusLegend(statuses) {
  if (!Array.isArray(statuses) || !statuses.length) {
    return '';
  }

  return statuses
    .map(status => {
      const countLabel = status.count === 1 ? 'registro' : 'registros';
      return `
        <span
          class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
          title="${escapeHtml(`${status.count} ${countLabel}`)}"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm"
            style="background-color: ${status.backgroundColor}; border: 1px solid ${status.borderColor};"
          ></span>
          ${escapeHtml(status.label)}
        </span>
      `;
    })
    .join('');
}

function buildTimelineCell(records) {
  if (!Array.isArray(records) || !records.length) {
    return `
      <td class="rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-slate-300">
        —
      </td>
    `;
  }

  const itemsMarkup = records
    .map(record => {
      const tooltipParts = [
        record.estatus ? `Estatus: ${record.estatus}` : null,
        record.rango_fechas ? `Periodo: ${record.rango_fechas}` : null,
        Number.isFinite(record.porcentaje)
          ? `Avance: ${formatPercentage(record.porcentaje)}`
          : null
      ].filter(Boolean);

      const tooltip = tooltipParts.join(' • ');
      const percentageMarkup = Number.isFinite(record.porcentaje)
        ? `<span class="block text-[11px] font-medium text-slate-600">${formatPercentage(record.porcentaje)}</span>`
        : '';

      return `
        <div class="flex w-full flex-col items-center gap-1" title="${escapeHtml(tooltip)}">
          <span
            class="block h-3 w-full rounded-full border"
            style="background-color: ${record.statusVisual.backgroundColor}; border-color: ${record.statusVisual.borderColor};"
            aria-label="${escapeHtml(tooltip || record.estatus || 'Avance de supervisión')}"
          ></span>
          ${percentageMarkup}
        </div>
      `;
    })
    .join('');

  return `
    <td class="rounded-lg bg-white px-3 py-2 align-middle">
      <div class="flex flex-col items-center gap-2">
        ${itemsMarkup}
      </div>
    </td>
  `;
}

function buildTimelineRow(areaData) {
  const monthCells = areaData.months.map(month => buildTimelineCell(month.records)).join('');

  return `
    <tr>
      <th scope="row" class="whitespace-nowrap rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700">
        ${escapeHtml(areaData.area)}
      </th>
      ${monthCells}
    </tr>
  `;
}

function buildTimelineTable(yearModel) {
  const monthHeaders = MONTHS.map(month => `
    <th
      scope="col"
      class="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
    >
      ${escapeHtml(month.label.substring(0, 3))}
    </th>
  `).join('');

  const bodyRows = yearModel.areas.map(area => buildTimelineRow(area)).join('');

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full border-separate border-spacing-x-0 border-spacing-y-2">
        <thead>
          <tr>
            <th
              scope="col"
              class="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
            >
              Área
            </th>
            ${monthHeaders}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  `;
}

function buildTimelineSection(yearModel, statuses) {
  const legendMarkup = buildStatusLegend(statuses);
  const tableMarkup = yearModel.areas.length
    ? buildTimelineTable(yearModel)
    : `
        <div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No hay supervisiones registradas para ${escapeHtml(yearModel.year)}.
        </div>
      `;

  return `
    <section class="space-y-5">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Cronograma ${escapeHtml(yearModel.year)}</h3>
          <p class="mt-1 text-sm text-slate-600">Avance mensual de las supervisiones programadas.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${legendMarkup}
        </div>
      </header>
      ${tableMarkup}
    </section>
  `;
}

export function prepareSmsSupervisionesModel(records) {
  const sanitizedRecords = Array.isArray(records)
    ? records
        .map(record => {
          const year = Number.parseInt(record.anio, 10);
          const month = Number.parseInt(record.mes, 10);
          if (!Number.isFinite(year) || !Number.isFinite(month)) {
            return null;
          }

          const area = (record.area ?? 'Área no especificada').toString().trim() || 'Área no especificada';
          const porcentaje = record.porcentaje !== null && record.porcentaje !== undefined
            ? Number(record.porcentaje)
            : null;
          const startDate = record.fecha_inicio ? new Date(record.fecha_inicio) : null;
          const endDate = record.fecha_fin ? new Date(record.fecha_fin) : null;
          const statusText = (record.estatus ?? '').toString().trim();
          const statusKey = normalizeStatusKey(statusText);
          const statusVisual = getStatusVisual(statusKey, statusText);

          return {
            anio: year,
            mes: month,
            area,
            estatus: statusText || statusVisual.label,
            statusKey,
            statusVisual,
            rango_fechas: (record.rango_fechas ?? '').toString().trim(),
            fecha_inicio: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
            fecha_fin: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
            porcentaje: Number.isFinite(porcentaje) ? porcentaje : null
          };
        })
        .filter(Boolean)
    : [];

  const sortedRecords = sanitizedRecords
    .slice()
    .sort((a, b) =>
      a.anio - b.anio ||
      a.mes - b.mes ||
      a.area.localeCompare(b.area, 'es', { sensitivity: 'base' })
    );

  const yearMap = new Map();
  const statusUsage = new Map();

  sortedRecords.forEach(record => {
    if (!yearMap.has(record.anio)) {
      yearMap.set(record.anio, new Map());
    }

    const areaMap = yearMap.get(record.anio);
    if (!areaMap.has(record.area)) {
      areaMap.set(record.area, new Map());
    }

    const monthMap = areaMap.get(record.area);
    if (!monthMap.has(record.mes)) {
      monthMap.set(record.mes, []);
    }

    monthMap.get(record.mes).push(record);

    const legendEntry = statusUsage.get(record.statusVisual.key);
    if (legendEntry) {
      legendEntry.count += 1;
    } else {
      statusUsage.set(record.statusVisual.key, {
        key: record.statusVisual.key,
        label: record.statusVisual.label,
        backgroundColor: record.statusVisual.backgroundColor,
        borderColor: record.statusVisual.borderColor,
        count: 1
      });
    }
  });

  const timeline = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, areaMap]) => {
      const areas = Array.from(areaMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
        .map(([area, monthMap]) => ({
          area,
          months: MONTHS.map(month => ({
            month: month.value,
            label: month.label,
            records: (monthMap.get(month.value) ?? [])
              .slice()
              .sort((a, b) => {
                const startComparison = (a.fecha_inicio?.getTime() ?? 0) - (b.fecha_inicio?.getTime() ?? 0);
                if (startComparison !== 0) return startComparison;
                return a.statusKey.localeCompare(b.statusKey);
              })
          }))
        }));

      return { year, areas };
    });

  const percentageValues = sortedRecords
    .map(record => record.porcentaje)
    .filter(value => Number.isFinite(value));

  const averagePercentage = percentageValues.length
    ? percentageValues.reduce((sum, value) => sum + value, 0) / percentageValues.length
    : null;

  const lastRecord = sortedRecords[sortedRecords.length - 1] ?? null;
  const lastMonthLabel = lastRecord ? buildMonthLabel(lastRecord.mes, lastRecord.anio) : null;
  const latestUpdate = sortedRecords.reduce((latest, record) => {
    const candidate = record.fecha_fin ?? record.fecha_inicio;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return candidate > latest ? candidate : latest;
  }, null);

  const uniqueYears = new Set(sortedRecords.map(record => record.anio));
  const uniquePeriods = new Set(sortedRecords.map(record => `${record.anio}-${String(record.mes).padStart(2, '0')}`));

  return {
    records: sortedRecords,
    timeline,
    statuses: Array.from(statusUsage.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    averagePercentage,
    lastRecord,
    lastMonthLabel,
    lastStatus: lastRecord?.estatus ?? null,
    lastRange: lastRecord?.rango_fechas ?? null,
    latestUpdate,
    totalSupervisiones: sortedRecords.length,
    yearCount: uniqueYears.size,
    periodCount: uniquePeriods.size,
    metaAnual: INDICATOR_METADATA.metaAnual
  };
}

export function buildSmsSupervisionesSummary(model) {
  if (!model?.records?.length) {
    return `
      <section class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No hay datos disponibles para mostrar el resumen del indicador.
      </section>
    `;
  }

  const cards = [
    {
      label: 'Promedio de cumplimiento',
      value: formatPercentage(model.averagePercentage),
      helperText: model.periodCount
        ? `${model.periodCount} periodo${model.periodCount === 1 ? '' : 's'} con medición registrada.`
        : null
    },
    {
      label: 'Total de supervisiones',
      value: formatNumber(model.totalSupervisiones, 0),
      helperText: `${model.yearCount} año${model.yearCount === 1 ? '' : 's'} con información.`
    }
  ];

  const cardsMarkup = cards
    .map(card => `
      <div class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(card.label)}</p>
        <p class="mt-2 text-2xl font-bold text-slate-900">${card.value}</p>
        ${card.helperText ? `<p class="mt-2 text-xs text-slate-500">${escapeHtml(card.helperText)}</p>` : ''}
      </div>
    `)
    .join('');

  return `
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h3 class="text-base font-semibold text-slate-900">Resumen del indicador</h3>
        <p class="mt-1 text-sm text-slate-600">Comportamiento general de las supervisiones registradas.</p>
      </header>
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        ${cardsMarkup}
      </div>
    </section>
  `;
}

export function buildSmsSupervisionesTimelineView(model) {
  if (!model?.timeline?.length) {
    return '';
  }

  const sectionsMarkup = model.timeline.map(yearModel => buildTimelineSection(yearModel, model.statuses)).join('');

  return `
    <section class="space-y-8">
      ${sectionsMarkup}
    </section>
  `;
}

export function buildSmsSupervisionesDetailTable(model) {
  if (!model?.records?.length) {
    return '';
  }

  const rowsMarkup = model.records
    .map(record => `
      <tr class="odd:bg-white even:bg-slate-50">
        <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-700">${record.anio}</td>
        <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-700">${escapeHtml(buildMonthLabel(record.mes, ''))}</td>
        <td class="px-3 py-2 text-sm text-slate-700">${escapeHtml(record.area)}</td>
        <td class="px-3 py-2 text-sm font-medium text-slate-700">${escapeHtml(record.estatus)}</td>
        <td class="px-3 py-2 text-sm text-slate-600">${escapeHtml(record.rango_fechas || '—')}</td>
        <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600">${formatDateMedium(record.fecha_inicio)}</td>
        <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600">${formatDateMedium(record.fecha_fin)}</td>
        <td class="whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-800">${formatPercentage(record.porcentaje)}</td>
      </tr>
    `)
    .join('');

  return `
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h3 class="text-base font-semibold text-slate-900">Detalle de supervisiones</h3>
        <p class="mt-1 text-sm text-slate-600">Listado completo de los registros reportados en la vista <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">v_supervisiones_sms</code>.</p>
      </header>
      <div class="mt-5 overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th class="px-3 py-2">Año</th>
              <th class="px-3 py-2">Mes</th>
              <th class="px-3 py-2">Área</th>
              <th class="px-3 py-2">Estatus</th>
              <th class="px-3 py-2">Rango de fechas</th>
              <th class="px-3 py-2">Fecha de inicio</th>
              <th class="px-3 py-2">Fecha de fin</th>
              <th class="px-3 py-2">Porcentaje</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rowsMarkup}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function buildSmsSupervisionesModalMarkup(indicatorName, indicatorSubtitle) {
  const headerMarkup = buildIndicatorModalHeader({
    breadcrumb: INDICATOR_METADATA.breadcrumb,
    title: indicatorName || INDICATOR_METADATA.nombre,
    subtitle: indicatorSubtitle || INDICATOR_METADATA.descripcion,
    titleId: 'modal-sms-supervisiones-title',
    subtitleId: 'modal-sms-supervisiones-description',
    infoItems: [
      { label: 'Área responsable', value: INDICATOR_METADATA.area },
      { label: 'Unidad de medida', value: INDICATOR_METADATA.unidadMedida },
      { label: 'Frecuencia', value: INDICATOR_METADATA.frecuencia }
    ],
    highlight: {
      label: 'Meta anual',
      value: formatPercentage(INDICATOR_METADATA.metaAnual),
      description: 'Porcentaje mínimo de supervisiones programadas ejecutadas.'
    },
    extraContent: ''
  });

  return `
    <div
      id="${SMS_SUPERVISIONES_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-sms-supervisiones-title"
        aria-describedby="modal-sms-supervisiones-description"
        class="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
      >
        ${headerMarkup}
        <div class="flex-1 overflow-y-auto bg-slate-50/60 px-6 py-8" data-modal-body></div>
      </div>
    </div>
  `;
}
