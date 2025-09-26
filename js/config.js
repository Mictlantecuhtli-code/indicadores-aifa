// =====================================================
// CONFIGURACIÓN PRINCIPAL DE LA APLICACIÓN
// =====================================================

// Configuración de Supabase - URLs reales del proyecto
export const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

// Configuración de la organización
export const ORG_DOMAIN = '@aifa.gob.mx';

// Configuración de debug
export const DEBUG = {
    enabled: true, // Cambiar a false en producción
    level: 'info'
};

// Configuración de la aplicación
export const APP_CONFIG = {
    name: 'Sistema de Indicadores AIFA',
    version: '1.0.0',
    refreshInterval: 300000, // 5 minutos
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFileTypes: ['.pdf', '.docx', '.xlsx', '.csv'],
    pagination: {
        defaultPageSize: 20,
        maxPageSize: 100
    }
};

// Roles del sistema
export const ROLES = {
    ADMIN: 'ADMIN',
    CAPTURADOR: 'CAPTURADOR', 
    CONSULTOR: 'CONSULTOR'
};

// Rutas de la aplicación
export const ROUTES = {
    public: {
        login: '/login'
    },
    protected: {
        home: '/',
        areas: '/areas',
        area: '/area/:id',
        indicador: '/indicador/:clave',
        visualizacion: '/visualizacion',
        captura: '/captura',
        admin: '/admin'
    }
};

// Configuración de validaciones
export const VALIDATION = {
    email: {
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        message: 'Email no válido'
    },
    password: {
        minLength: 8,
        maxLength: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        message: 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos'
    },
    required: {
        message: 'Este campo es obligatorio'
    },
    numeric: {
        pattern: /^-?\d*\.?\d+$/,
        message: 'Debe ser un número válido'
    },
    phone: {
        pattern: /^(\+52)?[\s\-]?\(?(\d{2,3})\)?[\s\-]?\d{3,4}[\s\-]?\d{4}$/,
        message: 'Teléfono no válido'
    }
};

// Mensajes del sistema
export const MESSAGES = {
    success: {
        login: 'Sesión iniciada correctamente',
        logout: 'Sesión cerrada correctamente',
        save: 'Datos guardados correctamente',
        update: 'Datos actualizados correctamente',
        delete: 'Elemento eliminado correctamente'
    },
    error: {
        network: 'Error de conexión. Verifique su internet.',
        unauthorized: 'No tiene permisos para realizar esta acción',
        notFound: 'Elemento no encontrado',
        invalidData: 'Los datos proporcionados no son válidos',
        generic: 'Ha ocurrido un error inesperado'
    },
    loading: {
        default: 'Cargando...',
        login: 'Iniciando sesión...',
        saving: 'Guardando...',
        deleting: 'Eliminando...'
    }
};

// Configuración de notificaciones
export const NOTIFICATIONS = {
    duration: 5000,
    maxVisible: 5,
    types: {
        success: {
            icon: 'check-circle',
            bgColor: 'bg-green-50',
            textColor: 'text-green-800',
            iconColor: 'text-green-500'
        },
        error: {
            icon: 'x-circle',
            bgColor: 'bg-red-50',
            textColor: 'text-red-800',
            iconColor: 'text-red-500'
        },
        warning: {
            icon: 'alert-triangle',
            bgColor: 'bg-yellow-50',
            textColor: 'text-yellow-800',
            iconColor: 'text-yellow-500'
        },
        info: {
            icon: 'info',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-800',
            iconColor: 'text-blue-500'
        }
    }
};

// =====================================================
// INICIALIZACIÓN DE SUPABASE
// =====================================================

// Verificar que Supabase esté disponible globalmente
if (typeof window !== 'undefined' && window.supabase) {
    try {
        // Crear cliente de Supabase
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                storageKey: 'aifa-auth-token',
                storage: window.localStorage,
                flowType: 'pkce'
            }
        });
        
        if (DEBUG.enabled) {
            console.log('✅ Cliente Supabase inicializado correctamente');
        }
    } catch (error) {
        console.error('❌ Error al inicializar Supabase:', error);
    }
} else {
    console.error('❌ Supabase no está disponible. Verifica que el script esté cargado.');
}

// =====================================================
// CONFIGURACIÓN DE CHART.JS (SI ESTÁ DISPONIBLE)
// =====================================================

if (typeof window !== 'undefined' && window.Chart) {
    // Configuración global de Chart.js
    window.Chart.defaults.responsive = true;
    window.Chart.defaults.maintainAspectRatio = false;
    window.Chart.defaults.plugins.legend.display = true;
    window.Chart.defaults.plugins.tooltip.enabled = true;
    
    // Configuración de colores
    window.Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.1)';
    window.Chart.defaults.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    
    // Colores personalizados para AIFA
    window.Chart.defaults.color = '#374151'; // text-gray-700
}

// =====================================================
// UTILIDADES GLOBALES
// =====================================================

/**
 * Obtener configuración de entorno
 */
export function getEnvConfig() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
            environment: 'development',
            debug: true
        };
    } else if (hostname.includes('github.io')) {
        return {
            environment: 'production',
            debug: false
        };
    } else {
        return {
            environment: 'production',
            debug: false
        };
    }
}

/**
 * Validar configuración al cargar
 */
function validateConfig() {
    const errors = [];
    
    if (!SUPABASE_URL || !SUPABASE_URL.includes('supabase.co')) {
        errors.push('SUPABASE_URL no está configurada correctamente');
    }
    
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 100) {
        errors.push('SUPABASE_ANON_KEY no está configurada correctamente');
    }
    
    if (errors.length > 0) {
        console.error('❌ Errores de configuración:', errors);
        if (DEBUG.enabled) {
            console.warn('⚠️ Algunos parámetros de configuración pueden no estar correctos');
        }
    }
    
    return errors.length === 0;
}

// =====================================================
// HELPERS DE CONFIGURACIÓN
// =====================================================

/**
 * Verificar si estamos en modo desarrollo
 */
export function isDevelopment() {
    return getEnvConfig().environment === 'development';
}

/**
 * Verificar si estamos en producción
 */
export function isProduction() {
    return getEnvConfig().environment === 'production';
}

/**
 * Obtener URL base de la aplicación
 */
export function getBaseUrl() {
    return window.location.origin;
}

/**
 * Configurar modo debug dinámicamente
 */
export function setDebugMode(enabled) {
    DEBUG.enabled = enabled;
    console.log(`🔧 Modo debug ${enabled ? 'activado' : 'desactivado'}`);
}

// Validar configuración al cargar
validateConfig();
