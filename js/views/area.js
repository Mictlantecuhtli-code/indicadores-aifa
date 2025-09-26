// =====================================================
// VISTA DE ÁREA ESPECÍFICA - BOTONES DE INDICADORES
// Renderizado y HTML
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, appState, getCurrentProfile, checkAreaPermission } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber, showConfirmModal } from '../lib/ui.js';

// Estado de la vista de área
const areaState = {
    areaId: null,
    areaData: null,
    indicadores: [],
    userProfile: null,
    userPermissions: {
        canRead: false,
        canCapture: false,
        canEdit: false,
        canDelete: false
    },
    loading: false,
    lastRefresh: null
};

// =====================================================
// RENDERIZADO DE LA VISTA
// =====================================================

/**
 * Renderizar vista de área específica
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('📁 Renderizando vista de área:', params);
        
        // Validar parámetros
        if (!params.id) {
            throw new Error('ID de área no proporcionado');
        }
        
        areaState.areaId = params.id;
        showLoading('Cargando indicadores del área...');
        
        // Obtener perfil del usuario
        areaState.userProfile = await getCurrentProfile();
        if (!areaState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Verificar permisos
        await checkUserPermissions();
        
        if (!areaState.userPermissions.canRead) {
            throw new Error('No tiene permisos para acceder a esta área');
        }
        
        // Cargar datos del área e indicadores
        await Promise.all([
            loadAreaData(),
            loadIndicadores()
        ]);
        
        // Verificar que el área existe
        if (!areaState.areaData) {
            throw new Error('Área no encontrada');
        }
        
        // Renderizar HTML
        container.innerHTML = createAreaHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Actualizar breadcrumb
        updateBreadcrumb();
        
        // Configurar auto-refresh
        setupAutoRefresh();
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        areaState.lastRefresh = new Date();
        
        if (DEBUG.enabled) console.log('✅ Vista de área renderizada correctamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar área:', error);
        hideLoading();
        
        let errorMessage = 'Error al cargar el área';
        let showBackButton = true;
        
        if (error.message.includes('permisos')) {
            errorMessage = 'No tiene permisos para acceder a esta área';
        } else if (error.message.includes('no encontrada')) {
            errorMessage = 'El área solicitada no existe';
        }
        
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="folder-x" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">${errorMessage}</h2>
                <p class="text-gray-600 mb-6">
                    ${error.message.includes('permisos') ? 
                        'Contacte a su administrador para obtener acceso.' :
                        'Verifique que el área existe y que tiene los permisos necesarios.'
                    }
                </p>
                <div class="space-x-3">
                    ${showBackButton ? `
                        <button onclick="window.router.goBack()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                            Volver
                        </button>
                    ` : ''}
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
 * Crear HTML de la vista de área
 */
function createAreaHTML() {
    const area = areaState.areaData;
    const userRole = areaState.userProfile?.rol_principal;
    const canManage = ['ADMIN'].includes(userRole);
    
    return `
        <div class="space-y-6">
            <!-- Header del área -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                             style="background-color: ${area.color_hex || '#3B82F6'}">
                            ${area.clave.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-gray-900">${area.nombre}</h1>
                            <p class="text-gray-600 mt-1">Clave: ${area.clave}</p>
                            ${area.descripcion ? `
                                <p class="text-gray-700 mt-2 max-w-2xl">${area.descripcion}</p>
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
                            id="refresh-area-btn"
                            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                            title="Actualizar datos"
                        >
                            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                        </button>
                        
                        <!-- Botón de gestión (solo para ADMIN) -->
                        ${canManage ? `
                            <button 
                                id="manage-area-btn"
                                class="bg-aifa-blue text-white px-4 py-2 rounded-lg hover:bg-aifa-dark transition-colors"
                                title="Gestionar área"
                            >
                                <i data-lucide="settings" class="w-5 h-5"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Estadísticas del área -->
                ${createAreaStatsHTML()}
            </div>
            
            <!-- Acciones rápidas del área -->
            ${createAreaActionsHTML()}
            
            <!-- Grid de indicadores -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                        <i data-lucide="bar-chart" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                        Indicadores del área
                    </h2>
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-500">
                            ${areaState.indicadores.length} indicador${areaState.indicadores.length !== 1 ? 'es' : ''} disponible${areaState.indicadores.length !== 1 ? 's' : ''}
                        </span>
                        ${canManage ? `
                            <button 
                                id="add-indicator-btn"
                                class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm"
                            >
                                <i data-lucide="plus" class="w-4 h-4 mr-1"></i>
                                Agregar indicador
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                ${createIndicadoresGridHTML()}
            </div>
            
            <!-- Información de ayuda -->
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="flex items-start space-x-3">
                    <i data-lucide="info" class="w-5 h-5 text-blue-500 mt-0.5"></i>
                    <div class="text-sm text-blue-800">
                        <p class="font-medium mb-1">¿Qué puede hacer en esta área?</p>
                        <ul class="space-y-1 text-blue-700">
                            <li>• <strong>Seleccione un indicador</strong> para ver su histórico, capturar datos o revisar auditoría</li>
                            ${areaState.userPermissions.canCapture ? '<li>• <strong>Capturar datos</strong> registrando nuevas mediciones mensuales</li>' : ''}
                            ${areaState.userPermissions.canEdit ? '<li>• <strong>Editar mediciones</strong> existentes y corregir datos históricos</li>' : ''}
                            <li>• <strong>Visualizar gráficas</strong> para analizar tendencias y cumplimiento de metas</li>
                            ${areaState.userPermissions.canEdit ? '<li>• <strong>Ver auditoría</strong> con el historial completo de modificaciones</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de estadísticas del área
 */
function createAreaStatsHTML() {
    const totalIndicadores = areaState.indicadores.length;
    const indicadoresConDatos = areaState.indicadores.filter(ind => ind.total_mediciones > 0).length;
    const totalMediciones = areaState.indicadores.reduce((sum, ind) => sum + (ind.total_mediciones || 0), 0);
    const ultimaActividad = getUltimaActividad();
    
    return `
        <div class="mt-6 pt-6 border-t border-gray-200">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="text-center">
                    <div class="text-2xl font-bold text-aifa-blue mb-1">${totalIndicadores}</div>
                    <div class="text-sm text-gray-600">Indicadores totales</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600 mb-1">${indicadoresConDatos}</div>
                    <div class="text-sm text-gray-600">Con datos</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600 mb-1">${formatNumber(totalMediciones, 0)}</div>
                    <div class="text-sm text-gray-600">Mediciones</div>
                </div>
                <div class="text-center">
                    <div class="text-sm font-medium text-gray-900 mb-1">${ultimaActividad}</div>
                    <div class="text-sm text-gray-600">Última actividad</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de acciones rápidas del área
 */
function createAreaActionsHTML() {
    const actions = [];
    
    // Visualización específica del área
    actions.push({
        icon: 'bar-chart-3',
        title: 'Visualizar área',
        description: 'Gráficas de todos los indicadores',
        color: 'blue',
        onclick: `window.router.navigateTo('/visualizacion', { area: '${areaState.areaId}' })`
    });
    
    // Captura rápida si tiene permisos
    if (areaState.userPermissions.canCapture) {
        actions.push({
            icon: 'edit',
            title: 'Captura rápida',
            description: 'Registrar medición del mes',
            color: 'green',
            onclick: 'handleQuickCapture()'
        });
    }
    
    // Exportar datos si puede leer
    if (areaState.userPermissions.canRead) {
        actions.push({
            icon: 'download',
            title: 'Exportar datos',
            description: 'Descargar mediciones en CSV',
            color: 'purple',
            onclick: 'handleExportArea()'
        });
    }
    
    if (actions.length === 0) return '';
    
    return `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i data-lucide="zap" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                Acciones rápidas
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-${Math.min(actions.length, 3)} gap-4">
                ${actions.map(action => `
                    <button 
                        onclick="${action.onclick}"
                        class="flex items-center p-4 bg-${action.color}-50 hover:bg-${action.color}-100 rounded-lg transition-colors group text-left"
                    >
                        <i data-lucide="${action.icon}" class="w-8 h-8 text-${action.color}-600 mr-3 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <h3 class="font-medium text-gray-900">${action.title}</h3>
                            <p class="text-sm text-gray-600">${action.description}</p>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}
// =====================================================
// VISTA DE ÁREA ESPECÍFICA - BOTONES DE INDICADORES
// Grid de indicadores, datos y eventos
// =====================================================

/**
 * Crear HTML del grid de indicadores
 */
function createIndicadoresGridHTML() {
    if (!areaState.indicadores || areaState.indicadores.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="bar-chart-x" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No hay indicadores</h3>
                <p class="text-gray-600 mb-4">
                    Esta área no tiene indicadores configurados.
                </p>
                ${['ADMIN'].includes(areaState.userProfile?.rol_principal) ? `
                    <button 
                        id="add-first-indicator-btn"
                        class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark"
                    >
                        Agregar primer indicador
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${areaState.indicadores.map(indicador => createIndicadorCardHTML(indicador)).join('')}
        </div>
    `;
}

/**
 * Crear HTML de una tarjeta de indicador
 */
function createIndicadorCardHTML(indicador) {
    const hasData = indicador.total_mediciones > 0;
    const lastUpdate = indicador.ultimo_anio_con_datos ? 
        `${indicador.ultimo_anio_con_datos}/${indicador.ultimo_mes_con_datos?.toString().padStart(2, '0')}` : 
        'Sin datos';
    
    const metaDisplay = indicador.meta_anual ? formatNumber(indicador.meta_anual) : 'No definida';
    
    return `
        <div class="indicator-button bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-aifa-blue transition-all duration-200 group cursor-pointer"
             onclick="navigateToIndicator('${indicador.clave}', '${indicador.nombre}')"
             role="button"
             tabindex="0"
             onkeydown="handleIndicatorKeydown(event, '${indicador.clave}', '${indicador.nombre}')"
             aria-label="Ir al indicador ${indicador.nombre}">
            
            <!-- Header del indicador -->
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="font-semibold text-gray-900 group-hover:text-aifa-blue transition-colors mb-1">
                        ${indicador.nombre}
                    </h3>
                    <p class="text-sm text-gray-500">${indicador.clave}</p>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 group-hover:text-aifa-blue group-hover:translate-x-1 transition-all"></i>
            </div>
            
            <!-- Descripción -->
            ${indicador.descripcion ? `
                <p class="text-sm text-gray-600 mb-4 line-clamp-2">
                    ${indicador.descripcion}
                </p>
            ` : ''}
            
            <!-- Información del indicador -->
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">Unidad:</span>
                    <span class="text-sm font-medium text-gray-900">${indicador.unidad_medida}</span>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">Frecuencia:</span>
                    <span class="text-sm font-medium text-gray-900">${indicador.frecuencia}</span>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">Meta anual:</span>
                    <span class="text-sm font-medium text-gray-900">${metaDisplay}</span>
                </div>
                
                ${hasData ? `
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Mediciones:</span>
                        <span class="text-sm font-medium text-gray-900">${formatNumber(indicador.total_mediciones, 0)}</span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Última medición:</span>
                        <span class="text-xs text-gray-500">${lastUpdate}</span>
                    </div>
                ` : `
                    <div class="text-center py-2">
                        <span class="text-xs text-gray-400">Sin mediciones registradas</span>
                    </div>
                `}
            </div>
            
            <!-- Estado del indicador -->
            <div class="mt-4 pt-3 border-t border-gray-100">
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">
                        ${indicador.es_acumulativo ? 'Acumulativo' : 'No acumulativo'}
                    </span>
                    <div class="flex items-center space-x-1">
                        ${hasData ? 
                            '<span class="w-2 h-2 bg-green-500 rounded-full"></span><span class="text-xs text-green-600">Con datos</span>' :
                            '<span class="w-2 h-2 bg-gray-400 rounded-full"></span><span class="text-xs text-gray-500">Sin datos</span>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Cargar datos del área
 */
async function loadAreaData() {
    try {
        const { data } = await selectData('areas', {
            select: '*',
            filters: { 
                id: areaState.areaId,
                estado: 'ACTIVO'
            }
        });
        
        if (data && data.length > 0) {
            areaState.areaData = data[0];
            if (DEBUG.enabled) console.log('📁 Datos del área cargados:', areaState.areaData.nombre);
        } else {
            areaState.areaData = null;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos del área:', error);
        areaState.areaData = null;
    }
}

/**
 * Cargar indicadores del área
 */
async function loadIndicadores() {
    try {
        const { data } = await selectData('v_indicadores_area', {
            select: '*',
            filters: { area_id: areaState.areaId },
            orderBy: { column: 'orden_visualizacion', ascending: true }
        });
        
        areaState.indicadores = data || [];
        
        if (DEBUG.enabled) {
            console.log(`📊 Cargados ${areaState.indicadores.length} indicadores para el área`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar indicadores:', error);
        areaState.indicadores = [];
        showToast('Error al cargar los indicadores del área', 'error');
    }
}

/**
 * Verificar permisos del usuario en el área
 */
async function checkUserPermissions() {
    try {
        const permissions = await Promise.all([
            checkAreaPermission(areaState.areaId, 'SELECT'),
            checkAreaPermission(areaState.areaId, 'INSERT'),
            checkAreaPermission(areaState.areaId, 'UPDATE'),
            checkAreaPermission(areaState.areaId, 'DELETE')
        ]);
        
        areaState.userPermissions = {
            canRead: permissions[0],
            canCapture: permissions[1],
            canEdit: permissions[2],
            canDelete: permissions[3]
        };
        
        if (DEBUG.enabled) {
            console.log('🔒 Permisos del usuario en el área:', areaState.userPermissions);
        }
        
    } catch (error) {
        console.error('❌ Error al verificar permisos:', error);
        areaState.userPermissions = {
            canRead: false,
            canCapture: false,
            canEdit: false,
            canDelete: false
        };
    }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de refresh
    const refreshBtn = document.getElementById('refresh-area-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshArea);
    }
    
    // Botón de gestión
    const manageBtn = document.getElementById('manage-area-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', handleManageArea);
    }
    
    // Botón de agregar indicador
    const addIndicatorBtn = document.getElementById('add-indicator-btn');
    if (addIndicatorBtn) {
        addIndicatorBtn.addEventListener('click', handleAddIndicator);
    }
    
    // Botón de primer indicador
    const addFirstIndicatorBtn = document.getElementById('add-first-indicator-btn');
    if (addFirstIndicatorBtn) {
        addFirstIndicatorBtn.addEventListener('click', handleAddIndicator);
    }
}

/**
 * Configurar auto-refresh
 */
function setupAutoRefresh() {
    // Limpiar interval anterior si existe
    if (window.areaRefreshInterval) {
        clearInterval(window.areaRefreshInterval);
    }
    
    // Refresh automático cada 3 minutos, solo si hay sesión y ventana visible
    window.areaRefreshInterval = setInterval(async () => {
        if (document.visibilityState === 'visible' && appState.session && areaState.areaId) {
            try {
                await refreshDataSilently();
            } catch (error) {
                console.error('❌ Error en auto-refresh de área:', error);
                // Si hay error de autenticación, detener refresh
                if (error.message?.includes('auth') || error.code === 'PGRST301') {
                    clearInterval(window.areaRefreshInterval);
                }
            }
        }
    }, 3 * 60 * 1000);
}

/**
 * Actualizar breadcrumb
 */
function updateBreadcrumb() {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer || !areaState.areaData) return;
    
    breadcrumbContainer.innerHTML = `
        <li class="flex items-center">
            <a href="#/" class="text-gray-600 hover:text-aifa-blue flex items-center transition-colors">
                <i data-lucide="home" class="w-4 h-4 mr-1"></i>
                Inicio
            </a>
        </li>
        <li class="flex items-center">
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-2"></i>
            <span class="text-aifa-blue font-medium flex items-center">
                <i data-lucide="folder" class="w-4 h-4 mr-1"></i>
                ${areaState.areaData.nombre}
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
 * Manejar refresh del área
 */
async function handleRefreshArea() {
    try {
        const refreshBtn = document.getElementById('refresh-area-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await Promise.all([
            loadAreaData(),
            loadIndicadores()
        ]);
        
        // Re-renderizar
        const container = document.getElementById('app-container');
        if (container) {
            await render(container, { id: areaState.areaId });
        }
        
        showToast('Datos del área actualizados', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar área:', error);
        showToast('Error al actualizar los datos', 'error');
    }
}

/**
 * Manejar gestión del área
 */
function handleManageArea() {
    showToast('Funcionalidad de gestión en desarrollo', 'info');
}

/**
 * Manejar agregar indicador
 */
function handleAddIndicator() {
    showToast('Funcionalidad de agregar indicador en desarrollo', 'info');
}

/**
 * Manejar captura rápida
 */
window.handleQuickCapture = async function() {
    if (areaState.indicadores.length === 0) {
        showToast('No hay indicadores en esta área para capturar datos', 'warning');
        return;
    }
    
    showToast('Seleccione un indicador específico para capturar datos', 'info');
};

/**
 * Manejar exportación del área
 */
window.handleExportArea = async function() {
    try {
        const confirmed = await showConfirmModal(
            `¿Desea exportar todos los datos del área "${areaState.areaData.nombre}"?`,
            {
                title: 'Exportar datos del área',
                confirmText: 'Exportar',
                type: 'info'
            }
        );
        
        if (confirmed) {
            showToast('Funcionalidad de exportación en desarrollo', 'info');
        }
        
    } catch (error) {
        console.error('❌ Error al exportar área:', error);
        showToast('Error al exportar los datos', 'error');
    }
};

/**
 * Refresh silencioso de datos
 */
async function refreshDataSilently() {
    try {
        // Verificar sesión antes del refresh
        if (!appState.session || !areaState.areaId) {
            console.warn('⚠️ No hay sesión activa o área cargada para refresh silencioso');
            return;
        }
        
        await Promise.all([
            loadAreaData(),
            loadIndicadores()
        ]);
        
        updateAreaDisplay();
        updateIndicadoresDisplay();
        
    } catch (error) {
        console.error('❌ Error en refresh silencioso de área:', error);
        
        // Si es error de autenticación, limpiar refresh
        if (error.message?.includes('auth') || error.code === 'PGRST301') {
            if (window.areaRefreshInterval) {
                clearInterval(window.areaRefreshInterval);
                window.areaRefreshInterval = null;
            }
        }
    }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Navegar a indicador específico
 */
window.navigateToIndicator = function(indicadorClave, indicadorNombre) {
    if (DEBUG.enabled) console.log(`🧭 Navegando a indicador: ${indicadorNombre} (${indicadorClave})`);
    window.router.navigateTo(`/indicador/${indicadorClave}`);
};

/**
 * Manejar navegación por teclado
 */
window.handleIndicatorKeydown = function(event, indicadorClave, indicadorNombre) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.navigateToIndicator(indicadorClave, indicadorNombre);
    }
};

/**
 * Obtener badges de permisos
 */
function getPermissionBadges() {
    const badges = [];
    
    if (areaState.userPermissions.canDelete) {
        badges.push('<span class="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">Eliminar</span>');
    }
    if (areaState.userPermissions.canEdit) {
        badges.push('<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Editar</span>');
    }
    if (areaState.userPermissions.canCapture) {
        badges.push('<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Capturar</span>');
    }
    if (areaState.userPermissions.canRead && !areaState.userPermissions.canCapture) {
        badges.push('<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">Solo lectura</span>');
    }
    
    return badges.join(' ');
}

/**
 * Obtener última actividad del área
 */
function getUltimaActividad() {
    if (areaState.indicadores.length === 0) return 'Sin actividad';
    
    let ultimaFecha = null;
    
    areaState.indicadores.forEach(indicador => {
        if (indicador.ultimo_anio_con_datos && indicador.ultimo_mes_con_datos) {
            const fecha = new Date(indicador.ultimo_anio_con_datos, indicador.ultimo_mes_con_datos - 1);
            if (!ultimaFecha || fecha > ultimaFecha) {
                ultimaFecha = fecha;
            }
        }
    });
    
    return ultimaFecha ? formatDate(ultimaFecha, 'short') : 'Sin actividad';
}
