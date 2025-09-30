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

const ACCORDION_SECTIONS = [
  {
    id: 'operativos',
    type: 'indicators',
    title: 'Indicadores Operativos',
    iconClass: 'fa-solid fa-gauge-high',
    groups: [
      { id: 'operations', title: 'Operaciones', entity: 'Operaciones', iconKey: 'operations' },
      { id: 'passengers', title: 'Pasajeros', entity: 'Pasajeros', iconKey: 'passengers' },
      {
        id: 'cargo-operations',
        title: 'Carga Operaciones',
        entity: 'Carga Operaciones',
        iconKey: 'cargo-operations'
      },
      {
        id: 'cargo-weight',
        title: 'Carga Toneladas',
        entity: 'Carga Toneladas',
        iconKey: 'cargo-weight'
      }
    ]
  },
  {
    id: 'fbo',
    type: 'indicators',
    title: 'Indicadores FBO (Aviación General)',
    iconClass: 'fa-solid fa-plane-circle-check',
    groups: [
      { id: 'fbo-operations', title: 'Operaciones', entity: 'Operaciones', iconKey: 'fbo-operations' },
      { id: 'fbo-passengers', title: 'Pasajeros', entity: 'Pasajeros', iconKey: 'fbo-passengers' }
    ]
  },
  {
    id: 'direcciones',
    type: 'directions',
    title: 'Direcciones',
    iconClass: 'fa-solid fa-sitemap'
  }
];

function buildIndicatorOptionMarkup(option) {
  const iconClass = OPTION_ICON_CLASSES[option.type] ?? 'fa-solid fa-chart-line';
  return `
    <li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      <span class="mt-0.5 text-slate-500">
        <i class="${iconClass} text-sm"></i>
      </span>
      <span>${option.label}</span>
    </li>
  `;
}

function buildIndicatorGroupMarkup(sectionId, group) {
  const iconClass = GROUP_ICON_CLASSES[group.iconKey] ?? 'fa-solid fa-chart-line';
  const options = OPTION_BLUEPRINTS.map(blueprint => ({
    id: `${sectionId}-${group.id}-${blueprint.id}`,
    label: blueprint.buildLabel(group.entity),
    type: blueprint.type
  }));

  const optionsMarkup = options.map(buildIndicatorOptionMarkup).join('');

  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-aifa-light focus:ring-offset-2"
        data-group-button
        data-group-root="${sectionId}"
        data-group-id="${sectionId}-${group.id}"
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
        data-group-panel="${sectionId}-${group.id}"
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
  if (!section.groups?.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
        No hay opciones de indicadores configuradas.
      </div>
    `;
  }

  const groupsMarkup = section.groups
    .map(group => buildIndicatorGroupMarkup(section.id, group))
    .join('');

  return `<div class="space-y-3">${groupsMarkup}</div>`;
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
    initDirectionControls(container);
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}
