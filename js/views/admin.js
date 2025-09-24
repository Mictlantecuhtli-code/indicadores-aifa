// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE USUARIOS
// =====================================================
import { DEBUG, VALIDATION } from '../config.js';
import {
    appState,
    getCurrentProfile,
    fetchAdminAreas,
    fetchAdminUsers,
    createUserWithProfile,
    updateUserProfile,
    deleteUserAccount,
    createAreaAssignment,
    updateAreaAssignment,
    removeAreaAssignment
} from '../lib/supa.js';
import {
    showToast,
    showLoading,
    hideLoading,
    showModal,
    showConfirmModal,
    validateForm,
    getFormData,
    formatDate
} from '../lib/ui.js';

const ROLE_OPTIONS = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'SUBDIRECTOR', label: 'Subdirector' },
    { value: 'JEFE_AREA', label: 'Jefe de Área' },
    { value: 'CAPTURISTA', label: 'Capturista' }
];

const ESTADO_OPTIONS = [
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'INACTIVO', label: 'Inactivo' }
];

const PERMISSION_OPTIONS = [
    { key: 'puede_capturar', label: 'Capturar' },
    { key: 'puede_editar', label: 'Editar' },
    { key: 'puede_eliminar', label: 'Eliminar' }
];


const adminState = {
    areas: [],
    users: [],
    selectedUserId: null,
    filters: {
        search: '',
        estado: 'TODOS',
        rol: 'TODOS'
    }
};
let adminContainerRef = null;

// =====================================================
// RENDER PRINCIPAL
// =====================================================

export async function render(container) {
    adminContainerRef = container;
    container.innerHTML = renderLayout();
    setupStaticListeners(container);

    try {
        showLoading('Cargando panel de administración...');

        const isAdmin = await ensureAdminProfile();
        if (!isAdmin) {
            renderAccessDenied();
            return;
        }

        await loadInitialData();
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
    } catch (error) {
        console.error('❌ Error al renderizar panel de administración:', error);
        container.innerHTML = renderErrorState(error);
        showToast('No se pudo cargar el panel de administración', 'error');
    } finally {
        hideLoading();
    }
}

function renderLayout() {
    const roleOptions = ROLE_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
    const estadoOptions = ESTADO_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('');

    return `
        <section class="space-y-6">
            <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Administración de usuarios</h2>
                    <p class="text-gray-600">Gestiona perfiles, roles principales y permisos por área.</p>
                </div>
                <button
                    id="create-user-button"
                    class="inline-flex items-center justify-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aifa-dark"
                >
                    <i data-lucide="user-plus" class="w-4 h-4"></i>
                    Nuevo usuario
                </button>
            </header>

            <section class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div class="border-b border-gray-200 p-4">
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Buscar usuario</span>
                            <input
                                id="user-search"
                                type="search"
                                placeholder="Nombre, correo o teléfono"
                                class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                            />
                        </label>
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Estado</span>
                            <select
                                id="filter-estado"
                                class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                            >
                                <option value="TODOS">Todos</option>
                                ${estadoOptions}
                            </select>
                        </label>
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Rol principal</span>
                            <select
                                id="filter-rol"
                                class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                            >
                                <option value="TODOS">Todos</option>
                                ${roleOptions}
                            </select>
                        </label>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th class="px-4 py-3">Usuario</th>
                                <th class="px-4 py-3">Rol</th>
                                <th class="px-4 py-3">Áreas asignadas</th>
                                <th class="px-4 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody id="user-table-body" class="divide-y divide-gray-100 bg-white">
                            <tr>
                                <td colspan="4" class="py-6 text-center text-sm text-gray-500">Cargando usuarios…</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div id="user-detail" class="p-6">
                    <div class="text-center text-sm text-gray-500">
                        Selecciona un usuario para ver sus detalles y permisos.
                    </div>
                </div>
            </section>
        </section>
    `;
}

function setupStaticListeners(container) {
    container.querySelector('#user-search')?.addEventListener('input', (event) => {
        adminState.filters.search = event.target.value;
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
    });

    container.querySelector('#filter-estado')?.addEventListener('change', (event) => {
        adminState.filters.estado = event.target.value;
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
    });

    container.querySelector('#filter-rol')?.addEventListener('change', (event) => {
        adminState.filters.rol = event.target.value;
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
    });

    container.querySelector('#create-user-button')?.addEventListener('click', () => {
        openCreateUserModal();
    });

    container.querySelector('#user-table-body')?.addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-user-id]');
        if (!row) return;
        const userId = row.getAttribute('data-user-id');
        if (!userId || userId === adminState.selectedUserId) return;
        adminState.selectedUserId = userId;
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
    });
}

// =====================================================
// CARGA DE DATOS
// =====================================================


async function ensureAdminProfile() {
    if (!appState.profile) {
        await getCurrentProfile();

    }

    if (appState.profile?.rol_principal === 'ADMIN') {
        return true;
    }

    if (DEBUG.enabled) {
        console.warn('⚠️ Usuario sin privilegios de administrador');
    }

    return false;
}

async function loadInitialData() {
    const [areas, users] = await Promise.all([
        fetchAdminAreas(),
        fetchAdminUsers()
    ]);

    adminState.areas = (areas || []).filter(area => area.estado !== 'ELIMINADO');
    adminState.users = (users || []).map(user => ({
        ...user,
        assignments: sortAssignments(user.assignments || [])
    }));

    sortUsers();

    if (adminState.users.length > 0) {
        if (!adminState.selectedUserId || !adminState.users.some(user => user.id === adminState.selectedUserId)) {
            adminState.selectedUserId = adminState.users[0].id;
        }
    } else {
        adminState.selectedUserId = null;
    }
}

// =====================================================
// RENDER DE TABLAS Y DETALLES
// =====================================================

function renderUsersTable() {
    if (!adminContainerRef) return;
    const tbody = adminContainerRef.querySelector('#user-table-body');
    if (!tbody) return;

    if (adminState.users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-sm text-gray-500">
                    No hay usuarios registrados. Crea el primero para comenzar.
                </td>
            </tr>
        `;
        return;

    }

    const filteredUsers = getFilteredUsers();

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-sm text-gray-500">
                    No se encontraron usuarios con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    if (!filteredUsers.some(user => user.id === adminState.selectedUserId)) {
        adminState.selectedUserId = filteredUsers[0].id;
    }

    tbody.innerHTML = filteredUsers.map(user => renderUserRow(user)).join('');
}

function renderUserRow(user) {
    const isSelected = user.id === adminState.selectedUserId;
    const assignmentsCount = user.assignments?.length || 0;
    const activeAssignments = user.assignments?.filter(assignment => assignment.estado === 'ACTIVO').length || 0;
    const lastUpdate = user.fecha_actualizacion ? formatDate(user.fecha_actualizacion, 'short') : 'Sin registro';

    return `
        <tr
            data-user-id="${user.id}"
            class="${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer transition"
        >
            <td class="px-4 py-3">
                <div class="font-medium text-gray-900">${escapeHTML(user.nombre_completo || 'Sin nombre')}</div>
                <div class="text-xs text-gray-500">${escapeHTML(user.email)}</div>
            </td>
            <td class="px-4 py-3">
                ${renderRoleBadge(user.rol_principal)}
            </td>
            <td class="px-4 py-3">
                <div class="text-sm text-gray-900">${activeAssignments} activ${activeAssignments === 1 ? 'a' : 'as'}</div>
                <div class="text-xs text-gray-500">${assignmentsCount} en total</div>
            </td>
            <td class="px-4 py-3">
                ${renderStatusBadge(user.estado)}
                <div class="mt-1 text-xs text-gray-400">Act. ${lastUpdate}</div>
            </td>
        </tr>
    `;
}

function renderUserDetail() {
    if (!adminContainerRef) return;
    const container = adminContainerRef.querySelector('#user-detail');
    if (!container) return;

    const user = getSelectedUser();

    if (!user) {
        container.innerHTML = `
            <div class="text-center text-sm text-gray-500">
                Selecciona un usuario para ver sus detalles y permisos.
            </div>
        `;
        return;
    }

    const ultimoAcceso = user.ultimo_acceso ? formatDate(user.ultimo_acceso, 'long') : 'Sin registro';
    const fechaCreacion = user.fecha_creacion ? formatDate(user.fecha_creacion, 'long') : 'Sin registro';

    container.innerHTML = `
        <div class="flex flex-col gap-6">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h3 class="text-xl font-semibold text-gray-900">${escapeHTML(user.nombre_completo || user.email)}</h3>
                    <div class="mt-1 text-sm text-gray-500">${escapeHTML(user.email)}</div>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                        ${renderDetailChip('Rol principal', getRoleLabel(user.rol_principal))}
                        ${renderDetailChip('Estado', getStatusText(user.estado))}
                        ${renderDetailChip('Último acceso', ultimoAcceso)}
                        ${renderDetailChip('Registrado', fechaCreacion)}
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        id="edit-user-button"
                        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                    >
                        <i data-lucide="edit" class="w-4 h-4"></i>
                        Editar perfil
                    </button>
                    <button
                        id="delete-user-button"
                        class="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                    >
                        <i data-lucide="user-x" class="w-4 h-4"></i>
                        Desactivar usuario
                    </button>
                </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                ${renderSummaryField('Teléfono', user.telefono || 'No registrado')}
                ${renderSummaryField('Puesto', user.puesto || 'No registrado')}
                ${renderSummaryField('Asignaciones activas', `${user.assignments?.filter(a => a.estado === 'ACTIVO').length || 0}`)}
                ${renderSummaryField('Asignaciones totales', `${user.assignments?.length || 0}`)}
            </div>

            <div class="rounded-lg border border-gray-200">
                <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <div>
                        <h4 class="text-sm font-semibold text-gray-900">Áreas asignadas</h4>
                        <p class="text-xs text-gray-500">Gestiona roles y permisos por área.</p>
                    </div>
                    <button
                        id="add-assignment-button"
                        class="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-aifa-dark"
                    >
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Asignar área
                    </button>
                </div>
                <div class="overflow-x-auto">
                    ${renderAssignmentsTable(user)}
                </div>
            </div>
        </div>
    `;

    attachDetailListeners(user);
}

function renderSummaryField(label, value) {
    return `
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">${escapeHTML(label)}</div>
            <div class="mt-1 text-sm text-gray-900">${escapeHTML(value)}</div>
        </div>
    `;
}

function renderAssignmentsTable(user) {
    if (!user.assignments || user.assignments.length === 0) {
        return `
            <div class="px-6 py-10 text-center text-sm text-gray-500">
                El usuario no tiene áreas asignadas.
            </div>
        `;
    }

    const rows = user.assignments.map(assignment => {
        const area = assignment.area || assignment.areas || {};
        const asignacion = assignment.fecha_asignacion ? formatDate(assignment.fecha_asignacion, 'short') : 'Sin registro';

        return `
            <tr class="border-b border-gray-100 last:border-b-0">
                <td class="whitespace-nowrap px-6 py-4 align-top">
                    <div class="font-medium text-gray-900">${escapeHTML(area.nombre || 'Área no disponible')}</div>
                    <div class="text-xs text-gray-500">${escapeHTML(area.clave || assignment.area_id)}</div>
                    <div class="mt-1 text-xs text-gray-400">Asignado: ${asignacion}</div>
                </td>
                <td class="whitespace-nowrap px-6 py-4 align-top">
                    ${renderRoleBadge(assignment.rol)}
                </td>
                <td class="px-6 py-4 align-top">
                    <div class="flex flex-wrap gap-2">
                        ${PERMISSION_OPTIONS.map(option => renderPermissionChip(option, assignment[option.key])).join('')}
                    </div>
                </td>
                <td class="whitespace-nowrap px-6 py-4 align-top">
                    ${renderStatusBadge(assignment.estado)}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-right align-top">
                    <div class="flex items-center justify-end gap-2">
                        <button
                            class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                            data-action="edit-assignment"
                            data-assignment-id="${assignment.id}"
                        >
                            <i data-lucide="settings" class="w-4 h-4"></i>
                            Editar
                        </button>
                        <button
                            class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                            data-action="delete-assignment"
                            data-assignment-id="${assignment.id}"
                        >
                            <i data-lucide="trash" class="w-4 h-4"></i>
                            Quitar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                    <th class="px-6 py-3">Área</th>
                    <th class="px-6 py-3">Rol</th>
                    <th class="px-6 py-3">Permisos</th>
                    <th class="px-6 py-3">Estado</th>
                    <th class="px-6 py-3 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody class="bg-white">
                ${rows}
            </tbody>
        </table>
    `;
}

function attachDetailListeners(user) {
    if (!adminContainerRef) return;
    const detail = adminContainerRef.querySelector('#user-detail');
    if (!detail) return;

    detail.querySelector('#edit-user-button')?.addEventListener('click', () => openEditUserModal(user));

    detail.querySelector('#delete-user-button')?.addEventListener('click', () => handleDeleteUser(user));

    detail.querySelector('#add-assignment-button')?.addEventListener('click', () => openAssignmentModal(user));

    detail.querySelectorAll('[data-action="edit-assignment"]').forEach(button => {
        const assignmentId = button.getAttribute('data-assignment-id');
        button.addEventListener('click', () => {
            const assignment = user.assignments.find(item => item.id === assignmentId);
            if (!assignment) {
                showToast('Asignación no encontrada', 'error');
                return;
            }
            openAssignmentModal(user, assignment);
        });
    });

    detail.querySelectorAll('[data-action="delete-assignment"]').forEach(button => {
        const assignmentId = button.getAttribute('data-assignment-id');
        button.addEventListener('click', () => {
            const assignment = user.assignments.find(item => item.id === assignmentId);
            if (!assignment) {
                showToast('Asignación no encontrada', 'error');
                return;
            }
            handleRemoveAssignment(user, assignment);
        });
    });
}

// =====================================================
// MODALES Y ACCIONES
// =====================================================

function openCreateUserModal() {
    const modalId = showModal({
        title: 'Crear usuario',
        content: renderUserForm(),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Crear usuario',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('user-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getUserValidationRules(true));
                    if (!isValid) return false;

                    const formData = getFormData(form);

                    try {
                        showLoading('Creando usuario...');

                        const newUser = await createUserWithProfile({
                            email: formData.email.trim(),
                            password: formData.password,
                            nombre_completo: formData.nombre_completo.trim(),
                            rol_principal: formData.rol_principal,
                            telefono: formData.telefono?.trim() || null,
                            puesto: formData.puesto?.trim() || null,
                            estado: formData.estado
                        });

                        adminState.users.push({ ...newUser, assignments: [] });
                        sortUsers();
                        adminState.selectedUserId = newUser.id;
                        renderUsersTable();
                        renderUserDetail();
                        refreshIcons();

                        showToast('Usuario creado correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al crear usuario:', error);
                        showToast(error.message || 'Error al crear usuario', 'error');
                        return false;
                    } finally {
                        hideLoading();
                    }
                }
            }
        ]
    });

    if (modalId) {
        setTimeout(refreshIcons, 10);
    }
}

function openEditUserModal(user) {
    const modalId = showModal({
        title: 'Editar perfil de usuario',
        content: renderUserForm(user),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Guardar cambios',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('user-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getUserValidationRules(false));
                    if (!isValid) return false;

                    const formData = getFormData(form);

                    try {
                        showLoading('Actualizando usuario...');

                        const updatedProfile = await updateUserProfile(user.id, {
                            email: formData.email.trim(),
                            nombre_completo: formData.nombre_completo.trim(),
                            rol_principal: formData.rol_principal,
                            telefono: formData.telefono?.trim() || null,
                            puesto: formData.puesto?.trim() || null,
                            estado: formData.estado
                        });

                        updateUserInState(user.id, current => ({
                            ...current,
                            ...updatedProfile,
                            assignments: current.assignments
                        }));

                        sortUsers();
                        renderUsersTable();
                        renderUserDetail();
                        refreshIcons();

                        showToast('Perfil actualizado correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al actualizar usuario:', error);
                        showToast(error.message || 'Error al actualizar usuario', 'error');
                        return false;
                    } finally {
                        hideLoading();
                    }
                }
            }
        ]
    });

    if (modalId) {
        setTimeout(refreshIcons, 10);
    }
}

async function handleDeleteUser(user) {
    const confirmed = await showConfirmModal(
        `¿Deseas desactivar al usuario ${user.nombre_completo || user.email}?`,
        {
            title: 'Desactivar usuario',
            confirmText: 'Desactivar',
            cancelText: 'Cancelar',
            type: 'warning'
        }
    );

    if (!confirmed) return;

    try {
        showLoading('Desactivando usuario...');
        const updatedProfile = await deleteUserAccount(user.id);

        if (updatedProfile) {
            updateUserInState(user.id, current => ({
                ...current,
                ...updatedProfile,
                assignments: current.assignments
            }));
        }

        renderUsersTable();
        renderUserDetail();
        refreshIcons();

        showToast('Usuario desactivado correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al desactivar usuario:', error);
        showToast(error.message || 'Error al desactivar usuario', 'error');
    } finally {
        hideLoading();
    }
}

function openAssignmentModal(user, assignment = null) {
    const availableAreas = assignment
        ? adminState.areas
        : adminState.areas.filter(area => !user.assignments.some(item => item.area_id === area.id));

    if (!assignment && availableAreas.length === 0) {
        showToast('El usuario ya está asignado a todas las áreas disponibles', 'info');
        return;
    }

    const modalId = showModal({
        title: assignment ? 'Editar asignación de área' : 'Asignar área',
        content: renderAssignmentForm(user, availableAreas, assignment),
        actions: [
            { text: 'Cancelar' },
            {
                text: assignment ? 'Guardar cambios' : 'Asignar área',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('assignment-form');
                    if (!form) return false;

                    const areaId = form.querySelector('[name="area_id"]')?.value;
                    const rol = form.querySelector('[name="rol"]')?.value;
                    if (!assignment && !areaId) {
                        showToast('Selecciona un área válida', 'error');
                        return false;
                    }
                    if (!rol) {
                        showToast('Selecciona un rol para el área', 'error');
                        return false;
                    }

                    const payload = {
                        usuario_id: user.id,
                        area_id: assignment ? assignment.area_id : areaId,
                        rol,
                        puede_capturar: form.querySelector('[name="puede_capturar"]').checked,
                        puede_editar: form.querySelector('[name="puede_editar"]').checked,
                        puede_eliminar: form.querySelector('[name="puede_eliminar"]').checked,
                        estado: form.querySelector('[name="estado"]').value
                    };

                    try {
                        showLoading(assignment ? 'Actualizando asignación...' : 'Creando asignación...');

                        if (assignment) {
                            const updated = await updateAreaAssignment(assignment.id, payload);
                            updateAssignmentInState(user.id, assignment.id, updated);
                        } else {
                            const created = await createAreaAssignment(payload);
                            addAssignmentToState(user.id, created);
                        }

                        renderUsersTable();
                        renderUserDetail();
                        refreshIcons();

                        showToast(assignment ? 'Asignación actualizada' : 'Área asignada correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al guardar asignación:', error);
                        showToast(error.message || 'Error al guardar asignación', 'error');
                        return false;
                    } finally {
                        hideLoading();
                    }
                }
            }
        ]
    });

    if (modalId) {
        setTimeout(refreshIcons, 10);
    }
}

async function handleRemoveAssignment(user, assignment) {
    const confirmed = await showConfirmModal(
        `¿Eliminar la asignación del área ${assignment.area?.nombre || assignment.area_id}?`,
        {
            title: 'Eliminar asignación',
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            type: 'danger'
        }
    );

    if (!confirmed) return;

    try {
        showLoading('Eliminando asignación...');
        await removeAreaAssignment(assignment.id);
        removeAssignmentFromState(user.id, assignment.id);
        renderUsersTable();
        renderUserDetail();
        refreshIcons();
        showToast('Asignación eliminada correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al eliminar asignación:', error);
        showToast(error.message || 'Error al eliminar asignación', 'error');
    } finally {
        hideLoading();
    }
}

// =====================================================
// FORMULARIOS Y VALIDACIONES
// =====================================================

function renderUserForm(user = null) {
    const isNew = !user;

    const roleOptions = ROLE_OPTIONS.map(option => `
        <option value="${option.value}" ${user?.rol_principal === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    const estadoOptions = ESTADO_OPTIONS.map(option => `
        <option value="${option.value}" ${(!user && option.value === 'ACTIVO') || user?.estado === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    return `
        <form id="user-form" class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Nombre completo</span>
                    <input
                        type="text"
                        name="nombre_completo"
                        required
                        value="${user?.nombre_completo ? escapeAttribute(user.nombre_completo) : ''}"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    />
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Correo electrónico</span>
                    <input
                        type="email"
                        name="email"
                        required
                        value="${user?.email ? escapeAttribute(user.email) : ''}"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    />
                </label>
            </div>

            ${isNew ? `
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Contraseña temporal</span>
                    <input
                        type="password"
                        name="password"
                        required
                        minlength="${VALIDATION.password?.minLength || 8}"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    />
                    <span class="mt-1 text-xs text-gray-500">El usuario podrá cambiarla al iniciar sesión.</span>
                </label>
            ` : ''}

            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Teléfono</span>
                    <input
                        type="tel"
                        name="telefono"
                        value="${user?.telefono ? escapeAttribute(user.telefono) : ''}"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    />
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Puesto</span>
                    <input
                        type="text"
                        name="puesto"
                        value="${user?.puesto ? escapeAttribute(user.puesto) : ''}"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    />
                </label>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Rol principal</span>
                    <select
                        name="rol_principal"
                        required
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    >
                        ${roleOptions}
                    </select>
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Estado</span>
                    <select
                        name="estado"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    >
                        ${estadoOptions}
                    </select>
                </label>
            </div>
        </form>
    `;
}

function renderAssignmentForm(user, areas, assignment = null) {
    const areaOptions = areas.map(area => `
        <option value="${area.id}" ${assignment?.area_id === area.id ? 'selected' : ''}>${area.nombre} (${area.clave})</option>
    `).join('');

    const roleOptions = ROLE_OPTIONS.map(option => `
        <option value="${option.value}" ${assignment?.rol === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    const estadoOptions = ESTADO_OPTIONS.map(option => `
        <option value="${option.value}" ${(!assignment && option.value === 'ACTIVO') || assignment?.estado === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    return `
        <form id="assignment-form" class="space-y-4">
            <label class="flex flex-col text-sm">
                <span class="mb-1 font-medium text-gray-700">Área</span>
                <select
                    name="area_id"
                    ${assignment ? 'disabled' : ''}
                    class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                >
                    ${assignment ? `<option value="${assignment.area_id}">${assignment.area?.nombre || assignment.areas?.nombre || 'Área asignada'}</option>` : areaOptions}
                </select>
            </label>

            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Rol en el área</span>
                    <select
                        name="rol"
                        required
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    >
                        ${roleOptions}
                    </select>
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Estado</span>
                    <select
                        name="estado"
                        class="rounded-lg border border-gray-300 px-3 py-2 focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/40"
                    >
                        ${estadoOptions}
                    </select>
                </label>
            </div>

            <fieldset class="space-y-2">
                <legend class="text-sm font-medium text-gray-700">Permisos</legend>
                <div class="grid gap-2 sm:grid-cols-3">
                    ${PERMISSION_OPTIONS.map(option => `
                        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                name="${option.key}"
                                ${assignment?.[option.key] ? 'checked' : ''}
                                class="rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                            />
                            <span>${option.label}</span>
                        </label>
                    `).join('')}
                </div>
            </fieldset>
        </form>
    `;
}

function getUserValidationRules(requirePassword) {
    const rules = {
        nombre_completo: { required: true, minLength: 3 },
        email: { required: true, pattern: VALIDATION.email?.pattern, message: VALIDATION.email?.message },
        rol_principal: { required: true }
    };

    if (requirePassword) {
        rules.password = {
            required: true,
            minLength: VALIDATION.password?.minLength || 8,
            pattern: VALIDATION.password?.pattern,
            message: VALIDATION.password?.message || 'Contraseña no válida'
        };
    }

    return rules;
}

// =====================================================
// MANEJO DE ESTADO
// =====================================================

function getFilteredUsers() {
    const { search, estado, rol } = adminState.filters;
    let users = [...adminState.users];

    if (search) {
        const term = search.trim().toLowerCase();
        users = users.filter(user => {
            return [user.nombre_completo, user.email, user.telefono, user.puesto]
                .filter(Boolean)
                .some(value => value.toLowerCase().includes(term));
        });
    }

    if (estado !== 'TODOS') {
        users = users.filter(user => user.estado === estado);
    }

    if (rol !== 'TODOS') {
        users = users.filter(user => user.rol_principal === rol);
    }

    return users;
}

function getSelectedUser() {
    return adminState.users.find(user => user.id === adminState.selectedUserId) || null;
}

function updateUserInState(userId, updater) {
    const index = adminState.users.findIndex(user => user.id === userId);
    if (index === -1) return;

    const current = adminState.users[index];
    adminState.users[index] = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
}

function addAssignmentToState(userId, assignment) {
    updateUserInState(userId, current => {
        const assignments = [...(current.assignments || []), assignment];
        return {
            ...current,
            assignments: sortAssignments(assignments)
        };
    });
}

function updateAssignmentInState(userId, assignmentId, updatedAssignment) {
    updateUserInState(userId, current => {
        const assignments = (current.assignments || []).map(item =>
            item.id === assignmentId ? { ...item, ...updatedAssignment } : item
        );
        return {
            ...current,
            assignments: sortAssignments(assignments)
        };
    });
}

function removeAssignmentFromState(userId, assignmentId) {
    updateUserInState(userId, current => ({
        ...current,
        assignments: (current.assignments || []).filter(item => item.id !== assignmentId)
    }));
}

function sortUsers() {
    adminState.users.sort((a, b) => {
        const nameA = (a.nombre_completo || a.email || '').toLowerCase();
        const nameB = (b.nombre_completo || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
}

function sortAssignments(assignments) {
    return [...assignments].sort((a, b) => {
        const nameA = (a.area?.nombre || a.areas?.nombre || '').toLowerCase();
        const nameB = (b.area?.nombre || b.areas?.nombre || '').toLowerCase();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
}

// =====================================================
// UTILIDADES DE PRESENTACIÓN
// =====================================================

function renderRoleBadge(role) {
    const label = getRoleLabel(role);
    const classes = {
        ADMIN: 'bg-purple-100 text-purple-800',
        DIRECTOR: 'bg-blue-100 text-blue-800',
        SUBDIRECTOR: 'bg-indigo-100 text-indigo-800',
        JEFE_AREA: 'bg-emerald-100 text-emerald-800',
        CAPTURISTA: 'bg-amber-100 text-amber-800'
    }[role] || 'bg-gray-100 text-gray-600';

    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${escapeHTML(label)}</span>`;
}

function renderStatusBadge(status) {
    const classes = status === 'ACTIVO'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-700';
    const label = status === 'ACTIVO' ? 'Activo' : 'Inactivo';
    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${label}</span>`;

}

function renderPermissionChip(option, active) {
    const classes = active
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-500';
    const icon = active ? 'check' : 'minus';
    return `
        <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">
            <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
            ${option.label}
        </span>
    `;
}

function renderDetailChip(label, value) {
    return `
        <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            <strong class="font-semibold text-gray-700">${escapeHTML(label)}:</strong>
            ${escapeHTML(value)}
        </span>
    `;
}

function getRoleLabel(role) {
    return ROLE_OPTIONS.find(option => option.value === role)?.label || role || 'Sin rol';
}

function getStatusText(status) {
    return status === 'ACTIVO' ? 'Activo' : 'Inactivo';
}

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHTML(value).replace(/`/g, '&#96;');
}

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function renderAccessDenied() {
    if (!adminContainerRef) return;
    adminContainerRef.innerHTML = `
        <div class="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <i data-lucide="lock" class="mx-auto mb-4 h-10 w-10 text-red-500"></i>
            <h3 class="text-lg font-semibold text-red-700">Acceso restringido</h3>
            <p class="mt-2 text-sm text-red-600">Necesitas privilegios de administrador para acceder a este panel.</p>
        </div>
    `;
    refreshIcons();
}

function renderErrorState(error) {
    return `
        <div class="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <i data-lucide="alert-triangle" class="mx-auto mb-4 h-10 w-10 text-red-500"></i>
            <h3 class="text-lg font-semibold text-red-700">No se pudo cargar el panel</h3>
            <p class="mt-2 text-sm text-red-600">${escapeHTML(error.message || 'Ocurrió un error inesperado')}</p>
        </div>
    `;
}
