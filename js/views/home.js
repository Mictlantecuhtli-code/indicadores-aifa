// =====================================================
// VISTA PRINCIPAL (HOME) - BOTONES DE ÁREAS
// =====================================================

import { DEBUG } from '../config.js';
import { selectData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, formatDate, formatNumber } from '../lib/ui.js';

// Estado de la vista home
const homeState = {
    areas: [],
    resumenDashboard: [],
    userProfile: null,
    loading: false,
    lastRefresh: null
};

// =====================================================
// RENDERIZADO DE LA VISTA
// =====================================================

/**
 * Renderizar vista principal
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('🏠 Renderizando vista home');
        // Obtener perfil del usuario actual
        homeState.userProfile = await getCurrentProfile();
        if (!homeState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Cargar datos necesarios
        await Promise.all([
            loadAreas(),
            loadDashboardSummary()
        ]);
        
        // Renderizar HTML
        container.innerHTML = createHomeHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Actualizar información del usuario en header
        updateUserInfo();
        
        // Configurar auto-refresh
        setupAutoRefresh();
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        homeState.lastRefresh = new Date();
        
        if (DEBUG.enabled) console.log('✅ Vista home renderizada correctamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar home:', error);
        hideLoading();
        
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="home" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar el inicio</h2>
                <p class="text-gray-600 mb-4">No se pudieron cargar las áreas disponibles.</p>
                <div class="space-x-3">
                    <button onclick="location.reload()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Recargar página
                    </button>
                    <button onclick="window.router.navigateTo('/visualizacion')" class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                        Ir a visualización
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
 * Crear HTML de la vista home
 */
function createHomeHTML() {
    const userRole = homeState.userProfile?.rol_principal || 'CAPTURISTA';
    const userName = homeState.userProfile?.nombre_completo || 'Usuario';
    const isHighRole = ['ADMIN', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRole);
    
    return `
        <div class="space-y-8">
            <!-- Header de bienvenida -->
            <div class="bg-gradient-to-r from-aifa-blue to-aifa-light rounded-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold mb-2">¡Bienvenido, ${userName}!</h1>
                        <p class="text-blue-100">
                            Sistema de Gestión de Indicadores - ${getRoleDisplayName(userRole)}
                        </p>
                        ${homeState.lastRefresh ? `
                            <p class="text-blue-200 text-sm mt-2">
                                <i data-lucide="clock" class="w-4 h-4 inline mr-1"></i>
                                Última actualización: ${formatDate(homeState.lastRefresh, 'time')}
                            </p>
                        ` : ''}
                    </div>
                    <div class="text-right">
                        <button 
                            id="refresh-data-btn"
                            class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
                            title="Actualizar datos"
                        >
                            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Resumen estadístico (solo para roles altos) -->
            ${isHighRole ? createDashboardSummaryHTML() : ''}
            
            <!-- Acciones rápidas -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i data-lucide="zap" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                    Acciones rápidas
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                        onclick="window.router.navigateTo('/visualizacion')"
                        class="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                    >
                        <i data-lucide="bar-chart-3" class="w-8 h-8 text-blue-600 mr-3 group-hover:scale-110 transition-transform"></i>
                        <div class="text-left">
                            <h3 class="font-medium text-gray-900">Visualización</h3>
                            <p class="text-sm text-gray-600">Gráficas e indicadores</p>
                        </div>
                    </button>
                    
                    ${canCapture() ? `
                        <button 
                            id="quick-capture-btn"
                            class="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
                        >
                            <i data-lucide="edit" class="w-8 h-8 text-green-600 mr-3 group-hover:scale-110 transition-transform"></i>
                            <div class="text-left">
                                <h3 class="font-medium text-gray-900">Captura rápida</h3>
                                <p class="text-sm text-gray-600">Registrar medición</p>
                            </div>
                        </button>
                    ` : ''}
                    
                    ${['ADMIN'].includes(userRole) ? `
                        <button 
                            onclick="window.router.navigateTo('/admin')"
                            class="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
                        >
                            <i data-lucide="settings" class="w-8 h-8 text-purple-600 mr-3 group-hover:scale-110 transition-transform"></i>
                            <div class="text-left">
                                <h3 class="font-medium text-gray-900">Administración</h3>
                                <p class="text-sm text-gray-600">Gestionar sistema</p>
                            </div>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <!-- Selección de áreas -->
            <div class="bg-white rounded-lg shadow-sm border p-6">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                        <i data-lucide="folder" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                        Áreas organizacionales
                    </h2>
                    <span class="text-sm text-gray-500">
                        ${homeState.areas.length} área${homeState.areas.length !== 1 ? 's' : ''} disponible${homeState.areas.length !== 1 ? 's' : ''}
                    </span>
                </div>
                
                ${createAreasGridHTML()}
            </div>
            
            <!-- Información contextual -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-start space-x-3">
                    <i data-lucide="info" class="w-5 h-5 text-blue-500 mt-0.5"></i>
                    <div class="text-sm text-gray-700">
                        <p class="font-medium mb-1">¿Cómo usar el sistema?</p>
                        <ul class="space-y-1 text-gray-600">
                            <li>• <strong>Seleccione un área</strong> para ver sus indicadores específicos</li>
                            <li>• Use <strong>Visualización</strong> para ver gráficas comparativas entre áreas</li>
                            ${canCapture() ? '<li>• Use <strong>Captura rápida</strong> para registrar mediciones del mes actual</li>' : ''}
                            ${isHighRole ? '<li>• Puede ver y editar datos de todas las áreas del sistema</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML del resumen estadístico
 */
function createDashboardSummaryHTML() {
    if (!homeState.resumenDashboard || homeState.resumenDashboard.length === 0) {
        return '';
    }
    
    const totalAreas = homeState.resumenDashboard.length;
    const totalIndicadores = homeState.resumenDashboard.reduce((sum, area) => sum + (area.total_indicadores || 0), 0);
    const totalMediciones = homeState.resumenDashboard.reduce((sum, area) => sum + (area.total_mediciones || 0), 0);
    const medicionesEsteMes = homeState.resumenDashboard.reduce((sum, area) => sum + (area.mediciones_mes_actual || 0), 0);
    
    return `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i data-lucide="pie-chart" class="w-5 h-5 mr-2 text-aifa-blue"></i>
                Resumen del sistema
            </h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="text-center">
                    <div class="text-3xl font-bold text-aifa-blue mb-1">${totalAreas}</div>
                    <div class="text-sm text-gray-600">Áreas activas</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-green-600 mb-1">${formatNumber(totalIndicadores, 0)}</div>
                    <div class="text-sm text-gray-600">Indicadores</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600 mb-1">${formatNumber(totalMediciones, 0)}</div>
                    <div class="text-sm text-gray-600">Mediciones totales</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-orange-600 mb-1">${formatNumber(medicionesEsteMes, 0)}</div>
                    <div class="text-sm text-gray-600">Este mes</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de la grilla de áreas
 */
function createAreasGridHTML() {
    if (!homeState.areas || homeState.areas.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="folder-x" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No hay áreas disponibles</h3>
                <p class="text-gray-600 mb-4">
                    ${homeState.userProfile?.rol_principal === 'CAPTURISTA' ? 
                        'No tiene áreas asignadas. Contacte a su administrador.' :
                        'No se encontraron áreas en el sistema.'
                    }
                </p>
                ${['ADMIN'].includes(homeState.userProfile?.rol_principal) ? `
                    <button 
                        onclick="window.router.navigateTo('/admin')"
                        class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark"
                    >
                        Configurar áreas
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${homeState.areas.map(area => createAreaCardHTML(area)).join('')}
        </div>
    `;
}

/**
 * Crear HTML de una tarjeta de área
 */
function createAreaCardHTML(area) {
    const summary = homeState.resumenDashboard.find(r => r.area_id === area.id);
    const hasData = summary && summary.total_indicadores > 0;
    const lastActivity = summary?.ultima_actividad ? formatDate(summary.ultima_actividad, 'short') : 'Sin actividad';
    
    return `
        <div class="area-card bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-aifa-blue transition-all duration-200 group"
             onclick="navigateToArea('${area.id}', '${area.nombre}')"
             role="button"
             tabindex="0"
             onkeydown="handleAreaKeydown(event, '${area.id}', '${area.nombre}')"
             aria-label="Ir al área ${area.nombre}">
            
            <!-- Header del área -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                         style="background-color: ${area.color_hex || '#3B82F6'}">
                        ${area.clave.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-900 group-hover:text-aifa-blue transition-colors">
                            ${area.nombre}
                        </h3>
                        <p class="text-sm text-gray-500">${area.clave}</p>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 group-hover:text-aifa-blue group-hover:translate-x-1 transition-all"></i>
            </div>
            
            <!-- Descripción -->
            ${area.descripcion ? `
                <p class="text-sm text-gray-600 mb-4 line-clamp-2">
                    ${area.descripcion}
                </p>
            ` : ''}
            
            <!-- Estadísticas del área -->
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">Indicadores:</span>
                    <span class="font-medium text-gray-900">${summary?.total_indicadores || 0}</span>
                </div>
                
                ${hasData ? `
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Mediciones:</span>
                        <span class="font-medium text-gray-900">${formatNumber(summary.total_mediciones, 0)}</span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Última actividad:</span>
                        <span class="text-xs text-gray-500">${lastActivity}</span>
                    </div>
                ` : `
                    <div class="text-center py-2">
                        <span class="text-xs text-gray-400">Sin mediciones registradas</span>
                    </div>
                `}
            </div>
            
            <!-- Indicador de permisos -->
            <div class="mt-4 pt-3 border-t border-gray-100">
                <div class="flex items-center space-x-2 text-xs">
                    ${getPermissionBadges(area)}
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Cargar áreas disponibles para el usuario
 */
async function loadAreas() {
    try {
        const userRole = homeState.userProfile?.rol_principal;
        
        if (['ADMIN', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRole)) {
            // Roles altos ven todas las áreas
            /*const { data } = await selectData('areas', {
                select: '*',
                filters: { estado: 'ACTIVO' },
                orderBy: { column: 'orden_visualizacion', ascending: true }
            });*/

                const data = [
                {
                    id: 1,
                    clave: 'OPERACIONES',
                    nombre: 'Operaciones Aeroportuarias',
                    descripcion: 'Indicadores de operaciones del aeropuerto',
                    color_hex: '#3B82F6',
                    estado: 'ACTIVA'
                },
                {
                    id: 2,
                    clave: 'SEGURIDAD',
                    nombre: 'Seguridad y Protección',
                    descripcion: 'Indicadores de seguridad aeroportuaria',
                    color_hex: '#EF4444',
                    estado: 'ACTIVA'
                }
            ];
            homeState.areas = data || [];
        } else {
            // Capturistas y jefes de área ven solo sus áreas asignadas
            const { data } = await selectData('v_areas_usuario', {
                select: '*',
                filters: { usuario_id: homeState.userProfile.id },
                orderBy: { column: 'orden_visualizacion', ascending: true }
            });
            homeState.areas = data || [];
        }
        
        if (DEBUG.enabled) {
            console.log(`📁 Cargadas ${homeState.areas.length} áreas para rol ${userRole}`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar áreas:', error);
        homeState.areas = [];
        showToast('Error al cargar las áreas', 'error');
    }
}

/**
 * Cargar resumen del dashboard
 */
async function loadDashboardSummary() {
    try {
        const { data } = await selectData('v_dashboard_resumen', {
            select: '*',
            orderBy: { column: 'area_nombre', ascending: true }
        });
        
        homeState.resumenDashboard = data || [];
        
        if (DEBUG.enabled) {
            console.log(`📊 Cargado resumen de ${homeState.resumenDashboard.length} áreas`);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar resumen del dashboard:', error);
        homeState.resumenDashboard = [];
        // No mostrar error al usuario para esto, es información adicional
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
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshData);
    }
    
    // Botón de captura rápida
    const quickCaptureBtn = document.getElementById('quick-capture-btn');
    if (quickCaptureBtn) {
        quickCaptureBtn.addEventListener('click', handleQuickCapture);
    }
}

/**
 * Configurar auto-refresh de datos
 */
function setupAutoRefresh() {
    // Refresh automático cada 5 minutos
    setInterval(async () => {
        if (document.visibilityState === 'visible') {
            await refreshDataSilently();
        }
    }, 5 * 60 * 1000);
}

// =====================================================
// HANDLERS DE EVENTOS
// =====================================================

/**
 * Manejar refresh de datos
 */
async function handleRefreshData() {
    try {
        const refreshBtn = document.getElementById('refresh-data-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await Promise.all([
            loadAreas(),
            loadDashboardSummary()
        ]);
        
        // Re-renderizar solo el contenido dinámico
        /*const container = document.getElementById('app-container');
        if (container) {
            await render(container);
        }*/
        updateAreasDisplay();
        updateDashboardSummary();
        showToast('Datos actualizados correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar datos:', error);
        showToast('Error al actualizar los datos', 'error');
    }
}

/**
 * Manejar captura rápida
 */
function handleQuickCapture() {
    // Por ahora redirigir a la selección de áreas para captura
    // En una implementación futura podría abrir un modal de captura rápida
    showToast('Seleccione un área para realizar la captura', 'info');
}

/**
 * Refresh silencioso de datos
 */
async function refreshDataSilently() {
    try {
        await Promise.all([
            loadAreas(),
            loadDashboardSummary()
        ]);
        homeState.lastRefresh = new Date();
    } catch (error) {
        if (DEBUG.enabled) console.warn('⚠️ Error en refresh silencioso:', error);
    }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Navegar a área específica
 */
window.navigateToArea = function(areaId, areaNombre) {
    if (DEBUG.enabled) console.log(`🧭 Navegando a área: ${areaNombre} (${areaId})`);
    window.router.navigateTo(`/area/${areaId}`);
};

/**
 * Manejar navegación por teclado
 */
window.handleAreaKeydown = function(event, areaId, areaNombre) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.navigateToArea(areaId, areaNombre);
    }
};

/**
 * Verificar si el usuario puede capturar datos
 */
function canCapture() {
    const userRole = homeState.userProfile?.rol_principal;
    return ['CAPTURISTA', 'JEFE_AREA', 'SUBDIRECTOR', 'DIRECTOR', 'ADMIN'].includes(userRole);
}

/**
 * Obtener nombre de display del rol
 */
function getRoleDisplayName(role) {
    const roleNames = {
        'CAPTURISTA': 'Capturista',
        'JEFE_AREA': 'Jefe de Área',
        'SUBDIRECTOR': 'Subdirector',
        'DIRECTOR': 'Director',
        'ADMIN': 'Administrador'
    };
    return roleNames[role] || role;
}

/**
 * Obtener badges de permisos para el área
 */
function getPermissionBadges(area) {
    const userRole = homeState.userProfile?.rol_principal;
    const badges = [];
    
    if (['ADMIN', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRole)) {
        badges.push('<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full">Acceso completo</span>');
    } else {
        // Para capturistas y jefes de área, verificar permisos específicos
        const userArea = homeState.userProfile?.usuario_areas?.find(ua => ua.area_id === area.id);
        if (userArea) {
            if (userArea.puede_editar) {
                badges.push('<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Edición</span>');
            } else if (userArea.puede_capturar) {
                badges.push('<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Solo captura</span>');
            } else {
                badges.push('<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded-full">Solo lectura</span>');
            }
        }
    }
    
    return badges.join(' ');
}

/**
 * Actualizar información del usuario en el header
 */
function updateUserInfo() {
    const userNameElement = document.getElementById('user-name');
    const userRoleElement = document.getElementById('user-role');
    
    if (userNameElement && homeState.userProfile) {
        userNameElement.textContent = homeState.userProfile.nombre_completo || 'Usuario';
    }
    
    if (userRoleElement && homeState.userProfile) {
        userRoleElement.textContent = getRoleDisplayName(homeState.userProfile.rol_principal);
    }
    
    // Mostrar/ocultar botón de administración según el rol
    const adminNavBtn = document.getElementById('nav-admin');
    if (adminNavBtn) {
        if (['ADMIN'].includes(homeState.userProfile?.rol_principal)) {
            adminNavBtn.classList.remove('hidden');
        } else {
            adminNavBtn.classList.add('hidden');
        }
    }
}
