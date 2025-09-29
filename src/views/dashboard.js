import {
  getDashboardSummary,
  getDirectorsHighlights,
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets
} from '../services/supabaseClient.js';
import { formatNumber, formatPercentage, formatDate } from '../utils/formatters.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';
import { renderIndicatorChart } from '../ui/charts.js';

const OPERATIVE_NAMES = [
  'Aviación Comercial Pasajeros',
  'Aviación Comercial Operaciones',
  'Aviación Carga Operaciones',
  'Aviación Carga Toneladas'
];

const FBO_NAMES = ['Aviación General Pasajeros', 'Aviación General Operaciones'];

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
  ].filter((field) => field.key in data);

  return `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${fields
        .map((field) => {
          const value = data[field.key];
          const formatted =
            field.type === 'percentage' ? formatPercentage(value) : formatNumber(value, { decimals: 0 });
          return `
            <div class="rounded-2xl bg-white p-6 shadow border border-slate-100">
              <p class="text-xs uppercase tracking-widest text-slate-400">${field.label}</p>
              <p class="mt-3 text-3xl font-semibold text-slate-800">${formatted}</p>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildHighlightsTable(highlights) {
  if (!highlights?.length) {
    return `
      <div class="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        No se encontraron indicadores críticos registrados.
      </div>
    `;
  }

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Indicador</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Área</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Valor actual</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Meta</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Actualizado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${highlights
            .map((item) => {
              return `
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3 font-medium text-slate-700">${item.nombre ?? '—'}</td>
                  <td class="px-4 py-3 text-slate-500">${item.area ?? item.area_nombre ?? '—'}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(item.valor_actual)}</td>
                  <td class="px-4 py-3 text-right text-slate-500">${formatNumber(item.meta ?? item.valor_meta)}</td>
                  <td class="px-4 py-3 text-right text-slate-500">${formatDate(item.actualizado_en ?? item.fecha_actualizacion)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildIndicatorCard(indicator, active) {
  const categoryClass = OPERATIVE_NAMES.includes(indicator.nombre)
    ? 'bg-emerald-100 text-emerald-700'
    : FBO_NAMES.includes(indicator.nombre)
    ? 'bg-sky-100 text-sky-700'
    : 'bg-slate-100 text-slate-600';

  return `
    <button
      class="w-full text-left rounded-2xl border px-4 py-4 transition ${
        active ? 'border-transparent bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'border-slate-200 bg-white hover:border-slate-300'
      }"
      data-indicator="${indicator.id}"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-semibold">${indicator.nombre}</p>
          <p class="text-sm text-slate-400">${indicator.area_nombre ?? '—'}</p>
        </div>
        <span class="text-xs px-2 py-1 rounded-full ${categoryClass}">
          ${indicator.unidad_medida ?? 'Sin unidad'}
        </span>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-4 text-xs ${active ? 'text-slate-200' : 'text-slate-500'}">
        <span>
          Última medición:
          <strong class="ml-1">${formatNumber(indicator.ultima_medicion_valor)}</strong>
        </span>
        <span>
          Actualizado ${formatDate(indicator.ultima_medicion_fecha)}
        </span>
      </div>
    </button>
  `;
}

async function renderIndicatorDetail(indicator, container) {
  const panel = container.querySelector('#indicator-detail');
  if (!panel) return;
  panel.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900">${indicator.nombre}</h3>
          <p class="text-sm text-slate-500">${indicator.area_nombre ?? ''}</p>
        </div>
        <div class="text-right">
          <p class="text-xs uppercase text-slate-400">Valor actual</p>
          <p class="text-2xl font-semibold text-slate-800">${formatNumber(indicator.ultima_medicion_valor)}</p>
        </div>
      </div>
      <div class="mt-6">
        <div class="h-72" id="indicator-chart-wrapper">
          <canvas id="indicator-chart"></canvas>
        </div>
      </div>
    </div>
  `;

  const loader = panel.querySelector('#indicator-chart-wrapper');
  loader.innerHTML = `
    <div class="flex h-72 items-center justify-center text-slate-500">
      <i class="fa-solid fa-spinner animate-spin mr-2"></i>
      Cargando histórico...
    </div>
  `;

  try {
    const [history, targets] = await Promise.all([
      getIndicatorHistory(indicator.id, { limit: 24 }),
      getIndicatorTargets(indicator.id)
    ]);
    loader.innerHTML = '<canvas id="indicator-chart"></canvas>';
    renderIndicatorChart('indicator-chart', history, targets);
  } catch (error) {
    console.error(error);
    loader.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-600 rounded-xl p-6 text-sm">
        No fue posible cargar la información histórica.
      </div>
    `;
  }
}

export async function renderDashboard(container) {
  renderLoading(container, 'Preparando panel directivo...');
  try {
    const [summary, highlights, indicators] = await Promise.all([
      getDashboardSummary(),
      getDirectorsHighlights().catch(() => []),
      getIndicators()
    ]);

    if (!indicators.length) {
      container.innerHTML = `
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-slate-900">Panel directivo</h2>
          ${buildSummaryCards(summary)}
          <div class="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6">
            Aún no hay indicadores configurados en el sistema.
          </div>
        </div>
      `;
      return;
    }

    const activeIndicator = indicators[0];

    container.innerHTML = `
      <div class="space-y-8">
        <div class="flex flex-col gap-3">
          <h2 class="text-2xl font-semibold text-slate-900">Panel directivo</h2>
          <p class="text-sm text-slate-500">
            Revisión ejecutiva de indicadores operativos y FBO con seguimiento a cumplimiento de metas.
          </p>
        </div>
        ${buildSummaryCards(summary)}
        <div class="grid lg:grid-cols-[22rem_1fr] gap-6">
          <div class="space-y-4" id="indicator-list">
            <h3 class="text-sm font-semibold text-slate-600">Indicadores estratégicos</h3>
            <div class="space-y-3" id="indicator-buttons">
              ${indicators.map((indicator, index) => buildIndicatorCard(indicator, index === 0)).join('')}
            </div>
          </div>
          <div id="indicator-detail"></div>
        </div>
        <section class="space-y-4">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
            <h3 class="text-lg font-semibold text-slate-800">Indicadores que requieren atención</h3>
          </div>
          ${buildHighlightsTable(highlights)}
        </section>
      </div>
    `;

    await renderIndicatorDetail(activeIndicator, container);

    const buttons = container.querySelectorAll('#indicator-buttons button[data-indicator]');
    buttons.forEach((button) => {
      button.addEventListener('click', async () => {
        buttons.forEach((btn) => btn.classList.remove('border-transparent', 'bg-slate-900', 'text-white', 'shadow-lg', 'shadow-slate-900/20'));
        buttons.forEach((btn) => btn.classList.add('border-slate-200', 'bg-white'));
        button.classList.remove('border-slate-200', 'bg-white');
        button.classList.add('border-transparent', 'bg-slate-900', 'text-white', 'shadow-lg', 'shadow-slate-900/20');
        const selectedId = Number(button.dataset.indicator);
        const selected = indicators.find((item) => Number(item.id) === selectedId);
        if (!selected) return;
        await renderIndicatorDetail(selected, container);
      });
    });
  } catch (error) {
    console.error(error);
    renderError(container, error);
    showToast('No fue posible preparar el panel directivo.', { type: 'error' });
  }
}
