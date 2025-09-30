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

const GROUP_DEFINITIONS = {
  operations: {
    id: 'operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    iconClass: 'fa-solid fa-plane-up'
  },
  passengers: {
    id: 'passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
    iconClass: 'fa-solid fa-users-between-lines'
  },
  'cargo-operations': {
    id: 'cargo-operations',
    title: 'Carga Operaciones',
    entity: 'Carga Operaciones',
    iconClass: 'fa-solid fa-boxes-stacked'
  },
  'cargo-weight': {
    id: 'cargo-weight',
    title: 'Carga Toneladas',
    entity: 'Carga Toneladas',
    iconClass: 'fa-solid fa-weight-hanging'
  },
  'fbo-operations': {
    id: 'fbo-operations',
    title: 'Operaciones',
    entity: 'Operaciones',
    iconClass: 'fa-solid fa-plane'
  },
  'fbo-passengers': {
    id: 'fbo-passengers',
    title: 'Pasajeros',
    entity: 'Pasajeros',
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
    <li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      <span class="mt-0.5 text-slate-500">
        <i class="${iconClass} h-4 w-4"></i>
      </span>
      <span>${escapeHtml(option.label)}</span>
    </li>
  `;
}

function buildGroupMarkup(groupId, rootId) {
  const definition = GROUP_DEFINITIONS[groupId];
  if (!definition) return '';

  const options = OPTION_BLUEPRINTS.map(blueprint => ({
    id: `${definition.id}-${blueprint.id}`,
    label: blueprint.buildLabel(definition.entity),
    type: blueprint.type
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

  const directionsContainer = container.querySelector('[data-directions-container]');
  if (directionsContainer) {
    await renderDirections(directionsContainer);
  }
}
