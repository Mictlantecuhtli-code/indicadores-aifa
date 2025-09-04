/**
 * utils.js - Funciones Comunes y Utilidades
 * Sistema de Indicadores AIFA 2.0
 * 
 * Funciones compartidas entre todos los módulos del sistema
 */

// Configuración de Supabase
const SUPABASE_URL = "https://kxjldzcaeayguiqkqqyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw";

// Cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Función para obtener el cliente Supabase
 */
function createClient() {
    return supabase;
}

/**
 * SISTEMA DE NOTIFICACIONES
 */

// Container para notificaciones
let notificationContainer = null;

/**
 * Inicializar container de notificaciones
 */
function initNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
}

/**
 * Mostrar notificación
 */
async function notify(message, type = 'info', duration = 5000) {
    initNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Icono según el tipo
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${icons[type] || icons.info}"></i>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="closeNotification(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-progress"></div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Animar barra de progreso
    const progressBar = notification.querySelector('.notification-progress');
    if (duration > 0) {
        progressBar.style.animationDuration = `${duration}ms`;
        progressBar.classList.add('animate');
    }
    
    // Auto-cerrar después de la duración especificada
    if (duration > 0) {
        setTimeout(() => {
            closeNotification(notification.querySelector('.notification-close'));
        }, duration);
    }
    
    return notification;
}

/**
 * Cerrar notificación
 */
function closeNotification(closeButton) {
    const notification = closeButton.closest('.notification');
    notification.classList.add('hide');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

/**
 * FUNCIONES DE DATOS E INDICADORES
 */

/**
 * Obtener lista de indicadores con filtros
 */
async function fetchIndicadores(filters = {}) {
    try {
        let query = supabase
            .from('vw_indicadores_catalogo')
            .select('*');

        // Aplicar filtros
        if (filters.area_id) {
            query = query.eq('area_id', filters.area_id);
        }
        
        if (filters.activo !== undefined) {
            query = query.eq('activo', filters.activo);
        }
        
        if (filters.frecuencia_id) {
            query = query.eq('frecuencia_id', filters.frecuencia_id);
        }

        // Ordenamiento por defecto
        query = query.order('area_nombre, nombre');

        const { data, error } = await query;
        
        if (error) throw error;
        
        return data || [];

    } catch (error) {
        console.error('Error obteniendo indicadores:', error);
        throw error;
    }
}

/**
 * Obtener valores de un indicador específico
 */
async function fetchIndicadorValues(indicadorId, filters = {}) {
    try {
        let query = supabase
            .from('indicador_valores')
            .select(`
                id, anio, mes, valor_num, fuente, comentario, estado,
                created_at, updated_at, deleted_at
            `)
            .eq('indicador_id', indicadorId);

        // Filtros adicionales
        if (filters.anio) {
            if (Array.isArray(filters.anio)) {
                query = query.in('anio', filters.anio);
            } else {
                query = query.eq('anio', filters.anio);
            }
        }

        if (filters.includeDeleted !== true) {
            query = query.is('deleted_at', null);
        }

        if (filters.estado) {
            query = query.eq('estado', filters.estado);
        }

        // Ordenamiento
        query = query.order('anio', { ascending: false })
                    .order('mes', { ascending: false });

        const { data, error } = await query;
        
        if (error) throw error;
        
        return data || [];

    } catch (error) {
        console.error('Error obteniendo valores del indicador:', error);
        throw error;
    }
}

/**
 * FUNCIONES ESTADÍSTICAS
 */

/**
 * Calcular estadísticas básicas de un array de números
 */
function calculateStats(numbers) {
    if (!numbers || numbers.length === 0) {
        return {
            count: 0,
            min: null,
            max: null,
            sum: 0,
            mean: null,
            median: null,
            mode: null,
            range: null,
            variance: null,
            standardDeviation: null
        };
    }

    // Filtrar valores válidos
    const validNumbers = numbers.filter(n => n !== null && n !== undefined && !isNaN(n));
    
    if (validNumbers.length === 0) {
        return {
            count: 0,
            min: null,
            max: null,
            sum: 0,
            mean: null,
            median: null,
            mode: null,
            range: null,
            variance: null,
            standardDeviation: null
        };
    }

    // Ordenar números
    const sorted = [...validNumbers].sort((a, b) => a - b);
    
    // Estadísticas básicas
    const count = validNumbers.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const sum = validNumbers.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Mediana
    let median;
    if (count % 2 === 0) {
        median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
    } else {
        median = sorted[Math.floor(count / 2)];
    }
    
    // Moda
    const frequency = {};
    let maxFreq = 0;
    let mode = null;
    
    validNumbers.forEach(num => {
        frequency[num] = (frequency[num] || 0) + 1;
        if (frequency[num] > maxFreq) {
            maxFreq = frequency[num];
            mode = num;
        }
    });
    
    // Si todos los valores aparecen la misma cantidad de veces, no hay moda
    if (maxFreq === 1) mode = null;
    
    // Varianza y desviación estándar
    const variance = validNumbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    return {
        count,
        min,
        max,
        sum,
        mean,
        median,
        mode,
        range: max - min,
        variance,
        standardDeviation
    };
}

/**
 * Calcular percentiles
 */
function calculatePercentile(numbers, percentile) {
    if (!numbers || numbers.length === 0) return null;
    
    const validNumbers = numbers.filter(n => n !== null && n !== undefined && !isNaN(n));
    if (validNumbers.length === 0) return null;
    
    const sorted = [...validNumbers].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Number.isInteger(index)) {
        return sorted[index];
    } else {
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
}

/**
 * FUNCIONES DE FORMATO
 */

/**
 * Formatear números para mostrar
 */
function formatNumber(value, options = {}) {
    if (value === null || value === undefined || isNaN(value)) {
        return options.nullText || '-';
    }
    
    const {
        decimals = 2,
        locale = 'es-MX',
        currency = false,
        compact = false,
        percentage = false
    } = options;
    
    let formattedValue = value;
    
    if (percentage) {
        formattedValue = value * 100;
    }
    
    const formatOptions = {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    };
    
    if (currency) {
        formatOptions.style = 'currency';
        formatOptions.currency = 'MXN';
    }
    
    if (compact && Math.abs(value) >= 1000) {
        formatOptions.notation = 'compact';
        formatOptions.compactDisplay = 'short';
    }
    
    let result = new Intl.NumberFormat(locale, formatOptions).format(formattedValue);
    
    if (percentage && !currency) {
        result += '%';
    }
    
    return result;
}

/**
 * Formatear fechas
 */
function formatDate(date, options = {}) {
    if (!date) return '';
    
    const {
        format = 'short',
        locale = 'es-MX',
        includeTime = false
    } = options;
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    let formatOptions = {};
    
    switch (format) {
        case 'short':
            formatOptions = { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            };
            break;
        case 'medium':
            formatOptions = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            };
            break;
        case 'long':
            formatOptions = { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            break;
        case 'full':
            formatOptions = { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            break;
    }
    
    if (includeTime) {
        formatOptions.hour = '2-digit';
        formatOptions.minute = '2-digit';
    }
    
    return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * FUNCIONES DE VALIDACIÓN
 */

/**
 * Validar email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validar número
 */
function isValidNumber(value, options = {}) {
    const { min, max, allowNegative = true, allowDecimals = true } = options;
    
    if (value === null || value === undefined || value === '') {
        return false;
    }
    
    const num = parseFloat(value);
    
    if (isNaN(num)) return false;
    
    if (!allowNegative && num < 0) return false;
    
    if (!allowDecimals && !Number.isInteger(num)) return false;
    
    if (min !== undefined && num < min) return false;
    
    if (max !== undefined && num > max) return false;
    
    return true;
}

/**
 * FUNCIONES DE URL Y NAVEGACIÓN
 */

/**
 * Obtener parámetros de la URL
 */
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    
    return result;
}

/**
 * Actualizar parámetros de la URL sin recargar
 */
function updateURLParams(params, replace = false) {
    const url = new URL(window.location);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key);
        }
    });
    
    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

/**
 * FUNCIONES DE ALMACENAMIENTO LOCAL
 */

/**
 * Guardar en localStorage con manejo de errores
 */
function saveToStorage(key, data, options = {}) {
    try {
        const { expiry = null, compress = false } = options;
        
        let dataToStore = {
            data: data,
            timestamp: Date.now()
        };
        
        if (expiry) {
            dataToStore.expiry = Date.now() + expiry;
        }
        
        const serialized = JSON.stringify(dataToStore);
        localStorage.setItem(`aifa_${key}`, serialized);
        
        return true;
    } catch (error) {
        console.warn('Error guardando en localStorage:', error);
        return false;
    }
}

/**
 * Leer de localStorage con manejo de errores y expiración
 */
function loadFromStorage(key, defaultValue = null) {
    try {
        const stored = localStorage.getItem(`aifa_${key}`);
        
        if (!stored) return defaultValue;
        
        const parsed = JSON.parse(stored);
        
        // Verificar expiración
        if (parsed.expiry && Date.now() > parsed.expiry) {
            localStorage.removeItem(`aifa_${key}`);
            return defaultValue;
        }
        
        return parsed.data;
    } catch (error) {
        console.warn('Error leyendo de localStorage:', error);
        return defaultValue;
    }
}

/**
 * Limpiar localStorage de datos expirados
 */
function cleanExpiredStorage() {
    try {
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('aifa_')) {
                try {
                    const stored = localStorage.getItem(key);
                    const parsed = JSON.parse(stored);
                    
                    if (parsed.expiry && Date.now() > parsed.expiry) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    // Si no se puede parsear, eliminar
                    localStorage.removeItem(key);
                }
            }
        });
    } catch (error) {
        console.warn('Error limpiando localStorage:', error);
    }
}

/**
 * FUNCIONES DE UTILIDAD GENERAL
 */

/**
 * Generar ID único
 */
function generateUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce function
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(this, args);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === "object") {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Truncar texto
 */
function truncateText(text, maxLength, ellipsis = '...') {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * INICIALIZACIÓN
 */

// Limpiar localStorage al cargar
document.addEventListener('DOMContentLoaded', () => {
    cleanExpiredStorage();
});

/**
 * Obtiene información del usuario actual
 */
async function getCurrentUser() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
            return null;
        }

        // Obtener datos extendidos del usuario
        const { data: userData, error } = await supabase
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

// Exportar funciones para otros scripts
window.AIFA_Utils = {
    // Notificaciones
    notify,
    closeNotification,
    
    // Datos
    fetchIndicadores,
    fetchIndicadorValues,
    
    // Estadísticas
    calculateStats,
    calculatePercentile,
    
    // Formato
    formatNumber,
    formatDate,
    
    // Validación
    isValidEmail,
    isValidNumber,
    
    // URL
    getURLParams,
    updateURLParams,
    
    // Almacenamiento
    saveToStorage,
    loadFromStorage,
    cleanExpiredStorage,
    
    // Utilidades
    generateUID,
    debounce,
    throttle,
    deepClone,
    truncateText
};

console.log('utils.js cargado completamente');
console.log('createClient definido:', typeof createClient);
console.log('notify definido:', typeof notify);
console.log('supabase definido:', typeof supabase);
