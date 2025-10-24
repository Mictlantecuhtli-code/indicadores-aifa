import {
  getAllUsers,
  updateUser,
  deactivateUser,
  assignUserToArea,
  removeUserFromArea,
  updateUserAreaPermissions,
  getAreas,
  createUser
} from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';
import { showToast, renderLoading, renderError } from '../ui/feedback.js';

const ROLES = ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'];
const ESTADOS = ['ACTIVO', 'INACTIVO'];

let currentUsers = [];
let currentAreas = [];

function escapeHtml(value) {
  if (value == null) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRoleBadgeClass(rol) {
  const classes = {
    'ADMIN': 'bg-purple-100 text-purple-700',
    'DIRECTOR': 'bg-blue-100 text-blue-700',
    'SUBDIRECTOR': 'bg-cyan-100 text-cyan-700',
    'CAPTURISTA': 'bg-emerald-100 text-emerald-700'
  };
  return classes[rol] || 'bg-slate-100 text-slate-700';
}

function getEstadoBadgeClass(estado) {
  return estado === 'ACTIVO' 
    ? 'bg-green-100 text-green-700' 
    : 'bg-red-100 text-red-700';
}

function buildUsersTable(users, searchTerm = '') {
  const filtered = searchTerm
    ? users.filter(user =>
        [user.nombre_completo, user.email, user.rol_principal, user.puesto]
          .filter(Boolean)
          .some(value => value.toString().toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : users;

  if (!filtered.length) {
    return `
      <tr>
        <td colspan="7" class="px-4 py-10 text-center text-slate-400">
          No se encontraron usuarios que coincidan con la búsqueda.
        </td>
      </tr>
    `;
  }

  return filtered
    .map(
      user => `
        <tr class="hover:bg-slate-50/80" data-user-id="${user.id}">
          <td class="px-4 py-3">
            <p class="font-semibold text-slate-800">${escapeHtml(user.nombre_completo)}</p>
            <p class="text-xs text-slate-400">${user.areas_count} área(s) asignada(s)</p>
          </td>
          <td class="px-4 py-3 text-slate-600">${escapeHtml(user.email)}</td>
          <td class="px-4 py-3 text-slate-600">${escapeHtml(user.puesto || '—')}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleBadgeClass(user.rol_principal)}">
              ${escapeHtml(user.rol_principal)}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEstadoBadgeClass(user.estado)}">
              ${escapeHtml(user.estado)}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600">
            <div class="flex gap-1 text-xs">
              ${user.permisos.puede_capturar ? '<span class="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Captura</span>' : ''}
              ${user.permisos.puede_editar ? '<span class="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Edición</span>' : ''}
              ${user.permisos.puede_eliminar ? '<span class="rounded bg-red-100 px-2 py-0.5 text-red-700">Eliminación</span>' : ''}
            </div>
          </td>
          <td class="px-4 py-3 text-right">
            <button 
              class="text-primary-600 hover:text-primary-700 mr-2"
              data-action="edit"
              data-user-id="${user.id}"
              title="Editar usuario"
            >
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button 
              class="text-slate-600 hover:text-slate-700 mr-2"
              data-action="areas"
              data-user-id="${user.id}"
              title="Gestionar áreas"
            >
              <i class="fa-solid fa-building"></i>
            </button>
            ${user.estado === 'ACTIVO' ? `
              <button 
                class="text-red-600 hover:text-red-700"
                data-action="deactivate"
                data-user-id="${user.id}"
                title="Desactivar usuario"
              >
                <i class="fa-solid fa-user-slash"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `
    )
    .join('');
}

function buildCreateModal() {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-modal="create-user">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Registrar nuevo usuario</h3>
            <p class="text-xs text-slate-500">
              Al guardar enviaremos un correo para que la persona establezca su contraseña y active su acceso.
            </p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600" data-modal-close>
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form id="create-user-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
            <input
              type="text"
              name="nombre_completo"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              name="email"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <p class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              La contraseña inicial se generará automáticamente tomando todo lo anterior al símbolo <span class="font-semibold">@</span>
              del correo y agregando <span class="font-semibold">1544</span> (por ejemplo: <span class="font-mono">usuario1544</span>). Solicita que el usuario la cambie al iniciar sesión.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Puesto</label>
              <input
                type="text"
                name="puesto"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Rol principal</label>
            <select
              name="rol_principal"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Seleccionar rol</option>
              ${ROLES.map(rol => `
                <option value="${rol}">${rol}</option>
              `).join('')}
            </select>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              class="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <i class="fa-solid fa-user-plus mr-2"></i>
              Registrar usuario
            </button>
            <button
              type="button"
              data-modal-close
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildEditModal(user) {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-modal="edit-user">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-slate-800">Editar Usuario</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600" data-modal-close>
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <form id="edit-user-form" class="space-y-4">
          <input type="hidden" name="user_id" value="${user.id}" />
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
            <input
              type="text"
              name="nombre_completo"
              value="${escapeHtml(user.nombre_completo)}"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value="${escapeHtml(user.email)}"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Puesto</label>
              <input
                type="text"
                name="puesto"
                value="${escapeHtml(user.puesto || '')}"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value="${escapeHtml(user.telefono || '')}"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <select
                name="rol_principal"
                required
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                ${ROLES.map(rol => `
                  <option value="${rol}" ${user.rol_principal === rol ? 'selected' : ''}>
                    ${rol}
                  </option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                name="estado"
                required
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                ${ESTADOS.map(estado => `
                  <option value="${estado}" ${user.estado === estado ? 'selected' : ''}>
                    ${estado}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              class="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <i class="fa-solid fa-floppy-disk mr-2"></i>
              Guardar cambios
            </button>
            <button
              type="button"
              data-modal-close
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildAreasModal(user) {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-modal="areas-user">
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Gestionar Áreas</h3>
            <p class="text-sm text-slate-500">${escapeHtml(user.nombre_completo)}</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600" data-modal-close>
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-semibold text-slate-700 mb-2">Áreas asignadas</h4>
          <div class="space-y-2" id="assigned-areas">
            ${user.areas.length ? user.areas.map(ua => `
              <div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex-1">
                  <p class="font-medium text-slate-800">${escapeHtml(ua.areas?.nombre || 'Área desconocida')}</p>
                  <p class="text-xs text-slate-500">Rol: ${escapeHtml(ua.rol || 'Sin rol')}</p>
                  <div class="mt-1 flex flex-wrap gap-2 text-xs">
                    ${ua.puede_capturar ? '<span class="rounded bg-blue-100 px-2 py-0.5 text-blue-700">✓ Captura</span>' : '<span class="text-slate-400">✗ Captura</span>'}
                    ${ua.puede_editar ? '<span class="rounded bg-amber-100 px-2 py-0.5 text-amber-700">✓ Edición</span>' : '<span class="text-slate-400">✗ Edición</span>'}
                    ${ua.puede_eliminar ? '<span class="rounded bg-red-100 px-2 py-0.5 text-red-700">✓ Eliminación</span>' : '<span class="text-slate-400">✗ Eliminación</span>'}
                  </div>
                </div>
                <div class="flex items-center gap-2 sm:ml-4">
                  <button
                    type="button"
                    class="rounded-lg border border-primary-100 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                    data-action="edit-area"
                    data-usuario-id="${user.id}"
                    data-assignment-id="${ua.id}"
                    title="Editar asignación"
                  >
                    <i class="fa-solid fa-pen-to-square mr-1"></i>
                    Editar
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    data-action="remove-area"
                    data-usuario-id="${user.id}"
                    data-area-id="${ua.area_id}"
                    data-assignment-id="${ua.id}"
                    title="Remover área"
                  >
                    <i class="fa-solid fa-trash mr-1"></i>
                    Quitar
                  </button>
                </div>
              </div>
            `).join('') : '<p class="text-sm text-slate-400 py-4 text-center">No tiene áreas asignadas</p>'}
          </div>
        </div>

        <div class="border-t border-slate-200 pt-4">
          <h4 class="text-sm font-semibold text-slate-700 mb-3">Asignar nueva área</h4>
          <form id="assign-area-form" class="space-y-3">
            <input type="hidden" name="usuario_id" value="${user.id}" />
            
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">Área</label>
                <select
                  name="area_id"
                  required
                  class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  <option value="">Seleccionar área</option>
                  ${currentAreas.map(area => `
                    <option value="${area.id}">${escapeHtml(area.nombre)}</option>
                  `).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">Rol en área</label>
                <select
                  name="rol"
                  required
                  class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  ${ROLES.map(rol => `<option value="${rol}">${rol}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="puede_capturar" class="rounded border-slate-300 text-primary-600" />
                Puede capturar
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="puede_editar" class="rounded border-slate-300 text-primary-600" />
                Puede editar
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="puede_eliminar" class="rounded border-slate-300 text-primary-600" />
                Puede eliminar
              </label>
            </div>

            <button
              type="submit"
              class="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <i class="fa-solid fa-plus mr-2"></i>
              Asignar área
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function buildEditAreaModal(user, assignment) {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" data-modal="edit-area">
      <div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Editar área asignada</h3>
            <p class="text-sm text-slate-500">${escapeHtml(user.nombre_completo)}</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600" data-modal-close>
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form id="edit-area-form" class="space-y-4">
          <input type="hidden" name="usuario_area_id" value="${assignment.id}" />
          <input type="hidden" name="usuario_id" value="${user.id}" />

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Área asignada</label>
            <select
              name="area_id"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Seleccionar área</option>
              ${currentAreas.map(area => `
                <option value="${area.id}" ${String(area.id) === String(assignment.area_id) ? 'selected' : ''}>
                  ${escapeHtml(area.nombre)}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Rol en área</label>
            <select
              name="rol"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              ${ROLES.map(rol => `
                <option value="${rol}" ${assignment.rol === rol ? 'selected' : ''}>${rol}</option>
              `).join('')}
            </select>
          </div>

          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="puede_capturar" ${assignment.puede_capturar ? 'checked' : ''} class="rounded border-slate-300 text-primary-600" />
              Puede capturar
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="puede_editar" ${assignment.puede_editar ? 'checked' : ''} class="rounded border-slate-300 text-primary-600" />
              Puede editar
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="puede_eliminar" ${assignment.puede_eliminar ? 'checked' : ''} class="rounded border-slate-300 text-primary-600" />
              Puede eliminar
            </label>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              class="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <i class="fa-solid fa-floppy-disk mr-2"></i>
              Guardar cambios
            </button>
            <button
              type="button"
              data-modal-close
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export async function renderUsers(container) {
  renderLoading(container, 'Cargando usuarios...');

  try {
    // Cargar usuarios y áreas
    [currentUsers, currentAreas] = await Promise.all([
      getAllUsers(),
      getAreas()
    ]);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
            <p class="text-sm text-slate-500">
              Gestione los usuarios del sistema, sus roles y permisos.
            </p>
          </div>
          <button
            type="button"
            id="btn-new-user"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-700"
          >
            <i class="fa-solid fa-user-plus"></i>
            Nuevo usuario
          </button>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <label class="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500">
            <i class="fa-solid fa-magnifying-glass text-slate-400"></i>
            <input
              id="users-search"
              type="search"
              placeholder="Buscar por nombre, correo, rol o puesto"
              class="w-full border-none bg-transparent text-sm focus:outline-none"
            />
          </label>
        </div>

        <div class="overflow-hidden rounded-2xl bg-white shadow">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left">Nombre</th>
                <th class="px-4 py-3 text-left">Correo</th>
                <th class="px-4 py-3 text-left">Puesto</th>
                <th class="px-4 py-3 text-left">Rol</th>
                <th class="px-4 py-3 text-left">Estado</th>
                <th class="px-4 py-3 text-left">Permisos</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody id="users-table" class="divide-y divide-slate-100">
              ${buildUsersTable(currentUsers)}
            </tbody>
          </table>
        </div>
      </div>

      <div id="modal-container"></div>
    `;

    initializeEventListeners();
  } catch (error) {
    console.error(error);
    renderError(container, error);
  }
}

function initializeEventListeners() {
  const searchInput = document.getElementById('users-search');
  const tableBody = document.getElementById('users-table');
  const modalContainer = document.getElementById('modal-container');
  const newUserButton = document.getElementById('btn-new-user');

  // Búsqueda
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      tableBody.innerHTML = buildUsersTable(currentUsers, e.target.value);
      bindTableActions();
    });
  }

  // Botón nuevo usuario
  if (newUserButton) {
    newUserButton.addEventListener('click', () => {
      modalContainer.innerHTML = buildCreateModal();
      bindModalActions();
    });
  }

  bindTableActions();

  function bindTableActions() {
    // Editar usuario
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.dataset.userId;
        const user = currentUsers.find(u => u.id === userId);
        if (!user) return;

        modalContainer.innerHTML = buildEditModal(user);
        bindModalActions();
      });
    });

    // Gestionar áreas
    document.querySelectorAll('[data-action="areas"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.dataset.userId;
        const user = currentUsers.find(u => u.id === userId);
        if (!user) return;

        modalContainer.innerHTML = buildAreasModal(user);
        bindModalActions();
      });
    });

    // Desactivar usuario
    document.querySelectorAll('[data-action="deactivate"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.dataset.userId;
        const user = currentUsers.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`¿Está seguro de desactivar al usuario ${user.nombre_completo}?`)) {
          try {
            await deactivateUser(userId);
            showToast('Usuario desactivado correctamente');
            // Recargar usuarios
            currentUsers = await getAllUsers();
            tableBody.innerHTML = buildUsersTable(currentUsers);
            bindTableActions();
          } catch (error) {
            console.error(error);
            showToast('No fue posible desactivar el usuario', { type: 'error' });
          }
        }
      });
    });
  }

  function bindModalActions() {
    // Cerrar modal
    modalContainer.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
    });

    const createForm = modalContainer.querySelector('#create-user-form');
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = {
          nombre_completo: formData.get('nombre_completo')?.trim(),
          email: formData.get('email')?.trim(),
          puesto: formData.get('puesto')?.trim() || null,
          telefono: formData.get('telefono')?.trim() || null,
          rol_principal: formData.get('rol_principal')
        };

        const submitButton = createForm.querySelector('button[type="submit"]');
        const originalLabel = submitButton?.innerHTML;

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...';
        }

        try {
          await createUser(payload);
          showToast('Usuario creado correctamente');
          modalContainer.innerHTML = '';
          currentUsers = await getAllUsers();
          tableBody.innerHTML = buildUsersTable(currentUsers);
          bindTableActions();
        } catch (error) {
          console.error(error);
          let message = 'No fue posible crear el usuario';
          if (error?.code === '23505' || /duplicate/i.test(error?.message ?? '')) {
            message = 'Ya existe un usuario registrado con ese correo electrónico';
          } else if (/correo electr[oó]nico es obligatorio/i.test(error?.message ?? '')) {
            message = 'Debe capturar un correo electrónico válido';
          }
          showToast(message, { type: 'error' });
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalLabel;
          }
        }
      });
    }

    // Form editar usuario
    const editForm = modalContainer.querySelector('#edit-user-form');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userId = formData.get('user_id');
        const updates = {
          nombre_completo: formData.get('nombre_completo'),
          email: formData.get('email'),
          puesto: formData.get('puesto') || null,
          telefono: formData.get('telefono') || null,
          rol_principal: formData.get('rol_principal'),
          estado: formData.get('estado')
        };

        try {
          await updateUser(userId, updates);
          showToast('Usuario actualizado correctamente');
          modalContainer.innerHTML = '';
          currentUsers = await getAllUsers();
          tableBody.innerHTML = buildUsersTable(currentUsers);
          bindTableActions();
        } catch (error) {
          console.error(error);
          showToast('No fue posible actualizar el usuario', { type: 'error' });
        }
      });
    }

    // Form asignar área
    const assignForm = modalContainer.querySelector('#assign-area-form');
    if (assignForm) {
      assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = {
          usuario_id: formData.get('usuario_id'),
          area_id: formData.get('area_id'),
          rol: formData.get('rol'),
          puede_capturar: formData.get('puede_capturar') === 'on',
          puede_editar: formData.get('puede_editar') === 'on',
          puede_eliminar: formData.get('puede_eliminar') === 'on'
        };

        try {
          await assignUserToArea(payload);
          showToast('Área asignada correctamente');
          currentUsers = await getAllUsers();
          tableBody.innerHTML = buildUsersTable(currentUsers);
          bindTableActions();

          const updatedUser = currentUsers.find(u => String(u.id) === String(payload.usuario_id));
          if (updatedUser) {
            modalContainer.innerHTML = buildAreasModal(updatedUser);
            bindModalActions();
          } else {
            modalContainer.innerHTML = '';
          }
        } catch (error) {
          console.error(error);
          showToast('No fue posible asignar el área', { type: 'error' });
        }
      });
    }

    const editAreaForm = modalContainer.querySelector('#edit-area-form');
    if (editAreaForm) {
      editAreaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const usuarioAreaId = formData.get('usuario_area_id');
        const usuarioId = formData.get('usuario_id');
        const updates = {
          area_id: formData.get('area_id'),
          rol: formData.get('rol'),
          puede_capturar: formData.get('puede_capturar') === 'on',
          puede_editar: formData.get('puede_editar') === 'on',
          puede_eliminar: formData.get('puede_eliminar') === 'on',
          estado: 'ACTIVO'
        };

        try {
          await updateUserAreaPermissions(usuarioAreaId, updates);
          showToast('Área actualizada correctamente');
          currentUsers = await getAllUsers();
          tableBody.innerHTML = buildUsersTable(currentUsers);
          bindTableActions();

          const updatedUser = currentUsers.find(u => String(u.id) === String(usuarioId));
          if (updatedUser) {
            modalContainer.innerHTML = buildAreasModal(updatedUser);
            bindModalActions();
          } else {
            modalContainer.innerHTML = '';
          }
        } catch (error) {
          console.error(error);
          showToast('No fue posible actualizar el área', { type: 'error' });
        }
      });
    }

    modalContainer.querySelectorAll('[data-action="edit-area"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const usuarioId = e.currentTarget.dataset.usuarioId;
        const assignmentId = e.currentTarget.dataset.assignmentId;
        const user = currentUsers.find(u => String(u.id) === String(usuarioId));
        if (!user) return;

        const assignment = user.areas?.find(ua => String(ua.id) === String(assignmentId))
          || user.areas?.find(ua => String(ua.area_id) === String(assignmentId));

        if (!assignment) return;

        modalContainer.innerHTML = buildEditAreaModal(user, assignment);
        bindModalActions();
      });
    });

    modalContainer.querySelectorAll('[data-action="remove-area"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const usuarioId = e.currentTarget.dataset.usuarioId;
        const areaId = e.currentTarget.dataset.areaId;

        if (confirm('¿Está seguro de remover esta área del usuario?')) {
          try {
            await removeUserFromArea(usuarioId, areaId);
            showToast('Área removida correctamente');
            currentUsers = await getAllUsers();
            tableBody.innerHTML = buildUsersTable(currentUsers);
            bindTableActions();

            const updatedUser = currentUsers.find(u => String(u.id) === String(usuarioId));
            if (updatedUser) {
              modalContainer.innerHTML = buildAreasModal(updatedUser);
              bindModalActions();
            } else {
              modalContainer.innerHTML = '';
            }
          } catch (error) {
            console.error(error);
            showToast('No fue posible remover el área', { type: 'error' });
          }
        }
      });
    });
  }
}
