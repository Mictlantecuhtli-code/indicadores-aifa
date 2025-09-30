import { getAreas } from '../services/supabaseClient.js';
import { renderError, renderLoading } from '../ui/feedback.js';

const OPTION_BLUEPRINTS = [
  {
    id: 'monthly-yoy',
    type: 'monthly',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'quarterly-yoy',
    type: 'quarterly',
    buildLabel: entity =>
      `Cantidad de ${entity} real trimestral del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'annual-yoy',
    type: 'annual',
    buildLabel: entity =>
      `Cantidad de ${entity} real anual del año en curso respecto al mismo periodo del año anterior`
  },
  {
    id: 'scenario-low',
    type: 'scenario',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Bajo`
  },
  {
    id: 'scenario-mid',
    type: 'scenario',
    buildLabel: entity =>
      `Cantidad de ${entity} real mensual del año en curso respecto a la proyección de meta escenario Mediano`
  },
  {
    id: 'scenario-high',
    type: 'scenario',
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

const GROUP_ICON_CLASSES = {
  operations: 'fa-solid fa-plane-up',
  passengers: 'fa-solid fa-users-between-lines',
  'cargo-operations': 'fa-solid fa-boxes-stacked',
  'cargo-weight': 'fa-solid fa-weight-hanging',
  'fbo-operations': 'fa-solid fa-plane',
  'fbo-passengers': 'fa-solid fa-user-group'
};

const GROUP_METADATA = {
  operations: {
    key: 'operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    iconKey: 'operations',
    prefix: 'Aviación Comercial',
    baseKey: 'commercial',
    multiplier: 1,
    metaMultiplier: 1
  },
  passengers: {
    key: 'passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    iconKey: 'passengers',
    prefix: 'Aviación Comercial',
    baseKey: 'commercial',
    multiplier: 1.75,
    metaMultiplier: 1.75
  },
  'cargo-operations': {
    key: 'cargo-operations',
    title: 'Carga Operaciones',
    entity: 'Carga Operaciones',
    iconKey: 'cargo-operations',
    prefix: 'Aviación Comercial',
    baseKey: 'commercial',
    multiplier: 0.42,
    metaMultiplier: 0.42
  },
  'cargo-weight': {
    key: 'cargo-weight',
    title: 'Carga Toneladas',
    entity: 'Carga Toneladas',
    iconKey: 'cargo-weight',
    prefix: 'Aviación Comercial',
    baseKey: 'commercial',
    multiplier: 0.18,
    metaMultiplier: 0.2
  },
  'fbo-operations': {
    key: 'fbo-operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    iconKey: 'fbo-operations',
    prefix: 'Aviación General',
    baseKey: 'fbo',
    multiplier: 0.65,
    metaMultiplier: 0.65
  },
  'fbo-passengers': {
    key: 'fbo-passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    iconKey: 'fbo-passengers',
    prefix: 'Aviación General',
    baseKey: 'fbo',
    multiplier: 0.55,
    metaMultiplier: 0.55
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

const MONTH_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const BASE_SERIES_2025 = [4300, 4325, 4340, 4380, 4405, 4420, 4430, 4500, 4525, 4550, 4580, 4600];
const BASE_SERIES_2024 = [4100, 4115, 4130, 4160, 4185, 4200, 4230, 4749, 4280, 4300, 4320, 4350];
const BASE_META_LOW = [4100, 4120, 4140, 4160, 4180, 4200, 4220, 4167, 4180, 4200, 4220, 4240];
const BASE_META_MID = [5000, 5025, 5050, 5075, 5100, 5125, 5150, 5209, 5225, 5250, 5275, 5300];
const BASE_META_HIGH = [10000, 10040, 10080, 10120, 10160, 10200, 10240, 10158, 10190, 10220, 10250, 10280];

const BASE_COMMERCIAL_DATA = {
  'monthly-yoy': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'yoy',
      title: 'Último Mes con Datos - Comparación 2025 vs 2024',
      currentLabel: '2025',
      comparisonLabel: '2024',
      rows: [{ period: 'Agosto 2025', current: 4500, comparison: 4749 }]
    },
    chart: {
      title: 'Gráfica Comparativa Mensual',
      toggleLabel: 'Mostrar últimos 4 años',
      labels: MONTH_LABELS,
      series: [
        { name: '2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        { name: '2024', role: 'comparison', color: '#16a34a', values: BASE_SERIES_2024 }
      ]
    }
  },
  'quarterly-yoy': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'yoy',
      title: 'Comparación Trimestral 2025 vs 2024',
      currentLabel: '2025',
      comparisonLabel: '2024',
      rows: [
        { period: 'Trimestre 1', current: 12900, comparison: 9971 },
        { period: 'Trimestre 2', current: 13147, comparison: 12300 }
      ]
    },
    chart: {
      title: 'Gráfica Comparativa Mensual',
      toggleLabel: 'Mostrar últimos 4 años',
      labels: MONTH_LABELS,
      series: [
        { name: '2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        { name: '2024', role: 'comparison', color: '#16a34a', values: BASE_SERIES_2024 }
      ]
    }
  },
  'annual-yoy': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'yoy',
      title: 'Comparación Anual 2025 vs 2024',
      currentLabel: '2025',
      comparisonLabel: '2024',
      rows: [{ period: 'Año 2025', current: 35007, comparison: 32650 }]
    },
    chart: {
      title: 'Gráfica Comparativa Mensual',
      toggleLabel: 'Mostrar últimos 4 años',
      labels: MONTH_LABELS,
      series: [
        { name: '2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        { name: '2024', role: 'comparison', color: '#16a34a', values: BASE_SERIES_2024 }
      ]
    }
  },
  'scenario-low': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'scenario',
      title: 'Comparativo Real vs Meta - Escenario Bajo',
      currentLabel: 'Real',
      metaLabel: 'Meta',
      rows: [{ period: 'Agosto 2025', current: 4500, meta: 4167 }]
    },
    chart: {
      titleTemplate: '{prefix} {entity} - Real vs Meta',
      labels: MONTH_LABELS,
      series: [
        { name: 'Real 2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        {
          name: 'Meta Escenario Bajo',
          role: 'meta',
          color: '#ef4444',
          dashed: true,
          values: BASE_META_LOW
        }
      ]
    }
  },
  'scenario-mid': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'scenario',
      title: 'Comparativo Real vs Meta - Escenario Mediano',
      currentLabel: 'Real',
      metaLabel: 'Meta',
      rows: [{ period: 'Agosto 2025', current: 4500, meta: 5209 }]
    },
    chart: {
      titleTemplate: '{prefix} {entity} - Real vs Meta',
      labels: MONTH_LABELS,
      series: [
        { name: 'Real 2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        {
          name: 'Meta Escenario Mediano',
          role: 'meta',
          color: '#f59e0b',
          dashed: true,
          values: BASE_META_MID
        }
      ]
    }
  },
  'scenario-high': {
    lastUpdate: 'Agosto 2025',
    table: {
      type: 'scenario',
      title: 'Comparativo Real vs Meta - Escenario Alto',
      currentLabel: 'Real',
      metaLabel: 'Meta',
      rows: [{ period: 'Agosto 2025', current: 4500, meta: 10158 }]
    },
    chart: {
      titleTemplate: '{prefix} {entity} - Real vs Meta',
      labels: MONTH_LABELS,
      series: [
        { name: 'Real 2025', role: 'current', color: '#2563eb', values: BASE_SERIES_2025 },
        {
          name: 'Meta Escenario Alto',
          role: 'meta',
          color: '#22c55e',
          dashed: true,
          values: BASE_META_HIGH
        }
      ]
    }
  }
};

const BASE_INDICATOR_DATA = {
  commercial: BASE_COMMERCIAL_DATA,
  fbo: BASE_COMMERCIAL_DATA
};

const OPTION_BLUEPRINT_MAP = new Map(OPTION_BLUEPRINTS.map(blueprint => [blueprint.id, blueprint]));

const numberFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function cloneBaseEntry(entry) {
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function applyTemplate(template, group) {
  if (!template) return '';
  return template
    .replaceAll('{prefix}', group?.prefix ?? '')
    .replaceAll('{entity}', group?.entity ?? group?.title ?? '');
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return numberFormatter.format(Math.round(value));
}

function formatSignedNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${numberFormatter.format(Math.abs(Math.round(value)))}`;
}

function formatSignedPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${percentFormatter.format(Math.abs(value))}%`;
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${percentFormatter.format(value)}%`;
}

function trendClass(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) {
    return 'text-slate-600';
  }
  return value > 0 ? 'text-emerald-600' : 'text-rose-600';
}

function instantiateIndicatorData(baseKey, optionId, group) {
  const family = BASE_INDICATOR_DATA[baseKey] ?? BASE_INDICATOR_DATA.commercial;
  const base = cloneBaseEntry(family?.[optionId]);
  if (!base) return null;

  const multiplier = group?.multiplier ?? 1;
  const metaMultiplier = group?.metaMultiplier ?? multiplier;

  const data = {
    title: `${group?.prefix ?? ''} ${group?.title ?? ''}`.trim(),
    lastUpdate: base.lastUpdate,
    table: null,
    chart: null
  };

  if (base.table) {
    const table = { ...base.table };
    table.rows = (base.table.rows ?? []).map(row => {
      if (table.type === 'scenario') {
        const current = Math.round((row.current ?? 0) * multiplier);
        const meta = Math.round((row.meta ?? 0) * metaMultiplier);
        return {
          period: row.period,
          current,
          meta
        };
      }
      const current = Math.round((row.current ?? 0) * multiplier);
      const comparison = Math.round((row.comparison ?? 0) * multiplier);
      return {
        period: row.period,
        current,
        comparison
      };
    });
    data.table = table;
  }

  if (base.chart) {
    const chart = { ...base.chart };
    chart.title = base.chart.titleTemplate
      ? applyTemplate(base.chart.titleTemplate, group)
      : base.chart.title;
    chart.series = (base.chart.series ?? []).map(series => {
      const scale = series.role === 'meta' ? metaMultiplier : multiplier;
      return {
        ...series,
        name: series.nameTemplate ? applyTemplate(series.nameTemplate, group) : series.name,
        values: (series.values ?? []).map(value => Math.round(value * scale))
      };
    });
    data.chart = chart;
  }

  return data;
}

function buildIndicatorOptionMarkup(sectionId, group, option) {
  const iconClass = OPTION_ICON_CLASSES[option.type] ?? 'fa-solid fa-chart-line';
  return `
    <li>
      <button
        type="button"
        class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-aifa-light hover:bg-aifa-light/10 focus:outline-none focus:ring-2 focus:ring-aifa-light focus:ring-offset-2"
        data-indicator-option
        data-section-id="${sectionId}"
        data-indicator-group="${group.key}"
        data-indicator-option-id="${option.blueprintId}"
        data-indicator-composite-id="${option.compositeId}"
        data-indicator-label="${option.label}"
      >
        <span class="mt-0.5 text-slate-500">
          <i class="${iconClass} text-sm"></i>
        </span>
        <span>${option.label}</span>
      </button>
    </li>
  `;
}

function buildIndicatorGroupMarkup(sectionId, group) {
  const iconClass = GROUP_ICON_CLASSES[group.iconKey] ?? 'fa-solid fa-chart-line';
  const optionsMarkup = OPTION_BLUEPRINTS.map(blueprint =>
    buildIndicatorOptionMarkup(sectionId, group, {
      compositeId: `${sectionId}-${group.key}-${blueprint.id}`,
      blueprintId: blueprint.id,
      label: blueprint.buildLabel(group.entity),
      type: blueprint.type
    })
  ).join('');

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-aifa-light focus:ring-offset-2"
        data-group-button
        data-group-root="${sectionId}"
        data-group-id="${sectionId}-${group.key}"
        aria-expanded="false"
      >
        <span class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <i class="${iconClass} text-base"></i>
          </span>
          <span class="text-sm font-semibold text-slate-800">${group.title}</span>
        </span>
        <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-group-chevron></i>
      </button>
      <div
        class="border-t border-slate-100 bg-slate-50/60 px-5 py-4"
        data-group-panel="${sectionId}-${group.key}"
        hidden
      >
        <ul class="space-y-2">
          ${optionsMarkup}
        </ul>
      </div>
    </div>
  `;
}

function buildIndicatorSectionContent(section) {
  const groups = (section.groupIds ?? [])
    .map(id => GROUP_METADATA[id])
    .filter(Boolean);

  if (!groups.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
        No hay opciones de indicadores configuradas.
      </div>
    `;
  }

  const groupsMarkup = groups
    .map(group => buildIndicatorGroupMarkup(section.id, group))
    .join('');

  return `<div class="space-y-3">${groupsMarkup}</div>`;
}

function buildTableMarkup(data) {
  const table = data.table;
  if (!table) {
    return `
      <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div class="px-6 py-5 text-sm text-slate-500">No hay información disponible para mostrar.</div>
      </section>
    `;
  }

  const hasRows = table.rows?.length;
  const header = `
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
      <div>
        <h3 class="text-base font-semibold text-slate-900">${table.title ?? 'Detalle'}</h3>
        ${data.lastUpdate
          ? `<p class="text-sm text-slate-500">Último mes con datos: ${data.lastUpdate}</p>`
          : ''}
      </div>
    </div>
  `;

  if (!hasRows) {
    return `
      <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
        ${header}
        <div class="px-6 py-5 text-sm text-slate-500">No se registran datos para esta selección.</div>
      </section>
    `;
  }

  const bodyRows = table.rows
    .map(row => {
      if (table.type === 'scenario') {
        const difference = row.current - row.meta;
        const compliance = row.meta ? (row.current / row.meta) * 100 : 0;
        return `
          <tr class="text-sm text-slate-700">
            <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">${row.period}</td>
            <td class="whitespace-nowrap px-4 py-3">${formatNumber(row.current)}</td>
            <td class="whitespace-nowrap px-4 py-3">${formatNumber(row.meta)}</td>
            <td class="whitespace-nowrap px-4 py-3 font-semibold ${trendClass(difference)}">${formatSignedNumber(difference)}</td>
            <td class="whitespace-nowrap px-4 py-3 font-semibold ${trendClass(compliance - 100)}">${formatPercent(compliance)}</td>
          </tr>
        `;
      }

      const difference = row.current - row.comparison;
      const variation = row.comparison ? ((row.current - row.comparison) / row.comparison) * 100 : 0;
      return `
        <tr class="text-sm text-slate-700">
          <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">${row.period}</td>
          <td class="whitespace-nowrap px-4 py-3">${formatNumber(row.current)}</td>
          <td class="whitespace-nowrap px-4 py-3">${formatNumber(row.comparison)}</td>
          <td class="whitespace-nowrap px-4 py-3 font-semibold ${trendClass(difference)}">${formatSignedNumber(difference)}</td>
          <td class="whitespace-nowrap px-4 py-3 font-semibold ${trendClass(variation)}">${formatSignedPercent(variation)}</td>
        </tr>
      `;
    })
    .join('');

  const headersMarkup =
    table.type === 'scenario'
      ? `
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${table.currentLabel ?? 'Real'}</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${table.metaLabel ?? 'Meta'}</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Diferencia</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">% Cumplimiento</th>
        `
      : `
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${table.currentLabel ?? 'Actual'}</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${table.comparisonLabel ?? 'Referencia'}</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Diferencia</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">% Variación</th>
        `;

  return `
    <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
      ${header}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100">
          <thead>
            <tr class="bg-slate-50/70 text-slate-500">${headersMarkup}</tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">${bodyRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLineChartSvg(chart) {
  const labels = chart?.labels ?? [];
  const series = chart?.series ?? [];
  const values = series.flatMap(entry => entry.values ?? []).filter(value => typeof value === 'number' && !Number.isNaN(value));
  if (!labels.length || !values.length) {
    return `<div class="px-6 py-6 text-sm text-slate-500">No hay datos para graficar.</div>`;
  }

  const width = 760;
  const height = 320;
  const padding = { top: 32, right: 36, bottom: 48, left: 72 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const margin = range === 0 ? Math.max(25, maxValue * 0.1) : range * 0.1;
  const chartMin = Math.max(0, minValue - margin);
  const chartMax = maxValue + margin;
  const chartRange = chartMax - chartMin || 1;

  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines }, (_, index) => chartMin + (chartRange / (gridLines - 1)) * index);

  const xStep = labels.length > 1 ? innerWidth / (labels.length - 1) : innerWidth;

  const gridMarkup = yTicks
    .map(value => {
      const y = padding.top + innerHeight - ((value - chartMin) / chartRange) * innerHeight;
      return `
        <g>
          <line x1="${padding.left}" y1="${y.toFixed(2)}" x2="${width - padding.right}" y2="${y.toFixed(2)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4" />
          <text x="${padding.left - 12}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="12" fill="#475569">${formatNumber(value)}</text>
        </g>
      `;
    })
    .join('');

  const xLabelsMarkup = labels
    .map((label, index) => {
      const x = padding.left + index * xStep;
      return `<text x="${x.toFixed(2)}" y="${height - 16}" text-anchor="middle" font-size="12" fill="#64748b">${label}</text>`;
    })
    .join('');

  const pathsMarkup = series
    .map(entry => {
      const points = (entry.values ?? []).map((value, index) => {
        const clamped = Math.max(chartMin, Math.min(chartMax, value));
        const x = padding.left + index * xStep;
        const y = padding.top + innerHeight - ((clamped - chartMin) / chartRange) * innerHeight;
        return { x, y };
      });

      if (!points.length) return '';

      const path = points
        .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');

      const circles = points
        .map(point => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" fill="${entry.color ?? '#2563eb'}" />`)
        .join('');

      const dash = entry.dashed ? '6 6' : 'none';

      return `
        <g>
          <path d="${path}" fill="none" stroke="${entry.color ?? '#2563eb'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash}" />
          ${entry.dashed ? '' : circles}
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="h-72 w-full" role="img">
      <g>
        ${gridMarkup}
        <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}" stroke="#cbd5f5" stroke-width="1.5" />
        ${pathsMarkup}
        ${xLabelsMarkup}
      </g>
    </svg>
  `;
}

function buildChartCardMarkup(chart) {
  if (!chart) {
    return `
      <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div class="px-6 py-5 text-sm text-slate-500">No hay datos de gráfica configurados.</div>
      </section>
    `;
  }

  const legendItems = (chart.series ?? [])
    .map(series => {
      const indicator = series.dashed
        ? `<span class="h-0 w-8 border-t-2 border-dashed" style="border-color: ${series.color ?? '#2563eb'}"></span>`
        : `<span class="h-2.5 w-2.5 rounded-full" style="background-color: ${series.color ?? '#2563eb'}"></span>`;
      return `
        <li class="flex items-center gap-2 text-sm text-slate-600">
          ${indicator}
          <span>${series.name}</span>
        </li>
      `;
    })
    .join('');

  const chartSvg = renderLineChartSvg(chart);

  return `
    <section class="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h3 class="text-base font-semibold text-slate-900">${chart.title ?? 'Gráfica comparativa'}</h3>
        </div>
        ${chart.toggleLabel
          ? `<label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-aifa-light focus:ring-aifa-light" disabled />
              ${chart.toggleLabel}
            </label>`
          : ''}
      </div>
      <div class="space-y-4 px-6 py-5">
        ${legendItems ? `<ul class="flex flex-wrap items-center gap-4">${legendItems}</ul>` : ''}
        <div class="overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-4">
          ${chartSvg}
        </div>
      </div>
    </section>
  `;
}

let activeModal = null;
let previousOverflow = '';
let keydownHandler = null;

function buildModalMarkup(data) {
  const tableMarkup = buildTableMarkup(data);
  const chartMarkup = buildChartCardMarkup(data.chart);

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6" data-indicator-modal-overlay>
      <div class="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="indicator-modal-title" tabindex="-1" data-indicator-modal-dialog>
        <header class="bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-6 text-white shadow-lg">
          <button type="button" class="inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-white" data-modal-close>
            <i class="fa-solid fa-arrow-left text-xs"></i>
            Volver al Panel de Análisis
          </button>
          <h2 id="indicator-modal-title" class="mt-4 text-2xl font-semibold text-white">${data.title}</h2>
          ${data.description ? `<p class="mt-1 text-sm text-white/80">${data.description}</p>` : ''}
          ${data.lastUpdate
            ? `<div class="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
                <span class="relative flex h-2 w-2">
                  <span class="absolute inset-0 animate-ping rounded-full bg-emerald-300/60"></span>
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"></span>
                </span>
                Último mes con datos: ${data.lastUpdate}
              </div>`
            : ''}
        </header>
        <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-slate-50 px-6 py-6">
          ${tableMarkup}
          ${chartMarkup}
        </div>
      </div>
    </div>
  `;
}

function closeIndicatorModal() {
  if (!activeModal) return;
  const modal = activeModal;
  activeModal = null;
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  document.body.style.overflow = previousOverflow;
  modal.remove();
}

function openIndicatorModal(data) {
  closeIndicatorModal();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildModalMarkup(data);
  const modal = wrapper.firstElementChild;
  if (!modal) return;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(modal);
  activeModal = modal;

  const dialog = modal.querySelector('[data-indicator-modal-dialog]');
  const closeButton = modal.querySelector('[data-modal-close]');

  if (closeButton) {
    closeButton.addEventListener('click', closeIndicatorModal);
  }

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeIndicatorModal();
    }
  });

  keydownHandler = event => {
    if (event.key === 'Escape') {
      closeIndicatorModal();
    }
  };
  document.addEventListener('keydown', keydownHandler);

  if (dialog) {
    setTimeout(() => {
      try {
        dialog.focus();
      } catch (error) {
        /* noop */
      }
    }, 0);
  }
}

function initIndicatorOptionHandlers(container) {
  container.querySelectorAll('[data-indicator-option]').forEach(button => {
    button.addEventListener('click', () => {
      const groupKey = button.dataset.indicatorGroup;
      const optionId = button.dataset.indicatorOptionId;
      const group = GROUP_METADATA[groupKey];
      if (!group || !optionId) return;

      const baseKey = group.baseKey ?? 'commercial';
      const data = instantiateIndicatorData(baseKey, optionId, group);
      const blueprint = OPTION_BLUEPRINT_MAP.get(optionId);
      const description = button.dataset.indicatorLabel ?? blueprint?.buildLabel?.(group.entity ?? group.title) ?? '';

      if (!data) {
        openIndicatorModal({
          title: `${group.prefix ?? ''} ${group.title ?? ''}`.trim() || 'Indicador',
          description,
          lastUpdate: null,
          table: null,
          chart: null
        });
        return;
      }

      data.description = description;
      openIndicatorModal(data);
    });
  });
}

function normalizeHex(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#([0-9a-fA-F]{3}){1,2}$/.test(prefixed)) return null;
  if (prefixed.length === 4) {
    return `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`;
  }
  return prefixed;
}

function buildBadgeStyle(color) {
  const normalized = normalizeHex(color) ?? '#1f2937';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.65 ? '#0f172a' : '#ffffff';
  return `background-color: ${normalized}; color: ${textColor};`;
}

function renderDirectionChildren(children) {
  if (!children?.length) return '';
  return `
    <ul class="space-y-2">
      ${children
        .map(child => {
          const badgeStyle = buildBadgeStyle(child.color_hex);
          return `
            <li class="space-y-2">
              <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <span>${child.nombre}</span>
                <span class="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold" style="${badgeStyle}">
                  ${child.clave ?? '—'}
                </span>
              </div>
              ${child.children?.length
                ? `<div class="ml-4 border-l border-slate-200 pl-4">${renderDirectionChildren(child.children)}</div>`
                : ''}
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

function buildDirectionItem(area) {
  const badgeStyle = buildBadgeStyle(area.color_hex);
  const hasChildren = area.children?.length;
  const content = `
    <div class="flex items-center gap-3">
      <span class="text-sm font-semibold text-slate-800">${area.nombre}</span>
      <span class="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold" style="${badgeStyle}">
        ${area.clave ?? '—'}
      </span>
    </div>
  `;

  if (!hasChildren) {
    return `
      <div class="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        ${content}
      </div>
    `;
  }

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-aifa-light focus:ring-offset-2"
        data-direction-button
        data-direction-id="${area.id}"
        aria-expanded="false"
      >
        ${content}
        <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-direction-chevron></i>
      </button>
      <div
        class="border-t border-slate-100 bg-slate-50/60 px-5 py-4"
        data-direction-panel="${area.id}"
        hidden
      >
        ${renderDirectionChildren(area.children)}
      </div>
    </div>
  `;
}

function buildDirectionsSection(directions) {
  if (!directions?.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
        No hay direcciones registradas.
      </div>
    `;
  }

  const items = directions.map(buildDirectionItem).join('');
  return `<div class="space-y-3" data-directions-root>${items}</div>`;
}

function buildSectionsMarkup(directionsTree) {
  return ACCORDION_SECTIONS.map(section => {
    const content =
      section.type === 'directions'
        ? buildDirectionsSection(directionsTree)
        : buildIndicatorSectionContent(section);

    return `
      <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-accordion-section="${section.id}">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-aifa-light focus:ring-offset-2"
          data-accordion-button
          data-accordion-id="${section.id}"
          aria-expanded="false"
        >
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <i class="${section.iconClass} text-lg"></i>
            </span>
            <div>
              <h2 class="text-lg font-semibold text-slate-900">${section.title}</h2>
            </div>
          </div>
          <i class="fa-solid fa-chevron-down h-5 w-5 text-slate-400 transition-transform" data-accordion-chevron></i>
        </button>
        <div class="border-t border-slate-100 bg-slate-50/60 px-6 py-5" data-accordion-panel="${section.id}" hidden>
          ${content}
        </div>
      </section>
    `;
  }).join('');
}

function buildDashboardMarkup(directionsTree) {
  const sectionsMarkup = buildSectionsMarkup(directionsTree);
  return `
    <div class="space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900">Panel directivos</h1>
        <p class="text-sm text-slate-500">
          Seleccione una categoría para explorar las opciones de indicadores y direcciones disponibles.
        </p>
      </header>
      <div class="space-y-5" data-accordion-root>
        ${sectionsMarkup}
      </div>
    </div>
  `;
}

function initAccordionControls(container) {
  const root = container.querySelector('[data-accordion-root]');
  if (!root) return;
  const buttons = Array.from(root.querySelectorAll('[data-accordion-button]'));
  if (!buttons.length) return;

  let openId = buttons[0]?.dataset.accordionId ?? null;

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

function buildAreaTree(areas) {
  const byParent = new Map();
  (areas ?? []).forEach(area => {
    const parentId = area?.parent_area_id ?? null;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId).push(area);
  });

  const sortAreas = list =>
    (list ?? [])
      .slice()
      .sort((a, b) => (a?.nombre ?? '').localeCompare(b?.nombre ?? '', 'es', { sensitivity: 'base' }));

  const buildBranch = parentId => {
    const children = sortAreas(byParent.get(parentId));
    return children.map(child => ({
      ...child,
      children: buildBranch(child.id)
    }));
  };

  return buildBranch(null);
}

export async function renderDashboard(container) {
  renderLoading(container, 'Preparando panel directivo...');
  try {
    const areas = await getAreas();
    const tree = buildAreaTree(areas);
    container.innerHTML = buildDashboardMarkup(tree);
    initAccordionControls(container);
    initGroupControls(container);
    initIndicatorOptionHandlers(container);
    initDirectionControls(container);
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}
