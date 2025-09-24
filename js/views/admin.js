// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE SISTEMA
// Estado, renderizado y CRUD de áreas
// =====================================================

import { DEBUG, ROLES, VALIDATION } from '../config.js';
import { selectData, insertData, updateData, deleteData, appState, getCurrentProfile } from '../lib/supa.js';
import { showToast, showLoading, hideLoading, showModal, showConfirmModal, validateForm, getFormData, createTable } from '../lib/ui.js';

// Estado del panel de administración
const adminState = {
    userProfile: null,
    currentSection: 'areas', // 'areas', 'users', 'permissions'
    areas: [],
    usuarios: [],
    permisos: [],
    searchTerm: '',
    editingItem: null,
    loading: false
};

// =====================================================
// RENDERIZADO DE LA VISTA PRINCIPAL
// =====================================================

/**
 * Renderizar panel de administración
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('⚙️ Renderizando panel de administración');
        // Obtener perfil del usuario
        adminState.userProfile = await getCurrentProfile();
        if (!adminState.userProfile) {
            throw new Error('No se pudo obtener el perfil del usuario');
        }
        
        // Verificar permisos de administrador
        if (adminState.userProfile.rol_principal !== 'ADMIN') {
            throw new Error('No tiene permisos para acceder al panel de administración');
        }
        
        // Procesar sección desde query
        if (query.section && ['areas', 'users', 'permissions'].includes(query.section)) {
            adminState.currentSection = query.section;
        }
        
        // Cargar datos iniciales
        await loadInitialData();
        
        // Renderizar HTML
        container.innerHTML = createAdminHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar contenido de la sección actual
        await loadSectionContent();
        
        hideLoading();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        if (DEBUG.enabled) console.log('✅ Panel de administración renderizado correctamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar panel de administración:', error);
        hideLoading();
        
        let errorMessage = 'Error al cargar el panel de administración';
        
        if (error.message.includes('permisos')) {
            errorMessage = 'No tiene permisos para acceder al panel de administración';
        }
        
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="shield-x" class="w-16 h-16 text-red-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">${errorMessage}</h2>
                <p class="text-gray-600 mb-6">
                    ${error.message.includes('permisos') ? 
                        'Solo los administradores pueden acceder a esta sección.' :
                        'Ha ocurrido un error al cargar el panel de administración.'
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
 * Crear HTML principal del panel de administración
 */
function createAdminHTML() {
    return `
        <div class="space-y-6">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold mb-2">Panel de Administración</h1>
                        <p class="text-purple-100">
                            Gestión del sistema AIFA - ${adminState.userProfile.nombre_completo}
                        </p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="bg-white bg-opacity-20 rounded-lg px-4 py-2">
                            <div class="text-sm font-medium">Rol: Administrador</div>
                            <div class="text-xs text-purple-200">Acceso completo</div>
                        </div>
                        <button 
                            id="admin-help-btn"
                            class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors"
                            title="Ayuda"
                        >
                            <i data-lucide="help-circle" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Navegación de secciones -->
            <div class="bg-white rounded-lg shadow-sm border">
                <div class="border-b border-gray-200">
                    <nav class="flex space-x-8 px-6" aria-label="Secciones">
                        <button 
                            id="section-areas"
                            class="section-tab py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                            onclick="switchSection('areas')"
                        >
                            <i data-lucide="folder" class="w-4 h-4 inline mr-2"></i>
                            Gestión de Áreas
                        </button>
                        <button 
                            id="section-users"
                            class="section-tab py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                            onclick="switchSection('users')"
                        >
                            <i data-lucide="users" class="w-4 h-4 inline mr-2"></i>
                            Gestión de Usuarios
                        </button>
                        <button 
                            id="section-permissions"
                            class="section-tab py-4 px-2 border-b-2 font-medium text-sm transition-colors"
                            onclick="switchSection('permissions')"
                        >
                            <i data-lucide="shield" class="w-4 h-4 inline mr-2"></i>
                            Permisos y Asignaciones
                        </button>
                    </nav>
                </div>
                
                <!-- Contenido de la sección -->
                <div class="p-6">
                    <div id="section-content">
                        <!-- El contenido se carga dinámicamente -->
                    </div>
                </div>
            </div>
            
            <!-- Información del sistema -->
            ${createSystemInfoHTML()}
        </div>
    `;
}

/**
 * Crear HTML de información del sistema
 */
function createSystemInfoHTML() {
    return `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i data-lucide="info" class="w-5 h-5 mr-2 text-purple-600"></i>
                Información del sistema
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600 mb-1" id="total-areas-count">
                        ${adminState.areas.length}
                    </div>
                    <div class="text-sm text-gray-600">Áreas totales</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600 mb-1" id="total-users-count">
                        ${adminState.usuarios.length}
                    </div>
                    <div class="text-sm text-gray-600">Usuarios registrados</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600 mb-1" id="total-permissions-count">
                        ${adminState.permisos.length}
                    </div>
                    <div class="text-sm text-gray-600">Asignaciones activas</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-orange-600 mb-1">
                        ${Object.keys(ROLES).length}
                    </div>
                    <div class="text-sm text-gray-600">Roles del sistema</div>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// GESTIÓN DE ÁREAS
// =====================================================

/**
 * Crear contenido de la sección de áreas
 */
function createAreasContentHTML() {
    return `
        <div class="space-y-6">
            <!-- Header de áreas -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Gestión de Áreas</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        Administre las áreas organizacionales del sistema
                    </p>
                </div>
                
                <button 
                    id="add-area-btn"
                    class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                >
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>Nueva área</span>
                </button>
            </div>
            
            <!-- Búsqueda y filtros -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div class="flex items-center space-x-4">
                        <div class="relative">
                            <input 
                                type="text" 
                                id="areas-search"
                                placeholder="Buscar áreas por nombre o clave..."
                                class="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                            <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
                        </div>
                        
                        <select 
                            id="areas-status-filter"
                            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="ACTIVO">Solo activas</option>
                            <option value="INACTIVO">Solo inactivas</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-600">
                            ${adminState.areas.length} área${adminState.areas.length !== 1 ? 's' : ''} total${adminState.areas.length !== 1 ? 'es' : ''}
                        </span>
                        <button 
                            id="refresh-areas-btn"
                            class="bg-white border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50"
                            title="Actualizar lista"
                        >
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de áreas -->
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div id="areas-table-container">
                    ${createAreasTableHTML()}
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear tabla de áreas
 */
function createAreasTableHTML() {
    if (adminState.areas.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="folder-plus" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No hay áreas configuradas</h3>
                <p class="text-gray-600 mb-4">Comience creando la primera área del sistema.</p>
                <button 
                    onclick="showAddAreaModal()"
                    class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                    Crear primera área
                </button>
            </div>
        `;
    }
    
    const filteredAreas = getFilteredAreas();
    
    return `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Área
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Clave
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Indicadores
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuarios asignados
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha creación
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${filteredAreas.map((area, index) => createAreaRowHTML(area, index)).join('')}
                </tbody>
            </table>
        </div>
        
        ${filteredAreas.length === 0 && adminState.areas.length > 0 ? `
            <div class="text-center py-8">
                <i data-lucide="search-x" class="w-8 h-8 text-gray-300 mx-auto mb-2"></i>
                <p class="text-gray-500">No se encontraron áreas que coincidan con los filtros</p>
            </div>
        ` : ''}
    `;
}

/**
 * Crear fila de área en la tabla
 */
function createAreaRowHTML(area, index) {
    const indicadoresCount = area.total_indicadores || 0;
    const usuariosCount = area.usuarios_asignados || 0;
    
    return `
        <tr class="hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mr-3"
                         style="background-color: ${area.color_hex || '#6B7280'}">
                        ${area.clave.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${area.nombre}</div>
                        ${area.descripcion ? `
                            <div class="text-sm text-gray-500 max-w-xs truncate">${area.descripcion}</div>
                        ` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-mono text-gray-900">${area.clave}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    area.estado === 'ACTIVO' ? 
                    'bg-green-100 text-green-800' : 
                    'bg-red-100 text-red-800'
                }">
                    ${area.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${indicadoresCount} indicador${indicadoresCount !== 1 ? 'es' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${usuariosCount} usuario${usuariosCount !== 1 ? 's' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(area.fecha_creacion).toLocaleDateString('es-MX')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-2">
                    <button 
                        onclick="viewAreaDetails('${area.id}')"
                        class="text-purple-600 hover:text-purple-900 transition-colors"
                        title="Ver detalles"
                    >
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="editArea('${area.id}')"
                        class="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar área"
                    >
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="toggleAreaStatus('${area.id}', '${area.estado}')"
                        class="text-yellow-600 hover:text-yellow-900 transition-colors"
                        title="${area.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'} área"
                    >
                        <i data-lucide="${area.estado === 'ACTIVO' ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="deleteArea('${area.id}', '${area.nombre}')"
                        class="text-red-600 hover:text-red-900 transition-colors"
                        title="Eliminar área"
                    >
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Cargar datos iniciales del panel
 */
async function loadInitialData() {
    try {
        await Promise.all([
            loadAreas(),
            loadUsuarios(),
            loadPermisos()
        ]);
        
        if (DEBUG.enabled) {
            console.log('📊 Datos del panel cargados:', {
                areas: adminState.areas.length,
                usuarios: adminState.usuarios.length,
                permisos: adminState.permisos.length
            });
        }
        
    } catch (error) {
        console.error('❌ Error al cargar datos iniciales:', error);
        showToast('Error al cargar los datos del panel', 'error');
    }
}

/**
 * Cargar todas las áreas
 */
async function loadAreas() {
    try {
        // Cargar áreas con estadísticas adicionales
        const { data } = await selectData('areas', {
             select: '*',
            orderBy: { column: 'fecha_creacion', ascending: false }
        });
        
        adminState.areas = data || [];
        
    } catch (error) {
        console.error('❌ Error al cargar áreas:', error);
        adminState.areas = [];
    }
}

/**
 * Cargar todos los usuarios
 */
async function loadUsuarios() {
    try {
        adminState.loading = true;
        
        const { data } = await selectData('perfiles', {
            select: `
                id, email, nombre_completo, rol_principal, telefono, puesto,
                estado, ultimo_acceso, fecha_creacion, fecha_actualizacion
            `,
            orderBy: { column: 'fecha_creacion', ascending: false }
        });
        
        adminState.usuarios = data || [];
        adminState.loading = false;
        
        if (DEBUG.enabled) {
            console.log('✅ Usuarios cargados:', adminState.usuarios.length);
        }
        
    } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
        adminState.usuarios = [];
        adminState.loading = false;
    }
}

/**
 * Cargar todos los permisos/asignaciones
 */
async function loadPermisos() {
    try {
        const { data } = await selectData('usuario_areas', {
            select: `
                *,
                perfiles!usuario_id (
                    nombre_completo,
                    email,
                    rol_principal
                ),
                areas!area_id (
                    nombre,
                    clave,
                    color_hex
                )
            `,
            filters: { estado: 'ACTIVO' },
            orderBy: { column: 'fecha_asignacion', ascending: false }
        });
        
        adminState.permisos = data || [];
        
    } catch (error) {
        console.error('❌ Error al cargar permisos:', error);
        adminState.permisos = [];
    }
}

/**
 * Obtener áreas filtradas
 */
function getFilteredAreas() {
    let filtered = adminState.areas;
    
    // Filtrar por término de búsqueda
    if (adminState.searchTerm) {
        const term = adminState.searchTerm.toLowerCase();
        filtered = filtered.filter(area => 
            area.nombre.toLowerCase().includes(term) ||
            area.clave.toLowerCase().includes(term) ||
            (area.descripcion && area.descripcion.toLowerCase().includes(term))
        );
    }
    
    // Filtrar por estado
    const statusFilter = document.getElementById('areas-status-filter')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(area => area.estado === statusFilter);
    }
    
    return filtered;
}
// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE SISTEMA
// Gestión de usuarios
// =====================================================

// =====================================================
// GESTIÓN DE USUARIOS
// =====================================================

/**
 * Crear contenido de la sección de usuarios
 */
function createUsersContentHTML() {
    return `
        <div class="space-y-6">
            <!-- Header de usuarios -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Gestión de Usuarios</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        Administre los usuarios del sistema, sus roles principales y asignaciones de área
                    </p>
                </div>
                
                <div class="flex items-center space-x-3">
                    <button 
                        id="create-user-btn"
                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        <span>Crear Usuario</span>
                    </button>
                    
                    <button 
                        id="bulk-actions-btn"
                        class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        <span>Acciones masivas</span>
                    </button>
                    
                    <button 
                        id="refresh-users-btn"
                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                        title="Actualizar usuarios"
                    >
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        <span class="hidden sm:inline">Actualizar</span>
                    </button>
                </div>
            </div>
            
            <!-- Búsqueda y filtros de usuarios -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <!-- Búsqueda -->
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i data-lucide="search" class="w-4 h-4 text-gray-400"></i>
                            </div>
                            <input
                                type="text"
                                id="users-search"
                                placeholder="Buscar usuarios..."
                                class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent w-full sm:w-64"
                            >
                        </div>
                        
                        <!-- Filtro por rol -->
                        <select
                            id="users-role-filter"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        >
                            <option value="all">Todos los roles</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="DIRECTOR">Director</option>
                            <option value="SUBDIRECTOR">Subdirector</option>
                            <option value="JEFE_AREA">Jefe de Área</option>
                            <option value="CAPTURISTA">Capturista</option>
                        </select>
                        
                        <!-- Filtro por estado -->
                        <select
                            id="users-status-filter"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="ACTIVO">Activos</option>
                            <option value="INACTIVO">Inactivos</option>
                        </select>
                    </div>
                    
                    <!-- Acciones rápidas -->
                    <div class="flex items-center space-x-3">
                        <button
                            onclick="showQuickAssignModal()"
                            class="text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                        >
                            <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            <span>Asignación Rápida</span>
                        </button>
                        
                        <button
                            onclick="exportUsersData()"
                            class="text-sm bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Exportar</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Estadísticas rápidas -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                                <i data-lucide="users" class="w-5 h-5 text-blue-600"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">Total Usuarios</p>
                            <p class="text-2xl font-semibold text-gray-900" id="total-users-stat">
                                ${adminState.usuarios.length}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                                <i data-lucide="user-check" class="w-5 h-5 text-green-600"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">Activos</p>
                            <p class="text-2xl font-semibold text-gray-900" id="active-users-stat">
                                ${adminState.usuarios.filter(u => u.estado === 'ACTIVO').length}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                                <i data-lucide="shield" class="w-5 h-5 text-purple-600"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">Administradores</p>
                            <p class="text-2xl font-semibold text-gray-900" id="admin-users-stat">
                                ${adminState.usuarios.filter(u => u.rol_principal === 'ADMIN').length}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                                <i data-lucide="folder-open" class="w-5 h-5 text-orange-600"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">Con Áreas</p>
                            <p class="text-2xl font-semibold text-gray-900" id="assigned-users-stat">
                                ${new Set(adminState.permisos.filter(p => p.estado === 'ACTIVO').map(p => p.usuario_id)).size}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de usuarios -->
            <div class="bg-white rounded-lg border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <h4 class="text-lg font-medium text-gray-900">
                            Lista de Usuarios
                        </h4>
                        <div class="flex items-center space-x-2 text-sm text-gray-500">
                            <span>Última actualización:</span>
                            <span id="users-last-update">
                                ${new Date().toLocaleString('es-MX', { 
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div id="users-table-container">
                    <!-- La tabla se renderizará aquí dinámicamente -->
                    <div class="flex items-center justify-center py-12">
                        <div class="text-center">
                            <i data-lucide="loader-2" class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4"></i>
                            <p class="text-gray-500">Cargando usuarios...</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Panel de ayuda contextual -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <i data-lucide="info" class="w-5 h-5 text-blue-600 mt-0.5"></i>
                    </div>
                    <div class="min-w-0 flex-1 text-sm text-blue-800">
                        <h4 class="font-medium mb-1">Gestión de Usuarios</h4>
                        <div class="space-y-1 text-xs">
                            <p>• <strong>Crear Usuario:</strong> Agregue nuevos usuarios al sistema con roles específicos</p>
                            <p>• <strong>Asignación Rápida:</strong> Vincule usuarios existentes a áreas con permisos personalizados</p>
                            <p>• <strong>Acciones Masivas:</strong> Seleccione múltiples usuarios para cambios simultáneos</p>
                            <p>• <strong>Auditoría:</strong> Todos los cambios se registran automáticamente para trazabilidad</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;    
}

/**
 * Crear tabla de usuarios
 */
function createUsersTableHTML() {
    if (adminState.usuarios.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="users" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No hay usuarios registrados</h3>
                <p class="text-gray-600 mb-4">Los usuarios se registran automáticamente al usar el sistema.</p>
            </div>
        `;
    }
    
    const filteredUsers = getFilteredUsers();
    
    return `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input type="checkbox" id="select-all-users" class="rounded border-gray-300">
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol Principal
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Áreas Asignadas
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Último Acceso
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${filteredUsers.map((usuario, index) => createUserRowHTML(usuario, index)).join('')}
                </tbody>
            </table>
        </div>
        
        ${filteredUsers.length === 0 && adminState.usuarios.length > 0 ? `
            <div class="text-center py-8">
                <i data-lucide="search-x" class="w-8 h-8 text-gray-300 mx-auto mb-2"></i>
                <p class="text-gray-500">No se encontraron usuarios que coincidan con los filtros</p>
            </div>
        ` : ''}
    `;
}

/**
 * Crear fila de usuario en la tabla
 */
function createUserRowHTML(usuario, index) {
    const roleInfo = ROLES[usuario.rol_principal] || { name: usuario.rol_principal, level: 0 };
    const lastAccess = usuario.ultimo_acceso ? 
        new Date(usuario.ultimo_acceso).toLocaleDateString('es-MX') : 
        'Nunca';
    
    return `
        <tr class="hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="user-checkbox rounded border-gray-300" value="${usuario.id}">
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                        <span class="text-sm font-medium text-purple-600">
                            ${(usuario.nombre_completo || usuario.email).substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">
                            ${usuario.nombre_completo || 'Sin nombre'}
                        </div>
                        ${usuario.puesto ? `
                            <div class="text-sm text-gray-500">${usuario.puesto}</div>
                        ` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${usuario.email}</div>
                ${usuario.telefono ? `
                    <div class="text-sm text-gray-500">${usuario.telefono}</div>
                ` : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColorClass(usuario.rol_principal)}">
                    ${roleInfo.name}
                </span>
                <div class="text-xs text-gray-500 mt-1">Nivel ${roleInfo.level}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${usuario.areas_asignadas || 0} área${(usuario.areas_asignadas || 0) !== 1 ? 's' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    usuario.estado === 'ACTIVO' ? 
                    'bg-green-100 text-green-800' : 
                    'bg-red-100 text-red-800'
                }">
                    ${usuario.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${lastAccess}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-2">
                    <button 
                        onclick="viewUserDetails('${usuario.id}')"
                        class="text-purple-600 hover:text-purple-900 transition-colors"
                        title="Ver detalles"
                    >
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="editUser('${usuario.id}')"
                        class="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar usuario"
                    >
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="manageUserPermissions('${usuario.id}')"
                        class="text-green-600 hover:text-green-900 transition-colors"
                        title="Gestionar permisos"
                    >
                        <i data-lucide="shield" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="toggleUserStatus('${usuario.id}', '${usuario.estado}')"
                        class="text-yellow-600 hover:text-yellow-900 transition-colors"
                        title="${usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'} usuario"
                    >
                        <i data-lucide="${usuario.estado === 'ACTIVO' ? 'user-x' : 'user-check'}" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Obtener usuarios filtrados
 */
function getFilteredUsers() {
    let filtered = adminState.usuarios;
    
    // Filtrar por término de búsqueda
    const searchTerm = document.getElementById('users-search')?.value?.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(user => 
            (user.nombre_completo && user.nombre_completo.toLowerCase().includes(searchTerm)) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.puesto && user.puesto.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filtrar por rol
    const roleFilter = document.getElementById('users-role-filter')?.value;
    if (roleFilter && roleFilter !== 'all') {
        filtered = filtered.filter(user => user.rol_principal === roleFilter);
    }
    
    // Filtrar por estado
    const statusFilter = document.getElementById('users-status-filter')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(user => user.estado === statusFilter);
    }
    
    return filtered;
}

/**
 * Obtener clase de color para rol
 */
function getRoleColorClass(role) {
    const colorMap = {
        'ADMIN': 'bg-red-100 text-red-800',
        'DIRECTOR': 'bg-purple-100 text-purple-800',
        'SUBDIRECTOR': 'bg-blue-100 text-blue-800',
        'JEFE_AREA': 'bg-green-100 text-green-800',
        'CAPTURISTA': 'bg-gray-100 text-gray-800'
    };
    
    return colorMap[role] || 'bg-gray-100 text-gray-800';
}
// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE SISTEMA
// Gestión de permisos y asignaciones
// =====================================================

// =====================================================
// GESTIÓN DE PERMISOS Y ASIGNACIONES
// =====================================================

/**
 * Crear contenido de la sección de permisos
 */
function createPermissionsContentHTML() {
    return `
        <div class="space-y-6">
            <!-- Header de permisos -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Permisos y Asignaciones</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        Gestione las asignaciones de usuarios a áreas y sus permisos específicos
                    </p>
                </div>
                
                <button 
                    id="add-permission-btn"
                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>Nueva asignación</span>
                </button>
            </div>
            
            <!-- Búsqueda de usuario para asignación rápida -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="text-md font-semibold text-blue-900 mb-3">Asignación rápida de permisos</h4>
                <div class="flex flex-col sm:flex-row items-start sm:items-end space-y-3 sm:space-y-0 sm:space-x-4">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-blue-800 mb-1">
                            Buscar usuario por email
                        </label>
                        <div class="relative">
                            <input 
                                type="email" 
                                id="quick-assign-email"
                                placeholder="usuario@aifa.aero"
                                class="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                            <i data-lucide="mail" class="absolute left-3 top-2.5 w-4 h-4 text-blue-400"></i>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-blue-800 mb-1">
                            Área
                        </label>
                        <select 
                            id="quick-assign-area"
                            class="border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Seleccionar área</option>
                            ${adminState.areas.filter(a => a.estado === 'ACTIVO').map(area => `
                                <option value="${area.id}">${area.nombre}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-blue-800 mb-1">
                            Rol
                        </label>
                        <select 
                            id="quick-assign-role"
                            class="border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Seleccionar rol</option>
                            ${Object.entries(ROLES).map(([key, role]) => `
                                <option value="${key}">${role.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <button 
                        id="quick-assign-btn"
                        class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        <span>Asignar</span>
                    </button>
                </div>
            </div>
            
            <!-- Filtros de permisos -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <div class="relative">
                            <input 
                                type="text" 
                                id="permissions-search"
                                placeholder="Buscar por usuario o área..."
                                class="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                            <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
                        </div>
                        
                        <select 
                            id="permissions-area-filter"
                            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Todas las áreas</option>
                            ${adminState.areas.map(area => `
                                <option value="${area.id}">${area.nombre}</option>
                            `).join('')}
                        </select>
                        
                        <select 
                            id="permissions-role-filter"
                            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Todos los roles</option>
                            ${Object.entries(ROLES).map(([key, role]) => `
                                <option value="${key}">${role.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-600">
                            ${adminState.permisos.length} asignación${adminState.permisos.length !== 1 ? 'es' : ''} activa${adminState.permisos.length !== 1 ? 's' : ''}
                        </span>
                        <button 
                            id="refresh-permissions-btn"
                            class="bg-white border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50"
                            title="Actualizar lista"
                        >
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de permisos -->
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div id="permissions-table-container">
                    ${createPermissionsTableHTML()}
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear tabla de permisos
 */
function createPermissionsTableHTML() {
    if (adminState.permisos.length === 0) {
        return `
            <div class="text-center py-12">
                <i data-lucide="shield-off" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No hay asignaciones configuradas</h3>
                <p class="text-gray-600 mb-4">Comience asignando usuarios a áreas específicas.</p>
                <button 
                    onclick="showAddPermissionModal()"
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                >
                    Crear primera asignación
                </button>
            </div>
        `;
    }
    
    const filteredPermissions = getFilteredPermissions();
    
    return `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Área asignada
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol en área
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permisos específicos
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Asignado por
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha asignación
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${filteredPermissions.map((permiso, index) => createPermissionRowHTML(permiso, index)).join('')}
                </tbody>
            </table>
        </div>
        
        ${filteredPermissions.length === 0 && adminState.permisos.length > 0 ? `
            <div class="text-center py-8">
                <i data-lucide="search-x" class="w-8 h-8 text-gray-300 mx-auto mb-2"></i>
                <p class="text-gray-500">No se encontraron asignaciones que coincidan con los filtros</p>
            </div>
        ` : ''}
    `;
}

/**
 * Crear fila de permiso en la tabla
 */
function createPermissionRowHTML(permiso, index) {
    const usuario = permiso.perfiles;
    const area = permiso.areas;
    const roleInfo = ROLES[permiso.rol] || { name: permiso.rol };
    
    const permisosBadges = [];
    if (permiso.puede_capturar) permisosBadges.push('<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Capturar</span>');
    if (permiso.puede_editar) permisosBadges.push('<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Editar</span>');
    if (permiso.puede_eliminar) permisosBadges.push('<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Eliminar</span>');
    
    return `
        <tr class="hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                        <span class="text-xs font-medium text-purple-600">
                            ${(usuario?.nombre_completo || usuario?.email || 'U').substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">
                            ${usuario?.nombre_completo || 'Usuario eliminado'}
                        </div>
                        <div class="text-sm text-gray-500">${usuario?.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded flex items-center justify-center mr-2"
                         style="background-color: ${area?.color_hex || '#6B7280'}">
                        <span class="text-xs font-bold text-white">
                            ${(area?.clave || 'A').substring(0, 1)}
                        </span>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${area?.nombre || 'Área eliminada'}</div>
                        <div class="text-sm text-gray-500">${area?.clave || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColorClass(permiso.rol)}">
                    ${roleInfo.name}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1">
                    ${permisosBadges.join(' ')}
                    ${permisosBadges.length === 0 ? '<span class="text-sm text-gray-400">Sin permisos específicos</span>' : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${permiso.asignado_por ? 'Admin' : 'Sistema'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(permiso.fecha_asignacion).toLocaleDateString('es-MX')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-2">
                    <button 
                        onclick="editPermission('${permiso.id}')"
                        class="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar asignación"
                    >
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button 
                        onclick="deletePermission('${permiso.id}', '${usuario?.nombre_completo}', '${area?.nombre}')"
                        class="text-red-600 hover:text-red-900 transition-colors"
                        title="Eliminar asignación"
                    >
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Obtener permisos filtrados
 */
function getFilteredPermissions() {
    let filtered = adminState.permisos;
    
    // Filtrar por término de búsqueda
    const searchTerm = document.getElementById('permissions-search')?.value?.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(permiso => 
            (permiso.perfiles?.nombre_completo && permiso.perfiles.nombre_completo.toLowerCase().includes(searchTerm)) ||
            (permiso.perfiles?.email && permiso.perfiles.email.toLowerCase().includes(searchTerm)) ||
            (permiso.areas?.nombre && permiso.areas.nombre.toLowerCase().includes(searchTerm)) ||
            (permiso.areas?.clave && permiso.areas.clave.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filtrar por área
    const areaFilter = document.getElementById('permissions-area-filter')?.value;
    if (areaFilter && areaFilter !== 'all') {
        filtered = filtered.filter(permiso => permiso.area_id === areaFilter);
    }
    
    // Filtrar por rol
    const roleFilter = document.getElementById('permissions-role-filter')?.value;
    if (roleFilter && roleFilter !== 'all') {
        filtered = filtered.filter(permiso => permiso.rol === roleFilter);
    }
    
    return filtered;
}

// =====================================================
// NAVEGACIÓN DE SECCIONES
// =====================================================

/**
 * Cambiar sección activa
 */
window.switchSection = async function(sectionName) {
    adminState.currentSection = sectionName;
    
    try {
        showLoading('Cargando sección...');
        
        // Actualizar clases de pestañas
        document.querySelectorAll('.section-tab').forEach(tab => {
            tab.classList.remove('border-purple-500', 'text-purple-600');
            tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
        
        const activeTab = document.getElementById(`section-${sectionName}`);
        if (activeTab) {
            activeTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            activeTab.classList.add('border-purple-500', 'text-purple-600');
        }
        
        // Cargar contenido de la sección
        await loadSectionContent();
        
        hideLoading();
        
    } catch (error) {
        console.error(`❌ Error al cambiar a sección ${sectionName}:`, error);
        hideLoading();
        showToast('Error al cargar la sección', 'error');
    }
};

/**
 * Cargar contenido de la sección actual
 */
async function loadSectionContent() {
    const sectionContent = document.getElementById('section-content');
    if (!sectionContent) return;
    
    switch (adminState.currentSection) {
        case 'areas':
            sectionContent.innerHTML = createAreasContentHTML();
            setupAreasEventListeners();
            break;
        case 'users':
            sectionContent.innerHTML = createUsersContentHTML();
            // setupUsersEventListeners(); <- ELIMINAR ESTA LÍNEA
            updateUsersTable();        // <- AGREGAR ESTA LÍNEA
            updateUserStats();         // <- AGREGAR ESTA LÍNEA
            break;
        case 'permissions':
            sectionContent.innerHTML = createPermissionsContentHTML();
            setupPermissionsEventListeners();
            break;
    }
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Configurar event listeners de áreas
 */
function setupAreasEventListeners() {
    // Búsqueda de áreas
    const areasSearch = document.getElementById('areas-search');
    if (areasSearch) {
        areasSearch.addEventListener('input', (e) => {
            adminState.searchTerm = e.target.value;
            updateAreasTable();
        });
    }
    
    // Filtro de estado de áreas
    const areasStatusFilter = document.getElementById('areas-status-filter');
    if (areasStatusFilter) {
        areasStatusFilter.addEventListener('change', updateAreasTable);
    }
    
    // Botón agregar área
    const addAreaBtn = document.getElementById('add-area-btn');
    if (addAreaBtn) {
        addAreaBtn.addEventListener('click', showAddAreaModal);
    }
    
    // Botón refresh áreas
    const refreshAreasBtn = document.getElementById('refresh-areas-btn');
    if (refreshAreasBtn) {
        refreshAreasBtn.addEventListener('click', handleRefreshAreas);
    }
}

/**
 * Configurar event listeners de usuarios
 */
function setupUsersEventListeners() {
    // Búsqueda de usuarios
    const usersSearch = document.getElementById('users-search');
    if (usersSearch) {
        usersSearch.addEventListener('input', updateUsersTable);
    }
    
    // Filtros de usuarios
    const usersRoleFilter = document.getElementById('users-role-filter');
    const usersStatusFilter = document.getElementById('users-status-filter');
    
    if (usersRoleFilter) {
        usersRoleFilter.addEventListener('change', updateUsersTable);
    }
    
    if (usersStatusFilter) {
        usersStatusFilter.addEventListener('change', updateUsersTable);
    }
    
    // Botón invitar usuario
    const inviteUserBtn = document.getElementById('invite-user-btn');
    if (inviteUserBtn) {
        inviteUserBtn.addEventListener('click', showInviteUserModal);
    }
    
    // Botón refresh usuarios
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', handleRefreshUsers);
    }
    
    // Select all usuarios
    const selectAllUsers = document.getElementById('select-all-users');
    if (selectAllUsers) {
        selectAllUsers.addEventListener('change', handleSelectAllUsers);
    }
}

/**
 * Configurar event listeners de permisos
 */
function setupPermissionsEventListeners() {
    // Búsqueda de permisos
    const permissionsSearch = document.getElementById('permissions-search');
    if (permissionsSearch) {
        permissionsSearch.addEventListener('input', updatePermissionsTable);
    }
    
    // Filtros de permisos
    const permissionsAreaFilter = document.getElementById('permissions-area-filter');
    const permissionsRoleFilter = document.getElementById('permissions-role-filter');
    
    if (permissionsAreaFilter) {
        permissionsAreaFilter.addEventListener('change', updatePermissionsTable);
    }
    
    if (permissionsRoleFilter) {
        permissionsRoleFilter.addEventListener('change', updatePermissionsTable);
    }
    
    // Asignación rápida
    const quickAssignBtn = document.getElementById('quick-assign-btn');
    if (quickAssignBtn) {
        quickAssignBtn.addEventListener('click', handleQuickAssign);
    }
    
    // Botón agregar permiso
    const addPermissionBtn = document.getElementById('add-permission-btn');
    if (addPermissionBtn) {
        addPermissionBtn.addEventListener('click', showAddPermissionModal);
    }
    
    // Botón refresh permisos
    const refreshPermissionsBtn = document.getElementById('refresh-permissions-btn');
    if (refreshPermissionsBtn) {
        refreshPermissionsBtn.addEventListener('click', handleRefreshPermissions);
    }
}
// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE SISTEMA
// Handlers, modales y funciones auxiliares
// =====================================================

// =====================================================
// EVENT LISTENERS PRINCIPALES
// =====================================================

/**
 * Configurar event listeners principales
 */
function setupEventListeners() {
    // Botón de ayuda (mantener existente)
    const helpBtn = document.getElementById('admin-help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', showAdminHelp);
    }
    
    // Navegación de secciones (mantener existente)
    const sectionTabs = ['areas', 'users', 'permissions'];
    sectionTabs.forEach(section => {
        const tab = document.getElementById(`section-${section}`);
        if (tab) {
            tab.addEventListener('click', () => handleSectionChange(section));
        }
    });
    
    // === NUEVOS EVENT LISTENERS PARA USUARIOS ===
    
    // Botón crear usuario
    const createUserBtn = document.getElementById('create-user-btn');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', showCreateUserModal);
    }
    
    // Botón invitar usuario  
    const inviteUserBtn = document.getElementById('invite-user-btn');
    if (inviteUserBtn) {
        inviteUserBtn.addEventListener('click', showCreateUserModal);
    }
    
    // Botón acciones masivas
    const bulkActionsBtn = document.getElementById('bulk-actions-btn');
    if (bulkActionsBtn) {
        bulkActionsBtn.addEventListener('click', handleBulkActions);
    }
    
    // Búsqueda de usuarios
    const usersSearch = document.getElementById('users-search');
    if (usersSearch) {
        usersSearch.addEventListener('input', debounce(() => {
            updateUsersTable();
        }, 300));
    }
    
    // Filtros de usuarios
    const usersRoleFilter = document.getElementById('users-role-filter');
    const usersStatusFilter = document.getElementById('users-status-filter');
    
    if (usersRoleFilter) {
        usersRoleFilter.addEventListener('change', updateUsersTable);
    }
    
    if (usersStatusFilter) {
        usersStatusFilter.addEventListener('change', updateUsersTable);
    }
    
    // Botón refresh usuarios
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', handleRefreshUsers);
    }
    
    // === EVENT LISTENERS EXISTENTES DE ÁREAS (mantener) ===
    setupAreasEventListeners();
    
    // === EVENT LISTENERS EXISTENTES DE PERMISOS (mantener) ===
    setupPermissionsEventListeners();
}

// =====================================================
// HANDLERS DE EVENTOS - ÁREAS
// =====================================================

/**
 * Actualizar tabla de áreas
 */
function updateAreasTable() {
    const tableContainer = document.getElementById('areas-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = createAreasTableHTML();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Manejar refresh de áreas
 */
async function handleRefreshAreas() {
    try {
        const refreshBtn = document.getElementById('refresh-areas-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await loadAreas();
        updateAreasTable();
        updateSystemCounts();
        
        showToast('Lista de áreas actualizada', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar áreas:', error);
        showToast('Error al actualizar las áreas', 'error');
    }
}

/**
 * Mostrar modal de agregar área
 */
window.showAddAreaModal = function() {
    showToast('Modal de agregar área en desarrollo', 'info');
};

/**
 * Ver detalles de área
 */
window.viewAreaDetails = function(areaId) {
    const area = adminState.areas.find(a => a.id === areaId);
    if (!area) {
        showToast('Área no encontrada', 'error');
        return;
    }
    
    showToast(`Detalles de área: ${area.nombre} en desarrollo`, 'info');
};

/**
 * Editar área
 */
window.editArea = function(areaId) {
    const area = adminState.areas.find(a => a.id === areaId);
    if (!area) {
        showToast('Área no encontrada', 'error');
        return;
    }
    
    showToast(`Editar área: ${area.nombre} en desarrollo`, 'info');
};

/**
 * Cambiar estado de área
 */
window.toggleAreaStatus = async function(areaId, currentStatus) {
    const area = adminState.areas.find(a => a.id === areaId);
    if (!area) {
        showToast('Área no encontrada', 'error');
        return;
    }
    
    const newStatus = currentStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar';
    
    try {
        const confirmed = await showConfirmModal(
            `¿Está seguro de ${action} el área "${area.nombre}"?`,
            {
                title: `Confirmar ${action}`,
                confirmText: action.charAt(0).toUpperCase() + action.slice(1),
                type: newStatus === 'INACTIVO' ? 'warning' : 'info'
            }
        );
        
        if (!confirmed) return;
        
        await updateData('areas', { estado: newStatus }, { id: areaId });
        
        showToast(`Área ${newStatus === 'ACTIVO' ? 'activada' : 'desactivada'} correctamente`, 'success');
        
        // Actualizar estado local y tabla
        area.estado = newStatus;
        updateAreasTable();
        
    } catch (error) {
        console.error('❌ Error al cambiar estado del área:', error);
        showToast('Error al cambiar el estado del área', 'error');
    }
};

/**
 * Eliminar área
 */
window.deleteArea = async function(areaId, areaNombre) {
    try {
        const confirmed = await showConfirmModal(
            `¿Está seguro de eliminar el área "${areaNombre}"? Esta acción no se puede deshacer y eliminará todos los indicadores asociados.`,
            {
                title: 'Confirmar eliminación',
                confirmText: 'Eliminar',
                type: 'danger'
            }
        );
        
        if (!confirmed) return;
        
        await deleteData('areas', { id: areaId });
        
        showToast('Área eliminada correctamente', 'success');
        
        // Actualizar estado local
        adminState.areas = adminState.areas.filter(a => a.id !== areaId);
        updateAreasTable();
        updateSystemCounts();
        
    } catch (error) {
        console.error('❌ Error al eliminar área:', error);
        showToast('Error al eliminar el área', 'error');
    }
};

// =====================================================
// HANDLERS DE EVENTOS - USUARIOS
// =====================================================

/**
 * Actualizar tabla de usuarios
 */
function updateUsersTable() {
    const tableContainer = document.getElementById('users-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = createUsersTableHTML();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}
/**
 * Mostrar modal de invitar usuario
 */
function showInviteUserModal() {
    showToast('Modal de invitar usuario en desarrollo', 'info');
}

/**
 * Ver detalles de usuario
 */
window.viewUserDetails = function(usuarioId) {
    const usuario = adminState.usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    showToast(`Detalles de usuario: ${usuario.nombre_completo || usuario.email} en desarrollo`, 'info');
};

/**
 * Editar usuario
 */
window.editUser = function(usuarioId) {
    const usuario = adminState.usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    showToast(`Editar usuario: ${usuario.nombre_completo || usuario.email} en desarrollo`, 'info');
};

/**
 * Gestionar permisos de usuario
 */
window.manageUserPermissions = function(usuarioId) {
    const usuario = adminState.usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    // Cambiar a sección de permisos y filtrar por usuario
    switchSection('permissions').then(() => {
        // Aquí podríamos implementar un filtro específico por usuario
        showToast(`Gestionando permisos de: ${usuario.nombre_completo || usuario.email}`, 'info');
    });
};

/**
 * Cambiar estado de usuario
 */
window.toggleUserStatus = async function(usuarioId, currentStatus) {
    const usuario = adminState.usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    const newStatus = currentStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar';
    
    try {
        const confirmed = await showConfirmModal(
            `¿Está seguro de ${action} al usuario "${usuario.nombre_completo || usuario.email}"?`,
            {
                title: `Confirmar ${action}`,
                confirmText: action.charAt(0).toUpperCase() + action.slice(1),
                type: newStatus === 'INACTIVO' ? 'warning' : 'info'
            }
        );
        
        if (!confirmed) return;
        
        await updateData('perfiles', { estado: newStatus }, { id: usuarioId });
        
        showToast(`Usuario ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente`, 'success');
        
        // Actualizar estado local y tabla
        usuario.estado = newStatus;
        updateUsersTable();
        
    } catch (error) {
        console.error('❌ Error al cambiar estado del usuario:', error);
        showToast('Error al cambiar el estado del usuario', 'error');
    }
};

// =====================================================
// HANDLERS DE EVENTOS - PERMISOS
// =====================================================

/**
 * Actualizar tabla de permisos
 */
function updatePermissionsTable() {
    const tableContainer = document.getElementById('permissions-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = createPermissionsTableHTML();
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Manejar refresh de permisos
 */
async function handleRefreshPermissions() {
    try {
        const refreshBtn = document.getElementById('refresh-permissions-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await loadPermisos();
        updatePermissionsTable();
        updateSystemCounts();
        
        showToast('Lista de permisos actualizada', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar permisos:', error);
        showToast('Error al actualizar los permisos', 'error');
    }
}
/**
 * Mostrar modal de agregar permiso
 */
window.showAddPermissionModal = function() {
    showToast('Modal de agregar permiso en desarrollo', 'info');
};

/**
 * Editar permiso
 */
window.editPermission = function(permisoId) {
    const permiso = adminState.permisos.find(p => p.id === permisoId);
    if (!permiso) {
        showToast('Permiso no encontrado', 'error');
        return;
    }
    
    showToast(`Editar permiso en desarrollo`, 'info');
};

/**
 * Eliminar permiso
 */
window.deletePermission = async function(permisoId, nombreUsuario, nombreArea) {
    try {
        const confirmed = await showConfirmModal(
            `¿Está seguro de eliminar la asignación de "${nombreUsuario}" en el área "${nombreArea}"?`,
            {
                title: 'Confirmar eliminación',
                confirmText: 'Eliminar',
                type: 'warning'
            }
        );
        
        if (!confirmed) return;
        
        await deleteData('usuario_areas', { id: permisoId });
        
        showToast('Asignación eliminada correctamente', 'success');
        
        // Actualizar estado local
        adminState.permisos = adminState.permisos.filter(p => p.id !== permisoId);
        updatePermissionsTable();
        updateSystemCounts();
        
    } catch (error) {
        console.error('❌ Error al eliminar permiso:', error);
        showToast('Error al eliminar la asignación', 'error');
    }
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Actualizar contadores del sistema
 */
function updateSystemCounts() {
    const totalAreasElement = document.getElementById('total-areas-count');
    const totalUsersElement = document.getElementById('total-users-count');
    const totalPermissionsElement = document.getElementById('total-permissions-count');
    
    if (totalAreasElement) {
        totalAreasElement.textContent = adminState.areas.length;
    }
    
    if (totalUsersElement) {
        totalUsersElement.textContent = adminState.usuarios.length;
    }
    
    if (totalPermissionsElement) {
        totalPermissionsElement.textContent = adminState.permisos.length;
    }
    updateUserStats();
}

/**
 * Mostrar ayuda del panel de administración
 */
function showAdminHelp() {
    showModal({
        title: 'Ayuda del Panel de Administración',
        content: `
            <div class="space-y-4">
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Gestión de Áreas</h4>
                    <p class="text-sm text-gray-600">Administre las áreas organizacionales del sistema. Puede crear, editar, activar/desactivar y eliminar áreas.</p>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Gestión de Usuarios</h4>
                    <p class="text-sm text-gray-600">Administre los usuarios registrados, sus roles principales y estados. Los usuarios se registran automáticamente al acceder al sistema.</p>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Permisos y Asignaciones</h4>
                    <p class="text-sm text-gray-600">Asigne usuarios a áreas específicas con roles determinados. Use la asignación rápida para agregar permisos de forma eficiente.</p>
                </div>
                
                <div class="bg-blue-50 p-3 rounded">
                    <p class="text-sm text-blue-800">
                        <strong>Nota:</strong> Solo los administradores pueden acceder a este panel. Los cambios realizados afectan inmediatamente los permisos del sistema.
                    </p>
                </div>
            </div>
        `,
        actions: [
            {
                text: 'Cerrar',
                handler: () => true
            }
        ]
    });
}

/**
 * Buscar usuario por email para validaciones
 */
async function findUserByEmail(email) {
    try {
        const { data } = await selectData('perfiles', {
            select: '*',
            filters: { email: email.trim().toLowerCase() }
        });
        
        return data && data.length > 0 ? data[0] : null;
        
    } catch (error) {
        console.error('❌ Error al buscar usuario por email:', error);
        return null;
    }
}

/**
 * Validar permisos para operaciones administrativas
 */
function validateAdminPermission(operation) {
    if (adminState.userProfile?.rol_principal !== 'ADMIN') {
        showToast('Solo los administradores pueden realizar esta acción', 'error');
        return false;
    }
    return true;
}

/**
 * Exportar datos de administración
 */
async function exportAdminData(type) {
    if (!validateAdminPermission('export')) return;
    
    try {
        let data, filename;
        
        switch (type) {
            case 'areas':
                data = adminState.areas.map(area => ({
                    'Clave': area.clave,
                    'Nombre': area.nombre,
                    'Descripción': area.descripcion || '',
                    'Estado': area.estado,
                    'Color': area.color_hex,
                    'Indicadores': area.total_indicadores || 0,
                    'Usuarios Asignados': area.usuarios_asignados || 0,
                    'Fecha Creación': formatDate(area.fecha_creacion, 'long')
                }));
                filename = `AIFA_areas_${new Date().toISOString().slice(0, 10)}.csv`;
                break;
                
            case 'users':
                data = adminState.usuarios.map(user => ({
                    'Email': user.email,
                    'Nombre Completo': user.nombre_completo || '',
                    'Puesto': user.puesto || '',
                    'Rol Principal': user.rol_principal,
                    'Estado': user.estado,
                    'Áreas Asignadas': user.areas_asignadas || 0,
                    'Último Acceso': user.ultimo_acceso ? formatDate(user.ultimo_acceso, 'long') : 'Nunca',
                    'Fecha Registro': formatDate(user.fecha_creacion, 'long')
                }));
                filename = `AIFA_usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
                break;
                
            case 'permissions':
                data = adminState.permisos.map(permiso => ({
                    'Usuario Email': permiso.perfiles?.email || '',
                    'Usuario Nombre': permiso.perfiles?.nombre_completo || '',
                    'Área': permiso.areas?.nombre || '',
                    'Área Clave': permiso.areas?.clave || '',
                    'Rol': permiso.rol,
                    'Puede Capturar': permiso.puede_capturar ? 'Sí' : 'No',
                    'Puede Editar': permiso.puede_editar ? 'Sí' : 'No',
                    'Puede Eliminar': permiso.puede_eliminar ? 'Sí' : 'No',
                    'Fecha Asignación': formatDate(permiso.fecha_asignacion, 'long')
                }));
                filename = `AIFA_permisos_${new Date().toISOString().slice(0, 10)}.csv`;
                break;
                
            default:
                showToast('Tipo de exportación no válido', 'error');
                return;
        }
        
        exportToCSV(data, filename);
        
    } catch (error) {
        console.error('❌ Error al exportar datos:', error);
        showToast('Error al exportar los datos', 'error');
    }
}
// =====================================================
// GESTIÓN DE USUARIOS - FUNCIONES PRINCIPALES
// =====================================================

/**
 * Crear un nuevo usuario
 */
async function createUser(userData) {
    if (!validateAdminPermission('create_user')) return;
    
    try {
        showLoading('Creando usuario...');
        
        // Validar datos obligatorios
        if (!userData.email || !userData.nombre_completo || !userData.rol_principal) {
            throw new Error('Faltan datos obligatorios: email, nombre completo y rol principal');
        }
        
        // Verificar si el email ya existe
        const existingUser = await findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error('Ya existe un usuario con este email');
        }
        
        // Preparar datos para inserción
        const newUserData = {
            email: userData.email.trim().toLowerCase(),
            nombre_completo: userData.nombre_completo.trim(),
            rol_principal: userData.rol_principal,
            telefono: userData.telefono?.trim() || null,
            puesto: userData.puesto?.trim() || null,
            estado: 'ACTIVO',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        };
        
        // Insertar en tabla perfiles
        const { data: newUser } = await insertData('perfiles', newUserData, {
            select: `
                id, email, nombre_completo, rol_principal, 
                telefono, puesto, estado, fecha_creacion
            `
        });
        
        if (!newUser || newUser.length === 0) {
            throw new Error('Error al crear el usuario');
        }
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'perfiles',
            registro_id: newUser[0].id,
            operacion: 'INSERT',
            datos_nuevos: newUserData,
            observaciones: `Usuario creado por administrador`
        });
        
        // Actualizar estado local
        adminState.usuarios.unshift(newUser[0]);
        updateUsersTable();
        updateSystemCounts();
        
        showToast('Usuario creado correctamente', 'success');
        hideLoading();
        
        return newUser[0];
        
    } catch (error) {
        console.error('❌ Error al crear usuario:', error);
        showToast(error.message || 'Error al crear el usuario', 'error');
        hideLoading();
        throw error;
    }
}

/**
 * Editar un usuario existente
 */
async function editUser(userId, userData) {
    if (!validateAdminPermission('edit_user')) return;
    
    try {
        showLoading('Actualizando usuario...');
        
        // Buscar usuario actual
        const currentUser = adminState.usuarios.find(u => u.id === userId);
        if (!currentUser) {
            throw new Error('Usuario no encontrado');
        }
        
        // Si se está cambiando el email, verificar que no exista
        if (userData.email && userData.email.toLowerCase() !== currentUser.email.toLowerCase()) {
            const existingUser = await findUserByEmail(userData.email);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Ya existe otro usuario con este email');
            }
        }
        
        // Preparar datos de actualización
        const updateData = {
            fecha_actualizacion: new Date().toISOString()
        };
        
        // Solo incluir campos que han cambiado
        const fieldsToUpdate = ['email', 'nombre_completo', 'rol_principal', 'telefono', 'puesto'];
        const changedFields = [];
        
        fieldsToUpdate.forEach(field => {
            if (userData[field] !== undefined && userData[field] !== currentUser[field]) {
                if (field === 'email') {
                    updateData[field] = userData[field].trim().toLowerCase();
                } else if (['nombre_completo', 'telefono', 'puesto'].includes(field)) {
                    updateData[field] = userData[field]?.trim() || null;
                } else {
                    updateData[field] = userData[field];
                }
                changedFields.push(field);
            }
        });
        
        if (changedFields.length === 0) {
            showToast('No hay cambios para guardar', 'warning');
            hideLoading();
            return;
        }
        
        // Actualizar en base de datos
        const { data: updatedUsers } = await updateData('perfiles', updateData, 
            { id: userId }, 
            { select: `
                id, email, nombre_completo, rol_principal, 
                telefono, puesto, estado, ultimo_acceso, 
                fecha_creacion, fecha_actualizacion
            ` }
        );
        
        if (!updatedUsers || updatedUsers.length === 0) {
            throw new Error('Error al actualizar el usuario');
        }
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'perfiles',
            registro_id: userId,
            operacion: 'UPDATE',
            datos_anteriores: currentUser,
            datos_nuevos: updateData,
            campos_modificados: changedFields.join(', '),
            observaciones: `Usuario editado por administrador`
        });
        
        // Actualizar estado local
        const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            adminState.usuarios[userIndex] = updatedUsers[0];
        }
        
        updateUsersTable();
        showToast('Usuario actualizado correctamente', 'success');
        hideLoading();
        
        return updatedUsers[0];
        
    } catch (error) {
        console.error('❌ Error al editar usuario:', error);
        showToast(error.message || 'Error al actualizar el usuario', 'error');
        hideLoading();
        throw error;
    }
}

/**
 * Eliminar un usuario (cambiar estado a INACTIVO)
 */
async function deleteUser(userId) {
    if (!validateAdminPermission('delete_user')) return;
    
    try {
        // Buscar usuario
        const user = adminState.usuarios.find(u => u.id === userId);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        
        // Confirmar eliminación
        const confirmed = await showConfirmModal(
            `¿Está seguro que desea eliminar al usuario "${user.nombre_completo || user.email}"?\n\nEsta acción desactivará al usuario y eliminará todas sus asignaciones de área.`,
            {
                title: 'Confirmar eliminación de usuario',
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                type: 'danger'
            }
        );
        
        if (!confirmed) return;
        
        showLoading('Eliminando usuario...');
        
        // Actualizar estado del usuario a INACTIVO
        const { data: updatedUsers } = await updateData('perfiles', 
            { 
                estado: 'INACTIVO',
                fecha_actualizacion: new Date().toISOString()
            }, 
            { id: userId },
            { select: 'id, email, nombre_completo, estado' }
        );
        
        if (!updatedUsers || updatedUsers.length === 0) {
            throw new Error('Error al eliminar el usuario');
        }
        
        // Desactivar todas las asignaciones de área del usuario
        await updateData('usuario_areas', 
            { 
                estado: 'INACTIVO',
                fecha_actualizacion: new Date().toISOString()
            },
            { usuario_id: userId, estado: 'ACTIVO' }
        );
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'perfiles',
            registro_id: userId,
            operacion: 'UPDATE',
            datos_anteriores: user,
            datos_nuevos: { estado: 'INACTIVO' },
            campos_modificados: 'estado',
            observaciones: `Usuario eliminado por administrador - Se desactivaron todas sus asignaciones de área`
        });
        
        // Actualizar estado local
        const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            adminState.usuarios[userIndex].estado = 'INACTIVO';
        }
        
        // Actualizar tabla de permisos también
        adminState.permisos = adminState.permisos.filter(p => p.usuario_id !== userId);
        
        updateUsersTable();
        updatePermissionsTable();
        updateSystemCounts();
        
        showToast('Usuario eliminado correctamente', 'success');
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error al eliminar usuario:', error);
        showToast(error.message || 'Error al eliminar el usuario', 'error');
        hideLoading();
    }
}

/**
 * Cambiar estado de un usuario (ACTIVO/INACTIVO)
 */
async function toggleUserStatus(userId) {
    if (!validateAdminPermission('toggle_user_status')) return;
    
    try {
        const user = adminState.usuarios.find(u => u.id === userId);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        
        const newStatus = user.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar';
        
        const confirmed = await showConfirmModal(
            `¿Está seguro que desea ${action} al usuario "${user.nombre_completo || user.email}"?`,
            {
                title: `Confirmar ${action} usuario`,
                confirmText: action === 'activar' ? 'Activar' : 'Desactivar',
                type: action === 'activar' ? 'info' : 'warning'
            }
        );
        
        if (!confirmed) return;
        
        showLoading(`${action === 'activar' ? 'Activando' : 'Desactivando'} usuario...`);
        
        // Actualizar estado
        const { data: updatedUsers } = await updateData('perfiles', 
            { 
                estado: newStatus,
                fecha_actualizacion: new Date().toISOString()
            }, 
            { id: userId },
            { select: 'id, email, nombre_completo, estado' }
        );
        
        if (!updatedUsers || updatedUsers.length === 0) {
            throw new Error(`Error al ${action} el usuario`);
        }
        
        // Si se desactiva, desactivar también sus asignaciones
        if (newStatus === 'INACTIVO') {
            await updateData('usuario_areas', 
                { 
                    estado: 'INACTIVO',
                    fecha_actualizacion: new Date().toISOString()
                },
                { usuario_id: userId, estado: 'ACTIVO' }
            );
        }
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'perfiles',
            registro_id: userId,
            operacion: 'UPDATE',
            datos_anteriores: user,
            datos_nuevos: { estado: newStatus },
            campos_modificados: 'estado',
            observaciones: `Usuario ${action === 'activar' ? 'activado' : 'desactivado'} por administrador`
        });
        
        // Actualizar estado local
        const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            adminState.usuarios[userIndex].estado = newStatus;
        }
        
        // Si se desactivó, remover de permisos locales
        if (newStatus === 'INACTIVO') {
            adminState.permisos = adminState.permisos.filter(p => p.usuario_id !== userId);
            updatePermissionsTable();
        }
        
        updateUsersTable();
        updateSystemCounts();
        
        showToast(`Usuario ${action === 'activar' ? 'activado' : 'desactivado'} correctamente`, 'success');
        hideLoading();
        
    } catch (error) {
        console.error(`❌ Error al cambiar estado de usuario:`, error);
        showToast(error.message || 'Error al cambiar el estado del usuario', 'error');
        hideLoading();
    }
}

/**
 * Asignar usuario a área con permisos específicos
 */
async function assignUserToArea(userId, areaId, assignmentData) {
    if (!validateAdminPermission('assign_user_area')) return;
    
    try {
        showLoading('Asignando usuario a área...');
        
        // Verificar que el usuario existe y está activo
        const user = adminState.usuarios.find(u => u.id === userId && u.estado === 'ACTIVO');
        if (!user) {
            throw new Error('Usuario no encontrado o inactivo');
        }
        
        // Verificar que el área existe y está activa
        const area = adminState.areas.find(a => a.id === areaId && a.estado === 'ACTIVO');
        if (!area) {
            throw new Error('Área no encontrada o inactiva');
        }
        
        // Verificar si ya existe una asignación activa
        const existingAssignment = adminState.permisos.find(p => 
            p.usuario_id === userId && p.area_id === areaId && p.estado === 'ACTIVO'
        );
        
        if (existingAssignment) {
            throw new Error('El usuario ya está asignado a esta área');
        }
        
        // Preparar datos de asignación
        const assignmentRecord = {
            usuario_id: userId,
            area_id: areaId,
            rol: assignmentData.rol || 'CAPTURISTA',
            puede_capturar: assignmentData.puede_capturar || false,
            puede_editar: assignmentData.puede_editar || false,
            puede_eliminar: assignmentData.puede_eliminar || false,
            estado: 'ACTIVO',
            asignado_por: adminState.userProfile.id,
            fecha_asignacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        };
        
        // Insertar asignación
        const { data: newAssignment } = await insertData('usuario_areas', assignmentRecord, {
            select: `
                *,
                perfiles!usuario_id (
                    nombre_completo,
                    email,
                    rol_principal
                ),
                areas!area_id (
                    nombre,
                    clave,
                    color_hex
                )
            `
        });
        
        if (!newAssignment || newAssignment.length === 0) {
            throw new Error('Error al crear la asignación');
        }
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'usuario_areas',
            registro_id: newAssignment[0].id,
            operacion: 'INSERT',
            datos_nuevos: assignmentRecord,
            observaciones: `Usuario ${user.nombre_completo} asignado a área ${area.nombre} con rol ${assignmentRecord.rol}`
        });
        
        // Actualizar estado local
        adminState.permisos.unshift(newAssignment[0]);
        updatePermissionsTable();
        updateSystemCounts();
        
        showToast(`Usuario asignado a ${area.nombre} correctamente`, 'success');
        hideLoading();
        
        return newAssignment[0];
        
    } catch (error) {
        console.error('❌ Error al asignar usuario a área:', error);
        showToast(error.message || 'Error al asignar usuario a área', 'error');
        hideLoading();
        throw error;
    }
}

/**
 * Registrar operación en auditoría
 */
async function registrarAuditoria(auditoriaData) {
    try {
        const auditRecord = {
            tabla_afectada: auditoriaData.tabla_afectada,
            registro_id: auditoriaData.registro_id,
            operacion: auditoriaData.operacion,
            datos_anteriores: auditoriaData.datos_anteriores ? JSON.stringify(auditoriaData.datos_anteriores) : null,
            datos_nuevos: auditoriaData.datos_nuevos ? JSON.stringify(auditoriaData.datos_nuevos) : null,
            campos_modificados: auditoriaData.campos_modificados || null,
            usuario_id: adminState.userProfile.id,
            ip_address: '127.0.0.1', // Placeholder - en producción obtener IP real
            user_agent: navigator.userAgent,
            fecha_operacion: new Date().toISOString(),
            sesion_id: crypto.randomUUID(),
            observaciones: auditoriaData.observaciones,
            es_automatico: false
        };
        
        await insertData('auditoria_log', auditRecord);
        
        if (DEBUG.enabled) {
            console.log('✅ Operación registrada en auditoría:', auditRecord);
        }
        
    } catch (error) {
        console.error('❌ Error al registrar auditoría:', error);
        // No lanzar error para no interrumpir la operación principal
    }
}
// =====================================================
// GESTIÓN DE USUARIOS - INTERFAZ Y MODALES
// =====================================================

/**
 * Mostrar modal para crear usuario
 */
function showCreateUserModal() {
    if (!validateAdminPermission('create_user')) return;
    
    showModal({
        title: 'Crear Nuevo Usuario',
        content: `
            <form id="create-user-form" class="space-y-4">
                <div>
                    <label for="user-email" class="block text-sm font-medium text-gray-700 mb-1">
                        Email <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="email" 
                        id="user-email" 
                        name="email" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        placeholder="usuario@aifa.gob.mx"
                    >
                    <div class="error-message text-red-500 text-sm mt-1 hidden" id="user-email-error"></div>
                </div>
                
                <div>
                    <label for="user-name" class="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="user-name" 
                        name="nombre_completo" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        placeholder="Nombre completo del usuario"
                    >
                    <div class="error-message text-red-500 text-sm mt-1 hidden" id="user-name-error"></div>
                </div>
                
                <div>
                    <label for="user-role" class="block text-sm font-medium text-gray-700 mb-1">
                        Rol Principal <span class="text-red-500">*</span>
                    </label>
                    <select 
                        id="user-role" 
                        name="rol_principal" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                        <option value="">Seleccionar rol...</option>
                        <option value="ADMIN">Administrador</option>
                        <option value="DIRECTOR">Director</option>
                        <option value="SUBDIRECTOR">Subdirector</option>
                        <option value="JEFE_AREA">Jefe de Área</option>
                        <option value="CAPTURISTA">Capturista</option>
                    </select>
                </div>
                
                <div>
                    <label for="user-puesto" class="block text-sm font-medium text-gray-700 mb-1">
                        Puesto
                    </label>
                    <input 
                        type="text" 
                        id="user-puesto" 
                        name="puesto"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        placeholder="Puesto o cargo del usuario"
                    >
                </div>
                
                <div>
                    <label for="user-telefono" class="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                    </label>
                    <input 
                        type="tel" 
                        id="user-telefono" 
                        name="telefono"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        placeholder="Número de teléfono"
                    >
                </div>
                
                <div class="bg-blue-50 p-3 rounded-lg">
                    <div class="flex items-start space-x-2">
                        <i data-lucide="info" class="w-5 h-5 text-blue-600 mt-0.5"></i>
                        <div class="text-sm text-blue-800">
                            <p class="font-medium">Información importante:</p>
                            <ul class="mt-1 space-y-1 text-xs">
                                <li>• El usuario recibirá un email de invitación</li>
                                <li>• Se creará automáticamente en el sistema de autenticación</li>
                                <li>• Podrá asignar áreas específicas después de crear el usuario</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </form>
        `,
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            },
            {
                text: 'Crear Usuario',
                primary: true,
                handler: async () => {
                    await handleCreateUser();
                    return false; // No cerrar modal automáticamente
                }
            }
        ]
    });
    
    // Recrear iconos
    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 10);
}

/**
 * Mostrar modal para editar usuario
 */
function showEditUserModal(userId) {
    if (!validateAdminPermission('edit_user')) return;
    
    const user = adminState.usuarios.find(u => u.id === userId);
    if (!user) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    showModal({
        title: `Editar Usuario: ${user.nombre_completo || user.email}`,
        content: `
            <form id="edit-user-form" class="space-y-4">
                <input type="hidden" name="user_id" value="${user.id}">
                
                <div>
                    <label for="edit-user-email" class="block text-sm font-medium text-gray-700 mb-1">
                        Email <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="email" 
                        id="edit-user-email" 
                        name="email" 
                        required
                        value="${user.email || ''}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                </div>
                
                <div>
                    <label for="edit-user-name" class="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="edit-user-name" 
                        name="nombre_completo" 
                        required
                        value="${user.nombre_completo || ''}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                </div>
                
                <div>
                    <label for="edit-user-role" class="block text-sm font-medium text-gray-700 mb-1">
                        Rol Principal <span class="text-red-500">*</span>
                    </label>
                    <select 
                        id="edit-user-role" 
                        name="rol_principal" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                        <option value="ADMIN" ${user.rol_principal === 'ADMIN' ? 'selected' : ''}>Administrador</option>
                        <option value="DIRECTOR" ${user.rol_principal === 'DIRECTOR' ? 'selected' : ''}>Director</option>
                        <option value="SUBDIRECTOR" ${user.rol_principal === 'SUBDIRECTOR' ? 'selected' : ''}>Subdirector</option>
                        <option value="JEFE_AREA" ${user.rol_principal === 'JEFE_AREA' ? 'selected' : ''}>Jefe de Área</option>
                        <option value="CAPTURISTA" ${user.rol_principal === 'CAPTURISTA' ? 'selected' : ''}>Capturista</option>
                    </select>
                </div>
                
                <div>
                    <label for="edit-user-puesto" class="block text-sm font-medium text-gray-700 mb-1">
                        Puesto
                    </label>
                    <input 
                        type="text" 
                        id="edit-user-puesto" 
                        name="puesto"
                        value="${user.puesto || ''}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                </div>
                
                <div>
                    <label for="edit-user-telefono" class="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                    </label>
                    <input 
                        type="tel" 
                        id="edit-user-telefono" 
                        name="telefono"
                        value="${user.telefono || ''}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                </div>
                
                <div class="bg-gray-50 p-3 rounded-lg">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-600">Estado actual:</span>
                        <span class="px-2 py-1 rounded text-xs font-medium ${user.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${user.estado}
                        </span>
                    </div>
                    ${user.fecha_creacion ? `
                        <div class="flex items-center justify-between text-sm mt-2">
                            <span class="text-gray-600">Registrado:</span>
                            <span class="text-gray-800">${formatDate(user.fecha_creacion, 'short')}</span>
                        </div>
                    ` : ''}
                    ${user.ultimo_acceso ? `
                        <div class="flex items-center justify-between text-sm mt-2">
                            <span class="text-gray-600">Último acceso:</span>
                            <span class="text-gray-800">${formatDate(user.ultimo_acceso, 'short')}</span>
                        </div>
                    ` : ''}
                </div>
            </form>
        `,
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            },
            {
                text: 'Guardar Cambios',
                primary: true,
                handler: async () => {
                    await handleEditUser();
                    return false; // No cerrar modal automáticamente
                }
            }
        ]
    });
}

/**
 * Mostrar modal de asignación rápida de usuario a área
 */
function showQuickAssignModal() {
    if (!validateAdminPermission('assign_user_area')) return;
    
    // Filtrar usuarios y áreas activos
    const activeUsers = adminState.usuarios.filter(u => u.estado === 'ACTIVO');
    const activeAreas = adminState.areas.filter(a => a.estado === 'ACTIVO');
    
    if (activeUsers.length === 0) {
        showToast('No hay usuarios activos para asignar', 'warning');
        return;
    }
    
    if (activeAreas.length === 0) {
        showToast('No hay áreas activas para asignar', 'warning');
        return;
    }
    
    showModal({
        title: 'Asignación Rápida de Usuario a Área',
        content: `
            <form id="quick-assign-form" class="space-y-4">
                <div>
                    <label for="assign-user" class="block text-sm font-medium text-gray-700 mb-1">
                        Usuario <span class="text-red-500">*</span>
                    </label>
                    <select 
                        id="assign-user" 
                        name="usuario_id" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                        <option value="">Seleccionar usuario...</option>
                        ${activeUsers.map(user => `
                            <option value="${user.id}">
                                ${user.nombre_completo || user.email} (${user.rol_principal})
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="assign-area" class="block text-sm font-medium text-gray-700 mb-1">
                        Área <span class="text-red-500">*</span>
                    </label>
                    <select 
                        id="assign-area" 
                        name="area_id" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                        <option value="">Seleccionar área...</option>
                        ${activeAreas.map(area => `
                            <option value="${area.id}">
                                ${area.clave} - ${area.nombre}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="assign-role" class="block text-sm font-medium text-gray-700 mb-1">
                        Rol en el Área <span class="text-red-500">*</span>
                    </label>
                    <select 
                        id="assign-role" 
                        name="rol" 
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                    >
                        <option value="CAPTURISTA">Capturista</option>
                        <option value="JEFE_AREA">Jefe de Área</option>
                        <option value="SUBDIRECTOR">Subdirector</option>
                        <option value="DIRECTOR">Director</option>
                    </select>
                </div>
                
                <div class="space-y-3">
                    <label class="block text-sm font-medium text-gray-700">
                        Permisos Específicos
                    </label>
                    
                    <div class="space-y-2">
                        <label class="flex items-center">
                            <input 
                                type="checkbox" 
                                name="puede_capturar" 
                                class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                            >
                            <span class="ml-2 text-sm text-gray-700">Puede capturar datos</span>
                        </label>
                        
                        <label class="flex items-center">
                            <input 
                                type="checkbox" 
                                name="puede_editar" 
                                class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                            >
                            <span class="ml-2 text-sm text-gray-700">Puede editar datos</span>
                        </label>
                        
                        <label class="flex items-center">
                            <input 
                                type="checkbox" 
                                name="puede_eliminar" 
                                class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                            >
                            <span class="ml-2 text-sm text-gray-700">Puede eliminar datos</span>
                        </label>
                    </div>
                </div>
                
                <div class="bg-yellow-50 p-3 rounded-lg">
                    <div class="flex items-start space-x-2">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-600 mt-0.5"></i>
                        <div class="text-sm text-yellow-800">
                            <p class="font-medium">Verificar antes de asignar:</p>
                            <p class="mt-1 text-xs">Asegúrese de que el usuario no esté ya asignado a esta área.</p>
                        </div>
                    </div>
                </div>
            </form>
        `,
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            },
            {
                text: 'Asignar',
                primary: true,
                handler: async () => {
                    await handleQuickAssign();
                    return false; // No cerrar modal automáticamente
                }
            }
        ]
    });
    
    // Recrear iconos
    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 10);
}

/**
 * Handler para crear usuario
 */
async function handleCreateUser() {
    try {
        const form = document.getElementById('create-user-form');
        if (!form) return;
        
        // Validar formulario
        const formData = getFormData(form);
        
        // Validaciones básicas
        if (!formData.email || !formData.nombre_completo || !formData.rol_principal) {
            showToast('Complete todos los campos obligatorios', 'error');
            return;
        }
        
        // Validar formato de email
        if (!VALIDATION.email.pattern.test(formData.email)) {
            showToast('Formato de email no válido', 'error');
            return;
        }
        
        // Crear usuario
        await createUser(formData);
        
        // Cerrar modal si fue exitoso
        hideModal();
        
    } catch (error) {
        console.error('❌ Error en handleCreateUser:', error);
        // No cerrar el modal si hay error para que el usuario pueda corregir
    }
}

/**
 * Handler para editar usuario
 */
async function handleEditUser() {
    try {
        const form = document.getElementById('edit-user-form');
        if (!form) return;
        
        const formData = getFormData(form);
        const userId = formData.user_id;
        
        if (!userId) {
            showToast('ID de usuario no válido', 'error');
            return;
        }
        
        // Validaciones básicas
        if (!formData.email || !formData.nombre_completo || !formData.rol_principal) {
            showToast('Complete todos los campos obligatorios', 'error');
            return;
        }
        
        // Validar formato de email
        if (!VALIDATION.email.pattern.test(formData.email)) {
            showToast('Formato de email no válido', 'error');
            return;
        }
        
        // Editar usuario
        await editUser(userId, formData);
        
        // Cerrar modal si fue exitoso
        hideModal();
        
    } catch (error) {
        console.error('❌ Error en handleEditUser:', error);
        // No cerrar el modal si hay error
    }
}

/**
 * Handler para asignación rápida
 */
async function handleQuickAssign() {
    try {
        const form = document.getElementById('quick-assign-form');
        if (!form) return;
        
        const formData = getFormData(form);
        
        // Validar campos obligatorios
        if (!formData.usuario_id || !formData.area_id || !formData.rol) {
            showToast('Complete todos los campos obligatorios', 'error');
            return;
        }
        
        // Preparar datos de asignación
        const assignmentData = {
            rol: formData.rol,
            puede_capturar: formData.puede_capturar === 'on',
            puede_editar: formData.puede_editar === 'on',
            puede_eliminar: formData.puede_eliminar === 'on'
        };
        
        // Asignar usuario a área
        await assignUserToArea(formData.usuario_id, formData.area_id, assignmentData);
        
        // Cerrar modal si fue exitoso
        hideModal();
        
    } catch (error) {
        console.error('❌ Error en handleQuickAssign:', error);
        // No cerrar el modal si hay error
    }
}
// =====================================================
// GESTIÓN DE USUARIOS - TABLA Y HANDLERS
// =====================================================

/**
 * Actualizar tabla de usuarios con datos completos
 */
function updateUsersTable() {
    const tableContainer = document.getElementById('users-table-container');
    if (!tableContainer) return;
    
    const filteredUsers = getFilteredUsers();
    
    if (filteredUsers.length === 0) {
        tableContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="flex flex-col items-center">
                    <i data-lucide="users" class="w-12 h-12 text-gray-400 mb-4"></i>
                    <p class="text-gray-500 mb-2">No se encontraron usuarios</p>
                    <p class="text-sm text-gray-400">
                        ${adminState.searchTerm ? 'Intente con otros criterios de búsqueda' : 'Agregue el primer usuario al sistema'}
                    </p>
                </div>
            </div>
        `;
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
        return;
    }
    
    const tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input 
                                type="checkbox" 
                                id="select-all-users"
                                class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                                title="Seleccionar todos"
                            >
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol Principal
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Puesto
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Áreas
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Último Acceso
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${filteredUsers.map(user => createUserTableRow(user)).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Información de paginación -->
        <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div class="flex-1 flex justify-between sm:hidden">
                <span class="text-sm text-gray-700">
                    Mostrando ${filteredUsers.length} usuario${filteredUsers.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700">
                        Mostrando <span class="font-medium">${filteredUsers.length}</span> 
                        de <span class="font-medium">${adminState.usuarios.length}</span> usuario${adminState.usuarios.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div class="flex items-center space-x-4">
                    <button 
                        onclick="exportUsersData()"
                        class="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                    >
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>Exportar</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
    
    // Configurar event listeners para checkboxes y botones
    setupUserTableEventListeners();
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Crear fila de usuario para la tabla
 */
function createUserTableRow(user) {
    const userAreas = adminState.permisos.filter(p => p.usuario_id === user.id && p.estado === 'ACTIVO');
    const areasCount = userAreas.length;
    
    return `
        <tr class="hover:bg-gray-50" data-user-id="${user.id}">
            <td class="px-3 py-4 whitespace-nowrap">
                <input 
                    type="checkbox" 
                    class="user-checkbox rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                    value="${user.id}"
                >
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-aifa-blue flex items-center justify-center">
                            <span class="text-sm font-medium text-white">
                                ${(user.nombre_completo || user.email).charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                            ${user.nombre_completo || 'Sin nombre'}
                        </div>
                        <div class="text-sm text-gray-500">
                            ${user.email}
                        </div>
                        ${user.telefono ? `
                            <div class="text-xs text-gray-400">
                                ${user.telefono}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColorClass(user.rol_principal)}">
                    ${getRoleName(user.rol_principal)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${user.puesto || 'No especificado'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${user.estado}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div class="flex items-center space-x-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ${areasCount} área${areasCount !== 1 ? 's' : ''}
                    </span>
                    ${areasCount > 0 ? `
                        <button 
                            onclick="showUserAreas('${user.id}')"
                            class="text-xs text-blue-600 hover:text-blue-800"
                            title="Ver áreas asignadas"
                        >
                            <i data-lucide="eye" class="w-3 h-3"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.ultimo_acceso ? formatDate(user.ultimo_acceso, 'short') : 'Nunca'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end space-x-2">
                    <button 
                        onclick="showEditUserModal('${user.id}')"
                        class="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                        title="Editar usuario"
                    >
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    
                    <button 
                        onclick="showUserAreas('${user.id}')"
                        class="text-green-600 hover:text-green-900 p-1 rounded transition-colors"
                        title="Gestionar áreas"
                    >
                        <i data-lucide="settings" class="w-4 h-4"></i>
                    </button>
                    
                    <button 
                        onclick="toggleUserStatus('${user.id}')"
                        class="p-1 rounded transition-colors ${user.estado === 'ACTIVO' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}"
                        title="${user.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'} usuario"
                    >
                        <i data-lucide="${user.estado === 'ACTIVO' ? 'user-x' : 'user-check'}" class="w-4 h-4"></i>
                    </button>
                    
                    <button 
                        onclick="deleteUser('${user.id}')"
                        class="text-red-600 hover:text-red-900 p-1 rounded transition-colors"
                        title="Eliminar usuario"
                    >
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Configurar event listeners específicos de la tabla de usuarios
 */
function setupUserTableEventListeners() {
    // Checkbox "Seleccionar todos"
    const selectAllCheckbox = document.getElementById('select-all-users');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllUsers);
    }
    
    // Checkboxes individuales
    const userCheckboxes = document.querySelectorAll('.user-checkbox');
    userCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleUserCheckboxChange);
    });
}

/**
 * Handler para seleccionar todos los usuarios
 */
function handleSelectAllUsers(event) {
    const isChecked = event.target.checked;
    const userCheckboxes = document.querySelectorAll('.user-checkbox');
    
    userCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    
    // Actualizar UI de acciones masivas si es necesario
    updateBulkActionsUI();
}

/**
 * Handler para cambios en checkboxes individuales
 */
function handleUserCheckboxChange() {
    const userCheckboxes = document.querySelectorAll('.user-checkbox');
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectAllCheckbox = document.getElementById('select-all-users');
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkedBoxes.length === userCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < userCheckboxes.length;
    }
    
    // Actualizar UI de acciones masivas
    updateBulkActionsUI();
}

/**
 * Actualizar UI de acciones masivas
 */
function updateBulkActionsUI() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const bulkActionsBtn = document.getElementById('bulk-actions-btn');
    
    if (bulkActionsBtn) {
        if (checkedBoxes.length > 0) {
            bulkActionsBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            bulkActionsBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            bulkActionsBtn.innerHTML = `
                <i data-lucide="settings" class="w-4 h-4"></i>
                <span>Acciones (${checkedBoxes.length})</span>
            `;
        } else {
            bulkActionsBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            bulkActionsBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            bulkActionsBtn.innerHTML = `
                <i data-lucide="settings" class="w-4 h-4"></i>
                <span>Acciones masivas</span>
            `;
        }
    }
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Mostrar áreas asignadas de un usuario
 */
function showUserAreas(userId) {
    const user = adminState.usuarios.find(u => u.id === userId);
    if (!user) {
        showToast('Usuario no encontrado', 'error');
        return;
    }
    
    const userAreas = adminState.permisos.filter(p => 
        p.usuario_id === userId && p.estado === 'ACTIVO'
    );
    
    const areasContent = userAreas.length > 0 ? `
        <div class="space-y-3">
            ${userAreas.map(permission => `
                <div class="border rounded-lg p-3 bg-gray-50">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-3">
                            <div class="w-3 h-3 rounded-full" style="background-color: ${permission.areas?.color_hex || '#6B7280'}"></div>
                            <div>
                                <h4 class="font-medium text-gray-900">${permission.areas?.nombre || 'Área desconocida'}</h4>
                                <p class="text-sm text-gray-500">${permission.areas?.clave || ''}</p>
                            </div>
                        </div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColorClass(permission.rol)}">
                            ${getRoleName(permission.rol)}
                        </span>
                    </div>
                    
                    <div class="flex items-center space-x-4 text-xs text-gray-600">
                        <div class="flex items-center space-x-1">
                            <i data-lucide="${permission.puede_capturar ? 'check' : 'x'}" class="w-3 h-3 ${permission.puede_capturar ? 'text-green-600' : 'text-red-600'}"></i>
                            <span>Capturar</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <i data-lucide="${permission.puede_editar ? 'check' : 'x'}" class="w-3 h-3 ${permission.puede_editar ? 'text-green-600' : 'text-red-600'}"></i>
                            <span>Editar</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <i data-lucide="${permission.puede_eliminar ? 'check' : 'x'}" class="w-3 h-3 ${permission.puede_eliminar ? 'text-green-600' : 'text-red-600'}"></i>
                            <span>Eliminar</span>
                        </div>
                    </div>
                    
                    <div class="mt-2 text-xs text-gray-400">
                        Asignado: ${formatDate(permission.fecha_asignacion, 'short')}
                    </div>
                    
                    <div class="mt-2 flex justify-end">
                        <button 
                            onclick="removeUserFromArea('${permission.id}')"
                            class="text-red-600 hover:text-red-800 text-xs"
                        >
                            <i data-lucide="trash-2" class="w-3 h-3 inline mr-1"></i>
                            Remover
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="text-center py-8">
            <i data-lucide="folder-x" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
            <p class="text-gray-500 mb-2">Sin áreas asignadas</p>
            <p class="text-sm text-gray-400">Este usuario no tiene áreas asignadas actualmente</p>
        </div>
    `;
    
    showModal({
        title: `Áreas de ${user.nombre_completo || user.email}`,
        content: `
            <div class="space-y-4">
                <div class="bg-blue-50 p-3 rounded-lg">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-blue-800">Total de áreas:</span>
                        <span class="font-medium text-blue-900">${userAreas.length}</span>
                    </div>
                </div>
                
                ${areasContent}
            </div>
        `,
        actions: [
            {
                text: 'Asignar Nueva Área',
                handler: () => {
                    hideModal();
                    setTimeout(() => showQuickAssignModal(), 100);
                    return true;
                }
            },
            {
                text: 'Cerrar',
                primary: true,
                handler: () => true
            }
        ]
    });
    
    // Recrear iconos
    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 10);
}

/**
 * Remover usuario de un área específica
 */
async function removeUserFromArea(assignmentId) {
    if (!validateAdminPermission('remove_user_area')) return;
    
    try {
        const assignment = adminState.permisos.find(p => p.id === assignmentId);
        if (!assignment) {
            throw new Error('Asignación no encontrada');
        }
        
        const user = adminState.usuarios.find(u => u.id === assignment.usuario_id);
        const area = adminState.areas.find(a => a.id === assignment.area_id);
        
        const confirmed = await showConfirmModal(
            `¿Está seguro que desea remover a "${user?.nombre_completo || 'Usuario'}" del área "${area?.nombre || 'Área'}"?`,
            {
                title: 'Confirmar remoción',
                confirmText: 'Remover',
                type: 'warning'
            }
        );
        
        if (!confirmed) return;
        
        showLoading('Removiendo asignación...');
        
        // Actualizar estado de la asignación
        await updateData('usuario_areas', 
            { 
                estado: 'INACTIVO',
                fecha_actualizacion: new Date().toISOString()
            },
            { id: assignmentId }
        );
        
        // Registrar en auditoría
        await registrarAuditoria({
            tabla_afectada: 'usuario_areas',
            registro_id: assignmentId,
            operacion: 'UPDATE',
            datos_anteriores: assignment,
            datos_nuevos: { estado: 'INACTIVO' },
            campos_modificados: 'estado',
            observaciones: `Usuario ${user?.nombre_completo} removido del área ${area?.nombre} por administrador`
        });
        
        // Actualizar estado local
        adminState.permisos = adminState.permisos.filter(p => p.id !== assignmentId);
        
        updatePermissionsTable();
        updateSystemCounts();
        
        // Cerrar modal actual y mostrar mensaje
        hideModal();
        showToast('Asignación removida correctamente', 'success');
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error al remover asignación:', error);
        showToast(error.message || 'Error al remover la asignación', 'error');
        hideLoading();
    }
}

/**
 * Exportar datos de usuarios
 */
function exportUsersData() {
    if (!validateAdminPermission('export_users')) return;
    
    try {
        const filteredUsers = getFilteredUsers();
        
        const exportData = filteredUsers.map(user => {
            const userAreas = adminState.permisos.filter(p => 
                p.usuario_id === user.id && p.estado === 'ACTIVO'
            );
            
            return {
                'Email': user.email,
                'Nombre Completo': user.nombre_completo || '',
                'Rol Principal': getRoleName(user.rol_principal),
                'Puesto': user.puesto || '',
                'Teléfono': user.telefono || '',
                'Estado': user.estado,
                'Áreas Asignadas': userAreas.length,
                'Áreas': userAreas.map(p => p.areas?.nombre || '').join(', '),
                'Último Acceso': user.ultimo_acceso ? formatDate(user.ultimo_acceso, 'long') : 'Nunca',
                'Fecha Registro': user.fecha_creacion ? formatDate(user.fecha_creacion, 'long') : ''
            };
        });
        
        const filename = `AIFA_usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
        exportToCSV(exportData, filename);
        
        showToast('Datos de usuarios exportados correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al exportar usuarios:', error);
        showToast('Error al exportar los datos', 'error');
    }
}

/**
 * Obtener nombre legible del rol
 */
function getRoleName(role) {
    const roleNames = {
        'ADMIN': 'Administrador',
        'DIRECTOR': 'Director',
        'SUBDIRECTOR': 'Subdirector', 
        'JEFE_AREA': 'Jefe de Área',
        'CAPTURISTA': 'Capturista'
    };
    
    return roleNames[role] || role;
}
/**
 * NUEVA FUNCIÓN - Handler para acciones masivas de usuarios
 */
function handleBulkActions() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showToast('Seleccione al menos un usuario', 'warning');
        return;
    }
    
    showModal({
        title: `Acciones Masivas (${selectedIds.length} usuarios)`,
        content: `
            <div class="space-y-4">
                <div class="bg-blue-50 p-3 rounded-lg">
                    <p class="text-sm text-blue-800">
                        Usuarios seleccionados: <strong>${selectedIds.length}</strong>
                    </p>
                </div>
                
                <div class="space-y-3">
                    <button 
                        onclick="handleBulkStatusChange('ACTIVO')" 
                        class="w-full text-left px-4 py-3 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors"
                    >
                        <div class="flex items-center space-x-3">
                            <i data-lucide="user-check" class="w-5 h-5"></i>
                            <div>
                                <div class="font-medium">Activar usuarios</div>
                                <div class="text-sm opacity-75">Cambiar estado a ACTIVO</div>
                            </div>
                        </div>
                    </button>
                    
                    <button 
                        onclick="handleBulkStatusChange('INACTIVO')" 
                        class="w-full text-left px-4 py-3 bg-orange-50 text-orange-800 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                        <div class="flex items-center space-x-3">
                            <i data-lucide="user-x" class="w-5 h-5"></i>
                            <div>
                                <div class="font-medium">Desactivar usuarios</div>
                                <div class="text-sm opacity-75">Cambiar estado a INACTIVO</div>
                            </div>
                        </div>
                    </button>
                    
                    <button 
                        onclick="handleBulkRoleChange()" 
                        class="w-full text-left px-4 py-3 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <div class="flex items-center space-x-3">
                            <i data-lucide="shield" class="w-5 h-5"></i>
                            <div>
                                <div class="font-medium">Cambiar rol principal</div>
                                <div class="text-sm opacity-75">Asignar nuevo rol a usuarios seleccionados</div>
                            </div>
                        </div>
                    </button>
                    
                    <button 
                        onclick="handleBulkExport()" 
                        class="w-full text-left px-4 py-3 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <div class="flex items-center space-x-3">
                            <i data-lucide="download" class="w-5 h-5"></i>
                            <div>
                                <div class="font-medium">Exportar seleccionados</div>
                                <div class="text-sm opacity-75">Descargar datos de usuarios seleccionados</div>
                            </div>
                        </div>
                    </button>
                    
                    <button 
                        onclick="handleBulkDelete()" 
                        class="w-full text-left px-4 py-3 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <div class="flex items-center space-x-3">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                            <div>
                                <div class="font-medium">Eliminar usuarios</div>
                                <div class="text-sm opacity-75">Desactivar permanentemente</div>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        `,
        actions: [
            {
                text: 'Cerrar',
                primary: true,
                handler: () => true
            }
        ]
    });
    
    // Recrear iconos
    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 10);
}

/**
 * NUEVA FUNCIÓN - Handler para refresh de usuarios
 */
async function handleRefreshUsers() {
    try {
        showLoading('Actualizando usuarios...');
        await loadUsuarios();
        await loadPermisos(); // También actualizar permisos
        updateUsersTable();
        updateSystemCounts();
        showToast('Usuarios actualizados correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al actualizar usuarios:', error);
        showToast('Error al actualizar usuarios', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * NUEVA FUNCIÓN - Cambio masivo de estado
 */
async function handleBulkStatusChange(newStatus) {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar';
    const confirmed = await showConfirmModal(
        `¿Está seguro que desea ${action} ${selectedIds.length} usuarios?`,
        {
            title: `Confirmar ${action} usuarios`,
            confirmText: action === 'activar' ? 'Activar' : 'Desactivar',
            type: newStatus === 'ACTIVO' ? 'info' : 'warning'
        }
    );
    
    if (!confirmed) return;
    
    try {
        showLoading(`${action === 'activar' ? 'Activando' : 'Desactivando'} usuarios...`);
        
        // Actualizar todos los usuarios seleccionados
        await updateData('perfiles', 
            { 
                estado: newStatus,
                fecha_actualizacion: new Date().toISOString()
            },
            { id: selectedIds }
        );
        
        // Si se desactivan, también desactivar sus asignaciones
        if (newStatus === 'INACTIVO') {
            await updateData('usuario_areas', 
                { 
                    estado: 'INACTIVO',
                    fecha_actualizacion: new Date().toISOString()
                },
                { usuario_id: selectedIds, estado: 'ACTIVO' }
            );
        }
        
        // Registrar en auditoría para cada usuario
        for (const userId of selectedIds) {
            const user = adminState.usuarios.find(u => u.id === userId);
            await registrarAuditoria({
                tabla_afectada: 'perfiles',
                registro_id: userId,
                operacion: 'UPDATE',
                datos_anteriores: user,
                datos_nuevos: { estado: newStatus },
                campos_modificados: 'estado',
                observaciones: `Usuario ${action} masivamente por administrador`
            });
        }
        
        // Actualizar estado local
        selectedIds.forEach(userId => {
            const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                adminState.usuarios[userIndex].estado = newStatus;
            }
        });
        
        // Si se desactivaron, remover de permisos locales
        if (newStatus === 'INACTIVO') {
            adminState.permisos = adminState.permisos.filter(p => !selectedIds.includes(p.usuario_id));
            updatePermissionsTable();
        }
        
        updateUsersTable();
        updateSystemCounts();
        
        // Limpiar selecciones
        const selectAllCheckbox = document.getElementById('select-all-users');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        
        hideModal();
        showToast(`${selectedIds.length} usuarios ${action === 'activar' ? 'activados' : 'desactivados'} correctamente`, 'success');
        
    } catch (error) {
        console.error(`❌ Error en cambio masivo de estado:`, error);
        showToast(`Error al ${action} usuarios`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * NUEVA FUNCIÓN - Cambio masivo de rol
 */
function handleBulkRoleChange() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    hideModal(); // Cerrar modal actual
    
    setTimeout(() => {
        showModal({
            title: `Cambiar Rol - ${selectedIds.length} usuarios`,
            content: `
                <form id="bulk-role-form" class="space-y-4">
                    <div>
                        <label for="bulk-new-role" class="block text-sm font-medium text-gray-700 mb-1">
                            Nuevo Rol Principal <span class="text-red-500">*</span>
                        </label>
                        <select 
                            id="bulk-new-role" 
                            name="rol_principal" 
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-transparent"
                        >
                            <option value="">Seleccionar nuevo rol...</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="DIRECTOR">Director</option>
                            <option value="SUBDIRECTOR">Subdirector</option>
                            <option value="JEFE_AREA">Jefe de Área</option>
                            <option value="CAPTURISTA">Capturista</option>
                        </select>
                    </div>
                    
                    <div class="bg-yellow-50 p-3 rounded-lg">
                        <div class="flex items-start space-x-2">
                            <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-600 mt-0.5"></i>
                            <div class="text-sm text-yellow-800">
                                <p class="font-medium">Advertencia:</p>
                                <p>El cambio de rol afectará los permisos de acceso de los usuarios seleccionados.</p>
                            </div>
                        </div>
                    </div>
                    
                    <input type="hidden" name="selected_ids" value="${selectedIds.join(',')}">
                </form>
            `,
            actions: [
                {
                    text: 'Cancelar',
                    handler: () => true
                },
                {
                    text: 'Cambiar Rol',
                    primary: true,
                    handler: async () => {
                        await processBulkRoleChange();
                        return false;
                    }
                }
            ]
        });
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, 100);
}

/**
 * NUEVA FUNCIÓN - Procesar cambio masivo de rol
 */
async function processBulkRoleChange() {
    try {
        const form = document.getElementById('bulk-role-form');
        if (!form) return;
        
        const formData = getFormData(form);
        const selectedIds = formData.selected_ids.split(',');
        const newRole = formData.rol_principal;
        
        if (!newRole) {
            showToast('Seleccione el nuevo rol', 'error');
            return;
        }
        
        showLoading('Actualizando roles...');
        
        // Actualizar roles
        await updateData('perfiles', 
            { 
                rol_principal: newRole,
                fecha_actualizacion: new Date().toISOString()
            },
            { id: selectedIds }
        );
        
        // Registrar en auditoría
        for (const userId of selectedIds) {
            const user = adminState.usuarios.find(u => u.id === userId);
            await registrarAuditoria({
                tabla_afectada: 'perfiles',
                registro_id: userId,
                operacion: 'UPDATE',
                datos_anteriores: user,
                datos_nuevos: { rol_principal: newRole },
                campos_modificados: 'rol_principal',
                observaciones: `Rol cambiado masivamente a ${getRoleName(newRole)} por administrador`
            });
        }
        
        // Actualizar estado local
        selectedIds.forEach(userId => {
            const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                adminState.usuarios[userIndex].rol_principal = newRole;
            }
        });
        
        updateUsersTable();
        
        // Limpiar selecciones
        const selectAllCheckbox = document.getElementById('select-all-users');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        
        hideModal();
        showToast(`Rol actualizado para ${selectedIds.length} usuarios`, 'success');
        
    } catch (error) {
        console.error('❌ Error al cambiar roles:', error);
        showToast('Error al cambiar los roles', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * NUEVA FUNCIÓN - Exportar usuarios seleccionados
 */
function handleBulkExport() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    try {
        const selectedUsers = adminState.usuarios.filter(u => selectedIds.includes(u.id));
        
        const exportData = selectedUsers.map(user => {
            const userAreas = adminState.permisos.filter(p => 
                p.usuario_id === user.id && p.estado === 'ACTIVO'
            );
            
            return {
                'Email': user.email,
                'Nombre Completo': user.nombre_completo || '',
                'Rol Principal': getRoleName(user.rol_principal),
                'Puesto': user.puesto || '',
                'Teléfono': user.telefono || '',
                'Estado': user.estado,
                'Áreas Asignadas': userAreas.length,
                'Áreas': userAreas.map(p => p.areas?.nombre || '').join(', '),
                'Último Acceso': user.ultimo_acceso ? formatDate(user.ultimo_acceso, 'long') : 'Nunca',
                'Fecha Registro': user.fecha_creacion ? formatDate(user.fecha_creacion, 'long') : ''
            };
        });
        
        const filename = `AIFA_usuarios_seleccionados_${new Date().toISOString().slice(0, 10)}.csv`;
        exportToCSV(exportData, filename);
        
        hideModal();
        showToast(`${selectedIds.length} usuarios exportados correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error al exportar usuarios:', error);
        showToast('Error al exportar usuarios', 'error');
    }
}

/**
 * NUEVA FUNCIÓN - Eliminar usuarios masivamente
 */
async function handleBulkDelete() {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) return;
    
    const confirmed = await showConfirmModal(
        `¿Está seguro que desea ELIMINAR ${selectedIds.length} usuarios?\n\nEsta acción desactivará permanentemente a los usuarios y eliminará todas sus asignaciones de área.`,
        {
            title: 'Confirmar eliminación masiva',
            confirmText: 'Eliminar',
            type: 'danger'
        }
    );
    
    if (!confirmed) return;
    
    try {
        showLoading('Eliminando usuarios...');
        
        // Desactivar usuarios
        await updateData('perfiles', 
            { 
                estado: 'INACTIVO',
                fecha_actualizacion: new Date().toISOString()
            },
            { id: selectedIds }
        );
        
        // Desactivar todas sus asignaciones
        await updateData('usuario_areas', 
            { 
                estado: 'INACTIVO',
                fecha_actualizacion: new Date().toISOString()
            },
            { usuario_id: selectedIds, estado: 'ACTIVO' }
        );
        
        // Registrar en auditoría
        for (const userId of selectedIds) {
            const user = adminState.usuarios.find(u => u.id === userId);
            await registrarAuditoria({
                tabla_afectada: 'perfiles',
                registro_id: userId,
                operacion: 'UPDATE',
                datos_anteriores: user,
                datos_nuevos: { estado: 'INACTIVO' },
                campos_modificados: 'estado',
                observaciones: `Usuario eliminado masivamente por administrador - Se desactivaron todas sus asignaciones`
            });
        }
        
        // Actualizar estado local
        selectedIds.forEach(userId => {
            const userIndex = adminState.usuarios.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                adminState.usuarios[userIndex].estado = 'INACTIVO';
            }
        });
        
        // Remover de permisos locales
        adminState.permisos = adminState.permisos.filter(p => !selectedIds.includes(p.usuario_id));
        
        updateUsersTable();
        updatePermissionsTable();
        updateSystemCounts();
        
        // Limpiar selecciones
        const selectAllCheckbox = document.getElementById('select-all-users');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        
        hideModal();
        showToast(`${selectedIds.length} usuarios eliminados correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error en eliminación masiva:', error);
        showToast('Error al eliminar usuarios', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * NUEVA FUNCIÓN - Función utilitaria para debounce
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
// =====================================================
// FUNCIÓN PARA ACTUALIZAR ESTADÍSTICAS DE USUARIOS
// =====================================================

/**
 * NUEVA FUNCIÓN - Actualizar estadísticas en tiempo real
 */
function updateUserStats() {
    const totalUsersElement = document.getElementById('total-users-stat');
    const activeUsersElement = document.getElementById('active-users-stat');
    const adminUsersElement = document.getElementById('admin-users-stat');
    const assignedUsersElement = document.getElementById('assigned-users-stat');
    const lastUpdateElement = document.getElementById('users-last-update');
    
    if (totalUsersElement) {
        totalUsersElement.textContent = adminState.usuarios.length;
    }
    
    if (activeUsersElement) {
        activeUsersElement.textContent = adminState.usuarios.filter(u => u.estado === 'ACTIVO').length;
    }
    
    if (adminUsersElement) {
        adminUsersElement.textContent = adminState.usuarios.filter(u => u.rol_principal === 'ADMIN').length;
    }
    
    if (assignedUsersElement) {
        const uniqueAssignedUsers = new Set(
            adminState.permisos.filter(p => p.estado === 'ACTIVO').map(p => p.usuario_id)
        );
        assignedUsersElement.textContent = uniqueAssignedUsers.size;
    }
    
    if (lastUpdateElement) {
        lastUpdateElement.textContent = new Date().toLocaleString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
// =====================================================
// FUNCIÓN AUXILIAR PARA FORMATEAR FECHAS
// =====================================================

/**
 * NUEVA FUNCIÓN - Formatear fecha de forma amigable
 */
function formatFriendlyDate(dateString) {
    if (!dateString) return 'No disponible';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
        return 'Hoy';
    } else if (diffInDays === 1) {
        return 'Ayer';
    } else if (diffInDays < 7) {
        return `Hace ${diffInDays} días`;
    } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return `Hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
    } else if (diffInDays < 365) {
        const months = Math.floor(diffInDays / 30);
        return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
    } else {
        const years = Math.floor(diffInDays / 365);
        return `Hace ${years} año${years > 1 ? 's' : ''}`;
    }
}
