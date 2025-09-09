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
        
        showLoading('Cargando panel de administración...');
        
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
        const { data } = await selectData('perfiles', {
           select: '*',
            orderBy: { column: 'fecha_creacion', ascending: false }
        });
        
        adminState.usuarios = data || [];
        
    } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
        adminState.usuarios = [];
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
                        Administre los usuarios del sistema y sus roles principales
                    </p>
                </div>
                
                <div class="flex items-center space-x-3">
                    <button 
                        id="invite-user-btn"
                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        <span>Invitar usuario</span>
                    </button>
                    
                    <button 
                        id="bulk-actions-btn"
                        class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        <span>Acciones masivas</span>
                    </button>
                </div>
            </div>
            
            <!-- Búsqueda y filtros de usuarios -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <div class="relative">
                            <input 
                                type="text" 
                                id="users-search"
                                placeholder="Buscar por nombre o email..."
                                class="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                            <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
                        </div>
                        
                        <select 
                            id="users-role-filter"
                            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Todos los roles</option>
                            ${Object.entries(ROLES).map(([key, role]) => `
                                <option value="${key}">${role.name}</option>
                            `).join('')}
                        </select>
                        
                        <select 
                            id="users-status-filter"
                            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="ACTIVO">Solo activos</option>
                            <option value="INACTIVO">Solo inactivos</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-600">
                            ${adminState.usuarios.length} usuario${adminState.usuarios.length !== 1 ? 's' : ''}
                        </span>
                        <button 
                            id="refresh-users-btn"
                            class="bg-white border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50"
                            title="Actualizar lista"
                        >
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de usuarios -->
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div id="users-table-container">
                    ${createUsersTableHTML()}
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
            setupUsersEventListeners();
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
    // Botón de ayuda
    const helpBtn = document.getElementById('admin-help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', showAdminHelp);
    }
    
    // Configurar sección inicial
    const activeTab = document.getElementById(`section-${adminState.currentSection}`);
    if (activeTab) {
        activeTab.classList.add('border-purple-500', 'text-purple-600');
    }
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
 * Manejar refresh de usuarios
 */
async function handleRefreshUsers() {
    try {
        const refreshBtn = document.getElementById('refresh-users-btn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('animate-spin');
        }
        
        await loadUsuarios();
        updateUsersTable();
        updateSystemCounts();
        
        showToast('Lista de usuarios actualizada', 'success');
        
    } catch (error) {
        console.error('❌ Error al refrescar usuarios:', error);
        showToast('Error al actualizar los usuarios', 'error');
    }
}

/**
 * Manejar selección de todos los usuarios
 */
function handleSelectAllUsers(e) {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
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
 * Manejar asignación rápida
 */
async function handleQuickAssign() {
    const email = document.getElementById('quick-assign-email')?.value.trim();
    const areaId = document.getElementById('quick-assign-area')?.value;
    const rol = document.getElementById('quick-assign-role')?.value;
    
    if (!email || !areaId || !rol) {
        showToast('Complete todos los campos para la asignación', 'warning');
        return;
    }
    
    // Validar email del dominio
    if (!VALIDATION.email.pattern.test(email)) {
        showToast('El email debe ser del dominio @aifa.aero', 'error');
        return;
    }
    
    try {
        // Buscar usuario por email
        const { data: usuarios } = await selectData('perfiles', {
            select: '*',
            filters: { email: email }
        });
        
        if (!usuarios || usuarios.length === 0) {
            showToast('Usuario no encontrado. Debe estar registrado en el sistema primero.', 'error');
            return;
        }
        
        const usuario = usuarios[0];
        
        // Verificar si ya existe la asignación
        const { data: existingAssignment } = await selectData('usuario_areas', {
            select: '*',
            filters: { 
                usuario_id: usuario.id,
                area_id: areaId,
                estado: 'ACTIVO'
            }
        });
        
        if (existingAssignment && existingAssignment.length > 0) {
            showToast('El usuario ya tiene una asignación activa en esta área', 'warning');
            return;
        }
        
        // Crear asignación
        const assignmentData = {
            usuario_id: usuario.id,
            area_id: areaId,
            rol: rol,
            puede_capturar: true,
            puede_editar: ['JEFE_AREA', 'SUBDIRECTOR', 'DIRECTOR', 'ADMIN'].includes(rol),
            puede_eliminar: ['SUBDIRECTOR', 'DIRECTOR', 'ADMIN'].includes(rol),
            asignado_por: adminState.userProfile.id,
            estado: 'ACTIVO'
        };
        
        await insertData('usuario_areas', assignmentData);
        
        showToast('Asignación creada correctamente', 'success');
        
        // Limpiar formulario
        document.getElementById('quick-assign-email').value = '';
        document.getElementById('quick-assign-area').value = '';
        document.getElementById('quick-assign-role').value = '';
        
        // Actualizar datos
        await loadPermisos();
        updatePermissionsTable();
        updateSystemCounts();
        
    } catch (error) {
        console.error('❌ Error en asignación rápida:', error);
        showToast('Error al crear la asignación', 'error');
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
