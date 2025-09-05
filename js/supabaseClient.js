/**
 * Indicadores 2.0 - AIFA
 * Cliente de conexión a Supabase
 * Configuración central para autenticación y base de datos
 */

// Configuración de Supabase
const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

// Inicializar cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Validar que el correo sea del dominio @aifa.aero
 * @param {string} email - Correo electrónico a validar
 * @returns {boolean} - true si es válido, false si no
 */
function validateAifaEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@aifa\.aero$/;
    return emailRegex.test(email.toLowerCase());
}

/**
 * Obtener sesión actual
 * @returns {Promise<Object|null>} - Sesión actual o null
 */
async function getSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error obteniendo sesión:', error);
            return null;
        }
        return session;
    } catch (error) {
        console.error('Error en getSession:', error);
        return null;
    }
}

/**
 * Obtener información del usuario actual
 * @returns {Promise<Object|null>} - Datos del usuario o null si no está autenticado
 */
async function getCurrentUser() {
    try {
        // CAMBIO PRINCIPAL: Primero verificar si hay sesión
        const session = await getSession();
        
        if (!session) {
            // No hay sesión activa - esto es normal, no es un error
            return null;
        }
        
        // Solo intentar obtener el usuario si hay sesión activa
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Error obteniendo usuario:', error);
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error inesperado en getCurrentUser:', error);
        return null;
    }
}

/**
 * Obtener perfil completo del usuario actual con rol y áreas
 * @returns {Promise<Object|null>} - Perfil completo o null
 */
async function getCurrentUserProfile() {
    try {
        // CAMBIO: Usar getSession primero
        const session = await getSession();
        if (!session || !session.user) return null;
        
        const userId = session.user.id;

        // Query simplificado para evitar errores de JOIN
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .eq('activo', true)
            .single();

        if (error) {
            console.error('Error obteniendo perfil:', error);
            return null;
        }

        // Si encontramos el usuario, obtener el rol por separado
        if (data && data.rol_id) {
            const { data: roleData } = await supabase
                .from('roles')
                .select('id, name')
                .eq('id', data.rol_id)
                .single();
            
            if (roleData) {
                data.roles = roleData; // Agregar rol al objeto usuario
            }

            // Obtener áreas del usuario si existen
            const { data: userAreas } = await supabase
                .from('user_areas')
                .select(`
                    area_id,
                    areas(id, name, code)
                `)
                .eq('user_id', userId);
            
            if (userAreas) {
                data.user_areas = userAreas;
            }
        }

        return data;
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        return null;
    }
}

/**
 * Verificar si el usuario tiene permisos para una acción específica
 * @param {string} action - Acción a verificar (read, write, delete, admin)
 * @param {Object} context - Contexto adicional (área, recurso, etc.)
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
async function checkUserPermissions(action, context = {}) {
    try {
        const profile = await getCurrentUserProfile();
        if (!profile || !profile.roles) return false;
        
        const roleName = profile.roles.name.toLowerCase();
        
        switch (action) {
            case 'read':
                return ['capturista', 'jefe', 'subdirector', 'director', 'admin'].includes(roleName);
            
            case 'write':
                if (roleName === 'capturista') {
                    // Solo puede escribir en sus áreas asignadas
                    if (context.areaId && profile.user_areas) {
                        const userAreas = profile.user_areas.map(ua => ua.areas.id);
                        return userAreas.includes(context.areaId);
                    }
                    return false;
                }
                return ['jefe', 'subdirector', 'director', 'admin'].includes(roleName);
            
            case 'edit':
                if (roleName === 'capturista') {
                    return false; // Los capturistas no pueden editar registros existentes
                }
                return ['jefe', 'subdirector', 'director', 'admin'].includes(roleName);
            
            case 'delete':
                return ['subdirector', 'director', 'admin'].includes(roleName);
            
            case 'admin':
                return roleName === 'admin';
            
            case 'user_management':
                return ['director', 'admin'].includes(roleName);
            
            default:
                return false;
        }
    } catch (error) {
        console.error('Error verificando permisos:', error);
        return false;
    }
}

/**
 * Obtener áreas asignadas al usuario actual
 * @returns {Promise<Array>} - Array de áreas asignadas
 */
async function getUserAreas() {
    try {
        const profile = await getCurrentUserProfile();
        if (!profile) return [];
        
        // Si es subdirector, director o admin, puede ver todas las áreas
        const roleName = profile.roles.name.toLowerCase();
        if (['subdirector', 'director', 'admin'].includes(roleName)) {
            const { data: allAreas, error } = await supabase
                .from('areas')
                .select('*')
                .order('name');
            
            if (error) {
                console.error('Error obteniendo todas las áreas:', error);
                return [];
            }
            
            return allAreas;
        }
        
        // Para otros roles, solo sus áreas asignadas
        if (profile.user_areas) {
            return profile.user_areas.map(ua => ua.areas);
        }
        
        return [];
    } catch (error) {
        console.error('Error obteniendo áreas del usuario:', error);
        return [];
    }
}

/**
 * Inicializar el cliente y recuperar sesión guardada
 * Esta función debe llamarse al cargar la aplicación
 * @returns {Promise<Object|null>} - Sesión recuperada o null
 */
async function initializeAuth() {
    try {
        // Recuperar sesión del localStorage si existe
        const session = await getSession();
        
        if (session) {
            console.log('Sesión recuperada para:', session.user.email);
            return session;
        } else {
            console.log('No hay sesión guardada');
            return null;
        }
    } catch (error) {
        console.error('Error inicializando autenticación:', error);
        return null;
    }
}

/**
 * Configurar listener para cambios en el estado de autenticación
 * @param {Function} callback - Función a ejecutar cuando cambie el estado
 */
function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
        // Log del evento para debugging
        console.log('Auth event:', event);
        
        // Si es el evento inicial y no hay sesión, no es un error
        if (event === 'INITIAL_SESSION' && !session) {
            console.log('No hay sesión inicial - usuario no autenticado');
        }
        
        callback(event, session);
    });
}

/**
 * Cerrar sesión del usuario actual
 * @returns {Promise<boolean>} - true si fue exitoso, false si no
 */
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error cerrando sesión:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error en signOut:', error);
        return false;
    }
}

/**
 * Verificar si hay un usuario autenticado
 * @returns {Promise<boolean>} - true si hay usuario autenticado
 */
async function isAuthenticated() {
    const session = await getSession();
    return !!session;
}

// Exportar funciones para uso global
window.supabaseClient = {
    supabase,
    validateAifaEmail,
    getSession,
    getCurrentUser,
    getCurrentUserProfile,
    checkUserPermissions,
    getUserAreas,
    initializeAuth,
    onAuthStateChange,
    signOut,
    isAuthenticated
};

// Inicializar autenticación al cargar el módulo
(async () => {
    console.log('Supabase Client inicializado correctamente');
    // Intentar recuperar sesión guardada
    await initializeAuth();
})();
