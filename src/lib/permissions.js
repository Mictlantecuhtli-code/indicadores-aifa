/**
 * Utilidades para gestión de permisos y roles
 * Centraliza la lógica de negocio de permisos
 */

// Definición de roles del sistema
export const ROLES = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  SUBDIRECTOR: 'SUBDIRECTOR',
  CAPTURISTA: 'CAPTURISTA'
};

// Labels amigables para roles
export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.DIRECTOR]: 'Director',
  [ROLES.SUBDIRECTOR]: 'Subdirector',
  [ROLES.CAPTURISTA]: 'Capturista'
};

// Estados de registro
export const ESTADOS = {
  ACTIVO: 'ACTIVO',
  INACTIVO: 'INACTIVO',
  SUSPENDIDO: 'SUSPENDIDO'
};

// Labels para estados
export const ESTADO_LABELS = {
  [ESTADOS.ACTIVO]: 'Activo',
  [ESTADOS.INACTIVO]: 'Inactivo',
  [ESTADOS.SUSPENDIDO]: 'Suspendido'
};

// Colores para badges de estados
export const ESTADO_COLORS = {
  [ESTADOS.ACTIVO]: 'bg-green-100 text-green-800',
  [ESTADOS.INACTIVO]: 'bg-slate-100 text-slate-600',
  [ESTADOS.SUSPENDIDO]: 'bg-red-100 text-red-800'
};

/**
 * Obtiene la jerarquía de permisos (mayor a menor)
 */
export function getRoleHierarchy() {
  return [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.SUBDIRECTOR, ROLES.CAPTURISTA];
}

/**
 * Compara dos roles y determina si el primero tiene más autoridad
 */
export function isRoleHigherThan(role1, role2) {
  const hierarchy = getRoleHierarchy();
  const index1 = hierarchy.indexOf(role1);
  const index2 = hierarchy.indexOf(role2);
  
  if (index1 === -1 || index2 === -1) return false;
  
  return index1 < index2;
}

/**
 * Determina si un rol puede ver todas las áreas del sistema
 */
export function canSeeAllAreas(rol) {
  return [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.SUBDIRECTOR, ROLES.CAPTURISTA].includes(rol);
}

/**
 * Determina si un rol puede editar todas las áreas
 */
export function canEditAllAreas(rol) {
  return rol === ROLES.ADMIN;
}

/**
 * Determina si un rol puede capturar en todas las áreas
 */
export function canCaptureInAllAreas(rol) {
  return rol === ROLES.ADMIN;
}

/**
 * Obtiene el nivel mínimo de área permitido para un rol
 * null = sin restricción
 */
export function getMinAreaLevelForRole(rol) {
  switch (rol) {
    case ROLES.DIRECTOR:
      return 1; // Nivel de dirección
    case ROLES.SUBDIRECTOR:
      return 2; // Nivel de subdirección
    case ROLES.CAPTURISTA:
      return 3; // Nivel de gerencia
    case ROLES.ADMIN:
      return null; // Sin restricción
    default:
      return null;
  }
}

/**
 * Valida si un área es válida para un rol específico
 */
export function isAreaValidForRole(area, rol) {
  if (!area || !rol) return false;
  
  const minLevel = getMinAreaLevelForRole(rol);
  
  // Si no hay restricción de nivel, es válida
  if (minLevel === null) return true;
  
  // Validar el nivel del área
  return area.nivel >= minLevel;
}

/**
 * Filtra áreas según el rol y nivel permitido
 */
export function filterAreasByRole(areas, rol) {
  if (!areas || !Array.isArray(areas)) return [];
  
  const minLevel = getMinAreaLevelForRole(rol);
  
  // Si no hay restricción, retornar todas
  if (minLevel === null) return areas;
  
  // Filtrar por nivel
  return areas.filter(area => area.nivel >= minLevel);
}

/**
 * Construye un árbol jerárquico de áreas desde una lista plana
 */
export function buildAreaTree(areas) {
  if (!areas || !Array.isArray(areas)) return [];
  
  // Crear mapa de áreas por ID
  const areaMap = new Map();
  areas.forEach(area => {
    areaMap.set(area.id, { ...area, children: [] });
  });
  
  // Construir árbol
  const roots = [];
  areaMap.forEach(area => {
    if (area.parent_area_id && areaMap.has(area.parent_area_id)) {
      // Es un hijo, agregarlo al padre
      const parent = areaMap.get(area.parent_area_id);
      parent.children.push(area);
    } else {
      // Es raíz
      roots.push(area);
    }
  });
  
  // Ordenar por orden_visualizacion o nombre
  const sortAreas = (areaList) => {
    areaList.sort((a, b) => {
      if (a.orden_visualizacion !== undefined && b.orden_visualizacion !== undefined) {
        return a.orden_visualizacion - b.orden_visualizacion;
      }
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
    
    areaList.forEach(area => {
      if (area.children && area.children.length > 0) {
        sortAreas(area.children);
      }
    });
  };
  
  sortAreas(roots);
  
  return roots;
}

/**
 * Aplana un árbol de áreas a una lista
 */
export function flattenAreaTree(tree, result = []) {
  tree.forEach(node => {
    const { children, ...area } = node;
    result.push(area);
    if (children && children.length > 0) {
      flattenAreaTree(children, result);
    }
  });
  return result;
}

/**
 * Encuentra un área en el árbol por ID
 */
export function findAreaInTree(tree, areaId) {
  for (const node of tree) {
    if (node.id === areaId) return node;
    if (node.children && node.children.length > 0) {
      const found = findAreaInTree(node.children, areaId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Obtiene todos los descendientes de un área
 */
export function getAreaDescendants(tree, areaId) {
  const area = findAreaInTree(tree, areaId);
  if (!area) return [];
  
  const descendants = [];
  
  const collectDescendants = (node) => {
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        descendants.push(child);
        collectDescendants(child);
      });
    }
  };
  
  collectDescendants(area);
  
  return descendants;
}

/**
 * Obtiene la ruta completa de un área (breadcrumb)
 */
export function getAreaPath(tree, areaId) {
  const path = [];
  
  const findPath = (nodes, targetId, currentPath) => {
    for (const node of nodes) {
      const newPath = [...currentPath, node];
      
      if (node.id === targetId) {
        return newPath;
      }
      
      if (node.children && node.children.length > 0) {
        const found = findPath(node.children, targetId, newPath);
        if (found) return found;
      }
    }
    return null;
  };
  
  return findPath(tree, areaId, []) || [];
}

/**
 * Formatea el nombre completo de un área con su jerarquía
 */
export function formatAreaFullName(tree, areaId, separator = ' > ') {
  const path = getAreaPath(tree, areaId);
  return path.map(area => area.nombre).join(separator);
}

/**
 * Determina los permisos predeterminados para un rol en un área
 */
export function getDefaultPermissionsForRole(rol, areaNivel) {
  const defaults = {
    puede_capturar: false,
    puede_editar: false,
    puede_eliminar: false
  };
  
  switch (rol) {
    case ROLES.ADMIN:
      return {
        puede_capturar: true,
        puede_editar: true,
        puede_eliminar: true
      };
    
    case ROLES.DIRECTOR:
      return {
        puede_capturar: true,
        puede_editar: true,
        puede_eliminar: false
      };
    
    case ROLES.SUBDIRECTOR:
      return {
        puede_capturar: true,
        puede_editar: true,
        puede_eliminar: false
      };
    
    case ROLES.CAPTURISTA:
      return {
        puede_capturar: areaNivel >= 3, // Solo en gerencias
        puede_editar: false,
        puede_eliminar: false
      };
    
    default:
      return defaults;
  }
}

/**
 * Valida si un usuario puede ser editado por el usuario actual
 */
export function canEditUserByRole(currentUserRole, targetUserRole) {
  // ADMIN puede editar a todos excepto otros ADMIN
  if (currentUserRole === ROLES.ADMIN) {
    return targetUserRole !== ROLES.ADMIN;
  }
  
  // DIRECTOR puede editar SUBDIRECTOR y CAPTURISTA
  if (currentUserRole === ROLES.DIRECTOR) {
    return [ROLES.SUBDIRECTOR, ROLES.CAPTURISTA].includes(targetUserRole);
  }
  
  // SUBDIRECTOR puede editar CAPTURISTA
  if (currentUserRole === ROLES.SUBDIRECTOR) {
    return targetUserRole === ROLES.CAPTURISTA;
  }
  
  // CAPTURISTA no puede editar a nadie
  return false;
}

/**
 * Obtiene un mensaje descriptivo sobre las capacidades de un rol
 */
export function getRoleDescription(rol) {
  switch (rol) {
    case ROLES.ADMIN:
      return 'Acceso total al sistema. Puede gestionar todos los usuarios, áreas e indicadores.';
    
    case ROLES.DIRECTOR:
      return 'Puede ver y gestionar indicadores de su dirección y todas las áreas subordinadas.';
    
    case ROLES.SUBDIRECTOR:
      return 'Puede ver todas las áreas pero solo gestionar su subdirección y gerencias subordinadas.';
    
    case ROLES.CAPTURISTA:
      return 'Puede ver todas las áreas pero solo capturar indicadores en gerencias asignadas.';
    
    default:
      return 'Rol no definido.';
  }
}

/**
 * Valida los datos de un usuario antes de guardar
 */
export function validateUserData(userData) {
  const errors = {};
  
  if (!userData.nombre_completo || userData.nombre_completo.trim() === '') {
    errors.nombre_completo = 'El nombre completo es requerido';
  }
  
  if (!userData.email || userData.email.trim() === '') {
    errors.email = 'El correo electrónico es requerido';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.email = 'El correo electrónico no es válido';
  }
  
  if (!userData.rol_principal) {
    errors.rol_principal = 'El rol es requerido';
  } else if (!Object.values(ROLES).includes(userData.rol_principal)) {
    errors.rol_principal = 'El rol seleccionado no es válido';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
