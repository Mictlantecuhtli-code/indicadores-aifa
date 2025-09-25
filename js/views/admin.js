// =====================================================
// PANEL DE ADMINISTRACIÓN - GESTIÓN DE USUARIOS
// =====================================================


import { DEBUG } from '../config.js';
import {

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
    { value: 'CAPTURISTA', label: 'Capturista' },
    { value: 'CAPTURADOR', label: 'Capturador' },
    { value: 'CONSULTOR', label: 'Consultor' }
];

const ESTADO_OPTIONS = [
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'INACTIVO', label: 'Inactivo' }
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((map, option) => {
    map[option.value] = option.label;
    return map;
}, {});

const adminState = {
    currentProfile: null,
    areas: [],
    users: [],
    filteredUsers: [],
    selectedUserId: null,
    filters: {
        search: '',
        role: 'ALL',
        estado: 'ALL'

    }
};

let adminContainerRef = null;

// =====================================================
// RENDER PRINCIPAL
// =====================================================

export async function render(container) {
    adminContainerRef = container;

    try {
        container.innerHTML = renderLayout();
        setupStaticListeners(container);
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
        if (container) {
            container.innerHTML = renderErrorState(error);
        }
        showToast('No se pudo cargar el panel de administración', 'error');
        refreshIcons();
    } finally {
        hideLoading();
    }
}

// =====================================================
// CARGA INICIAL
// =====================================================

async function ensureAdminProfile() {
    const profile = await getCurrentProfile();

    if (!profile) {
        throw new Error('No se pudo obtener el perfil del usuario');
    }

    adminState.currentProfile = profile;
    return profile.rol_principal === 'ADMIN';
}

async function loadInitialData() {
    try {
        const [areas, users] = await Promise.all([
            fetchAdminAreas(),
            fetchAdminUsers()
        ]);

        adminState.areas = Array.isArray(areas) ? areas : [];
        setUsers(users || []);
    } catch (error) {
        console.error('❌ Error al cargar datos iniciales del panel:', error);
        throw error;
    }
}

function setUsers(users) {
    const sortedUsers = (users || []).slice().sort((a, b) => {
        const nameA = (a?.nombre_completo || '').toLowerCase();
        const nameB = (b?.nombre_completo || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    adminState.users = sortedUsers;

    if (!adminState.selectedUserId || !sortedUsers.some(user => user.id === adminState.selectedUserId)) {
        adminState.selectedUserId = sortedUsers[0]?.id || null;
    }

    applyFilters();
}

async function reloadUsers() {
    const users = await fetchAdminUsers();
    setUsers(users || []);
    renderUsersTable();
    renderUserDetail();
    refreshIcons();
}

// =====================================================
// RENDERIZADO DE LA INTERFAZ
// =====================================================


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
                    <i data-lucide="user-plus" class="h-4 w-4"></i>

                    Nuevo usuario
                </button>
            </header>

            <section class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div class="border-b border-gray-200 p-4">
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Buscar usuario</span>
                            <input
                                id="admin-user-search"
                                type="search"
                                placeholder="Nombre o correo"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                            />
                        </label>
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Rol principal</span>
                            <select
                                id="admin-user-role-filter"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                            >
                                <option value="ALL">Todos</option>
                                ${roleOptions}
                            </select>
                        </label>
                        <label class="flex flex-col text-sm">
                            <span class="mb-1 font-medium text-gray-700">Estado</span>
                            <select
                                id="admin-user-status-filter"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                            >
                                <option value="ALL">Todos</option>
                                ${estadoOptions}
                            </select>
                        </label>
                    </div>
                </div>
                <div class="grid gap-0 border-t border-gray-200 md:grid-cols-[2fr,1fr]">
                    <div class="border-r border-gray-200">
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200" aria-label="Usuarios registrados">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Usuario</th>
                                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rol</th>
                                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Último acceso</th>
                                    </tr>
                                </thead>
                                <tbody id="admin-users-table-body" class="divide-y divide-gray-200 bg-white"></tbody>
                            </table>
                        </div>
                    </div>
                    <aside class="p-4" id="admin-user-detail"></aside>
                </div>
            </section>
        </section>
    `;
}

function setupStaticListeners(container) {
    const searchInput = container.querySelector('#admin-user-search');
    const roleFilter = container.querySelector('#admin-user-role-filter');
    const statusFilter = container.querySelector('#admin-user-status-filter');
    const createButton = container.querySelector('#create-user-button');

    if (searchInput) {
        searchInput.addEventListener('input', event => {
            adminState.filters.search = event.target.value;
            applyFilters();
            renderUsersTable();
            renderUserDetail();
            refreshIcons();
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', event => {
            adminState.filters.role = event.target.value;
            applyFilters();
            renderUsersTable();
            renderUserDetail();
            refreshIcons();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', event => {
            adminState.filters.estado = event.target.value;
            applyFilters();
            renderUsersTable();
            renderUserDetail();
            refreshIcons();
        });
    }

    if (createButton) {
        createButton.addEventListener('click', () => openCreateUserModal());
    }

function applyFilters() {
    const searchText = adminState.filters.search.trim().toLowerCase();
    const filterRole = adminState.filters.role;
    const filterEstado = adminState.filters.estado;

    let users = adminState.users;

    if (searchText) {
        users = users.filter(user => {
            const name = (user?.nombre_completo || '').toLowerCase();
            const email = (user?.email || '').toLowerCase();
            return name.includes(searchText) || email.includes(searchText);
        });
    }

    if (filterRole !== 'ALL') {
        users = users.filter(user => user?.rol_principal === filterRole);
    }

    if (filterEstado !== 'ALL') {
        users = users.filter(user => user?.estado === filterEstado);
    }

    adminState.filteredUsers = users;

    if (!users.some(user => user.id === adminState.selectedUserId)) {
        adminState.selectedUserId = users[0]?.id || null;
    }
}

function renderUsersTable() {
    if (!adminContainerRef) return;

    const tableBody = adminContainerRef.querySelector('#admin-users-table-body');
    if (!tableBody) return;

    if (!adminState.filteredUsers.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500">
                    No se encontraron usuarios con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = adminState.filteredUsers.map(user => {
        const isSelected = user.id === adminState.selectedUserId;
        const rowClasses = ['cursor-pointer transition-colors'];
        if (isSelected) {
            rowClasses.push('bg-aifa-light/40');
        } else {
            rowClasses.push('hover:bg-gray-50');
        }

        return `
            <tr
                class="${rowClasses.join(' ')}"
                data-user-id="${user.id}"
            >
                <td class="px-4 py-3 text-sm">
                    <div class="font-medium text-gray-900">${escapeHTML(user.nombre_completo || 'Sin nombre')}</div>
                    <div class="text-xs text-gray-500">${escapeHTML(user.email)}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">${escapeHTML(ROLE_LABELS[user.rol_principal] || user.rol_principal)}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getEstadoBadgeClasses(user.estado)}">
                        ${escapeHTML(formatEstado(user.estado))}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">${user.ultimo_acceso ? escapeHTML(formatDate(user.ultimo_acceso)) : '—'}</td>
            </tr>
        `;
    }).join('');

    tableBody.querySelectorAll('tr[data-user-id]').forEach(row => {
        row.addEventListener('click', () => {
            const userId = row.getAttribute('data-user-id');
            adminState.selectedUserId = userId;
            renderUsersTable();
            renderUserDetail();
            refreshIcons();
        });
    });
}

function renderUserDetail() {
    if (!adminContainerRef) return;
    const detailContainer = adminContainerRef.querySelector('#admin-user-detail');
    if (!detailContainer) return;

    const user = adminState.users.find(item => item.id === adminState.selectedUserId) || null;

    if (!user) {
        detailContainer.innerHTML = `
            <div class="flex h-full items-center justify-center text-center text-sm text-gray-500">
                Selecciona un usuario para ver sus detalles.
            </div>
        `;
        return;
    }

    const assignments = Array.isArray(user.assignments) ? user.assignments : [];

    detailContainer.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-start justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">${escapeHTML(user.nombre_completo || 'Sin nombre')}</h3>
                    <p class="text-sm text-gray-500">${escapeHTML(user.email)}</p>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                        <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium">
                            <i data-lucide="shield" class="mr-1 h-3.5 w-3.5"></i>
                            ${escapeHTML(ROLE_LABELS[user.rol_principal] || user.rol_principal)}
                        </span>
                        <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium">
                            <i data-lucide="badge-check" class="mr-1 h-3.5 w-3.5"></i>
                            ${escapeHTML(formatEstado(user.estado))}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-2 text-sm">
                    <button
                        id="edit-user-button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        <i data-lucide="pencil" class="h-4 w-4"></i>
                        Editar perfil
                    </button>
                    <button
                        id="delete-user-button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 font-medium text-red-600 transition hover:bg-red-50"
                    >
                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                        Eliminar usuario
                    </button>
                </div>
            </div>

            <dl class="grid grid-cols-1 gap-4 text-sm text-gray-600">
                <div>
                    <dt class="font-medium text-gray-700">Puesto</dt>
                    <dd>${escapeHTML(user.puesto || '—')}</dd>
                </div>
                <div>
                    <dt class="font-medium text-gray-700">Teléfono</dt>
                    <dd>${escapeHTML(user.telefono || '—')}</dd>
                </div>
                <div>
                    <dt class="font-medium text-gray-700">Último acceso</dt>
                    <dd>${user.ultimo_acceso ? escapeHTML(formatDate(user.ultimo_acceso)) : '—'}</dd>
                </div>
                <div>
                    <dt class="font-medium text-gray-700">Fecha de creación</dt>
                    <dd>${user.fecha_creacion ? escapeHTML(formatDate(user.fecha_creacion)) : '—'}</dd>
                </div>
            </dl>

            <section class="space-y-4">
                <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold text-gray-800">Asignaciones por área</h4>
                    <button
                        id="create-assignment-button"
                        class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-700"
                    >
                        <i data-lucide="plus" class="h-3.5 w-3.5"></i>
                        Nueva asignación
                    </button>
                </div>

                ${assignments.length ? assignments.map(assignment => renderAssignmentCard(assignment)).join('') : renderEmptyAssignments()}
            </section>
        </div>
    `;

    attachDetailListeners(user);

    refreshIcons();
}

function attachDetailListeners(user) {
    const editButton = adminContainerRef.querySelector('#edit-user-button');
    const deleteButton = adminContainerRef.querySelector('#delete-user-button');
    const createAssignmentButton = adminContainerRef.querySelector('#create-assignment-button');

    if (editButton) {
        editButton.addEventListener('click', () => openEditUserModal(user));
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', () => openDeleteUserModal(user));
    }

    if (createAssignmentButton) {
        createAssignmentButton.addEventListener('click', () => openCreateAssignmentModal(user));
    }

    const assignmentCards = adminContainerRef.querySelectorAll('[data-assignment-id]');
    assignmentCards.forEach(card => {
        const assignmentId = card.getAttribute('data-assignment-id');
        const assignment = (user.assignments || []).find(item => item.id === assignmentId);
        if (!assignment) return;

        const edit = card.querySelector('[data-action="edit-assignment"]');
        const remove = card.querySelector('[data-action="remove-assignment"]');

        if (edit) {
            edit.addEventListener('click', () => openEditAssignmentModal(user, assignment));
        }

        if (remove) {
            remove.addEventListener('click', () => confirmRemoveAssignment(user, assignment));
        }
    });
}

function renderAssignmentCard(assignment) {
    const areaName = assignment.area?.nombre || assignment.areas?.nombre || 'Área sin nombre';
    const roleLabel = ROLE_LABELS[assignment.rol] || assignment.rol;

    return `
        <article
            class="rounded-lg border border-gray-200 p-4 transition hover:border-aifa-blue/70"
            data-assignment-id="${assignment.id}"
        >
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h5 class="text-sm font-semibold text-gray-900">${escapeHTML(areaName)}</h5>
                    <p class="text-xs text-gray-500">${escapeHTML(roleLabel)}</p>
                    <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-gray-600">
                        ${renderPermissionPill('Capturar', assignment.puede_capturar)}
                        ${renderPermissionPill('Editar', assignment.puede_editar)}
                        ${renderPermissionPill('Eliminar', assignment.puede_eliminar)}
                        <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-1">
                            ${escapeHTML(formatEstado(assignment.estado))}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-2 text-xs">
                    <button
                        class="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50"
                        data-action="edit-assignment"
                    >
                        <i data-lucide="settings" class="h-3.5 w-3.5"></i>
                        Editar
                    </button>
                    <button
                        class="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-medium text-red-600 transition hover:bg-red-50"
                        data-action="remove-assignment"
                    >
                        <i data-lucide="x-circle" class="h-3.5 w-3.5"></i>
                        Quitar
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderEmptyAssignments() {
    return `
        <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Este usuario aún no tiene áreas asignadas.
        </div>
    `;
}

// =====================================================
// MODALES DE USUARIOS
// =====================================================

function openCreateUserModal() {
    const modalId = showModal({

        title: 'Registrar nuevo usuario',
        content: renderUserForm(true),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Cancelar'
            },
            {
                text: 'Crear usuario',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('admin-user-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getUserValidationRules(true));
                    if (!isValid) {
                        return false;
                    }

                    const data = getFormData(form);
                    const payload = {
                        email: (data.email || '').trim().toLowerCase(),
                        password: data.password,
                        nombre_completo: data.nombre_completo,
                        rol_principal: data.rol_principal,
                        telefono: data.telefono || null,
                        puesto: data.puesto || null,
                        estado: data.estado || 'ACTIVO'
                    };

                    try {
                        await showAsyncLoading('Creando usuario...', async () => {
                            await createUserWithProfile(payload);
                            await reloadUsers();
                        });

                        showToast('Usuario creado correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al crear usuario:', error);
                        showFormGeneralError('admin-user-form-error', error?.message || 'No se pudo crear el usuario.');
                        showToast(error?.message || 'No se pudo crear el usuario', 'error');
                        return false;
                    }
                }
            }
        ]
    });

    if (modalId && window.lucide) {
        window.lucide.createIcons();
    }
}

function openEditUserModal(user) {
    const modalId = showModal({
        title: 'Editar perfil',
        content: renderUserForm(false, user),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Cancelar'
            },
            {
                text: 'Guardar cambios',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('admin-user-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getUserValidationRules(false));
                    if (!isValid) {
                        return false;
                    }

                    const data = getFormData(form);
                    const updates = {
                        email: (data.email || '').trim().toLowerCase(),
                        nombre_completo: data.nombre_completo,
                        rol_principal: data.rol_principal,
                        telefono: data.telefono || null,
                        puesto: data.puesto || null,
                        estado: data.estado || 'ACTIVO'
                    };

                    try {
                        await showAsyncLoading('Actualizando usuario...', async () => {
                            const updated = await updateUserProfile(user.id, updates);
                            replaceUserInState(updated);
                        });

                        showToast('Perfil actualizado correctamente', 'success');
                        renderUsersTable();
                        renderUserDetail();
                        refreshIcons();
                        return true;
                    } catch (error) {
                        console.error('❌ Error al actualizar usuario:', error);
                        showFormGeneralError('admin-user-form-error', error?.message || 'No se pudo actualizar el usuario.');
                        showToast(error?.message || 'No se pudo actualizar el usuario', 'error');
                        return false;
                    }
                }
            }
        ]
    });

    if (modalId && window.lucide) {
        window.lucide.createIcons();
    }
}

function renderUserForm(isNew, user = {}) {
    const roleOptions = ROLE_OPTIONS.map(option => `
        <option value="${option.value}" ${user.rol_principal === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    const estadoOptions = ESTADO_OPTIONS.map(option => `
        <option value="${option.value}" ${user.estado === option.value || (!user.estado && option.value === 'ACTIVO') ? 'selected' : ''}>${option.label}</option>
    `).join('');

    return `
        <form id="admin-user-form" class="space-y-4">
            <div id="admin-user-form-error" class="hidden rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"></div>
            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Nombre completo</span>
                    <input
                        type="text"
                        name="nombre_completo"
                        value="${escapeAttribute(user.nombre_completo || '')}"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    />
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Correo electrónico</span>
                    <input
                        type="email"
                        name="email"
                        value="${escapeAttribute(user.email || '')}"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    />
                </label>
                ${isNew ? `
                    <label class="flex flex-col text-sm">
                        <span class="mb-1 font-medium text-gray-700">Contraseña temporal</span>
                        <input
                            type="password"
                            name="password"
                            autocomplete="new-password"
                            class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                        />
                    </label>
                ` : ''}
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Rol principal</span>
                    <select
                        name="rol_principal"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    >
                        ${roleOptions}
                    </select>
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Estado</span>
                    <select
                        name="estado"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    >
                        ${estadoOptions}
                    </select>
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Teléfono</span>
                    <input
                        type="text"
                        name="telefono"
                        value="${escapeAttribute(user.telefono || '')}"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    />
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Puesto</span>
                    <input
                        type="text"
                        name="puesto"
                        value="${escapeAttribute(user.puesto || '')}"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    />
                </label>
            </div>
        </form>
    `;
}

function getUserValidationRules(isNew) {
    return {
        nombre_completo: {
            required: true,
            minLength: 3,
            maxLength: 120
        },
        email: {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Correo electrónico no válido'
        },
        ...(isNew ? {
            password: {
                required: true,
                minLength: 6
            }
        } : {}),
        rol_principal: {
            required: true
        },
        estado: {
            required: true
        }
    };
}

function replaceUserInState(updatedUser) {
    adminState.users = adminState.users.map(user => {
        if (user.id === updatedUser.id) {
            return { ...user, ...updatedUser };
        }
        return user;
    });

    const filteredIndex = adminState.filteredUsers.findIndex(user => user.id === updatedUser.id);
    if (filteredIndex >= 0) {
        adminState.filteredUsers[filteredIndex] = {
            ...adminState.filteredUsers[filteredIndex],
            ...updatedUser
        };
    }

    applyFilters();
}

function openDeleteUserModal(user) {
    showConfirmModal(
        `¿Seguro que deseas eliminar al usuario <strong>${escapeHTML(user.email)}</strong>?`,
        {
            title: 'Eliminar usuario',
            type: 'danger',
            confirmText: 'Eliminar'
        }
    ).then(async confirmed => {
        if (!confirmed) return;

        try {
            await showAsyncLoading('Eliminando usuario...', async () => {
                await deleteUserAccount(user.id, { hardDelete: false });
                await reloadUsers();
            });

            showToast('Usuario desactivado correctamente', 'success');
        } catch (error) {
            console.error('❌ Error al eliminar usuario:', error);
            showToast(error?.message || 'No se pudo eliminar el usuario', 'error');
        }
    });
}

// =====================================================
// MODALES DE ASIGNACIONES
// =====================================================

function openCreateAssignmentModal(user) {
    const assignedAreaIds = new Set((user.assignments || []).map(item => item.area_id));
    const availableAreas = adminState.areas.filter(area => !assignedAreaIds.has(area.id));

    if (!availableAreas.length) {
        showToast('El usuario ya tiene asignadas todas las áreas disponibles.', 'info');
        return;
    }

    const modalId = showModal({
        title: 'Asignar usuario a un área',
        content: renderAssignmentForm({ areas: availableAreas }),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Asignar área',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('admin-assignment-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getAssignmentValidationRules(true));
                    if (!isValid) {
                        return false;
                    }

                    const data = getFormData(form);
                    const payload = {
                        usuario_id: user.id,
                        area_id: data.area_id,
                        rol: data.rol,
                        estado: data.estado,
                        puede_capturar: form.querySelector('[name="puede_capturar"]').checked,
                        puede_editar: form.querySelector('[name="puede_editar"]').checked,
                        puede_eliminar: form.querySelector('[name="puede_eliminar"]').checked
                    };

                    try {
                        await showAsyncLoading('Asignando área...', async () => {
                            await createAreaAssignment(payload);
                            await reloadUsers();
                        });

                        showToast('Área asignada correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al asignar área:', error);
                        showFormGeneralError('admin-assignment-form-error', error?.message || 'No se pudo asignar el área.');
                        showToast(error?.message || 'No se pudo asignar el área', 'error');
                        return false;
                    }
                }
            }
        ]
    });

    if (modalId && window.lucide) {
        window.lucide.createIcons();
    }
}

function openEditAssignmentModal(user, assignment) {
    const modalId = showModal({
        title: 'Editar permisos del área',
        content: renderAssignmentForm({ assignment, areas: adminState.areas, isEditing: true }),
        actions: [
            { text: 'Cancelar' },
            {
                text: 'Guardar cambios',
                primary: true,
                handler: async () => {
                    const form = document.getElementById('admin-assignment-form');
                    if (!form) return false;

                    const { isValid } = validateForm(form, getAssignmentValidationRules(false));
                    if (!isValid) {
                        return false;
                    }

                    const data = getFormData(form);
                    const updates = {
                        rol: data.rol,
                        estado: data.estado,
                        puede_capturar: form.querySelector('[name="puede_capturar"]').checked,
                        puede_editar: form.querySelector('[name="puede_editar"]').checked,
                        puede_eliminar: form.querySelector('[name="puede_eliminar"]').checked
                    };

                    try {
                        await showAsyncLoading('Actualizando asignación...', async () => {
                            await updateAreaAssignment(assignment.id, updates);
                            await reloadUsers();
                        });

                        showToast('Asignación actualizada correctamente', 'success');
                        return true;
                    } catch (error) {
                        console.error('❌ Error al actualizar asignación:', error);
                        showFormGeneralError('admin-assignment-form-error', error?.message || 'No se pudo actualizar la asignación.');
                        showToast(error?.message || 'No se pudo actualizar la asignación', 'error');
                        return false;
                    }
                }
            }
        ]
    });

    if (modalId && window.lucide) {
        window.lucide.createIcons();
    }
}

function confirmRemoveAssignment(user, assignment) {
    const areaName = assignment.area?.nombre || assignment.areas?.nombre || 'esta área';

    showConfirmModal(
        `¿Quitar al usuario de <strong>${escapeHTML(areaName)}</strong>?`,
        {
            title: 'Quitar asignación',
            type: 'danger',
            confirmText: 'Quitar'
        }
    ).then(async confirmed => {
        if (!confirmed) return;

        try {
            await showAsyncLoading('Quitando asignación...', async () => {
                await removeAreaAssignment(assignment.id);
                await reloadUsers();
            });

            showToast('Asignación eliminada correctamente', 'success');
        } catch (error) {
            console.error('❌ Error al eliminar asignación:', error);
            showToast(error?.message || 'No se pudo eliminar la asignación', 'error');
        }
    });
}

function renderAssignmentForm({ assignment = {}, areas = [], isEditing = false }) {
    const roleOptions = ROLE_OPTIONS.map(option => `
        <option value="${option.value}" ${assignment.rol === option.value ? 'selected' : ''}>${option.label}</option>
    `).join('');

    const estadoOptions = ESTADO_OPTIONS.map(option => `
        <option value="${option.value}" ${assignment.estado === option.value || (!assignment.estado && option.value === 'ACTIVO') ? 'selected' : ''}>${option.label}</option>
    `).join('');

    const areaOptions = areas.map(area => `
        <option value="${area.id}" ${assignment.area_id === area.id ? 'selected' : ''}>${area.nombre}</option>
    `).join('');

    return `
        <form id="admin-assignment-form" class="space-y-4">
            <div id="admin-assignment-form-error" class="hidden rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"></div>
            ${isEditing ? '' : `
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Área</span>
                    <select
                        name="area_id"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    >
                        <option value="">Selecciona un área</option>
                        ${areaOptions}
                    </select>
                </label>
            `}
            <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Rol en el área</span>
                    <select
                        name="rol"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    >
                        ${roleOptions}
                    </select>
                </label>
                <label class="flex flex-col text-sm">
                    <span class="mb-1 font-medium text-gray-700">Estado</span>
                    <select
                        name="estado"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none"
                    >
                        ${estadoOptions}
                    </select>
                </label>
            </div>
            <fieldset class="rounded-lg border border-gray-200 p-4">
                <legend class="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Permisos</legend>
                <div class="mt-3 grid gap-2 md:grid-cols-3">
                    ${renderPermissionCheckbox('puede_capturar', 'Puede capturar', assignment.puede_capturar ?? true)}
                    ${renderPermissionCheckbox('puede_editar', 'Puede editar', assignment.puede_editar ?? false)}
                    ${renderPermissionCheckbox('puede_eliminar', 'Puede eliminar', assignment.puede_eliminar ?? false)}
                </div>
            </fieldset>
        </form>
    `;
}

function getAssignmentValidationRules(isNew) {
    return {
        ...(isNew ? {
            area_id: {
                required: true
            }
        } : {}),
        rol: {
            required: true
        },
        estado: {
            required: true
        }
    };
}

// =====================================================
// UTILIDADES VISUALES
// =====================================================

function showAsyncLoading(message, callback) {
    return new Promise((resolve, reject) => {
        showLoading(message);
        Promise.resolve()
            .then(callback)
            .then(result => {
                resolve(result);
            })
            .catch(error => {
                reject(error);
            })
            .finally(() => {
                hideLoading();
            });
    });
}

function renderPermissionCheckbox(name, label, checked) {
    return `
        <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
                type="checkbox"
                name="${name}"
                class="h-4 w-4 rounded border-gray-300 text-aifa-blue focus:ring-aifa-blue"
                ${checked ? 'checked' : ''}
            />
            <span>${escapeHTML(label)}</span>
        </label>
    `;
}

function renderPermissionPill(label, enabled) {
    return `
        <span class="inline-flex items-center rounded-full px-2 py-1 ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}">
            <i data-lucide="${enabled ? 'check' : 'minus'}" class="mr-1 h-3 w-3"></i>
            ${escapeHTML(label)}
        </span>
    `;
}

function getEstadoBadgeClasses(estado) {
    switch (estado) {
        case 'ACTIVO':
            return 'bg-emerald-100 text-emerald-700';
        case 'INACTIVO':
            return 'bg-gray-100 text-gray-500';
        default:
            return 'bg-gray-100 text-gray-600';
    }

function formatEstado(estado) {
    const option = ESTADO_OPTIONS.find(item => item.value === estado);
    return option ? option.label : estado;
}

function showFormGeneralError(elementId, message) {
    const target = document.getElementById(elementId);
    if (!target) return;

    if (message) {
        target.textContent = message;
        target.classList.remove('hidden');
    } else {
        target.classList.add('hidden');
        target.textContent = '';
    }
}

function escapeHTML(value) {
    if (value === undefined || value === null) return '';
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
            <p class="mt-2 text-sm text-red-600">${escapeHTML(error?.message || 'Ocurrió un error inesperado')}</p>
        </div>
    `;
}

// =====================================================
// DEPURACIÓN
// =====================================================

if (DEBUG.enabled) {
    window.adminViewState = adminState;
}

