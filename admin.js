/**
 * admin.js - Lógica de Administración
 * Sistema de Indicadores AIFA 2.0
 * 
 * Maneja la gestión de usuarios, roles y configuración del sistema
 * Solo para usuarios con rol admin
 */

// Variables globales
let currentUser = null;
let users = [];
let roles = [];
let areas = [];
let currentTab = 'usuarios';
let userFilters = {};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadAdminInfo();
    await loadRoles();
    await loadAreas();
    await loadUsers();
    await loadSystemStats();
    setupEventListeners();
    updateLastAccess();
});

/**
 * Verificar autenticación y permisos de admin
 */
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        location.href = './login.html';
        return;
    }
    currentUser = session.user;

    // Verificar permisos de admin
    const isAdmin = await checkAdminPermissions();
    if (!isAdmin) {
        await notify('No tiene permisos de administrador', 'error');
        location.href = './index.html';
        return;
    }
}

/**
 * Verificar permisos de administrador
 */
async function checkAdminPermissions() {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('roles(nombre)')
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;
        return userData.roles.nombre === 'admin';
    } catch (error) {
        console.error('Error verificando permisos de admin:', error);
        return false;
    }
}

/**
 * Cargar información del administrador
 */
async function loadAdminInfo() {
    try {
        const { data: adminData, error } = await supabase
            .from('users')
            .select('username, nombre')
            .eq('email', currentUser.email)
            .single();

        if (error) throw error;

        document.getElementById('adminName').textContent = 
            adminData.nombre || adminData.username;

        // Cargar estadísticas de usuarios
        await loadUserStats();

    } catch (error) {
        console.error('Error cargando información del admin:', error);
        await notify('Error cargando información del administrador', 'error');
    }
}

/**
 * Cargar estadísticas de usuarios
 */
async function loadUserStats() {
    try {
        const { data: totalData, error: totalError } = await supabase
            .from('users')
            .select('id', { count: 'exact' });

        if (totalError) throw totalError;

        const { data: activeData, error: activeError } = await supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('activo', true);

        if (activeError) throw activeError;

        document.getElementById('totalUsers').textContent = totalData?.length || 0;
        document.getElementById('activeUsers').textContent = activeData?.length || 0;

    } catch (error) {
        console.error('Error cargando estadísticas de usuarios:', error);
    }
}

/**
 * Cargar roles
 */
async function loadRoles() {
    try {
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('id');

        if (error) throw error;

        roles = data || [];
        populateRoleSelects();
        await updateRoleStats();

    } catch (error) {
        console.error('Error cargando roles:', error);
        await notify('Error cargando roles', 'error');
    }
}

/**
 * Poblar selectores de roles
 */
function populateRoleSelects() {
    const userRoleFilter = document.getElementById('userRoleFilter');
    const userRole = document.getElementById('userRole');

    // Limpiar opciones actuales
    userRoleFilter.innerHTML = '<option value="">Todos los roles</option>';
    userRole.innerHTML = '<option value="">Seleccione un rol...</option>';

    roles.forEach(role => {
        // Filtro de roles
        const filterOption = document.createElement('option');
        filterOption.value = role.id;
        filterOption.textContent = role.nombre;
        userRoleFilter.appendChild(filterOption);

        // Selector de rol en modal
        const roleOption = document.createElement('option');
        roleOption.value = role.id;
        roleOption.textContent = role.nombre;
        userRole.appendChild(roleOption);
    });
}

/**
 * Actualizar estadísticas de roles
 */
async function updateRoleStats() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('roles(nombre)')
            .eq('activo', true);

        if (error) throw error;

        // Contar usuarios por rol
        const roleCounts = {};
        data.forEach(user => {
            const roleName = user.roles?.nombre;
            if (roleName) {
                roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
            }
        });

        // Actualizar contadores en la UI
        document.getElementById('capturistaCount').textContent = roleCounts['capturista'] || 0;
        document.getElementById('jefeAreaCount').textContent = roleCounts['jefe_area'] || 0;
        document.getElementById('subdirectorCount').textContent = roleCounts['subdirector'] || 0;
        document.getElementById('directorCount').textContent = roleCounts['director'] || 0;
        document.getElementById('adminCount').textContent = roleCounts['admin'] || 0;

    } catch (error) {
        console.error('Error actualizando estadísticas de roles:', error);
    }
}

/**
 * Cargar áreas
 */
async function loadAreas() {
    try {
        const { data, error } = await supabase
            .from('areas')
            .select('*')
            .order('nombre');

        if (error) throw error;

        areas = data || [];
        updateAreasGrid();
        populateAreaCheckboxes();

    } catch (error) {
        console.error('Error cargando áreas:', error);
        await notify('Error cargando áreas', 'error');
    }
}

/**
 * Actualizar grid de áreas
 */
function updateAreasGrid() {
    const grid = document.getElementById('areasGrid');
    
    if (!areas || areas.length === 0) {
        grid.innerHTML = `
            <div class="no-areas">
                <i class="fas fa-building"></i>
                <p>No hay áreas registradas</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = areas.map(area => `
        <div class="area-card ${area.activo ? 'active' : 'inactive'}">
            <div class="area-header">
                <h4>${area.nombre}</h4>
                <span class="area-status ${area.activo ? 'status-active' : 'status-inactive'}">
                    ${area.activo ? 'Activa' : 'Inactiva'}
                </span>
            </div>
            <div class="area-actions">
                <button class="btn btn-sm btn-primary" onclick="editArea(${area.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm ${area.activo ? 'btn-warning' : 'btn-success'}" 
                        onclick="toggleAreaStatus(${area.id})" 
                        title="${area.activo ? 'Desactivar' : 'Activar'}">
                    <i class="fas ${area.activo ? 'fa-pause' : 'fa-play'}"></i>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Poblar checkboxes de áreas en modal de usuario
 */
function populateAreaCheckboxes() {
    const container = document.getElementById('userAreasCheckboxes');
    container.innerHTML = '';

    areas.filter(area => area.activo).forEach(area => {
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-item';
        
        checkboxWrapper.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" value="${area.id}" name="userAreas">
                ${area.nombre}
            </label>
        `;
        
        container.appendChild(checkboxWrapper);
    });
}
/**
 * Cargar usuarios
 */
async function loadUsers() {
    try {
        showUsersLoading(true);

        let query = supabase
            .from('users')
            .select(`
                id, username, email, nombre, activo, created_at,
                roles(id, nombre),
                user_areas(areas(id, nombre))
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (userFilters.role) {
            query = query.eq('rol_id', userFilters.role);
        }
        
        if (userFilters.status !== undefined && userFilters.status !== '') {
            query = query.eq('activo', userFilters.status === 'true');
        }

        if (userFilters.search) {
            query = query.or(`nombre.ilike.%${userFilters.search}%,email.ilike.%${userFilters.search}%,username.ilike.%${userFilters.search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        users = data || [];
        populateUsersTable();

    } catch (error) {
        console.error('Error cargando usuarios:', error);
        await notify('Error cargando usuarios: ' + error.message, 'error');
    } finally {
        showUsersLoading(false);
    }
}

/**
 * Poblar tabla de usuarios
 */
function populateUsersTable() {
    const tbody = document.getElementById('usersTableBody');

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="8">
                    <div class="no-data-message">
                        <i class="fas fa-users"></i>
                        No se encontraron usuarios
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const fecha = new Date(user.created_at).toLocaleDateString('es-MX');
        const areas = user.user_areas.map(ua => ua.areas.nombre).join(', ') || 'Sin áreas';
        const isCurrentUser = user.email === currentUser.email;
        
        return `
            <tr class="${user.activo ? '' : 'inactive-row'}">
                <td>
                    <strong>${user.username}</strong>
                    ${isCurrentUser ? '<span class="badge badge-info">Tú</span>' : ''}
                </td>
                <td>${user.nombre || 'Sin nombre'}</td>
                <td>${user.email}</td>
                <td>
                    <span class="role-badge role-${user.roles?.nombre || 'none'}">
                        ${user.roles?.nombre || 'Sin rol'}
                    </span>
                </td>
                <td title="${areas}">${truncateText(areas, 30)}</td>
                <td>
                    <span class="status-badge ${user.activo ? 'status-active' : 'status-inactive'}">
                        ${user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${fecha}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!isCurrentUser ? `
                            <button class="btn btn-sm ${user.activo ? 'btn-warning' : 'btn-success'}" 
                                    onclick="toggleUserStatus(${user.id})" 
                                    title="${user.activo ? 'Desactivar' : 'Activar'}">
                                <i class="fas ${user.activo ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-info" onclick="resetUserPassword(${user.id})" title="Resetear contraseña">
                            <i class="fas fa-key"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.href = './login.html';
    });

    // Tabs
    window.showTab = showTab;

    // Botones principales
    document.getElementById('newUserBtn').addEventListener('click', () => openUserModal('create'));
    document.getElementById('newAreaBtn').addEventListener('click', createNewArea);

    // Filtros de usuarios
    document.getElementById('searchUsersBtn').addEventListener('click', applyUserFilters);
    document.getElementById('clearUserFiltersBtn').addEventListener('click', clearUserFilters);
    document.getElementById('userSearchFilter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyUserFilters();
    });

    // Modal de usuario
    document.getElementById('closeUserModalBtn').addEventListener('click', closeUserModal);
    document.getElementById('cancelUserBtn').addEventListener('click', closeUserModal);
    document.getElementById('saveUserBtn').addEventListener('click', saveUser);

    // Herramientas del sistema
    document.getElementById('exportUsersBtn').addEventListener('click', exportUsers);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('systemReportBtn').addEventListener('click', generateSystemReport);

    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserModal();
        }
    });
}

/**
 * Mostrar tab
 */
function showTab(tabName) {
    // Actualizar botones de tab
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`button[onclick="showTab('${tabName}')"]`).classList.add('active');

    // Mostrar contenido del tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    currentTab = tabName;

    // Cargar datos específicos del tab si es necesario
    if (tabName === 'sistema') {
        loadSystemStats();
    }
}

/**
 * Aplicar filtros de usuarios
 */
function applyUserFilters() {
    userFilters = {
        role: document.getElementById('userRoleFilter').value,
        status: document.getElementById('userStatusFilter').value,
        search: document.getElementById('userSearchFilter').value.trim()
    };

    loadUsers();
}

/**
 * Limpiar filtros de usuarios
 */
function clearUserFilters() {
    document.getElementById('userRoleFilter').value = '';
    document.getElementById('userStatusFilter').value = '';
    document.getElementById('userSearchFilter').value = '';
    
    userFilters = {};
    loadUsers();
}

/**
 * Abrir modal de usuario
 */
function openUserModal(mode, userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const passwordGroup = document.getElementById('passwordGroup');
    
    // Resetear formulario
    form.reset();
    document.getElementById('userFormMode').value = mode;
    document.getElementById('editUserId').value = userId || '';
    
    // Configurar modal según el modo
    if (mode === 'create') {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Usuario';
        passwordGroup.style.display = 'block';
        document.getElementById('userPassword').required = true;
        document.getElementById('userActivo').checked = true;
    } else {
        title.innerHTML = '<i class="fas fa-user-edit"></i> Editar Usuario';
        passwordGroup.style.display = 'none';
        document.getElementById('userPassword').required = false;
        
        // Llenar formulario con datos existentes
        const user = users.find(u => u.id === userId);
        if (user) {
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userNombre').value = user.nombre || '';
            document.getElementById('userRole').value = user.roles?.id || '';
            document.getElementById('userActivo').checked = user.activo;
            
            // Seleccionar áreas
            const userAreaIds = user.user_areas.map(ua => ua.areas.id);
            document.querySelectorAll('input[name="userAreas"]').forEach(checkbox => {
                checkbox.checked = userAreaIds.includes(parseInt(checkbox.value));
            });
        }
    }
    
    modal.style.display = 'block';
}

/**
 * Cerrar modal de usuario
 */
function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

/**
 * Guardar usuario (crear o editar)
 */
async function saveUser() {
    const mode = document.getElementById('userFormMode').value;
    const userId = document.getElementById('editUserId').value;
    
    // Obtener datos del formulario
    const userData = {
        username: document.getElementById('userUsername').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        nombre: document.getElementById('userNombre').value.trim(),
        rol_id: parseInt(document.getElementById('userRole').value),
        activo: document.getElementById('userActivo').checked
    };

    const password = document.getElementById('userPassword').value;
    
    // Obtener áreas seleccionadas
    const selectedAreas = Array.from(document.querySelectorAll('input[name="userAreas"]:checked'))
        .map(checkbox => parseInt(checkbox.value));

    // Validaciones básicas
    if (!userData.username || !userData.email || !userData.nombre || !userData.rol_id) {
        await notify('Complete todos los campos requeridos', 'error');
        return;
    }

    if (mode === 'create' && !password) {
        await notify('La contraseña es requerida para usuarios nuevos', 'error');
        return;
    }

    if (password && password.length < 6) {
        await notify('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        if (mode === 'create') {
            await createUser(userData, password, selectedAreas);
        } else {
            await updateUser(parseInt(userId), userData, selectedAreas);
        }
        
        closeUserModal();
        await loadUsers();
        await loadUserStats();
        await updateRoleStats();
        
    } catch (error) {
        console.error('Error guardando usuario:', error);
        
        let errorMessage = 'Error guardando usuario: ';
        if (error.code === '23505') {
            if (error.message.includes('username')) {
                errorMessage += 'El nombre de usuario ya existe';
            } else if (error.message.includes('email')) {
                errorMessage += 'El email ya está registrado';
            } else {
                errorMessage += 'Ya existe un usuario con esos datos';
            }
        } else {
            errorMessage += error.message;
        }
        
        await notify(errorMessage, 'error');
    }
}

/**
 * Crear usuario nuevo
 */
async function createUser(userData, password, selectedAreas) {
    // Primero crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: password,
        email_confirm: true
    });

    if (authError) throw authError;

    // Luego crear registro en tabla users
    const { data: userRecord, error: userError } = await supabase
        .from('users')
        .insert([{
            id: authData.user.id,
            username: userData.username,
            email: userData.email,
            nombre: userData.nombre,
            rol_id: userData.rol_id,
            activo: userData.activo
        }])
        .select()
        .single();

    if (userError) {
        // Si falla, eliminar usuario de Auth
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
    }

    // Asignar áreas
    if (selectedAreas.length > 0) {
        const userAreas = selectedAreas.map(areaId => ({
            user_id: userRecord.id,
            area_id: areaId
        }));

        const { error: areasError } = await supabase
            .from('user_areas')
            .insert(userAreas);

        if (areasError) {
            console.error('Error asignando áreas:', areasError);
        }
    }

    await notify('Usuario creado exitosamente', 'success');
}

/**
 * Actualizar usuario existente
 */
async function updateUser(userId, userData, selectedAreas) {
    // Actualizar datos básicos del usuario
    const { error: updateError } = await supabase
        .from('users')
        .update({
            username: userData.username,
            email: userData.email,
            nombre: userData.nombre,
            rol_id: userData.rol_id,
            activo: userData.activo,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (updateError) throw updateError;

    // Actualizar áreas: eliminar todas y volver a insertar
    await supabase
        .from('user_areas')
        .delete()
        .eq('user_id', userId);

    if (selectedAreas.length > 0) {
        const userAreas = selectedAreas.map(areaId => ({
            user_id: userId,
            area_id: areaId
        }));

        const { error: areasError } = await supabase
            .from('user_areas')
            .insert(userAreas);

        if (areasError) {
            console.error('Error actualizando áreas:', areasError);
        }
    }

    await notify('Usuario actualizado exitosamente', 'success');
}

/**
 * Editar usuario
 */
function editUser(userId) {
    openUserModal('edit', userId);
}

/**
 * Cambiar estado de usuario (activo/inactivo)
 */
async function toggleUserStatus(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newStatus = !user.activo;
    const action = newStatus ? 'activar' : 'desactivar';
    
    if (!confirm(`¿Está seguro de que desea ${action} al usuario ${user.username}?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ 
                activo: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        await notify(`Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`, 'success');
        await loadUsers();
        await loadUserStats();

    } catch (error) {
        console.error('Error cambiando estado del usuario:', error);
        await notify('Error cambiando estado del usuario: ' + error.message, 'error');
    }
}

/**
 * Eliminar usuario
 */
async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`¿Está seguro de que desea ELIMINAR permanentemente al usuario ${user.username}?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        // Eliminar relaciones primero
        await supabase.from('user_areas').delete().eq('user_id', userId);
        
        // Eliminar usuario de tabla users
        const { error: userError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (userError) throw userError;

        // Eliminar de Supabase Auth
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
            console.error('Error eliminando de Auth:', authError);
        }

        await notify('Usuario eliminado exitosamente', 'success');
        await loadUsers();
        await loadUserStats();

    } catch (error) {
        console.error('Error eliminando usuario:', error);
        await notify('Error eliminando usuario: ' + error.message, 'error');
    }
}

/**
 * Resetear contraseña de usuario
 */
async function resetUserPassword(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newPassword = prompt(`Ingrese la nueva contraseña para ${user.username}:\n(mínimo 6 caracteres)`);
    
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
        await notify('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) throw error;

        await notify('Contraseña actualizada exitosamente', 'success');

    } catch (error) {
        console.error('Error reseteando contraseña:', error);
        await notify('Error reseteando contraseña: ' + error.message, 'error');
    }
}

/**
 * Cargar estadísticas del sistema
 */
async function loadSystemStats() {
    try {
        // Estadísticas de base de datos
        const [indicatorsResult, valuesResult, deletedResult] = await Promise.all([
            supabase.from('indicadores').select('id', { count: 'exact' }).eq('activo', true),
            supabase.from('indicador_valores').select('id', { count: 'exact' }).is('deleted_at', null),
            supabase.from('indicador_valores').select('id', { count: 'exact' }).not('deleted_at', 'is', null)
        ]);

        document.getElementById('totalIndicators').textContent = indicatorsResult.count || 0;
        document.getElementById('totalValues').textContent = valuesResult.count || 0;
        document.getElementById('deletedValues').textContent = deletedResult.count || 0;

        // Estadísticas de actividad
        await loadActivityStats();

    } catch (error) {
        console.error('Error cargando estadísticas del sistema:', error);
    }
}

/**
 * Cargar estadísticas de actividad
 */
async function loadActivityStats() {
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        const weekStartISO = weekStart.toISOString();

        // Capturas de hoy
        const { count: todayCaptures } = await supabase
            .from('indicador_valores')
            .select('id', { count: 'exact' })
            .gte('created_at', todayStart);

        // Capturas de la semana
        const { count: weekCaptures } = await supabase
            .from('indicador_valores')
            .select('id', { count: 'exact' })
            .gte('created_at', weekStartISO);

        // Usuarios activos hoy (que han capturado datos)
        const { data: todayActiveData } = await supabase
            .from('indicador_valores')
            .select('created_by')
            .gte('created_at', todayStart);

        const todayActiveUsers = new Set(todayActiveData?.map(r => r.created_by) || []).size;

        document.getElementById('todayCaptures').textContent = todayCaptures || 0;
        document.getElementById('weekCaptures').textContent = weekCaptures || 0;
        document.getElementById('todayActiveUsers').textContent = todayActiveUsers;

    } catch (error) {
        console.error('Error cargando estadísticas de actividad:', error);
    }
}

/**
 * Crear nueva área
 */
async function createNewArea() {
    const areaName = prompt('Ingrese el nombre de la nueva área:');
    
    if (!areaName || !areaName.trim()) return;

    try {
        const { error } = await supabase
            .from('areas')
            .insert([{
                nombre: areaName.trim(),
                activo: true
            }]);

        if (error) throw error;

        await notify('Área creada exitosamente', 'success');
        await loadAreas();

    } catch (error) {
        console.error('Error creando área:', error);
        
        let errorMessage = 'Error creando área: ';
        if (error.code === '23505') {
            errorMessage += 'Ya existe un área con ese nombre';
        } else {
            errorMessage += error.message;
        }
        
        await notify(errorMessage, 'error');
    }
}

/**
 * Editar área
 */
async function editArea(areaId) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const newName = prompt('Ingrese el nuevo nombre del área:', area.nombre);
    
    if (!newName || !newName.trim() || newName.trim() === area.nombre) return;

    try {
        const { error } = await supabase
            .from('areas')
            .update({ 
                nombre: newName.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', areaId);

        if (error) throw error;

        await notify('Área actualizada exitosamente', 'success');
        await loadAreas();

    } catch (error) {
        console.error('Error actualizando área:', error);
        await notify('Error actualizando área: ' + error.message, 'error');
    }
}

/**
 * Cambiar estado de área
 */
async function toggleAreaStatus(areaId) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const newStatus = !area.activo;
    const action = newStatus ? 'activar' : 'desactivar';
    
    if (!confirm(`¿Está seguro de que desea ${action} el área ${area.nombre}?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('areas')
            .update({ 
                activo: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', areaId);

        if (error) throw error;

        await notify(`Área ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 'success');
        await loadAreas();

    } catch (error) {
        console.error('Error cambiando estado del área:', error);
        await notify('Error cambiando estado del área: ' + error.message, 'error');
    }
}

/**
 * Exportar usuarios
 */
async function exportUsers() {
    try {
        const csvContent = generateUsersCSV();
        downloadCSV(csvContent, 'usuarios_aifa.csv');
        await notify('Usuarios exportados exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando usuarios:', error);
        await notify('Error exportando usuarios', 'error');
    }
}

/**
 * Generar CSV de usuarios
 */
function generateUsersCSV() {
    const headers = ['Username', 'Nombre', 'Email', 'Rol', 'Estado', 'Áreas', 'Fecha Registro'];
    
    const rows = users.map(user => [
        user.username,
        user.nombre || '',
        user.email,
        user.roles?.nombre || 'Sin rol',
        user.activo ? 'Activo' : 'Inactivo',
        user.user_areas.map(ua => ua.areas.nombre).join('; '),
        new Date(user.created_at).toLocaleDateString('es-MX')
    ]);

    return [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
}

/**
 * Exportar datos del sistema
 */
async function exportData() {
    try {
        await notify('Generando reporte de datos...', 'info');
        
        // Esta sería una función más compleja que exportaría datos de indicadores
        // Por ahora solo mostramos un mensaje
        setTimeout(async () => {
            await notify('Funcionalidad en desarrollo', 'warning');
        }, 1500);

    } catch (error) {
        console.error('Error exportando datos:', error);
        await notify('Error exportando datos', 'error');
    }
}

/**
 * Generar reporte del sistema
 */
async function generateSystemReport() {
    try {
        await notify('Generando reporte del sistema...', 'info');
        
        const report = `
REPORTE DEL SISTEMA AIFA INDICADORES 2.0
Fecha: ${new Date().toLocaleDateString('es-MX')}

USUARIOS:
- Total: ${document.getElementById('totalUsers').textContent}
- Activos: ${document.getElementById('activeUsers').textContent}

INDICADORES:
- Total: ${document.getElementById('totalIndicators').textContent}
- Valores capturados: ${document.getElementById('totalValues').textContent}
- Valores eliminados: ${document.getElementById('deletedValues').textContent}

ACTIVIDAD:
- Capturas hoy: ${document.getElementById('todayCaptures').textContent}
- Capturas esta semana: ${document.getElementById('weekCaptures').textContent}
- Usuarios activos hoy: ${document.getElementById('todayActiveUsers').textContent}

ÁREAS:
${areas.map(area => `- ${area.nombre} (${area.activo ? 'Activa' : 'Inactiva'})`).join('\n')}
        `;

        downloadText(report, 'reporte_sistema_aifa.txt');
        await notify('Reporte generado exitosamente', 'success');

    } catch (error) {
        console.error('Error generando reporte:', error);
        await notify('Error generando reporte', 'error');
    }
}

/**
 * Funciones de utilidad
 */
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
}

function downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function showUsersLoading(loading) {
    const tbody = document.getElementById('usersTableBody');
    if (loading) {
        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="8">
                    <i class="fas fa-spinner fa-spin"></i> Cargando usuarios...
                </td>
            </tr>
        `;
    }
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function updateLastAccess() {
    const now = new Date();
    const formatted = now.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('lastAccess').textContent = formatted;
}

// Funciones globales para onclick en HTML
window.showTab = showTab;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.resetUserPassword = resetUserPassword;
window.editArea = editArea;
window.toggleAreaStatus = toggleAreaStatus;
