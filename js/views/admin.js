// js/views/admin.js
// =====================================================
// PANEL DE ADMINISTRACIÓN - SISTEMA COMPLETO
// =====================================================

import { supabase } from '../lib/supa.js';
import { UI } from '../lib/ui.js';

// Estado del panel de administración
const adminState = {
    userProfile: null,
    currentSection: 'areas', // 'areas', 'users', 'permissions'
    areas: [],
    usuarios: [],
    permisos: [],
    indicadores: [],
    searchTerm: '',
    editingItem: null,
    loading: false,
    filters: {
        areas: { status: 'all', search: '' },
        users: { role: 'all', status: 'all', search: '' },
        permissions: { area: 'all', role: 'all', search: '' }
    }
};

export class AdminView {
    constructor() {
        this.areas = [];
        this.usuarios = [];
        this.indicadores = [];
        this.permisos = [];
        this.currentArea = null;
        this.currentUsuario = null;
        this.currentPermiso = null;
        this.filters = adminState.filters;
    }

    async render() {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) {
            window.location.href = '/';
            return '';
        }

        // Verificar si es admin
        const { data: profile } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profile?.rol !== 'admin') {
            return UI.alert('No tienes permisos para acceder a esta sección', 'danger');
        }

        adminState.userProfile = profile;
        await this.loadInitialData();

        return `
            <div class="container-fluid px-4">
                <h1 class="mt-4">Panel de Administración</h1>
                <ol class="breadcrumb mb-4">
                    <li class="breadcrumb-item"><a href="#/">Dashboard</a></li>
                    <li class="breadcrumb-item active">Administración</li>
                </ol>

                <!-- Tarjetas de estadísticas -->
                <div class="row" id="stats-cards">
                    ${this.renderStatsCards()}
                </div>

                <!-- Navegación por pestañas -->
                <div class="card mb-4">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active section-tab" id="section-areas" 
                                   data-section="areas" href="#" onclick="adminView.switchSection('areas'); return false;">
                                    <i class="fas fa-building"></i> Gestión de Áreas
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link section-tab" id="section-users" 
                                   data-section="users" href="#" onclick="adminView.switchSection('users'); return false;">
                                    <i class="fas fa-users"></i> Gestión de Usuarios
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link section-tab" id="section-permissions" 
                                   data-section="permissions" href="#" onclick="adminView.switchSection('permissions'); return false;">
                                    <i class="fas fa-lock"></i> Permisos y Asignaciones
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div id="section-content">
                            ${this.renderSectionContent()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modales -->
            ${this.renderModals()}
        `;
    }

    renderStatsCards() {
        const activeAreas = this.areas.filter(a => a.estado === 'ACTIVO').length;
        const activeUsers = this.usuarios.filter(u => u.activo).length;
        const totalPermisos = this.permisos.length;
        const totalIndicadores = this.indicadores.length;

        return `
            <div class="col-xl-3 col-md-6">
                <div class="card bg-primary text-white mb-4">
                    <div class="card-body">
                        <div class="row">
                            <div class="col">
                                <div class="text-white-50 small">Áreas Activas</div>
                                <div class="h4" id="total-areas-count">${activeAreas}</div>
                                <div class="text-white-50 small">Total: ${this.areas.length}</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-building fa-2x opacity-50"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-success text-white mb-4">
                    <div class="card-body">
                        <div class="row">
                            <div class="col">
                                <div class="text-white-50 small">Usuarios Activos</div>
                                <div class="h4" id="total-users-count">${activeUsers}</div>
                                <div class="text-white-50 small">Total: ${this.usuarios.length}</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-users fa-2x opacity-50"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-info text-white mb-4">
                    <div class="card-body">
                        <div class="row">
                            <div class="col">
                                <div class="text-white-50 small">Total Indicadores</div>
                                <div class="h4">${totalIndicadores}</div>
                                <div class="text-white-50 small">En todas las áreas</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-chart-line fa-2x opacity-50"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-warning text-white mb-4">
                    <div class="card-body">
                        <div class="row">
                            <div class="col">
                                <div class="text-white-50 small">Asignaciones</div>
                                <div class="h4" id="total-permissions-count">${totalPermisos}</div>
                                <div class="text-white-50 small">Usuarios con área</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-user-tag fa-2x opacity-50"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSectionContent() {
        switch (adminState.currentSection) {
            case 'areas':
                return this.createAreasContentHTML();
            case 'users':
                return this.createUsersContentHTML();
            case 'permissions':
                return this.createPermissionsContentHTML();
            default:
                return this.createAreasContentHTML();
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadAreas(),
                this.loadUsuarios(),
                this.loadIndicadores(),
                this.loadPermisos()
            ]);
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            UI.showToast('Error al cargar los datos', 'error');
        }
    }

    async loadAreas() {
        const { data: areas, error } = await supabase
            .from('areas')
            .select('*')
            .order('nombre');
        
        if (error) {
            console.error('Error cargando áreas:', error);
            return;
        }
        
        this.areas = areas || [];
        adminState.areas = this.areas;
    }

    async loadUsuarios() {
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select(`
                *,
                areas (
                    id,
                    nombre,
                    clave,
                    color_hex
                )
            `)
            .order('nombre');
        
        if (error) {
            console.error('Error cargando usuarios:', error);
            return;
        }
        
        this.usuarios = usuarios || [];
        adminState.usuarios = this.usuarios;
    }

    async loadIndicadores() {
        const { data: indicadores, error } = await supabase
            .from('indicadores')
            .select('*')
            .order('nombre');
        
        if (error) {
            console.error('Error cargando indicadores:', error);
            return;
        }
        
        this.indicadores = indicadores || [];
        adminState.indicadores = this.indicadores;
    }

    async loadPermisos() {
        const { data: permisos, error } = await supabase
            .from('usuario_areas')
            .select(`
                *,
                usuarios (
                    id,
                    email,
                    nombre
                ),
                areas (
                    id,
                    nombre,
                    clave
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error cargando permisos:', error);
            return;
        }
        
        this.permisos = permisos || [];
        adminState.permisos = this.permisos;
    }
    // ========== RENDERIZADO DE SECCIÓN DE ÁREAS ==========
    
    createAreasContentHTML() {
        return `
            <div class="space-y-6">
                <!-- Barra de herramientas -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="fas fa-search"></i>
                            </span>
                            <input 
                                type="text" 
                                class="form-control" 
                                id="areas-search" 
                                placeholder="Buscar áreas por nombre o clave..."
                                value="${this.filters.areas.search}"
                            >
                        </div>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="areas-status-filter">
                            <option value="all">Todos los estados</option>
                            <option value="ACTIVO">Activas</option>
                            <option value="INACTIVO">Inactivas</option>
                        </select>
                    </div>
                    <div class="col-md-3 text-end">
                        <button class="btn btn-success" id="add-area-btn" onclick="adminView.showAddAreaModal()">
                            <i class="fas fa-plus"></i> Nueva Área
                        </button>
                        <button class="btn btn-outline-secondary ms-2" id="refresh-areas-btn" onclick="adminView.handleRefreshAreas()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Tabla de áreas -->
                <div id="areas-table-container">
                    ${this.createAreasTableHTML()}
                </div>
            </div>
        `;
    }

    createAreasTableHTML() {
        const filteredAreas = this.getFilteredAreas();
        
        if (filteredAreas.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="fas fa-building fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No se encontraron áreas con los filtros aplicados</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th width="100">Clave</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th width="100">Color</th>
                            <th width="100">Estado</th>
                            <th width="120">Indicadores</th>
                            <th width="100">Usuarios</th>
                            <th width="120">Creación</th>
                            <th width="120" class="text-end">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredAreas.map(area => this.createAreaRowHTML(area)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    createAreaRowHTML(area) {
        const indicadoresCount = this.indicadores.filter(i => i.area_id === area.id).length;
        const usuariosCount = this.usuarios.filter(u => u.area_id === area.id).length;
        const fechaCreacion = area.created_at ? new Date(area.created_at).toLocaleDateString('es-MX') : 'N/A';

        return `
            <tr>
                <td>
                    <span class="badge bg-secondary">${area.clave}</span>
                </td>
                <td>
                    <strong>${area.nombre}</strong>
                </td>
                <td>
                    <small class="text-muted">${area.descripcion || 'Sin descripción'}</small>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="color-badge me-2" style="
                            width: 24px; 
                            height: 24px; 
                            background-color: ${area.color_hex}; 
                            border-radius: 4px;
                            border: 1px solid #dee2e6;
                        "></div>
                        <small>${area.color_hex}</small>
                    </div>
                </td>
                <td>
                    <span class="badge bg-${area.estado === 'ACTIVO' ? 'success' : 'secondary'}">
                        ${area.estado}
                    </span>
                </td>
                <td>
                    <span class="text-muted">${indicadoresCount} indicador${indicadoresCount !== 1 ? 'es' : ''}</span>
                </td>
                <td>
                    <span class="text-muted">${usuariosCount} usuario${usuariosCount !== 1 ? 's' : ''}</span>
                </td>
                <td>
                    <small class="text-muted">${fechaCreacion}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button 
                            class="btn btn-outline-info" 
                            onclick="adminView.viewAreaDetails('${area.id}')"
                            title="Ver detalles"
                        >
                            <i class="fas fa-eye"></i>
                        </button>
                        <button 
                            class="btn btn-outline-primary" 
                            onclick="adminView.editArea('${area.id}')"
                            title="Editar"
                        >
                            <i class="fas fa-edit"></i>
                        </button>
                        <button 
                            class="btn btn-outline-warning" 
                            onclick="adminView.toggleAreaStatus('${area.id}', '${area.estado}')"
                            title="${area.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}"
                        >
                            <i class="fas fa-${area.estado === 'ACTIVO' ? 'toggle-on' : 'toggle-off'}"></i>
                        </button>
                        <button 
                            class="btn btn-outline-danger" 
                            onclick="adminView.deleteArea('${area.id}', '${area.nombre}')"
                            title="Eliminar"
                            ${indicadoresCount > 0 || usuariosCount > 0 ? 'disabled' : ''}
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getFilteredAreas() {
        let filtered = this.areas;
        
        // Filtrar por búsqueda
        const searchTerm = document.getElementById('areas-search')?.value?.toLowerCase() || this.filters.areas.search;
        if (searchTerm) {
            filtered = filtered.filter(area => 
                area.nombre.toLowerCase().includes(searchTerm) ||
                area.clave.toLowerCase().includes(searchTerm) ||
                (area.descripcion && area.descripcion.toLowerCase().includes(searchTerm))
            );
        }
        
        // Filtrar por estado
        const statusFilter = document.getElementById('areas-status-filter')?.value || 'all';
        if (statusFilter !== 'all') {
            filtered = filtered.filter(area => area.estado === statusFilter);
        }
        
        return filtered;
    }

    // ========== HANDLERS DE ÁREAS ==========

    async handleRefreshAreas() {
        try {
            const refreshBtn = document.getElementById('refresh-areas-btn');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.add('fa-spin');
            }
            
            await this.loadAreas();
            await this.loadIndicadores();
            await this.loadUsuarios();
            
            document.getElementById('areas-table-container').innerHTML = this.createAreasTableHTML();
            this.updateSystemCounts();
            
            UI.showToast('Lista de áreas actualizada', 'success');
            
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.remove('fa-spin');
            }
        } catch (error) {
            console.error('Error al refrescar áreas:', error);
            UI.showToast('Error al actualizar las áreas', 'error');
        }
    }

    showAddAreaModal() {
        this.currentArea = null;
        this.showModalArea();
    }

    async viewAreaDetails(areaId) {
        const area = this.areas.find(a => a.id === areaId);
        if (!area) {
            UI.showToast('Área no encontrada', 'error');
            return;
        }

        const indicadores = this.indicadores.filter(i => i.area_id === areaId);
        const usuarios = this.usuarios.filter(u => u.area_id === areaId);

        const modalContent = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Clave:</strong> ${area.clave}</p>
                    <p><strong>Nombre:</strong> ${area.nombre}</p>
                    <p><strong>Estado:</strong> <span class="badge bg-${area.estado === 'ACTIVO' ? 'success' : 'secondary'}">${area.estado}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Color:</strong> <span class="badge" style="background-color: ${area.color_hex}">${area.color_hex}</span></p>
                    <p><strong>Creación:</strong> ${new Date(area.created_at).toLocaleDateString('es-MX')}</p>
                </div>
            </div>
            <hr>
            <p><strong>Descripción:</strong><br>${area.descripcion || 'Sin descripción'}</p>
            <hr>
            <div class="row">
                <div class="col-md-6">
                    <h6>Indicadores (${indicadores.length})</h6>
                    ${indicadores.length > 0 ? `
                        <ul class="list-unstyled">
                            ${indicadores.slice(0, 5).map(i => `<li>• ${i.nombre}</li>`).join('')}
                            ${indicadores.length > 5 ? `<li class="text-muted">... y ${indicadores.length - 5} más</li>` : ''}
                        </ul>
                    ` : '<p class="text-muted">Sin indicadores asignados</p>'}
                </div>
                <div class="col-md-6">
                    <h6>Usuarios Asignados (${usuarios.length})</h6>
                    ${usuarios.length > 0 ? `
                        <ul class="list-unstyled">
                            ${usuarios.slice(0, 5).map(u => `<li>• ${u.nombre || u.email}</li>`).join('')}
                            ${usuarios.length > 5 ? `<li class="text-muted">... y ${usuarios.length - 5} más</li>` : ''}
                        </ul>
                    ` : '<p class="text-muted">Sin usuarios asignados</p>'}
                </div>
            </div>
        `;

        UI.showModal({
            title: `Detalles del Área: ${area.nombre}`,
            content: modalContent,
            size: 'lg'
        });
    }

    async editArea(areaId) {
        this.currentArea = this.areas.find(a => a.id === areaId);
        if (this.currentArea) {
            this.showModalArea();
        }
    }

    async toggleAreaStatus(areaId, currentStatus) {
        const area = this.areas.find(a => a.id === areaId);
        if (!area) {
            UI.showToast('Área no encontrada', 'error');
            return;
        }

        const newStatus = currentStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        const action = newStatus === 'ACTIVO' ? 'activar' : 'desactivar';
        
        if (!confirm(`¿Está seguro de ${action} el área "${area.nombre}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('areas')
                .update({ estado: newStatus })
                .eq('id', areaId);
            
            if (error) throw error;
            
            UI.showToast(`Área ${newStatus === 'ACTIVO' ? 'activada' : 'desactivada'} correctamente`, 'success');
            
            area.estado = newStatus;
            document.getElementById('areas-table-container').innerHTML = this.createAreasTableHTML();
            this.updateSystemCounts();
            
        } catch (error) {
            console.error('Error al cambiar estado del área:', error);
            UI.showToast('Error al cambiar el estado del área', 'error');
        }
    }

    async deleteArea(areaId, areaNombre) {
        const indicadoresCount = this.indicadores.filter(i => i.area_id === areaId).length;
        const usuariosCount = this.usuarios.filter(u => u.area_id === areaId).length;

        if (indicadoresCount > 0 || usuariosCount > 0) {
            UI.showToast('No se puede eliminar un área con indicadores o usuarios asignados', 'warning');
            return;
        }

        if (!confirm(`¿Está seguro de eliminar el área "${areaNombre}"?\nEsta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('areas')
                .delete()
                .eq('id', areaId);
            
            if (error) throw error;
            
            UI.showToast('Área eliminada correctamente', 'success');
            
            this.areas = this.areas.filter(a => a.id !== areaId);
            adminState.areas = this.areas;
            document.getElementById('areas-table-container').innerHTML = this.createAreasTableHTML();
            this.updateSystemCounts();
            
        } catch (error) {
            console.error('Error al eliminar área:', error);
            UI.showToast('Error al eliminar el área', 'error');
        }
    }
    // ========== RENDERIZADO DE SECCIÓN DE USUARIOS ==========
    
    createUsersContentHTML() {
        return `
            <div class="space-y-6">
                <!-- Barra de herramientas -->
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="fas fa-search"></i>
                            </span>
                            <input 
                                type="text" 
                                class="form-control" 
                                id="users-search" 
                                placeholder="Buscar usuarios..."
                                value="${this.filters.users.search}"
                            >
                        </div>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" id="users-role-filter">
                            <option value="all">Todos los roles</option>
                            <option value="admin">Administrador</option>
                            <option value="director">Director</option>
                            <option value="subdirector">Subdirector</option>
                            <option value="jefe">Jefe de Área</option>
                            <option value="capturista">Capturista</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" id="users-status-filter">
                            <option value="all">Todos los estados</option>
                            <option value="true">Activos</option>
                            <option value="false">Inactivos</option>
                        </select>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-primary" id="invite-user-btn" onclick="adminView.showInviteUserModal()">
                            <i class="fas fa-paper-plane"></i> Invitar Usuario
                        </button>
                        <button class="btn btn-success ms-2" id="add-user-btn" onclick="adminView.showAddUserModal()">
                            <i class="fas fa-user-plus"></i> Nuevo Usuario
                        </button>
                        <button class="btn btn-outline-secondary ms-2" id="refresh-users-btn" onclick="adminView.handleRefreshUsers()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Checkbox para seleccionar todos -->
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="select-all-users">
                    <label class="form-check-label" for="select-all-users">
                        Seleccionar todos los usuarios visibles
                    </label>
                </div>

                <!-- Tabla de usuarios -->
                <div id="users-table-container">
                    ${this.createUsersTableHTML()}
                </div>
            </div>
        `;
    }

    createUsersTableHTML() {
        const filteredUsers = this.getFilteredUsers();
        
        if (filteredUsers.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="fas fa-users fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No se encontraron usuarios con los filtros aplicados</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th width="40">
                                <input type="checkbox" class="form-check-input" id="select-all-header">
                            </th>
                            <th>Usuario</th>
                            <th>Área</th>
                            <th>Rol Principal</th>
                            <th>Permisos</th>
                            <th width="100">Estado</th>
                            <th width="150">Último Acceso</th>
                            <th width="150" class="text-end">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredUsers.map(usuario => this.createUserRowHTML(usuario)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    createUserRowHTML(usuario) {
        const ultimoAcceso = usuario.ultimo_acceso ? 
            new Date(usuario.ultimo_acceso).toLocaleDateString('es-MX') : 
            'Nunca';
        
        const permisos = [];
        if (usuario.puede_capturar) permisos.push('C');
        if (usuario.puede_editar) permisos.push('E');
        if (usuario.puede_eliminar) permisos.push('D');

        return `
            <tr>
                <td>
                    <input type="checkbox" class="form-check-input user-checkbox" value="${usuario.id}">
                </td>
                <td>
                    <div>
                        <strong>${usuario.nombre || 'Sin nombre'}</strong>
                        <br>
                        <small class="text-muted">${usuario.email}</small>
                    </div>
                </td>
                <td>
                    ${usuario.areas ? `
                        <span class="badge" style="background-color: ${usuario.areas.color_hex}">
                            ${usuario.areas.nombre}
                        </span>
                    ` : '<span class="text-muted">Sin asignar</span>'}
                </td>
                <td>
                    <span class="badge bg-${this.getRoleBadgeColor(usuario.rol)}">
                        ${this.getRoleName(usuario.rol)}
                    </span>
                </td>
                <td>
                    ${permisos.length > 0 ? `
                        <div class="d-flex gap-1">
                            ${permisos.includes('C') ? '<span class="badge bg-success" title="Capturar">C</span>' : ''}
                            ${permisos.includes('E') ? '<span class="badge bg-warning" title="Editar">E</span>' : ''}
                            ${permisos.includes('D') ? '<span class="badge bg-danger" title="Eliminar">D</span>' : ''}
                        </div>
                    ` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">
                        ${usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <small class="text-muted">${ultimoAcceso}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button 
                            class="btn btn-outline-info" 
                            onclick="adminView.viewUserDetails('${usuario.id}')"
                            title="Ver detalles"
                        >
                            <i class="fas fa-eye"></i>
                        </button>
                        <button 
                            class="btn btn-outline-primary" 
                            onclick="adminView.editUser('${usuario.id}')"
                            title="Editar"
                        >
                            <i class="fas fa-edit"></i>
                        </button>
                        <button 
                            class="btn btn-outline-success" 
                            onclick="adminView.manageUserPermissions('${usuario.id}')"
                            title="Gestionar permisos"
                        >
                            <i class="fas fa-shield-alt"></i>
                        </button>
                        <button 
                            class="btn btn-outline-warning" 
                            onclick="adminView.toggleUserStatus('${usuario.id}', ${usuario.activo})"
                            title="${usuario.activo ? 'Desactivar' : 'Activar'}"
                        >
                            <i class="fas fa-${usuario.activo ? 'lock' : 'unlock'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getFilteredUsers() {
        let filtered = this.usuarios;
        
        // Filtrar por búsqueda
        const searchTerm = document.getElementById('users-search')?.value?.toLowerCase() || this.filters.users.search;
        if (searchTerm) {
            filtered = filtered.filter(usuario => 
                usuario.email.toLowerCase().includes(searchTerm) ||
                (usuario.nombre && usuario.nombre.toLowerCase().includes(searchTerm))
            );
        }
        
        // Filtrar por rol
        const roleFilter = document.getElementById('users-role-filter')?.value || 'all';
        if (roleFilter !== 'all') {
            filtered = filtered.filter(usuario => usuario.rol === roleFilter);
        }
        
        // Filtrar por estado
        const statusFilter = document.getElementById('users-status-filter')?.value || 'all';
        if (statusFilter !== 'all') {
            const isActive = statusFilter === 'true';
            filtered = filtered.filter(usuario => usuario.activo === isActive);
        }
        
        return filtered;
    }

    // ========== HANDLERS DE USUARIOS ==========

    async handleRefreshUsers() {
        try {
            const refreshBtn = document.getElementById('refresh-users-btn');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.add('fa-spin');
            }
            
            await this.loadUsuarios();
            
            document.getElementById('users-table-container').innerHTML = this.createUsersTableHTML();
            this.updateSystemCounts();
            
            UI.showToast('Lista de usuarios actualizada', 'success');
            
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.remove('fa-spin');
            }
        } catch (error) {
            console.error('Error al refrescar usuarios:', error);
            UI.showToast('Error al actualizar los usuarios', 'error');
        }
    }

    showInviteUserModal() {
        const modalContent = `
            <form id="inviteUserForm">
                <div class="mb-3">
                    <label for="inviteEmail" class="form-label">Email del usuario *</label>
                    <input type="email" class="form-control" id="inviteEmail" required>
                    <div class="form-text">Se enviará una invitación por email para unirse al sistema</div>
                </div>
                <div class="mb-3">
                    <label for="inviteRole" class="form-label">Rol asignado *</label>
                    <select class="form-select" id="inviteRole" required>
                        <option value="">Seleccione un rol</option>
                        <option value="capturista">Capturista</option>
                        <option value="jefe">Jefe de Área</option>
                        <option value="subdirector">Subdirector</option>
                        <option value="director">Director</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label for="inviteArea" class="form-label">Área (opcional)</label>
                    <select class="form-select" id="inviteArea">
                        <option value="">Sin asignar</option>
                        ${this.areas.filter(a => a.estado === 'ACTIVO').map(area => 
                            `<option value="${area.id}">${area.nombre}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="inviteMessage" class="form-label">Mensaje personalizado (opcional)</label>
                    <textarea class="form-control" id="inviteMessage" rows="3" 
                        placeholder="Mensaje adicional para incluir en la invitación..."></textarea>
                </div>
            </form>
        `;

        UI.showModal({
            title: 'Invitar Nuevo Usuario',
            content: modalContent,
            onConfirm: () => this.sendUserInvitation()
        });
    }

    async sendUserInvitation() {
        const email = document.getElementById('inviteEmail').value;
        const role = document.getElementById('inviteRole').value;
        const areaId = document.getElementById('inviteArea').value;
        const message = document.getElementById('inviteMessage').value;

        if (!email || !role) {
            UI.showToast('Por favor complete los campos requeridos', 'warning');
            return false;
        }

        // Aquí iría la lógica para enviar la invitación
        UI.showToast(`Invitación enviada a ${email}`, 'success');
        return true;
    }

    showAddUserModal() {
        this.currentUsuario = null;
        this.showModalUsuario();
    }

    async viewUserDetails(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) {
            UI.showToast('Usuario no encontrado', 'error');
            return;
        }

        const modalContent = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Email:</strong> ${usuario.email}</p>
                    <p><strong>Nombre:</strong> ${usuario.nombre || 'Sin nombre'}</p>
                    <p><strong>Rol:</strong> <span class="badge bg-${this.getRoleBadgeColor(usuario.rol)}">${this.getRoleName(usuario.rol)}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Estado:</strong> <span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">${usuario.activo ? 'Activo' : 'Inactivo'}</span></p>
                    <p><strong>Área:</strong> ${usuario.areas ? usuario.areas.nombre : 'Sin asignar'}</p>
                    <p><strong>Último acceso:</strong> ${usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleString('es-MX') : 'Nunca'}</p>
                </div>
            </div>
            <hr>
            <h6>Permisos</h6>
            <div class="row">
                <div class="col-md-4">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" ${usuario.puede_capturar ? 'checked' : ''} disabled>
                        <label class="form-check-label">Puede Capturar</label>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" ${usuario.puede_editar ? 'checked' : ''} disabled>
                        <label class="form-check-label">Puede Editar</label>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" ${usuario.puede_eliminar ? 'checked' : ''} disabled>
                        <label class="form-check-label">Puede Eliminar</label>
                    </div>
                </div>
            </div>
            ${usuario.created_at ? `
                <hr>
                <small class="text-muted">Registrado el ${new Date(usuario.created_at).toLocaleDateString('es-MX')}</small>
            ` : ''}
        `;

        UI.showModal({
            title: `Detalles del Usuario: ${usuario.nombre || usuario.email}`,
            content: modalContent,
            size: 'lg'
        });
    }

    async editUser(usuarioId) {
        this.currentUsuario = this.usuarios.find(u => u.id === usuarioId);
        if (this.currentUsuario) {
            this.showModalUsuario();
        }
    }

    manageUserPermissions(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) {
            UI.showToast('Usuario no encontrado', 'error');
            return;
        }
        
        // Cambiar a la pestaña de permisos
        this.switchSection('permissions');
        
        // Aplicar filtro para mostrar solo este usuario
        setTimeout(() => {
            const searchInput = document.getElementById('permissions-search');
            if (searchInput) {
                searchInput.value = usuario.email;
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
            }
        }, 100);
    }

    async toggleUserStatus(usuarioId, currentStatus) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) {
            UI.showToast('Usuario no encontrado', 'error');
            return;
        }

        const newStatus = !currentStatus;
        const action = newStatus ? 'activar' : 'desactivar';
        
        if (!confirm(`¿Está seguro de ${action} al usuario "${usuario.nombre || usuario.email}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ activo: newStatus })
                .eq('id', usuarioId);
            
            if (error) throw error;
            
            UI.showToast(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`, 'success');
            
            usuario.activo = newStatus;
            document.getElementById('users-table-container').innerHTML = this.createUsersTableHTML();
            this.updateSystemCounts();
            
        } catch (error) {
            console.error('Error al cambiar estado del usuario:', error);
            UI.showToast('Error al cambiar el estado del usuario', 'error');
        }
    }
    // ========== RENDERIZADO DE SECCIÓN DE PERMISOS ==========
    
    createPermissionsContentHTML() {
        return `
            <div class="space-y-6">
                <!-- Resumen de estadísticas -->
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="card border-primary">
                            <div class="card-body text-center">
                                <h3 class="text-primary">${this.permisos.length}</h3>
                                <small class="text-muted">Total Asignaciones</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-success">
                            <div class="card-body text-center">
                                <h3 class="text-success">${this.usuarios.filter(u => u.area_id).length}</h3>
                                <small class="text-muted">Usuarios con Área</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-warning">
                            <div class="card-body text-center">
                                <h3 class="text-warning">${this.usuarios.filter(u => !u.area_id).length}</h3>
                                <small class="text-muted">Sin Asignar</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-info">
                            <div class="card-body text-center">
                                <h3 class="text-info">${this.areas.filter(a => a.estado === 'ACTIVO').length}</h3>
                                <small class="text-muted">Áreas Activas</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Asignación rápida -->
                <div class="card bg-light mb-4">
                    <div class="card-body">
                        <h5 class="card-title">Asignación Rápida</h5>
                        <div class="row g-3">
                            <div class="col-md-3">
                                <input 
                                    type="email" 
                                    class="form-control" 
                                    id="quick-assign-email" 
                                    placeholder="Email del usuario"
                                >
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="quick-assign-area">
                                    <option value="">Seleccione área</option>
                                    ${this.areas.filter(a => a.estado === 'ACTIVO').map(area => 
                                        `<option value="${area.id}">${area.nombre}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="quick-assign-role">
                                    <option value="">Seleccione rol</option>
                                    <option value="jefe">Jefe de Área</option>
                                    <option value="capturista">Capturista</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <button class="btn btn-primary w-100" id="quick-assign-btn" onclick="adminView.handleQuickAssign()">
                                    <i class="fas fa-bolt"></i> Asignar Rápido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Barra de herramientas -->
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="fas fa-search"></i>
                            </span>
                            <input 
                                type="text" 
                                class="form-control" 
                                id="permissions-search" 
                                placeholder="Buscar asignaciones..."
                                value="${this.filters.permissions.search}"
                            >
                        </div>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="permissions-area-filter">
                            <option value="all">Todas las áreas</option>
                            ${this.areas.map(area => 
                                `<option value="${area.id}">${area.nombre}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" id="permissions-role-filter">
                            <option value="all">Todos los roles</option>
                            <option value="admin">Administrador</option>
                            <option value="director">Director</option>
                            <option value="subdirector">Subdirector</option>
                            <option value="jefe">Jefe de Área</option>
                            <option value="capturista">Capturista</option>
                        </select>
                    </div>
                    <div class="col-md-3 text-end">
                        <button class="btn btn-success" id="add-permission-btn" onclick="adminView.showAddPermissionModal()">
                            <i class="fas fa-user-tag"></i> Nueva Asignación
                        </button>
                        <button class="btn btn-outline-secondary ms-2" id="refresh-permissions-btn" onclick="adminView.handleRefreshPermissions()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Tabla de permisos -->
                <div id="permissions-table-container">
                    ${this.createPermissionsTableHTML()}
                </div>
            </div>
        `;
    }

    createPermissionsTableHTML() {
        const filteredPermissions = this.getFilteredPermissions();
        
        if (filteredPermissions.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="fas fa-user-lock fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No se encontraron asignaciones con los filtros aplicados</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Área</th>
                            <th>Rol en Área</th>
                            <th>Permisos</th>
                            <th>Asignado por</th>
                            <th width="150">Fecha Asignación</th>
                            <th width="120" class="text-end">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredPermissions.map(permiso => this.createPermissionRowHTML(permiso)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    createPermissionRowHTML(permiso) {
        const usuario = permiso.usuarios || {};
        const area = permiso.areas || {};
        const fechaAsignacion = permiso.created_at ? 
            new Date(permiso.created_at).toLocaleDateString('es-MX') : 'N/A';
        
        const permisosBadges = [];
        if (permiso.puede_capturar) permisosBadges.push('<span class="badge bg-success">Capturar</span>');
        if (permiso.puede_editar) permisosBadges.push('<span class="badge bg-warning">Editar</span>');
        if (permiso.puede_eliminar) permisosBadges.push('<span class="badge bg-danger">Eliminar</span>');

        return `
            <tr>
                <td>
                    <div>
                        <strong>${usuario.nombre || 'Sin nombre'}</strong>
                        <br>
                        <small class="text-muted">${usuario.email}</small>
                    </div>
                </td>
                <td>
                    <span class="badge" style="background-color: ${area.color_hex || '#6c757d'}">
                        ${area.nombre || 'Sin área'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${this.getRoleBadgeColor(permiso.rol)}">
                        ${this.getRoleName(permiso.rol)}
                    </span>
                </td>
                <td>
                    <div class="d-flex gap-1">
                        ${permisosBadges.length > 0 ? permisosBadges.join(' ') : '<span class="text-muted">Sin permisos especiales</span>'}
                    </div>
                </td>
                <td>
                    <small class="text-muted">${permiso.asignado_por ? 'Administrador' : 'Sistema'}</small>
                </td>
                <td>
                    <small class="text-muted">${fechaAsignacion}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button 
                            class="btn btn-outline-primary" 
                            onclick="adminView.editPermission('${permiso.id}')"
                            title="Editar permisos"
                        >
                            <i class="fas fa-edit"></i>
                        </button>
                        <button 
                            class="btn btn-outline-danger" 
                            onclick="adminView.deletePermission('${permiso.id}', '${usuario.nombre || usuario.email}', '${area.nombre}')"
                            title="Eliminar asignación"
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getFilteredPermissions() {
        let filtered = this.permisos;
        
        // Filtrar por búsqueda
        const searchTerm = document.getElementById('permissions-search')?.value?.toLowerCase() || this.filters.permissions.search;
        if (searchTerm) {
            filtered = filtered.filter(permiso => {
                const usuario = permiso.usuarios || {};
                const area = permiso.areas || {};
                return (
                    (usuario.email && usuario.email.toLowerCase().includes(searchTerm)) ||
                    (usuario.nombre && usuario.nombre.toLowerCase().includes(searchTerm)) ||
                    (area.nombre && area.nombre.toLowerCase().includes(searchTerm)) ||
                    (area.clave && area.clave.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        // Filtrar por área
        const areaFilter = document.getElementById('permissions-area-filter')?.value || 'all';
        if (areaFilter !== 'all') {
            filtered = filtered.filter(permiso => permiso.area_id === areaFilter);
        }
        
        // Filtrar por rol
        const roleFilter = document.getElementById('permissions-role-filter')?.value || 'all';
        if (roleFilter !== 'all') {
            filtered = filtered.filter(permiso => permiso.rol === roleFilter);
        }
        
        return filtered;
    }

    // ========== HANDLERS DE PERMISOS ==========

    async handleRefreshPermissions() {
        try {
            const refreshBtn = document.getElementById('refresh-permissions-btn');
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.add('fa-spin');
            }
            
            await this.loadPermisos();
            
            document.getElementById('permissions-table-container').innerHTML = this.createPermissionsTableHTML();
            this.updateSystemCounts();
            
            UI.showToast('Lista de permisos actualizada', 'success');
            
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.remove('fa-spin');
            }
        } catch (error) {
            console.error('Error al refrescar permisos:', error);
            UI.showToast('Error al actualizar los permisos', 'error');
        }
    }

    async handleQuickAssign() {
        const email = document.getElementById('quick-assign-email').value;
        const areaId = document.getElementById('quick-assign-area').value;
        const rol = document.getElementById('quick-assign-role').value;

        if (!email || !areaId || !rol) {
            UI.showToast('Por favor complete todos los campos', 'warning');
            return;
        }

        try {
            // Buscar el usuario por email
            const { data: usuarios, error: userError } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email.toLowerCase())
                .single();

            if (userError || !usuarios) {
                UI.showToast('Usuario no encontrado. Debe estar registrado en el sistema.', 'error');
                return;
            }

            // Verificar si ya tiene asignación en esta área
            if (usuarios.area_id === areaId) {
                UI.showToast('El usuario ya está asignado a esta área', 'warning');
                return;
            }

            // Crear la asignación
            const { error: assignError } = await supabase
                .from('usuarios')
                .update({
                    area_id: areaId,
                    rol: rol,
                    puede_capturar: true,
                    puede_editar: rol === 'jefe',
                    puede_eliminar: false
                })
                .eq('id', usuarios.id);

            if (assignError) throw assignError;

            // Crear registro en usuario_areas si existe esa tabla
            await supabase
                .from('usuario_areas')
                .insert({
                    usuario_id: usuarios.id,
                    area_id: areaId,
                    rol: rol,
                    puede_capturar: true,
                    puede_editar: rol === 'jefe',
                    puede_eliminar: false,
                    asignado_por: adminState.userProfile.id
                });

            UI.showToast('Asignación creada correctamente', 'success');
            
            // Limpiar formulario
            document.getElementById('quick-assign-email').value = '';
            document.getElementById('quick-assign-area').value = '';
            document.getElementById('quick-assign-role').value = '';
            
            // Recargar datos
            await this.loadUsuarios();
            await this.loadPermisos();
            document.getElementById('permissions-table-container').innerHTML = this.createPermissionsTableHTML();
            this.updateSystemCounts();
            
        } catch (error) {
            console.error('Error en asignación rápida:', error);
            UI.showToast('Error al crear la asignación', 'error');
        }
    }

    showAddPermissionModal() {
        const usuariosSinArea = this.usuarios.filter(u => !u.area_id);
        
        if (usuariosSinArea.length === 0) {
            UI.showToast('No hay usuarios disponibles para asignar', 'info');
            return;
        }

        const modalContent = `
            <form id="addPermissionForm">
                <div class="mb-3">
                    <label for="permissionUsuario" class="form-label">Usuario *</label>
                    <select class="form-select" id="permissionUsuario" required>
                        <option value="">Seleccione un usuario</option>
                        ${usuariosSinArea.map(usuario => 
                            `<option value="${usuario.id}">${usuario.nombre || usuario.email}</option>`
                        ).join('')}
                    </select>
                    <div class="form-text">Solo se muestran usuarios sin área asignada</div>
                </div>
                
                <div class="mb-3">
                    <label for="permissionArea" class="form-label">Área *</label>
                    <select class="form-select" id="permissionArea" required>
                        <option value="">Seleccione un área</option>
                        ${this.areas.filter(a => a.estado === 'ACTIVO').map(area => 
                            `<option value="${area.id}">${area.nombre}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="mb-3">
                    <label for="permissionRol" class="form-label">Rol en el Área *</label>
                    <select class="form-select" id="permissionRol" required>
                        <option value="">Seleccione un rol</option>
                        <option value="jefe">Jefe de Área</option>
                        <option value="capturista">Capturista</option>
                    </select>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Permisos en el Área</label>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="permissionCapturar" checked>
                        <label class="form-check-label" for="permissionCapturar">
                            Puede capturar indicadores
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="permissionEditar">
                        <label class="form-check-label" for="permissionEditar">
                            Puede editar indicadores
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="permissionEliminar">
                        <label class="form-check-label" for="permissionEliminar">
                            Puede eliminar indicadores
                        </label>
                    </div>
                </div>
            </form>
        `;

        UI.showModal({
            title: 'Nueva Asignación de Permisos',
            content: modalContent,
            onConfirm: () => this.saveNewPermission()
        });
    }

    async saveNewPermission() {
        const usuarioId = document.getElementById('permissionUsuario').value;
        const areaId = document.getElementById('permissionArea').value;
        const rol = document.getElementById('permissionRol').value;
        const puedeCapturar = document.getElementById('permissionCapturar').checked;
        const puedeEditar = document.getElementById('permissionEditar').checked;
        const puedeEliminar = document.getElementById('permissionEliminar').checked;

        if (!usuarioId || !areaId || !rol) {
            UI.showToast('Por favor complete todos los campos requeridos', 'warning');
            return false;
        }

        try {
            // Actualizar usuario
            const { error } = await supabase
                .from('usuarios')
                .update({
                    area_id: areaId,
                    rol: rol,
                    puede_capturar: puedeCapturar,
                    puede_editar: puedeEditar,
                    puede_eliminar: puedeEliminar
                })
                .eq('id', usuarioId);

            if (error) throw error;

            // Crear registro en usuario_areas
            await supabase
                .from('usuario_areas')
                .insert({
                    usuario_id: usuarioId,
                    area_id: areaId,
                    rol: rol,
                    puede_capturar: puedeCapturar,
                    puede_editar: puedeEditar,
                    puede_eliminar: puedeEliminar,
                    asignado_por: adminState.userProfile.id
                });

            UI.showToast('Asignación creada correctamente', 'success');
            
            await this.loadUsuarios();
            await this.loadPermisos();
            document.getElementById('permissions-table-container').innerHTML = this.createPermissionsTableHTML();
            this.updateSystemCounts();
            
            return true;
        } catch (error) {
            console.error('Error al crear asignación:', error);
            UI.showToast('Error al crear la asignación', 'error');
            return false;
        }
    }

    async editPermission(permisoId) {
        const permiso = this.permisos.find(p => p.id === permisoId);
        if (!permiso) {
            UI.showToast('Permiso no encontrado', 'error');
            return;
        }

        // Aquí puedes implementar la lógica de edición similar a showAddPermissionModal
        // pero con los datos del permiso precargados
        UI.showToast('Función de edición en desarrollo', 'info');
    }

    async deletePermission(permisoId, nombreUsuario, nombreArea) {
        if (!confirm(`¿Está seguro de eliminar la asignación de "${nombreUsuario}" en el área "${nombreArea}"?`)) {
            return;
        }

        try {
            // Eliminar de usuario_areas
            const { error: deleteError } = await supabase
                .from('usuario_areas')
                .delete()
                .eq('id', permisoId);

            if (deleteError) throw deleteError;

            // También actualizar el usuario para quitar el área
            const permiso = this.permisos.find(p => p.id === permisoId);
            if (permiso && permiso.usuarios) {
                await supabase
                    .from('usuarios')
                    .update({
                        area_id: null,
                        rol: 'capturista',
                        puede_capturar: true,
                        puede_editar: false,
                        puede_eliminar: false
                    })
                    .eq('id', permiso.usuarios.id);
            }

            UI.showToast('Asignación eliminada correctamente', 'success');
            
            this.permisos = this.permisos.filter(p => p.id !== permisoId);
            await this.loadUsuarios();
            document.getElementById('permissions-table-container').innerHTML = this.createPermissionsTableHTML();
            this.updateSystemCounts();
            
        } catch (error) {
            console.error('Error al eliminar permiso:', error);
            UI.showToast('Error al eliminar la asignación', 'error');
        }
    }
    // ========== RENDERIZADO DE MODALES ==========
    
    renderModals() {
        return `
            ${this.renderModalArea()}
            ${this.renderModalUsuario()}
            ${this.renderModalAsignacion()}
            ${this.renderModalBulkActions()}
            ${this.renderModalExport()}
        `;
    }

    renderModalArea() {
        return `
            <div class="modal fade" id="modalArea" tabindex="-1" aria-labelledby="modalAreaLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalAreaLabel">Nueva Área</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="formArea">
                            <div class="modal-body">
                                <input type="hidden" id="areaId">
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="areaClave" class="form-label">Clave *</label>
                                            <input 
                                                type="text" 
                                                class="form-control" 
                                                id="areaClave" 
                                                required 
                                                maxlength="10" 
                                                pattern="[A-Z0-9]+" 
                                                placeholder="Ej: DIR01"
                                                style="text-transform: uppercase;"
                                            >
                                            <div class="form-text">Solo mayúsculas y números, máximo 10 caracteres</div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="areaEstado" class="form-label">Estado</label>
                                            <select class="form-select" id="areaEstado">
                                                <option value="ACTIVO">Activo</option>
                                                <option value="INACTIVO">Inactivo</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaNombre" class="form-label">Nombre del Área *</label>
                                    <input 
                                        type="text" 
                                        class="form-control" 
                                        id="areaNombre" 
                                        required 
                                        maxlength="100" 
                                        placeholder="Ej: Dirección General"
                                    >
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaDescripcion" class="form-label">Descripción</label>
                                    <textarea 
                                        class="form-control" 
                                        id="areaDescripcion" 
                                        rows="3" 
                                        maxlength="500" 
                                        placeholder="Descripción del área y sus responsabilidades (opcional)"
                                    ></textarea>
                                    <div class="form-text">
                                        <span id="areaDescripcionCount">0</span>/500 caracteres
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaColor" class="form-label">Color de Identificación *</label>
                                    <div class="input-group">
                                        <input 
                                            type="color" 
                                            class="form-control form-control-color" 
                                            id="areaColor" 
                                            value="#1e40af" 
                                            required
                                            style="max-width: 60px;"
                                        >
                                        <input 
                                            type="text" 
                                            class="form-control" 
                                            id="areaColorHex" 
                                            value="#1e40af" 
                                            pattern="^#[0-9A-Fa-f]{6}$" 
                                            required
                                            placeholder="#000000"
                                        >
                                        <button class="btn btn-outline-secondary" type="button" onclick="adminView.randomizeColor()">
                                            <i class="fas fa-random"></i> Aleatorio
                                        </button>
                                    </div>
                                    <div class="form-text">Seleccione un color para identificar el área en gráficas y reportes</div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Vista Previa</label>
                                    <div class="card">
                                        <div class="card-body">
                                            <span class="badge" id="areaPreview" style="background-color: #1e40af; font-size: 1rem;">
                                                Área de Ejemplo
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Guardar Área
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    renderModalUsuario() {
        return `
            <div class="modal fade" id="modalUsuario" tabindex="-1" aria-labelledby="modalUsuarioLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalUsuarioLabel">Nuevo Usuario</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="formUsuario">
                            <div class="modal-body">
                                <input type="hidden" id="usuarioId">
                                
                                <!-- Información básica -->
                                <h6 class="mb-3">Información Básica</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioEmail" class="form-label">Email *</label>
                                            <input 
                                                type="email" 
                                                class="form-control" 
                                                id="usuarioEmail" 
                                                required 
                                                placeholder="usuario@ejemplo.com"
                                            >
                                            <div class="form-text">El email será el identificador único del usuario</div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioNombre" class="form-label">Nombre Completo</label>
                                            <input 
                                                type="text" 
                                                class="form-control" 
                                                id="usuarioNombre" 
                                                maxlength="200" 
                                                placeholder="Nombre y apellidos"
                                            >
                                        </div>
                                    </div>
                                </div>

                                <!-- Asignación organizacional -->
                                <h6 class="mb-3 mt-4">Asignación Organizacional</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioArea" class="form-label">Área</label>
                                            <select class="form-select" id="usuarioArea">
                                                <option value="">Sin asignar</option>
                                                ${this.areas.filter(a => a.estado === 'ACTIVO').map(area => 
                                                    `<option value="${area.id}">${area.nombre}</option>`
                                                ).join('')}
                                            </select>
                                            <div class="form-text">Área a la que pertenece el usuario</div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioRol" class="form-label">Rol Principal *</label>
                                            <select class="form-select" id="usuarioRol" required>
                                                <option value="">Seleccione un rol</option>
                                                <option value="admin">Administrador</option>
                                                <option value="director">Director</option>
                                                <option value="subdirector">Subdirector</option>
                                                <option value="jefe">Jefe de Área</option>
                                                <option value="capturista">Capturista</option>
                                            </select>
                                            <div class="form-text">Rol principal del usuario en el sistema</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Permisos -->
                                <h6 class="mb-3 mt-4">Permisos del Sistema</h6>
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="form-check form-switch">
                                            <input 
                                                class="form-check-input" 
                                                type="checkbox" 
                                                id="usuarioPuedeCapturar" 
                                                checked
                                            >
                                            <label class="form-check-label" for="usuarioPuedeCapturar">
                                                <i class="fas fa-plus-circle text-success"></i> Puede Capturar
                                            </label>
                                        </div>
                                        <small class="text-muted">Crear nuevos indicadores</small>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-check form-switch">
                                            <input 
                                                class="form-check-input" 
                                                type="checkbox" 
                                                id="usuarioPuedeEditar"
                                            >
                                            <label class="form-check-label" for="usuarioPuedeEditar">
                                                <i class="fas fa-edit text-warning"></i> Puede Editar
                                            </label>
                                        </div>
                                        <small class="text-muted">Modificar indicadores existentes</small>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-check form-switch">
                                            <input 
                                                class="form-check-input" 
                                                type="checkbox" 
                                                id="usuarioPuedeEliminar"
                                            >
                                            <label class="form-check-label" for="usuarioPuedeEliminar">
                                                <i class="fas fa-trash text-danger"></i> Puede Eliminar
                                            </label>
                                        </div>
                                        <small class="text-muted">Eliminar indicadores</small>
                                    </div>
                                </div>

                                <!-- Estado -->
                                <h6 class="mb-3 mt-4">Estado de la Cuenta</h6>
                                <div class="mb-3">
                                    <select class="form-select" id="usuarioEstado">
                                        <option value="true">Activo - Puede acceder al sistema</option>
                                        <option value="false">Inactivo - Acceso bloqueado</option>
                                    </select>
                                </div>

                                <!-- Notificaciones -->
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="usuarioNotificar" checked>
                                    <label class="form-check-label" for="usuarioNotificar">
                                        Enviar notificación por email al usuario sobre esta acción
                                    </label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Guardar Usuario
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    renderModalAsignacion() {
        return `
            <div class="modal fade" id="modalAsignacion" tabindex="-1" aria-labelledby="modalAsignacionLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalAsignacionLabel">Nueva Asignación de Área</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="formAsignacion">
                            <div class="modal-body">
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle"></i> 
                                    Esta asignación vinculará un usuario con un área específica y definirá sus permisos.
                                </div>
                                
                                <div class="mb-3">
                                    <label for="asignacionUsuario" class="form-label">Usuario *</label>
                                    <select class="form-select" id="asignacionUsuario" required>
                                        <option value="">Seleccione un usuario</option>
                                        ${this.usuarios.filter(u => !u.area_id).map(usuario => 
                                            `<option value="${usuario.id}">${usuario.nombre || usuario.email}</option>`
                                        ).join('')}
                                    </select>
                                    <div class="form-text">Solo se muestran usuarios sin área asignada</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="asignacionArea" class="form-label">Área *</label>
                                    <select class="form-select" id="asignacionArea" required>
                                        <option value="">Seleccione un área</option>
                                        ${this.areas.filter(a => a.estado === 'ACTIVO').map(area => 
                                            `<option value="${area.id}" data-color="${area.color_hex}">${area.nombre}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="asignacionRol" class="form-label">Rol en el Área *</label>
                                    <select class="form-select" id="asignacionRol" required>
                                        <option value="">Seleccione un rol</option>
                                        <option value="jefe">Jefe de Área</option>
                                        <option value="capturista">Capturista</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="analista">Analista</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Permisos en el Área</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionCapturar" checked>
                                        <label class="form-check-label" for="asignacionCapturar">
                                            <i class="fas fa-plus text-success"></i> Puede capturar indicadores del área
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionEditar">
                                        <label class="form-check-label" for="asignacionEditar">
                                            <i class="fas fa-edit text-warning"></i> Puede editar indicadores del área
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionEliminar">
                                        <label class="form-check-label" for="asignacionEliminar">
                                            <i class="fas fa-trash text-danger"></i> Puede eliminar indicadores del área
                                        </label>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label for="asignacionNotas" class="form-label">Notas (opcional)</label>
                                    <textarea 
                                        class="form-control" 
                                        id="asignacionNotas" 
                                        rows="2" 
                                        placeholder="Notas adicionales sobre esta asignación"
                                    ></textarea>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-user-tag"></i> Crear Asignación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    renderModalBulkActions() {
        return `
            <div class="modal fade" id="modalBulkActions" tabindex="-1" aria-labelledby="modalBulkActionsLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalBulkActionsLabel">Acciones Masivas</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Has seleccionado <strong id="bulkSelectedCount">0</strong> elementos.</p>
                            <p>¿Qué acción deseas realizar?</p>
                            
                            <div class="d-grid gap-2">
                                <button class="btn btn-outline-primary" onclick="adminView.bulkActivate()">
                                    <i class="fas fa-check-circle"></i> Activar Seleccionados
                                </button>
                                <button class="btn btn-outline-warning" onclick="adminView.bulkDeactivate()">
                                    <i class="fas fa-times-circle"></i> Desactivar Seleccionados
                                </button>
                                <button class="btn btn-outline-info" onclick="adminView.bulkAssignArea()">
                                    <i class="fas fa-building"></i> Asignar Área
                                </button>
                                <button class="btn btn-outline-success" onclick="adminView.bulkChangeRole()">
                                    <i class="fas fa-user-tag"></i> Cambiar Rol
                                </button>
                                <button class="btn btn-outline-danger" onclick="adminView.bulkDelete()">
                                    <i class="fas fa-trash"></i> Eliminar Seleccionados
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderModalExport() {
        return `
            <div class="modal fade" id="modalExport" tabindex="-1" aria-labelledby="modalExportLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalExportLabel">Exportar Datos</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Seleccione los datos a exportar:</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="exportAreas" checked>
                                    <label class="form-check-label" for="exportAreas">
                                        Áreas (${this.areas.length} registros)
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="exportUsuarios" checked>
                                    <label class="form-check-label" for="exportUsuarios">
                                        Usuarios (${this.usuarios.length} registros)
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="exportPermisos" checked>
                                    <label class="form-check-label" for="exportPermisos">
                                        Permisos y Asignaciones (${this.permisos.length} registros)
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="exportIndicadores">
                                    <label class="form-check-label" for="exportIndicadores">
                                        Indicadores (${this.indicadores.length} registros)
                                    </label>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="exportFormat" class="form-label">Formato de exportación:</label>
                                <select class="form-select" id="exportFormat">
                                    <option value="csv">CSV (Excel compatible)</option>
                                    <option value="json">JSON</option>
                                    <option value="xlsx">Excel (XLSX)</option>
                                </select>
                            </div>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle"></i> 
                                Los datos exportados incluirán toda la información visible según los filtros actuales.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                Cancelar
                            </button>
                            <button type="button" class="btn btn-primary" onclick="adminView.executeExport()">
                                <i class="fas fa-download"></i> Exportar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    // Falta parte 6 ->
