/**
 * Indicadores 2.0 - AIFA
 * Cliente de conexión a Supabase
 * Configuración central para autenticación y base de datos
 */

// Configuración de Supabase
const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

// Inicializar cliente de Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
 * Obtener información del usuario actual
 * @returns {Promise<Object|null>} - Datos del usuario o null si no está autenticado
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Error obteniendo usuario:', error);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Error en getCurrentUser:', error);
        return null;
    }
}

/**
 * Obtener perfil completo del usuario actual con rol y áreas
 * @returns {Promise<Object|null>} - Perfil completo o null
 */
async function getCurrentUserProfile() {
    try {
        const user = await getCurrentUser();
        if (!user) return null;
        
        // Obtener perfil con rol
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select(`
                *,
                role:roles(id, name),
                user_areas(area:areas(id, name, code))
            `)
            .eq('id', user.id)
            .eq('is_active', true)
            .single();
        
        if (profileError) {
            console.error('Error obteniendo perfil:', profileError);
            return null;
        }
        
        return profile;
    } catch (error) {
        console.error('Error en getCurrentUserProfile:', error);
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
        if (!profile || !profile.role) return false;
        
        const roleName = profile.role.name.toLowerCase();
        
        switch (action) {
            case 'read':
                return ['capturista', 'jefe', 'subdirector', 'director', 'admin'].includes(roleName);
            
            case 'write':
                if (roleName === 'capturista') {
                    // Solo puede escribir en sus áreas asignadas
                    if (context.areaId) {
                        const userAreas = profile.user_areas.map(ua => ua.area.id);
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
        const roleName = profile.role.name.toLowerCase();
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
        return profile.user_areas.map(ua => ua.area);
    } catch (error) {
        console.error('Error obteniendo áreas del usuario:', error);
        return [];
    }
}

/**
 * Configurar listener para cambios en el estado de autenticación
 * @param {Function} callback - Función a ejecutar cuando cambie el estado
 */
function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
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

// Exportar funciones para uso global
window.supabaseClient = {
    supabase,
    validateAifaEmail,
    getCurrentUser,
    getCurrentUserProfile,
    checkUserPermissions,
    getUserAreas,
    onAuthStateChange,
    signOut
};
