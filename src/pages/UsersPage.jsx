import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deleteUser, getUsers } from '../lib/supabaseClient.js';
import { Search, UserPlus, Edit2, Shield, Trash2, Loader2 } from 'lucide-react';
import { formatDate } from '../utils/formatters.js';
import { useUserPermissions } from '../hooks/useUserPermissions.js';
import { ROLE_LABELS, ESTADO_COLORS, ESTADO_LABELS } from '../lib/permissions.js';

export default function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { permissions } = useUserPermissions();
  const queryClient = useQueryClient();
  
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: getUsers
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return usersQuery.data ?? [];
    return (usersQuery.data ?? []).filter(user => {
      return [user.nombre, user.email, user.rol, user.puesto, user.rol_principal]
        .filter(Boolean)
        .some(value => value.toString().toLowerCase().includes(term));
    });
  }, [usersQuery.data, search]);

  const handleEditUser = (userId) => {
    navigate(`/usuarios/${userId}/editar`);
  };

  const handleDeleteUser = async (user) => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      `¿Desea eliminar al usuario ${user.nombre || user.email || 'seleccionado'}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      await deleteUserMutation.mutateAsync(user.id);
    } catch (error) {
      console.error('Error eliminando usuario', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
          <p className="text-sm text-slate-500">
            Consulte los usuarios con acceso al sistema y su rol dentro de la plataforma.
          </p>
        </div>
        
        {permissions.canManageUsers && (
          <button
            type="button"
            onClick={() => navigate('/usuarios/nuevo')}
            className="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-aifa-light focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </button>
        )}
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-left">Puesto</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Último acceso</th>
                {permissions.canManageUsers && (
                  <th className="px-4 py-3 text-center">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-800">{user.nombre}</p>
                      {user.direccion && (
                        <p className="text-xs text-slate-400">{user.direccion}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.puesto ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(user.rol_principal || user.rol) && (
                        <>
                          <Shield className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {ROLE_LABELS[user.rol_principal || user.rol] || user.rol_principal || user.rol}
                          </span>
                        </>
                      )}
                      {!user.rol_principal && !user.rol && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        ESTADO_COLORS[user.estado] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ESTADO_LABELS[user.estado] || user.estado || 'Activo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {formatDate(user.ultimo_acceso)}
                  </td>
                  {permissions.canManageUsers && (
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditUser(user.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-aifa-blue transition hover:bg-aifa-blue/10"
                            title="Editar usuario"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deleteUserMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Eliminar usuario"
                          >
                            {deleteUserMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!filteredUsers.length && (
                <tr>
                  <td 
                    colSpan={permissions.canManageUsers ? 7 : 6} 
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {usersQuery.isLoading && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
            Cargando usuarios...
          </div>
        )}
        
        {usersQuery.isError && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-center text-xs text-red-600">
            Error al cargar usuarios: {usersQuery.error?.message || 'Error desconocido'}
          </div>
        )}
        {deleteUserMutation.isError && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-center text-xs text-red-600">
            Error al eliminar usuario: {deleteUserMutation.error?.message || 'No fue posible completar la operación'}
          </div>
        )}
      </div>
    </div>
  );
}
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import IndicatorDetailPage from './pages/IndicatorDetailPage.jsx';
import IndicatorsPage from './pages/IndicatorsPage.jsx';
import CapturePage from './pages/CapturePage.jsx';
import VisualizationPage from './pages/VisualizationPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import UserEditPage from './pages/UserEditPage.jsx';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <p className="text-sm font-medium text-slate-600">Validando sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/panel-directivos" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="panel-directivos" replace />} />
        <Route path="panel-directivos" element={<DashboardPage />} />
        <Route path="panel-directivos/:optionId" element={<IndicatorDetailPage />} />
        <Route path="visualizacion" element={<VisualizationPage />} />
        <Route path="indicadores" element={<IndicatorsPage />} />
        <Route path="captura" element={<CapturePage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="usuarios/:userId/editar" element={<UserEditPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/panel-directivos' : '/login'} replace />} />
    </Routes>
  );
}
