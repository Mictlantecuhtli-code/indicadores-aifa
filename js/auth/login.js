// =====================================================
// SISTEMA DE AUTENTICACIÓN - LOGIN
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
    rememberMe: false
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
        
        // Verificar si ya está autenticado
        if (appState.session && appState.user) {
            if (DEBUG.enabled) console.log('👤 Usuario ya autenticado, redirigiendo...');
            window.router.navigateTo('/', {}, true);
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
                    <div class="mx-auto h-20 w-20 bg-aifa-blue rounded-full flex items-center justify-center mb-6">
                        <i data-lucide="plane" class="w-10 h-10 text-white"></i>
                    </div>
                    <h2 class="text-3xl font-bold text-gray-900 mb-2">
                        Sistema de Indicadores AIFA
                    </h2>
                    <p class="text-sm text-gray-600">
                        Ingrese sus credenciales para acceder al sistema
                    </p>
                </div>
                
                <!-- Alerta de lockout -->
                ${isLocked ? `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <i data-lucide="lock" class="w-5 h-5 text-red-500 mr-3"></i>
                            <div>
                                <h3 class="text-sm font-medium text-red-800">Cuenta temporalmente bloqueada</h3>
                                <p class="text-sm text-red-700 mt-1">
                                    Demasiados intentos fallidos. Intente nuevamente en ${remainingTime} minutos.
                                </p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Formulario de login -->
                <form id="login-form" class="space-y-6" novalidate>
                    <div class="space-y-4">
                        <!-- Email -->
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                                Correo electrónico corporativo
                            </label>
                            <div class="relative">
                                <input 
                                    id="email" 
                                    name="email" 
                                    type="email" 
                                    autocomplete="email" 
                                    required 
                                    placeholder="usuario@aifa.aero"
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue transition-colors pl-11"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                <i data-lucide="mail" class="absolute left-3 top-3.5 w-5 h-5 text-gray-400"></i>
                            </div>
                        </div>
                        
                        <!-- Password -->
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                                Contraseña
                            </label>
                            <div class="relative">
                                <input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    autocomplete="current-password" 
                                    required 
                                    placeholder="Ingrese su contraseña"
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifa-blue focus:border-aifa-blue transition-colors pl-11 pr-11"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                <i data-lucide="lock" class="absolute left-3 top-3.5 w-5 h-5 text-gray-400"></i>
                                <button 
                                    type="button" 
                                    id="toggle-password"
                                    class="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                    <i data-lucide="eye" class="w-5 h-5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Opciones adicionales -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <input 
                                id="remember-me" 
                                name="remember-me" 
                                type="checkbox" 
                                class="h-4 w-4 text-aifa-blue focus:ring-aifa-blue border-gray-300 rounded"
                                ${isLocked ? 'disabled' : ''}
                            >
                            <label for="remember-me" class="ml-2 block text-sm text-gray-700">
                                Recordar sesión
                            </label>
                        </div>
                        
                        <div class="text-sm">
                            <button 
                                type="button" 
                                id="forgot-password-btn"
                                class="font-medium text-aifa-blue hover:text-aifa-dark transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}"
                                ${isLocked ? 'disabled' : ''}
                            >
                                ¿Olvidó su contraseña?
                            </button>
                        </div>
                    </div>
                    
                    <!-- Botón de login -->
                    <div>
                        <button 
                            type="submit" 
                            id="login-button"
                            class="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-aifa-blue hover:bg-aifa-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aifa-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            ${isLocked ? 'disabled' : ''}
                        >
                            <span id="login-button-text">Iniciar sesión</span>
                            <i id="login-button-spinner" class="w-5 h-5 ml-2 hidden" data-lucide="loader-2"></i>
                        </button>
                    </div>
                    
                    <!-- Información de intentos -->
                    ${loginState.loginAttempts > 0 && !isLocked ? `
                        <div class="text-center">
                            <p class="text-sm text-yellow-600">
                                <i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>
                                Intentos fallidos: ${loginState.loginAttempts}/${loginState.maxAttempts}
                            </p>
                        </div>
                    ` : ''}
                </form>
                
                <!-- Footer informativo -->
                <div class="text-center">
                    <div class="text-xs text-gray-500 space-y-1">
                        <p>Sistema interno del Aeropuerto Internacional Felipe Ángeles</p>
                        <p>Solo personal autorizado con credenciales corporativas @aifa.aero</p>
                    </div>
                </div>
                
                <!-- Debug info (solo en desarrollo) -->
                ${DEBUG.enabled ? `
                    <div class="bg-gray-100 p-3 rounded text-xs text-gray-600">
                        <strong>Debug:</strong> Use cualquier email @aifa.aero válido registrado en Supabase
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// =====================================================
// EVENT LISTENERS
// =====================================================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Toggle de contraseña
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', handleTogglePassword);
    }
    
    // Botón de olvido de contraseña
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', handleForgotPassword);
    }
    
    // Remember me
    const rememberMeCheckbox = document.getElementById('remember-me');
    if (rememberMeCheckbox) {
        rememberMeCheckbox.addEventListener('change', (e) => {
            loginState.rememberMe = e.target.checked;
        });
    }
}

/**
 * Configurar validaciones en tiempo real
 */
function setupRealTimeValidation() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    // Validación de email en tiempo real
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            const email = e.target.value.trim();
            const isValid = VALIDATION.email.pattern.test(email);
            
            if (email && !isValid) {
                e.target.classList.add('border-red-500');
                e.target.classList.remove('border-gray-300');
            } else {
                e.target.classList.remove('border-red-500');
                e.target.classList.add('border-gray-300');
            }
        });
    }
    
    // Limpiar errores al escribir
    [emailInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                const errorMessage = input.parentNode.querySelector('.error-message');
                if (errorMessage) {
                    errorMessage.remove();
                }
            });
        }
    });
}

// =====================================================
// HANDLERS DE EVENTOS
// =====================================================

/**
 * Manejar envío del formulario de login
 */
async function handleLogin(e) {
    e.preventDefault();
    
    if (loginState.isLocked) {
        showToast('Cuenta temporalmente bloqueada', 'error');
        return;
    }
    
    const form = e.target;
    const loginButton = document.getElementById('login-button');
    const buttonText = document.getElementById('login-button-text');
    const buttonSpinner = document.getElementById('login-button-spinner');
    
    try {
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
            return;
        }
        
        // Obtener datos del formulario
        const formData = getFormData(form);
        const { email, password } = formData;
        
        // Mostrar loading
        loginButton.disabled = true;
        buttonText.textContent = 'Iniciando sesión...';
        buttonSpinner.classList.remove('hidden');
        
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
        
        showToast(MESSAGES.auth.loginSuccess, 'success');
        
        // Redirigir después de un breve delay
        setTimeout(() => {
            window.router.navigateTo('/', {}, true);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        
        // Incrementar intentos fallidos
        loginState.loginAttempts++;
        localStorage.setItem('login_attempts', loginState.loginAttempts.toString());
        
        // Verificar si se debe bloquear
        if (loginState.loginAttempts >= loginState.maxAttempts) {
            lockAccount();
            showToast(`Cuenta bloqueada por ${loginState.lockoutTime / 60000} minutos`, 'error');
            
            // Re-renderizar para mostrar el lockout
            setTimeout(() => {
                const container = document.getElementById('app-container');
                if (container) {
                    render(container);
                }
            }, 1000);
        } else {
            // Mostrar error específico
            let errorMessage = MESSAGES.auth.loginError;
            
            if (error.message?.includes('Invalid login credentials')) {
                errorMessage = 'Email o contraseña incorrectos';
            } else if (error.message?.includes('Email not confirmed')) {
                errorMessage = 'Debe confirmar su email antes de iniciar sesión';
            } else if (error.message?.includes('Too many requests')) {
                errorMessage = 'Demasiados intentos. Espere unos minutos e intente nuevamente';
            }
            
            showToast(errorMessage, 'error');
            
            // Actualizar contador de intentos en la UI
            updateAttemptsDisplay();
        }
        
    } finally {
        // Restaurar botón
        loginButton.disabled = loginState.isLocked;
        buttonText.textContent = 'Iniciar sesión';
        buttonSpinner.classList.add('hidden');
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Manejar toggle de contraseña
 */
function handleTogglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('#toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        passwordInput.type = 'password';
        toggleIcon.setAttribute('data-lucide', 'eye');
    }
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Manejar olvido de contraseña
 */
async function handleForgotPassword() {
    const emailInput = document.getElementById('email');
    const email = emailInput?.value.trim();
    
    if (!email) {
        showToast('Ingrese su email para recuperar la contraseña', 'warning');
        emailInput?.focus();
        return;
    }
    
    if (!VALIDATION.email.pattern.test(email)) {
        showToast('Ingrese un email válido del dominio @aifa.aero', 'error');
        return;
    }
    
    try {
        await withLoading(async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#/reset-password`
            });
            
            if (error) throw error;
        }, 'Enviando email de recuperación...');
        
        showToast('Email de recuperación enviado. Revise su bandeja de entrada.', 'success');
        
    } catch (error) {
        console.error('❌ Error al enviar email de recuperación:', error);
        showToast('Error al enviar email de recuperación', 'error');
    }
}

// =====================================================
// GESTIÓN DE LOCKOUT
// =====================================================

/**
 * Verificar estado de lockout
 */
function checkLockoutStatus() {
    const storedAttempts = localStorage.getItem('login_attempts');
    const storedLockoutEnd = localStorage.getItem('lockout_end');
    
    if (storedAttempts) {
        loginState.loginAttempts = parseInt(storedAttempts, 10);
    }
    
    if (storedLockoutEnd) {
        const lockoutEnd = parseInt(storedLockoutEnd, 10);
        if (Date.now() < lockoutEnd) {
            loginState.isLocked = true;
            loginState.lockoutEnd = lockoutEnd;
            
            // Configurar timer para unlock automático
            setTimeout(() => {
                unlockAccount();
            }, lockoutEnd - Date.now());
        } else {
            // Lockout expirado, limpiar
            unlockAccount();
        }
    }
}

/**
 * Bloquear cuenta
 */
function lockAccount() {
    loginState.isLocked = true;
    loginState.lockoutEnd = Date.now() + loginState.lockoutTime;
    
    localStorage.setItem('lockout_end', loginState.lockoutEnd.toString());
    
    // Configurar unlock automático
    setTimeout(() => {
        unlockAccount();
    }, loginState.lockoutTime);
}

/**
 * Desbloquear cuenta
 */
function unlockAccount() {
    loginState.isLocked = false;
    loginState.lockoutEnd = null;
    loginState.loginAttempts = 0;
    
    localStorage.removeItem('login_attempts');
    localStorage.removeItem('lockout_end');
    
    showToast('Cuenta desbloqueada. Puede intentar iniciar sesión nuevamente.', 'info');
    
    // Re-renderizar vista
    const container = document.getElementById('app-container');
    if (container) {
        render(container);
    }
}

/**
 * Actualizar display de intentos
 */
function updateAttemptsDisplay() {
    const form = document.getElementById('login-form');
    if (!form) return;
    
    const existingDisplay = form.querySelector('.attempts-display');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    
    if (loginState.loginAttempts > 0) {
        const attemptsHTML = `
            <div class="attempts-display text-center">
                <p class="text-sm text-yellow-600">
                    <i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>
                    Intentos fallidos: ${loginState.loginAttempts}/${loginState.maxAttempts}
                </p>
            </div>
        `;
        
        form.insertAdjacentHTML('beforeend', attemptsHTML);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Manejar parámetros de query
 */
function handleQueryParams(query) {
    if (query.message) {
        const messageType = query.type || 'info';
        showToast(decodeURIComponent(query.message), messageType);
    }
    
    if (query.email) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = decodeURIComponent(query.email);
        }
    }
}
