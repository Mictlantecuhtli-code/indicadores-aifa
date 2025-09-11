// js/views/admin.js
import { supabase } from '../lib/supa.js';
import { UI } from '../lib/ui.js';

export class AdminView {
    constructor() {
        this.areas = [];
        this.usuarios = [];
        this.indicadores = [];
        this.currentArea = null;
        this.currentUsuario = null;
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
            .select('rol')
            .eq('id', user.id)
            .single();

        if (profile?.rol !== 'admin') {
            return UI.alert('No tienes permisos para acceder a esta sección', 'danger');
        }

        await this.loadData();

        return `
            <div class="container-fluid px-4">
                <h1 class="mt-4">Panel de Administración</h1>
                <ol class="breadcrumb mb-4">
                    <li class="breadcrumb-item"><a href="#/">Dashboard</a></li>
                    <li class="breadcrumb-item active">Administración</li>
                </ol>

                <!-- Tarjetas de estadísticas -->
                <div class="row">
                    <div class="col-xl-3 col-md-6">
                        <div class="card bg-primary text-white mb-4">
                            <div class="card-body">
                                <div class="row">
                                    <div class="col">
                                        <div class="text-white-50 small">Total Áreas</div>
                                        <div class="h4">${this.areas.length}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-building fa-2x"></i>
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
                                        <div class="text-white-50 small">Total Usuarios</div>
                                        <div class="h4">${this.usuarios.length}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-users fa-2x"></i>
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
                                        <div class="h4">${this.indicadores.length}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-chart-line fa-2x"></i>
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
                                        <div class="h4">${this.getAsignacionesCount()}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-tasks fa-2x"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabs de gestión -->
                <div class="card mb-4">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active" data-bs-toggle="tab" href="#areas">
                                    <i class="fas fa-building"></i> Gestión de Áreas
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-bs-toggle="tab" href="#usuarios">
                                    <i class="fas fa-users"></i> Gestión de Usuarios
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-bs-toggle="tab" href="#permisos">
                                    <i class="fas fa-lock"></i> Permisos y Asignaciones
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="tab-content">
                            ${this.renderAreasTab()}
                            ${this.renderUsuariosTab()}
                            ${this.renderPermisosTab()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modales -->
            ${this.renderModalArea()}
            ${this.renderModalUsuario()}
            ${this.renderModalAsignacion()}
        `;
    }

    async loadData() {
        // Cargar áreas
        const { data: areas } = await supabase
            .from('areas')
            .select('*')
            .order('nombre');
        this.areas = areas || [];

        // Cargar usuarios con sus áreas
        const { data: usuarios } = await supabase
            .from('usuarios')
            .select(`
                *,
                areas (
                    id,
                    nombre
                )
            `)
            .order('nombre');
        this.usuarios = usuarios || [];

        // Cargar indicadores
        const { data: indicadores } = await supabase
            .from('indicadores')
            .select('*')
            .order('nombre');
        this.indicadores = indicadores || [];
    }

    getAsignacionesCount() {
        return this.usuarios.filter(u => u.area_id).length;
    }

    attachEventListeners() {
        // Event listeners para áreas
        document.querySelectorAll('.btn-edit-area').forEach(btn => {
            btn.addEventListener('click', (e) => this.editArea(e.target.dataset.id));
        });

        document.querySelectorAll('.btn-delete-area').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteArea(e.target.dataset.id));
        });

        document.getElementById('btnNuevaArea')?.addEventListener('click', () => {
            this.currentArea = null;
            this.showModalArea();
        });

        // Event listeners para usuarios
        document.querySelectorAll('.btn-edit-usuario').forEach(btn => {
            btn.addEventListener('click', (e) => this.editUsuario(e.target.dataset.id));
        });

        document.querySelectorAll('.btn-toggle-usuario').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleUsuario(e.target.dataset.id));
        });

        document.getElementById('btnNuevoUsuario')?.addEventListener('click', () => {
            this.currentUsuario = null;
            this.showModalUsuario();
        });

        // Event listeners para asignaciones
        document.getElementById('btnNuevaAsignacion')?.addEventListener('click', () => {
            this.showModalAsignacion();
        });

        // Formularios
        document.getElementById('formArea')?.addEventListener('submit', (e) => this.saveArea(e));
        document.getElementById('formUsuario')?.addEventListener('submit', (e) => this.saveUsuario(e));
        document.getElementById('formAsignacion')?.addEventListener('submit', (e) => this.saveAsignacion(e));
    }
}
renderAreasTab() {
        return `
            <div class="tab-pane fade show active" id="areas" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="mb-0">Gestión de Áreas</h5>
                    <button class="btn btn-primary" id="btnNuevaArea">
                        <i class="fas fa-plus"></i> Nueva Área
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Clave</th>
                                <th>Nombre</th>
                                <th>Descripción</th>
                                <th>Color</th>
                                <th>Estado</th>
                                <th>Indicadores</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.areas.map(area => `
                                <tr>
                                    <td>${area.clave}</td>
                                    <td>${area.nombre}</td>
                                    <td>${area.descripcion || 'Sin descripción'}</td>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <div class="color-badge" style="background-color: ${area.color_hex}; width: 20px; height: 20px; border-radius: 4px; margin-right: 8px;"></div>
                                            ${area.color_hex}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge bg-${area.estado === 'ACTIVO' ? 'success' : 'secondary'}">
                                            ${area.estado}
                                        </span>
                                    </td>
                                    <td>${area.indicadores_count || 0}</td>
                                    <td>
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-primary btn-edit-area" data-id="${area.id}" title="Editar">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-outline-danger btn-delete-area" data-id="${area.id}" title="Eliminar">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${this.areas.length === 0 ? `
                        <div class="text-center py-4">
                            <p class="text-muted">No hay áreas registradas</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderUsuariosTab() {
        return `
            <div class="tab-pane fade" id="usuarios" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="mb-0">Gestión de Usuarios</h5>
                    <button class="btn btn-primary" id="btnNuevoUsuario">
                        <i class="fas fa-user-plus"></i> Nuevo Usuario
                    </button>
                </div>

                <div class="row mb-3">
                    <div class="col-md-4">
                        <input type="text" class="form-control" id="searchUsuarios" placeholder="Buscar usuarios...">
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="filterRol">
                            <option value="">Todos los roles</option>
                            <option value="admin">Administrador</option>
                            <option value="director">Director</option>
                            <option value="subdirector">Subdirector</option>
                            <option value="jefe">Jefe de Área</option>
                            <option value="capturista">Capturista</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="filterEstado">
                            <option value="">Todos los estados</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Nombre</th>
                                <th>Área</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Último Acceso</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="usuariosTableBody">
                            ${this.usuarios.map(usuario => `
                                <tr>
                                    <td>${usuario.email}</td>
                                    <td>${usuario.nombre || 'Sin nombre'}</td>
                                    <td>
                                        ${usuario.areas ? `
                                            <span class="badge" style="background-color: ${usuario.areas.color_hex || '#6c757d'}">
                                                ${usuario.areas.nombre}
                                            </span>
                                        ` : 'Sin asignar'}
                                    </td>
                                    <td>
                                        <span class="badge bg-${this.getRoleBadgeColor(usuario.rol)}">
                                            ${this.getRoleName(usuario.rol)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">
                                            ${usuario.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>${usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleDateString() : 'Nunca'}</td>
                                    <td>
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-primary btn-edit-usuario" data-id="${usuario.id}" title="Editar">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-outline-warning btn-toggle-usuario" data-id="${usuario.id}" title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                                                <i class="fas fa-${usuario.activo ? 'lock' : 'unlock'}"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${this.usuarios.length === 0 ? `
                        <div class="text-center py-4">
                            <p class="text-muted">No hay usuarios registrados</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPermisosTab() {
        const usuariosConPermisos = this.usuarios.filter(u => u.area_id);
        
        return `
            <div class="tab-pane fade" id="permisos" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="mb-0">Permisos y Asignaciones</h5>
                    <button class="btn btn-primary" id="btnNuevaAsignacion">
                        <i class="fas fa-user-tag"></i> Nueva Asignación
                    </button>
                </div>

                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">Resumen de Asignaciones</h6>
                                <div class="row text-center">
                                    <div class="col">
                                        <div class="h3">${usuariosConPermisos.length}</div>
                                        <small class="text-muted">Usuarios Asignados</small>
                                    </div>
                                    <div class="col">
                                        <div class="h3">${this.areas.filter(a => a.estado === 'ACTIVO').length}</div>
                                        <small class="text-muted">Áreas Activas</small>
                                    </div>
                                    <div class="col">
                                        <div class="h3">${this.usuarios.filter(u => !u.area_id).length}</div>
                                        <small class="text-muted">Sin Asignar</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">Distribución por Rol</h6>
                                <div class="d-flex justify-content-around">
                                    ${this.getRoleDistribution().map(item => `
                                        <div class="text-center">
                                            <div class="h4">${item.count}</div>
                                            <small class="text-muted">${item.role}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Área</th>
                                <th>Rol</th>
                                <th>Permisos</th>
                                <th>Fecha Asignación</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${usuariosConPermisos.map(usuario => `
                                <tr>
                                    <td>
                                        <div>
                                            <strong>${usuario.nombre || usuario.email}</strong><br>
                                            <small class="text-muted">${usuario.email}</small>
                                        </div>
                                    </td>
                                    <td>
                                        ${usuario.areas ? `
                                            <span class="badge" style="background-color: ${usuario.areas.color_hex || '#6c757d'}">
                                                ${usuario.areas.nombre}
                                            </span>
                                        ` : '-'}
                                    </td>
                                    <td>
                                        <span class="badge bg-${this.getRoleBadgeColor(usuario.rol)}">
                                            ${this.getRoleName(usuario.rol)}
                                        </span>
                                    </td>
                                    <td>
                                        ${this.renderPermisos(usuario)}
                                    </td>
                                    <td>${usuario.fecha_asignacion ? new Date(usuario.fecha_asignacion).toLocaleDateString() : '-'}</td>
                                    <td>
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-primary btn-edit-permisos" data-id="${usuario.id}" title="Editar permisos">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-outline-danger btn-remove-asignacion" data-id="${usuario.id}" title="Remover asignación">
                                                <i class="fas fa-user-times"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${usuariosConPermisos.length === 0 ? `
                        <div class="text-center py-4">
                            <p class="text-muted">No hay usuarios asignados a áreas</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
// ========== MÉTODOS AUXILIARES ==========
    getRoleBadgeColor(rol) {
        const colors = {
            'admin': 'danger',
            'director': 'primary',
            'subdirector': 'info',
            'jefe': 'success',
            'capturista': 'secondary'
        };
        return colors[rol] || 'secondary';
    }

    getRoleName(rol) {
        const names = {
            'admin': 'Administrador',
            'director': 'Director',
            'subdirector': 'Subdirector',
            'jefe': 'Jefe de Área',
            'capturista': 'Capturista'
        };
        return names[rol] || rol;
    }

    getRoleDistribution() {
        const distribution = {
            'Administrador': 0,
            'Director': 0,
            'Subdirector': 0,
            'Jefe': 0,
            'Capturista': 0
        };

        this.usuarios.forEach(usuario => {
            const roleName = this.getRoleName(usuario.rol);
            if (distribution.hasOwnProperty(roleName)) {
                distribution[roleName]++;
            }
        });

        return Object.entries(distribution).map(([role, count]) => ({ role, count }));
    }

    renderPermisos(usuario) {
        const permisos = [];
        if (usuario.puede_capturar) permisos.push('<span class="badge bg-success">Capturar</span>');
        if (usuario.puede_editar) permisos.push('<span class="badge bg-warning">Editar</span>');
        if (usuario.puede_eliminar) permisos.push('<span class="badge bg-danger">Eliminar</span>');
        
        return permisos.length > 0 ? permisos.join(' ') : '<span class="text-muted">Sin permisos especiales</span>';
    }

    // ========== MODALES ==========
    
    // Modal de Área
    renderModalArea() {
        return `
            <div class="modal fade" id="modalArea" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalAreaTitle">Nueva Área</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="formArea">
                            <div class="modal-body">
                                <input type="hidden" id="areaId">
                                <div class="mb-3">
                                    <label for="areaClave" class="form-label">Clave *</label>
                                    <input type="text" class="form-control" id="areaClave" required 
                                           maxlength="10" pattern="[A-Z0-9]+" 
                                           placeholder="Ej: DIR01">
                                    <div class="form-text">Solo mayúsculas y números, máximo 10 caracteres</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaNombre" class="form-label">Nombre *</label>
                                    <input type="text" class="form-control" id="areaNombre" required 
                                           maxlength="100" placeholder="Ej: Dirección General">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaDescripcion" class="form-label">Descripción</label>
                                    <textarea class="form-control" id="areaDescripcion" rows="3" 
                                              maxlength="500" placeholder="Descripción del área (opcional)"></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaColor" class="form-label">Color *</label>
                                    <div class="input-group">
                                        <input type="color" class="form-control form-control-color" 
                                               id="areaColor" value="#1e40af" required>
                                        <input type="text" class="form-control" id="areaColorHex" 
                                               value="#1e40af" pattern="^#[0-9A-Fa-f]{6}$" required>
                                    </div>
                                    <div class="form-text">Seleccione un color para identificar el área</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="areaEstado" class="form-label">Estado</label>
                                    <select class="form-select" id="areaEstado">
                                        <option value="ACTIVO">Activo</option>
                                        <option value="INACTIVO">Inactivo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // Modal de Usuario
    renderModalUsuario() {
        return `
            <div class="modal fade" id="modalUsuario" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalUsuarioTitle">Nuevo Usuario</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="formUsuario">
                            <div class="modal-body">
                                <input type="hidden" id="usuarioId">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioEmail" class="form-label">Email *</label>
                                            <input type="email" class="form-control" id="usuarioEmail" required 
                                                   placeholder="usuario@ejemplo.com">
                                            <div class="form-text">El email será el identificador único</div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioNombre" class="form-label">Nombre Completo</label>
                                            <input type="text" class="form-control" id="usuarioNombre" 
                                                   maxlength="200" placeholder="Nombre y apellidos">
                                        </div>
                                    </div>
                                </div>
                                
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
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="usuarioRol" class="form-label">Rol *</label>
                                            <select class="form-select" id="usuarioRol" required>
                                                <option value="">Seleccione un rol</option>
                                                <option value="admin">Administrador</option>
                                                <option value="director">Director</option>
                                                <option value="subdirector">Subdirector</option>
                                                <option value="jefe">Jefe de Área</option>
                                                <option value="capturista">Capturista</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Permisos Especiales</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="usuarioPuedeCapturar" checked>
                                        <label class="form-check-label" for="usuarioPuedeCapturar">
                                            Puede capturar indicadores
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="usuarioPuedeEditar">
                                        <label class="form-check-label" for="usuarioPuedeEditar">
                                            Puede editar indicadores
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="usuarioPuedeEliminar">
                                        <label class="form-check-label" for="usuarioPuedeEliminar">
                                            Puede eliminar indicadores
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="usuarioEstado" class="form-label">Estado</label>
                                    <select class="form-select" id="usuarioEstado">
                                        <option value="true">Activo</option>
                                        <option value="false">Inactivo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // Modal de Asignación
    renderModalAsignacion() {
        return `
            <div class="modal fade" id="modalAsignacion" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Nueva Asignación</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="formAsignacion">
                            <div class="modal-body">
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
                                            `<option value="${area.id}">${area.nombre}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="asignacionRol" class="form-label">Rol en el Área *</label>
                                    <select class="form-select" id="asignacionRol" required>
                                        <option value="">Seleccione un rol</option>
                                        <option value="jefe">Jefe de Área</option>
                                        <option value="capturista">Capturista</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Permisos en el Área</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionCapturar" checked>
                                        <label class="form-check-label" for="asignacionCapturar">
                                            Puede capturar indicadores del área
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionEditar">
                                        <label class="form-check-label" for="asignacionEditar">
                                            Puede editar indicadores del área
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="asignacionEliminar">
                                        <label class="form-check-label" for="asignacionEliminar">
                                            Puede eliminar indicadores del área
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-user-tag"></i> Asignar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
// ========== EVENT HANDLERS - ÁREAS ==========
    
    showModalArea() {
        const modal = new bootstrap.Modal(document.getElementById('modalArea'));
        const modalTitle = document.getElementById('modalAreaTitle');
        
        if (this.currentArea) {
            // Modo edición
            modalTitle.textContent = 'Editar Área';
            document.getElementById('areaId').value = this.currentArea.id;
            document.getElementById('areaClave').value = this.currentArea.clave;
            document.getElementById('areaNombre').value = this.currentArea.nombre;
            document.getElementById('areaDescripcion').value = this.currentArea.descripcion || '';
            document.getElementById('areaColor').value = this.currentArea.color_hex;
            document.getElementById('areaColorHex').value = this.currentArea.color_hex;
            document.getElementById('areaEstado').value = this.currentArea.estado;
        } else {
            // Modo creación
            modalTitle.textContent = 'Nueva Área';
            document.getElementById('formArea').reset();
            document.getElementById('areaId').value = '';
        }
        
        // Sincronizar color picker con input de texto
        document.getElementById('areaColor').addEventListener('input', (e) => {
            document.getElementById('areaColorHex').value = e.target.value;
        });
        
        document.getElementById('areaColorHex').addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                document.getElementById('areaColor').value = e.target.value;
            }
        });
        
        modal.show();
    }

    async editArea(areaId) {
        this.currentArea = this.areas.find(a => a.id === areaId);
        if (this.currentArea) {
            this.showModalArea();
        }
    }

    async deleteArea(areaId) {
        const area = this.areas.find(a => a.id === areaId);
        if (!area) return;
        
        if (!confirm(`¿Está seguro de eliminar el área "${area.nombre}"?\nEsta acción no se puede deshacer.`)) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('areas')
                .delete()
                .eq('id', areaId);
            
            if (error) throw error;
            
            UI.showToast('Área eliminada correctamente', 'success');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Error al eliminar área:', error);
            UI.showToast('Error al eliminar el área', 'error');
        }
    }

    async saveArea(e) {
        e.preventDefault();
        
        const areaId = document.getElementById('areaId').value;
        const areaData = {
            clave: document.getElementById('areaClave').value.toUpperCase(),
            nombre: document.getElementById('areaNombre').value,
            descripcion: document.getElementById('areaDescripcion').value || null,
            color_hex: document.getElementById('areaColorHex').value,
            estado: document.getElementById('areaEstado').value
        };
        
        try {
            let result;
            if (areaId) {
                // Actualizar área existente
                result = await supabase
                    .from('areas')
                    .update(areaData)
                    .eq('id', areaId);
            } else {
                // Crear nueva área
                result = await supabase
                    .from('areas')
                    .insert([areaData]);
            }
            
            if (result.error) throw result.error;
            
            UI.showToast(areaId ? 'Área actualizada correctamente' : 'Área creada correctamente', 'success');
            
            // Cerrar modal y recargar datos
            bootstrap.Modal.getInstance(document.getElementById('modalArea')).hide();
            await this.loadData();
            location.reload(); // Recargar para actualizar la vista
            
        } catch (error) {
            console.error('Error al guardar área:', error);
            UI.showToast('Error al guardar el área: ' + error.message, 'error');
        }
    }

    // ========== EVENT HANDLERS - USUARIOS ==========
    
    showModalUsuario() {
        const modal = new bootstrap.Modal(document.getElementById('modalUsuario'));
        const modalTitle = document.getElementById('modalUsuarioTitle');
        
        if (this.currentUsuario) {
            // Modo edición
            modalTitle.textContent = 'Editar Usuario';
            document.getElementById('usuarioId').value = this.currentUsuario.id;
            document.getElementById('usuarioEmail').value = this.currentUsuario.email;
            document.getElementById('usuarioEmail').disabled = true; // No se puede cambiar el email
            document.getElementById('usuarioNombre').value = this.currentUsuario.nombre || '';
            document.getElementById('usuarioArea').value = this.currentUsuario.area_id || '';
            document.getElementById('usuarioRol').value = this.currentUsuario.rol;
            document.getElementById('usuarioPuedeCapturar').checked = this.currentUsuario.puede_capturar;
            document.getElementById('usuarioPuedeEditar').checked = this.currentUsuario.puede_editar;
            document.getElementById('usuarioPuedeEliminar').checked = this.currentUsuario.puede_eliminar;
            document.getElementById('usuarioEstado').value = this.currentUsuario.activo.toString();
        } else {
            // Modo creación
            modalTitle.textContent = 'Nuevo Usuario';
            document.getElementById('formUsuario').reset();
            document.getElementById('usuarioId').value = '';
            document.getElementById('usuarioEmail').disabled = false;
        }
        
        modal.show();
    }

    async editUsuario(usuarioId) {
        this.currentUsuario = this.usuarios.find(u => u.id === usuarioId);
        if (this.currentUsuario) {
            this.showModalUsuario();
        }
    }

    async toggleUsuario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;
        
        const nuevoEstado = !usuario.activo;
        const accion = nuevoEstado ? 'activar' : 'desactivar';
        
        if (!confirm(`¿Está seguro de ${accion} al usuario "${usuario.nombre || usuario.email}"?`)) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ activo: nuevoEstado })
                .eq('id', usuarioId);
            
            if (error) throw error;
            
            UI.showToast(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`, 'success');
            await this.loadData();
            location.reload();
        } catch (error) {
            console.error('Error al cambiar estado del usuario:', error);
            UI.showToast('Error al cambiar el estado del usuario', 'error');
        }
    }

    async saveUsuario(e) {
        e.preventDefault();
        
        const usuarioId = document.getElementById('usuarioId').value;
        const usuarioData = {
            email: document.getElementById('usuarioEmail').value.toLowerCase(),
            nombre: document.getElementById('usuarioNombre').value || null,
            area_id: document.getElementById('usuarioArea').value || null,
            rol: document.getElementById('usuarioRol').value,
            puede_capturar: document.getElementById('usuarioPuedeCapturar').checked,
            puede_editar: document.getElementById('usuarioPuedeEditar').checked,
            puede_eliminar: document.getElementById('usuarioPuedeEliminar').checked,
            activo: document.getElementById('usuarioEstado').value === 'true'
        };
        
        try {
            let result;
            if (usuarioId) {
                // Actualizar usuario existente (sin el email)
                delete usuarioData.email;
                result = await supabase
                    .from('usuarios')
                    .update(usuarioData)
                    .eq('id', usuarioId);
            } else {
                // Crear nuevo usuario
                result = await supabase
                    .from('usuarios')
                    .insert([usuarioData]);
            }
            
            if (result.error) throw result.error;
            
            UI.showToast(usuarioId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
            
            // Cerrar modal y recargar datos
            bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
            await this.loadData();
            location.reload();
            
        } catch (error) {
            console.error('Error al guardar usuario:', error);
            UI.showToast('Error al guardar el usuario: ' + error.message, 'error');
        }
    }

    // ========== EVENT HANDLERS - ASIGNACIONES ==========
    
    showModalAsignacion() {
        const modal = new bootstrap.Modal(document.getElementById('modalAsignacion'));
        document.getElementById('formAsignacion').reset();
        modal.show();
    }

    async saveAsignacion(e) {
        e.preventDefault();
        
        const asignacionData = {
            area_id: document.getElementById('asignacionArea').value,
            rol: document.getElementById('asignacionRol').value,
            puede_capturar: document.getElementById('asignacionCapturar').checked,
            puede_editar: document.getElementById('asignacionEditar').checked,
            puede_eliminar: document.getElementById('asignacionEliminar').checked
        };
        
        const usuarioId = document.getElementById('asignacionUsuario').value;
        
        try {
            // Actualizar el usuario con la nueva asignación
            const { error } = await supabase
                .from('usuarios')
                .update(asignacionData)
                .eq('id', usuarioId);
            
            if (error) throw error;
            
            UI.showToast('Usuario asignado al área correctamente', 'success');
            
            // Cerrar modal y recargar datos
            bootstrap.Modal.getInstance(document.getElementById('modalAsignacion')).hide();
            await this.loadData();
            location.reload();
            
        } catch (error) {
            console.error('Error al asignar usuario:', error);
            UI.showToast('Error al asignar el usuario al área: ' + error.message, 'error');
        }
    }
}
// ========== MÉTODOS DE FILTRADO Y BÚSQUEDA ==========
    
    setupFilters() {
        // Filtro de búsqueda de usuarios
        const searchUsuarios = document.getElementById('searchUsuarios');
        if (searchUsuarios) {
            searchUsuarios.addEventListener('input', (e) => {
                this.filterUsuarios(e.target.value);
            });
        }
        
        // Filtro de rol
        const filterRol = document.getElementById('filterRol');
        if (filterRol) {
            filterRol.addEventListener('change', (e) => {
                this.filterUsuarios();
            });
        }
        
        // Filtro de estado
        const filterEstado = document.getElementById('filterEstado');
        if (filterEstado) {
            filterEstado.addEventListener('change', (e) => {
                this.filterUsuarios();
            });
        }
    }
    
    filterUsuarios(searchTerm = '') {
        const filterRol = document.getElementById('filterRol')?.value || '';
        const filterEstado = document.getElementById('filterEstado')?.value || '';
        const search = searchTerm || document.getElementById('searchUsuarios')?.value || '';
        
        let filteredUsuarios = this.usuarios;
        
        // Filtrar por búsqueda
        if (search) {
            filteredUsuarios = filteredUsuarios.filter(u => 
                u.email.toLowerCase().includes(search.toLowerCase()) ||
                (u.nombre && u.nombre.toLowerCase().includes(search.toLowerCase()))
            );
        }
        
        // Filtrar por rol
        if (filterRol) {
            filteredUsuarios = filteredUsuarios.filter(u => u.rol === filterRol);
        }
        
        // Filtrar por estado
        if (filterEstado) {
            const isActive = filterEstado === 'activo';
            filteredUsuarios = filteredUsuarios.filter(u => u.activo === isActive);
        }
        
        // Actualizar tabla
        this.updateUsuariosTable(filteredUsuarios);
    }
    
    updateUsuariosTable(usuarios) {
        const tbody = document.getElementById('usuariosTableBody');
        if (!tbody) return;
        
        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <p class="text-muted">No se encontraron usuarios con los filtros aplicados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = usuarios.map(usuario => `
            <tr>
                <td>${usuario.email}</td>
                <td>${usuario.nombre || 'Sin nombre'}</td>
                <td>
                    ${usuario.areas ? `
                        <span class="badge" style="background-color: ${usuario.areas.color_hex || '#6c757d'}">
                            ${usuario.areas.nombre}
                        </span>
                    ` : 'Sin asignar'}
                </td>
                <td>
                    <span class="badge bg-${this.getRoleBadgeColor(usuario.rol)}">
                        ${this.getRoleName(usuario.rol)}
                    </span>
                </td>
                <td>
                    <span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">
                        ${usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleDateString() : 'Nunca'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-edit-usuario" data-id="${usuario.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-warning btn-toggle-usuario" data-id="${usuario.id}" title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                            <i class="fas fa-${usuario.activo ? 'lock' : 'unlock'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Re-adjuntar event listeners a los nuevos botones
        this.attachEventListeners();
    }
    
    // ========== MÉTODOS DE INICIALIZACIÓN ==========
    
    async init() {
        try {
            await this.loadData();
            this.attachEventListeners();
            this.setupFilters();
            
            // Inicializar tooltips de Bootstrap si están disponibles
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
            
            console.log('AdminView inicializado correctamente');
        } catch (error) {
            console.error('Error al inicializar AdminView:', error);
            UI.showToast('Error al inicializar el panel de administración', 'error');
        }
    }
    
    // ========== MÉTODO DE LIMPIEZA ==========
    
    destroy() {
        // Limpiar event listeners si es necesario
        const modals = ['modalArea', 'modalUsuario', 'modalAsignacion'];
        modals.forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.dispose();
                }
            }
        });
        
        // Limpiar tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => {
            const tooltipInstance = bootstrap.Tooltip.getInstance(tooltip);
            if (tooltipInstance) {
                tooltipInstance.dispose();
            }
        });
        
        console.log('AdminView limpiado correctamente');
    }
}

// ========== EXPORTACIÓN DEL MÓDULO ==========

// Crear instancia singleton
const adminView = new AdminView();

// Exportar la instancia
export default adminView;

// También exportar la clase por si se necesita crear múltiples instancias
export { AdminView };

// ========== INICIALIZACIÓN AUTOMÁTICA ==========

// Si el módulo se carga en la página de administración, inicializar automáticamente
if (window.location.hash === '#/admin' || window.location.pathname.includes('admin')) {
    document.addEventListener('DOMContentLoaded', () => {
        adminView.init().catch(console.error);
    });
}

// Limpiar al cambiar de página
window.addEventListener('hashchange', () => {
    if (!window.location.hash.includes('admin')) {
        adminView.destroy();
    }
});

// ========== FIN DEL ARCHIVO admin.js ==========
