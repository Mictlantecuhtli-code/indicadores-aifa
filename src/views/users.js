import { getUsers } from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';
import { showToast } from '../ui/feedback.js';

export async function renderUsers(container) {
  container.innerHTML = `
    <div class="flex h-72 items-center justify-center">
      <div class="rounded-xl bg-white px-6 py-4 text-sm text-slate-500 shadow">Cargando usuarios...</div>
    </div>
  `;

  try {
    const users = await getUsers();

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
            <p class="text-sm text-slate-500">
              Consulte los usuarios con acceso al sistema y su rol dentro de la plataforma.
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
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
              placeholder="Buscar por nombre, correo o rol"
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
                <th class="px-4 py-3 text-right">Último acceso</th>
              </tr>
            </thead>
            <tbody id="users-table" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>
    `;

    const searchInput = container.querySelector('#users-search');
    const tableBody = container.querySelector('#users-table');

    function renderRows(term = '') {
      const normalized = term.trim().toLowerCase();
      const filtered = normalized
        ? users.filter(user =>
            [user.nombre, user.email, user.rol, user.puesto]
              .filter(Boolean)
              .some(value => value.toString().toLowerCase().includes(normalized))
          )
        : users;

      tableBody.innerHTML = filtered
        .map(
          user => `
            <tr class="hover:bg-slate-50/80">
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-800">${user.nombre}</p>
                ${user.direccion ? `<p class="text-xs text-slate-400">${user.direccion}</p>` : ''}
              </td>
              <td class="px-4 py-3 text-slate-600">${user.email ?? '—'}</td>
              <td class="px-4 py-3 text-slate-600">${user.puesto ?? '—'}</td>
              <td class="px-4 py-3 text-slate-600">${user.rol ?? '—'}</td>
              <td class="px-4 py-3 text-right text-slate-500">${formatDate(user.ultimo_acceso)}</td>
            </tr>
          `
        )
        .join('');

      if (!filtered.length) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-4 py-10 text-center text-slate-400">
              No se encontraron usuarios que coincidan con la búsqueda.
            </td>
          </tr>
        `;
      }
    }

    renderRows();

    searchInput.addEventListener('input', event => {
      renderRows(event.target.value);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        No fue posible cargar la administración de usuarios.
      </div>
    `;
    showToast('No fue posible cargar la administración de usuarios.', { type: 'error' });
  }
}
