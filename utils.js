/**
 * utils.js - Utilidades comunes para Sistema de Indicadores AIFA 2.0
 * Funciones helper, cliente Supabase, y utilities compartidas
 */

// Variables de entorno (usar exactamente estos nombres)
const SUPABASE_URL = "https://kxjldzcaeayguiqkqqyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw";

// Cliente Supabase global
let globalSupabaseClient = null;

/**
 * Crea y retorna el cliente Supabase
 * @returns {Object} Cliente Supabase configurado
 */
function createClient() {
    if (!globalSupabaseClient) {
        globalSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return globalSupabaseClient;
}

/**
 * Sistema de notificaciones tipo toast
 * @param {string} type - Tipo de notificación: 'success', 'error', 'warning', 'info'
 * @param {string} message - Mensaje a mostrar
 * @param {number} duration - Duración en ms (default: 5000)
 */
function notify(type, message, duration = 5000) {
    // Crear contenedor si no existe
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Crear toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Icono según tipo
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
            <button type="button" class="toast-close" aria-label="Cerrar notificación">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;

    // Agregar al contenedor
    container.appendChild(toast);

    // Evento de cierre manual
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto-cerrar después de duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Animar entrada
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    // Actualizar live region para screen readers
    updateLiveRegion(`${type}: ${message}`);
}

/**
 * Remueve un toast con animación
 * @param {HTMLElement} toast - Elemento toast a remover
 */
function removeToast(toast) {
    if (toast && toast.parentNode) {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

/**
 * Actualiza la live region para screen readers
 * @param {string} message - Mensaje para anunciar
 */
function updateLiveRegion(message) {
    const liveRegion = document.getElementById('live-region');
    if (liveRegion) {
        liveRegion.textContent = message;
    }
}

/**
 * Obtiene listado de indicadores con nombres de área
 * @param {boolean} soloAreasUsuario - Si filtrar solo áreas del usuario actual
 * @returns {Promise<Array>} Array de indicadores
 */
async function fetchIndicadores(soloAreasUsuario = false) {
    try {
        const client = createClient();
        
        let query = client
            .from("indicadores")
            .select(`
                id, 
                nombre, 
                area_id,
                activo,
                areas(id, nombre),
                unidades(clave, descripcion),
                frecuencias(clave, descripcion)
            `)
            .eq('activo', true)
            .order("area_id", { ascending: true })
            .order("nombre", { ascending: true });

        // Si se requiere filtrar por áreas del usuario
        if (soloAreasUsuario) {
            const { data: { session } } = await client.auth.getSession();
            
            if (session && session.user) {
                // Obtener áreas del usuario
                const { data: userAreas, error: userAreasError } = await client
                    .from('user_areas')
                    .select('area_id')
                    .eq('user_id', session.user.id);

                if (userAreasError) {
                    throw userAreasError;
                }

                if (userAreas && userAreas.length > 0) {
                    const areaIds = userAreas.map(ua => ua.area_id);
                    query = query.in('area_id', areaIds);
                }
            }
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data || [];

    } catch (error) {
        console.error('Error fetching indicadores:', error);
        notify('error', 'Error cargando indicadores: ' + error.message);
        return [];
    }
}

/**
 * Calcula estadísticas básicas de un array de valores
 * @param {Array<number>} values - Array de valores numéricos
 * @returns {Object} Objeto con estadísticas: {min, max, mean, median, count}
 */
function stats(values) {
    // Filtrar valores válidos (números no nulos)
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (validValues.length === 0) {
        return {
            min: null,
            max: null,
            mean: null,
            median: null,
            count: 0
        };
    }

    const sorted = [...validValues].sort((a, b) => a - b);
    const count = validValues.length;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    let median;
    if (count % 2 === 0) {
        median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
    } else {
        median = sorted[Math.floor(count / 2)];
    }

    return {
        min: sorted[0],
        max: sorted[count - 1],
        mean: Math.round(mean * 100) / 100, // 2 decimales
        median: Math.round(median * 100) / 100, // 2 decimales
        count: count
    };
}

/**
 * Convierte array de valores mensuales a formato de 12 elementos
 * Rellena valores faltantes según estrategia (para histogramas, excluir nulls)
 * @param {Array} valuesByMonth - Array con objetos {mes, valor_num}
 * @param {string} strategy - 'exclude' (excluir nulls) o 'zero' (rellenar con 0)
 * @returns {Array<number>} Array de 12 elementos o filtrado
 */
function ensureArray12(valuesByMonth, strategy = 'exclude') {
    // Crear array base de 12 meses
    const monthlyValues = new Array(12).fill(null);
    
    // Llenar con valores existentes
    if (Array.isArray(valuesByMonth)) {
        valuesByMonth.forEach(item => {
            if (item.mes >= 1 && item.mes <= 12 && item.valor_num !== null) {
                monthlyValues[item.mes - 1] = item.valor_num;
            }
        });
    }

    if (strategy === 'exclude') {
        // Para histogramas: excluir valores null/undefined
        return monthlyValues.filter(v => v !== null && v !== undefined);
    } else if (strategy === 'zero') {
        // Reemplazar nulls con 0
        return monthlyValues.map(v => v === null ? 0 : v);
    } else {
        // Retornar array completo de 12 elementos
        return monthlyValues;
    }
}

/**
 * Formatea un número con separadores de miles y decimales
 * @param {number} value - Valor a formatear
 * @param {number} decimals - Número de decimales (default: 2)
 * @returns {string} Número formateado
 */
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Formatea una fecha en formato legible
 * @param {string|Date} date - Fecha a formatear
 * @param {string} format - Formato: 'short', 'long', 'datetime' (default: 'short')
 * @returns {string} Fecha formateada
 */
function formatDate(date, format = 'short') {
    if (!date) return '-';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const options = {
        short: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric' },
        datetime: { 
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }
    };
    
    return new Intl.DateTimeFormat('es-MX', options[format] || options.short).format(d);
}

/**
 * Obtiene el nombre del mes en español
 * @param {number} monthNumber - Número del mes (1-12)
 * @returns {string} Nombre del mes
 */
function getMonthName(monthNumber) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return months[monthNumber - 1] || '-';
}

/**
 * Obtiene información del usuario actual desde la base de datos
 * @returns {Promise<Object>} Información del usuario o null
 */
async function getCurrentUser() {
    try {
        const client = createClient();
        const { data: { session } } = await client.auth.getSession();
        
        if (!session || !session.user) {
            return null;
        }

        // Obtener datos extendidos del usuario
        const { data: userData, error } = await client
            .from('users')
            .select(`
                id, nombre, email, activo,
                roles(id, nombre),
                user_areas(areas(id, nombre))
            `)
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error('Error getting user data:', error);
            return {
                id: session.user.id,
                email: session.user.email,
                nombre: session.user.user_metadata?.full_name || session.user.email,
                rol: null,
                areas: []
            };
        }

        return {
            id: userData.id,
            email: userData.email,
            nombre: userData.nombre || userData.email,
            activo: userData.activo,
            rol: userData.roles,
            areas: userData.user_areas?.map(ua => ua.areas) || []
        };

    } catch (error) {
        console.error('Error in getCurrentUser:', error);
        return null;
    }
}

/**
 * Verifica si el usuario tiene permisos para una acción específica
 * @param {string} entidad - Entidad sobre la que se quiere actuar
 * @param {string} accion - Acción que se quiere realizar
 * @param {Object} user - Usuario actual (opcional, se obtiene automáticamente)
 * @returns {Promise<boolean>} True si tiene permisos
 */
async function hasPermission(entidad, accion, user = null) {
    try {
        if (!user) {
            user = await getCurrentUser();
        }

        if (!user || !user.rol) {
            return false;
        }

        const client = createClient();
        const { data: permissions, error } = await client
            .from('permisos')
            .select('allow_bool')
            .eq('rol_id', user.rol.id)
            .eq('entidad', entidad)
            .eq('accion', accion)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking permissions:', error);
            return false;
        }

        return permissions ? permissions.allow_bool : false;

    } catch (error) {
        console.error('Error in hasPermission:', error);
        return false;
    }
}

/**
 * Valida si un email tiene formato correcto
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida si un valor numérico está en un rango válido
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo (default: 0)
 * @param {number} max - Valor máximo (default: Infinity)
 * @returns {boolean} True si es válido
 */
function isValidNumber(value, min = 0, max = Infinity) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
}

/**
 * Debounce function para limitar frecuencia de llamadas
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función debounced
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Maneja errores de Supabase de forma consistente
 * @param {Object} error - Error de Supabase
 * @param {string} defaultMessage - Mensaje por defecto si no se puede interpretar
 * @returns {string} Mensaje de error legible
 */
function handleSupabaseError(error, defaultMessage = 'Error inesperado') {
    if (!error) return defaultMessage;
    
    // Errores RLS (Row Level Security)
    if (error.code === '42501') {
        return 'No tiene permisos para realizar esta acción';
    }
    
    // Violación de constraint único
    if (error.code === '23505') {
        return 'Ya existe un registro con estos datos';
    }
    
    // Violación de foreign key
    if (error.code === '23503') {
        return 'Error de integridad: referencia inválida';
    }
    
    // Error de conexión
    if (error.message && error.message.includes('Failed to fetch')) {
        return 'Error de conexión. Verifique su conexión a internet';
    }
    
    // Mensaje específico si está disponible
    if (error.message) {
        return error.message;
    }
    
    return defaultMessage;
}

/**
 * Exporta datos a CSV
 * @param {Array} data - Array de objetos a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Array} columns - Columnas a incluir (opcional)
 */
function exportToCSV(data, filename, columns = null) {
    if (!data || data.length === 0) {
        notify('warning', 'No hay datos para exportar');
        return;
    }

    try {
        // Determinar columnas
        const keys = columns || Object.keys(data[0]);
        
        // Crear header CSV
        const csvHeader = keys.join(',');
        
        // Crear filas CSV
        const csvRows = data.map(row => {
            return keys.map(key => {
                const value = row[key];
                // Escapar valores que contengan comas o comillas
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        // Combinar header y filas
        const csvContent = [csvHeader, ...csvRows].join('\n');
        
        // Crear y descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        notify('success', `Archivo ${filename}.csv descargado exitosamente`);
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        notify('error', 'Error al exportar datos: ' + error.message);
    }
}

// Exportar funciones para uso global
window.AIFAUtils = {
    createClient,
    notify,
    fetchIndicadores,
    stats,
    ensureArray12,
    formatNumber,
    formatDate,
    getMonthName,
    getCurrentUser,
    hasPermission,
    isValidEmail,
    isValidNumber,
    debounce,
    handleSupabaseError,
    exportToCSV,
    updateLiveRegion
};

// Inicialización automática del cliente al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    createClient();
});
