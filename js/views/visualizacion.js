// =====================================================
// VISTA DE VISUALIZACIÓN GLOBAL - GRÁFICAS COMPARATIVAS
// Estado, renderizado y filtros
// =====================================================

import { DEBUG, APP_CONFIG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber, formatPercentage, exportToCSV } from '../lib/ui.js';

const CHART_COLORS = [ '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4','#84CC16', '#F97316', '#EC4899', '#6B7280', '#14B8A6', '#A855F7'];


        /**
         * Limpiar nombre de área removiendo "Dirección General" y prefijos similares
         */
        function cleanAreaName(nombre) {
            if (!nombre) return nombre;
            
            // Lista de prefijos a remover (en orden de prioridad)
            const prefixesToRemove = [
                'Dirección General ',
                'Dirección General de ',
                'Dirección General del ',
                'Dirección General de la ',
                'Dirección General de las ',
                'Dirección General de los ',
                'Dirección ',
                'Subdirección ',
                'Subdirección General ',
                'Subdirección General de ',
                'Subdirección General del ',
                'Subdirección General de la ',
                'Subdirección General de las ',
                'Subdirección General de los '
            ];
            
            let cleanedName = nombre.trim();
            
            // Remover prefijos uno por uno
            for (const prefix of prefixesToRemove) {
                if (cleanedName.startsWith(prefix)) {
                    cleanedName = cleanedName.substring(prefix.length).trim();
                    break; // Solo remover el primer prefijo encontrado
                }
            }
            
            // Capitalizar primera letra si es necesario
            if (cleanedName.length > 0) {
                cleanedName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
            }
            
            return cleanedName || nombre; // Fallback al nombre original si queda vacío
        }
const visualizacionState = {
    userProfile: null,
    availableAreas: [],
    availableIndicadores: [],
    selectedAreas: [],
    selectedIndicadores: [],
    selectedYears: [],
    availableYears: [],
    chartData: [],
    chartInstances: {},
    viewMode: 'comparative', // 'comparative', 'dashboard', 'trends'
    loading: false,
    lastRefresh: null
};

// =====================================================
// RENDERIZADO DE LA VISTA PRINCIPAL
// =====================================================

/**
 * Renderizar vista de visualización
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📊 Renderizando vista de visualización');
     // Obtener perfil del usuario
        visualizacionState.userProfile = await getCurrentProfile();
        if (!visualizacionState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Procesar parámetros de query (si esta función existe)
        if (typeof processQueryParams === 'function') {
            processQueryParams(query);
        }
        
        // CAMBIO CRÍTICO: Cargar datos EN SECUENCIA, no en paralelo
        console.log('🔄 Cargando áreas primero...');
        await loadAvailableAreas();
        
        console.log('🔄 Cargando indicadores después de las áreas...');
        await loadAvailableIndicadores();
        
        console.log('🔄 Cargando años disponibles...');
        await loadAvailableYears();
        
        // Configurar selecciones por defecto (si esta función existe)
        if (typeof setupDefaultSelections === 'function') {
            setupDefaultSelections();
        }
        
        // Cargar datos de gráficas si hay selecciones
        if (visualizacionState.selectedIndicadores.length > 0) {
            await loadChartData();
        }
        
        // Renderizar HTML (busca la función que ya tienes)
        if (typeof createVisualizacionHTML === 'function') {
            container.innerHTML = createVisualizacionHTML();
        } else {
            // HTML básico si la función no existe
            container.innerHTML = `
                <div class="space-y-6">
                    <div class="bg-white p-6 rounded-lg shadow">
                        <h1 class="text-2xl font-bold mb-4">Visualización de Indicadores</h1>
                        <p>Áreas cargadas: ${visualizacionState.availableAreas?.length || 0}</p>
                        <p>Indicadores cargados: ${visualizacionState.availableIndicadores?.length || 0}</p>
                        <p>Años disponibles: ${visualizacionState.availableYears?.join(', ') || 'Ninguno'}</p>
                    </div>
                </div>
            `;
        }
        
        // Configurar event listeners (si esta función existe)
        if (typeof setupEventListeners === 'function') {
            setupEventListeners();
        }
        
        // Marcar tiempo de carga
        visualizacionState.lastRefresh = new Date();
        
        hideLoading();
        
        if (DEBUG.enabled) console.log('✅ Vista de visualización renderizada correctamente');
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error al renderizar vista de visualización:', error);
        
        // HTML de error simple
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
                <div class="flex items-center space-x-3">
                    <div class="text-red-500">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-medium text-red-800">Error al cargar la visualización</h3>
                        <p class="text-red-600 mt-1">${error.message}</p>
                        <button 
                            onclick="window.location.reload()" 
                            class="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Recargar página
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Crear HTML principal de la vista
 */
function createVisualizacionHTML() {
    return `
        <div class="space-y-6">
            <!-- Header -->
            <div class="bg-gradient-to-r from-aifa-blue to-aifa-light rounded-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold mb-2">Visualización de Indicadores</h1>
                        <p class="text-blue-100">
                            Análisis comparativo y tendencias del sistema AIFA
                        </p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button 
                            id="refresh-viz-btn"
                            class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
                            title="Actualizar datos"
                        >
                            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                        </button>
                        <button 
                            id="export-all-btn"
                            class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
                            title="Exportar todos los datos"
                        >
                            <i data-lucide="download" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Panel de filtros -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i data-lucide="filter" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                    Filtros de visualización
                </h2>
                
                ${createFiltersHTML()}
            </div>
            
            <!-- Modos de visualización -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                        <i data-lucide="layout-dashboard" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                        Modo de visualización
                    </h2>
                    
                    <div class="flex bg-gray-100 rounded-lg p-1">
                        <button 
                            id="mode-comparative"
                            class="view-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-colors"
                            onclick="changeViewMode('comparative')"
                        >
                            <i data-lucide="line-chart" class="w-4 h-4 mr-2"></i>
                            Comparativo
                        </button>
                        <button 
                            id="mode-dashboard"
                            class="view-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-colors"
                            onclick="changeViewMode('dashboard')"
                        >
                            <i data-lucide="grid-3x3" class="w-4 h-4 mr-2"></i>
                            Dashboard
                        </button>
                        <button 
                            id="mode-trends"
                            class="view-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-colors"
                            onclick="changeViewMode('trends')"
                        >
                            <i data-lucide="trending-up" class="w-4 h-4 mr-2"></i>
                            Tendencias
                        </button>
                    </div>
                </div>
                
                <!-- Contenido de visualización -->
                <div id="visualization-content">
                    ${createVisualizationContentHTML()}
                </div>
            </div>
            
            <!-- Información y estadísticas -->
            ${createStatsHTML()}
        </div>
    `;
}

/**
 * Crear HTML de filtros
 */
function createFiltersHTML() {
return `
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <!-- Filtro de áreas -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Áreas <span class="text-xs text-gray-500">(${visualizacionState.availableAreas.length} disponibles)</span>
                </label>
                <div class="relative">
                    <button 
                        id="areas-filter-btn"
                        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                    >
                        <span id="areas-filter-text" class="truncate">${getAreasFilterText()}</span>
                        <i data-lucide="chevron-down" class="w-4 h-4 flex-shrink-0 ml-2"></i>
                    </button>
                    
                    <div id="areas-filter-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-72 overflow-hidden">
                        <div class="p-3 border-b border-gray-100">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-sm font-medium text-gray-700">Seleccionar áreas</span>
                                <button 
                                    id="clear-areas-btn"
                                    class="text-xs text-gray-500 hover:text-red-600 transition-colors"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="select-all-areas"
                                    class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                >
                                <span class="text-sm font-medium text-gray-700">Seleccionar todas las áreas</span>
                            </label>
                        </div>
                        <div class="max-h-48 overflow-y-auto">
                            <div class="p-3 space-y-1">
                                ${createAreasFilterOptions()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Filtro de indicadores -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Indicadores
                    </label>
                    <div class="relative">
                        <button 
                            id="indicadores-filter-btn"
                            class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                            <span id="indicadores-filter-text">${getIndicadoresFilterText()}</span>
                            <i data-lucide="chevron-down" class="w-4 h-4"></i>
                        </button>
                        
                        <div id="indicadores-filter-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                            <div class="p-3">
                                <div class="space-y-2">
                                    ${createIndicadoresFilterOptions()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            
            <!-- Filtro de años -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Años <span class="text-xs text-gray-500">(${visualizacionState.availableYears.length} disponibles)</span>
                </label>
                <div class="relative">
                    <button 
                        id="years-filter-btn"
                        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                    >
                        <span id="years-filter-text" class="truncate">${getYearsFilterText()}</span>
                        <i data-lucide="chevron-down" class="w-4 h-4 flex-shrink-0 ml-2"></i>
                    </button>
                    
                    <div id="years-filter-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                        <div class="p-3 border-b border-gray-100">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-sm font-medium text-gray-700">Seleccionar años</span>
                                <button 
                                    id="clear-years-btn"
                                    class="text-xs text-gray-500 hover:text-red-600 transition-colors"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="select-all-years"
                                    class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                >
                                <span class="text-sm font-medium text-gray-700">Seleccionar todos los años</span>
                            </label>
                        </div>
                        <div class="max-h-48 overflow-y-auto">
                            <div class="p-3 space-y-2">
                                ${visualizacionState.availableYears.map(year => `
                                    <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            value="${year}" 
                                            ${visualizacionState.selectedYears.includes(year) ? 'checked' : ''}
                                            class="year-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                        >
                                        <span class="text-sm text-gray-700 font-medium">${year}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Botón aplicar filtros -->
            <div class="flex items-end">
                <button 
                id="apply-filters-btn"
                class="w-full bg-aifa-blue text-white px-4 py-2 rounded-lg hover:bg-aifa-dark transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                ${visualizacionState.selectedIndicadores.length === 0 ? 'disabled' : ''}
                >
                    <i data-lucide="search" class="w-4 h-4"></i>
                    <span>Aplicar filtros</span>
                    ${(visualizacionState.selectedIndicadores.length > 0 && visualizacionState.selectedYears.length > 0) ? 
                        `<span class="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">${visualizacionState.selectedIndicadores.length}×${visualizacionState.selectedYears.length}</span>` : 
                        ''
                    }
                </button>
            </div>
        </div>
    `;    
}

/**
 * Crear opciones de filtro de áreas con jerarquía
 */
function createAreasFilterOptions() {
    if (!visualizacionState.availableAreas || visualizacionState.availableAreas.length === 0) {
        return `
            <div class="text-center py-4">
                <i data-lucide="folder-x" class="w-6 h-6 text-gray-300 mx-auto mb-2"></i>
                <p class="text-gray-500 text-sm">No hay áreas disponibles</p>
            </div>
        `;
    }
    
    return visualizacionState.availableAreas.map(area => {
        const indentClass = getAreaIndentClass(area);
        const areaDisplayName = getAreaDisplayName(area);
        const isSelected = visualizacionState.selectedAreas.includes(area.id);
        
        return `
            <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded p-2 transition-colors ${indentClass}">
                <input 
                    type="checkbox" 
                    value="${area.id}" 
                    ${isSelected ? 'checked' : ''}
                    class="area-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue flex-shrink-0"
                >
                <div class="flex items-center space-x-2 flex-1 min-w-0">
                    <div class="w-3 h-3 rounded flex-shrink-0" style="background-color: ${area.color_hex || '#6B7280'}"></div>
                    <span class="text-sm text-gray-700 truncate">${areaDisplayName}</span>
                    <span class="text-xs text-gray-500 flex-shrink-0">${area.clave}</span>
                </div>
            </label>
        `;
    }).join('');
}


/**
 * Crear opciones de filtro de indicadores agrupadas por área
 */
        function createIndicadoresFilterOptions() {
            let html = '';
            
            // Solo mostrar indicadores sin agrupar por área
            visualizacionState.availableIndicadores.forEach(indicador => {
                html += `
                    <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input 
                            type="radio" 
                            name="indicador-selection"
                            value="${indicador.id}" 
                            ${visualizacionState.selectedIndicadores.includes(indicador.id) ? 'checked' : ''}
                            class="indicador-radio rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                        >
                        <span class="text-sm text-gray-700">${indicador.nombre}</span>
                        <span class="text-xs text-gray-500">(${indicador.clave})</span>
                    </label>
                `;
            });
            
            return html;
        }

/**
 * Obtener clase de indentación según la jerarquía del área
 */
function getAreaIndentClass(area) {
    const level = area?.hierarchyLevel || (area?.path ? area.path.split('.').filter(Boolean).length : 1);

    switch (level) {
        case 1: return ''; // Nivel raíz
        case 2: return 'pl-2'; // Direcciones
        case 3: return 'pl-4'; // Subdirecciones
        default: return 'pl-6'; // Niveles más profundos
    }
}

/**
 * Obtener nombre de display formateado para el área
 */
function getAreaDisplayName(area) {
    if (!area) return 'Área';

    if (area.displayName) {
        return area.displayName;
    }

    if (area.nombre) {
        return area.nombre;
    }

    return area.clave || 'Área';
}

/**
 * Crear contenido de visualización según el modo
 */
function createVisualizationContentHTML() {
    if (visualizacionState.selectedIndicadores.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="bar-chart-3" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Seleccione indicadores para visualizar</h3>
                <p class="text-gray-600">Use los filtros superiores para seleccionar áreas, indicadores y años a comparar.</p>
            </div>
        `;
    }
    
    switch (visualizacionState.viewMode) {
        case 'comparative':
            return createComparativeViewHTML();
        case 'dashboard':
            return createDashboardViewHTML();
        case 'trends':
            return createTrendsViewHTML();
        default:
            return createComparativeViewHTML();
    }
}

/**
 * Crear HTML del modo comparativo
 */
function createComparativeViewHTML() {
    return `
        <div class="space-y-6">
            <!-- Gráfica principal comparativa -->
            <div class="bg-gray-50 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Comparación temporal</h3>
                    <div class="flex items-center space-x-2">
                        <button 
                            id="toggle-chart-type"
                            class="bg-white border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50"
                        >
                            <i data-lucide="bar-chart" class="w-4 h-4 inline mr-1"></i>
                            <span id="chart-type-text">Cambiar a barras</span>
                        </button>
                        <button 
                            id="fullscreen-chart"
                            class="bg-white border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50"
                        >
                            <i data-lucide="maximize" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div class="relative" style="height: 500px;">
                    <canvas id="comparative-chart"></canvas>
                </div>
            </div>
            
            <!-- Tabla de datos comparativa -->
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-900">Datos comparativos</h3>
                        <button 
                            id="export-comparative-btn"
                            class="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors"
                        >
                            <i data-lucide="download" class="w-4 h-4 mr-1"></i>
                            Exportar datos
                        </button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <div id="comparative-table">
                        <!-- Tabla se genera dinámicamente -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML del modo dashboard
 */
function createDashboardViewHTML() {
    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${visualizacionState.selectedIndicadores.slice(0, 4).map((indicadorId, index) => {
                const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
                return `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="text-md font-semibold text-gray-900 mb-3">${indicador?.nombre || 'Indicador'}</h4>
                        <div class="relative" style="height: 250px;">
                            <canvas id="dashboard-chart-${index}"></canvas>
                        </div>
                    </div>
                `;
            }).join('')}
            
            ${visualizacionState.selectedIndicadores.length > 4 ? `
                <div class="lg:col-span-2 text-center py-6 text-gray-500">
                    <p>Mostrando los primeros 4 indicadores. Use el modo comparativo para ver todos.</p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Crear HTML del modo tendencias
 */
function createTrendsViewHTML() {
    return `
        <div class="space-y-6">
            <!-- Análisis de tendencias -->
            <div class="bg-gray-50 rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Análisis de tendencias</h3>
                <div class="relative" style="height: 400px;">
                    <canvas id="trends-chart"></canvas>
                </div>
            </div>
            
            <!-- Métricas de tendencias -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 class="text-md font-semibold text-gray-900 mb-2">Crecimiento promedio</h4>
                    <div id="growth-metrics" class="space-y-2">
                        <!-- Métricas se generan dinámicamente -->
                    </div>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 class="text-md font-semibold text-gray-900 mb-2">Variabilidad</h4>
                    <div id="variability-metrics" class="space-y-2">
                        <!-- Métricas se generan dinámicamente -->
                    </div>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 class="text-md font-semibold text-gray-900 mb-2">Cumplimiento</h4>
                    <div id="compliance-metrics" class="space-y-2">
                        <!-- Métricas se generan dinámicamente -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de estadísticas
 */
function createStatsHTML() {
    return `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i data-lucide="bar-chart-2" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                Estadísticas de selección
            </h2>
            
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="text-center">
                    <div class="text-2xl font-bold text-aifa-blue mb-1">
                        ${visualizacionState.selectedAreas.length}
                    </div>
                    <div class="text-sm text-gray-600">Áreas seleccionadas</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600 mb-1">
                        ${visualizacionState.selectedIndicadores.length}
                    </div>
                    <div class="text-sm text-gray-600">Indicadores seleccionados</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600 mb-1">
                        ${visualizacionState.selectedYears.length}
                    </div>
                    <div class="text-sm text-gray-600">Años seleccionados</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-orange-600 mb-1">
                        ${visualizacionState.chartData.length}
                    </div>
                    <div class="text-sm text-gray-600">Puntos de datos</div>
                </div>
            </div>
            
            ${visualizacionState.lastRefresh ? `
                <div class="mt-4 pt-4 border-t border-gray-200 text-center">
                    <p class="text-sm text-gray-500">
                        <i data-lucide="clock" class="w-4 h-4 inline mr-1"></i>
                        Última actualización: ${formatDate(visualizacionState.lastRefresh, 'time')}
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}
// =====================================================
// VISTA DE VISUALIZACIÓN GLOBAL - GRÁFICAS COMPARATIVAS
// Carga de datos y creación de gráficas
// =====================================================

// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Cargar áreas disponibles para el usuario
 */
async function loadAvailableAreas() {
    try {
        // Usar la función modificada que ya limpia los nombres
        const areas = await fetchAreasHierarchy();
        visualizacionState.availableAreas = areas;
        
        // Auto-seleccionar la primera área si no hay ninguna seleccionada
        if (visualizacionState.selectedAreas.length === 0 && areas.length > 0) {
            visualizacionState.selectedAreas = [areas[0].id];
        }
        
        if (DEBUG.enabled) {
            console.log('✅ Áreas disponibles cargadas:', areas.length);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar áreas:', error);
        visualizacionState.availableAreas = [];
    }
        
}

/**
 * Procesar datos para gráficas con nombres de áreas limpios
 */
function processChartDataWithCleanNames(rawData) {
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map(item => ({
        ...item,
        area_nombre: item.area_displayName || cleanAreaName(item.area_nombre) || item.area_nombre,
        originalAreaName: item.area_nombre // Mantener referencia al original
    }));
}

/**
 * Cargar áreas disponibles y construir jerarquía (VERSIÓN MODIFICADA)
 */
async function fetchAreasHierarchy() {
    try {
        if (DEBUG.enabled) console.log('🏢 Cargando jerarquía de áreas...');
        
        // Intentar consulta con nombre primero
        let { data } = await selectData('areas', {
            select: 'id, nombre, clave, path, color_hex, estado',
            filters: { estado: 'ACTIVO' },
            orderBy: { column: 'path', ascending: true }
        });
        
        if (!data || data.length === 0) {
            console.warn('⚠️ RLS detectó recursión al consultar áreas con nombre. Usando fallback.');
            
            // Fallback sin nombre
            const fallbackResult = await selectData('areas', {
                select: 'id, clave, path, color_hex, estado',
                filters: { estado: 'ACTIVO' },
                orderBy: { column: 'path', ascending: true }
            });
            
            data = fallbackResult.data || [];
        }
        
        // AQUÍ ES DONDE APLICAMOS LA LIMPIEZA DE NOMBRES
        const processedAreas = data.map(area => ({
            ...area,
            displayName: cleanAreaName(area.nombre || area.clave), // Nombre limpio para mostrar
            originalName: area.nombre // Guardar nombre original
        }));
        
        if (DEBUG.enabled) {
            console.log('✅ Áreas cargadas y procesadas:', processedAreas.length);
            // Mostrar ejemplos de limpieza
            processedAreas.slice(0, 3).forEach(area => {
                if (area.originalName !== area.displayName) {
                    console.log(`📝 "${area.originalName}" → "${area.displayName}"`);
                }
            });
        }
        
        return processedAreas;
        
    } catch (error) {
        console.error('❌ Error al cargar áreas:', error);
        throw error;
    }
}

/**
 * Construir jerarquía de áreas utilizando el path (ltree)
 */
function buildAreasHierarchy(areas) {
    if (!Array.isArray(areas) || areas.length === 0) return [];

    const pathMap = new Map();
    areas.forEach(area => {
        if (area.path) {
            pathMap.set(area.path, area);
        }
    });

    return areas.map(area => {
        const hierarchyLevel = getAreaHierarchyLevel(area);
        const breadcrumbs = buildAreaBreadcrumbs(area, pathMap);
        const displayName = (breadcrumbs.join(' / ') || '').trim() || normalizeAreaName(area.nombre) || area.clave || 'Área';

        return {
            ...area,
            hierarchyLevel,
            displayName,
            breadcrumbs,
            shortName: breadcrumbs.length > 0
                ? breadcrumbs[breadcrumbs.length - 1]
                : (normalizeAreaName(area.nombre) || area.clave || 'Área')
        };
    });
}

/**
 * Obtener nivel jerárquico del área a partir de su path
 */
function getAreaHierarchyLevel(area) {
    if (!area?.path || typeof area.path !== 'string') {
        return 1;
    }

    return area.path.split('.').filter(Boolean).length || 1;
}

/**
 * Formatear un segmento del path para mostrarlo de forma legible
 */
function formatAreaSegment(segment) {
    if (!segment) return 'Área';

    return segment
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function buildAreaBreadcrumbs(area, pathMap) {
    if (!area?.path || typeof area.path !== 'string') {
        return [normalizeAreaName(area?.nombre) || area?.clave || 'Área'];
    }

    const segments = area.path.split('.').filter(Boolean);
    if (segments.length === 0) {
        return [normalizeAreaName(area?.nombre) || area?.clave || 'Área'];
    }

    return segments.map((_, index) => {
        const partialPath = segments.slice(0, index + 1).join('.');
        const matchedArea = pathMap.get(partialPath);

        if (matchedArea) {
            return normalizeAreaName(matchedArea.nombre) || matchedArea.clave || formatAreaSegment(segments[index]);
        }

        return formatAreaSegment(segments[index]);
    });
}

function normalizeAreaName(name) {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function formatAreaNameFromPath(path, clave) {
    if (!path || typeof path !== 'string') {
        return clave || 'Área';
    }

    const segments = path.split('.').filter(Boolean);
    if (segments.length === 0) {
        return clave || 'Área';
    }

    return formatAreaSegment(segments[segments.length - 1]);
}

function isPolicyRecursionError(error) {
    if (!error) return false;

    const code = error.code || error?.originalError?.code;
    const message = (error.message || '').toLowerCase();

    return code === '42P17' || message.includes('infinite recursion detected');
}

/*
 * Obtener IDs de áreas asignadas al usuario
 */
async function getUserAreaIds() {
    try {
        if (!visualizacionState.userProfile?.id) return [];
        
        const { data } = await selectData('usuario_areas', {
            select: 'area_id',
            filters: { 
                usuario_id: visualizacionState.userProfile.id,
                estado: 'ACTIVO'
            }
        });
        
        return data ? data.map(ua => ua.area_id) : [];
        
    } catch (error) {
        console.error('❌ Error al obtener áreas del usuario:', error);
        return [];
    }
}

/**
 * Cargar indicadores disponibles
 */
async function loadAvailableIndicadores() {
    try {
        console.log('📊 Cargando indicadores disponibles...');
        
        // Verificar que las áreas se hayan cargado
        if (!visualizacionState.availableAreas || visualizacionState.availableAreas.length === 0) {
            console.error('❌ Las áreas no se han cargado aún. No se pueden cargar indicadores.');
            visualizacionState.availableIndicadores = [];
            return;
        }
        
        console.log(`✅ Áreas disponibles: ${visualizacionState.availableAreas.length}`);
        
        // Obtener TODOS los indicadores activos del sistema
        console.log('📋 Cargando todos los indicadores activos...');
        
        const { data: todosIndicadores } = await selectData('indicadores', {
            select: 'id, clave, area_id, nombre, descripcion, unidad_medida, frecuencia, meta_anual, es_acumulativo, orden_visualizacion, estado',
            filters: { estado: 'ACTIVO' },
            orderBy: { column: 'orden_visualizacion', ascending: true }
        });
        
        console.log(`📊 Total indicadores activos encontrados: ${todosIndicadores?.length || 0}`);
        
        if (!todosIndicadores || todosIndicadores.length === 0) {
            console.warn('⚠️ No hay indicadores activos en el sistema');
            visualizacionState.availableIndicadores = [];
            return;
        }
        
        // Procesar indicadores y asignar información de área
        const indicadoresProcesados = todosIndicadores.map(indicador => {
            // Buscar el área correspondiente
            const area = visualizacionState.availableAreas.find(a => a.id === indicador.area_id);
            
            if (area) {
                // Indicador con área asignada
                return {
                    ...indicador,
                    area_nombre: area.displayName || area.nombre,
                    area_clave: area.clave,
                    area_color_hex: area.color_hex || '#6B7280',
                    total_mediciones: 0,
                    ultimo_anio_con_datos: null,
                    ultimo_mes_con_datos: null
                };
            } else {
                // Indicador sin área válida o en "Sin Asignar"
                return {
                    ...indicador,
                    area_nombre: '(Sin asignar)',
                    area_clave: 'SIN_ASIGNAR',
                    area_color_hex: '#9CA3AF',
                    total_mediciones: 0,
                    ultimo_anio_con_datos: null,
                    ultimo_mes_con_datos: null
                };
            }
        });
        
        // Filtrar indicadores según el rol del usuario
        let indicadoresParaMostrar;
        
        if (visualizacionState.userProfile?.rol_principal === 'ADMIN') {
            // Los administradores ven todos los indicadores
            indicadoresParaMostrar = indicadoresProcesados;
            console.log(`👤 Usuario ADMIN: mostrando ${indicadoresParaMostrar.length} indicadores (todos)`);
        } else {
            // Usuarios normales solo ven indicadores con área válida (no "Sin Asignar")
            indicadoresParaMostrar = indicadoresProcesados.filter(ind => 
                ind.area_id && ind.area_clave !== 'SIN_ASIGNAR'
            );
            console.log(`👤 Usuario estándar: mostrando ${indicadoresParaMostrar.length} indicadores (solo con área asignada)`);
        }
        
        visualizacionState.availableIndicadores = indicadoresParaMostrar;
        
        // Mostrar estadísticas detalladas
        const stats = {
            total: todosIndicadores.length,
            conAreaValida: indicadoresProcesados.filter(ind => ind.area_id && ind.area_clave !== 'SIN_ASIGNAR').length,
            sinAsignar: indicadoresProcesados.filter(ind => !ind.area_id || ind.area_clave === 'SIN_ASIGNAR').length,
            mostrandose: indicadoresParaMostrar.length
        };
        
        console.log('📈 Estadísticas de indicadores:');
        console.table(stats);
        
        // Mostrar algunos ejemplos de los indicadores cargados
        if (DEBUG.enabled && indicadoresParaMostrar.length > 0) {
            console.log('📋 Primeros 5 indicadores cargados:');
            console.table(indicadoresParaMostrar.slice(0, 5).map(ind => ({
                clave: ind.clave,
                nombre: ind.nombre.substring(0, 30) + (ind.nombre.length > 30 ? '...' : ''),
                area: ind.area_nombre
            })));
        }
        
        // Advertencia para administradores si hay muchos indicadores sin asignar
        if (stats.sinAsignar > 0 && visualizacionState.userProfile?.rol_principal === 'ADMIN') {
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast(
                        `⚠️ ${stats.sinAsignar} indicadores en "Sin Asignar". Use el panel de administración para asignarlos a áreas específicas.`,
                        'warning',
                        8000
                    );
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar indicadores:', error);
        visualizacionState.availableIndicadores = [];
        
        // Mostrar error al usuario si la función existe
        if (typeof showToast === 'function') {
            showToast('Error al cargar indicadores. Verifique la consola para más detalles.', 'error');
        }
    }
}

/**
 * Cargar años disponibles
 */
async function loadAvailableYears() {
    try {
        const { data } = await selectData('v_mediciones_historico', {
            select: 'anio',
            orderBy: { column: 'anio', ascending: false }
        });
        
        if (data && data.length > 0) {
            const uniqueYears = [...new Set(data.map(d => d.anio))].sort((a, b) => b - a);
            visualizacionState.availableYears = uniqueYears;
        } else {
            visualizacionState.availableYears = [];
        }
        
        if (DEBUG.enabled) {
            console.log(`📅 Años disponibles: ${visualizacionState.availableYears.join(', ')}`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar años:', error);
        visualizacionState.availableYears = [];
    }
}

/**
 * Cargar datos para gráficas
 */
async function loadChartData() {
    try {
        if (visualizacionState.selectedIndicadores.length === 0) {
            visualizacionState.chartData = [];
            return;
        }
        
        const { data } = await selectData('v_mediciones_historico', {
            select: '*',
            filters: {
                indicador_id: visualizacionState.selectedIndicadores,
                anio: visualizacionState.selectedYears
            },
            orderBy: { column: 'anio', ascending: true }
        });
        
        visualizacionState.chartData = data || [];
        
        if (DEBUG.enabled) {
            console.log(`📈 Cargados ${visualizacionState.chartData.length} puntos de datos para gráficas`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos de gráficas:', error);
        visualizacionState.chartData = [];
        showToast('Error al cargar datos para las gráficas', 'error');
    }
}

// =====================================================
// CREACIÓN DE GRÁFICAS
// =====================================================

/**
 * Crear todas las gráficas según el modo actual
 */
function createCharts() {
    // Destruir gráficas existentes
    destroyAllCharts();
    
    if (visualizacionState.chartData.length === 0) {
        return;
    }
    
    switch (visualizacionState.viewMode) {
        case 'comparative':
            createComparativeChart();
            updateComparativeTable();
            break;
        case 'dashboard':
            createDashboardCharts();
            break;
        case 'trends':
            createTrendsChart();
            updateTrendsMetrics();
            break;
    }
}

/**
 * Crear gráfica comparativa
 */
function createComparativeChart() {
    const canvas = document.getElementById('comparative-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const chartData = prepareComparativeChartData();
    
    visualizacionState.chartInstances.comparative = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Comparación de Indicadores - Evolución Temporal',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 6
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Mes ${context[0].label}`;
                        },
                        label: function(context) {
                            const indicador = getIndicadorFromDatasetLabel(context.dataset.label);
                            const value = formatNumber(context.parsed.y);
                            const unit = indicador?.unidad_medida || 'Unidades';
                            return `${context.dataset.label}: ${value} ${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Mes'
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Valor'
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    beginAtZero: true
                }
            },
            elements: {
                line: {
                    tension: 0.3
                },
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            }
        }
    });
}

/**
 * Crear gráficas del dashboard
 */
function createDashboardCharts() {
    const maxCharts = Math.min(4, visualizacionState.selectedIndicadores.length);
    
    for (let i = 0; i < maxCharts; i++) {
        const indicadorId = visualizacionState.selectedIndicadores[i];
        const canvas = document.getElementById(`dashboard-chart-${i}`);
        
        if (!canvas) continue;
        
        const ctx = canvas.getContext('2d');
        const chartData = prepareDashboardChartData(indicadorId);
        const indicador = visualizacionState.availableIndicadores.find(ind => ind.id === indicadorId);
        
        visualizacionState.chartInstances[`dashboard-${i}`] = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = formatNumber(context.parsed.y);
                                const unit = indicador?.unidad_medida || 'Unidades';
                                return `${context.dataset.label}: ${value} ${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        beginAtZero: true
                    }
                },
                elements: {
                    line: {
                        tension: 0.3
                    },
                    point: {
                        radius: 3,
                        hoverRadius: 5
                    }
                }
            }
        });
    }
}

/**
 * Crear gráfica de tendencias
 */
function createTrendsChart() {
    const canvas = document.getElementById('trends-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const chartData = prepareTrendsChartData();
    
    visualizacionState.chartInstances.trends = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Análisis de Tendencias - Promedios Móviles',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Período'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Valor normalizado'
                    },
                    beginAtZero: true
                }
            },
            elements: {
                line: {
                    tension: 0.4
                },
                point: {
                    radius: 2,
                    hoverRadius: 4
                }
            }
        }
    });
}

// =====================================================
// PREPARACIÓN DE DATOS PARA GRÁFICAS
// =====================================================

/**
 * Preparar datos para gráfica comparativa
 */
function prepareComparativeChartData() {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Usar colores locales en lugar de APP_CONFIG.charts.defaultColors
    const colors = CHART_COLORS;
    const datasets = [];
    
    let colorIndex = 0;
    
    // Crear dataset por cada combinación indicador-año
    visualizacionState.selectedIndicadores.forEach(indicadorId => {
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
        if (!indicador) return;
        
        visualizacionState.selectedYears.forEach(year => {
            const yearData = visualizacionState.chartData.filter(
                d => d.indicador_id === indicadorId && d.anio === year
            );
            
            const data = months.map((month, index) => {
                const monthNumber = (index + 1).toString().padStart(2, '0');
                const medicion = yearData.find(d => d.mes.toString().padStart(2, '0') === monthNumber);
                return medicion ? medicion.valor : null;
            });
            
            // Solo agregar dataset si tiene datos
            if (data.some(value => value !== null)) {
                datasets.push({
                    label: `${indicador.nombre} (${year})`,
                    data: data,
                    borderColor: colors[colorIndex % colors.length],
                    backgroundColor: colors[colorIndex % colors.length] + '20',
                    fill: false,
                    spanGaps: false,
                    tension: 0.1
                });
                
                colorIndex++;
            }
        });
    });
    
    return {
        labels: months,
        datasets: datasets
    };
}

/**
 * Preparar datos para gráfica individual del dashboard
 */
function prepareDashboardChartData(indicadorId) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const colors = CHART_COLORS;
    const datasets = [];
    
    let colorIndex = 0;
    
    visualizacionState.selectedYears.forEach(year => {
        const yearData = visualizacionState.chartData.filter(
            d => d.indicador_id === indicadorId && d.anio === year
        );
        
        const data = months.map((month, index) => {
            const monthNumber = (index + 1).toString().padStart(2, '0');
            const medicion = yearData.find(d => d.mes.toString().padStart(2, '0') === monthNumber);
            return medicion ? medicion.valor : null;
        });
        
        datasets.push({
            label: `${year}`,
            data: data,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length] + '20',
            fill: false,
            spanGaps: false,
            tension: 0.1
        });
        
        colorIndex++;
    });
    
    return {
        labels: months,
        datasets: datasets
    };
}

/**
 * Preparar datos para gráfica de tendencias
 */
function prepareTrendsChartData() {
    const datasets = [];
    const colors = CHART_COLORS;
    
    let colorIndex = 0;
    
    // Crear series normalizadas por indicador
    visualizacionState.selectedIndicadores.forEach(indicadorId => {
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
        if (!indicador) return;
        
        const indicadorData = visualizacionState.chartData.filter(d => d.indicador_id === indicadorId);
        
        if (indicadorData.length === 0) return;
        
        // Ordenar por fecha
        indicadorData.sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            return a.mes - b.mes;
        });
        
        // Calcular promedio móvil de 3 meses (función auxiliar incluida abajo)
        const values = indicadorData.map(d => d.valor);
        const movingAverage = calculateMovingAverage(values, 3);
        
        // Normalizar valores (0-100)
        const maxValue = Math.max(...movingAverage);
        const minValue = Math.min(...movingAverage);
        const range = maxValue - minValue;
        
        const normalizedData = movingAverage.map(value => 
            range > 0 ? ((value - minValue) / range) * 100 : 50
        );
        
        const labels = indicadorData.map(d => `${d.anio}/${d.mes.toString().padStart(2, '0')}`);
        
        datasets.push({
            label: indicador.nombre,
            data: normalizedData,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length] + '20',
            fill: false,
            tension: 0.1
        });
        
        colorIndex++;
    });
    
    return {
        labels: visualizacionState.chartData.length > 0 ? 
            visualizacionState.chartData
                .map(d => `${d.anio}/${d.mes.toString().padStart(2, '0')}`)
                .filter((label, index, arr) => arr.indexOf(label) === index)
                .sort() : [],
        datasets: datasets
    };
}

/**
 * Actualizar tabla comparativa
 */
function updateComparativeTable() {
    const tableContainer = document.getElementById('comparative-table');
    if (!tableContainer) return;
    
    if (visualizacionState.chartData.length === 0) {
        tableContainer.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500">No hay datos para mostrar en la tabla</p>
            </div>
        `;
        return;
    }
    
    // Crear tabla pivotada por indicador y año
    const tableHTML = createComparativeTableHTML();
    tableContainer.innerHTML = tableHTML;
}

/**
 * Crear HTML de tabla comparativa
 */
function createComparativeTableHTML() {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Agrupar datos por indicador y año
    const groupedData = {};
    
    visualizacionState.chartData.forEach(medicion => {
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === medicion.indicador_id);
        if (!indicador) return;
        
        const key = `${indicador.nombre} (${medicion.anio})`;
        if (!groupedData[key]) {
            groupedData[key] = Array(12).fill(null);
        }
        
        groupedData[key][medicion.mes - 1] = medicion.valor;
    });
    
    const rows = Object.entries(groupedData);
    
    return `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                        Indicador (Año)
                    </th>
                    ${months.map(month => `
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ${month}
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${rows.map((row, index) => `
                    <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                            ${row[0]}
                        </td>
                        ${row[1].map(value => `
                            <td class="px-6 py-4 text-center text-sm text-gray-900">
                                ${value !== null ? formatNumber(value) : '-'}
                            </td>
                        `).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Actualizar métricas de tendencias
 */
function updateTrendsMetrics() {
    updateGrowthMetrics();
    updateVariabilityMetrics();
    updateComplianceMetrics();
}

/**
 * Actualizar métricas de crecimiento
 */
function updateGrowthMetrics() {
    const container = document.getElementById('growth-metrics');
    if (!container) return;
    
    // Calcular métricas por indicador
    const metrics = visualizacionState.selectedIndicadores.map(indicadorId => {
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
        const data = visualizacionState.chartData.filter(d => d.indicador_id === indicadorId);
        
        if (data.length < 2) return null;
        
        // Ordenar por fecha
        data.sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            return a.mes - b.mes;
        });
        
        const firstValue = data[0].valor;
        const lastValue = data[data.length - 1].valor;
        const growth = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
        
        return {
            name: indicador?.nombre || 'Indicador',
            growth: growth
        };
    }).filter(m => m !== null);
    
    container.innerHTML = metrics.map(metric => `
        <div class="flex justify-between items-center">
            <span class="text-sm text-gray-700">${metric.name}:</span>
            <span class="text-sm font-medium ${metric.growth >= 0 ? 'text-green-600' : 'text-red-600'}">
                ${metric.growth >= 0 ? '+' : ''}${formatPercentage(metric.growth / 100)}
            </span>
        </div>
    `).join('');
}

/**
 * Actualizar métricas de variabilidad
 */
function updateVariabilityMetrics() {
    const container = document.getElementById('variability-metrics');
    if (!container) return;
    
    // Implementación básica de variabilidad
    container.innerHTML = '<p class="text-sm text-gray-500">Métricas en desarrollo</p>';
}

/**
 * Actualizar métricas de cumplimiento
 */
function updateComplianceMetrics() {
    const container = document.getElementById('compliance-metrics');
    if (!container) return;
    
    // Implementación básica de cumplimiento
    container.innerHTML = '<p class="text-sm text-gray-500">Métricas en desarrollo</p>';
}

/**
 * Destruir todas las gráficas existentes
 */
function destroyAllCharts() {
    Object.values(visualizacionState.chartInstances).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    visualizacionState.chartInstances = {};
}

/**
 * Obtener indicador desde etiqueta del dataset
 */
function getIndicadorFromDatasetLabel(label) {
    const indicadorName = label.split(' (')[0];
    return visualizacionState.availableIndicadores.find(i => i.nombre === indicadorName);
}
// =====================================================
// VISTA DE VISUALIZACIÓN GLOBAL - GRÁFICAS COMPARATIVAS
// Event listeners, handlers y funciones auxiliares
// =====================================================

// =====================================================
// CONFIGURACIÓN INICIAL Y PARÁMETROS
// =====================================================

/**
 * Procesar parámetros de query para filtros iniciales
 */
function processQueryParams(query) {
    // Área específica desde URL
    if (query.area) {
        visualizacionState.selectedAreas = [query.area];
    }
    
    // Indicador específico desde URL
    if (query.indicador) {
        visualizacionState.selectedIndicadores = [query.indicador];
    }
    
    // Años específicos desde URL
    if (query.years) {
        const years = query.years.split(',').map(y => parseInt(y)).filter(y => !isNaN(y));
        visualizacionState.selectedYears = years;
    }
    
    // Modo de visualización desde URL
    if (query.mode && ['comparative', 'dashboard', 'trends'].includes(query.mode)) {
        visualizacionState.viewMode = query.mode;
    }
}

/**
 * Configurar selecciones por defecto
 */
function setupDefaultSelections() {
    // Si no hay áreas seleccionadas, seleccionar las primeras 2
    if (visualizacionState.selectedAreas.length === 0 && visualizacionState.availableAreas.length > 0) {
        visualizacionState.selectedAreas = visualizacionState.availableAreas.slice(0, 2).map(a => a.id);
    }
    
    // Si no hay indicadores seleccionados, seleccionar los primeros de las áreas seleccionadas
    if (visualizacionState.selectedIndicadores.length === 0 && visualizacionState.availableIndicadores.length > 0) {
        const areaIndicadores = visualizacionState.availableIndicadores.filter(
            i => visualizacionState.selectedAreas.includes(i.area_id)
        );
        visualizacionState.selectedIndicadores = areaIndicadores.slice(0, 3).map(i => i.id);
    }
    
        // Si no hay años seleccionados, seleccionar TODOS los años disponibles
        if (visualizacionState.selectedYears.length === 0 && visualizacionState.availableYears.length > 0) {
        visualizacionState.selectedYears = [...visualizacionState.availableYears];
}
}

/**
 * Crear HTML del dropdown de filtro de áreas (VERSIÓN MODIFICADA)
 */
function createAreasFilterHTML() {
    return `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
                Áreas
            </label>
            <div class="relative">
                <button 
                    id="areas-filter-btn"
                    class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                    <span id="areas-filter-text">${getAreasFilterText()}</span>
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
                
                <div id="areas-filter-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    <div class="p-3">
                        <div class="space-y-2">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="select-all-areas"
                                    class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                >
                                <span class="text-sm font-medium text-gray-700">Seleccionar todas</span>
                            </label>
                            <hr class="border-gray-200">
                            ${visualizacionState.availableAreas.map(area => {
                                const displayName = area.displayName || cleanAreaName(area.nombre);
                                const isSelected = visualizacionState.selectedAreas.includes(area.id);
                                const level = area.path ? (area.path.match(/\./g) || []).length : 0;
                                const indent = '&nbsp;'.repeat(level * 3); // Indentación para jerarquía
                                
                                return `
                                    <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input 
                                            type="checkbox" 
                                            value="${area.id}" 
                                            ${isSelected ? 'checked' : ''}
                                            class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue area-filter-checkbox"
                                        >
                                        <span class="text-sm text-gray-700" style="margin-left: ${level * 12}px">
                                            ${displayName}
                                        </span>
                                        <span class="text-xs text-gray-400">(${area.clave})</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// EVENT LISTENERS PRINCIPALES
// =====================================================

/**
 * Configurar event listeners principales
 */
function setupEventListeners() {
    // Botón de refresh
    const refreshBtn = document.getElementById('refresh-viz-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshVisualization);
    }
    
    // Botón de export global
    const exportBtn = document.getElementById('export-all-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportAll);
    }
    
    // Configurar filtros
    setupFilterEventListeners();
    
    // Configurar modos de visualización
    setupViewModeEventListeners();
    
    // Configurar controles específicos del modo actual
    setupModeSpecificEventListeners();
}

/**
 * FUNCIÓN AUXILIAR: Calcular promedio móvil
 */
function calculateMovingAverage(values, window) {
    if (!values || values.length === 0) return [];
    
    const result = [];
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - Math.floor(window / 2));
        const end = Math.min(values.length, start + window);
        const slice = values.slice(start, end);
        const average = slice.reduce((sum, val) => sum + val, 0) / slice.length;
        result.push(average);
    }
    return result;
}

/**
 * VERIFICAR SI APP_CONFIG EXISTE, SI NO, CREARLO
 * Agrega esto también si no existe APP_CONFIG en tu proyecto
 */
if (typeof APP_CONFIG === 'undefined') {
    window.APP_CONFIG = {
        charts: {
            defaultColors: CHART_COLORS
        }
    };
}

/**
 * Configurar event listeners de filtros
 */
function setupFilterEventListeners() {
    // Dropdowns de filtros
    const filterButtons = ['areas', 'indicadores', 'years'];
    
    filterButtons.forEach(filterType => {
        const button = document.getElementById(`${filterType}-filter-btn`);
        const dropdown = document.getElementById(`${filterType}-filter-dropdown`);
        
        if (button && dropdown) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Cerrar otros dropdowns
                filterButtons.forEach(type => {
                    if (type !== filterType) {
                        const otherDropdown = document.getElementById(`${type}-filter-dropdown`);
                        if (otherDropdown) {
                            otherDropdown.classList.add('hidden');
                        }
                    }
                });
                
                // Toggle dropdown actual
                dropdown.classList.toggle('hidden');
            });
        }
    });
    
    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', (e) => {
        filterButtons.forEach(filterType => {
            const button = document.getElementById(`${filterType}-filter-btn`);
            const dropdown = document.getElementById(`${filterType}-filter-dropdown`);
            
            if (button && dropdown && !button.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });
    
    // Checkboxes de selección
    setupFilterCheckboxes();
    
    // Botón aplicar filtros
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', handleApplyFilters);
    }
}

/**
 * Configurar checkboxes de filtros
 */
function setupFilterCheckboxes() {
    setupSelectAllCheckboxes();
    // Checkboxes individuales
    document.querySelectorAll('.area-checkbox').forEach(cb => {
        cb.addEventListener('change', updateAreasSelection);
    });
    
        document.querySelectorAll('.indicador-radio').forEach(rb => {
            rb.addEventListener('change', updateIndicadoresSelection);
    });
    
    document.querySelectorAll('.year-checkbox').forEach(cb => {
        cb.addEventListener('change', updateYearsSelection);
    });
    
    // Botones de limpiar filtros
    const clearAreasBtn = document.getElementById('clear-areas-btn');
    if (clearAreasBtn) {
        clearAreasBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.area-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('select-all-areas').checked = false;
            updateAreasSelection();
        });
    }
    
    const clearIndicadoresBtn = document.getElementById('clear-indicadores-btn');
    if (clearIndicadoresBtn) {
        clearIndicadoresBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.indicador-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('select-all-indicadores').checked = false;
            //updateIndicadoresSelection();
        });
    }
    
    const clearYearsBtn = document.getElementById('clear-years-btn');
    if (clearYearsBtn) {
        clearYearsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.year-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('select-all-years').checked = false;
            updateYearsSelection();
        });
    }
}

/**
 * Configurar event listeners de modos de visualización
 */
function setupViewModeEventListeners() {
    // Los botones ya tienen onclick en el HTML, pero también configurar aquí
    const modeButtons = document.querySelectorAll('.view-mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.currentTarget.id.replace('mode-', '');
            changeViewMode(mode);
        });
    });
    
    // Actualizar estado visual inicial
    updateViewModeButtons();
}

/**
 * Configurar event listeners específicos del modo actual
 */
function setupModeSpecificEventListeners() {
    // Export de datos comparativos
    const exportComparativeBtn = document.getElementById('export-comparative-btn');
    if (exportComparativeBtn) {
        exportComparativeBtn.addEventListener('click', handleExportComparative);
    }
    
    // Toggle tipo de gráfica
    const toggleChartTypeBtn = document.getElementById('toggle-chart-type');
    if (toggleChartTypeBtn) {
        toggleChartTypeBtn.addEventListener('click', handleToggleChartType);
    }
    
    // Fullscreen de gráfica
    const fullscreenBtn = document.getElementById('fullscreen-chart');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', handleFullscreenChart);
    }
}

// =====================================================
// HANDLERS DE EVENTOS
// =====================================================

/**
 * Manejar refresh de visualización
 */
async function handleRefreshVisualization() {

     try {
        const refreshBtn = document.getElementById('refresh-viz-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.add('animate-spin');
            }
        }
        
        // Mostrar loading específico
        showLoading('Actualizando datos de visualización...');
        
        await Promise.all([
            loadAvailableAreas(),
            loadAvailableIndicadores(),
            loadAvailableYears(),
            loadChartData()
        ]);
        
        // Actualizar displays de filtros con nuevos datos
        updateFiltersDisplay();
        
        // Refrescar contenido de dropdowns si están abiertos
        refreshAllDropdowns();
        
        // Actualizar contenido de visualización si hay datos
        if (visualizacionState.selectedIndicadores.length > 0) {
            const content = document.getElementById('visualization-content');
            if (content) {
                content.innerHTML = createVisualizationContentHTML();
                setTimeout(() => {
                    createCharts();
                    setupModeSpecificEventListeners();
                    if (window.lucide) {
                        window.lucide.createIcons();
                    }
                }, 100);
            }
        }
        
        // Actualizar estadísticas
        updateStatsDisplay();
        
        hideLoading();
        showToast('Visualización actualizada correctamente', 'success');
        
        visualizacionState.lastRefresh = new Date();
        
    } catch (error) {
        console.error('❌ Error al refrescar visualización:', error);
        hideLoading();
        showToast('Error al actualizar la visualización', 'error');
    } finally {
        // Remover animación del icono
        const refreshBtn = document.getElementById('refresh-viz-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('animate-spin');
            }
        }
    }
}

/**
 * Manejar export de todos los datos
 */
async function handleExportAll() {
    try {
        if (visualizacionState.chartData.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        // Preparar datos completos para CSV
        const csvData = visualizacionState.chartData.map(medicion => {
            const indicador = visualizacionState.availableIndicadores.find(i => i.id === medicion.indicador_id);
            const area = visualizacionState.availableAreas.find(a => a.id === indicador?.area_id);
            
            return {
                'Área': area?.nombre || 'N/A',
                'Área Clave': area?.clave || 'N/A',
                'Indicador': indicador?.nombre || 'N/A',
                'Indicador Clave': indicador?.clave || 'N/A',
                'Año': medicion.anio,
                'Mes': medicion.mes,
                'Período': `${medicion.anio}/${medicion.mes.toString().padStart(2, '0')}`,
                'Valor': medicion.valor,
                'Unidad': indicador?.unidad_medida || 'N/A',
                'Meta Mensual': medicion.meta_mensual || '',
                'Meta Anual': indicador?.meta_anual || '',
                'Cumplimiento (%)': medicion.porcentaje_cumplimiento || '',
                'Observaciones': medicion.observaciones || '',
                'Capturado Por': medicion.capturado_por_nombre,
                'Fecha Captura': formatDate(medicion.fecha_captura, 'long')
            };
        });
        
        const filename = `AIFA_visualizacion_completa_${new Date().toISOString().slice(0, 10)}.csv`;
        exportToCSV(csvData, filename);
        
    } catch (error) {
        console.error('❌ Error al exportar datos:', error);
        showToast('Error al exportar los datos', 'error');
    }
}

/**
 * Manejar aplicación de filtros
 */
async function handleApplyFilters() {
    try {
        showLoading('Aplicando filtros...');
        
        // Cargar nuevos datos con filtros aplicados
        await loadChartData();
        
        // Actualizar contenido de visualización
        const content = document.getElementById('visualization-content');
        if (content) {
            content.innerHTML = createVisualizationContentHTML();
        }
        
        // Recrear gráficas
        setTimeout(() => {
            createCharts();
            
            // Configurar event listeners específicos del modo
            setupModeSpecificEventListeners();
            
            // Recrear iconos
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }, 100);
        
        // Actualizar estadísticas
        updateStatsDisplay();
        
        hideLoading();
        
        showToast('Filtros aplicados correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al aplicar filtros:', error);
        hideLoading();
        showToast('Error al aplicar los filtros', 'error');
    }
}

/**
 * Cambiar modo de visualización
 */
window.changeViewMode = async function(mode) {
    visualizacionState.viewMode = mode;
    
    try {
        showLoading('Cambiando modo de visualización...');
        
        // Actualizar botones
        updateViewModeButtons();
        
        // Actualizar contenido
        const content = document.getElementById('visualization-content');
        if (content) {
            content.innerHTML = createVisualizationContentHTML();
        }
        
        // Recrear gráficas
        setTimeout(() => {
            createCharts();
            
            // Configurar event listeners específicos del modo
            setupModeSpecificEventListeners();
            
            // Recrear iconos
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }, 100);
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error al cambiar modo:', error);
        hideLoading();
        showToast('Error al cambiar el modo de visualización', 'error');
    }
};

/**
 * Manejar export de datos comparativos
 */
function handleExportComparative() {
    try {
        if (visualizacionState.chartData.length === 0) {
            showToast('No hay datos comparativos para exportar', 'warning');
            return;
        }
        
        // Usar los mismos datos que se muestran en la tabla
        const csvData = visualizacionState.chartData.map(medicion => {
            const indicador = visualizacionState.availableIndicadores.find(i => i.id === medicion.indicador_id);
            
            return {
                'Indicador': indicador?.nombre || 'N/A',
                'Año': medicion.anio,
                'Mes': medicion.mes,
                'Valor': medicion.valor,
                'Unidad': indicador?.unidad_medida || 'N/A',
                'Meta': medicion.meta_mensual || (indicador?.meta_anual ? indicador.meta_anual / 12 : ''),
                'Cumplimiento (%)': medicion.porcentaje_cumplimiento || ''
            };
        });
        
        const filename = `AIFA_comparativo_${new Date().toISOString().slice(0, 10)}.csv`;
        exportToCSV(csvData, filename);
        
    } catch (error) {
        console.error('❌ Error al exportar comparativo:', error);
        showToast('Error al exportar los datos comparativos', 'error');
    }
}

/**
 * Manejar toggle de tipo de gráfica
 */
function handleToggleChartType() {
    const chart = visualizacionState.chartInstances.comparative;
    if (!chart) return;
    
    const currentType = chart.config.type;
    const newType = currentType === 'line' ? 'bar' : 'line';
    
    // Cambiar tipo de gráfica
    chart.config.type = newType;
    chart.update();
    
    // Actualizar texto del botón
    const toggleText = document.getElementById('chart-type-text');
    if (toggleText) {
        toggleText.textContent = newType === 'line' ? 'Cambiar a barras' : 'Cambiar a líneas';
    }
}

/**
 * Manejar fullscreen de gráfica
 */
function handleFullscreenChart() {
    showToast('Funcionalidad de pantalla completa en desarrollo', 'info');
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Actualizar selección de áreas
 */
function updateAreasSelection() {
    const checkboxes = document.querySelectorAll('.area-checkbox');
    const selectedAreas = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    visualizacionState.selectedAreas = selectedAreas;
    
    // Actualizar texto del filtro
    const filterText = document.getElementById('areas-filter-text');
    if (filterText) {
        filterText.textContent = getAreasFilterText();
    }
    
    // Actualizar estado del checkbox "seleccionar todas"
    const selectAllCheckbox = document.getElementById('select-all-areas');
    if (selectAllCheckbox) {
        const totalAreas = visualizacionState.availableAreas.length;
        selectAllCheckbox.checked = selectedAreas.length === totalAreas;
        selectAllCheckbox.indeterminate = selectedAreas.length > 0 && selectedAreas.length < totalAreas;
    }
    
    // Filtrar indicadores disponibles según áreas seleccionadas
    updateAvailableIndicadoresFilter();
    
    // Actualizar estado del botón de aplicar filtros
    updateApplyFiltersButton();
    
    // Actualizar dropdown de indicadores si está abierto
    const indicadoresDropdown = document.getElementById('indicadores-filter-dropdown');
    if (indicadoresDropdown && !indicadoresDropdown.classList.contains('hidden')) {
        refreshIndicadoresDropdown();
    }
    
    // Habilitar/deshabilitar dropdown de indicadores
    const indicadoresBtn = document.getElementById('indicadores-filter-btn');
    if (indicadoresBtn) {
        indicadoresBtn.disabled = selectedAreas.length === 0;
        if (selectedAreas.length === 0) {
            indicadoresBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            indicadoresBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

/**
 * Actualizar selección de indicadores
 */
function updateIndicadoresSelection() {
    const radioButtons = document.querySelectorAll('.indicador-radio');
    const selectedIndicador = Array.from(radioButtons)
        .find(rb => rb.checked);
    
    if (selectedIndicador) {
        visualizacionState.selectedIndicadores = [selectedIndicador.value];
    } else {
        visualizacionState.selectedIndicadores = [];
    }
    
    // Actualizar texto del filtro
    const filterText = document.getElementById('indicadores-filter-text');
    if (filterText) {
        filterText.textContent = getIndicadoresFilterText();
    }
}

/**
 * Actualizar selección de años
 */
function updateYearsSelection() {
    const checkboxes = document.querySelectorAll('.year-checkbox');
    const selectedYears = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
    
    visualizacionState.selectedYears = selectedYears;
    
    // Actualizar texto del filtro
    const filterText = document.getElementById('years-filter-text');
    if (filterText) {
        filterText.textContent = getYearsFilterText();
    }
    
    // Actualizar estado del checkbox "seleccionar todos"
    const selectAllCheckbox = document.getElementById('select-all-years');
    if (selectAllCheckbox) {
        const totalYears = visualizacionState.availableYears.length;
        selectAllCheckbox.checked = selectedYears.length === totalYears;
        selectAllCheckbox.indeterminate = selectedYears.length > 0 && selectedYears.length < totalYears;
    }
    
    // Actualizar estado del botón de aplicar filtros
    updateApplyFiltersButton();
    
}

/**
 * Actualizar filtro de indicadores disponibles según áreas
 */
function updateAvailableIndicadoresFilter() {
    // Deshabilitar indicadores que no pertenecen a áreas seleccionadas
        const radioButtons = document.querySelectorAll('.indicador-radio');
        
        radioButtons.forEach(radioButton => {
        const indicadorId = radioButton.value;
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
        
        if (indicador) {
            const isAreaSelected = visualizacionState.selectedAreas.includes(indicador.area_id);
        radioButton.disabled = !isAreaSelected;
        
        if (!isAreaSelected) {
            radioButton.checked = false;
        }
        
        // Actualizar estilo visual
        const label = radioButton.closest('label');
            if (label) {
                if (!isAreaSelected) {
                    label.classList.add('opacity-40', 'cursor-not-allowed');
                    label.classList.remove('hover:bg-gray-50');
                } else {
                    label.classList.remove('opacity-40', 'cursor-not-allowed');
                    label.classList.add('hover:bg-gray-50');
                }
            }
        }
    });
    
    // Actualizar selección de indicadores
    updateIndicadoresSelection();
    
    // Actualizar contador en el dropdown de áreas
    updateAreaIndicatorCounts();
}

/**
 * Actualizar contadores de indicadores por área
 */
function updateAreaIndicatorCounts() {
    // Contar indicadores disponibles por área
    const indicatorCounts = {};
    
    visualizacionState.availableIndicadores.forEach(indicador => {
        const areaId = indicador.area_id;
        if (!indicatorCounts[areaId]) {
            indicatorCounts[areaId] = { total: 0, selected: 0 };
        }
        indicatorCounts[areaId].total++;
        
        if (visualizacionState.selectedIndicadores.includes(indicador.id)) {
            indicatorCounts[areaId].selected++;
        }
    });
    
    // Actualizar display en los labels de área
    visualizacionState.availableAreas.forEach(area => {
        const counts = indicatorCounts[area.id] || { total: 0, selected: 0 };
        const areaLabels = document.querySelectorAll(`[data-area-id="${area.id}"]`);
        
        areaLabels.forEach(label => {
            const countSpan = label.querySelector('.indicator-count');
            if (countSpan) {
                if (counts.selected > 0) {
                    countSpan.textContent = `(${counts.selected}/${counts.total})`;
                    countSpan.className = 'ml-1 text-blue-600 font-medium indicator-count';
                } else {
                    countSpan.textContent = `(${counts.total})`;
                    countSpan.className = 'ml-1 text-gray-400 indicator-count';
                }
            }
        });
    });
}

/**
 * Actualizar estado del botón aplicar filtros
 */
function updateApplyFiltersButton() {
    const applyBtn = document.getElementById('apply-filters-btn');
    if (!applyBtn) return;
    
    const hasIndicadores = visualizacionState.selectedIndicadores.length > 0;
    const hasYears = visualizacionState.selectedYears.length > 0;
    const canApply = hasIndicadores && hasYears;
    
    applyBtn.disabled = !canApply;
    
    if (canApply) {
        applyBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        
        // Actualizar contador en el botón
        const countSpan = applyBtn.querySelector('.bg-white.bg-opacity-20');
        if (countSpan) {
            countSpan.textContent = `${visualizacionState.selectedIndicadores.length}×${visualizacionState.selectedYears.length}`;
        } else {
            const span = document.createElement('span');
            span.className = 'bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs';
            span.textContent = `${visualizacionState.selectedIndicadores.length}×${visualizacionState.selectedYears.length}`;
            applyBtn.appendChild(span);
        }
    } else {
        applyBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Remover contador si existe
        const countSpan = applyBtn.querySelector('.bg-white.bg-opacity-20');
        if (countSpan) {
            countSpan.remove();
        }
    }
}

/**
 * Refrescar dropdown de indicadores con nueva estructura
 */
function refreshIndicadoresDropdown() {
    const container = document.querySelector('#indicadores-filter-dropdown .p-3:last-child');
    if (!container) return;
    
    container.innerHTML = createIndicadoresFilterOptions();
    
    // Re-configurar event listeners para los nuevos checkboxes
    setTimeout(() => {
        document.querySelectorAll('.indicador-radio').forEach(cb => {
            cb.removeEventListener('change', updateIndicadoresSelection);
            cb.addEventListener('change', updateIndicadoresSelection);
        });
        
        // Recrear iconos si es necesario
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 10);
}

/**
 * Refrescar todos los dropdowns con datos actualizados
 */
function refreshAllDropdowns() {
    // Refrescar dropdown de áreas
    const areasContainer = document.querySelector('#areas-filter-dropdown .space-y-1');
    if (areasContainer) {
        areasContainer.innerHTML = createAreasFilterOptions();
        
        // Re-configurar event listeners
        setTimeout(() => {
            document.querySelectorAll('.area-checkbox').forEach(cb => {
                cb.removeEventListener('change', updateAreasSelection);
                cb.addEventListener('change', updateAreasSelection);
            });
        }, 10);
    }
    
    // Refrescar dropdown de indicadores
    refreshIndicadoresDropdown();
    
    // Refrescar dropdown de años
    const yearsContainer = document.querySelector('#years-filter-dropdown .space-y-2');
    if (yearsContainer) {
        yearsContainer.innerHTML = visualizacionState.availableYears.map(year => `
            <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors">
                <input 
                    type="checkbox" 
                    value="${year}" 
                    ${visualizacionState.selectedYears.includes(year) ? 'checked' : ''}
                    class="year-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                >
                <span class="text-sm text-gray-700 font-medium">${year}</span>
            </label>
        `).join('');
        
        // Re-configurar event listeners
        setTimeout(() => {
            document.querySelectorAll('.year-checkbox').forEach(cb => {
                cb.removeEventListener('change', updateYearsSelection);
                cb.addEventListener('change', updateYearsSelection);
            });
        }, 10);
    }
    
    // Re-configurar checkboxes de "seleccionar todo"
    setupSelectAllCheckboxes();
}

/**
 * Configurar checkboxes de seleccionar todo
 */
function setupSelectAllCheckboxes() {
    // Select all para áreas
    const selectAllAreas = document.getElementById('select-all-areas');
    if (selectAllAreas) {
        selectAllAreas.removeEventListener('change', handleSelectAllAreas);
        selectAllAreas.addEventListener('change', handleSelectAllAreas);
    }
    
   
    // Select all para años
    const selectAllYears = document.getElementById('select-all-years');
    if (selectAllYears) {
        selectAllYears.removeEventListener('change', handleSelectAllYears);
        selectAllYears.addEventListener('change', handleSelectAllYears);
    }
}

/**
 * Handlers para checkboxes de seleccionar todo
 */
function handleSelectAllAreas(e) {
    const checkboxes = document.querySelectorAll('.area-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateAreasSelection();
}

function handleSelectAllIndicadores(e) {
    const checkboxes = document.querySelectorAll('.indicador-checkbox:not(:disabled)');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateIndicadoresSelection();
}

function handleSelectAllYears(e) {
    const checkboxes = document.querySelectorAll('.year-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateYearsSelection();
}

/**
 * Actualizar displays de filtros sin reload completo
 */
function updateFiltersDisplay() {
    // Actualizar textos de filtros
    const areasText = document.getElementById('areas-filter-text');
    const indicadoresText = document.getElementById('indicadores-filter-text');
    const yearsText = document.getElementById('years-filter-text');
    
    if (areasText) areasText.textContent = getAreasFilterText();
    if (indicadoresText) indicadoresText.textContent = getIndicadoresFilterText();
    if (yearsText) yearsText.textContent = getYearsFilterText();
    
    // Actualizar contadores en labels
    const areasLabel = document.querySelector('label[for="areas"] .text-xs');
    const indicadoresLabel = document.querySelector('label[for="indicadores"] .text-xs');
    const yearsLabel = document.querySelector('label[for="years"] .text-xs');
    
    if (areasLabel) areasLabel.textContent = `(${visualizacionState.availableAreas.length} disponibles)`;
    if (indicadoresLabel) indicadoresLabel.textContent = `(${visualizacionState.availableIndicadores.length} disponibles)`;
    if (yearsLabel) yearsLabel.textContent = `(${visualizacionState.availableYears.length} disponibles)`;
    
    // Actualizar botón de aplicar filtros
    updateApplyFiltersButton();
}

/**
 * Actualizar botones de modo de visualización
 */
function updateViewModeButtons() {
    const buttons = document.querySelectorAll('.view-mode-btn');
    
    buttons.forEach(btn => {
        const mode = btn.id.replace('mode-', '');
        
        if (mode === visualizacionState.viewMode) {
            btn.classList.remove('text-gray-600', 'hover:text-gray-900');
            btn.classList.add('bg-white', 'text-aifa-blue', 'shadow-sm');
        } else {
            btn.classList.remove('bg-white', 'text-aifa-blue', 'shadow-sm');
            btn.classList.add('text-gray-600', 'hover:text-gray-900');
        }
    });
}

/**
 * Actualizar display de estadísticas
 */
function updateStatsDisplay() {
    // Actualizar contadores en tiempo real
    const containers = {
        areas: visualizacionState.selectedAreas.length,
        indicadores: visualizacionState.selectedIndicadores.length,
        years: visualizacionState.selectedYears.length,
        data: visualizacionState.chartData.length
    };
    
    // Esta función se llamaría para actualizar las estadísticas en la UI
    // La implementación específica dependería del HTML generado
}

/**
 * Obtener texto de filtro de áreas
 */
/**
 * Obtener texto de filtro de áreas
 */
function getAreasFilterText() {
    const count = visualizacionState.selectedAreas.length;
    const total = visualizacionState.availableAreas.length;
    
    if (count === 0) return 'Seleccionar áreas';
    if (count === total) return 'Todas las áreas';
    if (count === 1) {
        const area = visualizacionState.availableAreas.find(a => a.id === visualizacionState.selectedAreas[0]);
        // Usar displayName si está disponible, si no limpiar el nombre
        const displayName = area?.displayName || cleanAreaName(area?.nombre) || 'Área seleccionada';
        return displayName;
    }
    return `${count} áreas seleccionadas`;
}

/**
 * Obtener texto de filtro de indicadores
 */
function getIndicadoresFilterText() {
    const count = visualizacionState.selectedIndicadores.length;
    const total = visualizacionState.availableIndicadores.length;
    
    if (count === 0) return 'Seleccionar indicadores';
    if (count === total) return 'Todos los indicadores';
    if (count === 1) {
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === visualizacionState.selectedIndicadores[0]);
        return indicador?.nombre || 'Indicador seleccionado';
    }
    return `${count} indicadores seleccionados`;
}

/**
 * Obtener texto de filtro de años
 */
function getYearsFilterText() {
    const count = visualizacionState.selectedYears.length;
    const total = visualizacionState.availableYears.length;
    
    if (count === 0) return 'Seleccionar años';
    if (count === total) return 'Todos los años';
    if (count <= 3) {
        return visualizacionState.selectedYears.sort((a, b) => b - a).join(', ');
    }
    return `${count} años seleccionados`;
}
/**
 * FUNCIÓN DE DIAGNÓSTICO mejorada
 */
window.diagnosticarIndicadores = async function() {
    try {
        console.log('🔍 DIAGNÓSTICO COMPLETO DE INDICADORES');
        console.log('='.repeat(60));
        
        // 1. Estado de áreas
        console.log(`🏢 Áreas disponibles: ${visualizacionState.availableAreas?.length || 0}`);
        if (visualizacionState.availableAreas?.length > 0) {
            console.table(visualizacionState.availableAreas.map(a => ({
                id: a.id?.substring(0, 8) + '...',
                clave: a.clave,
                nombre: a.displayName || a.nombre
            })));
        }
        
        // 2. Total de indicadores en sistema
        const { data: total } = await selectData('indicadores', {
            select: 'id, clave, nombre, area_id, estado'
        });
        console.log(`📊 Total indicadores en sistema: ${total?.length || 0}`);
        
        // 3. Indicadores por estado
        const porEstado = {};
        total?.forEach(ind => {
            porEstado[ind.estado] = (porEstado[ind.estado] || 0) + 1;
        });
        console.log('📈 Indicadores por estado:');
        console.table(porEstado);
        
        // 4. Indicadores activos
        const activos = total?.filter(i => i.estado === 'ACTIVO') || [];
        console.log(`✅ Indicadores activos: ${activos.length}`);
        
        // 5. Análisis de asignación de áreas
        const sinArea = activos.filter(i => !i.area_id);
        const conArea = activos.filter(i => i.area_id);
        
        console.log(`❓ Sin área asignada: ${sinArea.length}`);
        console.log(`🏢 Con área asignada: ${conArea.length}`);
        
        if (sinArea.length > 0) {
            console.log('📋 Indicadores sin área:');
            console.table(sinArea.map(i => ({ 
                clave: i.clave, 
                nombre: i.nombre.substring(0, 50) + (i.nombre.length > 50 ? '...' : '')
            })));
        }
        
        // 6. Verificar áreas válidas vs inválidas
        const areaIds = visualizacionState.availableAreas?.map(a => a.id) || [];
        const conAreaValida = conArea.filter(i => areaIds.includes(i.area_id));
        const conAreaInvalida = conArea.filter(i => !areaIds.includes(i.area_id));
        
        console.log(`✅ Con área válida: ${conAreaValida.length}`);
        console.log(`❌ Con área inválida: ${conAreaInvalida.length}`);
        
        if (conAreaInvalida.length > 0) {
            console.log('📋 Indicadores con área inválida:');
            console.table(conAreaInvalida.map(i => ({ 
                clave: i.clave, 
                nombre: i.nombre.substring(0, 30) + '...',
                area_id: i.area_id?.substring(0, 8) + '...'
            })));
        }
        
        // 7. Estado actual en visualización
        console.log(`🖥️ Indicadores cargados en visualización: ${visualizacionState.availableIndicadores?.length || 0}`);
        
        console.log('='.repeat(60));
        
        return {
            total: total?.length || 0,
            activos: activos.length,
            sinArea: sinArea.length,
            conAreaValida: conAreaValida.length,
            conAreaInvalida: conAreaInvalida.length,
            enVisualizacion: visualizacionState.availableIndicadores?.length || 0
        };
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        return null;
    }
};
/**
 * FUNCIÓN ADICIONAL: Para asignar indicadores rápidamente desde consola
 */
window.asignarIndicadorAArea = async function(claveIndicador, claveArea) {
    try {
        console.log(`🔧 Asignando indicador ${claveIndicador} al área ${claveArea}...`);
        
        // Buscar indicador
        const { data: indicadores } = await selectData('indicadores', {
            select: 'id, clave, nombre, area_id',
            filters: { clave: claveIndicador }
        });
        
        if (!indicadores || indicadores.length === 0) {
            console.error(`❌ Indicador ${claveIndicador} no encontrado`);
            return false;
        }
        
        // Buscar área
        const area = visualizacionState.availableAreas.find(a => a.clave === claveArea);
        if (!area) {
            console.error(`❌ Área ${claveArea} no encontrada`);
            console.log('Áreas disponibles:', visualizacionState.availableAreas.map(a => a.clave));
            return false;
        }
        
        // Actualizar indicador
        await updateData('indicadores', 
            { area_id: area.id },
            { id: indicadores[0].id }
        );
        
        console.log(`✅ ${claveIndicador} asignado al área ${claveArea} (${area.nombre})`);
        
        // Recargar indicadores
        await loadAvailableIndicadores();
        
        return true;
        
    } catch (error) {
        console.error('❌ Error al asignar indicador:', error);
        return false;
    }
};

/**
 * FUNCIÓN DE AYUDA: Listar indicadores sin asignar
 */
window.listarIndicadoresSinAsignar = async function() {
    try {
        const { data: indicadores } = await selectData('indicadores', {
            select: 'clave, nombre, area_id',
            filters: { estado: 'ACTIVO' }
        });
        
        const areaSinAsignar = visualizacionState.availableAreas?.find(a => a.clave === 'SIN');
        const sinAsignar = indicadores?.filter(ind => 
            !ind.area_id || ind.area_id === areaSinAsignar?.id
        ) || [];
        
        console.log(`📋 Indicadores sin asignar correctamente: ${sinAsignar.length}`);
        
        if (sinAsignar.length > 0) {
            console.table(sinAsignar.map(ind => ({
                clave: ind.clave,
                nombre: ind.nombre.substring(0, 50) + (ind.nombre.length > 50 ? '...' : '')
            })));
            
            console.log('\n💡 Para asignar un indicador use:');
            console.log(`asignarIndicadorAArea('${sinAsignar[0].clave}', 'CLAVE_AREA')`);
            console.log('\n📋 Áreas disponibles:');
            console.log(visualizacionState.availableAreas?.map(a => `${a.clave}: ${a.nombre}`).join('\n'));
        }
        
        return sinAsignar;
        
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
};

/**
 * Función de debugging para visualizar el estado actual
 */
function debugVisualizacionState() {
    if (!DEBUG.enabled) return;
    
    console.group('🔍 Estado de Visualización');
    console.log('Áreas disponibles:', visualizacionState.availableAreas.length);
    console.log('Áreas seleccionadas:', visualizacionState.selectedAreas);
    console.log('Indicadores disponibles:', visualizacionState.availableIndicadores.length);
    console.log('Indicadores seleccionados:', visualizacionState.selectedIndicadores);
    console.log('Años disponibles:', visualizacionState.availableYears);
    console.log('Años seleccionados:', visualizacionState.selectedYears);
    console.log('Datos de gráficas:', visualizacionState.chartData.length);
    console.log('Modo actual:', visualizacionState.viewMode);
    console.groupEnd();
}

// Exponer función globalmente para debugging
if (DEBUG.enabled) {
    window.debugViz = debugVisualizacionState;
}
