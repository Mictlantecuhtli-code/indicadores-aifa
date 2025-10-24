import {
  getIndicators,
  getIndicatorHistory,
  getIndicatorTargets
} from '../services/supabaseClient.js';
import { formatNumber } from '../utils/formatters.js';
import { showToast } from '../ui/feedback.js';

function combineHistory(history = [], targets = []) {
  const rows = new Map();

  history.forEach(item => {
    const key = `${item.anio}-${item.mes}`;
    const value =
      item.valor ?? item.valor_medido ?? item.valor_real ?? item.valor_actual ?? item.cantidad ?? null;
    rows.set(key, {
      key,
      label: formatPeriod(item.anio, item.mes),
      real: value !== null && value !== undefined ? Number(value) : null,
      escenario: item.escenario ?? null
    });
  });

  targets.forEach(item => {
    const key = `${item.anio}-${item.mes}`;
    const scenario = (item.escenario ?? 'meta').toString().toLowerCase();
    const existing = rows.get(key) ?? {
      key,
      label: formatPeriod(item.anio, item.mes)
    };
    const value = item.valor ?? item.valor_meta ?? item.meta ?? null;
    rows.set(key, {
      ...existing,
      [`meta_${scenario}`]: value !== null && value !== undefined ? Number(value) : null
    });
  });

  return Array.from(rows.values()).sort((a, b) => (a.key > b.key ? 1 : -1));
}

function formatPeriod(year, month = 1) {
  const monthNames = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic'
  ];
  const label = monthNames[(month ?? 1) - 1] ?? '';
  return `${label} ${year}`.trim();
}

function renderChart(history = []) {
  if (!history.length) {
    return `
      <div class="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70">
        <div class="text-center text-sm text-slate-500">
          <i class="fa-solid fa-chart-line mb-2 text-lg"></i>
          No hay suficientes datos históricos para graficar este indicador.
        </div>
      </div>
    `;
  }

  const values = history.flatMap(row => [row.real, row.meta_bajo, row.meta_medio, row.meta_alto]).filter(v => v !== null && v !== undefined);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max !== min ? max : safeMin + 1;
  const width = 680;
  const height = 260;
  const padding = 40;
  const step = history.length > 1 ? (width - padding * 2) / (history.length - 1) : 0;

  function mapPoints(key) {
    return history
      .map((row, index) => {
        const value = row[key];
        if (value === null || value === undefined) return null;
        const x = padding + index * step;
        const y = padding + (1 - (value - safeMin) / (safeMax - safeMin)) * (height - padding * 2);
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');
  }

  const lineReal = mapPoints('real');
  const lineMetaBajo = mapPoints('meta_bajo');
  const lineMetaMedio = mapPoints('meta_medio');
  const lineMetaAlto = mapPoints('meta_alto');

  const axisLabels = history
    .map((row, index) => {
      const x = padding + index * step;
      return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="fill-slate-400 text-[10px]">${row.label}</text>`;
    })
    .join('');

  return `
    <div class="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <svg viewBox="0 0 ${width} ${height}" class="w-full" role="img" aria-label="Tendencia histórica del indicador">
        <defs>
          <linearGradient id="lineReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stop-color="rgba(30,58,138,0.35)" />
            <stop offset="95%" stop-color="rgba(30,58,138,0)" />
          </linearGradient>
        </defs>
        <rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" fill="none" stroke="#E2E8F0" stroke-width="1" />
        ${lineReal ? `<polyline points="${lineReal}" fill="none" stroke="#1E3A8A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${lineMetaBajo ? `<polyline points="${lineMetaBajo}" fill="none" stroke="#F97316" stroke-width="2" stroke-dasharray="6 3" />` : ''}
        ${lineMetaMedio ? `<polyline points="${lineMetaMedio}" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="6 3" />` : ''}
        ${lineMetaAlto ? `<polyline points="${lineMetaAlto}" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="6 3" />` : ''}
        ${axisLabels}
      </svg>
      <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span class="inline-flex items-center gap-2"><span class="h-2 w-8 rounded-full bg-[#1E3A8A]"></span> Valor real</span>
        <span class="inline-flex items-center gap-2"><span class="h-2 w-8 rounded-full bg-[#F97316]"></span> Meta escenario bajo</span>
        <span class="inline-flex items-center gap-2"><span class="h-2 w-8 rounded-full bg-[#0EA5E9]"></span> Meta escenario medio</span>
        <span class="inline-flex items-center gap-2"><span class="h-2 w-8 rounded-full bg-[#059669]"></span> Meta escenario alto</span>
      </div>
    </div>
  `;
}

function areaKey(indicator) {
  return String(
    indicator.area_id ??
      indicator.areaId ??
      indicator.area_codigo ??
      indicator.area ??
      indicator.area_nombre ??
      'sin-area'
  );
}

function areaName(indicator) {
  return indicator.area_nombre ?? indicator.area ?? 'Sin área asignada';
}

export async function renderVisualization(container) {
  container.innerHTML = `
    <div class="flex h-72 items-center justify-center">
      <div class="rounded-xl bg-white px-6 py-4 text-sm text-slate-500 shadow">Cargando indicadores...</div>
    </div>
  `;

  try {
    const indicators = await getIndicators();
    if (!indicators.length) {
      container.innerHTML = `
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
          No se encontraron indicadores disponibles para visualizar.
        </div>
      `;
      return;
    }

    const areasMap = new Map();
    indicators.forEach(indicator => {
      const key = areaKey(indicator);
      if (!areasMap.has(key)) {
        areasMap.set(key, {
          id: key,
          name: areaName(indicator)
        });
      }
    });

    let selectedArea = areasMap.keys().next().value;
    let selectedIndicator = indicators.find(item => areaKey(item) === selectedArea)?.id ?? indicators[0].id;

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Visualización de indicadores</h1>
            <p class="text-sm text-slate-500">
              Seleccione el área y posteriormente el indicador para consultar su tendencia histórica.
            </p>
          </div>
        </div>
        <div class="grid gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-2 lg:grid-cols-3">
          <label class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">Área</span>
            <div class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
              <i class="fa-solid fa-filter text-slate-400"></i>
              <select id="visualization-area" class="w-full border-none bg-transparent text-sm focus:outline-none"></select>
            </div>
          </label>
          <label class="flex flex-col gap-2 md:col-span-1 lg:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">Indicador</span>
            <div class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
              <i class="fa-solid fa-filter text-slate-400"></i>
              <select id="visualization-indicator" class="w-full border-none bg-transparent text-sm focus:outline-none"></select>
            </div>
            <p id="visualization-empty" class="hidden text-xs text-slate-400">No hay indicadores registrados para el área seleccionada.</p>
          </label>
        </div>
        <div class="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div class="space-y-4">
            <section class="rounded-2xl bg-white p-6 shadow" id="visualization-area-card"></section>
            <section class="rounded-2xl bg-white p-6 shadow" id="visualization-indicator-card"></section>
          </div>
          <section class="space-y-6 rounded-2xl bg-white p-6 shadow">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-400">Tendencia histórica</h3>
              <span id="visualization-status" class="text-xs text-slate-400">Actualizando datos...</span>
            </div>
            <div id="visualization-chart"></div>
            <div class="overflow-hidden rounded-xl border border-slate-100">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th class="px-4 py-2 text-left">Periodo</th>
                    <th class="px-4 py-2 text-right">Valor</th>
                    <th class="px-4 py-2 text-right">Escenario</th>
                  </tr>
                </thead>
                <tbody id="visualization-history" class="divide-y divide-slate-100"></tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    `;

    const areaSelect = container.querySelector('#visualization-area');
    const indicatorSelect = container.querySelector('#visualization-indicator');
    const emptyMessage = container.querySelector('#visualization-empty');
    const areaCard = container.querySelector('#visualization-area-card');
    const indicatorCard = container.querySelector('#visualization-indicator-card');
    const statusLabel = container.querySelector('#visualization-status');
    const chartContainer = container.querySelector('#visualization-chart');
    const historyBody = container.querySelector('#visualization-history');

    function renderAreaOptions() {
      areaSelect.innerHTML = Array.from(areasMap.values())
        .map(area => `<option value="${area.id}" ${area.id === selectedArea ? 'selected' : ''}>${area.name}</option>`)
        .join('');
    }

    function getIndicatorsForArea(areaId) {
      return indicators
        .filter(item => areaKey(item) === areaId)
        .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
    }

    function renderIndicatorOptions() {
      const indicatorsForArea = getIndicatorsForArea(selectedArea);
      indicatorSelect.innerHTML = indicatorsForArea
        .map(
          indicator => `
            <option value="${indicator.id}" ${String(indicator.id) === String(selectedIndicator) ? 'selected' : ''}>
              ${indicator.nombre}
            </option>
          `
        )
        .join('');
      indicatorSelect.disabled = indicatorsForArea.length === 0;
      emptyMessage.classList.toggle('hidden', indicatorsForArea.length > 0);
      if (!indicatorsForArea.length) {
        selectedIndicator = null;
      } else if (!indicatorsForArea.some(item => String(item.id) === String(selectedIndicator))) {
        selectedIndicator = indicatorsForArea[0].id;
      }
    }

    function renderAreaCard() {
      const areaInfo = areasMap.get(selectedArea);
      areaCard.innerHTML = `
        <p class="text-xs uppercase tracking-widest text-slate-400">Área seleccionada</p>
        <h2 class="mt-2 text-lg font-semibold text-slate-800">${areaInfo?.name ?? 'Seleccione un área'}</h2>
        <p class="mt-3 text-sm text-slate-500">Seleccione un indicador para visualizar su comportamiento histórico.</p>
      `;
    }

    function renderIndicatorCard(indicator) {
      if (!indicator) {
        indicatorCard.innerHTML = `
          <p class="text-xs uppercase tracking-widest text-slate-400">Indicador</p>
          <p class="mt-2 text-sm text-slate-500">No hay indicadores disponibles para esta área.</p>
        `;
        return;
      }

      indicatorCard.innerHTML = `
        <p class="text-xs uppercase tracking-widest text-slate-400">Indicador</p>
        <h2 class="mt-2 text-lg font-semibold text-slate-800">${indicator.nombre ?? 'Sin nombre'}</h2>
        ${indicator.descripcion ? `<p class="mt-3 text-sm text-slate-500">${indicator.descripcion}</p>` : ''}
        <div class="mt-4 grid gap-3 text-sm text-slate-500">
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-[11px] uppercase tracking-[0.35em] text-slate-400">Unidad</p>
            <p class="mt-1 text-base font-semibold text-slate-800">${indicator.unidad_medida ?? 'No definida'}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-[11px] uppercase tracking-[0.35em] text-slate-400">Meta vigente</p>
            <p class="mt-1 text-base font-semibold text-slate-800">${formatNumber(indicator.meta_vigente_valor)}</p>
            <p class="text-xs text-slate-500">Escenario ${indicator.meta_vigente_escenario ?? '—'}</p>
          </div>
        </div>
      `;
    }

    async function loadHistory() {
      if (!selectedIndicator) {
        chartContainer.innerHTML = renderChart([]);
        historyBody.innerHTML = `
          <tr>
            <td colspan="3" class="px-4 py-6 text-center text-slate-400">Seleccione un indicador para ver su historial.</td>
          </tr>
        `;
        statusLabel.textContent = 'Seleccione un indicador';
        return;
      }

      statusLabel.textContent = 'Actualizando datos...';
      try {
        const [history, targets] = await Promise.all([
          getIndicatorHistory(selectedIndicator, { limit: 36 }),
          getIndicatorTargets(selectedIndicator)
        ]);
        const combined = combineHistory(history, targets);
        chartContainer.innerHTML = renderChart(combined);
        historyBody.innerHTML = combined
          .map(
            row => `
              <tr>
                <td class="px-4 py-2 text-slate-600">${row.label}</td>
                <td class="px-4 py-2 text-right font-medium text-slate-800">${formatNumber(row.real)}</td>
                <td class="px-4 py-2 text-right text-slate-500">${row.escenario ?? '—'}</td>
              </tr>
            `
          )
          .join('');

        if (!combined.length) {
          historyBody.innerHTML = `
            <tr>
              <td colspan="3" class="px-4 py-6 text-center text-slate-400">No hay registros históricos para este indicador.</td>
            </tr>
          `;
        }
        statusLabel.textContent = 'Datos actualizados';
      } catch (error) {
        console.error(error);
        chartContainer.innerHTML = renderChart([]);
        historyBody.innerHTML = `
          <tr>
            <td colspan="3" class="px-4 py-6 text-center text-red-500">No fue posible obtener el historial del indicador.</td>
          </tr>
        `;
        statusLabel.textContent = 'Error al cargar los datos';
        showToast('No fue posible obtener el historial del indicador seleccionado.', { type: 'error' });
      }
    }

    renderAreaOptions();
    renderIndicatorOptions();
    renderAreaCard();
    const initialIndicator = indicators.find(item => String(item.id) === String(selectedIndicator)) ?? null;
    renderIndicatorCard(initialIndicator);
    await loadHistory();

    areaSelect.addEventListener('change', async event => {
      selectedArea = event.target.value;
      renderIndicatorOptions();
      renderAreaCard();
      const indicator = indicators.find(item => String(item.id) === String(selectedIndicator)) ?? null;
      renderIndicatorCard(indicator);
      await loadHistory();
    });

    indicatorSelect.addEventListener('change', async event => {
      const indicatorsForArea = getIndicatorsForArea(selectedArea);
      const selected = indicatorsForArea.find(item => String(item.id) === event.target.value);
      selectedIndicator = selected?.id ?? null;
      renderIndicatorCard(selected ?? null);
      await loadHistory();
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        No fue posible cargar la visualización de indicadores.
      </div>
    `;
    showToast('No fue posible cargar la visualización de indicadores.', { type: 'error' });
  }
}
