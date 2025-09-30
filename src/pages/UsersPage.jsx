import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../lib/supabaseClient.js';
import { Search, UserPlus } from 'lucide-react';
import { formatDate } from '../utils/formatters.js';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: getUsers });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return usersQuery.data ?? [];
    return (usersQuery.data ?? []).filter(user => {
      return [user.nombre, user.email, user.rol, user.puesto]
        .filter(Boolean)
        .some(value => value.toString().toLowerCase().includes(term));
    });
  }, [usersQuery.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
          <p className="text-sm text-slate-500">
            Consulte los usuarios con acceso al sistema y su rol dentro de la plataforma.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-aifa-light focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o rol"
            className="w-full border-none bg-transparent text-sm focus:outline-none"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-left">Puesto</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-right">Último acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{user.nombre}</p>
                  {user.direccion && <p className="text-xs text-slate-400">{user.direccion}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{user.puesto ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{user.rol ?? '—'}</td>
                <td className="px-4 py-3 text-right text-slate-500">{formatDate(user.ultimo_acceso)}</td>
              </tr>
            ))}
            {!filteredUsers.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No se encontraron usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {usersQuery.isLoading && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
            Cargando usuarios...
          </div>
        )}
      </div>
    </div>
  );
}
