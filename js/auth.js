/**
 * Indicadores 2.0 - AIFA
 * Módulo de autenticación
 * Maneja login, logout y validación de sesiones
 */

/**
 * Intentar iniciar sesión con email y contraseña
 * @param {string} email - Correo electrónico del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Promise<Object>} - Resultado del login con success, message, user
 */
async function signIn(email, password) {
    try {
        // Validar formato de entrada
        if (!email || !password) {
            return {
                success: false,
                message: 'Email y contraseña son requeridos',
                user: null
            };
        }

        // Validar que sea un correo de AIFA
        if (!window.supabaseClient.validateAifaEmail(email)) {
            return {
                success: false,
                message: 'Solo se permiten correos del dominio @aifa.aero',
                user: null
            };
        }

        // Intentar autenticación con Supabase
        const { data, error } = await window.supabaseClient.supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password: password
        });

        if (error) {
            console.error('Error en autenticación:', error);
            
            // Mensajes de error más amigables
            let message = 'Error al iniciar sesión';
            
            switch (error.message) {
                case 'Invalid login credentials':
                    message = 'Credenciales inválidas. Verifica tu email y contraseña.';
                    break;
                case 'Email not confirmed':
                    message = 'Debes confirmar tu email antes de iniciar sesión.';
                    break;
                case 'Too many requests':
                    message = 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
                    break;
                default:
                    message = error.message;
            }
            
            return {
                success: false,
                message: message,
                user: null
            };
        }

        // Verificar que el usuario esté activo en el sistema
        const profile = await window.supabaseClient.getCurrentUserProfile();
        
        if (!profile) {
            // Si no hay perfil, cerrar sesión automáticamente
            await window.supabaseClient.signOut();
            return {
                success: false,
                message: 'Tu cuenta no está configurada en el sistema. Contacta al administrador.',
                user: null
            };
        }

        if (!profile.is_active) {
            // Si el perfil está inactivo, cerrar sesión
            await window.supabaseClient.signOut();
            return {
                success: false,
                message: 'Tu cuenta está desactivada. Contacta al administrador.',
                user: null
            };
        }

        return {
            success: true,
            message: 'Sesión iniciada correctamente',
            user: data.user,
            profile: profile
        };

    } catch (error) {
        console.error('Error inesperado en signIn:', error);
        return {
            success: false,
            message: 'Error inesperado al iniciar sesión. Intenta de nuevo.',
            user: null
        };
    }
}

/**
 * Cerrar sesión del usuario actual
 * @returns {Promise<Object>} - Resultado del logout con success y message
 */
async function signOut() {
    try {
        const success = await window.supabaseClient.signOut();
        
        if (success) {
            // Limpiar datos locales si los hay
            clearLocalAuthData();
            
            return {
                success: true,
                message: 'Sesión cerrada correctamente'
            };
        } else {
            return {
                success: false,
                message: 'Error al cerrar sesión'
            };
        }
        
    } catch (error) {
        console.error('Error inesperado en signOut:', error);
        return {
            success: false,
            message: 'Error inesperado al cerrar sesión'
        };
    }
}

/**
 * Verificar si hay una sesión activa válida
 * @returns {Promise<Object>} - Estado de la sesión con isValid, user, profile
 */
async function checkAuthState() {
    try {
        const user = await window.supabaseClient.getCurrentUser();
        
        if (!user) {
            return {
                isValid: false,
                user: null,
                profile: null,
                message: 'No hay sesión activa'
            };
        }

        // Verificar que el usuario tenga un perfil válido
        const profile = await window.supabaseClient.getCurrentUserProfile();
        
        if (!profile || !profile.is_active) {
            // Cerrar sesión si el perfil no es válido
            await signOut();
            return {
                isValid: false,
                user: null,
                profile: null,
                message: 'Perfil de usuario inválido o inactivo'
            };
        }

        return {
            isValid: true,
            user: user,
            profile: profile,
            message: 'Sesión válida'
        };

    } catch (error) {
        console.error('Error verificando estado de autenticación:', error);
        return {
            isValid: false,
            user: null,
            profile: null,
            message: 'Error al verificar la sesión'
        };
    }
}

/**
 * Redirigir al usuario según su estado de autenticación
 * @param {string} currentPage - Página actual (sin extensión)
 * @param {boolean} requireAuth - Si la página requiere autenticación
 */
async function handleAuthRedirect(currentPage = '', requireAuth = true) {
    try {
        const authState = await checkAuthState();
        
        if (requireAuth && !authState.isValid) {
            // Si requiere auth y no está autenticado, ir al login
            if (currentPage !== 'login') {
                window.location.href = 'login.html';
                return;
            }
        } else if (!requireAuth && authState.isValid) {
            // Si no requiere auth pero está autenticado (ej: en login), ir al dashboard
            if (currentPage === 'login') {
                window.location.href = 'index.html';
                return;
            }
        }

        // Verificar permisos para páginas específicas
        if (authState.isValid && authState.profile) {
            const hasPermission = await checkPagePermissions(currentPage, authState.profile);
            
            if (!hasPermission) {
                // Mostrar mensaje de error y redirigir al dashboard
                if (window.ui && window.ui.showToast) {
                    window.ui.showToast('No tienes permisos para acceder a esta página', 'error');
                }
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }
        }

    } catch (error) {
        console.error('Error en handleAuthRedirect:', error);
        // En caso de error, redirigir al login por seguridad
        if (requireAuth && currentPage !== 'login') {
            window.location.href = 'login.html';
        }
    }
}

/**
 * Verificar permisos para acceder a una página específica
 * @param {string} page - Nombre de la página
 * @param {Object} profile - Perfil del usuario
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
async function checkPagePermissions(page, profile) {
    if (!profile || !profile.role) return false;
    
    const roleName = profile.role.name.toLowerCase();
    
    switch (page) {
        case 'index':
        case 'consulta':
        case 'captura':
            // Estas páginas están disponibles para todos los usuarios autenticados
            return true;
        
        case 'admin':
            // Solo administradores pueden acceder al panel de admin
            return roleName === 'admin';
        
        default:
            return true;
    }
}

/**
 * Limpiar datos de autenticación locales
 */
function clearLocalAuthData() {
    // En caso de que se usen datos locales en el futuro
    // Por ahora Supabase maneja todo automáticamente
    console.log('Limpiando datos locales de autenticación');
}

/**
 * Configurar listeners de autenticación para toda la aplicación
 */
function setupAuthListeners() {
    // Listener para cambios en el estado de autenticación
    window.supabaseClient.onAuthStateChange(async (event, session) => {
        console.log('Cambio en estado de auth:', event);
        
        switch (event) {
            case 'SIGNED_IN':
                console.log('Usuario autenticado');
                break;
                
            case 'SIGNED_OUT':
                console.log('Usuario desautenticado');
                // Redirigir al login si no estamos ya ahí
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                }
                break;
                
            case 'TOKEN_REFRESHED':
                console.log('Token actualizado');
                break;
        }
    });
}

/**
 * Inicializar el módulo de autenticación
 */
function initAuth() {
    setupAuthListeners();
    console.log('Módulo de autenticación inicializado');
}

// Auto-inicializar cuando se carga el script
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Exportar funciones para uso global
window.auth = {
    signIn,
    signOut,
    checkAuthState,
    handleAuthRedirect,
    checkPagePermissions,
    clearLocalAuthData,
    setupAuthListeners,
    initAuth
};
