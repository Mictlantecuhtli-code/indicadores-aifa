// =====================================================
// CLIENTE SUPABASE Y HELPERS GENÉRICOS
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG, MESSAGES, isDevelopment } from '../config.js';

// Usar el cliente de Supabase que fue inicializado en config.js
export const supabase = window.supabaseClient;

// Verificar que Supabase esté disponible
if (!supabase) {
    console.error('❌ Error: Cliente Supabase no está disponible. Verifica que config.js se haya ejecutado correctamente.');
    throw new Error('Supabase client not available');
}

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;

    const segments = token.split('.');
    if (segments.length < 2) return null;

    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const normalized = `${base64}${padding}`;

    try {
        const decode = typeof window !== 'undefined' && typeof window.atob === 'function'
            ? window.atob.bind(window)
            : (value => {
                if (typeof Buffer !== 'undefined') {
                    return Buffer.from(value, 'base64').toString('utf-8');
                }
                throw new Error('No base64 decoder available');
            });

        const json = decode(normalized);
        return JSON.parse(json);
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo decodificar token JWT para detectar privilegios administrativos:', error);
        }
        return null;
    }
}

const adminApiAvailable = (() => {
    try {
        const payload = decodeJwtPayload(SUPABASE_ANON_KEY);
        if (payload?.role !== 'service_role') {
            return false;
        }

        return typeof supabase?.auth?.admin?.createUser === 'function';
    } catch (error) {
        return false;
    }
})();

const VALID_USER_ROLES = new Set([
    'ADMIN',
    'DIRECTOR',
    'SUBDIRECTOR',
    'JEFE_AREA',
    'CAPTURISTA',
    'CAPTURADOR',
    'CONSULTOR'
]);

const VALID_RECORD_STATES = new Set(['ACTIVO', 'INACTIVO']);

const DEFAULT_USER_ROLE = 'CAPTURISTA';
const DEFAULT_RECORD_STATE = 'ACTIVO';

function normalizeRole(value) {
    if (!value) return DEFAULT_USER_ROLE;

    const upper = value.toString().trim().toUpperCase();
    return VALID_USER_ROLES.has(upper) ? upper : DEFAULT_USER_ROLE;
}

function normalizeRecordState(value) {
    if (!value) return DEFAULT_RECORD_STATE;

    const upper = value.toString().trim().toUpperCase();
    return VALID_RECORD_STATES.has(upper) ? upper : DEFAULT_RECORD_STATE;
}

function sanitizeTextValue(value) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();
    return text.length > 0 ? text : null;
}

// Estado global de la aplicación
export const appState = {
    user: null,
    profile: null,
    session: null,
    loading: false,
    initialized: false
};

async function tryUpdateAuthUser(userId, attributes) {
    if (!adminApiAvailable || !userId || !attributes) {
        return false;
    }

    try {
        await supabase.auth.admin.updateUserById(userId, attributes);
        return true;
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo sincronizar auth.users:', error);
        }
        return false;
    }
}

async function tryDeleteAuthUser(userId) {
    if (!adminApiAvailable || !userId) {
        return false;
    }

    try {
        await supabase.auth.admin.deleteUser(userId);
        return true;
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ No se pudo eliminar el usuario en auth:', error);
        }
        return false;
    }
}

async function createAuthAccount({ email, password, metadata }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;

    if (!normalizedEmail || !password) {
        throw new SupabaseError('Datos de credenciales incompletos para crear usuario');
    }

    if (!adminApiAvailable) {
        throw new SupabaseError('La API administrativa de Supabase no está disponible', '403');
    }

    try {
        const { data, error } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: metadata
        });

        if (error) {
            throw error;
        }

        const user = data?.user || data || null;

        if (!user?.id) {
            throw new SupabaseError('Supabase no regresó el identificador del usuario creado');
        }

        return user;
    } catch (error) {
        if (error?.status === 403 || error?.code === '403') {
            throw new SupabaseError('No tienes permisos para crear usuarios', '403', error);
        }

        throw new SupabaseError(error?.message || 'No se pudo crear el usuario', error?.code || error?.status, error);
    }
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

/**
 * Helper genérico para SELECT con manejo de errores
 */
export async function selectData(table, options = {}) {
    const devMode = isDevelopment();

    // Datos mock temporales solo disponibles en desarrollo
    // Nota: intentionally no mock entry for `areas` so it always hits Supabase.
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
                }
            });
        }

        // Aplicar ordenamiento
        if (options.orderBy) {
            if (Array.isArray(options.orderBy)) {
                options.orderBy.forEach(order => {
                    if (typeof order === 'string') {
                        query = query.order(order, { ascending: true });
                    } else {
                        query = query.order(order.column, { ascending: order.ascending !== false });
                    }
                });
            } else if (typeof options.orderBy === 'string') {
                query = query.order(options.orderBy, { ascending: options.ascending !== false });
            } else if (options.orderBy.column) {
                query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false });
            }
        }

        // Aplicar límite
        if (options.limit) {
            query = query.limit(options.limit);
        }

        // Aplicar rango (paginación)
        if (options.from !== undefined && options.to !== undefined) {
            query = query.range(options.from, options.to);
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
        let profile = mapProfileRecord(profileData);

        if (!profile) {
            const defaultProfile = {
                id: user.id,
                email: user.email,
                nombre_completo: user.user_metadata?.nombre_completo || user.user_metadata?.full_name || user.email,
                rol_principal: normalizeRole(user.user_metadata?.rol_principal),
                telefono: sanitizeTextValue(user.user_metadata?.telefono),
                puesto: sanitizeTextValue(user.user_metadata?.puesto),
                estado: DEFAULT_RECORD_STATE,
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
                profile = mapProfileRecord(insertedProfile[0]);
            } else {
                profile = mapProfileRecord(defaultProfile);
            }
        } else {
            const metadataName = sanitizeTextValue(user.user_metadata?.nombre_completo || user.user_metadata?.full_name);
            const metadataPhone = sanitizeTextValue(user.user_metadata?.telefono);
            const metadataPuesto = sanitizeTextValue(user.user_metadata?.puesto);
            const metadataRole = normalizeRole(user.user_metadata?.rol_principal);
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

            if (metadataRole && metadataRole !== profile.rol_principal) {
                syncData.rol_principal = metadataRole;
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
                    profile = mapProfileRecord(updatedProfiles[0]);
                } else {
                    profile = mapProfileRecord({ ...profile, ...syncData });
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
            profile.usuario_areas = (areaAssignments || []).map(mapAssignmentRecord);
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

function mapProfileRecord(record) {
    if (!record) return null;

    const normalizedEmail = typeof record.email === 'string'
        ? record.email.trim().toLowerCase()
        : record.email;
    const normalizedName = sanitizeTextValue(record.nombre_completo) || record.nombre_completo || normalizedEmail;

    return {
        ...record,
        email: normalizedEmail,
        nombre_completo: normalizedName,
        rol_principal: normalizeRole(record.rol_principal),
        estado: normalizeRecordState(record.estado),
        telefono: sanitizeTextValue(record.telefono),
        puesto: sanitizeTextValue(record.puesto)
    };
}

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
    const operationMap = {
        INSERT: 'CREACION',
        CREATE: 'CREACION',
        CREACION: 'CREACION',
        UPDATE: 'ACTUALIZACION',
        ACTUALIZACION: 'ACTUALIZACION',
        MODIFY: 'ACTUALIZACION',
        DELETE: 'ELIMINACION',
        REMOVE: 'ELIMINACION',
        ELIMINACION: 'ELIMINACION',
        BAJA: 'ELIMINACION'
    };

    const normalizedOperation = typeof operation === 'string'
        ? (operationMap[operation.toUpperCase()] || operation.toUpperCase())
        : operation;

    try {
        const auditRecord = {
            tabla_afectada: table,
            registro_id: recordId,
            operacion: normalizedOperation,
            datos_anteriores: sanitizeAuditPayload(previous),
            datos_nuevos: sanitizeAuditPayload(next),
            campos_modificados: Array.isArray(changedFields) && changedFields.length > 0
                ? changedFields.join(',')
                : Array.isArray(changedFields) ? null : changedFields,
            usuario_id: appState.profile?.id || appState.user?.id || null,
            ip_address: null,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            fecha_operacion: new Date().toISOString(),
            sesion_id: appState.session?.id || null,
            observaciones: observations || null,
            es_automatico: automatic
        };

        const { error } = await supabase.from('auditoria_log').insert(auditRecord);

        if (error) {
            throw new SupabaseError(error.message, error.code, error.details);
        }

        if (DEBUG.enabled) {
            console.log('📝 Auditoría registrada:', {
                tabla: table,
                operacion: normalizedOperation,
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

    return mapProfileRecord(data || null);
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

    const profiles = (profilesResponse.data || []).map(mapProfileRecord);
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
        assignments: (assignmentsByUser.get(profile.id) || []).map(mapAssignmentRecord)
    }));
}

export async function createUserWithProfile(userData) {
    const now = new Date().toISOString();
    let createdAuthUserId = null;
    let profilePersisted = false;

    try {
        const {
            email,
            password,
            nombre_completo,
            rol_principal,
            telefono = null,
            puesto = null,
            estado = DEFAULT_RECORD_STATE
        } = userData;

        if (!email || !password || !rol_principal) {
            throw new SupabaseError('Datos de usuario incompletos');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = sanitizeTextValue(nombre_completo) || normalizedEmail;
        const normalizedRole = normalizeRole(rol_principal);
        const normalizedPhone = sanitizeTextValue(telefono);
        const normalizedPuesto = sanitizeTextValue(puesto);
        const normalizedState = normalizeRecordState(estado);

        const authUser = await createAuthAccount({
            email: normalizedEmail,
            password,
            metadata: {
                nombre_completo: normalizedName,
                rol_principal: normalizedRole,
                telefono: normalizedPhone,
                puesto: normalizedPuesto
            }
        };

        createdAuthUserId = authUser.id;
        const existingProfile = await fetchProfileSnapshot(authUser.id);

        const baseProfile = {
            id: authUser.id,
            email: normalizedEmail,
            nombre_completo: normalizedName,
            rol_principal: normalizedRole,
            telefono: normalizedPhone,
            puesto: normalizedPuesto,
            estado: normalizedState,
            ultimo_acceso: authUser.last_sign_in_at || existingProfile?.ultimo_acceso || null,
            fecha_creacion: existingProfile?.fecha_creacion || now,
            fecha_actualizacion: now
        };

        let profile = null;

        if (existingProfile) {
            const updatePayload = { ...baseProfile };

            const { data: updatedRows, error: updateError } = await supabase
                .from('perfiles')
                .update(updatePayload)
                .eq('id', authUser.id)
                .select(PROFILE_COLUMNS);

            if (updateError) {
                throw new SupabaseError(updateError.message, updateError.code, updateError.details);
            }

            profile = mapProfileRecord(updatedRows?.[0] || { ...existingProfile, ...updatePayload });
            profilePersisted = true;

            await logAuditOperation({
                table: 'perfiles',
                recordId: profile.id,
                operation: 'UPDATE',
                previous: existingProfile,
                next: profile,
                changedFields: computeChangedFields(existingProfile, profile, [
                    'email',
                    'nombre_completo',
                    'rol_principal',
                    'telefono',
                    'puesto',
                    'estado',
                    'ultimo_acceso',
                    'fecha_actualizacion'
                ]),
                observations: `Sincronización de perfil ${profile.email}`
            });
        } else {
            const { data: insertedProfile, error: profileError } = await supabase
                .from('perfiles')
                .upsert(baseProfile, { onConflict: 'id' })
                .select(PROFILE_COLUMNS);

            if (profileError) {
                throw new SupabaseError(profileError.message, profileError.code, profileError.details);
            }

            profile = mapProfileRecord(insertedProfile?.[0] || baseProfile);
            profilePersisted = true;

            await logAuditOperation({
                table: 'perfiles',
                recordId: profile.id,
                operation: existingProfile ? 'UPDATE' : 'INSERT',
                previous: existingProfile,
                next: profile,
                changedFields: computeChangedFields(existingProfile, profile, [
                    'email',
                    'nombre_completo',
                    'rol_principal',
                    'telefono',
                    'puesto',
                    'estado',
                    'ultimo_acceso',
                    'fecha_actualizacion',
                    'fecha_creacion'
                ]),
                observations: existingProfile
                    ? `Sincronización de perfil ${profile.email}`
                    : `Alta de usuario ${profile.email}`
            });
        }

        await tryUpdateAuthUser(authUser.id, {
            email: profile.email,
            user_metadata: {
                nombre_completo: profile.nombre_completo,
                rol_principal: profile.rol_principal,
                telefono: profile.telefono,
                puesto: profile.puesto
            }
        });

        return { ...profile, assignments: [] };
    } catch (error) {
        if (createdAuthUserId && !profilePersisted) {
            await tryDeleteAuthUser(createdAuthUserId);
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
    const sanitizedUpdates = {
        email: Object.prototype.hasOwnProperty.call(updates, 'email')
            ? (typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : existing.email)
            : undefined,
        nombre_completo: Object.prototype.hasOwnProperty.call(updates, 'nombre_completo')
            ? (sanitizeTextValue(updates.nombre_completo) || existing.nombre_completo)
            : undefined,
        rol_principal: Object.prototype.hasOwnProperty.call(updates, 'rol_principal')
            ? normalizeRole(updates.rol_principal)
            : undefined,
        telefono: Object.prototype.hasOwnProperty.call(updates, 'telefono')
            ? sanitizeTextValue(updates.telefono)
            : undefined,
        puesto: Object.prototype.hasOwnProperty.call(updates, 'puesto')
            ? sanitizeTextValue(updates.puesto)
            : undefined,
        estado: Object.prototype.hasOwnProperty.call(updates, 'estado')
            ? normalizeRecordState(updates.estado)
            : undefined
    };

    const updatePayload = {};
    allowedFields.forEach(field => {
        if (sanitizedUpdates[field] !== undefined && sanitizedUpdates[field] !== existing[field]) {
            updatePayload[field] = sanitizedUpdates[field];
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

    const updatedProfile = mapProfileRecord(updatedRows?.[0] || { ...existing, ...updatePayload });

    await tryUpdateAuthUser(userId, {
        email: updatePayload.email || existing.email,
        user_metadata: {
            nombre_completo: updatedProfile.nombre_completo,
            rol_principal: updatedProfile.rol_principal,
            telefono: updatedProfile.telefono,
            puesto: updatedProfile.puesto
        }
    });

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

        await tryDeleteAuthUser(userId);

        if (appState.profile?.id === userId) {
            appState.profile = null;
        }

        return null;
    }

    if (existing.estado === 'INACTIVO') {
        return existing;
    }

    const updates = {
        estado: normalizeRecordState('INACTIVO'),
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

    const updatedProfile = mapProfileRecord(updatedRows?.[0] || { ...existing, ...updates });

    await logAuditOperation({
        table: 'perfiles',
        recordId: userId,
        operation: 'UPDATE',
        previous: existing,
        next: updatedProfile,
        changedFields: ['estado', 'fecha_actualizacion'],
        observations: `Usuario ${existing.email} marcado como inactivo`
    });

    await tryUpdateAuthUser(userId, {
        banned_until: new Date().toISOString()
    });

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
        rol: normalizeRole(assignmentData.rol),
        puede_capturar: !!assignmentData.puede_capturar,
        puede_editar: !!assignmentData.puede_editar,
        puede_eliminar: !!assignmentData.puede_eliminar,
        estado: normalizeRecordState(assignmentData.estado),
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
        if (!Object.prototype.hasOwnProperty.call(updates, field)) {
            return;
        }

        switch (field) {
            case 'rol':
                updatePayload.rol = normalizeRole(updates.rol);
                break;
            case 'estado':
                updatePayload.estado = normalizeRecordState(updates.estado);
                break;
            default:
                updatePayload[field] = updates[field];
                break;
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
let initializationPromise = null;

async function setupSupabase() {
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
