import {
  getDashboardSummary,
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets
} from '../services/supabaseClient.js';
import { formatNumber, formatPercentage, formatDate, monthName } from '../utils/formatters.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { renderIndicatorChart } from '../ui/charts.js';
import {
  INDICATOR_SECTIONS,
  DIRECTION_FALLBACKS,
  buildIndicatorOptions,
  normalizeText,
  buildCodeFromName
} from '../config/dashboardConfig.js';

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

function buildSummaryCards(summary) {
  if (!summary?.length) {
    return '<p class="text-sm text-slate-500">No hay datos disponibles.</p>';
  }
  const data = summary[0];
  const fields = [
    { key: 'total_indicadores', label: 'Indicadores monitoreados' },
    { key: 'indicadores_con_metas', label: 'Indicadores con metas' },
    { key: 'indicadores_sin_actualizar', label: 'Indicadores pendientes' },
    { key: 'porcentaje_cumplimiento', label: 'Cumplimiento promedio', type: 'percentage' }
  ].filter(field => field.key in data);

  if (!fields.length) {
    return '<p class="text-sm text-slate-500">No hay métricas para mostrar.</p>';
  }

  return `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${fields
        .map(field => {
          const value = data[field.key];
          const formatted =
            field.type === 'percentage'
              ? formatPercentage(value)
              : formatNumber(value, { decimals: 0 });
          return `
            <article class="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow transition hover:shadow-lg">
              <div class="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-aifa-light/10"></div>
              <div class="relative">
                <p class="text-xs uppercase tracking-widest text-slate-400">${field.label}</p>
                <p class="mt-3 text-3xl font-semibold text-slate-800">${formatted}</p>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildIndicatorCard(category, options) {
  const palette = PALETTES[category.palette] ?? PALETTES.slate;
  const iconClass = CARD_ICON_CLASSES[category.icon] ?? 'fa-solid fa-chart-line';
  const assignedCount = options.filter(option => option.indicator).length;
  const headerStatus = assignedCount
    ? `${assignedCount} opción${assignedCount === 1 ? '' : 'es'} asignada${assignedCount === 1 ? '' : 's'}`
    : 'Sin asignar';

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
            ${options
              .map(option => {
                const enabled = Boolean(option.indicator);
                const optionIcon = OPTION_ICON_CLASSES[option.icon] ?? 'fa-solid fa-chart-line';
                const idle = palette.optionIdle;
                const active = palette.optionActive;
                return `
                  <button
                    type="button"
                    class="flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      enabled ? `${idle} focus:ring-aifa-light` : 'border-dashed border-slate-200 bg-white/60 text-slate-400 cursor-not-allowed focus:ring-slate-200'
                    }"
                    data-option="${option.id}"
                    data-theme-idle="${idle}"
                    data-theme-active="${active}"
                    data-card-owner="${category.id}"
                    data-enabled="${enabled ? 'true' : 'false'}"
                    data-indicator-id="${option.indicator?.id ?? ''}"
                  >
                    <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ${
                      enabled ? palette.icon : 'text-slate-400'
                    }">
                      <i class="${optionIcon}"></i>
                    </span>
                    <div class="flex flex-1 flex-col gap-1">
                      <span class="font-medium leading-snug">${option.label}</span>
                      <span class="text-xs ${enabled ? 'text-slate-500' : 'text-slate-400'}">
                        ${enabled
                          ? `Último valor: ${formatNumber(option.indicator.ultima_medicion_valor)} ${option.indicator.unidad_medida ?? ''}`
                          : 'Sin asignar'}
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

function buildDirectionCard(direction) {
  const palette = PALETTES[direction.palette] ?? PALETTES.slate;
  return `
    <article class="overflow-hidden rounded-2xl border ${palette.border} bg-white shadow-sm" data-direction="${direction.id}">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition ${palette.background} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aifa-light"
        data-toggle-direction="${direction.id}"
        aria-expanded="false"
      >
        <div class="flex flex-1 items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow ${palette.icon}">
            <i class="fa-solid fa-users"></i>
          </span>
          <div>
            <p class="text-base font-semibold text-slate-800">${direction.name}</p>
            <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${palette.badge}">
              <span class="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">${direction.code}</span>
              ${direction.subdirections.length
                ? `${direction.subdirections.length} subdirección${direction.subdirections.length === 1 ? '' : 'es'}`
                : 'Sin subdirecciones registradas'}
            </span>
          </div>
        </div>
        <i class="fa-solid fa-chevron-down transition-transform ${palette.chevron}" data-direction-chevron="${direction.id}"></i>
      </button>
      <div class="grid transition-[grid-template-rows] duration-300 ease-in-out grid-rows-[0fr]" data-direction-body="${direction.id}">
        <div class="min-h-0 overflow-hidden border-t border-slate-100 bg-white px-5 py-4">
          ${direction.subdirections.length
            ? `<ul class="flex flex-col gap-2 text-sm text-slate-600">
                ${direction.subdirections
                  .map(sub => `
                    <li class="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2">
                      <span class="font-medium text-slate-700">${sub.name}</span>
                      ${sub.code ? `<span class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-400">${sub.code}</span>` : ''}
                    </li>
                  `)
                  .join('')}
              </ul>`
            : '<p class="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-400">No hay subdirecciones registradas en la matriz.</p>'}
        </div>
      </div>
    </article>
  `;
}

function buildHistoryTable(history = []) {
  if (!history.length) {
    return `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">No hay mediciones registradas para este indicador.</td>
      </tr>
    `;
  }

  return history
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

function toggleAccordion(id, type) {
  const attribute = type === 'card' ? 'data-card-body' : 'data-direction-body';
  const toggleAttr = type === 'card' ? 'data-toggle-card' : 'data-toggle-direction';
  const chevronAttr = type === 'card' ? 'data-chevron' : 'data-direction-chevron';

  document.querySelectorAll(`[${attribute}]`).forEach(panel => {
    const panelId = panel.getAttribute(attribute);
    const isTarget = panelId === id;
    const header = document.querySelector(`[${toggleAttr}="${panelId}"]`);
    const chevron = document.querySelector(`[${chevronAttr}="${panelId}"]`);

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
    } else if (type === 'card') {
      panel.style.gridTemplateRows = '0fr';
      panel.setAttribute('aria-hidden', 'true');
      const otherHeader = document.querySelector(`[${toggleAttr}="${panelId}"]`);
      const otherChevron = document.querySelector(`[${chevronAttr}="${panelId}"]`);
      if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
      if (otherChevron) otherChevron.classList.remove('rotate-180');
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
    const enabled = button.dataset.enabled === 'true';

    button.classList.remove(...active);
    if (enabled && idle.length) {
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
  const chartWrapper = document.querySelector('[data-indicator-chart]');
  const historyBody = document.querySelector('[data-history-body]');

  if (!indicatorId) {
    if (chartWrapper) {
      chartWrapper.innerHTML = `
        <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
          Seleccione un indicador con información disponible.
        </div>
      `;
    }
    if (historyBody) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="3" class="px-4 py-6 text-center text-slate-400">No hay información para mostrar.</td>
        </tr>
      `;
    }
    return;
  }

  if (chartWrapper) {
    chartWrapper.innerHTML = `
      <div class="flex h-72 items-center justify-center text-slate-500">
        <i class="fa-solid fa-spinner animate-spin mr-2"></i>
        Cargando histórico...
      </div>
    `;
  }

  if (historyBody) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">Cargando mediciones...</td>
      </tr>
    `;
  }

  try {
    const [history, targets] = await Promise.all([
      getIndicatorHistory(indicatorId, { limit: 36 }),
      getIndicatorTargets(indicatorId)
    ]);

    if (chartWrapper) {
      chartWrapper.innerHTML = '<canvas id="dashboard-indicator-chart" class="h-72 w-full"></canvas>';
      renderIndicatorChart('dashboard-indicator-chart', history, targets);
    }

    if (historyBody) {
      historyBody.innerHTML = buildHistoryTable(history ?? []);
    }
  } catch (error) {
    console.error(error);
    if (chartWrapper) {
      chartWrapper.innerHTML = `
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-600">
          No fue posible cargar la información histórica.
        </div>
      `;
    }
    if (historyBody) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="3" class="px-4 py-6 text-center text-red-500">Ocurrió un error al cargar las mediciones.</td>
        </tr>
      `;
    }
  }
}

function selectIndicator(optionId, indicator) {
  if (optionId && indicator) {
    updateActiveOption(optionId);
    ensureCardOpen(document.querySelector(`[data-option="${optionId}"]`)?.dataset.cardOwner ?? null);
  }

  updateIndicatorInfo(indicator ?? null);
  loadIndicatorDetails(indicator?.id ?? null);
}

function bindInteractions() {
  document.querySelectorAll('[data-toggle-card]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-toggle-card');
      if (!id) return;
      toggleAccordion(id, 'card');
    });
  });

  document.querySelectorAll('[data-toggle-direction]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-toggle-direction');
      if (!id) return;
      toggleAccordion(id, 'direction');
    });
  });

  document.querySelectorAll('[data-option]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.enabled !== 'true') return;
      const optionId = button.dataset.option;
      const indicatorId = button.dataset.indicatorId;
      if (!indicatorId) return;
      const indicator = button.__indicatorRef;
      selectIndicator(optionId, indicator);
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
    const [summary, indicators] = await Promise.all([
      getDashboardSummary(),
      getIndicators()
    ]);

    const indicatorIndex = indicators.map(record => ({
      record,
      normalizedName: normalizeText(record.nombre),
      normalizedDescription: normalizeText(record.descripcion),
      normalizedArea: normalizeText(record.area_nombre ?? record.area)
    }));

    const sections = INDICATOR_SECTIONS.map(section => ({
      ...section,
      categories: section.categories.map(category => {
        const options = buildIndicatorOptions(category).map(option => {
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
        });
        return { ...category, options };
      })
    }));

    const directionsMap = new Map();
    indicators.forEach(item => {
      const directionName = item.direccion ?? item.direccion_nombre ?? item.area_direccion;
      if (!directionName) return;
      const key = normalizeText(directionName);
      if (!directionsMap.has(key)) {
        const fallback = DIRECTION_FALLBACKS.find(dir => normalizeText(dir.name) === key);
        directionsMap.set(key, {
          id: fallback?.id ?? key,
          name: directionName,
          code: item.direccion_codigo ?? item.direccion_clave ?? fallback?.code ?? buildCodeFromName(directionName),
          palette: fallback?.palette ?? 'slate',
          subdirections: new Map()
        });
      }
      const subName = item.subdireccion ?? item.subdireccion_nombre ?? item.area_subdireccion;
      if (subName) {
        const entry = directionsMap.get(key);
        const subKey = normalizeText(subName);
        entry.subdirections.set(subKey, {
          name: subName,
          code: item.subdireccion_codigo ?? item.subdireccion_clave ?? buildCodeFromName(subName)
        });
      }
    });

    let directions = Array.from(directionsMap.values()).map(direction => ({
      ...direction,
      subdirections: Array.from(direction.subdirections.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }));

    const existingDirectionKeys = new Set(directions.map(item => normalizeText(item.name)));
    DIRECTION_FALLBACKS.forEach(fallback => {
      const key = normalizeText(fallback.name);
      if (!existingDirectionKeys.has(key)) {
        directions.push({ ...fallback, subdirections: [] });
      }
    });

    directions = directions.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    container.innerHTML = `
      <div class="space-y-8">
        <header class="space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 class="text-2xl font-bold text-slate-900">Panel de Análisis de Indicadores</h1>
              <p class="text-sm text-slate-500">Seleccione un indicador para consultar su tendencia y los escenarios de meta.</p>
            </div>
            <div class="hidden items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700" data-indicator-alert></div>
          </div>
        </header>

        <section data-summary>${buildSummaryCards(summary)}</section>

        <div class="grid gap-6 xl:grid-cols-[420px,1fr]">
          <div class="space-y-6" data-indicator-sections>
            ${sections
              .map(section => `
                <section class="space-y-4" data-section="${section.id}">
                  <header>
                    <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-500">${section.title}</h2>
                    <p class="text-xs text-slate-400">${section.description ?? ''}</p>
                  </header>
                  <div class="space-y-3">
                    ${section.categories
                      .map(category => buildIndicatorCard(category, category.options))
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

            <section class="space-y-4">
              <header>
                <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Direcciones</h2>
                <p class="text-xs text-slate-400">Consulta la matriz de subdirecciones asignadas.</p>
              </header>
              <div class="space-y-3" data-directions>
                ${directions.map(direction => buildDirectionCard(direction)).join('')}
              </div>
            </section>
          </div>

          <div class="space-y-6">
            <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-xs uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
                  <h2 class="mt-1 text-xl font-semibold text-slate-800" data-indicator-name>Seleccione un indicador asignado</h2>
                  <p class="mt-2 max-w-2xl text-sm text-slate-500 hidden" data-indicator-description></p>
                </div>
                <div class="rounded-2xl bg-aifa-blue/10 px-4 py-2 text-right">
                  <p class="text-xs uppercase tracking-widest text-aifa-blue">Unidad</p>
                  <p class="text-sm font-semibold text-aifa-blue" data-indicator-unit>—</p>
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

              <div class="mt-6" data-indicator-chart>
                <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
                  Seleccione un indicador con información disponible.
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
    } else if (indicators.length) {
      updateIndicatorInfo(indicators[0]);
      loadIndicatorDetails(indicators[0].id);
    }
  } catch (error) {
    console.error(error);
    renderError(container, 'No fue posible cargar el panel de indicadores.');
    showToast('Error al cargar la información del panel', { type: 'error' });
  }
}
