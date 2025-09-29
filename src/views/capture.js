import {
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets,
  saveMeasurement,
  upsertTarget
} from '../services/supabaseClient.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { formatNumber, monthName, formatDate } from '../utils/formatters.js';

const months = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: monthName(index + 1)
}));

function buildHistoryTable(history) {
  if (!history.length) {
    return `
      <div class="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        No se han registrado mediciones para este indicador.
      </div>
    `;
  }

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
          ${history
            .map((item) => {
              return `
                <tr>
                  <td class="px-4 py-3 text-slate-600">${monthName(item.mes)} ${item.anio}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(item.valor)}</td>
                  <td class="px-4 py-3 text-slate-500">${item.escenario ?? '—'}</td>
                  <td class="px-4 py-3 text-right text-slate-400 text-xs">${formatDate(item.creado_en)}</td>
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
                  <td class="px-4 py-3 text-right text-slate-400 text-xs">${formatDate(item.fecha_ultima_edicion)}</td>
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
    const indicators = await getIndicators();
    if (!indicators.length) {
      container.innerHTML = `
        <div class="space-y-4">
          <h2 class="text-2xl font-semibold text-slate-900">Captura de indicadores</h2>
          <div class="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6">
            Debes registrar indicadores antes de capturar mediciones o metas.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-semibold text-slate-900">Captura de indicadores</h2>
          <p class="text-sm text-slate-500">
            Registra nuevas mediciones operativas y actualiza las metas por escenario.
          </p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-slate-600">Indicador operativo</span>
            <select id="indicator-select" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
              ${indicators.map((indicator) => `<option value="${indicator.id}">${indicator.nombre}</option>`).join('')}
            </select>
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-slate-600">Año</span>
            <input
              id="target-year"
              type="number"
              min="2022"
              max="2100"
              value="${new Date().getFullYear()}"
              class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>
        </div>
        <section class="grid gap-6 lg:grid-cols-2">
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-semibold text-slate-800 mb-4">Registrar medición</h3>
              <form id="measurement-form" class="space-y-4">
                <div class="grid gap-4 md:grid-cols-2">
                  <label class="flex flex-col gap-1 text-sm text-slate-600">
                    Mes
                    <select name="month" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
                      ${months.map((month) => `<option value="${month.value}">${month.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-sm text-slate-600">
                    Escenario
                    <select name="scenario" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
                      <option value="real">Real</option>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Valor
                  <input
                    name="value"
                    type="number"
                    step="0.01"
                    required
                    class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </label>
                <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  <i class="fa-solid fa-floppy-disk"></i>
                  Guardar medición
                </button>
              </form>
            </div>
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-slate-600">Histórico de mediciones</h3>
              <div id="history-table"></div>
            </div>
          </div>
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-semibold text-slate-800 mb-4">Actualizar metas</h3>
              <form id="target-form" class="space-y-4">
                <div class="grid gap-4 md:grid-cols-2">
                  <label class="flex flex-col gap-1 text-sm text-slate-600">
                    Mes
                    <select name="month" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
                      ${months.map((month) => `<option value="${month.value}">${month.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-sm text-slate-600">
                    Escenario
                    <select name="scenario" class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-sm text-slate-600">
                  Meta
                  <input
                    name="value"
                    type="number"
                    step="0.01"
                    required
                    class="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </label>
                <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                  <i class="fa-solid fa-bullseye"></i>
                  Guardar meta
                </button>
              </form>
            </div>
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-slate-600">Metas registradas</h3>
              <div id="targets-table"></div>
            </div>
          </div>
        </section>
      </div>
    `;

    const state = {
      indicatorId: Number(indicators[0].id),
      year: Number(document.getElementById('target-year').value)
    };

    const historyContainer = document.getElementById('history-table');
    const targetsContainer = document.getElementById('targets-table');

    async function refreshData() {
      historyContainer.innerHTML = '<div class="text-sm text-slate-500">Cargando mediciones...</div>';
      targetsContainer.innerHTML = '<div class="text-sm text-slate-500">Cargando metas...</div>';
      try {
        const [history, targets] = await Promise.all([
          getIndicatorHistory(state.indicatorId, { limit: 24 }),
          getIndicatorTargets(state.indicatorId, { year: state.year })
        ]);
        historyContainer.innerHTML = buildHistoryTable(history);
        targetsContainer.innerHTML = buildTargetsTable(targets);
      } catch (error) {
        console.error(error);
        historyContainer.innerHTML = '';
        targetsContainer.innerHTML = '';
        showToast('No fue posible consultar la información del indicador seleccionado.', { type: 'error' });
      }
    }

    document.getElementById('indicator-select').addEventListener('change', (event) => {
      state.indicatorId = Number(event.target.value);
      refreshData();
    });

    document.getElementById('target-year').addEventListener('change', (event) => {
      state.year = Number(event.target.value) || new Date().getFullYear();
      refreshData();
    });

    document.getElementById('measurement-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.classList.add('opacity-70');
      const formData = new FormData(form);
      const scenario = formData.get('scenario');

      const payload = {
        indicador_id: state.indicatorId,
        anio: state.year,
        mes: Number(formData.get('month')),
        valor: Number(formData.get('value')),
        escenario: scenario === 'real' ? null : scenario
      };

      try {
        await saveMeasurement(payload);
        showToast('Medición registrada correctamente.');
        form.reset();
        refreshData();
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible registrar la medición.', { type: 'error' });
      } finally {
        submit.disabled = false;
        submit.classList.remove('opacity-70');
      }
    });

    document.getElementById('target-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.classList.add('opacity-70');
      const formData = new FormData(form);

      const payload = {
        indicador_id: state.indicatorId,
        anio: state.year,
        mes: Number(formData.get('month')),
        escenario: formData.get('scenario'),
        valor: Number(formData.get('value'))
      };

      try {
        await upsertTarget(payload);
        showToast('Meta actualizada correctamente.');
        form.reset();
        refreshData();
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'No fue posible actualizar la meta.', { type: 'error' });
      } finally {
        submit.disabled = false;
        submit.classList.remove('opacity-70');
      }
    });

    await refreshData();
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}
