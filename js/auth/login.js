// =====================================================
// SISTEMA DE AUTENTICACIÓN - LOGIN (CORREGIDO)
// PARTE 1/3: Configuración inicial y renderizado
// =====================================================

import { ORG_DOMAIN, VALIDATION, MESSAGES, DEBUG } from '../config.js';
import { supabase, appState } from '../lib/supa.js';
import { showToast, validateForm, getFormData, withLoading } from '../lib/ui.js';

// Estado del módulo de login
const loginState = {
    loginAttempts: 0,
    maxAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutos
    isLocked: false,
    lockoutEnd: null,
    rememberMe: false,
    isSubmitting: false // NUEVO: Prevenir doble submit
};

// =====================================================
// RENDERIZADO DE LA VISTA
// =====================================================

/**
 * Renderizar vista de login
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('🔐 Renderizando vista de login');
        
        // CORREGIDO: Verificar autenticación de manera más robusta
        if (appState.session && appState.user && !query.force) {
            if (DEBUG.enabled) console.log('👤 Usuario ya autenticado, redirigiendo...');
            // Usar timeout para evitar conflictos con el router
            setTimeout(() => {
                window.router.navigateTo('/', {}, true);
            }, 100);
            return;
        }
        
        // Verificar lockout
        checkLockoutStatus();
        
        // Renderizar HTML del login
        container.innerHTML = createLoginHTML();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar validaciones en tiempo real
        setupRealTimeValidation();
        
        // Manejar parámetros de query
        handleQueryParams(query);
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        if (DEBUG.enabled) console.log('✅ Vista de login renderizada');
        
    } catch (error) {
        console.error('❌ Error al renderizar login:', error);
        container.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50">
                <div class="text-center">
                    <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar el login</h2>
                    <p class="text-gray-600 mb-4">Ha ocurrido un error al cargar la página de inicio de sesión.</p>
                    <button onclick="location.reload()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Recargar página
                    </button>
                </div>
            </div>
        `;
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Crear HTML de la vista de login
 */
function createLoginHTML() {
    const isLocked = loginState.isLocked;
    const remainingTime = isLocked ? Math.ceil((loginState.lockoutEnd - Date.now()) / 1000 / 60) : 0;
    
    return `
        <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <!-- Header -->
                <div class="text-center">
                    <div class="mx-auto h-12 w-12 bg-aifa-blue rounded-full flex items-center justify-center">
                        <i data-lucide="shield-check" class="h-6 w-6 text-white"></i>
                    </div>
                    <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
                        Iniciar Sesión
                    </h2>
                    <p class="mt-2 text-sm text-gray-600">
                        Sistema de Indicadores AIFA
                    </p>
                </div>

                <!-- Formulario -->
                <form id="login-form" class="mt-8 space-y-6" ${isLocked ? 'style="pointer-events: none; opacity: 0.6;"' : ''}>
                    <div class="rounded-md shadow-sm space-y-4">
                        <!-- Email -->
                        <div>
                            <label for="email" class="sr-only">Correo electrónico</label>
                            <div class="relative">
                                <input 
                                    id="email" 
                                    name="email" 
                                    type="email" 
                                    autocomplete="email" 
                                    required 
                                    class="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-aifa-blue focus:border-aifa-blue focus:z-10 sm:text-sm" 
                                    placeholder="Correo electrónico"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i data-lucide="mail" class="h-5 w-5 text-gray-400"></i>
                                </div>
                            </div>
                            <div id="email-error" class="hidden mt-1 text-sm text-red-600"></div>
                        </div>

                        <!-- Password -->
                        <div>
                            <label for="password" class="sr-only">Contraseña</label>
                            <div class="relative">
                                <input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    autocomplete="current-password" 
                                    required 
                                    class="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-aifa-blue focus:border-aifa-blue focus:z-10 sm:text-sm" 
                                    placeholder="Contraseña"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i data-lucide="lock" class="h-5 w-5 text-gray-400"></i>
                                </div>
                                <button 
                                    type="button" 
                                    id="toggle-password"
                                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                    <i data-lucide="eye" class="h-5 w-5 text-gray-400 hover:text-gray-600"></i>
                                </button>
                            </div>
                            <div id="password-error" class="hidden mt-1 text-sm text-red-600"></div>
                        </div>
                    </div>
                    
                    <!-- Recordar sesión -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <input 
                                id="remember-me" 
                                name="remember-me" 
                                type="checkbox" 
                                class="h-4 w-4 text-aifa-blue focus:ring-aifa-blue border-gray-300 rounded"
                                ${isLocked ? 'disabled' : ''}
                            >
                            <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                                Recordar sesión
                            </label>
                        </div>
                    </div>

                    <!-- Mensaje de lockout -->
                    ${isLocked ? `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="flex">
                                <i data-lucide="alert-triangle" class="h-5 w-5 text-red-400"></i>
                                <div class="ml-3">
                                    <h3 class="text-sm font-medium text-red-800">
                                        Cuenta temporalmente bloqueada
                                    </h3>
                                    <div class="mt-1 text-sm text-red-700">
                                        Demasiados intentos fallidos. Intente nuevamente en ${remainingTime} minutos.
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Botón de login -->
                    <div>
                        <button 
                            type="submit" 
                            id="login-button"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-aifa-blue hover:bg-aifa-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aifa-blue disabled:opacity-50 disabled:cursor-not-allowed"
                            ${isLocked ? 'disabled' : ''}
                        >
                            <span id="login-button-text">Iniciar Sesión</span>
                            <i id="login-button-spinner" data-lucide="loader-2" class="hidden ml-2 h-4 w-4 animate-spin"></i>
                        </button>
                    </div>
                </form>
                
                <!-- Información adicional -->
                <div class="mt-6">
                    <div class="text-center text-xs text-gray-500">
                        <p>¿Problemas para acceder?</p>
                        <p>Contacte al administrador del sistema</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}
// =====================================================
// SISTEMA DE AUTENTICACIÓN - LOGIN (CORREGIDO)
// PARTE 2/3: Event listeners y manejo del login
// =====================================================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Event listener para el formulario
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
    
    // Event listener para "recordar sesión"
    const rememberCheckbox = document.getElementById('remember-me');
    if (rememberCheckbox) {
        rememberCheckbox.addEventListener('change', (e) => {
            loginState.rememberMe = e.target.checked;
        });
    }
    
    // Event listener para mostrar/ocultar contraseña
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const eyeIcon = togglePassword.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.setAttribute('data-lucide', 'eye-off');
            } else {
                passwordInput.type = 'password';
                eyeIcon.setAttribute('data-lucide', 'eye');
            }
            
            // Recrear iconos
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });
    }
}

/**
 * Manejar proceso de login
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // NUEVO: Prevenir múltiples submits
    if (loginState.isSubmitting) {
        if (DEBUG.enabled) console.log('🔄 Login ya en proceso, ignorando submit...');
        return;
    }
    
    const form = event.target;
    const loginButton = document.getElementById('login-button');
    const buttonText = document.getElementById('login-button-text');
    const buttonSpinner = document.getElementById('login-button-spinner');
    
    try {
        // NUEVO: Marcar como en proceso
        loginState.isSubmitting = true;
        
        // Validar formulario
        const validation = validateForm(form, {
            email: {
                required: true,
                pattern: VALIDATION.email.pattern,
                message: VALIDATION.email.message
            },
            password: {
                required: true,
                minLength: 1
            }
        });
        
        if (!validation.isValid) {
            loginState.isSubmitting = false; // RESET en caso de error de validación
            return;
        }
        
        // Obtener datos del formulario
        const formData = getFormData(form);
        const { email, password } = formData;
        
        // Mostrar loading
        loginButton.disabled = true;
        buttonText.textContent = 'Iniciando sesión...';
        buttonSpinner.classList.remove('hidden');
        
        if (DEBUG.enabled) console.log('🔐 Intentando login con:', email);
        
        // Realizar login
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        
        if (error) {
            throw error;
        }
        
        // Login exitoso
        if (DEBUG.enabled) console.log('✅ Login exitoso:', data.user.email);
        
        // Resetear intentos fallidos
        loginState.loginAttempts = 0;
        localStorage.removeItem('login_attempts');
        localStorage.removeItem('lockout_end');
        
        // Configurar persistencia de sesión
        if (loginState.rememberMe) {
            localStorage.setItem('remember_session', 'true');
        }
        
        // CORREGIDO: No redirigir inmediatamente, dejar que onAuthStateChange lo maneje
        showToast('Inicio de sesión exitoso', 'success');
        
        // IMPORTANTE: Esperar a que el estado se actualice antes de redirigir
        // El onAuthStateChange del router se encargará de la redirección
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        
        // Manejar errores específicos
        let errorMessage = 'Error al iniciar sesión';
        
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Credenciales incorrectas';
            handleFailedLogin();
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Correo electrónico no confirmado';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Demasiadas solicitudes. Intente más tarde';
        } else {
            errorMessage = error.message || 'Error desconocido';
        }
        
        showToast(errorMessage, 'error');
        
    } finally {
        // NUEVO: Resetear estado de submit y UI
        loginState.isSubmitting = false;
        loginButton.disabled = false;
        buttonText.textContent = 'Iniciar Sesión';
        buttonSpinner.classList.add('hidden');
    }
}

/**
 * Manejar intentos fallidos de login
 */
function handleFailedLogin() {
    loginState.loginAttempts++;
    localStorage.setItem('login_attempts', loginState.loginAttempts.toString());
    
    const attemptsRemaining = loginState.maxAttempts - loginState.loginAttempts;
    
    if (attemptsRemaining > 0) {
        showToast(`Credenciales incorrectas. ${attemptsRemaining} intentos restantes`, 'warning');
    }
    
    if (loginState.loginAttempts >= loginState.maxAttempts) {
        activateLockout();
    }
}

/**
 * Activar bloqueo temporal
 */
function activateLockout() {
    loginState.isLocked = true;
    loginState.lockoutEnd = Date.now() + loginState.lockoutTime;
    
    localStorage.setItem('lockout_end', loginState.lockoutEnd.toString());
    
    showToast('Cuenta bloqueada temporalmente por seguridad', 'error');
    
    // Re-renderizar para mostrar el bloqueo
    const container = document.getElementById('app-container');
    if (container) {
        render(container);
    }
    
    // Configurar temporizador para desbloqueo automático
    setTimeout(() => {
        loginState.isLocked = false;
        localStorage.removeItem('lockout_end');
        localStorage.removeItem('login_attempts');
        loginState.loginAttempts = 0;
        
        // Re-renderizar cuando se desbloquee
        const container = document.getElementById('app-container');
        if (container) {
            render(container);
        }
    }, loginState.lockoutTime);
}

/**
 * Verificar estado de bloqueo
 */
function checkLockoutStatus() {
    const lockoutEnd = localStorage.getItem('lockout_end');
    const attempts = localStorage.getItem('login_attempts');
    
    if (lockoutEnd) {
        const lockoutEndTime = parseInt(lockoutEnd);
        
        if (Date.now() < lockoutEndTime) {
            loginState.isLocked = true;
            loginState.lockoutEnd = lockoutEndTime;
        } else {
            // Bloqueo expirado, limpiar
            localStorage.removeItem('lockout_end');
            localStorage.removeItem('login_attempts');
            loginState.isLocked = false;
            loginState.loginAttempts = 0;
        }
    }
    
    if (attempts && !loginState.isLocked) {
        loginState.loginAttempts = parseInt(attempts);
    }
}

/**
 * Configurar validaciones en tiempo real
 */
function setupRealTimeValidation() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            validateEmailField();
        });
        
        emailInput.addEventListener('input', () => {
            clearFieldError('email');
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            clearFieldError('password');
        });
    }
}

/**
 * Validar campo de email
 */
function validateEmailField() {
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    
    if (!emailInput || !emailError) return;
    
    const email = emailInput.value.trim();
    
    if (!email) {
        showFieldError('email', 'El correo electrónico es requerido');
        return false;
    }
    
    if (!VALIDATION.email.pattern.test(email)) {
        showFieldError('email', VALIDATION.email.message);
        return false;
    }
    
    clearFieldError('email');
    return true;
}

/**
 * Mostrar error en campo específico
 */
function showFieldError(fieldName, message) {
    const input = document.getElementById(fieldName);
    const errorDiv = document.getElementById(`${fieldName}-error`);
    
    if (input && errorDiv) {
        input.classList.add('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.remove('border-gray-300', 'focus:border-aifa-blue', 'focus:ring-aifa-blue');
        
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Limpiar error en campo específico
 */
function clearFieldError(fieldName) {
    const input = document.getElementById(fieldName);
    const errorDiv = document.getElementById(`${fieldName}-error`);
    
    if (input && errorDiv) {
        input.classList.remove('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.add('border-gray-300', 'focus:border-aifa-blue', 'focus:ring-aifa-blue');
        
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
}
// =====================================================
// SISTEMA DE AUTENTICACIÓN - LOGIN (CORREGIDO)
// PARTE 3/3: Utilidades y parámetros de query
// =====================================================

/**
 * Manejar parámetros de query
 */
function handleQueryParams(query) {
    // Mensaje de error si viene de una redirección
    if (query.error) {
        const errorMessages = {
            'access_denied': 'Acceso denegado. No tiene permisos para esa sección',
            'session_expired': 'Sesión expirada. Inicie sesión nuevamente',
            'unauthorized': 'No autorizado. Inicie sesión para continuar',
            'invalid_session': 'Sesión inválida. Inicie sesión nuevamente'
        };
        
        const message = errorMessages[query.error] || 'Error de autenticación';
        showToast(message, 'error');
    }
    
    // Mensaje de éxito si viene de registro
    if (query.success) {
        const successMessages = {
            'registered': 'Cuenta creada exitosamente. Inicie sesión',
            'password_reset': 'Contraseña restablecida. Inicie sesión con su nueva contraseña',
            'email_confirmed': 'Correo confirmado. Ya puede iniciar sesión'
        };
        
        const message = successMessages[query.success] || 'Operación exitosa';
        showToast(message, 'success');
    }
    
    // Pre-llenar email si viene como parámetro
    if (query.email) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = decodeURIComponent(query.email);
        }
    }
    
    // Mensaje informativo si viene de logout
    if (query.logout) {
        showToast('Sesión cerrada correctamente', 'info');
    }
}

/**
 * Obtener información de intentos de login
 */
function getLoginAttemptInfo() {
    return {
        attempts: loginState.loginAttempts,
        maxAttempts: loginState.maxAttempts,
        isLocked: loginState.isLocked,
        lockoutEnd: loginState.lockoutEnd,
        remainingAttempts: loginState.maxAttempts - loginState.loginAttempts
    };
}

/**
 * Resetear estado de login (útil para testing o admin)
 */
function resetLoginState() {
    loginState.loginAttempts = 0;
    loginState.isLocked = false;
    loginState.lockoutEnd = null;
    loginState.isSubmitting = false;
    
    localStorage.removeItem('login_attempts');
    localStorage.removeItem('lockout_end');
    
    if (DEBUG.enabled) console.log('🔄 Estado de login reseteado');
}

/**
 * Verificar si el usuario puede intentar login
 */
function canAttemptLogin() {
    checkLockoutStatus();
    return !loginState.isLocked && !loginState.isSubmitting;
}

/**
 * Pre-llenar formulario con datos guardados (si está habilitado)
 */
function prefillSavedData() {
    const savedEmail = localStorage.getItem('saved_email');
    const rememberSession = localStorage.getItem('remember_session');
    
    if (savedEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = savedEmail;
        }
    }
    
    if (rememberSession === 'true') {
        const rememberCheckbox = document.getElementById('remember-me');
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
            loginState.rememberMe = true;
        }
    }
}

/**
 * Guardar email para futuros logins (si el usuario lo permite)
 */
function saveEmailIfRequested(email) {
    if (loginState.rememberMe && email) {
        localStorage.setItem('saved_email', email);
    } else {
        localStorage.removeItem('saved_email');
    }
}

/**
 * Limpiar datos guardados
 */
function clearSavedData() {
    localStorage.removeItem('saved_email');
    localStorage.removeItem('remember_session');
    localStorage.removeItem('login_attempts');
    localStorage.removeItem('lockout_end');
}

/**
 * Validar que todos los servicios estén disponibles antes del login
 */
async function validateServices() {
    try {
        // Verificar conexión con Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error && error.message.includes('network')) {
            throw new Error('Sin conexión a internet o servidor no disponible');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error al validar servicios:', error);
        showToast('Servicio no disponible. Verifique su conexión', 'error');
        return false;
    }
}

/**
 * Configurar listeners globales para el módulo de login
 */
function setupGlobalListeners() {
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = supabase.auth.onAuthStateChange(async (event, session) => {
        if (DEBUG.enabled) console.log('🔐 Auth state change en login:', event);
        
        if (event === 'SIGNED_IN' && session) {
            // Usuario autenticado exitosamente
            if (DEBUG.enabled) console.log('✅ Usuario autenticado, preparando redirección...');
            
            // Actualizar estado global
            appState.session = session;
            appState.user = session.user;
            
            // Esperar un momento para que el estado se propague
            setTimeout(() => {
                // Verificar si estamos en la página de login antes de redirigir
                if (window.location.hash.includes('/login') || window.location.hash === '') {
                    window.router.navigateTo('/', {}, true);
                }
            }, 500); // Dar tiempo suficiente para la sincronización
        }
        
        if (event === 'SIGNED_OUT') {
            // Limpiar estado si es necesario
            resetLoginState();
        }
    });
    
    // Guardar función para poder desuscribirse si es necesario
    loginState.authListener = unsubscribe;
}

/**
 * Limpiar listeners cuando se sale del módulo
 */
function cleanup() {
    if (loginState.authListener) {
        loginState.authListener();
        loginState.authListener = null;
    }
    
    // Resetear estado de submitting si quedó activo
    loginState.isSubmitting = false;
}

/**
 * Inicializar módulo de login
 */
function initLoginModule() {
    // Configurar listeners globales
    setupGlobalListeners();
    
    // Pre-llenar datos guardados
    prefillSavedData();
    
    if (DEBUG.enabled) console.log('🔐 Módulo de login inicializado');
}

/**
 * Funciones exportadas para uso externo
 */
export {
    getLoginAttemptInfo,
    resetLoginState,
    canAttemptLogin,
    clearSavedData,
    cleanup
};

// Auto-inicializar módulo
initLoginModule();

// =====================================================
// MANEJO DE ERRORES ESPECÍFICOS DE AUTENTICACIÓN
// =====================================================

/**
 * Interpretar errores de Supabase Auth
 */
function interpretAuthError(error) {
    const errorMap = {
        'Invalid login credentials': {
            message: 'Credenciales incorrectas',
            type: 'credentials'
        },
        'Email not confirmed': {
            message: 'Correo electrónico no confirmado',
            type: 'confirmation'
        },
        'Too many requests': {
            message: 'Demasiados intentos. Espere antes de reintentar',
            type: 'rate_limit'
        },
        'User not found': {
            message: 'Usuario no encontrado',
            type: 'not_found'
        },
        'Invalid email': {
            message: 'Formato de correo electrónico inválido',
            type: 'validation'
        },
        'Weak password': {
            message: 'La contraseña no cumple con los requisitos mínimos',
            type: 'validation'
        },
        'signup_disabled': {
            message: 'Registro de nuevos usuarios deshabilitado',
            type: 'disabled'
        }
    };
    
    const errorKey = Object.keys(errorMap).find(key => 
        error.message.includes(key)
    );
    
    return errorMap[errorKey] || {
        message: error.message || 'Error desconocido',
        type: 'unknown'
    };
}

// =====================================================
// DEBUG Y TESTING
// =====================================================

if (DEBUG.enabled) {
    // Exponer funciones para testing en desarrollo
    window.loginDebug = {
        state: loginState,
        resetState: resetLoginState,
        getAttemptInfo: getLoginAttemptInfo,
        canAttempt: canAttemptLogin,
        clearData: clearSavedData
    };
    
    console.log('🔧 Funciones de debug del login disponibles en window.loginDebug');
}
