/**
 * Indicadores 2.0 - AIFA
 * Módulo de guards (guardias de seguridad)
 * Validación de sesión, roles y permisos para proteger rutas y acciones
 */

/**
 * Guard principal para verificar autenticación
 * @param {Function} callback - Función a ejecutar si está autenticado
 * @param {Function} errorCallback - Función a ejecutar si no está autenticado
 */
async function requireAuth(callback, errorCallback = null) {
    try {
        const authState = await window.auth.checkAuthState();
        
        if (authState.isValid) {
            if (typeof callback === 'function') {
                callback(authState.user, authState.profile);
            }
        } else {
            console.log('Acceso denegado - Sin autenticación:', authState.message);
            
            if (typeof errorCallback === 'function') {
                errorCallback(authState.message);
            } else {
                // Comportamiento por defecto: redirigir al login
                window.location.href = 'login.html';
            }
        }
        
    } catch (error) {
        console.error('Error en requireAuth:', error);
        if (typeof errorCallback === 'function') {
            errorCallback('Error verificando autenticación');
        } else {
            window.location.href = 'login.html';
        }
    }
}

/**
 * Guard para verificar roles específicos
 * @param {Array|string} allowedRoles - Rol(es) permitido(s)
 * @param {Function} callback - Función a ejecutar si tiene el rol
 * @param {Function} errorCallback - Función a ejecutar si no tiene el rol
 */
async function requireRole(allowedRoles, callback, errorCallback = null) {
    try {
        const authState = await window.auth.checkAuthState();
        
        if (!authState.isValid) {
            if (typeof errorCallback === 'function') {
                errorCallback('No autenticado');
            } else {
                window.location.href = 'login.html';
            }
            return;
        }

        const userRole = authState.profile.role.name.toLowerCase();
        const rolesArray = Array.isArray(allowedRoles) 
            ? allowedRoles.map(r => r.toLowerCase()) 
            : [allowedRoles.toLowerCase()];

        if (rolesArray.includes(userRole)) {
            if (typeof callback === 'function') {
                callback(authState.user, authState.profile);
            }
        } else {
            console.log(`Acceso denegado - Rol requerido: ${allowedRoles}, Rol actual: ${userRole}`);
            
            if (typeof errorCallback === 'function') {
                errorCallback(`No tienes permisos para esta acción. Rol requerido: ${allowedRoles}`);
            } else {
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast('No tienes permisos para realizar esta acción', 'error');
                }
                // Redirigir al dashboard en lugar del login
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        }
        
    } catch (error) {
        console.error('Error en requireRole:', error);
        if (typeof errorCallback === 'function') {
            errorCallback('Error verificando permisos');
        }
    }
}

/**
 * Guard para verificar permisos de administrador
 * @param {Function} callback - Función a ejecutar si es admin
 * @param {Function} errorCallback - Función a ejecutar si no es admin
 */
async function requireAdmin(callback, errorCallback = null) {
    await requireRole('admin', callback, errorCallback);
}

/**
 * Guard para verificar permisos de gestión de usuarios (director o admin)
 * @param {Function} callback - Función a ejecutar si puede gestionar usuarios
 * @param {Function} errorCallback - Función a ejecutar si no puede
 */
async function requireUserManagement(callback, errorCallback = null) {
    await requireRole(['director', 'admin'], callback, errorCallback);
}

/**
 * Guard para verificar permisos de escritura en un área específica
 * @param {number} areaId - ID del área
 * @param {Function} callback - Función a ejecutar si puede escribir
 * @param {Function} errorCallback - Función a ejecutar si no puede
 */
async function requireWriteAccess(areaId, callback, errorCallback = null) {
    try {
        const authState = await window.auth.checkAuthState();
        
        if (!authState.isValid) {
            if (typeof errorCallback === 'function') {
                errorCallback('No autenticado');
            } else {
                window.location.href = 'login.html';
            }
            return;
        }

        const hasPermission = await window.supabaseClient.checkUserPermissions('write', { areaId });
        
        if (hasPermission) {
            if (typeof callback === 'function') {
                callback(authState.user, authState.profile);
            }
        } else {
            const message = 'No tienes permisos de escritura para esta área';
            console.log('Acceso denegado - Sin permisos de escritura para área:', areaId);
            
            if (typeof errorCallback === 'function') {
                errorCallback(message);
            } else {
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast(message, 'error');
                }
            }
        }
        
    } catch (error) {
        console.error('Error en requireWriteAccess:', error);
        if (typeof errorCallback === 'function') {
            errorCallback('Error verificando permisos de escritura');
        }
    }
}

/**
 * Guard para verificar permisos de edición
 * @param {Function} callback - Función a ejecutar si puede editar
 * @param {Function} errorCallback - Función a ejecutar si no puede
 */
async function requireEditAccess(callback, errorCallback = null) {
    try {
        const authState = await window.auth.checkAuthState();
        
        if (!authState.isValid) {
            if (typeof errorCallback === 'function') {
                errorCallback('No autenticado');
            } else {
                window.location.href = 'login.html';
            }
            return;
        }

        const hasPermission = await window.supabaseClient.checkUserPermissions('edit');
        
        if (hasPermission) {
            if (typeof callback === 'function') {
                callback(authState.user, authState.profile);
            }
        } else {
            const message = 'No tienes permisos para editar registros';
            console.log('Acceso denegado - Sin permisos de edición');
            
            if (typeof errorCallback === 'function') {
                errorCallback(message);
            } else {
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast(message, 'error');
                }
            }
        }
        
    } catch (error) {
        console.error('Error en requireEditAccess:', error);
        if (typeof errorCallback === 'function') {
            errorCallback('Error verificando permisos de edición');
        }
    }
}

/**
 * Guard para verificar permisos de eliminación
 * @param {Function} callback - Función a ejecutar si puede eliminar
 * @param {Function} errorCallback - Función a ejecutar si no puede
 */
async function requireDeleteAccess(callback, errorCallback = null) {
    try {
        const authState = await window.auth.checkAuthState();
        
        if (!authState.isValid) {
            if (typeof errorCallback === 'function') {
                errorCallback('No autenticado');
            } else {
                window.location.href = 'login.html';
            }
            return;
        }

        const hasPermission = await window.supabaseClient.checkUserPermissions('delete');
        
        if (hasPermission) {
            if (typeof callback === 'function') {
                callback(authState.user, authState.profile);
            }
        } else {
            const message = 'No tienes permisos para eliminar registros';
            console.log('Acceso denegado - Sin permisos de eliminación');
            
            if (typeof errorCallback === 'function') {
                errorCallback(message);
            } else {
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast(message, 'error');
                }
            }
        }
        
    } catch (error) {
        console.error('Error en requireDeleteAccess:', error);
        if (typeof errorCallback === 'function') {
            errorCallback('Error verificando permisos de eliminación');
        }
    }
}

/**
 * Guard para proteger elementos del DOM según permisos
 * @param {string} selector - Selector CSS del elemento
 * @param {string} permission - Tipo de permiso requerido
 * @param {Object} context - Contexto adicional (área, etc.)
 */
async function protectElement(selector, permission, context = {}) {
    try {
        const element = document.querySelector(selector);
        if (!element) return;

        const hasPermission = await window.supabaseClient.checkUserPermissions(permission, context);
        
        if (!hasPermission) {
            element.style.display = 'none';
            element.setAttribute('data-protected', 'true');
        } else {
            element.style.display = '';
            element.removeAttribute('data-protected');
        }
        
    } catch (error) {
        console.error('Error protegiendo elemento:', error);
        // Por seguridad, ocultar el elemento si hay error
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
            element.setAttribute('data-protected', 'true');
        }
    }
}

/**
 * Proteger múltiples elementos según permisos
 * @param {Array} protections - Array de objetos {selector, permission, context}
 */
async function protectMultipleElements(protections) {
    const promises = protections.map(({ selector, permission, context = {} }) => 
        protectElement(selector, permission, context)
    );
    
    await Promise.all(promises);
}

/**
 * Guard para inicializar protecciones de página
 * @param {string} pageName - Nombre de la página actual
 */
async function initPageGuards(pageName) {
    try {
        console.log(`Inicializando guards para página: ${pageName}`);
        
        // Verificar autenticación básica
        await requireAuth(async (user, profile) => {
            console.log(`Usuario autenticado: ${profile.display_name} (${profile.role.name})`);
            
            // Aplicar protecciones específicas por página
            switch (pageName) {
                case 'admin':
                    await requireAdmin(
                        () => console.log('Acceso a admin autorizado'),
                        () => {
                            window.ui.showToast('Solo los administradores pueden acceder a esta página', 'error');
                            setTimeout(() => window.location.href = 'index.html', 2000);
                        }
                    );
                    break;
                    
                case 'captura':
                    // Proteger botones de edición/eliminación según permisos
                    await protectMultipleElements([
                        { selector: '.edit-button', permission: 'edit' },
                        { selector: '.delete-button', permission: 'delete' }
                    ]);
                    break;
                    
                case 'consulta':
                    // Proteger funciones avanzadas según rol
                    await protectElement('.advanced-filters', 'admin');
                    break;
            }
        });
        
    } catch (error) {
        console.error('Error inicializando guards de página:', error);
        window.location.href = 'login.html';
    }
}

/**
 * Verificar si el usuario puede acceder a una acción específica
 * @param {string} action - Acción a verificar
 * @param {Object} context - Contexto adicional
 * @returns {Promise<boolean>} - true si puede, false si no
 */
async function canPerformAction(action, context = {}) {
    try {
        const authState = await window.auth.checkAuthState();
        if (!authState.isValid) return false;
        
        return await window.supabaseClient.checkUserPermissions(action, context);
    } catch (error) {
        console.error('Error verificando acción:', error);
        return false;
    }
}

// Exportar funciones para uso global
window.guards = {
    requireAuth,
    requireRole,
    requireAdmin,
    requireUserManagement,
    requireWriteAccess,
    requireEditAccess,
    requireDeleteAccess,
    protectElement,
    protectMultipleElements,
    initPageGuards,
    canPerformAction
};
