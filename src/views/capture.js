import {
  getIndicatorsByUserAreas,
  getUserCaptureAreas,
  getIndicatorHistory,
  getIndicatorTargets,
  saveMeasurement,
  upsertTarget
} from '../services/supabaseClient.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { formatNumber, monthName, formatDate } from '../utils/formatters.js';
import { getSession } from '../state/session.js';

const months = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: monthName(index + 1)
}));

const SCENARIOS = ['BAJO', 'MEDIO', 'ALTO'];

let currentAreas = [];
let currentIndicators = [];
let selectedAreaId = null;
let selectedIndicatorId = null;
let currentYear = new Date().getFullYear();

function buildHistoryTable(history) {
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
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Periodo</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Valor</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Escenario</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Capturado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${sortedHistory
            .map((item) => {
              return `
                <tr>
                  <td class="px-4 py-3 text-slate-600">${monthName(item.mes)} ${item.anio}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(item.valor)}</td>
                  <td class="px-4 py-3 text-slate-500">${item.escenario ?? '—'}</td>
                  <td class="px-4 py-3 text-right text-slate-400 text-xs">${formatDate(item.fecha_captura ?? item.creado_en)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildTargetsTable(targets) {
  if (!targets.length) {
    return `
      <div class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        No hay metas registradas para este indicador.
      </div>
    `;
  }
  
  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Periodo</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Meta</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Escenario</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Actualizado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${targets
            .map((item) => {
              return `
                <tr>
                  <td class="px-4 py-3 text-slate-600">${monthName(item.mes)} ${item.anio}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(item.valor)}</td>
                  <td class="px-4 py-3 text-slate-500">${item.escenario ?? '—'}</td>
                  <td class="px-4 py-3 text-right text-slate-400 text-xs">${formatDate(item.fecha_actualizacion ?? item.fecha_ultima_edicion)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
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
                max="2100"
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

async function loadIndicatorContent(container, indicatorId) {
  container.innerHTML = '<div class="text-center py-8 text-slate-500">Cargando datos del indicador...</div>';

  try {
    const session = getSession();
    const userRole = session?.perfil?.rol_principal || session?.perfil?.rol || 'usuario';
    const esSubdirector = userRole?.toLowerCase().includes('subdirector');
    
    const indicator = currentIndicators.find(ind => ind.id === indicatorId);
    
    if (!indicator) {
      container.innerHTML = '<div class="text-center py-8 text-red-500">Indicador no encontrado</div>';
      return;
    }

    const [history, targets] = await Promise.all([
      getIndicatorHistory(indicatorId, { limit: 12, year: currentYear }),
      getIndicatorTargets(indicatorId, { year: currentYear })
    ]);

    // Construcción dinámica: solo 1 columna si NO es subdirector, 2 columnas si SÍ es
    const gridClass = esSubdirector ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

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
            <form id="measurement-form" class="space-y-4">
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Mes
                <select name="month" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  ${months.map((month) => `
                    <option value="${month.value}" ${month.value === new Date().getMonth() + 1 ? 'selected' : ''}>
                      ${month.label}
                    </option>
                  `).join('')}
                </select>
              </label>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Valor ${indicator.unidad_medida ? `(${indicator.unidad_medida})` : ''}
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  required
                  class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ingrese el valor"
                />
              </label>
              <button type="submit" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <i class="fa-solid fa-floppy-disk"></i>
                Guardar medición
              </button>
            </form>
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-slate-600">Histórico de mediciones</h3>
            <div id="history-table">${buildHistoryTable(history)}</div>
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
            <form id="target-form" class="space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Mes
                  <select name="month" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    ${months.map((month) => `<option value="${month.value}">${month.label}</option>`).join('')}
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Escenario
                  <select name="scenario" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    ${SCENARIOS.map(s => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </label>
              </div>
              <label class="flex flex-col gap-1 text-sm text-slate-600">
                Meta ${indicator.unidad_medida ? `(${indicator.unidad_medida})` : ''}
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  required
                  class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Ingrese la meta"
                />
              </label>
              <button type="submit" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <i class="fa-solid fa-bullseye"></i>
                Guardar meta
              </button>
            </form>
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-slate-600">Metas registradas</h3>
            <div id="targets-table">${buildTargetsTable(targets)}</div>
          </div>
        </div>
        ` : ''}
      </section>
    `;

    initializeFormHandlers(indicatorId, esSubdirector);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="text-center py-8 text-red-500">Error al cargar el indicador</div>';
    showToast('Error al cargar el indicador', { type: 'error' });
  }
}

function initializeFormHandlers(indicatorId, esSubdirector) {
  const measurementForm = document.getElementById('measurement-form');
  const targetForm = document.getElementById('target-form');
  const historyTable = document.getElementById('history-table');
  const targetsTable = document.getElementById('targets-table');

  // Handler para formulario de mediciones
  if (measurementForm) {
    measurementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = measurementForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.classList.add('opacity-70');

      const formData = new FormData(measurementForm);

      const session = getSession();
      const userId = session?.user?.id;

      const payload = {
        indicador_id: indicatorId,
        anio: currentYear,
        mes: Number(formData.get('month')),
        valor: Number(formData.get('value')),
        capturado_por: userId
        // escenario removido - la tabla mediciones no tiene esta columna
      };

      try {
        await saveMeasurement(payload);
        showToast('Medición registrada correctamente');
        measurementForm.reset();
        
        // Recargar histórico del año actual
        const history = await getIndicatorHistory(indicatorId, { limit: 12, year: currentYear });
        historyTable.innerHTML = buildHistoryTable(history);
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible registrar la medición', { type: 'error' });
      } finally {
        submit.disabled = false;
        submit.classList.remove('opacity-70');
      }
    });
  }

  // Handler para formulario de metas (solo si es subdirector)
  if (targetForm && esSubdirector) {
    targetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = targetForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.classList.add('opacity-70');

      const formData = new FormData(targetForm);

      const payload = {
        indicador_id: indicatorId,
        anio: currentYear,
        mes: Number(formData.get('month')),
        escenario: (formData.get('scenario') ?? '').toString().toUpperCase(),
        valor: Number(formData.get('value'))
      };

      try {
        await upsertTarget(payload);
        showToast('Meta actualizada correctamente');
        targetForm.reset();
        
        // Recargar metas
        const targets = await getIndicatorTargets(indicatorId, { year: currentYear });
        targetsTable.innerHTML = buildTargetsTable(targets);
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible actualizar la meta', { type: 'error' });
      } finally {
        submit.disabled = false;
        submit.classList.remove('opacity-70');
      }
    });
  }
}
