// =====================================================
// CONFIGURACIÓN DEL SISTEMA DE INDICADORES AIFA
// =====================================================

// Configuración de Supabase
const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

// Dominio organizacional para validación de usuarios
const ORG_DOMAIN = 'aifa.aero';

// Esperar a que Supabase esté disponible con timeout
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkSupabase = () => {
            attempts++;
            console.log(`🔍 Intento ${attempts}: Verificando Supabase...`);
            
            if (window.supabase && window.supabase.createClient) {
                console.log('✅ Supabase.createClient encontrado');
                resolve(true);
            } else if (attempts >= maxAttempts) {
                console.error('❌ Timeout: Supabase no se cargó después de', maxAttempts, 'intentos');
                reject(new Error('Supabase CDN failed to load'));
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        
        checkSupabase();
    });
}

// Inicializar cliente Supabase con espera
waitForSupabase().then(() => {
    try {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Cliente Supabase inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar cliente Supabase:', error);
    }
}).catch(error => {
    console.error('❌ Error: No se pudo cargar Supabase CDN:', error);
    
    // Fallback: mostrar mensaje de error al usuario
    if (typeof window !== 'undefined') {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; z-index: 9999;">
                <strong>Error de conexión:</strong> No se pudo cargar el sistema. Por favor, recarga la página.
                <button onclick="location.reload()" style="margin-left: 1rem; background: #dc2626; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer;">
                    Recargar
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Configuración de la aplicación
const APP_CONFIG = {
    name: 'Sistema de Indicadores AIFA',
    version: '1.0.0',
    description: 'Sistema de Gestión de Indicadores del Aeropuerto Internacional Felipe Ángeles',
    
    // Configuración de sesión
    session: {
        checkInterval: 60000, // Verificar sesión cada minuto
        warningTime: 300000,  // Advertir 5 minutos antes de expirar
        maxInactivity: 3600000 // Sesión expira después de 1 hora de inactividad
    },
    
    // Configuración de UI
    ui: {
        defaultPageSize: 20,
        maxPageSize: 100,
        toastDuration: 5000,
        loadingDelay: 300,
        animationDuration: 300
    },
    
    // Configuración de gráficas
    charts: {
        defaultColors: [
            '#3B82F6', // Azul AIFA
            '#10B981', // Verde
            '#F59E0B', // Amarillo
            '#EF4444', // Rojo
            '#8B5CF6', // Púrpura
            '#06B6D4', // Cyan
            '#84CC16', // Lima
            '#F97316', // Naranja
            '#EC4899', // Rosa
            '#6B7280'  // Gris
        ],
        locale: 'es-MX',
        currency: 'MXN',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        decimalPlaces: 2
    }
};

// Roles de usuario y sus permisos
const ROLES = {
    CAPTURISTA: {
        name: 'Capturista',
        level: 1,
        permissions: {
            areas: ['read_assigned'],
            indicadores: ['read_assigned'],
            mediciones: ['read_assigned', 'create_assigned'],
            auditoria: [],
            admin: []
        },
        description: 'Puede ver y capturar datos solo en su área asignada'
    },
    
    JEFE_AREA: {
        name: 'Jefe de Área',
        level: 2,
        permissions: {
            areas: ['read_assigned'],
            indicadores: ['read_assigned'],
            mediciones: ['read_assigned', 'create_assigned', 'update_assigned'],
            auditoria: ['read_assigned'],
            admin: []
        },
        description: 'Puede consultar histórico y capturar/editar en sus áreas, ver auditoría'
    },
    
    SUBDIRECTOR: {
        name: 'Subdirector',
        level: 3,
        permissions: {
            areas: ['read_all'],
            indicadores: ['read_all'],
            mediciones: ['read_all', 'create_all', 'update_all', 'delete_all'],
            auditoria: ['read_all'],
            admin: []
        },
        description: 'Ve todas las áreas, puede editar y eliminar globalmente'
    },
    
    DIRECTOR: {
        name: 'Director',
        level: 4,
        permissions: {
            areas: ['read_all', 'create', 'update'],
            indicadores: ['read_all', 'create', 'update'],
            mediciones: ['read_all', 'create_all', 'update_all', 'delete_all'],
            auditoria: ['read_all'],
            admin: ['read_users']
        },
        description: 'Control total sobre datos, puede ver administración de usuarios'
    },
    
    ADMIN: {
        name: 'Administrador',
        level: 5,
        permissions: {
            areas: ['read_all', 'create', 'update', 'delete'],
            indicadores: ['read_all', 'create', 'update', 'delete'],
            mediciones: ['read_all', 'create_all', 'update_all', 'delete_all'],
            auditoria: ['read_all'],
            admin: ['read_all', 'create', 'update', 'delete', 'assign_permissions']
        },
        description: 'Control total + administración de usuarios/permisos y asignación de áreas'
    }
};

// Configuración de rutas de la aplicación
const ROUTES = {
    // Rutas públicas (sin autenticación)
    public: {
        login: '/login',
        unauthorized: '/unauthorized'
    },
    
    // Rutas protegidas (requieren autenticación)
    protected: {
        home: '/',
        areas: '/areas',
        area: '/area/:id',
        indicador: '/indicador/:clave',
        visualizacion: '/visualizacion',
        captura: '/captura',
        admin: '/admin'
    },
    
    // Rutas por rol mínimo requerido
    roleRequirements: {
        '/admin': 'ADMIN',
        '/captura': 'CAPTURISTA'
    }
};

// Configuración de validaciones
const VALIDATION = {
    email: {
        pattern: /^[^\s@]+@aifa\.aero$/,
        message: 'Debe ser un email válido del dominio @aifa.aero'
    },
    
    password: {
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
        message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'
    },
    
    medicion: {
        valor: {
            min: -999999999,
            max: 999999999,
            decimals: 4
        },
        anio: {
            min: 2020,
            max: new Date().getFullYear() + 5
        },
        mes: {
            min: 1,
            max: 12
        }
    },
    
    indicador: {
        clave: {
            pattern: /^[A-Z0-9\-]{3,30}$/,
            message: 'La clave debe tener entre 3-30 caracteres, solo mayúsculas, números y guiones'
        },
        nombre: {
            minLength: 5,
            maxLength: 300
        }
    },
    
    area: {
        clave: {
            pattern: /^[A-Z0-9\-]{2,20}$/,
            message: 'La clave debe tener entre 2-20 caracteres, solo mayúsculas, números y guiones'
        },
        nombre: {
            minLength: 3,
            maxLength: 200
        }
    }
};

// Configuración de exportación
const EXPORT_CONFIG = {
    formats: ['csv', 'xlsx'],
    maxRecords: 10000,
    dateRange: {
        maxYears: 10
    },
    csvOptions: {
        delimiter: ',',
        encoding: 'UTF-8',
        includeHeaders: true
    }
};

// Configuración de notificaciones
const NOTIFICATIONS = {
    types: {
        success: {
            icon: 'check-circle',
            bgColor: 'bg-green-50',
            iconColor: 'text-green-500',
            textColor: 'text-green-800'
        },
        error: {
            icon: 'alert-circle',
            bgColor: 'bg-red-50',
            iconColor: 'text-red-500',
            textColor: 'text-red-800'
        },
        warning: {
            icon: 'alert-triangle',
            bgColor: 'bg-yellow-50',
            iconColor: 'text-yellow-500',
            textColor: 'text-yellow-800'
        },
        info: {
            icon: 'info',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-500',
            textColor: 'text-blue-800'
        }
    },
    duration: 5000,
    maxVisible: 5
};

// Mensajes predefinidos del sistema
const MESSAGES = {
    auth: {
        loginSuccess: 'Sesión iniciada correctamente',
        loginError: 'Error al iniciar sesión',
        logoutSuccess: 'Sesión cerrada correctamente',
        sessionExpired: 'Su sesión ha expirado',
        sessionWarning: 'Su sesión expirará pronto',
        unauthorized: 'No tiene permisos para acceder a esta sección',
        invalidEmail: 'El email debe ser del dominio @aifa.aero'
    },
    
    data: {
        saveSuccess: 'Datos guardados correctamente',
        saveError: 'Error al guardar los datos',
        loadError: 'Error al cargar los datos',
        deleteSuccess: 'Registro eliminado correctamente',
        deleteError: 'Error al eliminar el registro',
        noData: 'No hay datos disponibles',
        invalidData: 'Los datos proporcionados no son válidos'
    },
    
    validation: {
        required: 'Este campo es obligatorio',
        email: 'Ingrese un email válido',
        number: 'Ingrese un número válido',
        date: 'Ingrese una fecha válida',
        min: 'El valor mínimo es {min}',
        max: 'El valor máximo es {max}',
        minLength: 'Mínimo {min} caracteres',
        maxLength: 'Máximo {max} caracteres'
    },
    
    errors: {
        network: 'Error de conexión. Verifique su conexión a internet.',
        server: 'Error interno del servidor. Intente nuevamente.',
        notFound: 'El recurso solicitado no fue encontrado.',
        forbidden: 'No tiene permisos para realizar esta acción.',
        generic: 'Ha ocurrido un error inesperado.'
    }
};

// Configuración de desarrollo/producción
const DEBUG = {
    enabled: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    logLevel: 'info', // error, warn, info, debug
    showSQL: false,
    mockDelay: 500
};

// Utilidades de configuración
const CONFIG_UTILS = {
    /**
     * Verifica si el usuario tiene un permiso específico
     */
    hasPermission(userRole, resource, action) {
        const role = ROLES[userRole];
        if (!role) return false;
        
        const permissions = role.permissions[resource];
        if (!permissions) return false;
        
        return permissions.includes(action) || 
               permissions.includes('read_all') || 
               permissions.includes('create_all') || 
               permissions.includes('update_all') || 
               permissions.includes('delete_all');
    },
    
    /**
     * Verifica si el rol tiene nivel suficiente
     */
    hasRoleLevel(userRole, minRole) {
        const userLevel = ROLES[userRole]?.level || 0;
        const minLevel = ROLES[minRole]?.level || 999;
        return userLevel >= minLevel;
    },
    
    /**
     * Obtiene el nivel de acceso más alto para un recurso
     */
    getAccessLevel(userRole, resource) {
        const role = ROLES[userRole];
        if (!role) return 'none';
        
        const permissions = role.permissions[resource] || [];
        
        if (permissions.includes('delete_all') || permissions.includes('delete')) return 'full';
        if (permissions.includes('update_all') || permissions.includes('update_assigned')) return 'write';
        if (permissions.includes('create_all') || permissions.includes('create_assigned')) return 'create';
        if (permissions.includes('read_all') || permissions.includes('read_assigned')) return 'read';
        
        return 'none';
    }
};

// Hacer las variables disponibles globalmente para compatibilidad ES6
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.ORG_DOMAIN = ORG_DOMAIN;
window.APP_CONFIG = APP_CONFIG;
window.ROLES = ROLES;
window.ROUTES = ROUTES;
window.VALIDATION = VALIDATION;
window.EXPORT_CONFIG = EXPORT_CONFIG;
window.NOTIFICATIONS = NOTIFICATIONS;
window.MESSAGES = MESSAGES;
window.DEBUG = DEBUG;
window.CONFIG_UTILS = CONFIG_UTILS;

// También exportar para módulos ES6
export {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    ORG_DOMAIN,
    APP_CONFIG,
    ROLES,
    ROUTES,
    VALIDATION,
    EXPORT_CONFIG,
    NOTIFICATIONS,
    MESSAGES,
    DEBUG,
    CONFIG_UTILS
};

// Log de configuración cargada
if (DEBUG.enabled) {
    console.log('🔧 Configuración del sistema cargada:', {
        url: SUPABASE_URL,
        domain: ORG_DOMAIN,
        version: APP_CONFIG.version,
        debug: DEBUG.enabled,
        supabaseInitialized: !!window.supabase?.auth
    });
}
