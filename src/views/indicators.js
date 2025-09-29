import { getIndicators } from '../services/supabaseClient.js';
import { formatNumber, formatDate } from '../utils/formatters.js';
import { renderLoading, renderError, showToast } from '../ui/feedback.js';

function buildTable(indicators) {
  if (!indicators.length) {
    return `
      <div class="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
        No se encontraron indicadores con los filtros seleccionados.
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
            <th class="px-4 py-3 text-left font-semibold text-slate-500">Unidad</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Valor actual</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Meta</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-500">Actualizado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${indicators
            .map((indicator) => {
              return `
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3 font-medium text-slate-700">${indicator.nombre}</td>
                  <td class="px-4 py-3 text-slate-500">${indicator.area_nombre ?? '—'}</td>
                  <td class="px-4 py-3 text-slate-500">${indicator.unidad_medida ?? '—'}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatNumber(indicator.ultima_medicion_valor)}</td>
                  <td class="px-4 py-3 text-right text-slate-500">${formatNumber(indicator.valor_meta ?? indicator.meta)}</td>
                  <td class="px-4 py-3 text-right text-slate-500">${formatDate(indicator.ultima_medicion_fecha)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function downloadCSV(records) {
  const header = ['Indicador', 'Área', 'Unidad', 'Valor actual', 'Meta', 'Actualizado'];
  const rows = records.map((item) => [
    item.nombre,
    item.area_nombre ?? '',
    item.unidad_medida ?? '',
    formatNumber(item.ultima_medicion_valor),
    formatNumber(item.valor_meta ?? item.meta),
    formatDate(item.ultima_medicion_fecha)
  ]);
  const csvContent = [header, ...rows].map((row) => row.map((col) => `"${(col ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'indicadores.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function renderIndicators(container) {
  renderLoading(container, 'Cargando indicadores...');
  try {
    const indicators = await getIndicators();
    const areas = Array.from(new Set(indicators.map((item) => item.area_nombre).filter(Boolean))).sort();

    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-semibold text-slate-900">Consulta de indicadores</h2>
          <p class="text-sm text-slate-500">Busca indicadores por nombre o filtra por área funcional.</p>
        </div>
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div class="flex flex-col gap-2 md:flex-row md:items-center">
            <label class="text-sm text-slate-500" for="search-indicator">Buscar:</label>
            <input
              id="search-indicator"
              type="search"
              placeholder="Nombre del indicador"
              class="w-full md:w-72 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div class="flex flex-col gap-2 md:flex-row md:items-center">
            <label class="text-sm text-slate-500" for="area-filter">Área:</label>
            <select
              id="area-filter"
              class="w-full md:w-56 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Todas</option>
              ${areas.map((area) => `<option value="${area}">${area}</option>`).join('')}
            </select>
          </div>
          <button
            id="export-csv"
            class="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <i class="fa-solid fa-file-csv"></i>
            Exportar CSV
          </button>
        </div>
        <div id="indicators-table"></div>
      </div>
    `;

    const state = {
      search: '',
      area: ''
    };

    const tableContainer = document.getElementById('indicators-table');

    function applyFilters() {
      const filtered = indicators.filter((indicator) => {
        const matchesSearch = indicator.nombre.toLowerCase().includes(state.search.toLowerCase());
        const matchesArea = !state.area || indicator.area_nombre === state.area;
        return matchesSearch && matchesArea;
      });
      tableContainer.innerHTML = buildTable(filtered);
    }

    document.getElementById('search-indicator').addEventListener('input', (event) => {
      state.search = event.target.value || '';
      applyFilters();
    });

    document.getElementById('area-filter').addEventListener('change', (event) => {
      state.area = event.target.value || '';
      applyFilters();
    });

    document.getElementById('export-csv').addEventListener('click', () => {
      const filtered = indicators.filter((indicator) => {
        const matchesSearch = indicator.nombre.toLowerCase().includes(state.search.toLowerCase());
        const matchesArea = !state.area || indicator.area_nombre === state.area;
        return matchesSearch && matchesArea;
      });
      if (!filtered.length) {
        showToast('No hay registros para exportar con los filtros actuales.', { type: 'warning' });
        return;
      }
      downloadCSV(filtered);
      showToast('Exportación generada correctamente.');
    });

    applyFilters();
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}
