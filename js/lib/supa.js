// =====================================================
// CLIENTE SUPABASE Y HELPERS GENÉRICOS
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG, MESSAGES, isDevelopment } from '../config.js';
import { withCache, invalidateByTags, clearCache as clearGlobalCache } from '../core/cache.js';

// Mantener referencia compartida del cliente Supabase
export let supabase = typeof window !== 'undefined' ? window.supabaseClient ?? null : null;

let supabaseAvailabilityLogged = false;

const TABLE_TAG_PREFIX = 'table:';

const SELECT_CACHE_DEFAULTS = new Map([
    ['areas', { ttl: 5 * 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['indicadores', { ttl: 2 * 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['usuario_areas', { ttl: 2 * 60 * 1000 }],
    ['v_areas_usuario', { ttl: 5 * 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['v_dashboard_resumen', { ttl: 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['v_indicadores_area', { ttl: 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['v_mediciones_historico', { ttl: 30 * 1000, staleWhileRevalidate: 30 * 1000 }],
    ['indicador_metas', { ttl: 2 * 60 * 1000, staleWhileRevalidate: 60 * 1000 }],
    ['perfiles', { ttl: 5 * 60 * 1000 }]
]);

const CACHE_DEPENDENCIES = new Map([
    ['areas', ['areas', 'v_indicadores_area', 'v_dashboard_resumen', 'v_areas_usuario']],
    ['indicadores', ['indicadores', 'v_indicadores_area', 'v_dashboard_resumen']],
    ['usuario_areas', ['usuario_areas', 'v_areas_usuario', 'v_dashboard_resumen']],
    ['mediciones', ['mediciones', 'v_mediciones_historico', 'v_indicadores_area', 'v_dashboard_resumen']],
    ['v_mediciones_historico', ['v_mediciones_historico']],
    ['indicador_metas', ['indicador_metas', 'v_indicadores_area', 'v_dashboard_resumen']],
    ['perfiles', ['perfiles']],
    ['v_dashboard_resumen', ['v_dashboard_resumen']]
]);

function mergeCacheConfig(defaultConfig = {}, customConfig = {}) {
    return {
        ...defaultConfig,
        ...customConfig,
        ttl: customConfig.ttl ?? defaultConfig.ttl ?? 0,
        staleWhileRevalidate: customConfig.staleWhileRevalidate ?? defaultConfig.staleWhileRevalidate ?? 0
    };
}

function resolveCacheConfig(table, cacheOption) {
    if (cacheOption === false) {
        return null;
    }

    const defaultConfig = SELECT_CACHE_DEFAULTS.get(table) || null;

    if (cacheOption === true || cacheOption === undefined) {
        return defaultConfig;
    }

    if (typeof cacheOption === 'number') {
        return { ttl: cacheOption };
    }

    if (typeof cacheOption === 'object' && cacheOption !== null) {
        return mergeCacheConfig(defaultConfig || {}, cacheOption);
    }

    return defaultConfig;
}

function collectTagsForTable(table, extraTags = []) {
    const normalizedExtras = Array.isArray(extraTags) ? extraTags : [extraTags];
    const tags = new Set(normalizedExtras.filter(Boolean));
    if (table) {
        const dependents = CACHE_DEPENDENCIES.get(table) || [table];
        dependents.forEach(name => tags.add(`${TABLE_TAG_PREFIX}${name}`));
    }
    return Array.from(tags);
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    const entries = keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
}

function normalizeFilters(filters = {}) {
    const normalized = {};
    Object.keys(filters).sort().forEach(key => {
        const value = filters[key];
        if (Array.isArray(value)) {
            normalized[key] = value.map(item => stableStringify(item));
        } else if (typeof value === 'object' && value !== null) {
            normalized[key] = stableStringify(value);
        } else {
            normalized[key] = value;
        }
    });
    return normalized;
}

function normalizeOrderBy(orderBy) {
    if (Array.isArray(orderBy)) {
        return orderBy.map(item => {
            if (typeof item === 'string') {
                return item;
            }
            return { column: item.column, ascending: item.ascending !== false };
        });
    }

    if (typeof orderBy === 'string') {
        return orderBy;
    }

    if (orderBy && typeof orderBy === 'object') {
        return { column: orderBy.column, ascending: orderBy.ascending !== false };
    }

    return orderBy;
}

function normalizeSelectOptions(options = {}) {
    const normalized = {};

    if (options.select) {
        normalized.select = options.select;
    }

    if (options.filters) {
        normalized.filters = normalizeFilters(options.filters);
    }

    if (options.orderBy) {
        normalized.orderBy = normalizeOrderBy(options.orderBy);
    }

    ['limit', 'from', 'to', 'head', 'count'].forEach(key => {
        if (options[key] !== undefined) {
            normalized[key] = options[key];
        }
    });

    return normalized;
}

function buildSelectCacheKey(table, options) {
    return `${table}::${stableStringify(options)}`;
}

function collectTagsForTables(tables = []) {
    const tags = new Set();
    tables.forEach(table => {
        collectTagsForTable(table).forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
}

export function invalidateTableCache(table) {
    if (!table) {
        return;
    }
    const tags = collectTagsForTable(table);
    invalidateByTags(tags);
}

export function invalidateTablesCache(tables = []) {
    if (!tables || tables.length === 0) {
        return;
    }
    const tags = collectTagsForTables(tables);
    invalidateByTags(tags);
}

export function clearSupabaseCache() {
    clearGlobalCache();
}

function recreateSupabaseClient(context = 'recreateSupabaseClient') {
    if (typeof window === 'undefined') {
        return null;
    }

    if (!window.supabase?.createClient) {
        if (!supabaseAvailabilityLogged) {
            console.error('❌ Supabase no está disponible en la ventana. Asegúrate de cargar la librería antes de inicializar.', context);
            supabaseAvailabilityLogged = true;
        }
        return null;
    }

    try {
        const authOptions = {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: 'aifa-auth-token',
            flowType: 'pkce'
        };

        if (typeof window.localStorage !== 'undefined') {
            authOptions.storage = window.localStorage;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: authOptions });
        window.supabaseClient = supabase;

        if (DEBUG.enabled) {
            console.info(`♻️ Cliente Supabase recreado (${context})`);
        }

        return supabase;
    } catch (error) {
        console.error('❌ Error al recrear el cliente de Supabase:', error);
        return null;
    }
}

export function ensureSupabaseClient(context = 'ensureSupabaseClient') {
    if (supabase?.auth?.getSession) {
        return supabase;
    }

    if (typeof window === 'undefined') {
        return null;
    }

    if (window.supabaseClient?.auth?.getSession) {
        supabase = window.supabaseClient;
        return supabase;
    }

    return recreateSupabaseClient(context);
}

if (!ensureSupabaseClient('initial-load')) {
    console.error('❌ Error: Cliente Supabase no está disponible. Verifica que config.js se haya ejecutado correctamente.');
    throw new Error('Supabase client not available');
}

// Estado global de la aplicación
export const appState = {
    user: null,
    profile: null,
    session: null,
    loading: false,
    initialized: false
};

const authListeners = new Set();

export function onAuthStateChange(listener) {
    if (typeof listener !== 'function') {
        return () => {};
    }

    authListeners.add(listener);

    return () => {
        authListeners.delete(listener);
    };
}

function notifyAuthListeners(event, session) {
    authListeners.forEach(listener => {
        try {
            listener({ event, session, user: appState.user, profile: appState.profile });
        } catch (error) {
            console.error('⚠️ Error en listener de autenticación:', error);
        }
    });
}

// =====================================================
// CLASE DE ERROR PERSONALIZADA
// =====================================================

class SupabaseError extends Error {
    constructor(message, code = null, details = null) {
        super(message);
        this.name = 'SupabaseError';
        this.code = code;
        this.details = details;
    }
}

// =====================================================
// MANEJO DE ERRORES
// =====================================================

/**
 * Manejar errores de Supabase de manera uniforme
 */
function handleError(error, context = 'Operación') {
    if (DEBUG.enabled) {
        console.error(`❌ ${context}:`, error);
    }
    
    let userMessage = MESSAGES.error.generic;
    
    if (error.code) {
        switch (error.code) {
            case 'PGRST301':
            case '42501':
                userMessage = MESSAGES.error.unauthorized;
                break;
            case 'PGRST116':
                userMessage = MESSAGES.error.notFound;
                break;
            case '23505':
                userMessage = 'Ya existe un registro con estos datos';
                break;
            case '23503':
                userMessage = 'No se puede eliminar porque está siendo utilizado';
                break;
            default:
                userMessage = error.message || MESSAGES.error.generic;
        }
    } else if (error.message) {
        if (error.message.includes('network')) {
            userMessage = MESSAGES.error.network;
        } else if (error.message.includes('permission')) {
            userMessage = MESSAGES.error.unauthorized;
        } else {
            userMessage = error.message;
        }
    }
    
    return userMessage;
}

function shouldFallbackToMock(error) {
    if (!error) return false;

    const code = error.code || error?.originalError?.code;
    const message = (error.message || '').toLowerCase();

    return code === '42P17' || message.includes('infinite recursion detected in policy');
}

// =====================================================
// HELPERS GENÉRICOS DE BASE DE DATOS
// =====================================================

async function executeSelectQuery(table, options = {}) {
    const devMode = isDevelopment();

    const mockData = devMode ? {
        perfiles: [],
        usuario_areas: [],
        indicadores: []
    } : null;

    const hasMockForTable = devMode && mockData && Object.prototype.hasOwnProperty.call(mockData, table);

    try {
        if (hasMockForTable) {
            if (DEBUG.enabled) console.log(`🔧 Usando datos mock para ${table}`);
            const data = mockData?.[table] ?? [];
            return { data, count: Array.isArray(data) ? data.length : null };
        }

        if (DEBUG.enabled) console.log(`🔍 SELECT ${table}:`, options);

        let query = supabase.from(table).select(options.select || '*');

        const { filters, orderBy, limit, from, to, ascending } = options;

        if (filters) {
            Object.entries(filters).forEach(([column, value]) => {
                if (value === null || value === undefined) {
                    return;
                }

                if (Array.isArray(value)) {
                    query = query.in(column, value);
                } else if (typeof value === 'object' && value?.operator) {
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
                        case 'neq':
                            query = query.neq(column, value.value);
                            break;
                        case 'gt':
                            query = query.gt(column, value.value);
                            break;
                        case 'lt':
                            query = query.lt(column, value.value);
                            break;
                        default:
                            query = query.eq(column, value.value);
                    }
                } else {
                    query = query.eq(column, value);
                }
            });
        }

        if (orderBy) {
            if (Array.isArray(orderBy)) {
                orderBy.forEach(order => {
                    if (typeof order === 'string') {
                        query = query.order(order, { ascending: true });
                    } else {
                        query = query.order(order.column, { ascending: order.ascending !== false });
                    }
                });
            } else if (typeof orderBy === 'string') {
                query = query.order(orderBy, { ascending: ascending !== false });
            } else if (orderBy.column) {
                query = query.order(orderBy.column, { ascending: orderBy.ascending !== false });
            }
        }

        if (limit) {
            query = query.limit(limit);
        }

        if (from !== undefined && to !== undefined) {
            query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error(`❌ Error en SELECT ${table}:`, error);
            throw new SupabaseError(error.message, error.code, error.details);
        }

        if (DEBUG.enabled) console.log(`✅ SELECT ${table} exitoso:`, data?.length || 0, 'registros');

        return { data, count };
    } catch (error) {
        if (hasMockForTable && shouldFallbackToMock(error)) {
            if (DEBUG.enabled) {
                console.warn(`⚠️ Usando datos mock para ${table} en modo desarrollo debido a restricciones de Supabase (${error.code || 'sin código'})`);
            }
            const mock = mockData?.[table] ?? [];
            return { data: mock, count: Array.isArray(mock) ? mock.length : null };
        }
        handleError(error, `Error al consultar ${table}`);
        throw error;
    }
}

/**
 * Helper genérico para SELECT con cache opcional y manejo de errores
 */
export async function selectData(table, options = {}) {
    const { cache: cacheOption, ...queryOptions } = options || {};
    const cacheConfig = resolveCacheConfig(table, cacheOption);
    const normalizedOptions = normalizeSelectOptions(queryOptions);
    const execute = () => executeSelectQuery(table, queryOptions);

    if (!cacheConfig || (cacheConfig.ttl ?? 0) <= 0) {
        return execute();
    }

    const cacheKey = cacheConfig.key ?? buildSelectCacheKey(table, normalizedOptions);
    const tags = collectTagsForTable(table, cacheConfig.tags);

    return withCache(cacheKey, execute, {
        ttl: cacheConfig.ttl,
        staleWhileRevalidate: cacheConfig.staleWhileRevalidate ?? 0,
        tags,
        forceRefresh: cacheConfig.force === true || cacheConfig.forceRefresh === true,
        onError: (error) => {
            if (DEBUG.enabled) {
                console.warn(`⚠️ Error al obtener datos cacheados de ${table}:`, error);
            }
        }
    });
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

        invalidateTableCache(table);

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
            if (Array.isArray(value)) {
                query = query.in(column, value);
            } else {
                query = query.eq(column, value);
            }
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

        invalidateTableCache(table);

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
            if (Array.isArray(value)) {
                query = query.in(column, value);
            } else {
                query = query.eq(column, value);
            }
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

        invalidateTableCache(table);

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
async function refreshSession() {
    // Evitar refresh simultáneos
    if (sessionRefreshInProgress) {
        if (DEBUG.enabled) {
            console.log('⏭️ Refresh de sesión ya en progreso');
        }
        return appState.session;
    }
    
    sessionRefreshInProgress = true;
    
    try {
        const client = ensureSupabaseClient('refreshSession');

        if (!client?.auth?.refreshSession) {
            console.warn('⚠️ Cliente de Supabase no disponible para refrescar la sesión');
            return null;
        }

        if (DEBUG.enabled) {
            console.log('🔄 Intentando refrescar sesión...');
        }

        const { data, error } = await client.auth.refreshSession();

        if (error || !data?.session) {
            if (DEBUG.enabled) {
                console.warn('⚠️ No se pudo refrescar la sesión automáticamente:', error);
            }
            return null;
        }

        if (DEBUG.enabled) {
            console.log('✅ Sesión refrescada exitosamente');
        }

        return data.session;
    } catch (error) {
        console.error('❌ Error al refrescar la sesión:', error);
        return null;
    } finally {
        sessionRefreshInProgress = false;
    }
}

export async function getCurrentSession(options = {}) {
    const { allowRefresh = false, silent = false } = options;

    try {
        const client = ensureSupabaseClient('getCurrentSession');

        if (!client?.auth?.getSession) {
            if (!silent) {
                console.warn('⚠️ Cliente de Supabase no disponible para obtener la sesión actual');
            }
            return appState.session;
        }

        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
            console.error('❌ Error al obtener sesión:', error);
            return appState.session;
        }

        if (session) {
            appState.session = session;
            appState.user = session.user;
            return session;
        }

        // Si no hay sesión y se permite refresh, intentar refrescar
        if (allowRefresh && appState.session && !sessionRefreshInProgress) {
            if (!silent && DEBUG.enabled) {
                console.log('🔄 Sesión no encontrada, intentando refresh...');
            }
            
            const refreshedSession = await refreshSession();

            if (refreshedSession) {
                appState.session = refreshedSession;
                appState.user = refreshedSession.user;
                return refreshedSession;
            }
        }

        if (!silent && appState.session) {
            console.warn('⚠️ Sesión no disponible después de verificar');
        }

        appState.session = null;
        appState.user = null;
        return null;
    } catch (error) {
        console.error('❌ Error al verificar sesión:', error);
        return appState.session;
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
const PROFILE_COLUMNS = `
    id,
    email,
    nombre_completo,
    rol_principal,
    telefono,
    puesto,
    estado,
    ultimo_acceso,
    fecha_creacion,
    fecha_actualizacion
`;

const AREA_COLUMNS = `
    id,
    nombre,
    clave,
    descripcion,
    estado,
    color_hex,
    fecha_creacion,
    fecha_actualizacion
`;

const ASSIGNMENT_COLUMNS = `
    id,
    usuario_id,
    area_id,
    rol,
    puede_capturar,
    puede_editar,
    puede_eliminar,
    estado,
    asignado_por,
    fecha_asignacion,
    fecha_actualizacion
`;

const ASSIGNMENT_SELECT = `${ASSIGNMENT_COLUMNS}, areas:areas(id, nombre, clave, color_hex)`;

export async function getCurrentProfile() {
    try {
        const user = await getCurrentUser();
        if (!user) return null;
        let { data: profileData, error: profileError } = await supabase

            .from('perfiles')
            .select(PROFILE_COLUMNS)
            .eq('id', user.id)
            .maybeSingle();

        if (profileError?.code === 'PGRST201') {
            if (DEBUG.enabled) {
                console.warn('⚠️ Ambigüedad de relaciones al obtener perfil, usando fallback explícito');
            }

            const { data: fallbackData, error: fallbackError } = await supabase
                .from('perfiles')
                .select(PROFILE_COLUMNS)
                .eq('id', user.id)
                .limit(1);

            profileData = fallbackData?.[0] || null;
            profileError = fallbackError || null;
        }

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('❌ Error al obtener perfil:', {
                code: profileError.code,
                message: profileError.message,
                details: profileError.details
            });
            return null;
        }

        const now = new Date().toISOString();
        let profile = profileData;

        if (!profile) {
            const defaultProfile = {
                id: user.id,
                email: user.email,
                nombre_completo: user.user_metadata?.nombre_completo || user.user_metadata?.full_name || user.email,
                rol_principal: user.user_metadata?.rol_principal || 'CONSULTOR',
                telefono: user.user_metadata?.telefono || null,
                puesto: user.user_metadata?.puesto || null,
                estado: 'ACTIVO',
                ultimo_acceso: user.last_sign_in_at || null,
                fecha_creacion: user.created_at || now,
                fecha_actualizacion: user.updated_at || user.created_at || now
            };

            const { data: insertedProfile, error: insertError } = await supabase
                .from('perfiles')
                .insert(defaultProfile)
                .select(PROFILE_COLUMNS);

            if (insertError) {
                console.error('❌ Error al crear perfil:', insertError);
                profile = defaultProfile;
            } else if (insertedProfile && insertedProfile.length > 0) {
                profile = insertedProfile[0];
            } else {
                profile = defaultProfile;
            }
        } else {
            const metadataName = user.user_metadata?.nombre_completo || user.user_metadata?.full_name || null;
            const metadataPhone = user.user_metadata?.telefono || null;
            const metadataPuesto = user.user_metadata?.puesto || null;
            const syncData = {};

            const lastAccess = user.last_sign_in_at || now;
            if (lastAccess && lastAccess !== profile.ultimo_acceso) {
                syncData.ultimo_acceso = lastAccess;
            }

            if (profile.fecha_actualizacion !== now) {
                syncData.fecha_actualizacion = now;
            }

            if (profile.email !== user.email) {
                syncData.email = user.email;
            }

            if (metadataName && metadataName !== profile.nombre_completo) {
                syncData.nombre_completo = metadataName;
            }

            if (metadataPhone && metadataPhone !== profile.telefono) {
                syncData.telefono = metadataPhone;
            }

            if (metadataPuesto && metadataPuesto !== profile.puesto) {
                syncData.puesto = metadataPuesto;
            }

            if (Object.keys(syncData).length > 0) {
                const { data: updatedProfiles, error: updateError } = await supabase
                    .from('perfiles')
                    .update(syncData)
                    .eq('id', user.id)
                    .select(PROFILE_COLUMNS);

                if (updateError) {
                    console.error('❌ Error al sincronizar perfil:', updateError);
                } else if (updatedProfiles && updatedProfiles.length > 0) {
                    profile = updatedProfiles[0];
                } else {
                    profile = { ...profile, ...syncData };
                }
            }
        }

        const { data: areaAssignments, error: areasError } = await supabase
            .from('usuario_areas')
            .select(`
                id,
                area_id,
                rol,
                puede_capturar,
                puede_editar,
                puede_eliminar,
                estado,
                fecha_asignacion,
                fecha_actualizacion,
                areas (
                    id,
                    clave,
                    nombre,
                    color_hex
                )
            `)
            .eq('usuario_id', user.id)
            .order('fecha_asignacion', { ascending: false });

        if (areasError) {
            console.error('❌ Error al obtener áreas asignadas:', areasError);
            profile.usuario_areas = profile.usuario_areas || [];
        } else {
            profile.usuario_areas = areaAssignments || [];
        }

        appState.profile = profile;
        return profile;
    } catch (error) {
        console.error('❌ Error al cargar perfil:', error);
        return null;
    }
}

/**
 * Iniciar sesión con email y contraseña
 */
export async function signInWithPassword(email, password) {
    try {
        if (DEBUG.enabled) console.log('🔐 Intentando login:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        
        if (error) {
            console.error('❌ Error en login:', error);
            throw new SupabaseError(error.message, error.name);
        }
        
        appState.session = data.session;
        appState.user = data.user;
        
        // Cargar perfil del usuario
        //appState.profile = await getCurrentProfile();
        try {
            appState.profile = await getCurrentProfile();
        } catch (profileError) {
            console.warn('⚠️ Error al cargar perfil, usando perfil básico');
            appState.profile = {
                id: data.user.id,
                email: data.user.email,
                rol_principal: 'ADMIN'
            };
        }
        
        if (DEBUG.enabled) console.log('✅ Login exitoso:', data.user.email);
        
        return { data };
    } catch (error) {
        handleError(error, 'Error al iniciar sesión');
        throw error;
    }
}

/**
 * Cerrar sesión
 */
export async function signOut() {
    try {
        // Limpiar recursos antes de cerrar sesión
        cleanupResources();
        
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

/**
 * Cambiar contraseña del usuario autenticado
 */
export async function changePassword(currentPassword, newPassword) {
    if (!appState.user?.email) {
        throw new SupabaseError('No hay una sesión activa.');
    }

    const email = appState.user.email;

    try {
        const { data: verificationData, error: verificationError } = await supabase.auth.signInWithPassword({
            email,
            password: currentPassword
        });

        if (verificationError) {
            throw new SupabaseError('La contraseña actual es incorrecta', verificationError.code || verificationError.name, verificationError);
        }

        if (verificationData?.session) {
            appState.session = verificationData.session;
        }

        if (verificationData?.user) {
            appState.user = verificationData.user;
        }

        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            throw error;
        }

        if (data?.user) {
            appState.user = data.user;
        }

        notifyAuthListeners('PASSWORD_UPDATED', appState.session);

        return true;
    } catch (error) {
        if (error instanceof SupabaseError) {
            throw error;
        }

        const message = handleError(error, 'Error al cambiar contraseña');
        throw new SupabaseError(message, error?.code || error?.name, error);
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

        // Los administradores tienen todos los permisos
        if (appState.profile?.rol_principal === 'ADMIN') {
            return true;
        }
        
        // Verificar permisos específicos del área
        const userArea = appState.profile?.usuario_areas?.find(ua => ua.area_id === areaId);
        
        if (!userArea) return false;
        
        switch (action.toUpperCase()) {
            case 'SELECT':
            case 'READ':
                return true; // Si tiene acceso al área, puede leer
                
            case 'INSERT':
            case 'CAPTURE':
                return userArea.puede_capturar;
                
            case 'UPDATE':
            case 'EDIT':
                return userArea.puede_editar;
                
            case 'DELETE':
                return userArea.puede_eliminar;
                
            default:
                return false;
        }
    } catch (error) {
        console.error('❌ Error al verificar permisos:', error);
        return false;
    }
}

/**
 * Obtener áreas accesibles para el usuario actual
 */
export async function getUserAreas() {
    try {
        const profile = await getCurrentProfile();
        if (!profile) return [];
        
        // Los administradores pueden ver todas las áreas
        if (profile.rol_principal === 'ADMIN') {
            const { data } = await selectData('areas', {
                select: '*',
                filters: { estado: 'ACTIVA' },
                orderBy: 'orden'
            });
            return data || [];
        }
        
        // Usuarios normales solo ven sus áreas asignadas
        return profile.usuario_areas?.map(ua => ua.areas) || [];
    } catch (error) {
        console.error('❌ Error al obtener áreas del usuario:', error);
        return [];
    }
}

/**
 * Verificar si el usuario está autenticado
 */
export function isAuthenticated() {
    return !!(appState.session && appState.user);
}

/**
 * Verificar si el usuario tiene un rol específico
 */
export function hasRole(role) {
    return appState.profile?.rol_principal === role;
}

/**
 * Verificar si el usuario tiene un nivel de rol específico o superior
 */
export function hasRoleLevel(userRole, minRole) {
    const roleLevels = {
        'CONSULTOR': 1,
        'CAPTURADOR': 2,
        'ADMIN': 3
    };
    
    const userLevel = roleLevels[userRole] || 0;
    const minLevel = roleLevels[minRole] || 999;
    
    return userLevel >= minLevel;
}

// =====================================================
// ADMINISTRACIÓN DE USUARIOS
// =====================================================

function mapAssignmentRecord(record) {
    if (!record) return null;

    const area = record.areas || record.area || null;
    const normalizedArea = area ? {
        id: area.id,
        nombre: area.nombre,
        clave: area.clave,
        color_hex: area.color_hex || null
    } : null;

    return {
        id: record.id,
        usuario_id: record.usuario_id,
        area_id: record.area_id,
        rol: record.rol,
        puede_capturar: !!record.puede_capturar,
        puede_editar: !!record.puede_editar,
        puede_eliminar: !!record.puede_eliminar,
        estado: record.estado,
        asignado_por: record.asignado_por,
        fecha_asignacion: record.fecha_asignacion,
        fecha_actualizacion: record.fecha_actualizacion,
        areas: normalizedArea,
        area: normalizedArea
    };
}

function computeChangedFields(before = {}, after = {}, fields = null) {
    const keys = fields || Array.from(new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after || {})
    ]));

    return keys.filter(key => {
        const previousValue = before ? before[key] : undefined;
        const nextValue = after ? after[key] : undefined;
        return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
    });
}

function sanitizeAuditPayload(payload) {
    if (!payload) return null;

    try {
        return JSON.parse(JSON.stringify(payload));
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo serializar datos para auditoría:', error);
        }
        return null;
    }
}

async function logAuditOperation({
    table,
    recordId,
    operation,
    previous = null,
    next = null,
    changedFields = [],
    observations = '',
    automatic = false
}) {
    try {
        const auditRecord = {
            tabla_afectada: table,
            registro_id: recordId,
            operacion: operation,
            datos_anteriores: sanitizeAuditPayload(previous),
            datos_nuevos: sanitizeAuditPayload(next),
            campos_modificados: Array.isArray(changedFields) && changedFields.length > 0
                ? changedFields.join(',')
                : Array.isArray(changedFields) ? null : changedFields,
            usuario_id: appState.profile?.id || appState.user?.id || null,
            ip_address: '0.0.0.0',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            fecha_operacion: new Date().toISOString(),
            sesion_id: appState.session?.id || null,
            observaciones: observations || null,
            es_automatico: automatic
        };

        await supabase.from('auditoria_log').insert(auditRecord);

        if (DEBUG.enabled) {
            console.log('📝 Auditoría registrada:', {
                tabla: table,
                operacion: operation,
                registro: recordId
            });
        }
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo registrar auditoría:', error);
        }
    }
}

async function fetchProfileSnapshot(userId) {
    const { data, error } = await supabase
        .from('perfiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    return data || null;
}

async function fetchAssignmentSnapshot(assignmentId) {
    const { data, error } = await supabase
        .from('usuario_areas')
        .select(ASSIGNMENT_SELECT)
        .eq('id', assignmentId)
        .maybeSingle();

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    return data ? mapAssignmentRecord(data) : null;
}

export async function fetchAdminAreas() {
    const { data, error } = await supabase
        .from('areas')
        .select(AREA_COLUMNS)
        .order('nombre', { ascending: true });

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    return data || [];
}

export async function fetchAdminUsers() {
    const [profilesResponse, assignmentsResponse] = await Promise.all([
        selectData('perfiles', {
            select: PROFILE_COLUMNS,
            orderBy: [{ column: 'nombre_completo', ascending: true }]
        }),
        selectData('usuario_areas', {
            select: ASSIGNMENT_SELECT,
            orderBy: [{ column: 'fecha_asignacion', ascending: false }]
        })
    ]);

    const profiles = profilesResponse.data || [];
    const assignments = assignmentsResponse.data || [];

    const assignmentsByUser = new Map();
    assignments.forEach(record => {
        const mapped = mapAssignmentRecord(record);
        if (!mapped) return;
        if (!assignmentsByUser.has(mapped.usuario_id)) {
            assignmentsByUser.set(mapped.usuario_id, []);
        }
        assignmentsByUser.get(mapped.usuario_id).push(mapped);
    });

    return profiles.map(profile => ({
        ...profile,
        assignments: assignmentsByUser.get(profile.id) || []
    }));
}

export async function createUserWithProfile(userData) {
    const now = new Date().toISOString();
    let createdAuthUserId = null;

    try {
        const {
            email,
            password,
            nombre_completo,
            rol_principal,
            telefono = null,
            puesto = null,
            estado = 'ACTIVO'
        } = userData;

        if (!email || !password || !rol_principal) {
            throw new SupabaseError('Datos de usuario incompletos');
        }

        const signUpPayload = {
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}#/login`,
                data: {
                    nombre_completo,
                    rol_principal,
                    telefono,
                    puesto
                }
            }
        };

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp(signUpPayload);

        if (signUpError) {
            throw new SupabaseError(signUpError.message, signUpError.code, signUpError.details);
        }

        const authUser = signUpData?.user;
        if (!authUser?.id) {
            throw new SupabaseError('No se pudo crear el usuario en auth');
        }

        createdAuthUserId = authUser.id;

        const profileRecord = {
            id: authUser.id,
            email,
            nombre_completo: nombre_completo || email,
            rol_principal,
            telefono,
            puesto,
            estado,
            ultimo_acceso: authUser.last_sign_in_at || null,
            fecha_creacion: now,
            fecha_actualizacion: now
        };

        const { data: insertedProfile, error: profileError } = await supabase
            .from('perfiles')
            .insert(profileRecord)
            .select(PROFILE_COLUMNS);

        if (profileError) {
            throw new SupabaseError(profileError.message, profileError.code, profileError.details);
        }

        const profile = insertedProfile?.[0] || profileRecord;

        await logAuditOperation({
            table: 'perfiles',
            recordId: profile.id,
            operation: 'INSERT',
            previous: null,
            next: profile,
            observations: `Alta de usuario ${profile.email}`
        });

        return { ...profile, assignments: [] };
    } catch (error) {
        if (createdAuthUserId && supabase.auth.admin?.deleteUser) {
            try {
                await supabase.auth.admin.deleteUser(createdAuthUserId);
            } catch (adminError) {
                if (DEBUG.enabled) {
                    console.warn('⚠️ No se pudo revertir creación en auth.users:', adminError);
                }
            }
        }

        throw error;
    }
}

export async function updateUserProfile(userId, updates = {}) {
    if (!userId) {
        throw new SupabaseError('ID de usuario inválido');
    }

    const existing = await fetchProfileSnapshot(userId);
    if (!existing) {
        throw new SupabaseError('Perfil no encontrado');
    }

    const allowedFields = ['email', 'nombre_completo', 'rol_principal', 'telefono', 'puesto', 'estado'];
    const updatePayload = {};
    allowedFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            updatePayload[field] = updates[field];
        }
    });

    if (Object.keys(updatePayload).length === 0) {
        return existing;
    }

    updatePayload.fecha_actualizacion = new Date().toISOString();

    const { data: updatedRows, error } = await supabase
        .from('perfiles')
        .update(updatePayload)
        .eq('id', userId)
        .select(PROFILE_COLUMNS);

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    const updatedProfile = updatedRows?.[0] || { ...existing, ...updatePayload };

    try {
        if (supabase.auth.admin?.updateUserById) {
            await supabase.auth.admin.updateUserById(userId, {
                email: updatePayload.email || existing.email,
                user_metadata: {
                    nombre_completo: updatedProfile.nombre_completo,
                    rol_principal: updatedProfile.rol_principal,
                    telefono: updatedProfile.telefono,
                    puesto: updatedProfile.puesto
                }
            });
        }
    } catch (adminError) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo sincronizar auth.users:', adminError);
        }
    }

    await logAuditOperation({
        table: 'perfiles',
        recordId: userId,
        operation: 'UPDATE',
        previous: existing,
        next: updatedProfile,
        changedFields: computeChangedFields(existing, updatedProfile, allowedFields.concat('fecha_actualizacion')),
        observations: `Actualización de perfil ${updatedProfile.email}`
    });

    if (appState.profile?.id === userId) {
        appState.profile = { ...appState.profile, ...updatedProfile };
    }

    return updatedProfile;
}

export async function deleteUserAccount(userId, { hardDelete = false } = {}) {
    if (!userId) {
        throw new SupabaseError('ID de usuario inválido');
    }

    const existing = await fetchProfileSnapshot(userId);
    if (!existing) {
        return null;
    }

    if (hardDelete) {
        await supabase
            .from('usuario_areas')
            .delete()
            .eq('usuario_id', userId);

        const { error } = await supabase
            .from('perfiles')
            .delete()
            .eq('id', userId);

        if (error) {
            throw new SupabaseError(error.message, error.code, error.details);
        }

        await logAuditOperation({
            table: 'perfiles',
            recordId: userId,
            operation: 'DELETE',
            previous: existing,
            next: null,
            observations: `Eliminación definitiva del usuario ${existing.email}`
        });

        try {
            if (supabase.auth.admin?.deleteUser) {
                await supabase.auth.admin.deleteUser(userId);
            }
        } catch (adminError) {
            if (DEBUG.enabled) {
                console.warn('⚠️ No se pudo eliminar el usuario en auth:', adminError);
            }
        }

        if (appState.profile?.id === userId) {
            appState.profile = null;
        }

        return null;
    }

    if (existing.estado === 'INACTIVO') {
        return existing;
    }

    const updates = {
        estado: 'INACTIVO',
        fecha_actualizacion: new Date().toISOString()
    };

    const { data: updatedRows, error } = await supabase
        .from('perfiles')
        .update(updates)
        .eq('id', userId)
        .select(PROFILE_COLUMNS);

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    const updatedProfile = updatedRows?.[0] || { ...existing, ...updates };

    await logAuditOperation({
        table: 'perfiles',
        recordId: userId,
        operation: 'UPDATE',
        previous: existing,
        next: updatedProfile,
        changedFields: ['estado', 'fecha_actualizacion'],
        observations: `Usuario ${existing.email} marcado como inactivo`
    });

    try {
        if (supabase.auth.admin?.updateUserById) {
            await supabase.auth.admin.updateUserById(userId, {
                banned_until: new Date().toISOString()
            });
        }
    } catch (adminError) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo suspender el usuario en auth:', adminError);
        }
    }

    if (appState.profile?.id === userId) {
        appState.profile = { ...appState.profile, ...updatedProfile };
    }

    return updatedProfile;
}

export async function createAreaAssignment(assignmentData) {
    const now = new Date().toISOString();

    const record = {
        usuario_id: assignmentData.usuario_id,
        area_id: assignmentData.area_id,
        rol: assignmentData.rol,
        puede_capturar: !!assignmentData.puede_capturar,
        puede_editar: !!assignmentData.puede_editar,
        puede_eliminar: !!assignmentData.puede_eliminar,
        estado: assignmentData.estado || 'ACTIVO',
        asignado_por: assignmentData.asignado_por || appState.profile?.id || null,
        fecha_asignacion: assignmentData.fecha_asignacion || now,
        fecha_actualizacion: now
    };

    const { data, error } = await supabase
        .from('usuario_areas')
        .insert(record)
        .select(ASSIGNMENT_SELECT);

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    const assignment = mapAssignmentRecord(data?.[0] || record);

    await logAuditOperation({
        table: 'usuario_areas',
        recordId: assignment.id,
        operation: 'INSERT',
        previous: null,
        next: assignment,
        observations: `Asignación de usuario ${assignment.usuario_id} al área ${assignment.area?.nombre || assignment.area_id}`
    });

    if (appState.profile?.id === assignment.usuario_id) {
        const assignments = appState.profile.usuario_areas || [];
        assignments.push({
            ...assignment,
            areas: assignment.area
        });
        appState.profile.usuario_areas = assignments;
    }

    return assignment;
}

export async function updateAreaAssignment(assignmentId, updates = {}) {
    if (!assignmentId) {
        throw new SupabaseError('ID de asignación inválido');
    }

    const existing = await fetchAssignmentSnapshot(assignmentId);
    if (!existing) {
        throw new SupabaseError('Asignación no encontrada');
    }

    const allowedFields = ['rol', 'puede_capturar', 'puede_editar', 'puede_eliminar', 'estado'];
    const updatePayload = {};
    allowedFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            updatePayload[field] = updates[field];
        }
    });

    if (Object.keys(updatePayload).length === 0) {
        return existing;
    }

    updatePayload.fecha_actualizacion = new Date().toISOString();

    const { data, error } = await supabase
        .from('usuario_areas')
        .update(updatePayload)
        .eq('id', assignmentId)
        .select(ASSIGNMENT_SELECT);

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    const updatedAssignment = mapAssignmentRecord(data?.[0] || { ...existing, ...updatePayload });

    await logAuditOperation({
        table: 'usuario_areas',
        recordId: assignmentId,
        operation: 'UPDATE',
        previous: existing,
        next: updatedAssignment,
        changedFields: computeChangedFields(existing, updatedAssignment, allowedFields.concat('fecha_actualizacion')),
        observations: `Actualización de permisos en área ${updatedAssignment.area?.nombre || updatedAssignment.area_id}`
    });

    if (appState.profile?.id === updatedAssignment.usuario_id) {
        appState.profile.usuario_areas = (appState.profile.usuario_areas || []).map(item => {
            if (item.id === assignmentId) {
                return { ...item, ...updatedAssignment };
            }
            return item;
        });
    }

    return updatedAssignment;
}

export async function removeAreaAssignment(assignmentId) {
    if (!assignmentId) {
        throw new SupabaseError('ID de asignación inválido');
    }

    const existing = await fetchAssignmentSnapshot(assignmentId);
    if (!existing) {
        return null;
    }

    const { error } = await supabase
        .from('usuario_areas')
        .delete()
        .eq('id', assignmentId);

    if (error) {
        throw new SupabaseError(error.message, error.code, error.details);
    }

    await logAuditOperation({
        table: 'usuario_areas',
        recordId: assignmentId,
        operation: 'DELETE',
        previous: existing,
        next: null,
        observations: `Se eliminó asignación del área ${existing.area?.nombre || existing.area_id}`
    });

    if (appState.profile?.usuario_areas) {
        appState.profile.usuario_areas = appState.profile.usuario_areas.filter(item => item.id !== assignmentId);
    }

    return existing;
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
//let initializationPromise = null;

// Variable global para controlar el manejo de visibilidad (agrégala antes de la función)
let isHandlingVisibilityChange = false;
let visibilityChangeTimeout = null;
let initializationPromise = null;
let visibilityChangeHandler = null;
let lastVisibilityChange = 0;
let sessionRefreshInProgress = false;

async function setupSupabase() {
    try {
        const activeSupabase = ensureSupabaseClient('setupSupabase');

        if (!activeSupabase) {
            throw new Error('Supabase client not initialized');
        }

        // Configurar listener de cambios de autenticación PRIMERO
        activeSupabase.auth.onAuthStateChange(async (event, session) => {
            // NO procesar eventos mientras se maneja cambio de visibilidad
            if (isHandlingVisibilityChange) {
                if (DEBUG.enabled) console.log('⏭️ Ignorando evento de auth durante cambio de visibilidad:', event);
                return;
            }
            
            if (DEBUG.enabled) console.log('🔐 Auth state changed:', event, session?.user?.email);
            
            appState.session = session;
            appState.user = session?.user || null;
            
            if (event === 'SIGNED_IN') {
                appState.profile = await getCurrentProfile();
                // Iniciar auto-refresh cuando se logea
                setupGlobalAutoRefresh();
            } else if (event === 'SIGNED_OUT') {
                appState.profile = null;
                // Limpiar recursos cuando se deslogea
                cleanupResources();
            } else if (event === 'TOKEN_REFRESHED') {
                if (DEBUG.enabled) console.log('🔄 Token renovado exitosamente');
            }
            
            notifyAuthListeners(event, session);
        });
        
        // Verificar sesión inicial
        await getCurrentSession({ allowRefresh: true, silent: true });
        if (appState.session) {
            appState.profile = await getCurrentProfile();
        }
        
        // Configurar manejo de visibilidad DESPUÉS de tener la sesión inicial
        setupVisibilityHandlers();
        
        notifyAuthListeners('INITIAL_SESSION', appState.session);
        appState.initialized = true;
        
        // Iniciar verificación periódica de token
        startTokenHealthCheck();
        
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

export function initSupabase() {
    if (appState.initialized) {
        return Promise.resolve(true);
    }

    if (!initializationPromise) {
        initializationPromise = setupSupabase().catch(error => {
            initializationPromise = null;
            throw error;
        });
    }

    return initializationPromise;
}

// Auto-inicializar cuando se carga el módulo
initSupabase().catch(console.error);


// =====================================================
// MANEJO DE VISIBILIDAD Y FOCUS
// =====================================================
/**
 * Configurar handlers de visibilidad
 */
/**
 * Configurar handlers de visibilidad
 */
function setupVisibilityHandlers() {
    if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
    }

    visibilityChangeHandler = async () => {
        const isVisible = document.visibilityState === 'visible';
        
        if (DEBUG.enabled) {
            console.log(isVisible ? '👁️ Ventana recuperó el foco' : '🔍 Ventana perdió el foco');
        }
        
        // Solo procesar si la ventana está visible Y tenemos sesión
        if (!isVisible || !appState.session) {
            return;
        }
        
        // DEBOUNCE: Ignorar si el último cambio fue hace menos de 2 segundos
        const now = Date.now();
        if (now - lastVisibilityChange < 2000) {
            if (DEBUG.enabled) {
                console.log('⏭️ Ignorando cambio de visibilidad (debounce)');
            }
            return;
        }
        lastVisibilityChange = now;
        
        // Evitar ejecuciones simultáneas
        if (isHandlingVisibilityChange || sessionRefreshInProgress) {
            if (DEBUG.enabled) {
                console.log('⏭️ Ya hay un refresh en progreso, ignorando');
            }
            return;
        }

        // Limpiar timeout anterior si existe
        if (visibilityChangeTimeout) {
            clearTimeout(visibilityChangeTimeout);
            visibilityChangeTimeout = null;
        }

        // Delay de 500ms para evitar múltiples disparos
        visibilityChangeTimeout = setTimeout(async () => {
            isHandlingVisibilityChange = true;
            sessionRefreshInProgress = true;
            
            try {
                const previousSession = appState.session;
                
                if (DEBUG.enabled) {
                    console.log('🔄 Verificando sesión después de cambio de visibilidad...');
                }
                
                const session = await getCurrentSession({ allowRefresh: true, silent: true });

                if (session) {
                    // Solo actualizar si realmente cambió el token
                    if (session.access_token !== previousSession?.access_token) {
                        appState.session = session;
                        appState.user = session.user;

                        if (DEBUG.enabled) {
                            console.log('✅ Sesión actualizada silenciosamente');
                        }
                        // NO notificar a listeners para evitar re-renderizados
                    } else {
                        if (DEBUG.enabled) {
                            console.log('ℹ️ Sesión sin cambios');
                        }
                    }
                    setupGlobalAutoRefresh();
                } else if (previousSession) {
                    // Sesión perdida - limpiar y redirigir
                    if (DEBUG.enabled) {
                        console.warn('⚠️ Sesión perdida, limpiando estado');
                    }
                    
                    appState.session = null;
                    appState.user = null;
                    appState.profile = null;
                    
                    cleanupResources();
                    notifyAuthListeners('SIGNED_OUT', null);
                    
                    // Redirigir al login
                    if (window.router?.navigateTo) {
                        window.router.navigateTo('/login', {
                            message: 'Su sesión ha expirado',
                            type: 'warning'
                        }, true);
                    }
                }
            } catch (error) {
                console.error('❌ Error al manejar cambio de visibilidad:', error);
                
                // En caso de error, intentar recuperar la sesión una vez más
                try {
                    const recoverySession = await getCurrentSession({ allowRefresh: false, silent: true });
                    if (!recoverySession) {
                        // Sin sesión después de error - limpiar todo
                        appState.session = null;
                        appState.user = null;
                        appState.profile = null;
                        cleanupResources();
                    }
                } catch (recoveryError) {
                    console.error('❌ Error en recuperación de sesión:', recoveryError);
                }
            } finally {
                isHandlingVisibilityChange = false;
                sessionRefreshInProgress = false;
                
                if (DEBUG.enabled) {
                    console.log('✅ Manejo de visibilidad completado');
                }
            }
        }, 500); // 500ms de delay
    };

    document.addEventListener('visibilitychange', visibilityChangeHandler);
    
    if (DEBUG.enabled) {
        console.log('✅ Handlers de visibilidad configurados');
    }
}

/**
 * Configurar auto-refresh global más seguro
 */
export function setupGlobalAutoRefresh() {
    // Limpiar interval existente
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
    }

    // Solo si hay sesión activa y la ventana está visible
    if (appState.session && document.visibilityState === 'visible') {
        window.autoRefreshInterval = setInterval(async () => {
            // Solo hacer refresh si la ventana está visible y hay sesión
            if (document.visibilityState === 'visible' && appState.session) {
                try {
                    await getCurrentSession({ allowRefresh: true, silent: true });
                } catch (error) {
                    console.error('❌ Error en auto-refresh de sesión:', error);
                    clearInterval(window.autoRefreshInterval);
                }
            }
        }, 60000); // Cada minuto
    }
}
// =====================================================
// RESET DE EMERGENCIA
// =====================================================

/**
 * Forzar reset completo del estado de autenticación
 * USO: Solo en caso de emergencia cuando el sistema se bloquea
 */
export function forceResetAuthState() {
    if (DEBUG.enabled) {
        console.warn('🔄 FORZANDO RESET COMPLETO DE AUTENTICACIÓN');
    }
    
    // Resetear flags
    isHandlingVisibilityChange = false;
    sessionRefreshInProgress = false;
    lastVisibilityChange = 0;
    
    // Limpiar timeouts
    if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
        visibilityChangeTimeout = null;
    }
    
    // Limpiar recursos
    cleanupResources();
    
    if (DEBUG.enabled) {
        console.log('✅ Reset de autenticación completado');
    }
}
/**
 * Limpiar recursos al cerrar sesión
 */
export function cleanupResources() {
    if (DEBUG.enabled) {
        console.log('🧹 Limpiando recursos...');
    }
    
    // Limpiar intervals
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    }
    if (window.homeRefreshInterval) {
        clearInterval(window.homeRefreshInterval);
        window.homeRefreshInterval = null;
    }
    if (window.areaRefreshInterval) {
        clearInterval(window.areaRefreshInterval);
        window.areaRefreshInterval = null;
    }
    
    // Limpiar storage
    try {
        sessionStorage.removeItem('aifa-session-backup');
        sessionStorage.removeItem('aifa-last-activity');
    } catch (error) {
        console.warn('⚠️ Error al limpiar sessionStorage:', error);
    }

    // Limpiar event listeners de visibilidad
    if (visibilityChangeTimeout) {
        clearTimeout(visibilityChangeTimeout);
        visibilityChangeTimeout = null;
    }
    
    // Resetear flags
    isHandlingVisibilityChange = false;
    sessionRefreshInProgress = false;
    lastVisibilityChange = 0;
    
    if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
        visibilityChangeHandler = null;
    }

    clearSupabaseCache();

    if (DEBUG.enabled) {
        console.log('✅ Recursos limpiados');
    }
}

/**
 * Verificar estado del token periódicamente
 */
function startTokenHealthCheck() {
    setInterval(async () => {
        if (appState.session && document.visibilityState === 'visible') {
            try {
                const previousSession = appState.session;
                const session = await getCurrentSession({ allowRefresh: true, silent: true });

                if (!session && previousSession) {
                    console.warn('⚠️ Token expirado o inválido');

                    // Limpiar estado y redirigir
                    appState.session = null;
                    appState.user = null;
                    appState.profile = null;

                    if (window.router?.navigateTo) {
                        window.router.navigateTo('/login', {
                            message: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
                            type: 'warning'
                        }, true);
                    }
                }
            } catch (error) {
                console.error('❌ Error en verificación de token:', error);
            }
        }
    }, 2 * 60 * 1000); // Cada 2 minutos
}
