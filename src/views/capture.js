import {
  getIndicatorsByUserAreas,
  getUserCaptureAreas,
  getIndicatorHistory,
  getIndicatorTargets,
  saveMeasurement,
  updateMeasurement,
  validateMeasurement,
  upsertTarget
} from '../services/supabaseClient.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { formatNumber, monthName, formatDate } from '../utils/formatters.js';
import { getSession } from '../state/session.js';

const months = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: monthName(index + 1)
}));

const TARGET_YEARS = Array.from({ length: 11 }).map((_, index) => 2022 + index);

const SCENARIOS = ['BAJO', 'MEDIO', 'ALTO'];

let currentAreas = [];
let currentIndicators = [];
let selectedAreaId = null;
let selectedIndicatorId = null;
let currentYear = new Date().getFullYear();

function formatValidationStatus(status) {
  if (!status) return 'Pendiente';
  const normalized = status.toString().trim().toUpperCase();
  switch (normalized) {
    case 'VALIDADO':
      return 'Validado';
    case 'RECHAZADO':
      return 'Rechazado';
    default:
      return 'Pendiente';
  }
}

function getStatusBadgeClass(status) {
  switch ((status ?? '').toString().toUpperCase()) {
    case 'VALIDADO':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-600 border-red-200';
    default:
      return 'bg-amber-100 text-amber-700 border-amber-200';
  }
}

function buildHistoryTable(history, { showValidation = false } = {}) {
  if (!history.length) {
    return `
      <div class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        No se han registrado mediciones para este indicador.
      </div>
    `;
  }

  // Ordenar del más reciente al más antiguo
  const sortedHistory = [...history].sort((a, b) => {
    // Primero por año descendente
    if (b.anio !== a.anio) return b.anio - a.anio;
    // Luego por mes descendente
    return (b.mes || 0) - (a.mes || 0);
  });

  return `
    <div class="space-y-4">
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-500">Periodo</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-500">Valor</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-500">Capturado</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-500">Estatus</th>
              ${showValidation ? '<th class="px-4 py-3 text-center font-semibold text-slate-500">Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${sortedHistory
              .map((item) => {
                const status = (item.estatus_validacion ?? '').toString().toUpperCase();
                const badgeClass = getStatusBadgeClass(status);
                const statusLabel = formatValidationStatus(status);
                const canValidate = showValidation && status !== 'VALIDADO';
                return `
                  <tr>
                    <td class="px-4 py-3 text-slate-600">${monthName(item.mes)} ${item.anio}</td>
                    <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(item.valor)}</td>
                    <td class="px-4 py-3 text-right text-slate-400 text-xs">${formatDate(item.fecha_captura ?? item.creado_en)}</td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}">
                        ${statusLabel}
                      </span>
                      ${item.validado_por && item.fecha_validacion
                        ? `<p class="mt-1 text-[11px] text-slate-400">Validado el ${formatDate(item.fecha_validacion)}</p>`
                        : ''}
                    </td>
                    ${showValidation
                      ? `
                        <td class="px-4 py-3 text-center">
                          ${canValidate
                            ? `<input
                                type="checkbox"
                                class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                data-action="select-measurement"
                                data-measurement-id="${item.id}"
                              />`
                            : '<span class="text-xs text-slate-400">—</span>'}
                        </td>
                      `
                      : ''}
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      ${showValidation
        ? `
          <div class="flex justify-end">
            <button
              type="button"
              id="validate-selected"
              class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled
            >
              <i class="fa-solid fa-shield-check"></i>
              Validar seleccionadas
            </button>
          </div>
        `
        : ''}
    </div>
  `;
}

function normalizeScenarioValue(value) {
  return (value ?? '').toString().trim().toUpperCase();
}

function buildTargetRows(targets, scenario, unitLabel = '') {
  const normalizedScenario = normalizeScenarioValue(scenario) || SCENARIOS[0];
  const targetsByMonth = new Map(
    (targets ?? [])
      .filter(item => normalizeScenarioValue(item.escenario) === normalizedScenario)
      .map(item => [Number(item.mes), item])
  );

  return months
    .map((month) => {
      const target = targetsByMonth.get(month.value);
      const targetValue =
        target && target.valor !== null && target.valor !== undefined ? target.valor : '';
      const updatedAt = target?.fecha_actualizacion ?? target?.fecha_captura ?? null;
      const updatedLabel = updatedAt ? `Actualizado el ${formatDate(updatedAt)}` : '—';
      const normalizedValue = targetValue !== '' ? targetValue : '';

      return `
        <tr data-month="${month.value}">
          <td class="px-4 py-3 text-sm font-medium text-slate-600">${month.label}</td>
          <td class="px-4 py-3">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="number"
                step="0.0001"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                data-month="${month.value}"
                data-original-value="${normalizedValue}"
                data-target-id="${target?.id ?? ''}"
                value="${normalizedValue}"
                placeholder="Captura la meta${unitLabel ? ` (${unitLabel})` : ''}"
              />
            </div>
          </td>
          <td class="px-4 py-3 text-right text-xs text-slate-400">${updatedLabel}</td>
        </tr>
      `;
    })
    .join('');
}

export async function renderCapture(container) {
  renderLoading(container, 'Preparando módulo de captura...');
  
  try {
    const session = getSession();
    
    // Validar que exista sesión
    if (!session || !session.user) {
      container.innerHTML = `
        <div class="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6">
          No se pudo identificar el usuario. Por favor, inicie sesión nuevamente.
        </div>
      `;
      return;
    }

    // Extraer userId y userRole de la sesión
    const userId = session.user.id;
    const userRole = session.perfil?.rol_principal || session.perfil?.rol || 'usuario';

    console.log('Debug capture - userId:', userId);
    console.log('Debug capture - userRole:', userRole);

    // Cargar áreas donde el usuario puede capturar
    currentAreas = await getUserCaptureAreas(userId, userRole);
    
    if (!currentAreas.length) {
      container.innerHTML = `
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold text-slate-900">Captura de mediciones</h2>
          <div class="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6">
            No tienes áreas asignadas con permisos de captura. Contacta al administrador.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header con año -->
        <div class="rounded-2xl bg-blue-600 p-6 text-white shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold">Captura de Mediciones</h2>
              <p class="mt-1 text-sm text-blue-100">
                Registre los valores mensuales de los indicadores
              </p>
            </div>
            <div class="rounded-xl bg-white/20 px-6 py-4 text-center backdrop-blur">
              <p class="text-4xl font-bold">${currentYear}</p>
              <p class="text-xs uppercase tracking-wider text-blue-100">Año actual</p>
            </div>
          </div>
        </div>

        <!-- Selector de área e indicador -->
        <div class="rounded-2xl bg-white p-6 shadow">
          <div class="flex items-center gap-2 mb-4">
            <i class="fa-solid fa-filter text-blue-600"></i>
            <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-600">
              Seleccione indicador a capturar
            </h3>
          </div>
          
          <div class="grid gap-4 md:grid-cols-3">
            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-slate-600">
                Área <span class="text-red-500">*</span>
              </span>
              <select 
                id="area-select" 
                class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Seleccione un área...</option>
                ${currentAreas.map(ua => `
                  <option value="${ua.area_id}">${ua.areas?.nombre || 'Área sin nombre'}</option>
                `).join('')}
              </select>
            </label>
            
            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-slate-600">
                Indicador <span class="text-red-500">*</span>
              </span>
              <select 
                id="indicator-select" 
                class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled
              >
                <option value="">Primero seleccione un área...</option>
              </select>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-slate-600">Año</span>
              <input
                id="year-select"
                type="number"
                min="2022"
                max="2032"
                value="${currentYear}"
                class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
          </div>
        </div>

        <!-- Área de contenido (formularios y tablas) -->
        <div id="capture-content">
          <div class="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            <div class="text-center text-slate-400">
              <i class="fa-solid fa-clipboard-list mb-3 text-4xl"></i>
              <p class="text-sm font-medium">Seleccione un indicador</p>
              <p class="text-xs">Elija un área e indicador para comenzar a capturar mediciones</p>
            </div>
          </div>
        </div>
      </div>
    `;

    initializeCaptureListeners(userId, userRole);
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}

function initializeCaptureListeners(userId, userRole) {
  const areaSelect = document.getElementById('area-select');
  const indicatorSelect = document.getElementById('indicator-select');
  const yearSelect = document.getElementById('year-select');
  const contentArea = document.getElementById('capture-content');

  // Cambio de área
  areaSelect.addEventListener('change', async (e) => {
    selectedAreaId = e.target.value;
    selectedIndicatorId = null;
    
    if (!selectedAreaId) {
      indicatorSelect.innerHTML = '<option value="">Primero seleccione un área...</option>';
      indicatorSelect.disabled = true;
      showEmptyState(contentArea);
      return;
    }

    try {
      // Cargar indicadores del área
      const allIndicators = await getIndicatorsByUserAreas(userId, userRole);
      currentIndicators = allIndicators.filter(ind => ind.area_id === selectedAreaId);
      
      if (!currentIndicators.length) {
        indicatorSelect.innerHTML = '<option value="">No hay indicadores en esta área</option>';
        indicatorSelect.disabled = true;
        showEmptyState(contentArea);
        return;
      }

      indicatorSelect.innerHTML = `
        <option value="">Seleccione un indicador...</option>
        ${currentIndicators.map(ind => `
          <option value="${ind.id}">${ind.nombre}</option>
        `).join('')}
      `;
      indicatorSelect.disabled = false;
      showEmptyState(contentArea);
    } catch (error) {
      console.error(error);
      showToast('Error al cargar indicadores', { type: 'error' });
    }
  });

  // Cambio de indicador
  indicatorSelect.addEventListener('change', async (e) => {
    selectedIndicatorId = e.target.value;
    
    if (!selectedIndicatorId) {
      showEmptyState(contentArea);
      return;
    }

    await loadIndicatorContent(contentArea, selectedIndicatorId);
  });

  // Cambio de año
  yearSelect.addEventListener('change', (e) => {
    currentYear = parseInt(e.target.value) || new Date().getFullYear();
    if (selectedIndicatorId) {
      loadIndicatorContent(contentArea, selectedIndicatorId);
    }
  });
}

function showEmptyState(container) {
  container.innerHTML = `
    <div class="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
      <div class="text-center text-slate-400">
        <i class="fa-solid fa-clipboard-list mb-3 text-4xl"></i>
        <p class="text-sm font-medium">Seleccione un indicador</p>
        <p class="text-xs">Elija un área e indicador para comenzar a capturar mediciones</p>
      </div>
    </div>
  `;
}

async function loadIndicatorContent(container, indicatorId, forceReload = false) {
  container.innerHTML = '<div class="text-center py-8 text-slate-500">Cargando datos del indicador...</div>';

  try {
    const session = getSession();
    const rawRole =
      session?.perfil?.rol_principal || session?.perfil?.rol || session?.perfil?.puesto || 'usuario';
    const lowerCaseRole = rawRole.toString().toLowerCase();
    const normalizedRole =
      typeof lowerCaseRole.normalize === 'function'
        ? lowerCaseRole.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : lowerCaseRole;
    const esSubdirector = /subdirector|director|admin/.test(normalizedRole);
    
    const indicator = currentIndicators.find(ind => ind.id === indicatorId);
    
    if (!indicator) {
      container.innerHTML = '<div class="text-center py-8 text-red-500">Indicador no encontrado</div>';
      return;
    }

    // CAMBIO IMPORTANTE: Agregar nocache cuando forceReload es true
    // y aumentar el límite para ver más histórico
    const [history, targets] = await Promise.all([
      getIndicatorHistory(indicatorId, { 
        limit: 24, 
        year: currentYear,
        nocache: forceReload  // Forzar recarga desde servidor
      }),
      getIndicatorTargets(indicatorId, { 
        year: currentYear,
        nocache: forceReload  // Forzar recarga desde servidor
      })
    ]);

    // Log para debugging (opcional, puedes comentarlo después)
    if (forceReload) {
      console.log('🔄 Datos recargados desde servidor:', {
        historyCount: history?.length || 0,
        targetsCount: targets?.length || 0
      });
    }

    // Preparar catálogo de mediciones por mes del año seleccionado
    const currentYearMeasurements = (history ?? []).filter(item => item.anio === currentYear);
    const measurementsByMonth = new Map(
      currentYearMeasurements.map(item => [Number(item.mes), item])
    );

    const capturedMonths = new Set(currentYearMeasurements.map(item => Number(item.mes)));
    const availableMonths = months.filter(month => !capturedMonths.has(month.value));

    // Calcular el siguiente mes sugerido
    let nextMonth = new Date().getMonth() + 1; // Mes actual por defecto

    if (history && history.length > 0) {
      const lastCapture = history[0];
      if (lastCapture.anio === currentYear && lastCapture.mes) {
        nextMonth = (Number(lastCapture.mes) % 12) + 1;
        if (Number(lastCapture.mes) === 12) {
          nextMonth = 1;
        }
      }
    }

    const disableCaptureForm = !esSubdirector && availableMonths.length === 0;
    const suggestedMonth = esSubdirector
      ? nextMonth
      : availableMonths.length > 0
        ? availableMonths[0].value
        : nextMonth;

    const initialMeasurement = esSubdirector ? measurementsByMonth.get(suggestedMonth) : null;
    const initialValue = initialMeasurement ? initialMeasurement.valor ?? '' : '';
    const initialButtonLabel = initialMeasurement ? 'Actualizar medición' : 'Guardar medición';

    const monthOptions = months
      .map((month) => {
        const measurement = measurementsByMonth.get(month.value);
        const isCaptured = Boolean(measurement);
        const disabledAttr = !esSubdirector && isCaptured ? 'disabled' : '';
        const selectedAttr = month.value === suggestedMonth ? 'selected' : '';
        const statusLabel = isCaptured ? ` — ${formatNumber(measurement.valor)} (${formatValidationStatus(measurement.estatus_validacion)})` : '';
        return `
          <option value="${month.value}" ${selectedAttr} ${disabledAttr}>
            ${month.label}${statusLabel}
          </option>
        `;
      })
      .join('');

    // Construcción dinámica: solo 1 columna si NO es subdirector, 2 columnas si SÍ es
    const gridClass = esSubdirector ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

    const initialTargetYear = TARGET_YEARS.includes(currentYear)
      ? currentYear
      : TARGET_YEARS[0];
    const firstScenarioWithTargets = (targets ?? []).find(item =>
      SCENARIOS.includes(normalizeScenarioValue(item.escenario))
    );
    const initialTargetScenario = firstScenarioWithTargets
      ? normalizeScenarioValue(firstScenarioWithTargets.escenario)
      : SCENARIOS[0];
    const targetYearOptions = TARGET_YEARS.map(year => `
      <option value="${year}" ${year === initialTargetYear ? 'selected' : ''}>${year}</option>
    `).join('');
    const targetScenarioOptions = SCENARIOS.map(scenario => `
      <option value="${scenario}" ${scenario === initialTargetScenario ? 'selected' : ''}>${scenario}</option>
    `).join('');
    const targetRowsHtml = buildTargetRows(targets, initialTargetScenario, indicator.unidad_medida);

    container.innerHTML = `
      <section class="grid gap-6 ${gridClass}">
        <!-- Formulario de medición -->
        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <i class="fa-solid fa-pen-to-square"></i>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-slate-800">Registrar medición</h3>
                <p class="text-xs text-slate-500">${indicator.nombre}</p>
              </div>
            </div>
            <form
              id="measurement-form"
              class="space-y-4"
              data-disable-capture="${disableCaptureForm ? 'true' : 'false'}"
              data-editing-id="${initialMeasurement ? initialMeasurement.id : ''}"
            >
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Mes
                <select
                  name="month"
                  class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  ${disableCaptureForm ? 'disabled' : ''}
                >
                  ${monthOptions}
                </select>
              </label>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Valor ${indicator.unidad_medida ? `(${indicator.unidad_medida})` : ''}
                <input
                  name="value"
                  type="number"
                  step="0.0001"
                  required
                  class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ingrese el valor"
                  value="${initialValue}"
                  ${disableCaptureForm && !esSubdirector ? 'disabled' : ''}
                />
              </label>
              <button
                type="submit"
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                ${disableCaptureForm && !esSubdirector ? 'disabled' : ''}
              >
                <i class="fa-solid fa-floppy-disk"></i>
                <span id="measurement-submit-label">${initialButtonLabel}</span>
              </button>
              ${disableCaptureForm
                ? `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Todos los meses del ${currentYear} ya fueron capturados para este indicador. Contacte a su subdirección para realizar cambios.
                  </p>`
                : esSubdirector
                  ? '<p class="text-[11px] text-slate-400">Seleccione un mes ya capturado para editarlo. Las actualizaciones quedarán registradas y deberán validarse nuevamente.</p>'
                  : ''}
            </form>
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-slate-600">Histórico de mediciones</h3>
            <div id="history-table">${buildHistoryTable(history, { showValidation: esSubdirector })}</div>
          </div>
        </div>

        ${esSubdirector ? `
        <!-- Formulario de metas (solo para subdirectores) -->
        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <i class="fa-solid fa-bullseye"></i>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-slate-800">Actualizar metas</h3>
                <p class="text-xs text-slate-500">${indicator.nombre}</p>
              </div>
            </div>
            <form id="target-form" class="space-y-4" data-default-scenario="${initialTargetScenario}">
              <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Año
                  <select name="targetYear" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    ${targetYearOptions}
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Escenario
                  <select name="scenario" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    ${targetScenarioOptions}
                  </select>
                </label>
              </div>
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-4 py-3 text-left font-semibold text-slate-500">Mes</th>
                      <th class="px-4 py-3 text-left font-semibold text-slate-500">Meta ${indicator.unidad_medida ? `(${indicator.unidad_medida})` : ''}</th>
                      <th class="px-4 py-3 text-right font-semibold text-slate-500">Última actualización</th>
                    </tr>
                  </thead>
                  <tbody id="target-rows" class="divide-y divide-slate-100">
                    ${targetRowsHtml}
                  </tbody>
                </table>
              </div>
              <div class="flex justify-end">
                <button
                  type="submit"
                  id="target-submit"
                  class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled
                >
                  <i class="fa-solid fa-floppy-disk"></i>
                  Actualizar metas
                </button>
              </div>
              <p class="text-[11px] text-slate-400">Se guardarán únicamente los meses con cambios para el escenario seleccionado.</p>
            </form>
          </div>
        </div>
        ` : ''}
      </section>
    `;

    initializeFormHandlers(indicatorId, esSubdirector, history, container, targets, indicator);
  } catch (error) {
    console.error('Error al cargar indicador:', error);
    container.innerHTML = '<div class="text-center py-8 text-red-500">Error al cargar el indicador</div>';
    showToast('Error al cargar el indicador', { type: 'error' });
  }
}

function initializeFormHandlers(indicatorId, esSubdirector, history, container, initialTargets = [], indicator = null) {
  const measurementForm = document.getElementById('measurement-form');
  const targetForm = document.getElementById('target-form');
  const historyTable = document.getElementById('history-table');
  const measurementSubmitLabel = document.getElementById('measurement-submit-label');
  const targetRows = targetForm?.querySelector('#target-rows');
  const targetYearSelect = targetForm?.querySelector('select[name="targetYear"]');
  const targetScenarioSelect = targetForm?.querySelector('select[name="scenario"]');
  const targetSubmit = targetForm?.querySelector('#target-submit');
  const indicatorUnit = indicator?.unidad_medida ?? '';
  const historyValidateButton = historyTable?.querySelector('#validate-selected');

  const targetsCache = new Map();
  if (Array.isArray(initialTargets)) {
    const initialYear = targetYearSelect ? Number(targetYearSelect.value) : currentYear;
    targetsCache.set(initialYear, [...initialTargets]);
  }

  let selectedTargetYear = targetYearSelect ? Number(targetYearSelect.value) : currentYear;
  let selectedScenario = targetScenarioSelect
    ? normalizeScenarioValue(targetScenarioSelect.value || targetForm?.dataset?.defaultScenario)
    : SCENARIOS[0];
  if (!selectedScenario) {
    selectedScenario = SCENARIOS[0];
  }

  const parseTargetValue = (value) => {
    const trimmed = (value ?? '').toString().trim();
    if (trimmed === '') return null;
    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? NaN : numeric;
  };

  const collectTargetInputs = () =>
    Array.from(targetForm?.querySelectorAll('input[data-month]') ?? []);

  const hasTargetChanges = () => {
    const inputs = collectTargetInputs();
    return inputs.some((input) => {
      const currentValue = parseTargetValue(input.value);
      const originalValue = parseTargetValue(input.dataset.originalValue ?? '');

      if (Number.isNaN(currentValue)) {
        return true;
      }

      if (currentValue === null && originalValue === null) {
        return false;
      }

      return currentValue !== originalValue;
    });
  };

  const updateTargetSubmitState = () => {
    if (!targetSubmit) return;
    const hasChanges = hasTargetChanges();
    targetSubmit.disabled = !hasChanges;
    targetSubmit.classList.toggle('opacity-70', !hasChanges);
  };

  const attachTargetInputListeners = () => {
    const inputs = collectTargetInputs();
    inputs.forEach((input) => {
      input.addEventListener('input', updateTargetSubmitState);
    });
  };

  const renderTargetRows = (targets = []) => {
    if (!targetRows) return;
    targetRows.innerHTML = buildTargetRows(targets, selectedScenario, indicatorUnit);
    attachTargetInputListeners();
    updateTargetSubmitState();
  };

  const collectSelectedMeasurements = () =>
    Array.from(
      historyTable?.querySelectorAll('input[data-action="select-measurement"]:checked') ?? []
    );

  const updateHistorySelectionState = () => {
    if (!historyValidateButton) return;
    const hasSelection = collectSelectedMeasurements().length > 0;
    historyValidateButton.disabled = !hasSelection;
  };

  updateHistorySelectionState();

  const measurementsByMonth = new Map(
    (history ?? [])
      .filter(item => item.anio === currentYear)
      .map(item => [Number(item.mes), item])
  );

  // Handler para formulario de mediciones
  if (measurementForm) {
    const disableCapture = measurementForm.dataset.disableCapture === 'true';
    const monthSelect = measurementForm.querySelector('select[name="month"]');
    const valueInput = measurementForm.querySelector('input[name="value"]');
    const submitButton = measurementForm.querySelector('button[type="submit"]');

    if (disableCapture && !esSubdirector) {
      measurementForm.querySelectorAll('input, select, button').forEach(element => {
        element.disabled = true;
      });
    }

    const syncFormWithMonth = () => {
      if (!monthSelect || !valueInput || !submitButton) return;
      const monthValue = Number(monthSelect.value);
      const measurement = measurementsByMonth.get(monthValue);

      if (esSubdirector && measurement) {
        measurementForm.dataset.editingId = measurement.id ?? '';
        valueInput.value = measurement.valor ?? '';
        if (measurementSubmitLabel) {
          measurementSubmitLabel.textContent = 'Actualizar medición';
        }
      } else {
        measurementForm.dataset.editingId = '';
        if (!disableCapture || esSubdirector) {
          valueInput.value = '';
        }
        if (measurementSubmitLabel) {
          measurementSubmitLabel.textContent = 'Guardar medición';
        }
      }
    };

    if (esSubdirector && monthSelect) {
      monthSelect.addEventListener('change', syncFormWithMonth);
      syncFormWithMonth();
    } else if (monthSelect) {
      monthSelect.addEventListener('change', () => {
        measurementForm.dataset.editingId = '';
        if (measurementSubmitLabel) {
          measurementSubmitLabel.textContent = 'Guardar medición';
        }
      });
    }

    measurementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (disableCapture && !esSubdirector) {
        showToast('Todos los meses del año seleccionado ya fueron capturados', { type: 'info' });
        return;
      }
      const submit = measurementForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.classList.add('opacity-70');

      const formData = new FormData(measurementForm);

      const session = getSession();
      const userId = session?.user?.id;

      const editingId = measurementForm.dataset.editingId;
      let shouldRestoreSubmit = true;

      try {
        if (editingId) {
          await updateMeasurement(editingId, {
            valor: Number(formData.get('value')),
            editado_por: userId,
            estatus_validacion: 'PENDIENTE'
          });
          showToast('Medición actualizada correctamente');
        } else {
          await saveMeasurement({
            indicador_id: indicatorId,
            anio: currentYear,
            mes: Number(formData.get('month')),
            valor: Number(formData.get('value')),
            capturado_por: userId
          });
          showToast('Medición registrada correctamente');
        }

        shouldRestoreSubmit = false;
        submit.disabled = false;
        submit.classList.remove('opacity-70');
        await loadIndicatorContent(container, indicatorId, true);
        return;
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible registrar la medición', { type: 'error' });
      } finally {
        if (shouldRestoreSubmit) {
          submit.disabled = false;
          submit.classList.remove('opacity-70');
        }
      }
    });
  }

  // Handler para formulario de metas (solo si es subdirector)
  if (targetForm && esSubdirector) {
    const ensureTargetsForYear = async (year) => {
      if (targetsCache.has(year)) {
        return targetsCache.get(year);
      }

      if (targetRows) {
        targetRows.innerHTML = `
          <tr>
            <td colspan="3" class="px-4 py-6 text-center text-sm text-slate-500">
              Cargando metas del ${year}...
            </td>
          </tr>
        `;
      }

      try {
        const fetchedTargets = await getIndicatorTargets(indicatorId, { year });
        targetsCache.set(year, [...fetchedTargets]);
        return fetchedTargets;
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible obtener las metas del año seleccionado', { type: 'error' });
        if (targetRows) {
          targetRows.innerHTML = `
            <tr>
              <td colspan="3" class="px-4 py-6 text-center text-sm text-red-500">
                No fue posible cargar las metas del ${year}.
              </td>
            </tr>
          `;
        }
        throw error;
      }
    };

    if (targetScenarioSelect) {
      targetScenarioSelect.value = selectedScenario;
      targetScenarioSelect.addEventListener('change', () => {
        selectedScenario = normalizeScenarioValue(targetScenarioSelect.value);
        if (!selectedScenario) {
          selectedScenario = SCENARIOS[0];
        }
        const yearTargets = targetsCache.get(selectedTargetYear) ?? [];
        renderTargetRows(yearTargets);
      });
    }

    if (targetYearSelect) {
      targetYearSelect.addEventListener('change', async (event) => {
        const parsedYear = Number(event.target.value);
        if (!parsedYear) return;
        selectedTargetYear = parsedYear;

        try {
          const yearTargets = await ensureTargetsForYear(selectedTargetYear);
          renderTargetRows(yearTargets);
        } catch (error) {
          console.error(error);
        }
      });
    }

    renderTargetRows(targetsCache.get(selectedTargetYear) ?? []);

    targetForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inputs = collectTargetInputs();
      const changes = inputs
        .map((input) => {
          const month = Number(input.dataset.month);
          const rawValue = (input.value ?? '').toString();
          const parsedValue = parseTargetValue(rawValue);
          const originalValue = parseTargetValue(input.dataset.originalValue ?? '');
          const hasChange =
            Number.isNaN(parsedValue) || parsedValue !== originalValue;

          return {
            month,
            rawValue,
            value: parsedValue,
            originalValue,
            hasChange
          };
        })
        .filter(item => item.month && item.hasChange);

      if (!changes.length) {
        showToast('No hay cambios por guardar', { type: 'info' });
        updateTargetSubmitState();
        return;
      }

      for (const change of changes) {
        const trimmed = change.rawValue.toString().trim();
        if (trimmed === '') {
          showToast(`Ingresa un valor para la meta de ${monthName(change.month)}`, { type: 'warning' });
          return;
        }

        if (Number.isNaN(change.value)) {
          showToast(`Ingresa un valor numérico válido para la meta de ${monthName(change.month)}`, { type: 'warning' });
          return;
        }
      }

      const originalContent = targetSubmit ? targetSubmit.innerHTML : '';
      if (targetSubmit) {
        targetSubmit.disabled = true;
        targetSubmit.classList.add('opacity-70');
        targetSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
      }

      let yearTargets = targetsCache.get(selectedTargetYear) ?? [];

      try {
        for (const change of changes) {
          const payload = {
            indicador_id: indicatorId,
            anio: selectedTargetYear,
            mes: change.month,
            escenario: selectedScenario,
            valor: change.value
          };

          const updatedTarget = await upsertTarget(payload);

          const normalizedScenario = normalizeScenarioValue(updatedTarget.escenario);
          const monthValue = Number(change.month);
          const existingIndex = yearTargets.findIndex(
            item =>
              Number(item.mes) === monthValue &&
              normalizeScenarioValue(item.escenario) === normalizedScenario
          );

          if (existingIndex >= 0) {
            yearTargets = [
              ...yearTargets.slice(0, existingIndex),
              updatedTarget,
              ...yearTargets.slice(existingIndex + 1)
            ];
          } else {
            yearTargets = [...yearTargets, updatedTarget];
          }
        }

        targetsCache.set(selectedTargetYear, yearTargets);
        renderTargetRows(yearTargets);
        showToast('Metas actualizadas correctamente');
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible actualizar las metas', { type: 'error' });
      } finally {
        if (targetSubmit) {
          targetSubmit.disabled = false;
          targetSubmit.classList.remove('opacity-70');
          targetSubmit.innerHTML = originalContent;
          updateTargetSubmitState();
        }
      }
    });
  }

  if (historyTable && esSubdirector) {
    historyTable.addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-action="select-measurement"]');
      if (!checkbox) return;
      updateHistorySelectionState();
    });

if (historyValidateButton) {
  historyValidateButton.addEventListener('click', async () => {
    const selectedCheckboxes = collectSelectedMeasurements();
    console.log('📋 Mediciones seleccionadas:', selectedCheckboxes.length);
    
    if (!selectedCheckboxes.length) {
      showToast('Seleccione al menos una medición para validar', { type: 'warning' });
      return;
    }

    const originalContent = historyValidateButton.innerHTML;
    historyValidateButton.disabled = true;
    historyValidateButton.classList.add('opacity-70');
    historyValidateButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';

    try {
      const session = getSession();
      const profile = session?.perfil ?? session?.profile ?? null;
      
      // ✅ CAMBIO CRÍTICO: Usar profile.id en lugar de user.id
      const userId = profile?.id ?? null;

      if (!userId) {
        throw new Error('No se pudo identificar el perfil del usuario para la validación');
      }

      console.log('👤 Usuario validador (perfil ID):', userId);
      console.log('👤 Rol:', profile?.rol_principal);

      const validationPromises = selectedCheckboxes.map(checkbox => {
        const measurementId = checkbox.dataset.measurementId;
        console.log('🔄 Validando medición:', measurementId);
        if (!measurementId) {
          return Promise.reject(new Error('ID de medición no encontrado'));
        }
        return validateMeasurement(measurementId, { validado_por: userId });
      });

      const results = await Promise.allSettled(validationPromises);
      console.log('✅ Resultados de validación:', results);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0 && succeeded === 0) {
        showToast('No se pudo validar ninguna medición. Revise la consola para más detalles.', { type: 'error' });
        console.error('❌ Errores de validación:', results.filter(r => r.status === 'rejected'));
      } else if (failed > 0) {
        showToast(`Se validaron ${succeeded} mediciones. ${failed} fallaron.`, { type: 'warning' });
        console.error('⚠️ Algunas validaciones fallaron:', results.filter(r => r.status === 'rejected'));
      } else {
        showToast(`${succeeded} medición(es) validada(s) correctamente`, { type: 'success' });
        console.log('✨ Todas las validaciones completadas exitosamente');
      }

      console.log('🔄 Recargando contenido del indicador...');
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadIndicatorContent(container, indicatorId, true);
      console.log('✅ Contenido recargado');
      
    } catch (error) {
      console.error('💥 Error en el proceso de validación:', error);
      showToast(error.message ?? 'No fue posible validar las mediciones seleccionadas', { type: 'error' });
    } finally {
      historyValidateButton.disabled = false;
      historyValidateButton.classList.remove('opacity-70');
      historyValidateButton.innerHTML = originalContent;
      updateHistorySelectionState();
    }
  });
}
  }
}
