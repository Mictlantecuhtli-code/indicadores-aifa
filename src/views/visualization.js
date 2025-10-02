/**
 * ═══════════════════════════════════════════════════════════════════
 * MÓDULO DE VISUALIZACIÓN AVANZADA DE INDICADORES
 * Sistema profesional de análisis y monitoreo de indicadores estratégicos
 * ═══════════════════════════════════════════════════════════════════
 */

import { getIndicators } from '../lib/supabaseClient.js';
import { showToast } from '../ui/toast.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  // Tipos de vista disponibles
  VIEW_TYPES: {
    EXECUTIVE: 'executive',      // Vista ejecutiva con KPIs
    COMPARATIVE: 'comparative',   // Comparación entre indicadores
    TEMPORAL: 'temporal',         // Análisis temporal
    HEATMAP: 'heatmap',          // Mapa de calor
    TABLE: 'table'               // Vista de tabla detallada
  },
  
  // Periodos disponibles
  PERIODS: {
    CURRENT_MONTH: 'current_month',
    CURRENT_QUARTER: 'current_quarter',
    CURRENT_YEAR: 'current_year',
    LAST_6_MONTHS: 'last_6_months',
    LAST_12_MONTHS: 'last_12_months',
    CUSTOM: 'custom'
  },
  
  // Colores para escenarios
  SCENARIO_COLORS: {
    BAJO: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', line: '#F97316' },
    MEDIO: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A', line: '#0EA5E9' },
    ALTO: { bg: '#D1FAE5', border: '#10B981', text: '#065F46', line: '#059669' },
    REAL: { bg: '#E0E7FF', border: '#4F46E5', text: '#312E81', line: '#1E3A8A' }
  },
  
  // Estados de alerta
  ALERT_LEVELS: {
    CRITICAL: { threshold: 0.7, color: '#EF4444', icon: 'fa-circle-exclamation' },
    WARNING: { threshold: 0.85, color: '#F59E0B', icon: 'fa-triangle-exclamation' },
    SUCCESS: { threshold: 1.0, color: '#10B981', icon: 'fa-circle-check' },
    EXCELLENT: { threshold: 1.15, color: '#06B6D4', icon: 'fa-star' }
  },
  
  // Configuración de gráficas
  CHART_CONFIG: {
    height: 400,
    animation: true,
    responsive: true,
    maintainAspectRatio: false
  }
};

// ═══════════════════════════════════════════════════════════════════
// ESTADO GLOBAL DE LA APLICACIÓN
// ═══════════════════════════════════════════════════════════════════

const STATE = {
  currentView: CONFIG.VIEW_TYPES.EXECUTIVE,
  selectedArea: 'all',
  selectedPeriod: CONFIG.PERIODS.CURRENT_YEAR,
  selectedIndicators: [],
  indicators: [],
  measurements: [],
  filteredData: [],
  customDateRange: {
    start: null,
    end: null
  }
};
// ═══════════════════════════════════════════════════════════════════
// ESTRUCTURA HTML PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

function getMainHTML() {
  return `
    <div class="space-y-6" id="advanced-visualization-container">
      
      <!-- HEADER -->
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-900">
            Visualización Avanzada de Indicadores
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Sistema integral de análisis y monitoreo de indicadores estratégicos
          </p>
        </div>
        
        <!-- Botones de acción rápida -->
        <div class="flex items-center gap-2">
          <button 
            type="button" 
            id="btn-export-data"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i class="fa-solid fa-download"></i>
            <span class="hidden sm:inline">Exportar</span>
          </button>
          <button 
            type="button" 
            id="btn-refresh-data"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i class="fa-solid fa-arrows-rotate"></i>
            <span class="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      <!-- PANEL DE FILTROS -->
      ${getFiltersPanel()}

      <!-- SELECTOR DE VISTAS -->
      ${getViewSelector()}

      <!-- MÉTRICAS RÁPIDAS -->
      <div id="quick-metrics-container">
        ${getQuickMetricsHTML()}
      </div>

      <!-- CONTENEDOR PRINCIPAL DE VISUALIZACIÓN -->
      <div id="main-visualization-area" class="min-h-[600px]">
        ${getLoadingPlaceholder()}
      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// PANEL DE FILTROS AVANZADOS
// ═══════════════════════════════════════════════════════════════════

function getFiltersPanel() {
  return `
    <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        <!-- Filtro: Área -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i class="fa-solid fa-building mr-1"></i>
            Área
          </label>
          <select 
            id="filter-area" 
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">Todas las áreas</option>
          </select>
        </div>

        <!-- Filtro: Periodo -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i class="fa-solid fa-calendar mr-1"></i>
            Periodo
          </label>
          <select 
            id="filter-period" 
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="current_year">Año actual</option>
            <option value="current_quarter">Trimestre actual</option>
            <option value="current_month">Mes actual</option>
            <option value="last_12_months">Últimos 12 meses</option>
            <option value="last_6_months">Últimos 6 meses</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        <!-- Filtro: Tipo de indicador -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i class="fa-solid fa-filter mr-1"></i>
            Tipo
          </label>
          <select 
            id="filter-type" 
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">Todos los tipos</option>
            <option value="operativos">Operativos</option>
            <option value="fbo">FBO</option>
            <option value="financieros">Financieros</option>
          </select>
        </div>

        <!-- Filtro: Estado -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <i class="fa-solid fa-signal mr-1"></i>
            Estado
          </label>
          <select 
            id="filter-status" 
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">Todos</option>
            <option value="critical">Críticos</option>
            <option value="warning">En advertencia</option>
            <option value="success">En meta</option>
            <option value="excellent">Sobresalientes</option>
          </select>
        </div>

      </div>

      <!-- Rango de fechas personalizado (oculto por defecto) -->
      <div id="custom-date-range" class="hidden mt-4 pt-4 border-t border-slate-200">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fecha inicio
            </label>
            <input 
              type="date" 
              id="custom-start-date"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fecha fin
            </label>
            <input 
              type="date" 
              id="custom-end-date"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      </div>

      <!-- Botón aplicar filtros -->
      <div class="mt-4 flex justify-end">
        <button 
          type="button" 
          id="btn-apply-filters"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <i class="fa-solid fa-check"></i>
          Aplicar filtros
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// SELECTOR DE VISTAS
// ═══════════════════════════════════════════════════════════════════

function getViewSelector() {
  const views = [
    { 
      id: CONFIG.VIEW_TYPES.EXECUTIVE, 
      label: 'Resumen Ejecutivo', 
      icon: 'fa-chart-line',
      description: 'KPIs principales y tendencias'
    },
    { 
      id: CONFIG.VIEW_TYPES.COMPARATIVE, 
      label: 'Comparativa', 
      icon: 'fa-chart-column',
      description: 'Comparación entre indicadores'
    },
    { 
      id: CONFIG.VIEW_TYPES.TEMPORAL, 
      label: 'Análisis Temporal', 
      icon: 'fa-chart-area',
      description: 'Evolución histórica'
    },
    { 
      id: CONFIG.VIEW_TYPES.HEATMAP, 
      label: 'Mapa de Calor', 
      icon: 'fa-table-cells',
      description: 'Estado general'
    },
    { 
      id: CONFIG.VIEW_TYPES.TABLE, 
      label: 'Tabla Detallada', 
      icon: 'fa-table',
      description: 'Datos completos'
    }
  ];

  return `
    <div class="overflow-x-auto">
      <div class="flex gap-2 pb-2">
        ${views.map(view => `
          <button
            type="button"
            data-view="${view.id}"
            class="view-selector-btn flex min-w-[180px] flex-col gap-1 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-primary-400 hover:bg-primary-50 ${
              STATE.currentView === view.id ? 'border-primary-500 bg-primary-50' : ''
            }"
          >
            <div class="flex items-center gap-2">
              <i class="fa-solid ${view.icon} text-lg ${
                STATE.currentView === view.id ? 'text-primary-600' : 'text-slate-400'
              }"></i>
              <span class="font-semibold text-slate-900">${view.label}</span>
            </div>
            <span class="text-xs text-slate-500">${view.description}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MÉTRICAS RÁPIDAS (KPIs)
// ═══════════════════════════════════════════════════════════════════

function getQuickMetricsHTML() {
  return `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      
      <!-- Total de indicadores -->
      <div class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-blue-100">Total Indicadores</p>
            <p class="mt-2 text-3xl font-bold" id="metric-total">-</p>
          </div>
          <div class="rounded-full bg-white/20 p-3">
            <i class="fa-solid fa-chart-line text-2xl"></i>
          </div>
        </div>
      </div>

      <!-- Indicadores críticos -->
      <div class="rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-red-100">Críticos</p>
            <p class="mt-2 text-3xl font-bold" id="metric-critical">-</p>
          </div>
          <div class="rounded-full bg-white/20 p-3">
            <i class="fa-solid fa-circle-exclamation text-2xl"></i>
          </div>
        </div>
      </div>

      <!-- Indicadores en meta -->
      <div class="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-green-100">En Meta</p>
            <p class="mt-2 text-3xl font-bold" id="metric-success">-</p>
          </div>
          <div class="rounded-full bg-white/20 p-3">
            <i class="fa-solid fa-circle-check text-2xl"></i>
          </div>
        </div>
      </div>

      <!-- Cumplimiento promedio -->
      <div class="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-purple-100">Cumplimiento Prom.</p>
            <p class="mt-2 text-3xl font-bold" id="metric-average">-</p>
          </div>
          <div class="rounded-full bg-white/20 p-3">
            <i class="fa-solid fa-percent text-2xl"></i>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// PLACEHOLDER DE CARGA
// ═══════════════════════════════════════════════════════════════════

function getLoadingPlaceholder() {
  return `
    <div class="flex items-center justify-center rounded-2xl bg-white p-12 shadow-sm">
      <div class="text-center">
        <div class="inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-slate-200 border-t-primary-600"></div>
        <p class="mt-4 text-sm text-slate-500">Cargando visualizaciones...</p>
      </div>
    </div>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// CARGA DE DATOS DESDE SUPABASE
// ═══════════════════════════════════════════════════════════════════

async function loadInitialData() {
  try {
    // Cargar todos los indicadores
    STATE.indicators = await getIndicators();
    
    if (!STATE.indicators || STATE.indicators.length === 0) {
      throw new Error('No se encontraron indicadores en la base de datos');
    }

    // Poblar select de áreas
    populateAreaFilter();
    
    // Aplicar filtros iniciales
    applyFilters();
    
    // Actualizar métricas rápidas
    updateQuickMetrics();
    
    console.log(`✅ Cargados ${STATE.indicators.length} indicadores`);
    
  } catch (error) {
    console.error('Error cargando datos iniciales:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// POBLAR FILTRO DE ÁREAS
// ═══════════════════════════════════════════════════════════════════

function populateAreaFilter() {
  const areaSelect = document.getElementById('filter-area');
  if (!areaSelect) return;

  // Extraer áreas únicas
  const areasMap = new Map();
  areasMap.set('all', 'Todas las áreas');

  STATE.indicators.forEach(indicator => {
    const areaId = indicator.area_id || indicator.areaId || 'sin-area';
    const areaName = indicator.area_nombre || indicator.area || 'Sin área';
    
    if (!areasMap.has(areaId)) {
      areasMap.set(areaId, areaName);
    }
  });

  // Generar opciones
  areaSelect.innerHTML = Array.from(areasMap.entries())
    .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
    .join('');
}

// ═══════════════════════════════════════════════════════════════════
// APLICAR FILTROS
// ═══════════════════════════════════════════════════════════════════

function applyFilters() {
  let filtered = [...STATE.indicators];

  // Filtrar por área
  if (STATE.selectedArea && STATE.selectedArea !== 'all') {
    filtered = filtered.filter(ind => {
      const areaId = String(ind.area_id || ind.areaId || 'sin-area');
      return areaId === STATE.selectedArea;
    });
  }

  // Filtrar por tipo (basado en categoría o nombre)
  const typeFilter = document.getElementById('filter-type')?.value;
  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(ind => {
      const categoria = (ind.categoria || '').toLowerCase();
      const nombre = (ind.nombre || '').toLowerCase();
      return categoria.includes(typeFilter) || nombre.includes(typeFilter);
    });
  }

  // Filtrar por estado (requiere datos de mediciones)
  const statusFilter = document.getElementById('filter-status')?.value;
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(ind => {
      const status = calculateIndicatorStatus(ind);
      return status === statusFilter;
    });
  }

  STATE.filteredData = filtered;
  console.log(`🔍 Filtrados: ${filtered.length} de ${STATE.indicators.length} indicadores`);
}

// ═══════════════════════════════════════════════════════════════════
// CALCULAR ESTADO DE UN INDICADOR
// ═══════════════════════════════════════════════════════════════════

function calculateIndicatorStatus(indicator) {
  // Esta función asume que el indicador tiene información de cumplimiento
  // Puedes ajustarla según tu estructura de datos
  
  const cumplimiento = indicator.cumplimiento || indicator.porcentaje_cumplimiento || 0;
  
  if (cumplimiento >= 1.15) return 'excellent';
  if (cumplimiento >= 1.0) return 'success';
  if (cumplimiento >= 0.85) return 'warning';
  return 'critical';
}

// ═══════════════════════════════════════════════════════════════════
// ACTUALIZAR MÉTRICAS RÁPIDAS (KPIs)
// ═══════════════════════════════════════════════════════════════════

function updateQuickMetrics() {
  const metrics = calculateMetrics(STATE.filteredData);
  
  // Actualizar DOM
  const totalEl = document.getElementById('metric-total');
  const criticalEl = document.getElementById('metric-critical');
  const successEl = document.getElementById('metric-success');
  const averageEl = document.getElementById('metric-average');

  if (totalEl) totalEl.textContent = metrics.total;
  if (criticalEl) criticalEl.textContent = metrics.critical;
  if (successEl) successEl.textContent = metrics.success;
  if (averageEl) averageEl.textContent = `${metrics.averageCompliance}%`;
}

// ═══════════════════════════════════════════════════════════════════
// CALCULAR MÉTRICAS
// ═══════════════════════════════════════════════════════════════════

function calculateMetrics(indicators) {
  const total = indicators.length;
  let critical = 0;
  let warning = 0;
  let success = 0;
  let excellent = 0;
  let totalCompliance = 0;

  indicators.forEach(indicator => {
    const status = calculateIndicatorStatus(indicator);
    const compliance = indicator.cumplimiento || indicator.porcentaje_cumplimiento || 0;
    
    totalCompliance += compliance * 100;
    
    switch (status) {
      case 'critical': critical++; break;
      case 'warning': warning++; break;
      case 'success': success++; break;
      case 'excellent': excellent++; break;
    }
  });

  return {
    total,
    critical,
    warning,
    success,
    excellent,
    averageCompliance: total > 0 ? Math.round(totalCompliance / total) : 0
  };
}
// ═══════════════════════════════════════════════════════════════════
// CONFIGURAR EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

function setupEventListeners() {
  
  // Selector de vistas
  document.querySelectorAll('.view-selector-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const viewType = e.currentTarget.dataset.view;
      await changeView(viewType);
    });
  });

  // Filtro de área
  const areaFilter = document.getElementById('filter-area');
  if (areaFilter) {
    areaFilter.addEventListener('change', (e) => {
      STATE.selectedArea = e.target.value;
    });
  }

  // Filtro de periodo
  const periodFilter = document.getElementById('filter-period');
  if (periodFilter) {
    periodFilter.addEventListener('change', (e) => {
      STATE.selectedPeriod = e.target.value;
      toggleCustomDateRange(e.target.value === 'custom');
    });
  }

  // Botón aplicar filtros
  const applyBtn = document.getElementById('btn-apply-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      applyBtn.disabled = true;
      applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...';
      
      try {
        applyFilters();
        updateQuickMetrics();
        await renderCurrentView();
        showToast('Filtros aplicados correctamente', { type: 'success' });
      } catch (error) {
        console.error('Error aplicando filtros:', error);
        showToast('Error al aplicar filtros', { type: 'error' });
      } finally {
        applyBtn.disabled = false;
        applyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Aplicar filtros';
      }
    });
  }

  // Botón refrescar datos
  const refreshBtn = document.getElementById('btn-refresh-data');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      
      try {
        await loadInitialData();
        await renderCurrentView();
        showToast('Datos actualizados', { type: 'success' });
      } catch (error) {
        console.error('Error refrescando datos:', error);
        showToast('Error al actualizar datos', { type: 'error' });
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span class="hidden sm:inline">Actualizar</span>';
      }
    });
  }

  // Botón exportar datos
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportToCSV(STATE.filteredData);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// CAMBIAR VISTA
// ═══════════════════════════════════════════════════════════════════

async function changeView(viewType) {
  STATE.currentView = viewType;
  
  // Actualizar botones de vista
  document.querySelectorAll('.view-selector-btn').forEach(btn => {
    if (btn.dataset.view === viewType) {
      btn.classList.add('border-primary-500', 'bg-primary-50');
      btn.querySelector('i').classList.remove('text-slate-400');
      btn.querySelector('i').classList.add('text-primary-600');
    } else {
      btn.classList.remove('border-primary-500', 'bg-primary-50');
      btn.querySelector('i').classList.remove('text-primary-600');
      btn.querySelector('i').classList.add('text-slate-400');
    }
  });

  // Renderizar nueva vista
  await renderCurrentView();
}

// ═══════════════════════════════════════════════════════════════════
// TOGGLE RANGO DE FECHAS PERSONALIZADO
// ═══════════════════════════════════════════════════════════════════

function toggleCustomDateRange(show) {
  const customRange = document.getElementById('custom-date-range');
  if (customRange) {
    if (show) {
      customRange.classList.remove('hidden');
    } else {
      customRange.classList.add('hidden');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAR A CSV
// ═══════════════════════════════════════════════════════════════════

function exportToCSV(data) {
  if (!data || data.length === 0) {
    showToast('No hay datos para exportar', { type: 'warning' });
    return;
  }

  try {
    // Crear encabezados
    const headers = [
      'ID',
      'Nombre',
      'Área',
      'Unidad de Medida',
      'Frecuencia',
      'Estado',
      'Cumplimiento %'
    ];

    // Crear filas
    const rows = data.map(ind => {
      const status = calculateIndicatorStatus(ind);
      const compliance = ((ind.cumplimiento || ind.porcentaje_cumplimiento || 0) * 100).toFixed(2);
      
      return [
        ind.id || '',
        ind.nombre || '',
        ind.area_nombre || ind.area || '',
        ind.unidad_medida || '',
        ind.frecuencia || '',
        status,
        compliance
      ];
    });

    // Construir CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `indicadores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Archivo CSV descargado correctamente', { type: 'success' });
    
  } catch (error) {
    console.error('Error exportando CSV:', error);
    showToast('Error al exportar datos', { type: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════════════
// RENDERIZAR VISTA ACTUAL (Router principal)
// ═══════════════════════════════════════════════════════════════════

async function renderCurrentView() {
  const container = document.getElementById('main-visualization-area');
  if (!container) return;

  // Mostrar loading
  container.innerHTML = getLoadingPlaceholder();

  try {
    switch (STATE.currentView) {
      case CONFIG.VIEW_TYPES.EXECUTIVE:
        await renderExecutiveView(container);
        break;
      case CONFIG.VIEW_TYPES.COMPARATIVE:
        await renderComparativeView(container);
        break;
      case CONFIG.VIEW_TYPES.TEMPORAL:
        await renderTemporalView(container);
        break;
      case CONFIG.VIEW_TYPES.HEATMAP:
        await renderHeatmapView(container);
        break;
      case CONFIG.VIEW_TYPES.TABLE:
        await renderTableView(container);
        break;
      default:
        container.innerHTML = '<div class="rounded-2xl bg-white p-8 shadow-sm text-center text-slate-500">Vista no reconocida</div>';
    }
  } catch (error) {
    console.error('Error renderizando vista:', error);
    container.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i class="fa-solid fa-circle-exclamation text-3xl text-red-500"></i>
        <p class="mt-4 text-sm text-red-600">Error al renderizar la vista: ${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}
// ═══════════════════════════════════════════════════════════════════
// VISTA EJECUTIVA - Resumen con KPIs principales
// ═══════════════════════════════════════════════════════════════════

async function renderExecutiveView(container) {
  const data = STATE.filteredData;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl bg-white p-12 shadow-sm text-center">
        <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p class="mt-4 text-slate-500">No hay indicadores que mostrar con los filtros aplicados</p>
      </div>
    `;
    return;
  }

  // Agrupar por estado
  const byStatus = {
    critical: data.filter(ind => calculateIndicatorStatus(ind) === 'critical'),
    warning: data.filter(ind => calculateIndicatorStatus(ind) === 'warning'),
    success: data.filter(ind => calculateIndicatorStatus(ind) === 'success'),
    excellent: data.filter(ind => calculateIndicatorStatus(ind) === 'excellent')
  };

  // Top 5 mejores y peores
  const sorted = [...data].sort((a, b) => {
    const compA = a.cumplimiento || 0;
    const compB = b.cumplimiento || 0;
    return compB - compA;
  });

  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  container.innerHTML = `
    <div class="space-y-6">
      
      <!-- Distribución por estado -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
          <i class="fa-solid fa-chart-pie text-primary-600 mr-2"></i>
          Distribución por Estado
        </h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${getStatusCard('Críticos', byStatus.critical.length, 'critical')}
          ${getStatusCard('Advertencia', byStatus.warning.length, 'warning')}
          ${getStatusCard('En Meta', byStatus.success.length, 'success')}
          ${getStatusCard('Sobresalientes', byStatus.excellent.length, 'excellent')}
        </div>
      </div>

      <!-- Gráfica de distribución -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
          <i class="fa-solid fa-chart-bar text-primary-600 mr-2"></i>
          Distribución de Cumplimiento
        </h3>
        <div class="h-80">
          ${renderDistributionChart(byStatus)}
        </div>
      </div>

      <!-- Top y Bottom performers -->
      <div class="grid gap-6 lg:grid-cols-2">
        
        <!-- Top 5 -->
        <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 class="text-lg font-semibold text-slate-900 mb-4">
            <i class="fa-solid fa-trophy text-yellow-500 mr-2"></i>
            Top 5 Indicadores
          </h3>
          <div class="space-y-3">
            ${top5.map((ind, idx) => getIndicatorRankCard(ind, idx + 1, 'top')).join('')}
          </div>
        </div>

        <!-- Bottom 5 -->
        <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 class="text-lg font-semibold text-slate-900 mb-4">
            <i class="fa-solid fa-triangle-exclamation text-red-500 mr-2"></i>
            Indicadores Críticos
          </h3>
          <div class="space-y-3">
            ${bottom5.map((ind, idx) => getIndicatorRankCard(ind, idx + 1, 'bottom')).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE VISTA EJECUTIVA
// ═══════════════════════════════════════════════════════════════════

function getStatusCard(label, count, type) {
  const colors = {
    critical: 'from-red-500 to-red-600',
    warning: 'from-orange-500 to-orange-600',
    success: 'from-green-500 to-green-600',
    excellent: 'from-blue-500 to-blue-600'
  };

  return `
    <div class="rounded-xl bg-gradient-to-br ${colors[type]} p-4 text-white">
      <p class="text-sm font-medium opacity-90">${label}</p>
      <p class="mt-2 text-3xl font-bold">${count}</p>
    </div>
  `;
}

function getIndicatorRankCard(indicator, rank, type) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  const colorClass = type === 'top' ? 'text-green-600' : 'text-red-600';
  
  return `
    <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
        ${rank}
      </span>
      <div class="flex-1 min-w-0">
        <p class="truncate text-sm font-medium text-slate-900">${escapeHtml(indicator.nombre || 'Sin nombre')}</p>
        <p class="text-xs text-slate-500">${escapeHtml(indicator.area_nombre || 'Sin área')}</p>
      </div>
      <span class="text-lg font-bold ${colorClass}">${compliance}%</span>
    </div>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// VISTA COMPARATIVA - Comparar múltiples indicadores
// ═══════════════════════════════════════════════════════════════════

async function renderComparativeView(container) {
  const data = STATE.filteredData.slice(0, 10); // Limitar a 10 para legibilidad
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl bg-white p-12 shadow-sm text-center">
        <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p class="mt-4 text-slate-500">No hay indicadores que comparar</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="space-y-6">
      
      <!-- Gráfica comparativa de barras -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900">
            <i class="fa-solid fa-chart-column text-primary-600 mr-2"></i>
            Comparativa de Cumplimiento
          </h3>
          <span class="text-xs text-slate-500">Mostrando ${data.length} indicadores</span>
        </div>
        <div class="h-96">
          ${renderComparativeBarChart(data)}
        </div>
      </div>

      <!-- Tabla comparativa -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
          <i class="fa-solid fa-table text-primary-600 mr-2"></i>
          Detalles Comparativos
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Indicador
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Área
                </th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Cumplimiento
                </th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              ${data.map(ind => getComparativeTableRow(ind)).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE VISTA COMPARATIVA
// ═══════════════════════════════════════════════════════════════════

function getComparativeTableRow(indicator) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  const statusConfig = {
    critical: { label: 'Crítico', class: 'bg-red-100 text-red-800' },
    warning: { label: 'Advertencia', class: 'bg-orange-100 text-orange-800' },
    success: { label: 'En Meta', class: 'bg-green-100 text-green-800' },
    excellent: { label: 'Sobresaliente', class: 'bg-blue-100 text-blue-800' }
  };

  const config = statusConfig[status] || statusConfig.warning;

  return `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 text-sm text-slate-900">
        ${escapeHtml(indicator.nombre || 'Sin nombre')}
      </td>
      <td class="px-4 py-3 text-sm text-slate-600">
        ${escapeHtml(indicator.area_nombre || 'Sin área')}
      </td>
      <td class="px-4 py-3 text-center">
        <span class="text-sm font-semibold text-slate-900">${compliance}%</span>
      </td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium ${config.class}">
          ${config.label}
        </span>
      </td>
    </tr>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// VISTA TEMPORAL - Análisis de evolución histórica
// ═══════════════════════════════════════════════════════════════════

async function renderTemporalView(container) {
  const data = STATE.filteredData;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl bg-white p-12 shadow-sm text-center">
        <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p class="mt-4 text-slate-500">No hay datos históricos disponibles</p>
      </div>
    `;
    return;
  }

  // Simular datos temporales (en producción vendrían de la BD)
  const temporalData = generateTemporalData(data[0]);

  container.innerHTML = `
    <div class="space-y-6">
      
      <!-- Selector de indicador -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold text-slate-700">
            <i class="fa-solid fa-chart-line text-primary-600 mr-2"></i>
            Seleccionar Indicador
          </span>
          <select 
            id="temporal-indicator-select"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            ${data.map(ind => `
              <option value="${ind.id}">${escapeHtml(ind.nombre || 'Sin nombre')}</option>
            `).join('')}
          </select>
        </label>
      </div>

      <!-- Gráfica de línea temporal -->
      <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
          <i class="fa-solid fa-chart-area text-primary-600 mr-2"></i>
          Evolución Temporal
        </h3>
        <div class="h-96">
          ${renderTemporalLineChart(temporalData)}
        </div>
      </div>

      <!-- Estadísticas temporales -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${getTemporalStatCard('Promedio', '87.5%', 'fa-calculator', 'blue')}
        ${getTemporalStatCard('Máximo', '95.2%', 'fa-arrow-up', 'green')}
        ${getTemporalStatCard('Mínimo', '78.3%', 'fa-arrow-down', 'red')}
        ${getTemporalStatCard('Tendencia', '+2.3%', 'fa-chart-line', 'purple')}
      </div>

    </div>
  `;

  // Event listener para cambio de indicador
  const selectEl = document.getElementById('temporal-indicator-select');
  if (selectEl) {
    selectEl.addEventListener('change', async (e) => {
      const selectedId = e.target.value;
      const selectedIndicator = data.find(ind => String(ind.id) === selectedId);
      if (selectedIndicator) {
        const newTemporalData = generateTemporalData(selectedIndicator);
        const chartContainer = selectEl.closest('.space-y-6').querySelector('.h-96');
        if (chartContainer) {
          chartContainer.innerHTML = renderTemporalLineChart(newTemporalData);
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE VISTA TEMPORAL
// ═══════════════════════════════════════════════════════════════════

function getTemporalStatCard(label, value, icon, color) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return `
    <div class="rounded-xl bg-gradient-to-br ${colors[color]} p-4 text-white">
      <div class="flex items-center gap-2 text-sm font-medium opacity-90">
        <i class="fa-solid ${icon}"></i>
        <span>${label}</span>
      </div>
      <p class="mt-2 text-2xl font-bold">${value}</p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// GENERAR DATOS TEMPORALES SIMULADOS
// ═══════════════════════════════════════════════════════════════════

function generateTemporalData(indicator) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const baseValue = (indicator.cumplimiento || 0.85) * 100;
  
  return months.map((month, idx) => {
    const variation = (Math.random() - 0.5) * 10;
    const value = Math.max(60, Math.min(120, baseValue + variation));
    return { label: month, value };
  });
}
// ═══════════════════════════════════════════════════════════════════
// VISTA MAPA DE CALOR - Estado general de indicadores
// ═══════════════════════════════════════════════════════════════════

async function renderHeatmapView(container) {
  const data = STATE.filteredData;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl bg-white p-12 shadow-sm text-center">
        <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p class="mt-4 text-slate-500">No hay indicadores para visualizar</p>
      </div>
    `;
    return;
  }

  // Agrupar por área
  const byArea = {};
  data.forEach(ind => {
    const area = ind.area_nombre || 'Sin área';
    if (!byArea[area]) byArea[area] = [];
    byArea[area].push(ind);
  });

  container.innerHTML = `
    <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-slate-900">
          <i class="fa-solid fa-table-cells text-primary-600 mr-2"></i>
          Mapa de Calor - Estado de Indicadores
        </h3>
        <p class="mt-1 text-sm text-slate-500">
          Vista general del cumplimiento por área e indicador
        </p>
      </div>

      <!-- Leyenda -->
      <div class="mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-4">
        <span class="text-sm font-medium text-slate-700">Leyenda:</span>
        ${getHeatmapLegendItem('Crítico', '#EF4444')}
        ${getHeatmapLegendItem('Advertencia', '#F59E0B')}
        ${getHeatmapLegendItem('En Meta', '#10B981')}
        ${getHeatmapLegendItem('Sobresaliente', '#3B82F6')}
      </div>

      <!-- Mapa de calor -->
      <div class="space-y-6">
        ${Object.entries(byArea).map(([area, indicators]) => 
          renderHeatmapArea(area, indicators)
        ).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE MAPA DE CALOR
// ═══════════════════════════════════════════════════════════════════

function getHeatmapLegendItem(label, color) {
  return `
    <div class="flex items-center gap-2">
      <div class="h-4 w-4 rounded" style="background-color: ${color}"></div>
      <span class="text-xs text-slate-600">${label}</span>
    </div>
  `;
}

function renderHeatmapArea(areaName, indicators) {
  return `
    <div class="space-y-3">
      <h4 class="font-semibold text-slate-900">${escapeHtml(areaName)}</h4>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        ${indicators.map(ind => renderHeatmapCell(ind)).join('')}
      </div>
    </div>
  `;
}

function renderHeatmapCell(indicator) {
  const status = calculateIndicatorStatus(indicator);
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  
  const colorMap = {
    critical: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    excellent: '#3B82F6'
  };

  const bgColor = colorMap[status];

  return `
    <div 
      class="group relative cursor-pointer rounded-lg border-2 border-slate-200 p-3 transition hover:border-slate-400 hover:shadow-md"
      style="background-color: ${bgColor}20"
      title="${escapeHtml(indicator.nombre || 'Sin nombre')} - ${compliance}%"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="flex-1 truncate text-sm font-medium text-slate-900">
          ${escapeHtml((indicator.nombre || 'Sin nombre').substring(0, 30))}
        </p>
        <span class="text-xs font-bold text-slate-700">${compliance}%</span>
      </div>
      <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/50">
        <div 
          class="h-full rounded-full transition-all"
          style="width: ${compliance}%; background-color: ${bgColor}"
        ></div>
      </div>
    </div>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// VISTA DE TABLA DETALLADA - Tabla completa con todos los datos
// ═══════════════════════════════════════════════════════════════════

async function renderTableView(container) {
  const data = STATE.filteredData;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl bg-white p-12 shadow-sm text-center">
        <i class="fa-solid fa-inbox text-5xl text-slate-300"></i>
        <p class="mt-4 text-slate-500">No hay datos para mostrar en la tabla</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="rounded-2xl bg-white shadow-sm border border-slate-200">
      
      <!-- Header de la tabla -->
      <div class="border-b border-slate-200 p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              <i class="fa-solid fa-table text-primary-600 mr-2"></i>
              Tabla Detallada de Indicadores
            </h3>
            <p class="mt-1 text-sm text-slate-500">
              ${data.length} indicador${data.length !== 1 ? 'es' : ''} encontrado${data.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              id="btn-export-table"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <i class="fa-solid fa-file-excel"></i>
              Exportar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Indicador
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Área
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Unidad
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Frecuencia
              </th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Cumplimiento
              </th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Estado
              </th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                Acción
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white">
            ${data.map(ind => getDetailedTableRow(ind)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer con paginación (opcional) -->
      <div class="border-t border-slate-200 px-6 py-4">
        <div class="flex items-center justify-between text-sm text-slate-600">
          <span>Mostrando ${data.length} de ${STATE.indicators.length} indicadores totales</span>
          <span>Última actualización: ${new Date().toLocaleDateString('es-MX')}</span>
        </div>
      </div>

    </div>
  `;

  // Event listener para botón de exportar en la tabla
  const exportTableBtn = document.getElementById('btn-export-table');
  if (exportTableBtn) {
    exportTableBtn.addEventListener('click', () => {
      exportToCSV(data);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DE TABLA DETALLADA
// ═══════════════════════════════════════════════════════════════════

function getDetailedTableRow(indicator) {
  const compliance = ((indicator.cumplimiento || 0) * 100).toFixed(1);
  const status = calculateIndicatorStatus(indicator);
  
  const statusConfig = {
    critical: { 
      label: 'Crítico', 
      class: 'bg-red-100 text-red-800',
      icon: 'fa-circle-exclamation'
    },
    warning: { 
      label: 'Advertencia', 
      class: 'bg-orange-100 text-orange-800',
      icon: 'fa-triangle-exclamation'
    },
    success: { 
      label: 'En Meta', 
      class: 'bg-green-100 text-green-800',
      icon: 'fa-circle-check'
    },
    excellent: { 
      label: 'Sobresaliente', 
      class: 'bg-blue-100 text-blue-800',
      icon: 'fa-star'
    }
  };

  const config = statusConfig[status] || statusConfig.warning;

  return `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
        #${indicator.id || '-'}
      </td>
      <td class="px-6 py-4 text-sm text-slate-900">
        <div class="max-w-xs">
          <p class="font-medium">${escapeHtml(indicator.nombre || 'Sin nombre')}</p>
          ${indicator.descripcion ? `
            <p class="mt-1 text-xs text-slate-500 truncate">${escapeHtml(indicator.descripcion.substring(0, 80))}...</p>
          ` : ''}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
        ${escapeHtml(indicator.area_nombre || 'Sin área')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
        ${escapeHtml(indicator.unidad_medida || '-')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
        ${escapeHtml(indicator.frecuencia || '-')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-center">
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm font-bold text-slate-900">${compliance}%</span>
          <div class="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
            <div 
              class="h-full rounded-full transition-all ${
                status === 'critical' ? 'bg-red-500' :
                status === 'warning' ? 'bg-orange-500' :
                status === 'success' ? 'bg-green-500' :
                'bg-blue-500'
              }"
              style="width: ${Math.min(compliance, 100)}%"
            ></div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-center">
        <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${config.class}">
          <i class="fa-solid ${config.icon}"></i>
          ${config.label}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-100"
          onclick="alert('Ver detalle del indicador #${indicator.id}')"
        >
          <i class="fa-solid fa-eye"></i>
          Ver
        </button>
      </td>
    </tr>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE RENDERIZADO DE GRÁFICAS (SVG)
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// GRÁFICA DE DISTRIBUCIÓN (Barras horizontales)
// ═══════════════════════════════════════════════════════════════════

function renderDistributionChart(byStatus) {
  const total = Object.values(byStatus).reduce((sum, arr) => sum + arr.length, 0);
  
  if (total === 0) {
    return '<div class="flex h-full items-center justify-center text-slate-400">No hay datos</div>';
  }

  const data = [
    { label: 'Críticos', count: byStatus.critical.length, color: '#EF4444' },
    { label: 'Advertencia', count: byStatus.warning.length, color: '#F59E0B' },
    { label: 'En Meta', count: byStatus.success.length, color: '#10B981' },
    { label: 'Sobresalientes', count: byStatus.excellent.length, color: '#3B82F6' }
  ];

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barHeight = 60;
  const gap = 20;
  const chartHeight = (barHeight + gap) * data.length;

  return `
    <svg viewBox="0 0 600 ${chartHeight}" class="h-full w-full">
      ${data.map((item, idx) => {
        const barWidth = (item.count / maxCount) * 450;
        const y = idx * (barHeight + gap);
        const percentage = ((item.count / total) * 100).toFixed(1);
        
        return `
          <g>
            <text x="0" y="${y + 30}" class="text-sm font-medium" fill="#64748B">
              ${item.label}
            </text>
            <rect 
              x="140" 
              y="${y + 10}" 
              width="${barWidth}" 
              height="${barHeight - 20}" 
              fill="${item.color}" 
              rx="8"
            />
            <text x="${140 + barWidth + 10}" y="${y + 35}" class="text-sm font-bold" fill="#1E293B">
              ${item.count} (${percentage}%)
            </text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// GRÁFICA COMPARATIVA (Barras verticales)
// ═══════════════════════════════════════════════════════════════════

function renderComparativeBarChart(data) {
  if (!data || data.length === 0) {
    return '<div class="flex h-full items-center justify-center text-slate-400">No hay datos</div>';
  }

  const maxCompliance = Math.max(...data.map(d => (d.cumplimiento || 0) * 100), 100);
  const barWidth = 40;
  const gap = 20;
  const chartWidth = (barWidth + gap) * data.length;
  const chartHeight = 300;

  return `
    <svg viewBox="0 0 ${chartWidth + 100} ${chartHeight + 100}" class="h-full w-full">
      <!-- Línea de referencia 100% -->
      <line 
        x1="0" 
        y1="${chartHeight - 100}" 
        x2="${chartWidth}" 
        y2="${chartHeight - 100}" 
        stroke="#94A3B8" 
        stroke-dasharray="5,5" 
        stroke-width="1"
      />
      <text x="${chartWidth + 5}" y="${chartHeight - 95}" class="text-xs" fill="#64748B">100%</text>
      
      ${data.map((ind, idx) => {
        const compliance = (ind.cumplimiento || 0) * 100;
        const barHeightVal = (compliance / maxCompliance) * (chartHeight - 100);
        const x = idx * (barWidth + gap);
        const status = calculateIndicatorStatus(ind);
        
        const colorMap = {
          critical: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          excellent: '#3B82F6'
        };
        
        return `
          <g>
            <rect 
              x="${x}" 
              y="${chartHeight - barHeightVal}" 
              width="${barWidth}" 
              height="${barHeightVal}" 
              fill="${colorMap[status]}" 
              rx="4"
            />
            <text 
              x="${x + barWidth / 2}" 
              y="${chartHeight - barHeightVal - 5}" 
              text-anchor="middle" 
              class="text-xs font-bold" 
              fill="#1E293B"
            >
              ${compliance.toFixed(0)}%
            </text>
            <text 
              x="${x + barWidth / 2}" 
              y="${chartHeight + 15}" 
              text-anchor="middle" 
              class="text-xs" 
              fill="#64748B"
              transform="rotate(-45 ${x + barWidth / 2} ${chartHeight + 15})"
            >
              ${escapeHtml((ind.nombre || 'Sin nombre').substring(0, 15))}
            </text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// GRÁFICA TEMPORAL (Línea con puntos)
// ═══════════════════════════════════════════════════════════════════

function renderTemporalLineChart(data) {
  if (!data || data.length === 0) {
    return '<div class="flex h-full items-center justify-center text-slate-400">No hay datos temporales</div>';
  }

  const width = 800;
  const height = 300;
  const padding = 50;
  const maxValue = Math.max(...data.map(d => d.value), 100);
  
  const points = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height + 50}" class="h-full w-full">
      <!-- Ejes -->
      <line 
        x1="${padding}" 
        y1="${height - padding}" 
        x2="${width - padding}" 
        y2="${height - padding}" 
        stroke="#CBD5E1" 
        stroke-width="2"
      />
      <line 
        x1="${padding}" 
        y1="${padding}" 
        x2="${padding}" 
        y2="${height - padding}" 
        stroke="#CBD5E1" 
        stroke-width="2"
      />
      
      <!-- Línea de referencia 100% -->
      ${maxValue >= 100 ? `
        <line 
          x1="${padding}" 
          y1="${height - padding - ((100 / maxValue) * (height - 2 * padding))}" 
          x2="${width - padding}" 
          y2="${height - padding - ((100 / maxValue) * (height - 2 * padding))}" 
          stroke="#F59E0B" 
          stroke-dasharray="5,5" 
          stroke-width="1"
        />
        <text 
          x="${width - padding + 5}" 
          y="${height - padding - ((100 / maxValue) * (height - 2 * padding)) + 5}" 
          class="text-xs" 
          fill="#F59E0B"
        >
          100%
        </text>
      ` : ''}
      
      <!-- Área bajo la línea -->
      <polygon 
        points="${padding},${height - padding} ${points} ${padding + (data.length - 1) / (data.length - 1) * (width - 2 * padding)},${height - padding}" 
        fill="#3B82F6" 
        opacity="0.1"
      />
      
      <!-- Línea de datos -->
      <polyline 
        points="${points}" 
        fill="none" 
        stroke="#3B82F6" 
        stroke-width="3" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      />
      
      <!-- Puntos -->
      ${data.map((d, idx) => {
        const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
        return `
          <g>
            <circle 
              cx="${x}" 
              cy="${y}" 
              r="5" 
              fill="#3B82F6" 
              stroke="white" 
              stroke-width="2"
            />
            <text 
              x="${x}" 
              y="${height - padding + 20}" 
              text-anchor="middle" 
              class="text-xs" 
              fill="#64748B"
            >
              ${d.label}
            </text>
          </g>
        `;
      }).join('')}
      
      <!-- Labels de valores -->
      ${data.map((d, idx) => {
        const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
        return `
          <text 
            x="${x}" 
            y="${y - 10}" 
            text-anchor="middle" 
            class="text-xs font-bold" 
            fill="#1E293B"
          >
            ${d.value.toFixed(1)}%
          </text>
        `;
      }).join('')}
    </svg>
  `;
}
// ═══════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES Y UTILIDADES
// ═══════════════════════════════════════════════════════════════════

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (num == null || isNaN(num)) return '—';
  return new Intl.NumberFormat('es-MX').format(num);
}

function formatPercentage(num) {
  if (num == null || isNaN(num)) return '—';
  return `${(num * 100).toFixed(1)}%`;
}

function formatDate(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return '—';
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL DE RENDERIZADO (EXPORTADA)
// ═══════════════════════════════════════════════════════════════════

export async function renderVisualization(container) {
  try {
    // Renderizar estructura base
    container.innerHTML = getMainHTML();
    
    // Cargar datos iniciales
    await loadInitialData();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Renderizar vista inicial
    await renderCurrentView();
    
    showToast('Visualización cargada correctamente', { type: 'success' });
    
  } catch (error) {
    console.error('Error al renderizar visualización avanzada:', error);
    container.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
        <h3 class="mt-4 text-lg font-semibold text-red-900">Error al cargar la visualización</h3>
        <p class="mt-2 text-sm text-red-600">${escapeHtml(error.message)}</p>
        <button 
          type="button" 
          onclick="location.reload()"
          class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    `;
    showToast('Error al cargar la visualización', { type: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAR CONFIGURACIÓN Y ESTADO (opcional, para debugging)
// ═══════════════════════════════════════════════════════════════════

export { CONFIG, STATE };
