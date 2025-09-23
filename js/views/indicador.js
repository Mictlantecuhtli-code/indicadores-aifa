// =====================================================
// VISTA DE INDICADOR ESPECÍFICO - PESTAÑAS COMPLETAS
// Estado, renderizado y HTML base
// =====================================================

import { DEBUG, VALIDATION, APP_CONFIG } from '../config.js';
import { selectData, insertData, updateData, deleteData, appState, getCurrentProfile, checkAreaPermission } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber, formatPercentage, showConfirmModal, validateForm, getFormData, exportToCSV } from '../lib/ui.js';

// Estado de la vista de indicador
const indicadorState = {
    indicadorClave: null,
    indicadorData: null,
    areaData: null,
    userProfile: null,
    userPermissions: {
        canRead: false,
        canCapture: false,
        canEdit: false,
        canDelete: false
    },
    currentTab: 'historico',
    medicionesHistorico: [],
    selectedYears: [],
    auditoriaData: [],
    chartInstance: null,
    loading: false,
    lastRefresh: null
};

// =====================================================
// RENDERIZADO DE LA VISTA PRINCIPAL
// =====================================================

/**
 * Renderizar vista de indicador específico
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📊 Renderizando vista de indicador:', params);
        
        // Validar parámetros
        if (!params.clave) {
            throw new Error('Clave de indicador no proporcionada');
        }
        
        indicadorState.indicadorClave = params.clave;
        indicadorState.currentTab = query.tab || 'historico';
        // Obtener perfil del usuario
        indicadorState.userProfile = await getCurrentProfile();
        if (!indicadorState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Cargar datos del indicador
        await loadIndicadorData();
        
        if (!indicadorState.indicadorData) {
            throw new Error('Indicador no encontrado');
        }
        
        // Verificar permisos en el área
        await checkUserPermissions();
        
        if (!indicadorState.userPermissions.canRead) {
            throw new Error('No tiene permisos para acceder a este indicador');
        }
        
        // Cargar datos según la pestaña activa
        await loadTabData();
        
        // Renderizar HTML
        container.innerHTML = createIndicadorHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Activar pestaña correspondiente
        switchTab(indicadorState.currentTab);
        
        // Actualizar breadcrumb
        updateBreadcrumb();
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        indicadorState.lastRefresh = new Date();
        
        if (DEBUG.enabled) console.log('✅ Vista de indicador renderizada correctamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar indicador:', error);
        hideLoading();
        
        let errorMessage = 'Error al cargar el indicador';
        
        if (error.message.includes('permisos')) {
            errorMessage = 'No tiene permisos para acceder a este indicador';
        } else if (error.message.includes('no encontrado')) {
            errorMessage = 'El indicador solicitado no existe';
        }
        
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="bar-chart-x" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">${errorMessage}</h2>
                <p class="text-gray-600 mb-6">
                    ${error.message.includes('permisos') ? 
                        'Contacte a su administrador para obtener acceso.' :
                        'Verifique que el indicador existe y que tiene los permisos necesarios.'
                    }
                </p>
                <div class="space-x-3">
                    <button onclick="window.router.goBack()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Volver
                    </button>
                    <button onclick="window.router.navigateTo('/')" class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                        Ir al inicio
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
 * Crear HTML principal de la vista de indicador
 */
function createIndicadorHTML() {
    const indicador = indicadorState.indicadorData;
    const area = indicadorState.areaData;
    const userRole = indicadorState.userProfile?.rol_principal;
    const canManage = ['ADMIN'].includes(userRole);
    
    return `
        <div class="space-y-6">
            <!-- Header del indicador -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                             style="background-color: ${area.color_hex || '#3B82F6'}">
                            <i data-lucide="bar-chart" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-gray-900">${indicador.nombre}</h1>
                            <p class="text-gray-600 mt-1">
                                <span class="font-medium">${indicador.clave}</span> • 
                                <span>${area.nombre}</span>
                            </p>
                            ${indicador.descripcion ? `
                                <p class="text-gray-700 mt-2 max-w-3xl">${indicador.descripcion}</p>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-3">
                        <!-- Información de permisos -->
                        <div class="text-right text-sm">
                            <div class="text-gray-600">Sus permisos:</div>
                            <div class="flex space-x-2 mt-1">
                                ${getPermissionBadges()}
                            </div>
                        </div>
                        
                        <!-- Botón de refresh -->
                        <button 
                            id="refresh-indicator-btn"
                            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                            title="Actualizar datos"
                        >
                            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                        </button>
                        
                        <!-- Botón de gestión (solo para ADMIN) -->
                        ${canManage ? `
                            <button 
                                id="manage-indicator-btn"
                                class="bg-aifa-blue text-white px-4 py-2 rounded-lg hover:bg-aifa-dark transition-colors"
                                title="Gestionar indicador"
                            >
                                <i data-lucide="settings" class="w-5 h-5"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Información del indicador -->
                ${createIndicadorInfoHTML()}
            </div>
            
            <!-- Pestañas -->
            <div class="bg-white rounded-lg shadow-sm border">
                <!-- Header de pestañas -->
                <div class="border-b border-gray-200">
                    <nav class="flex space-x-8 px-6" aria-label="Tabs">
                        <button 
                            id="tab-historico"
                            class="tab-button py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                            onclick="switchTab('historico')"
                        >
                            <i data-lucide="clock" class="w-4 h-4 inline mr-2"></i>
                            Histórico
                        </button>
                        
                        ${indicadorState.userPermissions.canCapture ? `
                            <button 
                                id="tab-captura"
                                class="tab-button py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                                onclick="switchTab('captura')"
                            >
                                <i data-lucide="edit" class="w-4 h-4 inline mr-2"></i>
                                Captura
                            </button>
                        ` : ''}
                        
                        ${indicadorState.userPermissions.canEdit ? `
                            <button 
                                id="tab-auditoria"
                                class="tab-button py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                                onclick="switchTab('auditoria')"
                            >
                                <i data-lucide="file-text" class="w-4 h-4 inline mr-2"></i>
                                Auditoría
                            </button>
                        ` : ''}
                    </nav>
                </div>
                
                <!-- Contenido de pestañas -->
                <div class="p-6">
                    <div id="tab-content">
                        <!-- El contenido se carga dinámicamente -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de información del indicador
 */
function createIndicadorInfoHTML() {
    const indicador = indicadorState.indicadorData;
    const totalMediciones = indicador.total_mediciones || 0;
    const ultimoPeriodo = indicador.ultimo_anio_con_datos ? 
        `${indicador.ultimo_anio_con_datos}/${indicador.ultimo_mes_con_datos?.toString().padStart(2, '0')}` : 
        'Sin datos';
    
    return `
        <div class="mt-6 pt-6 border-t border-gray-200">
            <div class="grid grid-cols-2 lg:grid-cols-6 gap-6">
                <div class="text-center">
                    <div class="text-lg font-bold text-gray-900 mb-1">${indicador.unidad_medida}</div>
                    <div class="text-sm text-gray-600">Unidad</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-gray-900 mb-1">${indicador.frecuencia}</div>
                    <div class="text-sm text-gray-600">Frecuencia</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-aifa-blue mb-1">
                        ${indicador.meta_anual ? formatNumber(indicador.meta_anual) : 'N/A'}
                    </div>
                    <div class="text-sm text-gray-600">Meta anual</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-green-600 mb-1">${formatNumber(totalMediciones, 0)}</div>
                    <div class="text-sm text-gray-600">Mediciones</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-purple-600 mb-1">${ultimoPeriodo}</div>
                    <div class="text-sm text-gray-600">Último período</div>
                </div>
                <div class="text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <span class="w-3 h-3 rounded-full ${indicador.es_acumulativo ? 'bg-blue-500' : 'bg-gray-400'}"></span>
                        <span class="text-sm font-medium text-gray-900">
                            ${indicador.es_acumulativo ? 'Acumulativo' : 'No acumulativo'}
                        </span>
                    </div>
                    <div class="text-sm text-gray-600">Tipo</div>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// CARGA DE DATOS INICIAL
// =====================================================

/**
 * Cargar datos del indicador
 */
async function loadIndicadorData() {
    try {
        const { data } = await selectData('v_indicadores_area', {
            select: '*',
            filters: { clave: indicadorState.indicadorClave }
        });
        
        if (data && data.length > 0) {
            indicadorState.indicadorData = data[0];
            
            // Cargar datos del área
            const { data: areaData } = await selectData('areas', {
                select: '*',
                filters: { id: indicadorState.indicadorData.area_id }
            });
            
            if (areaData && areaData.length > 0) {
                indicadorState.areaData = areaData[0];
            }
            
            if (DEBUG.enabled) {
                console.log('📊 Datos del indicador cargados:', indicadorState.indicadorData.nombre);
            }
        } else {
            indicadorState.indicadorData = null;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos del indicador:', error);
        indicadorState.indicadorData = null;
    }
}

/**
 * Verificar permisos del usuario
 */
async function checkUserPermissions() {
    try {
        const areaId = indicadorState.indicadorData?.area_id;
        if (!areaId) return;
        
        const permissions = await Promise.all([
            checkAreaPermission(areaId, 'SELECT'),
            checkAreaPermission(areaId, 'INSERT'),
            checkAreaPermission(areaId, 'UPDATE'),
            checkAreaPermission(areaId, 'DELETE')
        ]);
        
        indicadorState.userPermissions = {
            canRead: permissions[0],
            canCapture: permissions[1],
            canEdit: permissions[2],
            canDelete: permissions[3]
        };
        
        if (DEBUG.enabled) {
            console.log('🔒 Permisos del usuario en el indicador:', indicadorState.userPermissions);
        }
        
    } catch (error) {
        console.error('❌ Error al verificar permisos:', error);
        indicadorState.userPermissions = {
            canRead: false,
            canCapture: false,
            canEdit: false,
            canDelete: false
        };
    }
}

/**
 * Cargar datos según la pestaña activa
 */
async function loadTabData() {
    switch (indicadorState.currentTab) {
        case 'historico':
            await loadHistoricoData();
            break;
        case 'auditoria':
            if (indicadorState.userPermissions.canEdit) {
                await loadAuditoriaData();
            }
            break;
        // La pestaña de captura no requiere carga previa
    }
}

/**
 * Cargar datos históricos
 */
async function loadHistoricoData() {
    try {
        const { data } = await selectData('v_mediciones_historico', {
            select: '*',
            filters: { indicador_id: indicadorState.indicadorData.id },
            orderBy: { column: 'anio', ascending: false }
        });
        
        indicadorState.medicionesHistorico = data || [];
        
        // Determinar años disponibles para el selector
        const availableYears = [...new Set(indicadorState.medicionesHistorico.map(m => m.anio))].sort((a, b) => b - a);
        
        // Seleccionar últimos 2 años por defecto
        if (indicadorState.selectedYears.length === 0) {
            indicadorState.selectedYears = availableYears.slice(0, 2);
        }
        
        if (DEBUG.enabled) {
            console.log(`📈 Cargadas ${indicadorState.medicionesHistorico.length} mediciones históricas`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos históricos:', error);
        indicadorState.medicionesHistorico = [];
    }
}

/**
 * Cargar datos de auditoría
 */
async function loadAuditoriaData() {
    try {
        // Obtener IDs de mediciones del indicador
        const medicionIds = indicadorState.medicionesHistorico.map(m => m.id);
        
        if (medicionIds.length === 0) {
            indicadorState.auditoriaData = [];
            return;
        }
        
        const { data } = await selectData('v_auditoria_expandida', {
            select: '*',
            filters: { 
                tabla_afectada: 'mediciones',
                registro_id: medicionIds
            },
            orderBy: { column: 'fecha_operacion', ascending: false }
        });
        
        indicadorState.auditoriaData = data || [];
        
        if (DEBUG.enabled) {
            console.log(`📋 Cargados ${indicadorState.auditoriaData.length} registros de auditoría`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos de auditoría:', error);
        indicadorState.auditoriaData = [];
    }
}
// =====================================================
// VISTA DE INDICADOR ESPECÍFICO - PESTAÑAS COMPLETAS
// Pestaña Histórico - Tabla y Gráfica
// =====================================================

/**
 * Crear contenido de la pestaña histórico
 */
function createHistoricoTabHTML() {
    const availableYears = [...new Set(indicadorState.medicionesHistorico.map(m => m.anio))].sort((a, b) => b - a);
    const filteredData = getFilteredHistoricoData();
    
    return `
        <div class="space-y-6">
            <!-- Controles del histórico -->
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div class="flex items-center space-x-4">
                    <h3 class="text-lg font-semibold text-gray-900">Datos históricos</h3>
                    <span class="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                        ${filteredData.length} registro${filteredData.length !== 1 ? 's' : ''}
                    </span>
                </div>
                
                <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <!-- Selector de años -->
                    <div class="flex items-center space-x-2">
                        <label class="text-sm font-medium text-gray-700">Años a mostrar:</label>
                        <div class="relative">
                            <button 
                                id="year-selector-btn"
                                class="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            >
                                <span id="selected-years-text">${getSelectedYearsText()}</span>
                                <i data-lucide="chevron-down" class="w-4 h-4"></i>
                            </button>
                            
                            <div id="year-selector-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                <div class="p-3">
                                    <div class="space-y-2 max-h-40 overflow-y-auto">
                                        ${availableYears.map(year => `
                                            <label class="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    value="${year}" 
                                                    ${indicadorState.selectedYears.includes(year) ? 'checked' : ''}
                                                    class="year-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                                >
                                                <span class="text-sm text-gray-700">${year}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                    <div class="mt-3 pt-3 border-t border-gray-200">
                                        <button 
                                            id="apply-year-filter"
                                            class="w-full bg-aifa-blue text-white px-3 py-2 rounded text-sm hover:bg-aifa-dark transition-colors"
                                        >
                                            Aplicar filtro
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div class="flex items-center space-x-2">
                        <button 
                            id="export-historico-btn"
                            class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center space-x-2"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Exportar CSV</span>
                        </button>
                        
                        <button 
                            id="toggle-chart-btn"
                            class="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600 transition-colors flex items-center space-x-2"
                        >
                            <i data-lucide="eye" class="w-4 h-4"></i>
                            <span id="chart-toggle-text">Ocultar gráfica</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Gráfica de líneas -->
            <div id="chart-container" class="bg-gray-50 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-md font-semibold text-gray-900">Evolución temporal</h4>
                    <div class="text-sm text-gray-600">
                        ${indicadorState.indicadorData.unidad_medida} por mes
                    </div>
                </div>
                <div class="relative" style="height: 400px;">
                    <canvas id="historico-chart"></canvas>
                </div>
            </div>
            
            <!-- Tabla de datos -->
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h4 class="text-md font-semibold text-gray-900">Tabla de mediciones</h4>
                </div>
                
                <div class="overflow-x-auto">
                    ${createHistoricoTableHTML(filteredData)}
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear tabla de datos históricos
 */
function createHistoricoTableHTML(data) {
    if (!data || data.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="calendar-x" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                <p class="text-gray-500">No hay datos históricos para los años seleccionados</p>
            </div>
        `;
    }
    
    return `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Período
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Meta
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cumplimiento
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Capturado por
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha captura
                    </th>
                    ${indicadorState.userPermissions.canEdit ? `
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                        </th>
                    ` : ''}
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${data.map((medicion, index) => createHistoricoRowHTML(medicion, index)).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Crear fila de la tabla histórica
 */
function createHistoricoRowHTML(medicion, index) {
    const cumplimiento = medicion.porcentaje_cumplimiento;
    const cumplimientoColor = cumplimiento >= 100 ? 'text-green-600' : 
                             cumplimiento >= 80 ? 'text-yellow-600' : 'text-red-600';
    
    const hasEdits = medicion.numero_ediciones > 0;
    const editInfo = hasEdits ? `Editado ${medicion.numero_ediciones} vez${medicion.numero_ediciones !== 1 ? 'es' : ''}` : '';
    
    return `
        <tr class="hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-900">
                        ${medicion.anio}/${medicion.mes.toString().padStart(2, '0')}
                    </span>
                    ${hasEdits ? `
                        <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title="${editInfo}">
                            <i data-lucide="edit-3" class="w-3 h-3"></i>
                        </span>
                    ` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-900">
                    ${formatNumber(medicion.valor)} ${indicadorState.indicadorData.unidad_medida}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-600">
                    ${medicion.meta_mensual ? formatNumber(medicion.meta_mensual) : 
                      (indicadorState.indicadorData.meta_anual ? formatNumber(indicadorState.indicadorData.meta_anual / 12) : 'N/A')
                    }
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium ${cumplimientoColor}">
                    ${cumplimiento ? formatPercentage(cumplimiento / 100) : 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${medicion.capturado_por_nombre}</div>
                <div class="text-xs text-gray-500">${medicion.capturado_por_email}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatDate(medicion.fecha_captura, 'short')}</div>
                ${hasEdits && medicion.fecha_ultima_edicion ? `
                    <div class="text-xs text-gray-500">
                        Editado: ${formatDate(medicion.fecha_ultima_edicion, 'short')}
                    </div>
                ` : ''}
            </td>
            ${indicadorState.userPermissions.canEdit ? `
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex items-center justify-end space-x-2">
                        <button 
                            onclick="editMedicion('${medicion.id}')"
                            class="text-aifa-blue hover:text-aifa-dark transition-colors"
                            title="Editar medición"
                        >
                            <i data-lucide="edit" class="w-4 h-4"></i>
                        </button>
                        ${indicadorState.userPermissions.canDelete ? `
                            <button 
                                onclick="deleteMedicion('${medicion.id}', '${medicion.anio}/${medicion.mes}')"
                                class="text-red-600 hover:text-red-800 transition-colors"
                                title="Eliminar medición"
                            >
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            ` : ''}
        </tr>
    `;
}

/**
 * Crear y actualizar gráfica de líneas
 */
function createChart() {
    const canvas = document.getElementById('historico-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfica existente
    if (indicadorState.chartInstance) {
        indicadorState.chartInstance.destroy();
    }
    
    const chartData = prepareChartData();
    
    indicadorState.chartInstance = new Chart(ctx, {
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
                    text: `${indicadorState.indicadorData.nombre} - Evolución por años`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Mes ${context[0].label}`;
                        },
                        label: function(context) {
                            const value = formatNumber(context.parsed.y);
                            const unit = indicadorState.indicadorData.unidad_medida;
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
                        text: indicadorState.indicadorData.unidad_medida
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
                    tension: 0.2
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
 * Preparar datos para la gráfica
 */
function prepareChartData() {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const colors = APP_CONFIG.charts.defaultColors;
    
    const datasets = indicadorState.selectedYears.map((year, index) => {
        const yearData = indicadorState.medicionesHistorico.filter(m => m.anio === year);
        const data = months.map(month => {
            const medicion = yearData.find(m => m.mes.toString().padStart(2, '0') === month);
            return medicion ? medicion.valor : null;
        });
        
        return {
            label: `Año ${year}`,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            fill: false,
            spanGaps: false
        };
    });
    
    // Agregar línea de meta si existe
    if (indicadorState.indicadorData.meta_anual) {
        const metaMensual = indicadorState.indicadorData.meta_anual / 12;
        datasets.push({
            label: 'Meta mensual',
            data: Array(12).fill(metaMensual),
            borderColor: '#EF4444',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0
        });
    }
    
    return {
        labels: months,
        datasets: datasets
    };
}

/**
 * Obtener datos filtrados por años seleccionados
 */
function getFilteredHistoricoData() {
    if (indicadorState.selectedYears.length === 0) {
        return indicadorState.medicionesHistorico;
    }
    
    return indicadorState.medicionesHistorico
        .filter(m => indicadorState.selectedYears.includes(m.anio))
        .sort((a, b) => {
            if (a.anio !== b.anio) return b.anio - a.anio;
            return b.mes - a.mes;
        });
}

/**
 * Obtener texto de años seleccionados
 */
function getSelectedYearsText() {
    if (indicadorState.selectedYears.length === 0) {
        return 'Todos los años';
    }
    
    if (indicadorState.selectedYears.length <= 3) {
        return indicadorState.selectedYears.sort((a, b) => b - a).join(', ');
    }
    
    return `${indicadorState.selectedYears.length} años seleccionados`;
}

/**
 * Actualizar contenido del histórico
 */
async function updateHistoricoContent() {
    const tabContent = document.getElementById('tab-content');
    if (!tabContent) return;
    
    tabContent.innerHTML = createHistoricoTabHTML();
    
    // Configurar event listeners específicos del histórico
    setupHistoricoEventListeners();
    
    // Crear gráfica
    setTimeout(() => {
        createChart();
    }, 100);
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Configurar event listeners del histórico
 */
function setupHistoricoEventListeners() {
    // Selector de años
    const yearSelectorBtn = document.getElementById('year-selector-btn');
    const yearSelectorDropdown = document.getElementById('year-selector-dropdown');
    
    if (yearSelectorBtn && yearSelectorDropdown) {
        yearSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            yearSelectorDropdown.classList.toggle('hidden');
        });
        
        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!yearSelectorBtn.contains(e.target) && !yearSelectorDropdown.contains(e.target)) {
                yearSelectorDropdown.classList.add('hidden');
            }
        });
    }
    
    // Aplicar filtro de años
    const applyYearFilter = document.getElementById('apply-year-filter');
    if (applyYearFilter) {
        applyYearFilter.addEventListener('click', handleYearFilterChange);
    }
    
    // Exportar CSV
    const exportBtn = document.getElementById('export-historico-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportHistorico);
    }
    
    // Toggle gráfica
    const toggleChartBtn = document.getElementById('toggle-chart-btn');
    if (toggleChartBtn) {
        toggleChartBtn.addEventListener('click', handleToggleChart);
    }
}
// =====================================================
// VISTA DE INDICADOR ESPECÍFICO - PESTAÑAS COMPLETAS
// Pestañas Captura y Auditoría
// =====================================================

/**
 * Crear contenido de la pestaña captura
 */
function createCapturaTabHTML() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Verificar si ya existe medición para el mes actual
    const existingMedicion = indicadorState.medicionesHistorico.find(
        m => m.anio === currentYear && m.mes === currentMonth
    );
    
    return `
        <div class="space-y-6">
            <!-- Header de captura -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Captura de medición</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        ${existingMedicion ? 'Editando medición existente' : 'Registrando nueva medición'} para 
                        ${new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth - 1))}
                    </p>
                </div>
                
                ${existingMedicion ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                        <div class="flex items-center space-x-2">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-yellow-600"></i>
                            <span class="text-sm text-yellow-800">Ya existe una medición para este período</span>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Formulario de captura -->
            <form id="captura-form" class="bg-white border border-gray-200 rounded-lg p-6" novalidate>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Información del período -->
                    <div class="space-y-4">
                        <h4 class="text-md font-semibold text-gray-900">Información del período</h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="anio" class="block text-sm font-medium text-gray-700 mb-2">
                                    Año <span class="text-red-500">*</span>
                                </label>
                                <select 
                                    id="anio" 
                                    name="anio" 
                                    required
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                                >
                                    ${Array.from({length: 6}, (_, i) => currentYear - 2 + i).map(year => `
                                        <option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div>
                                <label for="mes" class="block text-sm font-medium text-gray-700 mb-2">
                                    Mes <span class="text-red-500">*</span>
                                </label>
                                <select 
                                    id="mes" 
                                    name="mes" 
                                    required
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                                >
                                    ${Array.from({length: 12}, (_, i) => i + 1).map(month => `
                                        <option value="${month}" ${month === currentMonth ? 'selected' : ''}>
                                            ${new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(2024, month - 1))}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <!-- Información del indicador -->
                        <div class="bg-gray-50 rounded-lg p-4">
                            <h5 class="text-sm font-medium text-gray-900 mb-2">Información del indicador</h5>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Unidad de medida:</span>
                                    <span class="font-medium">${indicadorState.indicadorData.unidad_medida}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Frecuencia:</span>
                                    <span class="font-medium">${indicadorState.indicadorData.frecuencia}</span>
                                </div>
                                ${indicadorState.indicadorData.meta_anual ? `
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">Meta anual:</span>
                                        <span class="font-medium">${formatNumber(indicadorState.indicadorData.meta_anual)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">Meta mensual promedio:</span>
                                        <span class="font-medium">${formatNumber(indicadorState.indicadorData.meta_anual / 12)}</span>
                                    </div>
                                ` : ''}
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Tipo:</span>
                                    <span class="font-medium">${indicadorState.indicadorData.es_acumulativo ? 'Acumulativo' : 'No acumulativo'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Datos de la medición -->
                    <div class="space-y-4">
                        <h4 class="text-md font-semibold text-gray-900">Datos de la medición</h4>
                        
                        <div>
                            <label for="valor" class="block text-sm font-medium text-gray-700 mb-2">
                                Valor <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input 
                                    type="number" 
                                    id="valor" 
                                    name="valor" 
                                    step="0.0001"
                                    required
                                    placeholder="Ingrese el valor medido"
                                    value="${existingMedicion ? existingMedicion.valor : ''}"
                                    class="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                                >
                                <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span class="text-gray-500 text-sm">${indicadorState.indicadorData.unidad_medida}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label for="meta_mensual" class="block text-sm font-medium text-gray-700 mb-2">
                                Meta específica del mes
                            </label>
                            <input 
                                type="number" 
                                id="meta_mensual" 
                                name="meta_mensual" 
                                step="0.0001"
                                placeholder="${indicadorState.indicadorData.meta_anual ? formatNumber(indicadorState.indicadorData.meta_anual / 12) : 'Meta para este mes'}"
                                value="${existingMedicion ? (existingMedicion.meta_mensual || '') : ''}"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue"
                            >
                            <p class="text-xs text-gray-500 mt-1">
                                Opcional. Si no se especifica, se usará la meta anual promediada.
                            </p>
                        </div>
                        
                        <div>
                            <label for="observaciones" class="block text-sm font-medium text-gray-700 mb-2">
                                Observaciones
                            </label>
                            <textarea 
                                id="observaciones" 
                                name="observaciones" 
                                rows="4"
                                placeholder="Agregue cualquier observación o comentario sobre esta medición..."
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue resize-none"
                            >${existingMedicion ? (existingMedicion.observaciones || '') : ''}</textarea>
                        </div>
                        
                        <!-- Cálculo automático de cumplimiento -->
                        <div id="cumplimiento-preview" class="bg-blue-50 rounded-lg p-4 hidden">
                            <h5 class="text-sm font-medium text-blue-900 mb-2">Preview de cumplimiento</h5>
                            <div id="cumplimiento-content" class="text-sm text-blue-800"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Botones de acción -->
                <div class="mt-8 pt-6 border-t border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-600">
                            <i data-lucide="info" class="w-4 h-4 inline mr-1"></i>
                            ${existingMedicion ? 'Los cambios se registrarán en la auditoría del sistema.' : 'Esta medición será registrada por primera vez.'}
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            <button 
                                type="button" 
                                id="cancel-captura-btn"
                                class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                id="save-captura-btn"
                                class="px-6 py-2 bg-aifa-blue text-white rounded-lg hover:bg-aifa-dark transition-colors flex items-center space-x-2"
                            >
                                <i data-lucide="save" class="w-4 h-4"></i>
                                <span>${existingMedicion ? 'Actualizar medición' : 'Guardar medición'}</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Campo oculto para ID de medición existente -->
                <input type="hidden" id="medicion_id" name="medicion_id" value="${existingMedicion ? existingMedicion.id : ''}">
            </form>
        </div>
    `;
}

/**
 * Crear contenido de la pestaña auditoría
 */
function createAuditoriaTabHTML() {
    return `
        <div class="space-y-6">
            <!-- Header de auditoría -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Registro de auditoría</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        Historial completo de modificaciones (solo lectura)
                    </p>
                </div>
                
                <div class="text-sm text-gray-500">
                    ${indicadorState.auditoriaData.length} registro${indicadorState.auditoriaData.length !== 1 ? 's' : ''} de auditoría
                </div>
            </div>
            
            <!-- Filtros de auditoría -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0">
                    <div class="flex items-center space-x-2">
                        <label class="text-sm font-medium text-gray-700">Filtrar por:</label>
                        <select id="auditoria-filter-type" class="text-sm border border-gray-300 rounded px-3 py-1">
                            <option value="all">Todas las operaciones</option>
                            <option value="INSERT">Nuevas mediciones</option>
                            <option value="UPDATE">Modificaciones</option>
                            <option value="DELETE">Eliminaciones</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <label class="text-sm font-medium text-gray-700">Período:</label>
                        <select id="auditoria-filter-period" class="text-sm border border-gray-300 rounded px-3 py-1">
                            <option value="all">Todo el historial</option>
                            <option value="7">Últimos 7 días</option>
                            <option value="30">Últimos 30 días</option>
                            <option value="90">Últimos 3 meses</option>
                        </select>
                    </div>
                    
                    <button 
                        id="apply-auditoria-filter"
                        class="bg-aifa-blue text-white px-4 py-2 rounded text-sm hover:bg-aifa-dark transition-colors"
                    >
                        Aplicar filtros
                    </button>
                </div>
            </div>
            
            <!-- Timeline de auditoría -->
            <div class="bg-white border border-gray-200 rounded-lg">
                <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h4 class="text-md font-semibold text-gray-900">Timeline de modificaciones</h4>
                </div>
                
                <div class="p-6">
                    ${createAuditoriaTimelineHTML()}
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear timeline de auditoría
 */
function createAuditoriaTimelineHTML() {
    if (!indicadorState.auditoriaData || indicadorState.auditoriaData.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="file-search" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                <p class="text-gray-500">No hay registros de auditoría disponibles</p>
            </div>
        `;
    }
    
    return `
        <div class="flow-root">
            <ul class="-mb-8">
                ${indicadorState.auditoriaData.map((registro, index) => createAuditoriaItemHTML(registro, index)).join('')}
            </ul>
        </div>
    `;
}

/**
 * Crear item del timeline de auditoría
 */
function createAuditoriaItemHTML(registro, index) {
    const isLast = index === indicadorState.auditoriaData.length - 1;
    
    const operationConfig = {
        'INSERT': {
            icon: 'plus-circle',
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            title: 'Nueva medición creada'
        },
        'UPDATE': {
            icon: 'edit',
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            title: 'Medición modificada'
        },
        'DELETE': {
            icon: 'trash-2',
            color: 'text-red-600',
            bgColor: 'bg-red-100',
            title: 'Medición eliminada'
        }
    };
    
    const config = operationConfig[registro.operacion] || operationConfig['UPDATE'];
    
    return `
        <li>
            <div class="relative pb-8">
                ${!isLast ? '<span class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>' : ''}
                
                <div class="relative flex space-x-3">
                    <div>
                        <span class="h-8 w-8 rounded-full ${config.bgColor} flex items-center justify-center ring-8 ring-white">
                            <i data-lucide="${config.icon}" class="w-4 h-4 ${config.color}"></i>
                        </span>
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-900">${config.title}</p>
                                <p class="text-sm text-gray-600">
                                    por <span class="font-medium">${registro.usuario_nombre}</span>
                                    <span class="text-gray-400">•</span>
                                    <span class="text-xs text-gray-500">${registro.usuario_email}</span>
                                </p>
                            </div>
                            <div class="text-right text-sm text-gray-500">
                                <div>${formatDate(registro.fecha_operacion, 'time')}</div>
                                <div class="text-xs">${formatDate(registro.fecha_operacion, 'short')}</div>
                            </div>
                        </div>
                        
                        <!-- Detalles del cambio -->
                        ${registro.detalle_cambio_valor ? `
                            <div class="mt-2 text-sm text-gray-700">
                                <span class="font-medium">Valor:</span> ${registro.detalle_cambio_valor}
                            </div>
                        ` : ''}
                        
                        ${registro.campos_modificados && registro.campos_modificados.length > 0 ? `
                            <div class="mt-2">
                                <span class="text-sm text-gray-600">Campos modificados:</span>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${registro.campos_modificados.map(campo => `
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            ${campo}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${registro.observaciones ? `
                            <div class="mt-2 text-sm text-gray-600 italic">
                                "${registro.observaciones}"
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </li>
    `;
}

/**
 * Actualizar contenido de captura
 */
async function updateCapturaContent() {
    const tabContent = document.getElementById('tab-content');
    if (!tabContent) return;
    
    tabContent.innerHTML = createCapturaTabHTML();
    
    // Configurar event listeners específicos de captura
    setupCapturaEventListeners();
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Actualizar contenido de auditoría
 */
async function updateAuditoriaContent() {
    const tabContent = document.getElementById('tab-content');
    if (!tabContent) return;
    
    tabContent.innerHTML = createAuditoriaTabHTML();
    
    // Configurar event listeners específicos de auditoría
    setupAuditoriaEventListeners();
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Configurar event listeners de captura
 */
function setupCapturaEventListeners() {
    // Formulario de captura
    const capturaForm = document.getElementById('captura-form');
    if (capturaForm) {
        capturaForm.addEventListener('submit', handleCapturaSubmit);
    }
    
    // Botón cancelar
    const cancelBtn = document.getElementById('cancel-captura-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            switchTab('historico');
        });
    }
    
    // Preview de cumplimiento en tiempo real
    const valorInput = document.getElementById('valor');
    const metaInput = document.getElementById('meta_mensual');
    
    if (valorInput && metaInput) {
        [valorInput, metaInput].forEach(input => {
            input.addEventListener('input', updateCumplimientoPreview);
        });
    }
    
    // Cambio de período para verificar medición existente
    const anioSelect = document.getElementById('anio');
    const mesSelect = document.getElementById('mes');
    
    if (anioSelect && mesSelect) {
        [anioSelect, mesSelect].forEach(select => {
            select.addEventListener('change', checkExistingMedicion);
        });
    }
}

/**
 * Configurar event listeners de auditoría
 */
function setupAuditoriaEventListeners() {
    // Filtros de auditoría
    const applyFilterBtn = document.getElementById('apply-auditoria-filter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', handleAuditoriaFilter);
    }
}
// =====================================================
// VISTA DE INDICADOR ESPECÍFICO - PESTAÑAS COMPLETAS
// Event listeners, handlers y funciones auxiliares
// =====================================================

// =====================================================
// SISTEMA DE PESTAÑAS
// =====================================================

/**
 * Cambiar pestaña activa
 */
window.switchTab = async function(tabName) {
    indicadorState.currentTab = tabName;
    
    // Actualizar clases de pestañas
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('border-aifa-blue', 'text-aifa-blue');
        btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    });
    
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) {
        activeTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        activeTab.classList.add('border-aifa-blue', 'text-aifa-blue');
    }
    
    // Cargar contenido de la pestaña
    try {
        showLoading('Cargando...');
        
        switch (tabName) {
            case 'historico':
                await loadHistoricoData();
                await updateHistoricoContent();
                break;
            case 'captura':
                await updateCapturaContent();
                break;
            case 'auditoria':
                await loadAuditoriaData();
                await updateAuditoriaContent();
                break;
        }
        
        hideLoading();
    } catch (error) {
        console.error(`❌ Error al cambiar a pestaña ${tabName}:`, error);
        hideLoading();
        showToast('Error al cargar el contenido de la pestaña', 'error');
    }
};

// =====================================================
// EVENT LISTENERS PRINCIPALES
// =====================================================

/**
 * Configurar event listeners principales
 */
function setupEventListeners() {
    // Botón de refresh
    const refreshBtn = document.getElementById('refresh-indicator-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshIndicator);
    }
    
    // Botón de gestión
    const manageBtn = document.getElementById('manage-indicator-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', handleManageIndicator);
    }
}

/**
 * Actualizar breadcrumb
 */
function updateBreadcrumb() {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer || !indicadorState.indicadorData) return;
    
    breadcrumbContainer.innerHTML = `
        <li class="flex items-center">
            <a href="#/" class="text-gray-600 hover:text-aifa-blue flex items-center transition-colors">
                <i data-lucide="home" class="w-4 h-4 mr-1"></i>
                Inicio
            </a>
        </li>
        <li class="flex items-center">
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-2"></i>
            <a href="#/area/${indicadorState.areaData.id}" class="text-gray-600 hover:text-aifa-blue flex items-center transition-colors">
                <i data-lucide="folder" class="w-4 h-4 mr-1"></i>
                ${indicadorState.areaData.nombre}
            </a>
        </li>
        <li class="flex items-center">
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-2"></i>
            <span class="text-aifa-blue font-medium flex items-center">
                <i data-lucide="bar-chart" class="w-4 h-4 mr-1"></i>
                ${indicadorState.indicadorData.nombre}
            </span>
        </li>
    `;
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =====================================================
// HANDLERS DE EVENTOS
// =====================================================

/**
 * Manejar refresh del indicador
 */
async function handleRefreshIndicator() {
    try {
        const refreshBtn = document.getElementById('refresh-indicator-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await Promise.all([
            loadIndicadorData(),
            loadTabData()
        ]);
        
        // Re-renderizar pestaña actual
        await switchTab(indicadorState.currentTab);
        
        showToast('Datos del indicador actualizados', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar indicador:', error);
        showToast('Error al actualizar los datos', 'error');
    }
}

/**
 * Manejar gestión del indicador
 */
function handleManageIndicator() {
    showToast('Funcionalidad de gestión en desarrollo', 'info');
}

/**
 * Manejar cambio de filtro de años
 */
function handleYearFilterChange() {
    const checkboxes = document.querySelectorAll('.year-checkbox');
    const selectedYears = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
    
    indicadorState.selectedYears = selectedYears;
    
    // Actualizar texto del selector
    const selectedYearsText = document.getElementById('selected-years-text');
    if (selectedYearsText) {
        selectedYearsText.textContent = getSelectedYearsText();
    }
    
    // Ocultar dropdown
    const dropdown = document.getElementById('year-selector-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    
    // Actualizar contenido
    updateHistoricoContent();
}

/**
 * Manejar exportación del histórico
 */
function handleExportHistorico() {
    try {
        const filteredData = getFilteredHistoricoData();
        
        if (filteredData.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        // Preparar datos para CSV
        const csvData = filteredData.map(medicion => ({
            'Año': medicion.anio,
            'Mes': medicion.mes,
            'Período': `${medicion.anio}/${medicion.mes.toString().padStart(2, '0')}`,
            'Valor': medicion.valor,
            'Unidad': indicadorState.indicadorData.unidad_medida,
            'Meta Mensual': medicion.meta_mensual || (indicadorState.indicadorData.meta_anual ? indicadorState.indicadorData.meta_anual / 12 : ''),
            'Cumplimiento (%)': medicion.porcentaje_cumplimiento || '',
            'Observaciones': medicion.observaciones || '',
            'Capturado Por': medicion.capturado_por_nombre,
            'Email': medicion.capturado_por_email,
            'Fecha Captura': formatDate(medicion.fecha_captura, 'long'),
            'Número Ediciones': medicion.numero_ediciones,
            'Fecha Última Edición': medicion.fecha_ultima_edicion ? formatDate(medicion.fecha_ultima_edicion, 'long') : ''
        }));
        
        const filename = `${indicadorState.indicadorData.clave}_historico_${new Date().toISOString().slice(0, 10)}.csv`;
        exportToCSV(csvData, filename);
        
    } catch (error) {
        console.error('❌ Error al exportar histórico:', error);
        showToast('Error al exportar los datos', 'error');
    }
}

/**
 * Manejar toggle de gráfica
 */
function handleToggleChart() {
    const chartContainer = document.getElementById('chart-container');
    const toggleBtn = document.getElementById('toggle-chart-btn');
    const toggleText = document.getElementById('chart-toggle-text');
    
    if (chartContainer && toggleBtn && toggleText) {
        const isHidden = chartContainer.classList.contains('hidden');
        
        if (isHidden) {
            chartContainer.classList.remove('hidden');
            toggleText.textContent = 'Ocultar gráfica';
            // Re-crear gráfica cuando se muestra
            setTimeout(() => createChart(), 100);
        } else {
            chartContainer.classList.add('hidden');
            toggleText.textContent = 'Mostrar gráfica';
        }
    }
}

/**
 * Manejar envío del formulario de captura
 */
async function handleCapturaSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('save-captura-btn');
    
    try {
        // Validar formulario
        const validation = validateForm(form, {
            anio: {
                required: true,
                custom: (value) => {
                    const year = parseInt(value);
                    if (year < VALIDATION.medicion.anio.min || year > VALIDATION.medicion.anio.max) {
                        return `El año debe estar entre ${VALIDATION.medicion.anio.min} y ${VALIDATION.medicion.anio.max}`;
                    }
                    return null;
                }
            },
            mes: {
                required: true,
                custom: (value) => {
                    const month = parseInt(value);
                    if (month < 1 || month > 12) {
                        return 'El mes debe estar entre 1 y 12';
                    }
                    return null;
                }
            },
            valor: {
                required: true,
                custom: (value) => {
                    const val = parseFloat(value);
                    if (isNaN(val)) {
                        return 'Debe ser un número válido';
                    }
                    if (val < VALIDATION.medicion.valor.min || val > VALIDATION.medicion.valor.max) {
                        return 'Valor fuera del rango permitido';
                    }
                    return null;
                }
            }
        });
        
        if (!validation.isValid) {
            return;
        }
        
        // Obtener datos del formulario
        const formData = getFormData(form);
        const medicionId = formData.medicion_id;
        const isUpdate = !!medicionId;
        
        // Preparar datos para guardar
        const medicionData = {
            indicador_id: indicadorState.indicadorData.id,
            anio: parseInt(formData.anio),
            mes: parseInt(formData.mes),
            valor: parseFloat(formData.valor),
            meta_mensual: formData.meta_mensual ? parseFloat(formData.meta_mensual) : null,
            observaciones: formData.observaciones?.trim() || null,
            capturado_por: indicadorState.userProfile.id
        };
        
        // Mostrar loading
        submitBtn.disabled = true;
        const originalText = submitBtn.querySelector('span').textContent;
        submitBtn.querySelector('span').textContent = isUpdate ? 'Actualizando...' : 'Guardando...';
        
        // Guardar o actualizar medición
        if (isUpdate) {
            await updateData('mediciones', medicionData, { id: medicionId });
            showToast('Medición actualizada correctamente', 'success');
        } else {
            await insertData('mediciones', medicionData);
            showToast('Medición guardada correctamente', 'success');
        }
        
        // Recargar datos y cambiar a pestaña histórico
        await loadHistoricoData();
        switchTab('historico');
        
    } catch (error) {
        console.error('❌ Error al guardar medición:', error);
        
        let errorMessage = 'Error al guardar la medición';
        if (error.message?.includes('duplicate key')) {
            errorMessage = 'Ya existe una medición para este período';
        }
        
        showToast(errorMessage, 'error');
        
    } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = originalText;
    }
}

/**
 * Actualizar preview de cumplimiento
 */
function updateCumplimientoPreview() {
    const valorInput = document.getElementById('valor');
    const metaInput = document.getElementById('meta_mensual');
    const previewContainer = document.getElementById('cumplimiento-preview');
    const previewContent = document.getElementById('cumplimiento-content');
    
    if (!valorInput || !previewContainer || !previewContent) return;
    
    const valor = parseFloat(valorInput.value);
    const metaEspecifica = metaInput ? parseFloat(metaInput.value) : null;
    const metaAnual = indicadorState.indicadorData.meta_anual;
    
    if (isNaN(valor)) {
        previewContainer.classList.add('hidden');
        return;
    }
    
    const meta = metaEspecifica || (metaAnual ? metaAnual / 12 : null);
    
    if (!meta) {
        previewContainer.classList.add('hidden');
        return;
    }
    
    const cumplimiento = (valor / meta) * 100;
    const cumplimientoColor = cumplimiento >= 100 ? 'text-green-600' : 
                             cumplimiento >= 80 ? 'text-yellow-600' : 'text-red-600';
    
    previewContent.innerHTML = `
        <div class="flex items-center justify-between">
            <span>Valor ingresado:</span>
            <span class="font-medium">${formatNumber(valor)} ${indicadorState.indicadorData.unidad_medida}</span>
        </div>
        <div class="flex items-center justify-between">
            <span>Meta utilizada:</span>
            <span class="font-medium">${formatNumber(meta)} ${indicadorState.indicadorData.unidad_medida}</span>
        </div>
        <div class="flex items-center justify-between border-t border-blue-200 pt-2 mt-2">
            <span>Cumplimiento:</span>
            <span class="font-bold ${cumplimientoColor}">${formatPercentage(cumplimiento / 100)}</span>
        </div>
    `;
    
    previewContainer.classList.remove('hidden');
}

/**
 * Verificar medición existente al cambiar período
 */
async function checkExistingMedicion() {
    const anioSelect = document.getElementById('anio');
    const mesSelect = document.getElementById('mes');
    
    if (!anioSelect || !mesSelect) return;
    
    const anio = parseInt(anioSelect.value);
    const mes = parseInt(mesSelect.value);
    
    const existingMedicion = indicadorState.medicionesHistorico.find(
        m => m.anio === anio && m.mes === mes
    );
    
    // Actualizar formulario según si existe o no la medición
    const submitBtn = document.getElementById('save-captura-btn');
    const medicionIdInput = document.getElementById('medicion_id');
    
    if (existingMedicion && submitBtn && medicionIdInput) {
        // Llenar formulario con datos existentes
        document.getElementById('valor').value = existingMedicion.valor;
        document.getElementById('meta_mensual').value = existingMedicion.meta_mensual || '';
        document.getElementById('observaciones').value = existingMedicion.observaciones || '';
        medicionIdInput.value = existingMedicion.id;
        
        submitBtn.querySelector('span').textContent = 'Actualizar medición';
        
        showToast('Se encontró una medición existente para este período', 'info');
    } else if (submitBtn && medicionIdInput) {
        // Limpiar formulario para nueva medición
        document.getElementById('valor').value = '';
        document.getElementById('meta_mensual').value = '';
        document.getElementById('observaciones').value = '';
        medicionIdInput.value = '';
        
        submitBtn.querySelector('span').textContent = 'Guardar medición';
    }
    
    // Actualizar preview
    updateCumplimientoPreview();
}

/**
 * Manejar filtros de auditoría
 */
function handleAuditoriaFilter() {
    // Por ahora solo mostrar mensaje, la implementación completa requeriría
    // recargar datos filtrados desde el servidor
    showToast('Filtros de auditoría en desarrollo', 'info');
}

/**
 * Editar medición desde la tabla
 */
window.editMedicion = function(medicionId) {
    const medicion = indicadorState.medicionesHistorico.find(m => m.id === medicionId);
    if (!medicion) {
        showToast('Medición no encontrada', 'error');
        return;
    }
    
    // Cambiar a pestaña de captura con datos precargados
    switchTab('captura').then(() => {
        // Los datos se cargarán automáticamente por el ID
        setTimeout(() => {
            const anioSelect = document.getElementById('anio');
            const mesSelect = document.getElementById('mes');
            
            if (anioSelect && mesSelect) {
                anioSelect.value = medicion.anio;
                mesSelect.value = medicion.mes;
                checkExistingMedicion();
            }
        }, 100);
    });
};

/**
 * Eliminar medición
 */
window.deleteMedicion = async function(medicionId, periodo) {
    try {
        const confirmed = await showConfirmModal(
            `¿Está seguro de eliminar la medición del período ${periodo}?`,
            {
                title: 'Confirmar eliminación',
                confirmText: 'Eliminar',
                type: 'danger'
            }
        );
        
        if (!confirmed) return;
        
        await deleteData('mediciones', { id: medicionId });
        
        showToast('Medición eliminada correctamente', 'success');
        
        // Recargar datos
        await loadHistoricoData();
        await updateHistoricoContent();
        
    } catch (error) {
        console.error('❌ Error al eliminar medición:', error);
        showToast('Error al eliminar la medición', 'error');
    }
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Obtener badges de permisos
 */
function getPermissionBadges() {
    const badges = [];
    
    if (indicadorState.userPermissions.canDelete) {
        badges.push('<span class="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">Eliminar</span>');
    }
    if (indicadorState.userPermissions.canEdit) {
        badges.push('<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Editar</span>');
    }
    if (indicadorState.userPermissions.canCapture) {
        badges.push('<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Capturar</span>');
    }
    if (indicadorState.userPermissions.canRead && !indicadorState.userPermissions.canCapture) {
        badges.push('<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">Solo lectura</span>');
    }
    
    return badges.join(' ');
}
