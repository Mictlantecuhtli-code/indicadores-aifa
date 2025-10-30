import {
  getAirportTechnicalSections,
  saveAirportSection,
  getAirportRoutes,
  saveAirportRoute,
  deleteAirportRoute,
  saveRouteAirlines
} from '../services/supabaseClient.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { getUserRole } from '../state/session.js';

const EDITABLE_ROLES = new Set(['DIRECTOR', 'SUBDIRECTOR', 'ADMIN']);
const AIRPORT_MAP_IMAGE_URL = new URL('../../assets/Plano.jpeg', import.meta.url).href;

const SECTION_BLUEPRINTS = [
  {
    key: 'general',
    title: 'Datos generales del aeropuerto',
    description: 'Ubicación, identificadores y datos básicos operativos.',
    order: 1
  },
  {
    key: 'operacion',
    title: 'Operación y capacidades',
    description: 'Capacidades máximas, horarios y niveles de servicio.',
    order: 2
  },
  {
    key: 'infraestructura',
    title: 'Infraestructura aeroportuaria',
    description: 'Pistas, calles de rodaje, plataformas y edificaciones de apoyo.',
    order: 3
  },
  {
    key: 'servicios',
    title: 'Servicios y facilidades',
    description: 'Servicios al pasajero, carga, mantenimiento y apoyo terrestre.',
    order: 4
  },
  {
    key: 'navegacion',
    title: 'Ayudas a la navegación',
    description: 'Sistemas de radionavegación, aproximación y vigilancia.',
    order: 5
  },
  {
    key: 'visual_aids',
    title: 'Ayudas visuales y señalización',
    description: 'Balizamiento, señalización y dispositivos visuales instalados.',
    order: 6
  },
  {
    key: 'mapa',
    title: 'Plano del aeropuerto',
    description: 'Representación gráfica y distribución general del aeródromo.',
    order: 7
  }
];

let storedSections = [];
let sectionsCache = [];
let routesCache = [];
let currentContainer = null;
let modalRoot = null;
let escapeHandler = null;

function canEdit() {
  const role = (getUserRole() || '').toUpperCase();
  return EDITABLE_ROLES.has(role);
}

function normalizeSectionKey(value) {
  if (!value) return null;

  return (
    value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .trim() || null
  );
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatMultiline(value) {
  if (value === null || value === undefined) return '';
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function mergeSections(sections) {
  const byKey = new Map();
  sections.forEach(section => {
    if (!section) return;
    const normalizedKey = normalizeSectionKey(section.section_key || section.sectionKey || section.id || section.title);
    if (!normalizedKey) return;

    const normalizedSection = {
      ...section,
      section_key: section.section_key || section.sectionKey || normalizedKey
    };

    byKey.set(normalizedKey, normalizedSection);
  });

  const merged = SECTION_BLUEPRINTS.map(blueprint => {
    const normalizedKey = normalizeSectionKey(blueprint.key);
    const existing = normalizedKey ? byKey.get(normalizedKey) : null;

    if (existing) {
      byKey.delete(normalizedKey);
      return {
        ...existing,
        title: existing.title || blueprint.title,
        description: existing.description || blueprint.description || '',
        display_order: existing.display_order ?? blueprint.order ?? null
      };
    }

    const fallbackKey = normalizedKey || blueprint.key;

    return {
      id: null,
      section_key: fallbackKey,
      title: blueprint.title,
      description: blueprint.description || '',
      content: [],
      display_order: blueprint.order ?? null,
      updated_at: null
    };
  }).filter(Boolean);

  const extras = Array.from(byKey.values()).sort((a, b) => {
    const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.title || a.section_key || '').localeCompare(b.title || b.section_key || '');
  });

  return merged.concat(extras);
}

function sortRoutes(routes) {
  return [...routes].sort((a, b) => {
    const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const labelA = a.destino || a.nombre || a.route_code || '';
    const labelB = b.destino || b.nombre || b.route_code || '';
    return labelA.localeCompare(labelB);
  });
}

function extractAirlinesFromRoute(route) {
  const airlines = Array.isArray(route?.airlines)
    ? route.airlines
        .filter(item => item && (item.nombre || item.frecuencia || item.notas))
        .map(item => ({
          id: item.id ?? null,
          nombre: item.nombre ?? '',
          frecuencia: item.frecuencia ?? '',
          notas: item.notas ?? '',
          display_order: typeof item.display_order === 'number' ? item.display_order : null
        }))
    : [];

  const fallbackName = (route?.nombre || '').toString().trim();
  if (fallbackName) {
    const normalizedName = fallbackName.toLowerCase();
    const hasName = airlines.some(item => (item.nombre || '').toString().trim().toLowerCase() === normalizedName);
    if (!hasName) {
      airlines.push({
        id: route?.id != null ? `route-${route.id}-airline` : null,
        nombre: fallbackName,
        frecuencia: route?.frecuencia_base || '',
        notas: route?.notas || '',
        display_order: route?.display_order ?? null
      });
    }
  }

  return airlines;
}

function mergeTextValue(target, value) {
  if (!value) return target;
  if (!target) return value;
  if (target.includes(value)) {
    return target;
  }
  return `${target}\n${value}`.trim();
}

function groupRoutesByDestination(routes) {
  const groups = new Map();
  const list = Array.isArray(routes) ? routes : [];

  list.forEach(route => {
    if (!route) return;

    const destination = (route.destino || '').toString().trim();
    const country = (route.pais || '').toString().trim();
    const keyParts = [destination.toLowerCase(), country.toLowerCase()].filter(Boolean);
    const key = keyParts.join('::') || destination.toLowerCase() || (route.route_code || '').toString().toLowerCase();

    const existing = groups.get(key);
    if (!existing) {
      const airlineMap = new Map();
      extractAirlinesFromRoute(route).forEach(airline => {
        const airlineKey = (airline.nombre || '').toString().trim().toLowerCase() || `airline-${airlineMap.size + 1}`;
        if (!airlineMap.has(airlineKey)) {
          airlineMap.set(airlineKey, { ...airline });
        }
      });

      groups.set(key, {
        id: route.id ?? null,
        primaryRouteId: route.id ?? null,
        routeIds: route.id != null ? [route.id] : [],
        display_order: route.display_order ?? null,
        destino: destination || route.nombre || '',
        pais: country,
        tipo_vuelo: route.tipo_vuelo || '',
        distancia_km: route.distancia_km ?? null,
        tiempo_estimado: route.tiempo_estimado || '',
        descripcion: route.descripcion || '',
        notas: route.notas || '',
        airlines: airlineMap,
        sourceRoutes: [route]
      });
      return;
    }

    if (existing.primaryRouteId == null && route.id != null) {
      existing.primaryRouteId = route.id;
      existing.id = route.id;
    }

    if (route.id != null && !existing.routeIds.includes(route.id)) {
      existing.routeIds.push(route.id);
    }

    if (route.display_order != null) {
      existing.display_order =
        existing.display_order != null
          ? Math.min(existing.display_order, route.display_order)
          : route.display_order;
    }

    if (!existing.destino && route.destino) {
      existing.destino = route.destino;
    }
    if (!existing.pais && route.pais) {
      existing.pais = route.pais;
    }
    if (!existing.tipo_vuelo && route.tipo_vuelo) {
      existing.tipo_vuelo = route.tipo_vuelo;
    }
    if ((existing.distancia_km === null || existing.distancia_km === undefined) && route.distancia_km != null) {
      existing.distancia_km = route.distancia_km;
    }
    if (!existing.tiempo_estimado && route.tiempo_estimado) {
      existing.tiempo_estimado = route.tiempo_estimado;
    }
    existing.descripcion = mergeTextValue(existing.descripcion, route.descripcion || '');
    existing.notas = mergeTextValue(existing.notas, route.notas || '');

    const airlineMap = existing.airlines;
    extractAirlinesFromRoute(route).forEach(airline => {
      const keyName = (airline.nombre || '').toString().trim().toLowerCase() || `airline-${airlineMap.size + 1}`;
      const current = airlineMap.get(keyName);
      if (current) {
        if (!current.frecuencia && airline.frecuencia) {
          current.frecuencia = airline.frecuencia;
        }
        if (!current.notas && airline.notas) {
          current.notas = airline.notas;
        }
        return;
      }

      airlineMap.set(keyName, { ...airline });
    });

    existing.sourceRoutes.push(route);
  });

  return Array.from(groups.values()).map(group => {
    const airlines = Array.from(group.airlines.values()).sort((a, b) => {
      const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

    return {
      ...group,
      display_order: group.display_order ?? null,
      airlines,
      sourceRoutes: group.sourceRoutes
    };
  });
}

function summarizeAirlines(airlines) {
  if (!Array.isArray(airlines) || !airlines.length) {
    return 'Sin aerolíneas registradas';
  }

  const summary = airlines
    .filter(item => item && (item.nombre || item.frecuencia || item.notas))
    .map(item => {
      const name = escapeHtml(item.nombre || 'Aerolínea sin nombre');
      if (item.frecuencia) {
        return `${name} <span class="text-xs text-slate-400">(${escapeHtml(item.frecuencia)})</span>`;
      }
      return name;
    });

  if (!summary.length) {
    return 'Sin aerolíneas registradas';
  }

  if (summary.length > 2) {
    return `${summary.slice(0, 2).join(', ')} <span class="text-xs text-slate-400">y ${
      summary.length - 2
    } más</span>`;
  }

  return summary.join(', ');
}

function formatDistance(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isFinite(number)) {
    return `${number.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
  }
  return escapeHtml(value);
}

function ensureModalRoot() {
  if (modalRoot) return modalRoot;
  modalRoot = document.createElement('div');
  modalRoot.setAttribute('data-airport-modal-root', '');
  document.body.appendChild(modalRoot);
  return modalRoot;
}

function closeModal() {
  if (!modalRoot) return;
  modalRoot.innerHTML = '';
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
}

function openModal(content) {
  const root = ensureModalRoot();
  closeModal();
  root.innerHTML = content;

  const overlay = root.querySelector('[data-modal-overlay]');
  if (overlay) {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeModal();
      }
    });
  }

  root.querySelectorAll('[data-modal-close]').forEach(element => {
    element.addEventListener('click', () => closeModal());
  });

  escapeHandler = event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function buildSectionItemsMarkup(section) {
  const items = Array.isArray(section.content)
    ? [...section.content].sort((a, b) => {
        const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.label || '').localeCompare(b.label || '');
      })
    : [];

  const textItems = items.filter(item => item.type !== 'image');
  const imageItems = items.filter(item => item.type === 'image');

  const textMarkup = textItems.length
    ? `
        <div class="grid gap-4 md:grid-cols-2" data-section-text-items>
          ${textItems
            .map(
              item => `
                <div class="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">${escapeHtml(
                    item.label || 'Dato'
                  )}</p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-700">${formatMultiline(item.value)}</p>
                </div>
              `
            )
            .join('')}
        </div>
      `
    : '';

  const imageMarkup = imageItems.length
    ? `
        <div class="grid gap-4 md:grid-cols-2" data-section-image-items>
          ${imageItems
            .map(
              item => `
                <figure class="rounded-3xl border border-slate-200/60 bg-slate-50/40 p-4">
                  <div class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
                    <img
                      src="${escapeAttribute(item.value || '')}"
                      alt="${escapeAttribute(item.label || section.title || 'Imagen de referencia')}"
                      class="h-auto w-full object-contain"
                    />
                  </div>
                  ${item.label ? `<figcaption class="mt-2 text-center text-xs text-slate-500">${escapeHtml(item.label)}</figcaption>` : ''}
                </figure>
              `
            )
            .join('')}
        </div>
      `
    : '';

  if (!textMarkup && !imageMarkup) {
    return `
      <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-6 text-sm text-slate-500">
        Sin información capturada para esta sección.
      </div>
    `;
  }

  return `${textMarkup}${imageMarkup}`;
}

function buildSectionCard(section, editable) {
  return `
    <section class="rounded-[28px] border border-slate-200/70 bg-white/95 p-6 shadow-sm shadow-slate-900/5" data-section="${
      section.section_key
    }">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(
            section.title || 'Sección sin título'
          )}</h3>
          ${section.description ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(section.description)}</p>` : ''}
          ${section.updated_at
            ? `<p class="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">Última actualización: ${escapeHtml(
                formatTimestamp(section.updated_at)
              )}</p>`
            : ''}
        </div>
        ${
          editable
            ? `<button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:border-primary-400 hover:bg-primary-50"
                data-action="edit-section"
                data-section="${section.section_key}"
              >
                <i class="fa-solid fa-pen-to-square"></i>
                Editar
              </button>`
            : ''
        }
      </div>
      <div class="mt-6 space-y-6">
        ${buildSectionItemsMarkup(section)}
      </div>
    </section>
  `;
}

function buildInfoSectionsMarkup(sections, editable) {
  const cards = sections.map(section => buildSectionCard(section, editable)).join('');
  return `
    <section class="space-y-6" data-airport-sections>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.4em] text-primary-600">Ficha técnica</p>
          <h2 class="text-2xl font-semibold text-slate-800">Información técnica del Aeropuerto Internacional Felipe Ángeles</h2>
          <p class="mt-2 max-w-3xl text-sm text-slate-500">
            Consulta la información operativa y de infraestructura que describe las capacidades del aeropuerto. Los datos se almacenan en la base de datos y pueden actualizarse desde esta vista.
          </p>
        </div>
        ${
          editable
            ? `<button
                type="button"
                class="inline-flex items-center gap-2 self-start rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/40 transition hover:bg-primary-500"
                data-action="add-section"
              >
                <i class="fa-solid fa-plus"></i>
                Nueva sección
              </button>`
            : ''
        }
      </div>
      <div class="grid gap-6 lg:grid-cols-2" data-section-grid>
        ${cards}
      </div>
    </section>
  `;
}

function getRouteIdentifier(route) {
  if (route && route.id !== null && route.id !== undefined) {
    return `id-${route.id}`;
  }

  const fallback = (route?.route_code || route?.nombre || route?.destino || `route-${Date.now()}`).toString();
  return fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildAirlinesList(route) {
  const airlines = Array.isArray(route?.airlines)
    ? route.airlines.filter(item => item && (item.nombre || item.frecuencia || item.notas))
    : [];

  if (!airlines.length) {
    return '<p class="text-sm text-slate-500">Sin aerolíneas registradas para este destino.</p>';
  }

  return `
    <ul class="space-y-3">
      ${airlines
        .map(airline => {
          const name = escapeHtml(airline.nombre || 'Aerolínea sin nombre');
          const frequency = airline.frecuencia
            ? `<p class="text-xs text-slate-500"><span class="font-semibold text-slate-600">Frecuencia:</span> ${escapeHtml(airline.frecuencia)}</p>`
            : '';
          const notes = airline.notas
            ? `<p class="text-xs text-slate-500">${formatMultiline(airline.notas)}</p>`
            : '';

          return `
            <li class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-900/5">
              <p class="text-sm font-semibold text-slate-700">${name}</p>
              ${frequency}
              ${notes}
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

function buildRouteDetails(route, editable) {
  const identifier = getRouteIdentifier(route);
  const destinationParts = [route.destino, route.pais].filter(Boolean).map(escapeHtml);
  const destination = destinationParts.length ? destinationParts.join(', ') : '—';
  const type = route.tipo_vuelo ? escapeHtml(route.tipo_vuelo) : '—';
  const estimatedTime = route.tiempo_estimado ? escapeHtml(route.tiempo_estimado) : '—';
  const description = route.descripcion ? `<p class="text-sm text-slate-600">${formatMultiline(route.descripcion)}</p>` : '';
  const notes = route.notas
    ? `<div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p class="font-semibold">Notas adicionales</p>
        <p class="mt-1">${formatMultiline(route.notas)}</p>
      </div>`
    : '';
  const hasSingleRoute = !Array.isArray(route.routeIds) || route.routeIds.length <= 1;

  return `
    <div class="space-y-5" data-route-details="${identifier}">
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-4">
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Destino</dt>
            <dd class="mt-1 text-sm text-slate-700">${destination}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tipo de vuelo</dt>
            <dd class="mt-1 text-sm text-slate-700">${type}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Distancia estimada</dt>
            <dd class="mt-1 text-sm text-slate-700">${formatDistance(route.distancia_km)}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tiempo estimado</dt>
            <dd class="mt-1 text-sm text-slate-700">${estimatedTime}</dd>
          </div>
        </dl>
        ${description ? `<div class="mt-4 text-sm text-slate-600">${description}</div>` : ''}
      </div>

      <div class="rounded-xl border border-slate-200 bg-white px-4 py-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">Aerolíneas que cubren este destino</h3>
            <p class="text-xs text-slate-500">Consulta las aerolíneas autorizadas y su frecuencia de operación.</p>
          </div>
          ${
            editable && route.id && hasSingleRoute
              ? `<button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
                  data-action="view-airlines"
                  data-route-id="${route.id}"
                >
                  <i class="fa-solid fa-plane"></i>
                  Gestionar aerolíneas
                </button>`
              : ''
          }
        </div>
        <div class="mt-4">
          ${buildAirlinesList(route)}
        </div>
      </div>

      ${notes}

      ${
        editable && hasSingleRoute
          ? `<div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-600"
                data-action="edit-route"
                data-route-id="${route.id ?? ''}"
              >
                <i class="fa-solid fa-pen-to-square"></i>
                Editar ruta
              </button>
              ${
                route.id
                  ? `<button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                      data-action="delete-route"
                      data-route-id="${route.id}"
                    >
                      <i class="fa-solid fa-trash"></i>
                      Eliminar ruta
                    </button>`
                  : ''
              }
            </div>`
          : ''
      }
    </div>
  `;
}

function buildRouteItem(route, editable) {
  const identifier = getRouteIdentifier(route);
  const destination = route.destino || route.nombre || 'Destino sin nombre';
  const country = route.pais ? `<p class="text-xs text-slate-400">${escapeHtml(route.pais)}</p>` : '';
  const airlinesSummary = summarizeAirlines(route.airlines);

  return `
    <li class="border-b border-slate-100 last:border-b-0" data-route-item="${identifier}">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 sm:px-5"
        data-action="toggle-route"
        data-route-target="${identifier}"
        aria-expanded="false"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-800 sm:text-base">${escapeHtml(destination)}</p>
          ${country}
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <span class="hidden text-xs text-slate-500 sm:block">${airlinesSummary}</span>
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 sm:h-8 sm:w-8">
            <i class="fa-solid fa-chevron-down transition duration-200" data-chevron></i>
          </span>
        </div>
      </button>
      <div class="hidden border-t border-slate-100 bg-slate-50 px-4 py-4 text-sm sm:px-6 sm:py-5" data-route-content="${identifier}">
        ${buildRouteDetails(route, editable)}
      </div>
    </li>
  `;
}

function buildRouteGroup(label, routes, groupId, editable) {
  const sortedRoutes = sortRoutes(routes);
  const count = sortedRoutes.length;
  const content = count
    ? `<ul class="divide-y divide-slate-100" data-route-group-list="${groupId}">
        ${sortedRoutes.map(route => buildRouteItem(route, editable)).join('')}
      </ul>`
    : `<div class="px-6 py-10 text-center text-sm text-slate-500">
        No hay destinos registrados en esta categoría.
      </div>`;

  return `
    <div class="rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5" data-route-group="${groupId}">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-left text-sm transition hover:bg-slate-100 sm:gap-4 sm:px-6 sm:py-4"
        data-action="toggle-group"
        data-group-id="${groupId}"
        aria-expanded="false"
      >
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-600 sm:text-xs">${label}</p>
          <p class="mt-1 text-xs text-slate-600 sm:text-sm">${count === 1 ? '1 destino disponible' : `${count} destinos disponibles`}</p>
        </div>
        <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600 sm:h-9 sm:w-9">
          <i class="fa-solid fa-chevron-down transition duration-200" data-chevron></i>
        </span>
      </button>
      <div class="hidden border-t border-slate-200" data-group-content="${groupId}">
        ${content}
      </div>
    </div>
  `;
}

function buildRoutesSection(routes, editable) {
  const groupedRoutes = groupRoutesByDestination(routes);
  const nationalRoutes = [];
  const internationalRoutes = [];

  groupedRoutes.forEach(route => {
    const type = (route?.tipo_vuelo || '').toString().toLowerCase();
    if (type.includes('inter')) {
      internationalRoutes.push(route);
    } else {
      nationalRoutes.push(route);
    }
  });

  return `
    <section class="rounded-[28px] border border-slate-200/70 bg-white/95 p-6 shadow-sm shadow-slate-900/5" data-airport-routes>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.4em] text-primary-600">Rutas aéreas</p>
          <h2 class="text-xl font-semibold text-slate-800">Explora las rutas comerciales disponibles</h2>
          <p class="mt-2 max-w-2xl text-sm text-slate-500">
            Consulta las rutas nacionales e internacionales operadas desde el aeropuerto. Selecciona una categoría y descubre las aerolíneas que cubren cada destino.
          </p>
        </div>
        ${
          editable
            ? `<button
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-500"
                data-action="add-route"
              >
                <i class="fa-solid fa-plus"></i>
                Nueva ruta
              </button>`
            : ''
        }
      </div>
      <div class="mt-6 space-y-4" data-route-groups>
        ${buildRouteGroup('Rutas nacionales', nationalRoutes, 'national', editable)}
        ${buildRouteGroup('Rutas internacionales', internationalRoutes, 'international', editable)}
      </div>
    </section>
  `;
}

function buildAirportInfoMarkup(sections, routes, editable) {
  return `
    <div class="space-y-10" data-airport-info>
      ${buildInfoSectionsMarkup(sections, editable)}
      ${buildAirportMapSection()}
      ${buildRoutesSection(routes, editable)}
    </div>
  `;
}

function buildAirportMapSection() {
  return `
    <section class="rounded-[28px] border border-slate-200/70 bg-white/95 p-6 shadow-sm shadow-slate-900/5" data-airport-map>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.4em] text-primary-600">Plano del aeropuerto</p>
          <h2 class="text-xl font-semibold text-slate-800">Explora la distribución general del aeródromo</h2>
          <p class="mt-2 text-sm text-slate-500">
            Consulta el plano del Aeropuerto Internacional Felipe Ángeles para identificar las principales áreas y accesos.
            Selecciona la imagen para ampliarla en pantalla completa.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-400 hover:bg-primary-50"
            data-action="open-airport-map"
          >
            <i class="fa-solid fa-maximize"></i>
            Ver a detalle
          </button>
        </div>
      </div>
      <div class="mt-6">
        <button
          type="button"
          class="group relative w-full overflow-hidden rounded-3xl border border-slate-200 shadow-sm shadow-slate-900/5 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
          data-action="open-airport-map"
          aria-label="Abrir el plano del aeropuerto en una vista ampliada"
        >
          <img
            src="${AIRPORT_MAP_IMAGE_URL}"
            alt="Plano general del Aeropuerto Internacional Felipe Ángeles"
            class="max-h-96 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100"></div>
          <span class="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10">
            <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
            Ampliar
          </span>
        </button>
      </div>
    </section>
  `;
}

function buildAirportMapModal() {
  return `
    <div class="fixed inset-0 z-[2000] flex min-h-full items-center justify-center overflow-y-auto bg-slate-900/70 px-4 py-6" data-modal-overlay>
      <div class="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <button
          type="button"
          class="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-500 transition hover:bg-white hover:text-slate-700"
          data-modal-close
          aria-label="Cerrar"
        >
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
        <img
          src="${AIRPORT_MAP_IMAGE_URL}"
          alt="Plano general del Aeropuerto Internacional Felipe Ángeles"
          class="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  `;
}
function buildSectionItemFormRow(item) {
  return `
    <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4" data-section-item data-item-id="${item.id}">
      <input type="hidden" name="item_id" value="${escapeAttribute(item.id)}" />
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Etiqueta</label>
          <input
            type="text"
            name="label"
            value="${escapeAttribute(item.label || '')}"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Ej. Elevación, Coordenadas, etc."
          />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tipo de dato</label>
          <select
            name="type"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="text" ${item.type === 'image' ? '' : 'selected'}>Texto</option>
            <option value="image" ${item.type === 'image' ? 'selected' : ''}>Imagen (URL)</option>
          </select>
        </div>
      </div>
      <div class="mt-4">
        <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Valor</label>
        <textarea
          name="value"
          rows="3"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="Ingresa el valor que se mostrará en la ficha"
        >${escapeHtml(item.value || '')}</textarea>
        <p class="mt-1 text-xs text-slate-400">
          Para elementos de tipo imagen ingresa la URL pública del recurso que se desea mostrar.
        </p>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          data-action="remove-item"
        >
          <i class="fa-solid fa-trash"></i>
          Quitar dato
        </button>
      </div>
    </div>
  `;
}

function buildSectionModal(section) {
  const items = Array.isArray(section.content) && section.content.length
    ? section.content
    : [
        {
          id: `${Date.now().toString(36)}-item`,
          label: '',
          value: '',
          type: 'text'
        }
      ];

  return `
    <div class="fixed inset-0 z-[2000] flex min-h-full items-center justify-center overflow-y-auto bg-slate-900/60 px-4 py-6" data-modal-overlay>
      <div class="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">${section.id ? 'Editar sección' : 'Nueva sección'}</h3>
            <p class="text-xs text-slate-500">
              La información se guarda en la base de datos y estará disponible para los usuarios autorizados.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            data-modal-close
            aria-label="Cerrar"
          >
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <form id="airport-section-form" data-section-id="${section.id ?? ''}" data-section-key="${escapeAttribute(
          section.section_key || ''
        )}">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Identificador</label>
              <input
                type="text"
                name="section_key"
                value="${escapeAttribute(section.section_key || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ej. general, infraestructuras, ayudas"
                ${section.id ? 'readonly' : ''}
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Orden de visualización</label>
              <input
                type="number"
                name="display_order"
                value="${escapeAttribute(section.display_order ?? '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div class="mt-4">
            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Título</label>
            <input
              type="text"
              name="title"
              value="${escapeAttribute(section.title || '')}"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              required
            />
          </div>
          <div class="mt-4">
            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Descripción</label>
            <textarea
              name="description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >${escapeHtml(section.description || '')}</textarea>
          </div>
          <div class="mt-6 space-y-4" data-section-items>
            ${items.map(item => buildSectionItemFormRow(item)).join('')}
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary-400 hover:text-primary-600"
              data-action="add-item"
            >
              <i class="fa-solid fa-plus"></i>
              Agregar dato
            </button>
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
              data-modal-close
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/40 transition hover:bg-primary-500"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildRouteModal(route) {
  return `
    <div class="fixed inset-0 z-[2000] flex min-h-full items-center justify-center overflow-y-auto bg-slate-900/60 px-4 py-6" data-modal-overlay>
      <div class="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">${route.id ? 'Editar ruta aérea' : 'Registrar nueva ruta'}</h3>
            <p class="text-xs text-slate-500">
              Completa la información de la ruta. Las aerolíneas y frecuencias se administran desde el detalle de cada ruta.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            data-modal-close
            aria-label="Cerrar"
          >
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <form id="airport-route-form" data-route-id="${route.id ?? ''}">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Código de ruta</label>
              <input
                type="text"
                name="route_code"
                value="${escapeAttribute(route.route_code || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ej. NLU-CUN"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tipo de vuelo</label>
              <input
                type="text"
                name="tipo_vuelo"
                value="${escapeAttribute(route.tipo_vuelo || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="NACIONAL, INTERNACIONAL, CARGA..."
              />
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Nombre de la ruta</label>
              <input
                type="text"
                name="nombre"
                value="${escapeAttribute(route.nombre || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ej. NLU - Cancún"
                required
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Destino</label>
              <input
                type="text"
                name="destino"
                value="${escapeAttribute(route.destino || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ciudad o aeropuerto de destino"
                required
              />
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">País</label>
              <input
                type="text"
                name="pais"
                value="${escapeAttribute(route.pais || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Distancia (km)</label>
              <input
                type="number"
                step="0.1"
                name="distancia_km"
                value="${escapeAttribute(route.distancia_km ?? '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tiempo estimado de vuelo</label>
              <input
                type="text"
                name="tiempo_estimado"
                value="${escapeAttribute(route.tiempo_estimado || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ej. 2h 15m"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Frecuencia base</label>
              <input
                type="text"
                name="frecuencia_base"
                value="${escapeAttribute(route.frecuencia_base || '')}"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Ej. 7 frecuencias semanales"
              />
            </div>
          </div>
          <div class="mt-4">
            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Descripción general</label>
            <textarea
              name="descripcion"
              rows="3"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Notas generales sobre la ruta"
            >${escapeHtml(route.descripcion || '')}</textarea>
          </div>
          <div class="mt-4">
            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Notas internas</label>
            <textarea
              name="notas"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Información adicional u observaciones"
            >${escapeHtml(route.notas || '')}</textarea>
          </div>
          <div class="mt-4">
            <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Orden de visualización</label>
            <input
              type="number"
              name="display_order"
              value="${escapeAttribute(route.display_order ?? '')}"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Opcional"
            />
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
              data-modal-close
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-500"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              Guardar ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildAirlineRow(airline) {
  return `
    <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4" data-airline-row data-airline-id="${airline.id}">
      <input type="hidden" name="airline_id" value="${escapeAttribute(airline.id)}" />
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Aerolínea</label>
          <input
            type="text"
            name="nombre"
            value="${escapeAttribute(airline.nombre || '')}"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Nombre de la aerolínea"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Frecuencia</label>
          <input
            type="text"
            name="frecuencia"
            value="${escapeAttribute(airline.frecuencia || '')}"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Ej. 7/semana, Diario, 3 veces por semana"
          />
        </div>
      </div>
      <div class="mt-4">
        <label class="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Notas</label>
        <textarea
          name="notas"
          rows="2"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="Observaciones adicionales"
        >${escapeHtml(airline.notas || '')}</textarea>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          data-action="remove-airline"
        >
          <i class="fa-solid fa-trash"></i>
          Quitar aerolínea
        </button>
      </div>
    </div>
  `;
}

function buildAirlinesModal(route, editable) {
  const airlines = Array.isArray(route.airlines) && route.airlines.length
    ? route.airlines
    : [
        {
          id: `${Date.now().toString(36)}-airline`,
          nombre: '',
          frecuencia: '',
          notas: ''
        }
      ];

  if (!editable) {
    const list = route.airlines && route.airlines.length
      ? route.airlines
          .map(
            item => `
              <li class="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p class="font-semibold text-slate-700">${escapeHtml(item.nombre || 'Aerolínea sin nombre')}</p>
                ${item.frecuencia ? `<p class="text-sm text-slate-500">Frecuencia: ${escapeHtml(item.frecuencia)}</p>` : ''}
                ${item.notas ? `<p class="text-xs text-slate-400">${escapeHtml(item.notas)}</p>` : ''}
              </li>
            `
          )
          .join('')
      : '<li class="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-6 text-sm text-slate-500">Sin aerolíneas registradas.</li>';

    return `
      <div class="fixed inset-0 z-[2000] flex min-h-full items-center justify-center overflow-y-auto bg-slate-900/60 px-4 py-6" data-modal-overlay>
        <div class="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-800">Aerolíneas asignadas</h3>
              <p class="text-xs text-slate-500">
                Consulta las aerolíneas autorizadas para la ruta ${escapeHtml(route.nombre || route.route_code || '')}.
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              data-modal-close
              aria-label="Cerrar"
            >
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          <ul class="space-y-3">
            ${list}
          </ul>
        </div>
      </div>
    `;
  }

  return `
    <div class="fixed inset-0 z-[2000] flex min-h-full items-center justify-center overflow-y-auto bg-slate-900/60 px-4 py-6" data-modal-overlay>
      <div class="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Administrar aerolíneas y frecuencias</h3>
            <p class="text-xs text-slate-500">
              Registra las aerolíneas autorizadas para la ruta ${escapeHtml(route.nombre || route.route_code || '')} y define la frecuencia de operación.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            data-modal-close
            aria-label="Cerrar"
          >
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <form id="airport-airlines-form" data-route-id="${route.id ?? ''}">
          <div class="space-y-4" data-airlines-container>
            ${airlines.map(airline => buildAirlineRow(airline)).join('')}
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary-400 hover:text-primary-600"
              data-action="add-airline"
            >
              <i class="fa-solid fa-plus"></i>
              Agregar aerolínea
            </button>
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
              data-modal-close
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/40 transition hover:bg-primary-500"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              Guardar aerolíneas
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
function slugify(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .trim();
}

function gatherSectionFormData(form) {
  const titleInput = form.querySelector('input[name="title"]');
  const title = titleInput?.value?.trim() ?? '';
  const keyInput = form.querySelector('input[name="section_key"]');
  const rawKey = keyInput?.value?.trim();
  const sectionKey = rawKey || slugify(title);
  const description = form.querySelector('textarea[name="description"]')?.value ?? '';
  const displayOrderValue = form.querySelector('input[name="display_order"]')?.value?.trim();

  const items = Array.from(form.querySelectorAll('[data-section-item]')).map((element, index) => {
    const id = element.dataset.itemId || element.querySelector('input[name="item_id"]')?.value || `${Date.now().toString(36)}-${index}`;
    const label = element.querySelector('input[name="label"]')?.value ?? '';
    const value = element.querySelector('textarea[name="value"]')?.value ?? '';
    const type = element.querySelector('select[name="type"]')?.value === 'image' ? 'image' : 'text';
    return {
      id,
      label: label.trim(),
      value,
      type,
      display_order: index
    };
  });

  return {
    id: form.dataset.sectionId ? Number(form.dataset.sectionId) : null,
    section_key: sectionKey,
    title,
    description,
    content: items.filter(item => item.label || item.value),
    display_order: displayOrderValue ? Number(displayOrderValue) : null
  };
}

function gatherRouteFormData(form) {
  const formData = new FormData(form);
  const id = form.dataset.routeId ? Number(form.dataset.routeId) : null;

  const base = {
    id,
    route_code: (formData.get('route_code') || '').toString().trim() || null,
    nombre: (formData.get('nombre') || '').toString().trim(),
    destino: (formData.get('destino') || '').toString().trim(),
    pais: (formData.get('pais') || '').toString().trim() || null,
    tipo_vuelo: (formData.get('tipo_vuelo') || '').toString().trim() || null,
    distancia_km: formData.get('distancia_km') ? Number(formData.get('distancia_km')) : null,
    tiempo_estimado: (formData.get('tiempo_estimado') || '').toString().trim() || null,
    frecuencia_base: (formData.get('frecuencia_base') || '').toString().trim() || null,
    descripcion: (formData.get('descripcion') || '').toString().trim() || null,
    notas: (formData.get('notas') || '').toString().trim() || null,
    display_order: formData.get('display_order') ? Number(formData.get('display_order')) : null
  };

  const existing = id ? routesCache.find(route => route.id === id) : null;
  base.airlines = existing?.airlines ? existing.airlines.map(item => ({ ...item })) : [];
  return base;
}

function gatherAirlinesFromForm(form) {
  const rows = Array.from(form.querySelectorAll('[data-airline-row]'));
  return rows
    .map((row, index) => {
      const id = row.dataset.airlineId || row.querySelector('input[name="airline_id"]')?.value || `${Date.now().toString(36)}-${index}`;
      const nombre = row.querySelector('input[name="nombre"]')?.value?.trim() ?? '';
      const frecuencia = row.querySelector('input[name="frecuencia"]')?.value?.trim() ?? '';
      const notas = row.querySelector('textarea[name="notas"]')?.value?.trim() ?? '';
      return {
        id,
        nombre,
        frecuencia,
        notas,
        display_order: index
      };
    })
    .filter(item => item.nombre || item.frecuencia || item.notas);
}

function upsertStoredSection(section) {
  const index = storedSections.findIndex(item => item.section_key === section.section_key);
  if (index >= 0) {
    storedSections[index] = section;
  } else {
    storedSections.push(section);
  }
  sectionsCache = mergeSections(storedSections);
}

function upsertRoute(route) {
  const index = routesCache.findIndex(item => item.id === route.id);
  if (index >= 0) {
    routesCache[index] = route;
  } else {
    routesCache.push(route);
  }
  routesCache = sortRoutes(routesCache);
}

function removeRouteFromCache(routeId) {
  routesCache = routesCache.filter(route => route.id !== routeId);
}

function renderCurrentState() {
  if (!currentContainer) return;
  const editable = canEdit();
  currentContainer.innerHTML = buildAirportInfoMarkup(sectionsCache, routesCache, editable);
  bindEvents(currentContainer);
}

function bindSectionModalEvents() {
  const form = document.getElementById('airport-section-form');
  if (!form) return;

  const itemsContainer = form.querySelector('[data-section-items]');
  const addButton = form.querySelector('[data-action="add-item"]');

  if (addButton) {
    addButton.addEventListener('click', () => {
      const newItem = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        label: '',
        value: '',
        type: 'text'
      };
      itemsContainer.insertAdjacentHTML('beforeend', buildSectionItemFormRow(newItem));
    });
  }

  itemsContainer.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-action="remove-item"]');
    if (removeButton) {
      const item = removeButton.closest('[data-section-item]');
      item?.remove();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = 'Guardando…';
    }

    try {
      const data = gatherSectionFormData(form);
      if (!data.title) {
        showToast('El título de la sección es obligatorio.', { type: 'warning' });
        return;
      }

      const saved = await saveAirportSection(data.section_key, data);
      upsertStoredSection(saved);
      renderCurrentState();
      showToast('Sección guardada correctamente.');
      closeModal();
    } catch (error) {
      console.error('No fue posible guardar la sección técnica del aeropuerto', error);
      showToast('No fue posible guardar la sección. Intente nuevamente.', { type: 'error' });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Guardar cambios';
      }
    }
  });
}

function bindRouteModalEvents(route) {
  const form = document.getElementById('airport-route-form');
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = 'Guardando…';
    }

    try {
      const payload = gatherRouteFormData(form);
      const saved = await saveAirportRoute(payload);
      upsertRoute(saved);
      renderCurrentState();
      showToast('Ruta guardada correctamente.');
      closeModal();
    } catch (error) {
      console.error('No fue posible guardar la ruta aérea', error);
      showToast('No fue posible guardar la ruta. Intente nuevamente.', { type: 'error' });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Guardar ruta';
      }
    }
  });
}

function bindAirlinesModalEvents(route) {
  const form = document.getElementById('airport-airlines-form');
  if (!form) return;

  const container = form.querySelector('[data-airlines-container]');
  const addButton = form.querySelector('[data-action="add-airline"]');

  if (addButton) {
    addButton.addEventListener('click', () => {
      const newAirline = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: '',
        frecuencia: '',
        notas: ''
      };
      container.insertAdjacentHTML('beforeend', buildAirlineRow(newAirline));
    });
  }

  container.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-action="remove-airline"]');
    if (removeButton) {
      const row = removeButton.closest('[data-airline-row]');
      row?.remove();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = 'Guardando…';
    }

    try {
      const airlines = gatherAirlinesFromForm(form);
      const updated = await saveRouteAirlines(route.id, airlines);
      upsertRoute(updated);
      renderCurrentState();
      showToast('Aerolíneas actualizadas correctamente.');
      closeModal();
    } catch (error) {
      console.error('No fue posible actualizar las aerolíneas de la ruta', error);
      showToast('No fue posible actualizar las aerolíneas. Intente nuevamente.', { type: 'error' });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Guardar aerolíneas';
      }
    }
  });
}

function openSectionEditor(sectionKey) {
  let section = null;
  if (sectionKey) {
    section = storedSections.find(item => item.section_key === sectionKey) ||
      sectionsCache.find(item => item.section_key === sectionKey);
  }

  if (section) {
    section = {
      ...section,
      content: Array.isArray(section.content) ? section.content.map(item => ({ ...item })) : []
    };
  } else {
    section = {
      id: null,
      section_key: '',
      title: '',
      description: '',
      content: [],
      display_order: sectionsCache.length + 1,
      updated_at: null
    };
  }

  openModal(buildSectionModal(section));
  bindSectionModalEvents();
}

function openRouteEditor(routeId) {
  let route = null;
  if (routeId) {
    route = routesCache.find(item => item.id === routeId);
  }

  if (route) {
    route = {
      ...route,
      airlines: Array.isArray(route.airlines) ? route.airlines.map(item => ({ ...item })) : []
    };
  } else {
    route = {
      id: null,
      route_code: '',
      nombre: '',
      destino: '',
      pais: '',
      tipo_vuelo: '',
      distancia_km: '',
      tiempo_estimado: '',
      frecuencia_base: '',
      descripcion: '',
      notas: '',
      display_order: routesCache.length + 1,
      airlines: []
    };
  }

  openModal(buildRouteModal(route));
  bindRouteModalEvents(route);
}

function openAirlinesManager(routeId) {
  const route = routesCache.find(item => item.id === routeId);
  if (!route) {
    showToast('No se encontró la ruta seleccionada.', { type: 'error' });
    return;
  }

  const editable = canEdit();
  openModal(buildAirlinesModal(route, editable));
  if (editable) {
    bindAirlinesModalEvents(route);
  }
}

function bindEvents(container) {
  if (!container) return;
  const editable = canEdit();

  container.querySelectorAll('[data-action="toggle-group"]').forEach(button => {
    const groupId = button.dataset.groupId;
    if (!groupId) return;
    const content = container.querySelector(`[data-group-content="${groupId}"]`);
    if (!content) return;

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      button.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      content.classList.toggle('hidden', !nextState);
      const icon = button.querySelector('[data-chevron]');
      if (icon) {
        icon.classList.toggle('rotate-180', nextState);
      }
    });
  });

  container.querySelectorAll('[data-action="toggle-route"]').forEach(button => {
    const targetId = button.dataset.routeTarget;
    if (!targetId) return;
    const content = container.querySelector(`[data-route-content="${targetId}"]`);
    if (!content) return;

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      button.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      content.classList.toggle('hidden', !nextState);
      const icon = button.querySelector('[data-chevron]');
      if (icon) {
        icon.classList.toggle('rotate-180', nextState);
      }
    });
  });

  container.querySelectorAll('[data-action="open-airport-map"]').forEach(button => {
    button.addEventListener('click', () => {
      openModal(buildAirportMapModal());
    });
  });

  container.querySelectorAll('[data-action="view-airlines"]').forEach(button => {
    button.addEventListener('click', () => {
      const routeId = Number(button.dataset.routeId);
      openAirlinesManager(routeId);
    });
  });

  if (!editable) {
    return;
  }

  container.querySelectorAll('[data-action="edit-section"]').forEach(button => {
    button.addEventListener('click', () => {
      openSectionEditor(button.dataset.section);
    });
  });

  const addSectionButton = container.querySelector('[data-action="add-section"]');
  if (addSectionButton) {
    addSectionButton.addEventListener('click', () => openSectionEditor(null));
  }

  container.querySelectorAll('[data-action="edit-route"]').forEach(button => {
    button.addEventListener('click', () => {
      const routeId = Number(button.dataset.routeId);
      openRouteEditor(routeId);
    });
  });

  container.querySelectorAll('[data-action="delete-route"]').forEach(button => {
    button.addEventListener('click', async () => {
      const routeId = Number(button.dataset.routeId);
      const route = routesCache.find(item => item.id === routeId);
      if (!route) return;

      const confirmed = window.confirm(
        `¿Desea eliminar la ruta "${route.nombre || route.route_code || 'sin nombre'}"? Esta acción no se puede deshacer.`
      );
      if (!confirmed) return;

      try {
        await deleteAirportRoute(routeId);
        removeRouteFromCache(routeId);
        renderCurrentState();
        showToast('Ruta eliminada correctamente.');
      } catch (error) {
        console.error('No fue posible eliminar la ruta aérea', error);
        showToast('No fue posible eliminar la ruta. Intente nuevamente.', { type: 'error' });
      }
    });
  });

  const addRouteButton = container.querySelector('[data-action="add-route"]');
  if (addRouteButton) {
    addRouteButton.addEventListener('click', () => openRouteEditor(null));
  }
}

export async function renderAirportInfo(container) {
  if (!container) return;
  currentContainer = container;
  renderLoading(container, 'Cargando información técnica del aeropuerto...');

  try {
    const [sections, routes] = await Promise.all([getAirportTechnicalSections(), getAirportRoutes()]);
    storedSections = Array.isArray(sections) ? sections : [];
    sectionsCache = mergeSections(storedSections);
    routesCache = Array.isArray(routes) ? routes : [];
    renderCurrentState();
  } catch (error) {
    console.error('Error al cargar la información técnica del aeropuerto', error);
    renderError(container, error);
  }
}
