// =====================================================
// CLIENTE SUPABASE Y HELPERS GENÉRICOS
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG, MESSAGES } from '../config.js';
const supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
export const supabase = supabaseInstance;
// Estado global de la aplicación
export const appState = {
    user: null,
    profile: null,
    session: null,
    loading: false,
    initialized: false
};

// =====================================================
// HELPERS GENÉRICOS DE BASE DE DATOS
// =====================================================

/**
 * Helper genérico para SELECT con manejo de errores
 */
export async function selectData(table, options = {}) {
    try {
        if (DEBUG.enabled) console.log(`🔍 SELECT ${table}:`, options);
        
        let query = supabase.from(table).select(options.select || '*');
        
        // Aplicar filtros
        if (options.filters) {
            Object.entries(options.filters).forEach(([column, value]) => {
                if (value !== null && value !== undefined) {
                    if (Array.isArray(value)) {
                        query = query.in(column, value);
                    } else if (typeof value === 'object' && value.operator) {
                        switch (value.operator) {
                            case 'gte':
                                query = query.gte(column, value.value);
                                break;
                            case 'lte':
                                query = query.lte(column, value.value);
                                break;
                            case 'like':
                                query = query.like(column, value.value);
                                break;
                            case 'ilike':
                                query = query.ilike(column, value.value);
                                break;
                            default:
                                query = query.eq(column, value.value);
                        }
                    } else {
                        query = query.eq(column, value);
                    }
                }
            });
        }
        
        // Aplicar ordenamiento
        if (options.orderBy) {
            const { column, ascending = true } = options.orderBy;
            query = query.order(column, { ascending });
        }
        
        // Aplicar paginación
        if (options.range) {
            const { from, to } = options.range;
            query = query.range(from, to);
        }
        
        // Aplicar límite
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error(`❌ Error en SELECT ${table}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }
        
        if (DEBUG.enabled) console.log(`✅ SELECT ${table} exitoso:`, { count: data?.length });
        
        return { data, count };
    } catch (error) {
        handleError(error, `Error al consultar ${table}`);
        throw error;
    }
}

/**
 * Helper genérico para INSERT con manejo de errores
 */
export async function insertData(table, data, options = {}) {
    try {
        if (DEBUG.enabled) console.log(`➕ INSERT ${table}:`, data);
        
        // Configurar usuario actual para auditoría
        await setCurrentUser();
        
        let query = supabase.from(table).insert(data);
        
        if (options.select) {
            query = query.select(options.select);
        }
        
        const { data: result, error } = await query;
        
        if (error) {
            console.error(`❌ Error en INSERT ${table}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }
        
        if (DEBUG.enabled) console.log(`✅ INSERT ${table} exitoso:`, result);
        
        return { data: result };
    } catch (error) {
        handleError(error, `Error al insertar en ${table}`);
        throw error;
    }
}

/**
 * Helper genérico para UPDATE con manejo de errores
 */
export async function updateData(table, data, filters, options = {}) {
    try {
        if (DEBUG.enabled) console.log(`📝 UPDATE ${table}:`, { data, filters });
        
        // Configurar usuario actual para auditoría
        await setCurrentUser();
        
        let query = supabase.from(table).update(data);
        
        // Aplicar filtros para UPDATE
        Object.entries(filters).forEach(([column, value]) => {
            query = query.eq(column, value);
        });
        
        if (options.select) {
            query = query.select(options.select);
        }
        
        const { data: result, error } = await query;
        
        if (error) {
            console.error(`❌ Error en UPDATE ${table}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }
        
        if (DEBUG.enabled) console.log(`✅ UPDATE ${table} exitoso:`, result);
        
        return { data: result };
    } catch (error) {
        handleError(error, `Error al actualizar ${table}`);
        throw error;
    }
}

/**
 * Helper genérico para DELETE con manejo de errores
 */
export async function deleteData(table, filters, options = {}) {
    try {
        if (DEBUG.enabled) console.log(`🗑️ DELETE ${table}:`, filters);
        
        // Configurar usuario actual para auditoría
        await setCurrentUser();
        
        let query = supabase.from(table).delete();
        
        // Aplicar filtros para DELETE
        Object.entries(filters).forEach(([column, value]) => {
            query = query.eq(column, value);
        });
        
        if (options.select) {
            query = query.select(options.select);
        }
        
        const { data: result, error } = await query;
        
        if (error) {
            console.error(`❌ Error en DELETE ${table}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }
        
        if (DEBUG.enabled) console.log(`✅ DELETE ${table} exitoso:`, result);
        
        return { data: result };
    } catch (error) {
        handleError(error, `Error al eliminar de ${table}`);
        throw error;
    }
}

/**
 * Helper para ejecutar RPC (funciones almacenadas)
 */
export async function callRPC(functionName, params = {}) {
    try {
        if (DEBUG.enabled) console.log(`🔧 RPC ${functionName}:`, params);
        
        const { data, error } = await supabase.rpc(functionName, params);
        
        if (error) {
            console.error(`❌ Error en RPC ${functionName}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }
        
        if (DEBUG.enabled) console.log(`✅ RPC ${functionName} exitoso:`, data);
        
        return { data };
    } catch (error) {
        handleError(error, `Error al ejecutar ${functionName}`);
        throw error;
    }
}

// =====================================================
// GESTIÓN DE AUTENTICACIÓN
// =====================================================

/**
 * Obtener sesión actual
 */
export async function getCurrentSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('❌ Error al obtener sesión:', error);
            return null;
        }
        
        appState.session = session;
        return session;
    } catch (error) {
        console.error('❌ Error al verificar sesión:', error);
        return null;
    }
}

/**
 * Obtener usuario actual
 */
export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('❌ Error al obtener usuario:', error);
            return null;
        }
        
        appState.user = user;
        return user;
    } catch (error) {
        console.error('❌ Error al verificar usuario:', error);
        return null;
    }
}

/**
 * Obtener perfil completo del usuario actual
 */
export async function getCurrentProfile() {
    try {
        const user = await getCurrentUser();
        if (!user) return null;
        
        const { data, error } = await supabase
            .from('perfiles')
            .select(`
                *,
                usuario_areas (
                    id,
                    area_id,
                    rol,
                    puede_capturar,
                    puede_editar,
                    puede_eliminar,
                    areas (
                        id,
                        clave,
                        nombre,
                        color_hex
                    )
                )
            `)
            .eq('id', user.id)
            .eq('estado', 'ACTIVO')
            .single();
        
        if (error) {
            console.error('❌ Error al obtener perfil:', error);
            return null;
        }
        
        appState.profile = data;
        return data;
    } catch (error) {
        console.error('❌ Error al cargar perfil:', error);
        return null;
    }
}

/**
 * Configurar usuario actual para auditoría
 */
export async function setCurrentUser() {
    try {
        const user = await getCurrentUser();
        if (user) {
            await supabase.rpc('set_config', {
                setting_name: 'app.current_user_id',
                setting_value: user.id,
                is_local: true
            });
        }
    } catch (error) {
        if (DEBUG.enabled) console.warn('⚠️ No se pudo configurar usuario para auditoría:', error);
    }
}

/**
 * Cerrar sesión
 */
export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('❌ Error al cerrar sesión:', error);
            throw error;
        }
        
        // Limpiar estado
        appState.user = null;
        appState.profile = null;
        appState.session = null;
        
        if (DEBUG.enabled) console.log('✅ Sesión cerrada correctamente');
        
        return true;
    } catch (error) {
        handleError(error, 'Error al cerrar sesión');
        throw error;
    }
}

// =====================================================
// VALIDACIONES Y PERMISOS
// =====================================================

/**
 * Verificar si el usuario tiene permiso para una acción en un área
 */
export async function checkAreaPermission(areaId, action = 'SELECT') {
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        
        const { data } = await callRPC('usuario_tiene_permiso_area', {
            p_usuario_id: user.id,
            p_area_id: areaId,
            p_accion: action
        });
        
        return data === true;
    } catch (error) {
        console.error('❌ Error al verificar permisos:', error);
        return false;
    }
}

/**
 * Verificar si el usuario tiene un rol específico o superior
 */
export function hasRoleLevel(userRole, minRole) {
    const roleLevels = {
        'CAPTURISTA': 1,
        'JEFE_AREA': 2,
        'SUBDIRECTOR': 3,
        'DIRECTOR': 4,
        'ADMIN': 5
    };
    
    const userLevel = roleLevels[userRole] || 0;
    const minLevel = roleLevels[minRole] || 999;
    
    return userLevel >= minLevel;
}

// =====================================================
// MANEJO DE ERRORES
// =====================================================

/**
 * Clase personalizada para errores de Supabase
 */
export class SupabaseError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'SupabaseError';
        this.code = code;
        this.details = details;
    }
}

/**
 * Manejo centralizado de errores
 */
export function handleError(error, context = 'Operación') {
    console.error(`❌ ${context}:`, error);
    
    let userMessage = MESSAGES.errors.generic;
    
    if (error instanceof SupabaseError) {
        switch (error.code) {
            case 'PGRST116':
                userMessage = MESSAGES.errors.notFound;
                break;
            case '42501':
                userMessage = MESSAGES.errors.forbidden;
                break;
            case 'PGRST301':
                userMessage = MESSAGES.data.invalidData;
                break;
            default:
                userMessage = error.message || MESSAGES.errors.server;
        }
    } else if (error.name === 'NetworkError') {
        userMessage = MESSAGES.errors.network;
    }
    
    // Aquí se puede integrar con el sistema de notificaciones
    if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(userMessage, 'error');
    }
    
    return userMessage;
}

// =====================================================
// UTILIDADES ADICIONALES
// =====================================================

/**
 * Generar filtros para fechas
 */
export function createDateFilters(startDate, endDate) {
    const filters = {};
    
    if (startDate) {
        filters.fecha_creacion = { operator: 'gte', value: startDate };
    }
    
    if (endDate) {
        filters.fecha_creacion = { 
            ...filters.fecha_creacion,
            operator: 'lte', 
            value: endDate 
        };
    }
    
    return filters;
}

/**
 * Construir parámetros de paginación
 */
export function createPagination(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    return { from, to };
}

/**
 * Escapar texto para búsqueda
 */
export function escapeSearchText(text) {
    if (!text) return '';
    return text.replace(/[%_]/g, '\\$&');
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

/**
 * Inicializar cliente y configurar listeners
 */
export async function initSupabase() {
    try {
        // Configurar listener de cambios de autenticación
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (DEBUG.enabled) console.log('🔐 Auth state changed:', event, session?.user?.email);
            
            appState.session = session;
            appState.user = session?.user || null;
            
            if (event === 'SIGNED_IN') {
                appState.profile = await getCurrentProfile();
            } else if (event === 'SIGNED_OUT') {
                appState.profile = null;
            }
        });
        
        // Verificar sesión inicial
        await getCurrentSession();
        if (appState.session) {
            appState.profile = await getCurrentProfile();
        }
        
        appState.initialized = true;
        
        if (DEBUG.enabled) {
            console.log('✅ Supabase inicializado correctamente');
            console.log('👤 Estado inicial:', {
                authenticated: !!appState.user,
                email: appState.user?.email,
                role: appState.profile?.rol_principal
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error al inicializar Supabase:', error);
        throw error;
    }
}

// Auto-inicializar cuando se carga el módulo
initSupabase().catch(console.error);
