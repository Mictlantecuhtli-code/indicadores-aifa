// =====================================================
// VISTA DE VISUALIZACIÓN GLOBAL - GRÁFICAS COMPARATIVAS
// Estado, renderizado y filtros
// =====================================================

import { DEBUG, APP_CONFIG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber, formatPercentage, exportToCSV } from '../lib/ui.js';

// Estado de la vista de visualización
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
        
        showLoading('Cargando datos para visualización...');
        
        // Obtener perfil del usuario
        visualizacionState.userProfile = await getCurrentProfile();
        if (!visualizacionState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Procesar parámetros de query
        processQueryParams(query);
        
        // Cargar datos iniciales
        await Promise.all([
            loadAvailableAreas(),
            loadAvailableIndicadores(),
            loadAvailableYears()
        ]);
        
        // Configurar selecciones por defecto
        setupDefaultSelections();
        
        // Cargar datos de gráficas si hay selecciones
        if (visualizacionState.selectedIndicadores.length > 0) {
            await loadChartData();
        }
        
        // Renderizar HTML
        container.innerHTML = createVisualizacionHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Crear gráficas iniciales
        if (visualizacionState.chartData.length > 0) {
            createCharts();
        }
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        visualizacionState.lastRefresh = new Date();
        
        if (DEBUG.enabled) console.log('✅ Vista de visualización renderizada correctamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar visualización:', error);
        hideLoading();
        
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="bar-chart-x" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar visualización</h2>
                <p class="text-gray-600 mb-6">No se pudieron cargar los datos para la visualización.</p>
                <div class="space-x-3">
                    <button onclick="location.reload()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Recargar página
                    </button>
                    <button onclick="window.router.navigateTo('/')" class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                        Volver al inicio
                    </button>
                </div>
            </div>
        `;
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
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
                                ${visualizacionState.availableAreas.map(area => `
                                    <label class="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            value="${area.id}" 
                                            ${visualizacionState.selectedAreas.includes(area.id) ? 'checked' : ''}
                                            class="area-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                        >
                                        <div class="flex items-center space-x-2">
                                            <div class="w-3 h-3 rounded" style="background-color: ${area.color_hex}"></div>
                                            <span class="text-sm text-gray-700">${area.nombre}</span>
                                        </div>
                                    </label>
                                `).join('')}
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
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="select-all-indicadores"
                                        class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                    >
                                    <span class="text-sm font-medium text-gray-700">Seleccionar todos</span>
                                </label>
                                <hr class="border-gray-200">
                                ${createIndicadoresFilterOptions()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Filtro de años -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Años
                </label>
                <div class="relative">
                    <button 
                        id="years-filter-btn"
                        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                        <span id="years-filter-text">${getYearsFilterText()}</span>
                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </button>
                    
                    <div id="years-filter-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                        <div class="p-3">
                            <div class="space-y-2">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="select-all-years"
                                        class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                    >
                                    <span class="text-sm font-medium text-gray-700">Seleccionar todos</span>
                                </label>
                                <hr class="border-gray-200">
                                ${visualizacionState.availableYears.map(year => `
                                    <label class="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            value="${year}" 
                                            ${visualizacionState.selectedYears.includes(year) ? 'checked' : ''}
                                            class="year-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                        >
                                        <span class="text-sm text-gray-700">${year}</span>
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
                    class="w-full bg-aifa-blue text-white px-4 py-2 rounded-lg hover:bg-aifa-dark transition-colors flex items-center justify-center space-x-2"
                >
                    <i data-lucide="search" class="w-4 h-4"></i>
                    <span>Aplicar filtros</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Crear opciones de filtro de indicadores agrupadas por área
 */
function createIndicadoresFilterOptions() {
    const indicadoresByArea = {};
    
    // Agrupar indicadores por área
    visualizacionState.availableIndicadores.forEach(indicador => {
        const areaId = indicador.area_id;
        if (!indicadoresByArea[areaId]) {
            indicadoresByArea[areaId] = [];
        }
        indicadoresByArea[areaId].push(indicador);
    });
    
    let html = '';
    
    // Crear opciones agrupadas
    visualizacionState.availableAreas.forEach(area => {
        const indicadores = indicadoresByArea[area.id] || [];
        if (indicadores.length === 0) return;
        
        html += `
            <div class="border-t border-gray-100 pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
                <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                    <div class="w-2 h-2 rounded mr-2" style="background-color: ${area.color_hex}"></div>
                    ${area.nombre}
                </div>
                ${indicadores.map(indicador => `
                    <label class="flex items-center space-x-2 cursor-pointer ml-4 mb-1">
                        <input 
                            type="checkbox" 
                            value="${indicador.id}" 
                            ${visualizacionState.selectedIndicadores.includes(indicador.id) ? 'checked' : ''}
                            class="indicador-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                        >
                        <span class="text-sm text-gray-700">${indicador.nombre}</span>
                        <span class="text-xs text-gray-500">(${indicador.clave})</span>
                    </label>
                `).join('')}
            </div>
        `;
    });
    
    return html;
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
        const userRole = visualizacionState.userProfile?.rol_principal;
        
        if (['ADMIN', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRole)) {
            // Roles altos ven todas las áreas
            const { data } = await selectData('areas', {
                select: '*',
                filters: { estado: 'ACTIVO' },
                orderBy: { column: 'orden_visualizacion', ascending: true }
            });
            visualizacionState.availableAreas = data || [];
        } else {
            // Otros roles ven solo sus áreas asignadas
            const { data } = await selectData('v_areas_usuario', {
                select: '*',
                filters: { usuario_id: visualizacionState.userProfile.id },
                orderBy: { column: 'orden_visualizacion', ascending: true }
            });
            visualizacionState.availableAreas = data || [];
        }
        
        if (DEBUG.enabled) {
            console.log(`📁 Cargadas ${visualizacionState.availableAreas.length} áreas disponibles`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar áreas:', error);
        visualizacionState.availableAreas = [];
    }
}

/**
 * Cargar indicadores disponibles
 */
async function loadAvailableIndicadores() {
    try {
        // Solo cargar indicadores de áreas disponibles
        if (visualizacionState.availableAreas.length === 0) {
            visualizacionState.availableIndicadores = [];
            return;
        }
        
        const areaIds = visualizacionState.availableAreas.map(a => a.id);
        
        const { data } = await selectData('v_indicadores_area', {
            select: '*',
            filters: { area_id: areaIds },
            orderBy: { column: 'area_nombre', ascending: true }
        });
        
        visualizacionState.availableIndicadores = data || [];
        
        if (DEBUG.enabled) {
            console.log(`📊 Cargados ${visualizacionState.availableIndicadores.length} indicadores disponibles`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar indicadores:', error);
        visualizacionState.availableIndicadores = [];
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
        if (visualizacionState.selectedIndicadores.length === 0 || 
            visualizacionState.selectedYears.length === 0) {
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
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const colors = APP_CONFIG.charts.defaultColors;
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
            
            const data = months.map(month => {
                const medicion = yearData.find(d => d.mes.toString().padStart(2, '0') === month);
                return medicion ? medicion.valor : null;
            });
            
            datasets.push({
                label: `${indicador.nombre} (${year})`,
                data: data,
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: colors[colorIndex % colors.length] + '20',
                fill: false,
                spanGaps: false
            });
            
            colorIndex++;
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
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const colors = APP_CONFIG.charts.defaultColors;
    const datasets = [];
    
    let colorIndex = 0;
    
    visualizacionState.selectedYears.forEach(year => {
        const yearData = visualizacionState.chartData.filter(
            d => d.indicador_id === indicadorId && d.anio === year
        );
        
        const data = months.map(month => {
            const medicion = yearData.find(d => d.mes.toString().padStart(2, '0') === month);
            return medicion ? medicion.valor : null;
        });
        
        datasets.push({
            label: `${year}`,
            data: data,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length] + '20',
            fill: false,
            spanGaps: false
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
    const colors = APP_CONFIG.charts.defaultColors;
    
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
        
        // Calcular promedio móvil de 3 meses
        const movingAverage = calculateMovingAverage(indicadorData.map(d => d.valor), 3);
        
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
            fill: false
        });
        
        colorIndex++;
    });
    
    // Usar las etiquetas del primer dataset
    const labels = visualizacionState.chartData.length > 0 ? 
        [...new Set(visualizacionState.chartData.map(d => `${d.anio}/${d.mes.toString().padStart(2, '0')}`))].sort() : 
        [];
    
    return {
        labels: labels,
        datasets: datasets
    };
}

/**
 * Calcular promedio móvil
 */
function calculateMovingAverage(data, window) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(window / 2));
        const end = Math.min(data.length, i + Math.ceil(window / 2));
        const subset = data.slice(start, end);
        const average = subset.reduce((sum, val) => sum + val, 0) / subset.length;
        result.push(average);
    }
    
    return result;
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
    
    // Si no hay años seleccionados, seleccionar los últimos 2 años
    if (visualizacionState.selectedYears.length === 0 && visualizacionState.availableYears.length > 0) {
        visualizacionState.selectedYears = visualizacionState.availableYears.slice(0, 2);
    }
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
    // Select all para áreas
    const selectAllAreas = document.getElementById('select-all-areas');
    if (selectAllAreas) {
        selectAllAreas.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.area-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateAreasSelection();
        });
    }
    
    // Select all para indicadores
    const selectAllIndicadores = document.getElementById('select-all-indicadores');
    if (selectAllIndicadores) {
        selectAllIndicadores.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.indicador-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateIndicadoresSelection();
        });
    }
    
    // Select all para años
    const selectAllYears = document.getElementById('select-all-years');
    if (selectAllYears) {
        selectAllYears.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.year-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateYearsSelection();
        });
    }
    
    // Checkboxes individuales
    document.querySelectorAll('.area-checkbox').forEach(cb => {
        cb.addEventListener('change', updateAreasSelection);
    });
    
    document.querySelectorAll('.indicador-checkbox').forEach(cb => {
        cb.addEventListener('change', updateIndicadoresSelection);
    });
    
    document.querySelectorAll('.year-checkbox').forEach(cb => {
        cb.addEventListener('change', updateYearsSelection);
    });
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
        
        await Promise.all([
            loadAvailableAreas(),
            loadAvailableIndicadores(),
            loadAvailableYears(),
            loadChartData()
        ]);
        
        // Re-renderizar vista completa
        const container = document.getElementById('app-container');
        if (container) {
            await render(container, {}, { 
                mode: visualizacionState.viewMode,
                areas: visualizacionState.selectedAreas.join(','),
                indicadores: visualizacionState.selectedIndicadores.join(','),
                years: visualizacionState.selectedYears.join(',')
            });
        }
           showToast('Visualización actualizada correctamente', 'success');
        } 
        catch (error) {
        console.error('❌ Error al refrescar visualización:', error);
        showToast('Error al actualizar la visualización', 'error');
    }
     finally {
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
    
    // Filtrar indicadores disponibles según áreas seleccionadas
    updateAvailableIndicadoresFilter();
}

/**
 * Actualizar selección de indicadores
 */
function updateIndicadoresSelection() {
    const checkboxes = document.querySelectorAll('.indicador-checkbox');
    const selectedIndicadores = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    visualizacionState.selectedIndicadores = selectedIndicadores;
    
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
}

/**
 * Actualizar filtro de indicadores disponibles según áreas
 */
function updateAvailableIndicadoresFilter() {
    // Deshabilitar indicadores que no pertenecen a áreas seleccionadas
    const checkboxes = document.querySelectorAll('.indicador-checkbox');
    
    checkboxes.forEach(checkbox => {
        const indicadorId = checkbox.value;
        const indicador = visualizacionState.availableIndicadores.find(i => i.id === indicadorId);
        
        if (indicador) {
            const isAreaSelected = visualizacionState.selectedAreas.includes(indicador.area_id);
            checkbox.disabled = !isAreaSelected;
            
            if (!isAreaSelected) {
                checkbox.checked = false;
            }
            
            // Actualizar estilo visual
            const label = checkbox.closest('label');
            if (label) {
                label.classList.toggle('opacity-50', !isAreaSelected);
            }
        }
    });
    
    // Actualizar selección de indicadores
    updateIndicadoresSelection();
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
function getAreasFilterText() {
    const count = visualizacionState.selectedAreas.length;
    const total = visualizacionState.availableAreas.length;
    
    if (count === 0) return 'Seleccionar áreas';
    if (count === total) return 'Todas las áreas';
    if (count === 1) {
        const area = visualizacionState.availableAreas.find(a => a.id === visualizacionState.selectedAreas[0]);
        return area?.nombre || 'Área seleccionada';
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
