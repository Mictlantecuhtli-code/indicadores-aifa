import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import {
  getUserById,
  getEditableAreasForUser,
  getCapturableAreasForUser,
  getAssignableRoles,
  canUserEditUser
} from '../lib/supabaseClient.js';
import {
  ROLES,
  canSeeAllAreas,
  canEditAllAreas,
  canCaptureInAllAreas,
  isRoleHigherThan
} from '../lib/permissions.js';

/**
 * Hook para gestionar los permisos del usuario actual
 * Centraliza toda la lógica de permisos y roles
 */
export function useUserPermissions() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;

  // Obtener datos completos del usuario actual
  const userQuery = useQuery({
    queryKey: ['current-user-full', userId],
    queryFn: () => getUserById(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000 // 5 minutos
  });

  // Obtener áreas editables
  const editableAreasQuery = useQuery({
    queryKey: ['editable-areas', userId],
    queryFn: () => getEditableAreasForUser(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000
  });

  // Obtener áreas capturables
  const capturableAreasQuery = useQuery({
    queryKey: ['capturable-areas', userId],
    queryFn: () => getCapturableAreasForUser(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000
  });

  // Obtener roles asignables
  const assignableRolesQuery = useQuery({
    queryKey: ['assignable-roles', userId],
    queryFn: () => getAssignableRoles(userId),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000 // 10 minutos
  });

  // Datos del usuario actual
  const currentUser = userQuery.data;
  const currentRole = currentUser?.rol_principal || profile?.rol_principal || null;

  // Permisos calculados
  const permissions = useMemo(() => {
    if (!currentRole) {
      return {
        isAdmin: false,
        isDirector: false,
        isSubdirector: false,
        isCapturista: false,
        canSeeAllAreas: false,
        canEditAllAreas: false,
        canCaptureInAllAreas: false,
        canManageUsers: false,
        canManageAreas: false,
        canManageIndicators: false
      };
    }

    return {
      isAdmin: currentRole === ROLES.ADMIN,
      isDirector: currentRole === ROLES.DIRECTOR,
      isSubdirector: currentRole === ROLES.SUBDIRECTOR,
      isCapturista: currentRole === ROLES.CAPTURISTA,
      canSeeAllAreas: canSeeAllAreas(currentRole),
      canEditAllAreas: canEditAllAreas(currentRole),
      canCaptureInAllAreas: canCaptureInAllAreas(currentRole),
      canManageUsers: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.SUBDIRECTOR].includes(currentRole),
      canManageAreas: [ROLES.ADMIN].includes(currentRole),
      canManageIndicators: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.SUBDIRECTOR].includes(currentRole)
    };
  }, [currentRole]);

  // Áreas editables
  const editableAreas = editableAreasQuery.data || [];
  const editableAreaIds = useMemo(
    () => new Set(editableAreas.map(area => area.id)),
    [editableAreas]
  );

  // Áreas capturables
  const capturableAreas = capturableAreasQuery.data || [];
  const capturableAreaIds = useMemo(
    () => new Set(capturableAreas.map(area => area.id)),
    [capturableAreas]
  );

  // Roles asignables
  const assignableRoles = assignableRolesQuery.data || [];

  /**
   * Verifica si el usuario actual puede editar un área específica
   */
  const canEditArea = (areaId) => {
    if (!areaId) return false;
    if (permissions.canEditAllAreas) return true;
    return editableAreaIds.has(areaId);
  };

  /**
   * Verifica si el usuario actual puede capturar en un área específica
   */
  const canCaptureInArea = (areaId) => {
    if (!areaId) return false;
    if (permissions.canCaptureInAllAreas) return true;
    return capturableAreaIds.has(areaId);
  };

  /**
   * Verifica si el usuario actual puede editar a otro usuario
   */
  const canEditUser = async (targetUserId) => {
    if (!userId || !targetUserId) return false;
    if (userId === targetUserId) return false; // No puede editarse a sí mismo
    if (permissions.isAdmin) return true;
    
    try {
      return await canUserEditUser(userId, targetUserId);
    } catch (error) {
      console.error('Error verificando permisos de edición:', error);
      return false;
    }
  };

  /**
   * Verifica si el usuario actual puede asignar un rol específico
   */
  const canAssignRole = (role) => {
    if (!role) return false;
    return assignableRoles.some(r => r.value === role);
  };

  /**
   * Verifica si el usuario actual tiene un rol superior a otro
   */
  const hasHigherRoleThan = (otherRole) => {
    if (!currentRole || !otherRole) return false;
    return isRoleHigherThan(currentRole, otherRole);
  };

  /**
   * Verifica si el usuario tiene áreas asignadas
   */
  const hasAssignedAreas = useMemo(() => {
    return (currentUser?.usuario_areas || []).length > 0;
  }, [currentUser]);

  /**
   * Obtiene las áreas asignadas al usuario actual
   */
  const userAreas = useMemo(() => {
    return currentUser?.usuario_areas || [];
  }, [currentUser]);

  return {
    // Datos del usuario
    currentUser,
    currentRole,
    userId,
    userAreas,
    hasAssignedAreas,

    // Permisos generales
    permissions,

    // Áreas
    editableAreas,
    capturableAreas,
    editableAreaIds,
    capturableAreaIds,

    // Roles
    assignableRoles,

    // Funciones de validación
    canEditArea,
    canCaptureInArea,
    canEditUser,
    canAssignRole,
    hasHigherRoleThan,

    // Estados de carga
    isLoading: userQuery.isLoading || editableAreasQuery.isLoading || capturableAreasQuery.isLoading,
    isError: userQuery.isError || editableAreasQuery.isError || capturableAreasQuery.isError,
    error: userQuery.error || editableAreasQuery.error || capturableAreasQuery.error,

    // Funciones de refetch
    refetch: () => {
      userQuery.refetch();
      editableAreasQuery.refetch();
      capturableAreasQuery.refetch();
      assignableRolesQuery.refetch();
    }
  };
}
