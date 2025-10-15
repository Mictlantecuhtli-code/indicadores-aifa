import {
  getAirportTechnicalData,
  upsertAirportGeneralInfo,
  deleteAirportGeneralInfo,
  upsertAirportCapacityMetric,
  deleteAirportCapacityMetric,
  upsertAirportRoute,
  deleteAirportRoute,
  upsertAirportRouteAirline,
  deleteAirportRouteAirline,
  upsertAirportNavigationAid,
  deleteAirportNavigationAid
} from '../services/supabaseClient.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { getUserRole } from '../state/session.js';

const EDIT_ROLES = new Set(['ADMIN', 'DIRECTOR', 'SUBDIRECTOR']);

let hostContainer = null;
let allowEdition = false;
let technicalState = {
  informacionGeneral: [],
  metricasCapacidad: [],
  rutasAereas: [],
  ayudasNavegacion: []
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEmpty(value) {
  return value ? escapeHtml(value) : '<span class="text-slate-400">Sin especificar</span>';
}

function formatCategoryName(category) {
  const text = (category || 'GENERAL').toString().toLowerCase();
  return text
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupByCategory(records) {
  const map = new Map();
  records.forEach(record => {
    const key = record.categoria || 'GENERAL';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(record);
  });

  return Array.from(map.entries()).sort((a, b) => {
    const orderA = Math.min(...a[1].map(item => (item.orden ?? Number.MAX_SAFE_INTEGER)));
    const orderB = Math.min(...b[1].map(item => (item.orden ?? Number.MAX_SAFE_INTEGER)));
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a[0].localeCompare(b[0], 'es', { sensitivity: 'base' });
  });
}

function sortEntries(entries, labelKey = 'etiqueta') {
  return [...entries].sort((a, b) => {
    const orderA = a.orden ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.orden ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const labelA = (a[labelKey] || '').toString();
    const labelB = (b[labelKey] || '').toString();
    return labelA.localeCompare(labelB, 'es', { sensitivity: 'base' });
  });
}

function getBadgeClass(enabled) {
  return enabled
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-rose-100 text-rose-700';
}

function renderGeneralInformationSection() {
  const groups = groupByCategory(technicalState.informacionGeneral || []);

  return `
    <section class="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
      <div class="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-primary-500">Ficha técnica</p>
          <h2 class="text-2xl font-semibold text-slate-800">Información general del aeropuerto</h2>
          <p class="text-sm text-slate-500">Datos clave de infraestructura, capacidades y características generales.</p>
        </div>
        ${
          allowEdition
            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-700" data-action="add-general" data-category="GENERAL">
                <i class="fa-solid fa-plus-circle"></i>
                Nuevo dato
              </button>`
            : ''
        }
      </div>
      ${
        groups.length === 0
          ? `<div class="py-12 text-center text-slate-400">
              <p class="text-sm font-medium">Aún no se han capturado datos generales.</p>
              ${allowEdition ? '<p class="mt-2 text-xs text-slate-400">Utiliza el botón "Nuevo dato" para registrar la información inicial.</p>' : ''}
            </div>`
          : `
            <div class="mt-6 space-y-8">
              ${groups
                .map(([category, entries]) => {
                  const sortedEntries = sortEntries(entries, 'etiqueta');
                  return `
                    <div class="rounded-2xl border border-slate-200/70 bg-slate-50/60">
                      <div class="flex flex-col gap-3 border-b border-slate-200 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                          <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(formatCategoryName(category))}</h3>
                          <p class="text-xs text-slate-500">${sortedEntries.length} elemento${sortedEntries.length === 1 ? '' : 's'} registrados</p>
                        </div>
                        ${
                          allowEdition
                            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-100" data-action="add-general" data-category="${escapeHtml(category)}">
                                <i class="fa-solid fa-plus"></i>
                                Añadir registro
                              </button>`
                            : ''
                        }
                      </div>
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-slate-200">
                          <thead class="bg-white/60">
                            <tr>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</th>
                              ${allowEdition ? '<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>' : ''}
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 bg-white/70">
                            ${sortedEntries
                              .map(entry => `
                                <tr data-id="${escapeHtml(entry.id)}" class="hover:bg-primary-50/40">
                                  <td class="px-4 py-3 text-sm font-medium text-slate-700">${escapeHtml(entry.etiqueta || '—')}</td>
                                  <td class="px-4 py-3 text-sm text-slate-600">${formatEmpty(entry.valor)}</td>
                                  <td class="px-4 py-3 text-sm text-slate-500">${entry.unidad ? escapeHtml(entry.unidad) : '—'}</td>
                                  <td class="px-4 py-3 text-sm text-slate-500">${entry.descripcion ? escapeHtml(entry.descripcion) : '—'}</td>
                                  ${
                                    allowEdition
                                      ? `<td class="px-4 py-3 text-right text-sm">
                                          <div class="inline-flex items-center gap-2">
                                            <button type="button" class="rounded-full border border-transparent p-2 text-primary-600 transition hover:border-primary-200 hover:bg-primary-50" data-action="edit-general" data-id="${escapeHtml(entry.id)}" title="Editar registro">
                                              <i class="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button type="button" class="rounded-full border border-transparent p-2 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" data-action="delete-general" data-id="${escapeHtml(entry.id)}" title="Eliminar registro">
                                              <i class="fa-solid fa-trash-can"></i>
                                            </button>
                                          </div>
                                        </td>`
                                      : ''
                                  }
                                </tr>
                              `)
                              .join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
      }
    </section>
  `;
}

function renderCapacitySection() {
  const groups = groupByCategory(technicalState.metricasCapacidad || []);

  return `
    <section class="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
      <div class="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-primary-500">Capacidades operativas</p>
          <h2 class="text-2xl font-semibold text-slate-800">Indicadores de capacidad</h2>
          <p class="text-sm text-slate-500">Información de rendimiento y atención para pasajeros, carga y operaciones.</p>
        </div>
        ${
          allowEdition
            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-700" data-action="add-capacity" data-category="GENERAL">
                <i class="fa-solid fa-plus-circle"></i>
                Nueva métrica
              </button>`
            : ''
        }
      </div>
      ${
        groups.length === 0
          ? `<div class="py-12 text-center text-slate-400">
              <p class="text-sm font-medium">No hay métricas registradas.</p>
              ${allowEdition ? '<p class="mt-2 text-xs text-slate-400">Registra la primera métrica con el botón "Nueva métrica".</p>' : ''}
            </div>`
          : `
            <div class="mt-6 grid gap-6">
              ${groups
                .map(([category, entries]) => {
                  const sortedEntries = sortEntries(entries, 'nombre');
                  return `
                    <div class="rounded-2xl border border-slate-200/70 bg-slate-50/60">
                      <div class="flex flex-col gap-3 border-b border-slate-200 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                          <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(formatCategoryName(category))}</h3>
                          <p class="text-xs text-slate-500">${sortedEntries.length} registro${sortedEntries.length === 1 ? '' : 's'} disponibles</p>
                        </div>
                        ${
                          allowEdition
                            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-100" data-action="add-capacity" data-category="${escapeHtml(category)}">
                                <i class="fa-solid fa-plus"></i>
                                Añadir métrica
                              </button>`
                            : ''
                        }
                      </div>
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-slate-200">
                          <thead class="bg-white/60">
                            <tr>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Indicador</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</th>
                              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</th>
                              ${allowEdition ? '<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>' : ''}
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 bg-white/70">
                            ${sortedEntries
                              .map(entry => `
                                <tr data-id="${escapeHtml(entry.id)}" class="hover:bg-primary-50/40">
                                  <td class="px-4 py-3 text-sm font-semibold text-slate-700">${escapeHtml(entry.nombre || '—')}</td>
                                  <td class="px-4 py-3 text-sm text-slate-600">${formatEmpty(entry.valor)}</td>
                                  <td class="px-4 py-3 text-sm text-slate-500">${entry.unidad ? escapeHtml(entry.unidad) : '—'}</td>
                                  <td class="px-4 py-3 text-sm text-slate-500">${entry.periodo ? escapeHtml(entry.periodo) : '—'}</td>
                                  <td class="px-4 py-3 text-sm text-slate-500">${entry.descripcion ? escapeHtml(entry.descripcion) : '—'}</td>
                                  ${
                                    allowEdition
                                      ? `<td class="px-4 py-3 text-right text-sm">
                                          <div class="inline-flex items-center gap-2">
                                            <button type="button" class="rounded-full border border-transparent p-2 text-primary-600 transition hover:border-primary-200 hover:bg-primary-50" data-action="edit-capacity" data-id="${escapeHtml(entry.id)}" title="Editar métrica">
                                              <i class="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button type="button" class="rounded-full border border-transparent p-2 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" data-action="delete-capacity" data-id="${escapeHtml(entry.id)}" title="Eliminar métrica">
                                              <i class="fa-solid fa-trash-can"></i>
                                            </button>
                                          </div>
                                        </td>`
                                      : ''
                                  }
                                </tr>
                              `)
                              .join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
      }
    </section>
  `;
}

function renderRoutesSection() {
  const routes = technicalState.rutasAereas || [];

  return `
    <section class="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
      <div class="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-primary-500">Conectividad aérea</p>
          <h2 class="text-2xl font-semibold text-slate-800">Rutas comerciales activas</h2>
          <p class="text-sm text-slate-500">Listado de destinos, frecuencias y aerolíneas que operan en el aeropuerto.</p>
        </div>
        ${
          allowEdition
            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-700" data-action="add-route">
                <i class="fa-solid fa-plus-circle"></i>
                Nueva ruta
              </button>`
            : ''
        }
      </div>
      ${
        routes.length === 0
          ? `<div class="py-12 text-center text-slate-400">
              <p class="text-sm font-medium">No hay rutas aéreas registradas.</p>
              ${allowEdition ? '<p class="mt-2 text-xs text-slate-400">Agrega la primera ruta con el botón "Nueva ruta".</p>' : ''}
            </div>`
          : `
            <div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50/80">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Origen</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Frecuencia general</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Distancia (km)</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tiempo (min)</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estatus</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aerolíneas</th>
                    ${allowEdition ? '<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>' : ''}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${routes
                    .map(route => `
                      <tr class="hover:bg-primary-50/40" data-id="${escapeHtml(route.id)}">
                        <td class="px-4 py-3 text-sm font-semibold text-slate-800">${escapeHtml(route.destino || '—')}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(route.origen || 'AIFA')}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${route.frecuencia ? escapeHtml(route.frecuencia) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${route.distancia_km != null ? escapeHtml(route.distancia_km) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${route.tiempo_minutos != null ? escapeHtml(route.tiempo_minutos) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${route.tipo_operacion ? escapeHtml(route.tipo_operacion) : '—'}</td>
                        <td class="px-4 py-3 text-sm">
                          <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getBadgeClass(route.habilitada)}">
                            ${route.habilitada ? 'Activa' : 'Suspendida'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-slate-500">${route.notas ? escapeHtml(route.notas) : '—'}</td>
                        <td class="px-4 py-3 text-right text-sm">
                          <button type="button" class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-100" data-action="manage-route-airlines" data-id="${escapeHtml(route.id)}">
                            <i class="fa-solid fa-plane-departure"></i>
                            ${route.aerolineas?.length ? `${route.aerolineas.length} aerolínea${route.aerolineas.length === 1 ? '' : 's'}` : 'Gestionar'}
                          </button>
                        </td>
                        ${
                          allowEdition
                            ? `<td class="px-4 py-3 text-right text-sm">
                                <div class="inline-flex items-center gap-2">
                                  <button type="button" class="rounded-full border border-transparent p-2 text-primary-600 transition hover:border-primary-200 hover:bg-primary-50" data-action="edit-route" data-id="${escapeHtml(route.id)}" title="Editar ruta">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button type="button" class="rounded-full border border-transparent p-2 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" data-action="delete-route" data-id="${escapeHtml(route.id)}" title="Eliminar ruta">
                                    <i class="fa-solid fa-trash-can"></i>
                                  </button>
                                </div>
                              </td>`
                            : ''
                        }
                      </tr>
                    `)
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `;
}

function renderNavigationSection() {
  const aids = technicalState.ayudasNavegacion || [];

  return `
    <section class="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
      <div class="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-primary-500">Infraestructura crítica</p>
          <h2 class="text-2xl font-semibold text-slate-800">Ayudas a la navegación y sistemas</h2>
          <p class="text-sm text-slate-500">Detalle de equipos, ubicaciones y características principales en plataforma.</p>
        </div>
        ${
          allowEdition
            ? `<button type="button" class="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-700" data-action="add-navigation">
                <i class="fa-solid fa-plus-circle"></i>
                Nuevo registro
              </button>`
            : ''
        }
      </div>
      ${
        aids.length === 0
          ? `<div class="py-12 text-center text-slate-400">
              <p class="text-sm font-medium">No se han capturado ayudas a la navegación.</p>
              ${allowEdition ? '<p class="mt-2 text-xs text-slate-400">Registra el equipamiento disponible con el botón "Nuevo registro".</p>' : ''}
            </div>`
          : `
            <div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50/80">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Características</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</th>
                    ${allowEdition ? '<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>' : ''}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${sortEntries(aids, 'nombre')
                    .map(aid => `
                      <tr class="hover:bg-primary-50/40" data-id="${escapeHtml(aid.id)}">
                        <td class="px-4 py-3 text-sm font-semibold text-slate-700">${aid.codigo ? escapeHtml(aid.codigo) : '—'}</td>
                        <td class="px-4 py-3 text-sm font-semibold text-slate-800">${escapeHtml(aid.nombre || '—')}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${aid.tipo ? escapeHtml(aid.tipo) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-600">${aid.ubicacion ? escapeHtml(aid.ubicacion) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-500">${aid.caracteristicas ? escapeHtml(aid.caracteristicas) : '—'}</td>
                        <td class="px-4 py-3 text-sm text-slate-500">${aid.observaciones ? escapeHtml(aid.observaciones) : '—'}</td>
                        ${
                          allowEdition
                            ? `<td class="px-4 py-3 text-right text-sm">
                                <div class="inline-flex items-center gap-2">
                                  <button type="button" class="rounded-full border border-transparent p-2 text-primary-600 transition hover:border-primary-200 hover:bg-primary-50" data-action="edit-navigation" data-id="${escapeHtml(aid.id)}" title="Editar registro">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button type="button" class="rounded-full border border-transparent p-2 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" data-action="delete-navigation" data-id="${escapeHtml(aid.id)}" title="Eliminar registro">
                                    <i class="fa-solid fa-trash-can"></i>
                                  </button>
                                </div>
                              </td>`
                            : ''
                        }
                      </tr>
                    `)
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `;
}

function renderTechnicalView() {
  if (!hostContainer) return;
  hostContainer.innerHTML = `
    <div class="space-y-10">
      <div class="rounded-[32px] border border-primary-200/60 bg-gradient-to-br from-primary-50 via-white to-slate-50 p-6 shadow-xl shadow-primary-500/20">
        <h1 class="text-3xl font-semibold text-slate-800">Información técnica del Aeropuerto Internacional Felipe Ángeles</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600">
          Consulta y gestiona la ficha técnica del aeropuerto: datos generales, capacidades operativas, rutas aéreas y ayudas a la navegación. La información es editable para perfiles de nivel Subdirector, Director y Administrador.
        </p>
        ${allowEdition ? '<p class="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"><i class="fa-solid fa-lock-open"></i> Puedes editar esta sección</p>' : '<p class="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500"><i class="fa-solid fa-lock"></i> Vista de solo lectura</p>'}
      </div>
      ${renderGeneralInformationSection()}
      ${renderCapacitySection()}
      ${renderRoutesSection()}
      ${renderNavigationSection()}
    </div>
  `;
}

function bindActions(container) {
  if (!container || container.dataset.technicalBound) return;
  container.dataset.technicalBound = 'true';

  container.addEventListener('click', event => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    const id = actionElement.dataset.id;
    const category = actionElement.dataset.category;

    switch (action) {
      case 'add-general':
        if (allowEdition) {
          openGeneralInfoModal({ category });
        }
        break;
      case 'edit-general':
        if (!allowEdition) break;
        openGeneralInfoModal({ item: technicalState.informacionGeneral.find(entry => entry.id === id) });
        break;
      case 'delete-general':
        if (!allowEdition) break;
        confirmAndDeleteGeneral(id);
        break;
      case 'add-capacity':
        if (allowEdition) {
          openCapacityModal({ category });
        }
        break;
      case 'edit-capacity':
        if (!allowEdition) break;
        openCapacityModal({ item: technicalState.metricasCapacidad.find(entry => entry.id === id) });
        break;
      case 'delete-capacity':
        if (!allowEdition) break;
        confirmAndDeleteCapacity(id);
        break;
      case 'add-route':
        if (allowEdition) {
          openRouteModal();
        }
        break;
      case 'edit-route':
        if (!allowEdition) break;
        openRouteModal({ item: technicalState.rutasAereas.find(route => route.id === id) });
        break;
      case 'delete-route':
        if (!allowEdition) break;
        confirmAndDeleteRoute(id);
        break;
      case 'manage-route-airlines':
        openRouteAirlinesModal(id);
        break;
      case 'add-navigation':
        if (allowEdition) {
          openNavigationModal();
        }
        break;
      case 'edit-navigation':
        if (!allowEdition) break;
        openNavigationModal({ item: technicalState.ayudasNavegacion.find(aid => aid.id === id) });
        break;
      case 'delete-navigation':
        if (!allowEdition) break;
        confirmAndDeleteNavigation(id);
        break;
      default:
        break;
    }
  });
}

function openFormModal({ title, description, formFields, submitLabel, onSubmit, onDelete, deleteLabel }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center px-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/60" data-modal-close></div>
    <div class="relative z-10 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(title)}</h3>
          ${description ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>` : ''}
        </div>
        <button type="button" class="text-slate-400 transition hover:text-slate-600" data-modal-close>
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>
      <form class="space-y-4" data-modal-form>
        ${formFields}
        <div class="flex items-center justify-between pt-4">
          ${
            onDelete
              ? `<button type="button" class="text-sm font-semibold text-rose-600 transition hover:text-rose-700" data-modal-delete>${deleteLabel || 'Eliminar'}</button>`
              : '<span></span>'
          }
          <div class="flex gap-2">
            <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50" data-modal-close>Cancelar</button>
            <button type="submit" class="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700" data-modal-submit>${escapeHtml(submitLabel || 'Guardar')}</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-modal-close]').forEach(button => {
    button.addEventListener('click', () => overlay.remove());
  });

  const form = overlay.querySelector('[data-modal-form]');
  const submitButton = overlay.querySelector('[data-modal-submit]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!onSubmit) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';
    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      await onSubmit(payload);
      overlay.remove();
    } catch (error) {
      console.error(error);
      showToast(error?.message || 'No se pudo guardar la información', { type: 'error' });
      submitButton.disabled = false;
      submitButton.textContent = submitLabel || 'Guardar';
    }
  });

  if (onDelete) {
    const deleteButton = overlay.querySelector('[data-modal-delete]');
    deleteButton.addEventListener('click', async () => {
      deleteButton.disabled = true;
      deleteButton.textContent = 'Eliminando...';
      try {
        await onDelete();
        overlay.remove();
      } catch (error) {
        console.error(error);
        showToast(error?.message || 'No se pudo eliminar el registro', { type: 'error' });
        deleteButton.disabled = false;
        deleteButton.textContent = deleteLabel || 'Eliminar';
      }
    });
  }
}

function openGeneralInfoModal({ item, category } = {}) {
  const defaultCategory = item?.categoria || category || 'GENERAL';

  openFormModal({
    title: item ? 'Editar dato general' : 'Registrar dato general',
    description: 'Completa la información solicitada. Puedes agrupar los datos por categoría para organizarlos mejor.',
    submitLabel: item ? 'Actualizar dato' : 'Guardar dato',
    deleteLabel: 'Eliminar dato',
    formFields: `
      <input type="hidden" name="id" value="${item?.id ? escapeHtml(item.id) : ''}" />
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</label>
          <input type="text" name="categoria" value="${escapeHtml(defaultCategory)}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Orden</label>
          <input type="number" name="orden" value="${item?.orden ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Etiqueta</label>
        <input type="text" name="etiqueta" value="${escapeHtml(item?.etiqueta || '')}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</label>
        <textarea name="valor" rows="2" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.valor || '')}</textarea>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad</label>
          <input type="text" name="unidad" value="${escapeHtml(item?.unidad || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
          <textarea name="descripcion" rows="2" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.descripcion || '')}</textarea>
        </div>
      </div>
    `,
    onSubmit: async payload => {
      const submission = {
        ...payload,
        categoria: payload.categoria || defaultCategory,
        id: item?.id || payload.id || undefined
      };
      const saved = await upsertAirportGeneralInfo(submission);
      upsertGeneralInfoState(saved);
      renderTechnicalView();
      showToast(item ? 'Dato actualizado correctamente' : 'Dato registrado correctamente');
    },
    onDelete: item
      ? async () => {
          await deleteAirportGeneralInfo(item.id);
          removeGeneralInfoState(item.id);
          renderTechnicalView();
          showToast('Dato eliminado', { type: 'warning' });
        }
      : undefined
  });
}

function upsertGeneralInfoState(entry) {
  const list = technicalState.informacionGeneral || [];
  const index = list.findIndex(item => item.id === entry.id);
  if (index === -1) {
    technicalState.informacionGeneral = [...list, entry];
  } else {
    const updated = [...list];
    updated[index] = entry;
    technicalState.informacionGeneral = updated;
  }
}

function removeGeneralInfoState(id) {
  technicalState.informacionGeneral = (technicalState.informacionGeneral || []).filter(item => item.id !== id);
}

function openCapacityModal({ item, category } = {}) {
  const defaultCategory = item?.categoria || category || 'GENERAL';

  openFormModal({
    title: item ? 'Editar métrica de capacidad' : 'Registrar métrica de capacidad',
    description: 'Captura valores de capacidad y desempeño para seguimiento operativo.',
    submitLabel: item ? 'Actualizar métrica' : 'Guardar métrica',
    deleteLabel: 'Eliminar métrica',
    formFields: `
      <input type="hidden" name="id" value="${item?.id ? escapeHtml(item.id) : ''}" />
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</label>
          <input type="text" name="categoria" value="${escapeHtml(defaultCategory)}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Orden</label>
          <input type="number" name="orden" value="${item?.orden ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Indicador</label>
        <input type="text" name="nombre" value="${escapeHtml(item?.nombre || '')}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</label>
          <input type="text" name="valor" value="${escapeHtml(item?.valor || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad</label>
          <input type="text" name="unidad" value="${escapeHtml(item?.unidad || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</label>
          <input type="text" name="periodo" value="${escapeHtml(item?.periodo || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
          <textarea name="descripcion" rows="2" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.descripcion || '')}</textarea>
        </div>
      </div>
    `,
    onSubmit: async payload => {
      const submission = {
        ...payload,
        categoria: payload.categoria || defaultCategory,
        id: item?.id || payload.id || undefined
      };
      const saved = await upsertAirportCapacityMetric(submission);
      upsertCapacityState(saved);
      renderTechnicalView();
      showToast(item ? 'Métrica actualizada correctamente' : 'Métrica registrada correctamente');
    },
    onDelete: item
      ? async () => {
          await deleteAirportCapacityMetric(item.id);
          removeCapacityState(item.id);
          renderTechnicalView();
          showToast('Métrica eliminada', { type: 'warning' });
        }
      : undefined
  });
}

function upsertCapacityState(entry) {
  const list = technicalState.metricasCapacidad || [];
  const index = list.findIndex(item => item.id === entry.id);
  if (index === -1) {
    technicalState.metricasCapacidad = [...list, entry];
  } else {
    const updated = [...list];
    updated[index] = entry;
    technicalState.metricasCapacidad = updated;
  }
}

function removeCapacityState(id) {
  technicalState.metricasCapacidad = (technicalState.metricasCapacidad || []).filter(item => item.id !== id);
}

function openRouteModal({ item } = {}) {
  openFormModal({
    title: item ? 'Editar ruta aérea' : 'Registrar ruta aérea',
    description: 'Define los datos básicos de la ruta. La información de aerolíneas se gestiona por separado.',
    submitLabel: item ? 'Actualizar ruta' : 'Guardar ruta',
    deleteLabel: 'Eliminar ruta',
    formFields: `
      <input type="hidden" name="id" value="${item?.id ? escapeHtml(item.id) : ''}" />
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Origen</label>
          <input type="text" name="origen" value="${escapeHtml(item?.origen || 'AIFA')}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</label>
          <input type="text" name="destino" value="${escapeHtml(item?.destino || '')}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Frecuencia general</label>
        <input type="text" name="frecuencia" value="${escapeHtml(item?.frecuencia || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Distancia (km)</label>
          <input type="number" step="0.1" name="distancia_km" value="${item?.distancia_km ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tiempo estimado (min)</label>
          <input type="number" name="tiempo_minutos" value="${item?.tiempo_minutos ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Orden</label>
          <input type="number" name="orden" value="${item?.orden ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de operación</label>
          <input type="text" name="tipo_operacion" value="${escapeHtml(item?.tipo_operacion || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
          <textarea name="notas" rows="2" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.notas || '')}</textarea>
        </div>
      </div>
      <div class="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
        <input type="checkbox" name="habilitada" id="route-enabled" ${item?.habilitada !== false ? 'checked' : ''} class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
        <label for="route-enabled" class="text-sm text-slate-600">Ruta activa</label>
      </div>
    `,
    onSubmit: async payload => {
      const submission = {
        ...payload,
        id: item?.id || payload.id || undefined,
        habilitada: !!payload.habilitada && payload.habilitada !== 'false'
      };
      const saved = await upsertAirportRoute(submission);
      upsertRouteState(saved);
      renderTechnicalView();
      showToast(item ? 'Ruta actualizada correctamente' : 'Ruta registrada correctamente');
    },
    onDelete: item
      ? async () => {
          await deleteAirportRoute(item.id);
          removeRouteState(item.id);
          renderTechnicalView();
          showToast('Ruta eliminada', { type: 'warning' });
        }
      : undefined
  });
}

function upsertRouteState(route) {
  const list = technicalState.rutasAereas || [];
  const index = list.findIndex(item => item.id === route.id);
  if (index === -1) {
    technicalState.rutasAereas = [...list, { ...route, aerolineas: [] }];
  } else {
    const existingAirlines = list[index].aerolineas || [];
    const updated = [...list];
    updated[index] = { ...route, aerolineas: existingAirlines };
    technicalState.rutasAereas = updated;
  }
}

function removeRouteState(id) {
  technicalState.rutasAereas = (technicalState.rutasAereas || []).filter(route => route.id !== id);
}

function openNavigationModal({ item } = {}) {
  openFormModal({
    title: item ? 'Editar ayuda a la navegación' : 'Registrar ayuda a la navegación',
    description: 'Captura información relevante del equipamiento para seguimiento interno.',
    submitLabel: item ? 'Actualizar ayuda' : 'Guardar ayuda',
    deleteLabel: 'Eliminar ayuda',
    formFields: `
      <input type="hidden" name="id" value="${item?.id ? escapeHtml(item.id) : ''}" />
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Código</label>
          <input type="text" name="codigo" value="${escapeHtml(item?.codigo || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</label>
          <input type="text" name="nombre" value="${escapeHtml(item?.nombre || '')}" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
          <input type="text" name="tipo" value="${escapeHtml(item?.tipo || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación</label>
          <input type="text" name="ubicacion" value="${escapeHtml(item?.ubicacion || '')}" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Características</label>
        <textarea name="caracteristicas" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.caracteristicas || '')}</textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</label>
        <textarea name="observaciones" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">${escapeHtml(item?.observaciones || '')}</textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Orden</label>
        <input type="number" name="orden" value="${item?.orden ?? ''}" min="0" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
      </div>
    `,
    onSubmit: async payload => {
      const submission = {
        ...payload,
        id: item?.id || payload.id || undefined
      };
      const saved = await upsertAirportNavigationAid(submission);
      upsertNavigationState(saved);
      renderTechnicalView();
      showToast(item ? 'Registro actualizado correctamente' : 'Registro guardado correctamente');
    },
    onDelete: item
      ? async () => {
          await deleteAirportNavigationAid(item.id);
          removeNavigationState(item.id);
          renderTechnicalView();
          showToast('Registro eliminado', { type: 'warning' });
        }
      : undefined
  });
}

function upsertNavigationState(entry) {
  const list = technicalState.ayudasNavegacion || [];
  const index = list.findIndex(item => item.id === entry.id);
  if (index === -1) {
    technicalState.ayudasNavegacion = [...list, entry];
  } else {
    const updated = [...list];
    updated[index] = entry;
    technicalState.ayudasNavegacion = updated;
  }
}

function removeNavigationState(id) {
  technicalState.ayudasNavegacion = (technicalState.ayudasNavegacion || []).filter(item => item.id !== id);
}

function confirmAndDeleteGeneral(id) {
  if (!id) return;
  if (!window.confirm('¿Deseas eliminar este dato general?')) return;
  deleteAirportGeneralInfo(id)
    .then(() => {
      removeGeneralInfoState(id);
      renderTechnicalView();
      showToast('Dato eliminado', { type: 'warning' });
    })
    .catch(error => {
      console.error(error);
      showToast(error?.message || 'No se pudo eliminar el registro', { type: 'error' });
    });
}

function confirmAndDeleteCapacity(id) {
  if (!id) return;
  if (!window.confirm('¿Deseas eliminar esta métrica?')) return;
  deleteAirportCapacityMetric(id)
    .then(() => {
      removeCapacityState(id);
      renderTechnicalView();
      showToast('Métrica eliminada', { type: 'warning' });
    })
    .catch(error => {
      console.error(error);
      showToast(error?.message || 'No se pudo eliminar la métrica', { type: 'error' });
    });
}

function confirmAndDeleteRoute(id) {
  if (!id) return;
  if (!window.confirm('¿Deseas eliminar esta ruta aérea?')) return;
  deleteAirportRoute(id)
    .then(() => {
      removeRouteState(id);
      renderTechnicalView();
      showToast('Ruta eliminada', { type: 'warning' });
    })
    .catch(error => {
      console.error(error);
      showToast(error?.message || 'No se pudo eliminar la ruta', { type: 'error' });
    });
}

function confirmAndDeleteNavigation(id) {
  if (!id) return;
  if (!window.confirm('¿Deseas eliminar esta ayuda a la navegación?')) return;
  deleteAirportNavigationAid(id)
    .then(() => {
      removeNavigationState(id);
      renderTechnicalView();
      showToast('Registro eliminado', { type: 'warning' });
    })
    .catch(error => {
      console.error(error);
      showToast(error?.message || 'No se pudo eliminar el registro', { type: 'error' });
    });
}

function updateRouteAirlinesState(record) {
  if (!record?.ruta_id) return;
  const routes = technicalState.rutasAereas || [];
  const routeIndex = routes.findIndex(route => route.id === record.ruta_id);
  if (routeIndex === -1) return;

  const airlines = routes[routeIndex].aerolineas || [];
  const airlineIndex = airlines.findIndex(airline => airline.id === record.id);
  let updatedAirlines;
  if (airlineIndex === -1) {
    updatedAirlines = [...airlines, record];
  } else {
    updatedAirlines = [...airlines];
    updatedAirlines[airlineIndex] = record;
  }

  const updatedRoutes = [...routes];
  updatedRoutes[routeIndex] = { ...routes[routeIndex], aerolineas: updatedAirlines };
  technicalState.rutasAereas = updatedRoutes;
}

function removeRouteAirlineState(routeId, airlineId) {
  const routes = technicalState.rutasAereas || [];
  const routeIndex = routes.findIndex(route => route.id === routeId);
  if (routeIndex === -1) return;
  const airlines = routes[routeIndex].aerolineas || [];
  const updatedAirlines = airlines.filter(airline => airline.id !== airlineId);
  const updatedRoutes = [...routes];
  updatedRoutes[routeIndex] = { ...routes[routeIndex], aerolineas: updatedAirlines };
  technicalState.rutasAereas = updatedRoutes;
}

function openRouteAirlinesModal(routeId) {
  const route = technicalState.rutasAereas.find(item => item.id === routeId);
  if (!route) {
    showToast('No se encontró la ruta seleccionada', { type: 'error' });
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center px-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/60" data-modal-close></div>
    <div class="relative z-10 w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl">
      <div class="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-semibold text-slate-800">Aerolíneas por ruta</h3>
          <p class="text-sm text-slate-500">Ruta ${escapeHtml(route.origen || 'AIFA')} → ${escapeHtml(route.destino || '')}</p>
        </div>
        <button type="button" class="text-slate-400 transition hover:text-slate-600" data-modal-close>
          <i class="fa-solid fa-xmark text-2xl"></i>
        </button>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-2xl border border-slate-200/70 bg-slate-50/60">
          <div class="border-b border-slate-200 bg-white/70 px-4 py-3">
            <h4 class="text-sm font-semibold text-slate-700">Aerolíneas y frecuencias</h4>
          </div>
          <div class="max-h-[360px] space-y-2 overflow-y-auto px-4 py-4" data-airlines-list></div>
        </div>
        ${
          allowEdition
            ? `<form data-airline-form class="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                <h4 class="text-sm font-semibold text-slate-700">${route.aerolineas?.length ? 'Gestionar aerolínea' : 'Registrar aerolínea'}</h4>
                <p class="mt-1 text-xs text-slate-500">Captura una aerolínea para este destino y especifica la frecuencia.</p>
                <input type="hidden" name="id" />
                <div class="mt-4 space-y-4">
                  <div>
                    <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre de la aerolínea</label>
                    <input type="text" name="aerolinea" required class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Frecuencia</label>
                    <input type="text" name="frecuencia" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" placeholder="Ej. Diario, 3 vuelos semanales" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</label>
                    <textarea name="observaciones" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"></textarea>
                  </div>
                </div>
                <div class="mt-6 flex items-center justify-between">
                  <button type="button" class="hidden text-sm font-semibold text-slate-500 transition hover:text-slate-700" data-airline-cancel>Cancelar edición</button>
                  <div class="flex gap-2">
                    <button type="submit" class="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700" data-airline-submit>Guardar aerolínea</button>
                  </div>
                </div>
              </form>`
            : '<div class="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-500">Solo lectura para este perfil.</div>'
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-modal-close]').forEach(button => {
    button.addEventListener('click', () => overlay.remove());
  });

  const listContainer = overlay.querySelector('[data-airlines-list]');
  const form = overlay.querySelector('[data-airline-form]');
  const cancelButton = overlay.querySelector('[data-airline-cancel]');
  const submitButton = overlay.querySelector('[data-airline-submit]');

  function refreshAirlinesList() {
    const refreshedRoute = technicalState.rutasAereas.find(item => item.id === routeId) || route;
    const airlines = (refreshedRoute.aerolineas || []).slice().sort((a, b) => a.aerolinea.localeCompare(b.aerolinea, 'es', { sensitivity: 'base' }));
    if (!airlines.length) {
      listContainer.innerHTML = '<div class="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm text-slate-400">No hay aerolíneas registradas para esta ruta.</div>';
      return;
    }

    listContainer.innerHTML = airlines
      .map(airline => `
        <div class="flex items-start justify-between gap-4 rounded-xl bg-white/80 px-4 py-3 shadow-sm shadow-slate-900/5">
          <div>
            <p class="text-sm font-semibold text-slate-800">${escapeHtml(airline.aerolinea || '')}</p>
            <p class="text-xs text-slate-500">${airline.frecuencia ? escapeHtml(airline.frecuencia) : 'Sin frecuencia registrada'}</p>
            ${airline.observaciones ? `<p class="mt-1 text-xs text-slate-400">${escapeHtml(airline.observaciones)}</p>` : ''}
          </div>
          ${
            allowEdition
              ? `<div class="flex items-center gap-2 text-sm">
                  <button type="button" class="rounded-full border border-transparent p-2 text-primary-600 transition hover:border-primary-200 hover:bg-primary-50" data-modal-action="edit-airline" data-airline-id="${escapeHtml(airline.id)}" title="Editar aerolínea">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" class="rounded-full border border-transparent p-2 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" data-modal-action="delete-airline" data-airline-id="${escapeHtml(airline.id)}" title="Eliminar aerolínea">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>`
              : ''
          }
        </div>
      `)
      .join('');
  }

  refreshAirlinesList();

  if (form && allowEdition) {
    function resetForm() {
      form.reset();
      form.querySelector('input[name="id"]').value = '';
      if (cancelButton) {
        cancelButton.classList.add('hidden');
      }
      if (submitButton) {
        submitButton.textContent = 'Guardar aerolínea';
        submitButton.disabled = false;
      }
    }

    resetForm();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submitButton.disabled = true;
      submitButton.textContent = 'Guardando...';
      let payload;
      try {
        const formData = new FormData(form);
        payload = Object.fromEntries(formData.entries());
        const submission = {
          ...payload,
          ruta_id: routeId,
          id: payload.id || undefined
        };
        const saved = await upsertAirportRouteAirline(submission);
        updateRouteAirlinesState(saved);
        refreshAirlinesList();
        renderTechnicalView();
        showToast(payload.id ? 'Aerolínea actualizada' : 'Aerolínea registrada');
        resetForm();
      } catch (error) {
        console.error(error);
        showToast(error?.message || 'No se pudo guardar la aerolínea', { type: 'error' });
        submitButton.disabled = false;
        submitButton.textContent = payload?.id ? 'Actualizar aerolínea' : 'Guardar aerolínea';
      }
    });

    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        resetForm();
      });
    }

    overlay.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-modal-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.modalAction;
      const airlineId = actionButton.dataset.airlineId;

      if (action === 'edit-airline') {
        const refreshedRoute = technicalState.rutasAereas.find(item => item.id === routeId) || route;
        const airline = (refreshedRoute.aerolineas || []).find(item => item.id === airlineId);
        if (!airline) return;
        form.querySelector('input[name="id"]').value = airline.id;
        form.querySelector('input[name="aerolinea"]').value = airline.aerolinea || '';
        form.querySelector('input[name="frecuencia"]').value = airline.frecuencia || '';
        form.querySelector('textarea[name="observaciones"]').value = airline.observaciones || '';
        if (cancelButton) {
          cancelButton.classList.remove('hidden');
        }
        if (submitButton) {
          submitButton.textContent = 'Actualizar aerolínea';
          submitButton.disabled = false;
        }
      } else if (action === 'delete-airline') {
        if (!window.confirm('¿Deseas eliminar esta aerolínea de la ruta?')) return;
        deleteAirportRouteAirline(airlineId)
          .then(() => {
            removeRouteAirlineState(routeId, airlineId);
            refreshAirlinesList();
            renderTechnicalView();
            showToast('Aerolínea eliminada', { type: 'warning' });
            if (form.querySelector('input[name="id"]').value === airlineId) {
              resetForm();
            }
          })
          .catch(error => {
            console.error(error);
            showToast(error?.message || 'No se pudo eliminar la aerolínea', { type: 'error' });
          });
      }
    });
  }
}

export async function renderAirportTechnical(container) {
  if (!container) return;
  hostContainer = container;
  renderLoading(container, 'Cargando información técnica...');

  try {
    const userRole = (getUserRole() || '').toUpperCase();
    allowEdition = EDIT_ROLES.has(userRole);

    const data = await getAirportTechnicalData();
    technicalState = {
      informacionGeneral: data.informacionGeneral ?? [],
      metricasCapacidad: data.metricasCapacidad ?? [],
      rutasAereas: data.rutasAereas ?? [],
      ayudasNavegacion: data.ayudasNavegacion ?? []
    };

    renderTechnicalView();
    bindActions(container);
  } catch (error) {
    console.error('Error al cargar la información técnica del aeropuerto:', error);
    renderError(container, error);
  }
}
