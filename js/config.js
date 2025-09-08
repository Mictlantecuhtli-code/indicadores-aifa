// =====================================================
// CLIENTE SUPABASE Y HELPERS GENÉRICOS - PARTE 1/3
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG, MESSAGES } from '../config.js';

// CORRECCIÓN: Usar window.supabase que ya fue inicializado en config.js
export const supabase = window.supabase || window.supabaseClient;

// Verificar que Supabase esté disponible
if (!supabase) {
    console.error('❌ Error: Cliente Supabase no está disponible. Verifica que config.js se haya ejecutado correctamente.');
    console.log('window.supabase:', window.supabase);
    console.log('window.supabaseClient:', window.supabaseClient);
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
