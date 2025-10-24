import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Trash2,
  UserX,
  AlertCircle,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import {
  getUserById,
  updateUser,
  addUserArea,
  removeUserArea,
  updateUserArea,
  removeAllUserAreas
} from '../lib/supabaseClient.js';
import { useUserPermissions } from '../hooks/useUserPermissions.js';
import { AreaSelectorWithPermissions } from '../components/AreaSelector.jsx';
import {
  ROLES,
  ROLE_LABELS,
  ESTADOS,
  ESTADO_LABELS,
  ESTADO_COLORS,
  getRoleDescription,
  validateUserData,
  getDefaultPermissionsForRole
} from '../lib/permissions.js';

export default function UserEditPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { permissions, canEditUser, assignableRoles, currentUser } = useUserPermissions();
  
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaId, setNewAreaId] = useState(null);
  const [newAreaPermissions, setNewAreaPermissions] = useState({
    puede_capturar: false,
    puede_editar: false,
    puede_eliminar: false
  });

  // Cargar datos del usuario
  const userQuery = useQuery({
    queryKey: ['user-edit', userId],
    queryFn: () => getUserById(userId),
    enabled: Boolean(userId)
  });

  const targetUser = userQuery.data;

  // Verificar permisos de edición
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    if (!userId || !currentUser) return;
    
    async function checkPermission() {
      const allowed = await canEditUser(userId);
      setCanEdit(allowed);
    }
    
    checkPermission();
  }, [userId, currentUser, canEditUser]);

  // Formulario de datos básicos
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm({
    defaultValues: {
      nombre_completo: '',
      email: '',
      rol_principal: '',
      telefono: '',
      puesto: '',
      estado: 'ACTIVO'
    }
  });

  const selectedRole = watch('rol_principal');

  // Cargar datos en el formulario cuando se obtiene el usuario
  useEffect(() => {
    if (targetUser) {
      reset({
        nombre_completo: targetUser.nombre_completo || '',
        email: targetUser.email || '',
        rol_principal: targetUser.rol_principal || '',
        telefono: targetUser.telefono || '',
        puesto: targetUser.puesto || '',
        estado: targetUser.estado || 'ACTIVO'
      });
    }
  }, [targetUser, reset]);

  // Mutación para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: (data) => updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-edit', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  // Mutación para agregar área
  const addAreaMutation = useMutation({
    mutationFn: (data) => addUserArea(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-edit', userId] });
      setShowAddArea(false);
      setNewAreaId(null);
      setNewAreaPermissions({
        puede_capturar: false,
        puede_editar: false,
        puede_eliminar: false
      });
    }
  });

  // Mutación para eliminar área
  const removeAreaMutation = useMutation({
    mutationFn: (areaId) => removeUserArea(userId, areaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-edit', userId] });
    }
  });

  // Mutación para eliminar todas las áreas
  const removeAllAreasMutation = useMutation({
    mutationFn: () => removeAllUserAreas(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-edit', userId] });
    }
  });

  // Áreas actuales del usuario
  const userAreas = useMemo(() => {
    return targetUser?.usuario_areas || [];
  }, [targetUser]);

  // Manejar submit del formulario
  const onSubmit = handleSubmit(async (data) => {
    const validation = validateUserData(data);
    
    if (!validation.isValid) {
      console.error('Errores de validación:', validation.errors);
      return;
    }

    try {
      await updateUserMutation.mutateAsync(data);
      navigate('/usuarios');
    } catch (error) {
      console.error('Error actualizando usuario:', error);
    }
  });

  // Manejar agregar área
  const handleAddArea = async () => {
    if (!newAreaId) return;

    const payload = {
      area_id: newAreaId,
      rol: selectedRole,
      ...newAreaPermissions
    };

    try {
      await addAreaMutation.mutateAsync(payload);
    } catch (error) {
      console.error('Error agregando área:', error);
    }
  };

  // Manejar eliminar área
  const handleRemoveArea = async (areaId) => {
    if (!confirm('¿Está seguro de eliminar esta área del usuario?')) return;
    
    try {
      await removeAreaMutation.mutateAsync(areaId);
    } catch (error) {
      console.error('Error eliminando área:', error);
    }
  };

  // Manejar eliminar todas las áreas
  const handleRemoveAllAreas = async () => {
    if (!confirm('¿Está seguro de eliminar TODAS las áreas asignadas a este usuario? El usuario quedará sin asignar.')) return;
    
    try {
      await removeAllAreasMutation.mutateAsync();
    } catch (error) {
      console.error('Error eliminando todas las áreas:', error);
    }
  };

  // Actualizar permisos predeterminados cuando cambia el rol
  useEffect(() => {
    if (selectedRole && newAreaId) {
      const defaults = getDefaultPermissionsForRole(selectedRole, 1); // nivel por defecto
      setNewAreaPermissions(defaults);
    }
  }, [selectedRole, newAreaId]);

  // Estados de carga
  const isLoading = userQuery.isLoading;
  const isSaving = updateUserMutation.isPending || addAreaMutation.isPending || 
                   removeAreaMutation.isPending || removeAllAreasMutation.isPending;

  // Verificar permisos
  if (!permissions.canManageUsers) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/usuarios')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </button>
        
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h2 className="text-lg font-semibold text-red-900">Acceso denegado</h2>
          <p className="mt-2 text-sm text-red-700">
            No tienes permisos para editar usuarios.
          </p>
        </div>
      </div>
    );
  }

  if (!canEdit && !isLoading) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/usuarios')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </button>
        
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-semibold text-amber-900">Permisos insuficientes</h2>
          <p className="mt-2 text-sm text-amber-700">
            No tienes permisos para editar este usuario específico.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-aifa-blue" />
          <p className="text-sm text-slate-500">Cargando datos del usuario...</p>
        </div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/usuarios')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </button>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Usuario no encontrado</h2>
          <p className="mt-2 text-sm text-slate-500">
            El usuario solicitado no existe o fue eliminado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/usuarios')}
          className="inline-flex items-center gap-2 text-sm text-aifa-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </button>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              ESTADO_COLORS[targetUser.estado] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {ESTADO_LABELS[targetUser.estado] || targetUser.estado}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Editar usuario</h1>
        <p className="mt-1 text-sm text-slate-500">
          Actualiza la información del usuario y gestiona sus áreas asignadas
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Datos básicos */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Información básica</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nombre completo *
              </label>
              <input
                type="text"
                {...register('nombre_completo', { required: 'El nombre es requerido' })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
              {errors.nombre_completo && (
                <p className="mt-1 text-xs text-red-500">{errors.nombre_completo.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Correo electrónico *
              </label>
              <input
                type="email"
                {...register('email', { 
                  required: 'El correo es requerido',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Correo electrónico inválido'
                  }
                })}
                disabled
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                El correo no puede ser modificado
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Rol principal *
              </label>
              <select
                {...register('rol_principal', { required: 'El rol es requerido' })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                <option value="">Seleccionar rol...</option>
                {assignableRoles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {errors.rol_principal && (
                <p className="mt-1 text-xs text-red-500">{errors.rol_principal.message}</p>
              )}
              {selectedRole && (
                <p className="mt-1 text-xs text-slate-500">
                  {getRoleDescription(selectedRole)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                {...register('estado')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              >
                {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Teléfono
              </label>
              <input
                type="tel"
                {...register('telefono')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Puesto
              </label>
              <input
                type="text"
                {...register('puesto')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              />
            </div>
          </div>
        </section>
        {/* Áreas asignadas */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Áreas asignadas</h2>
              <p className="text-sm text-slate-500">
                Gestiona las áreas donde este usuario tiene permisos
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {userAreas.length > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveAllAreas}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Quitar todas las áreas
                </button>
              )}
              
              {!showAddArea && (
                <button
                  type="button"
                  onClick={() => setShowAddArea(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-3 py-2 text-sm font-medium text-white transition hover:bg-aifa-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar área
                </button>
              )}
            </div>
          </div>

          {/* Formulario para agregar nueva área */}
          {showAddArea && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-emerald-900">Nueva área</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddArea(false);
                    setNewAreaId(null);
                  }}
                  className="rounded p-1 hover:bg-emerald-100"
                >
                  <X className="h-4 w-4 text-emerald-700" />
                </button>
              </div>

              <div className="space-y-3">
                <AreaSelectorWithPermissions
                  value={newAreaId}
                  onChange={setNewAreaId}
                  userRole={selectedRole}
                  permissions={newAreaPermissions}
                  onPermissionsChange={setNewAreaPermissions}
                  disabled={!selectedRole || isSaving}
                  error={!selectedRole ? 'Primero selecciona un rol principal' : null}
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddArea(false);
                      setNewAreaId(null);
                    }}
                    disabled={isSaving}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddArea}
                    disabled={!newAreaId || isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addAreaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Agregar área
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de áreas actuales */}
          {userAreas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <UserX className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Sin áreas asignadas</p>
              <p className="mt-1 text-xs text-slate-500">
                Este usuario no tiene áreas asignadas. Haz clic en "Agregar área" para comenzar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userAreas.map((userArea) => {
                const area = userArea.areas;
                if (!area) return null;

                return (
                  <div
                    key={userArea.id}
                    className="flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {area.clave && (
                          <span
                            className="rounded px-2 py-1 text-xs font-semibold uppercase text-white"
                            style={{ backgroundColor: area.color_hex || '#64748b' }}
                          >
                            {area.clave}
                          </span>
                        )}
                        <h4 className="font-semibold text-slate-900">{area.nombre}</h4>
                        <span className="text-xs text-slate-500">Nivel {area.nivel}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {userArea.rol && (
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                            Rol: {ROLE_LABELS[userArea.rol] || userArea.rol}
                          </span>
                        )}
                        {userArea.puede_capturar && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            Puede capturar
                          </span>
                        )}
                        {userArea.puede_editar && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                            Puede editar
                          </span>
                        )}
                        {userArea.puede_eliminar && (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            Puede eliminar
                          </span>
                        )}
                      </div>

                      {userArea.fecha_asignacion && (
                        <p className="mt-2 text-xs text-slate-500">
                          Asignada el {new Date(userArea.fecha_asignacion).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveArea(area.id)}
                      disabled={isSaving}
                      className="ml-4 flex-shrink-0 rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Eliminar área"
                    >
                      {removeAreaMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Botones de acción */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-aifa-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Guardar cambios
          </button>
        </div>
      </form>

      {/* Mensajes de error */}
      {updateUserMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Error al guardar</h3>
              <p className="mt-1 text-sm text-red-700">
                {updateUserMutation.error?.message || 'No fue posible actualizar el usuario'}
              </p>
            </div>
          </div>
        </div>
      )}

      {addAreaMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Error al agregar área</h3>
              <p className="mt-1 text-sm text-red-700">
                {addAreaMutation.error?.message || 'No fue posible agregar el área al usuario'}
              </p>
            </div>
          </div>
        </div>
      )}

      {removeAreaMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Error al eliminar área</h3>
              <p className="mt-1 text-sm text-red-700">
                {removeAreaMutation.error?.message || 'No fue posible eliminar el área'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
