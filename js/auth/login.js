// =====================================================
// SISTEMA DE AUTENTICACIÓN - LOGIN
// =====================================================

import { VALIDATION, MESSAGES, DEBUG } from '../config.js';
import { supabase, appState, signInWithPassword, initSupabase } from '../lib/supa.js';
import { showToast, validateForm, getFormData } from '../lib/ui.js';
import { navigateTo } from '../lib/router.js';

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

        await ensureAuthInitialized();

        // Verificar si ya está autenticado
        if (appState.session && appState.user) {
            if (DEBUG.enabled) console.log('👤 Usuario ya autenticado, redirigiendo...');
            redirectToHome();
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
        container.innerHTML = createErrorHTML('Error al cargar el login', error.message);
        
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
    const remainingTime = isLocked ? Math.ceil((loginState.lockoutEnd - Date.now()) / 1000) : 0;
    
    return `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <div class="mx-auto h-20 w-20 flex items-center justify-center">
                        <img src="assets/AIFA_Logo.png" alt="AIFA Logo" class="h-20 w-auto">
                    </div>
                    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sistema de Indicadores
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        AIFA - Aeropuerto Internacional Felipe Ángeles
                    </p>
                </div>
                
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    ${isLocked ? `
                        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div class="flex">
                                <i data-lucide="lock" class="h-5 w-5 text-red-400"></i>
                                <div class="ml-3">
                                    <h3 class="text-sm font-medium text-red-800">Cuenta temporalmente bloqueada</h3>
                                    <p class="mt-1 text-sm text-red-700">
                                        Demasiados intentos fallidos. Intente nuevamente en ${Math.ceil(remainingTime / 60)} minutos.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <form id="login-form" class="space-y-6" ${isLocked ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700">
                                Correo electrónico
                            </label>
                            <div class="mt-1">
                                <input 
                                    id="email" 
                                    name="email" 
                                    type="email" 
                                    autocomplete="email" 
                                    required 
                                    class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-aifa-blue focus:border-aifa-blue sm:text-sm"
                                    placeholder="usuario@aifa.gob.mx"
                                    ${isLocked ? 'disabled' : ''}
                                >
                            </div>
                        </div>

                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <div class="mt-1 relative">
                                <input 
                                    id="password" 
                                    name="password" 
                                    type="password" 
                                    autocomplete="current-password" 
                                    required 
                                    class="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-aifa-blue focus:border-aifa-blue sm:text-sm"
                                    placeholder="••••••••"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                <button
                                    type="button"
                                    id="toggle-password"
                                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    ${isLocked ? 'disabled' : ''}
                                    aria-label="Mostrar contraseña"
                                    aria-pressed="false"
                                >
                                    <i id="toggle-password-icon" data-lucide="eye" class="h-5 w-5 text-gray-400 hover:text-gray-600"></i>
                                </button>
                            </div>
                        </div>

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
                                    Recordarme
                                </label>
                            </div>

                            <div class="text-sm">
                                <button 
                                    type="button" 
                                    id="forgot-password-btn" 
                                    class="font-medium text-aifa-blue hover:text-aifa-dark"
                                    ${isLocked ? 'disabled' : ''}
                                >
                                    ¿Olvidó su contraseña?
                                </button>
                            </div>
                        </div>

                        <div>
                            <button 
                                type="submit" 
                                id="login-button"
                                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-aifa-blue hover:bg-aifa-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aifa-blue disabled:opacity-50 disabled:cursor-not-allowed"
                                ${isLocked ? 'disabled' : ''}
                            >
                                <span id="login-button-spinner" class="hidden absolute left-0 inset-y-0 flex items-center pl-3">
                                    <i data-lucide="loader-2" class="h-5 w-5 animate-spin"></i>
                                </span>
                                <span id="login-button-text">Iniciar sesión</span>
                            </button>
                        </div>
                        
                        ${loginState.loginAttempts > 0 ? `
                            <div class="text-center">
                                <p class="text-sm text-yellow-600">
                                    <i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>
                                    Intentos fallidos: ${loginState.loginAttempts}/${loginState.maxAttempts}
                                </p>
                            </div>
                        ` : ''}
                    </form>
                    
                    ${DEBUG.enabled ? `
                        <div class="mt-6 p-3 bg-gray-100 rounded text-xs text-gray-600">
                            <strong>Debug:</strong> Use cualquier email válido registrado en Supabase
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Crear HTML de error
 */
function createErrorHTML(title, message) {
    return `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
            <div class="text-center">
                <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">${title}</h2>
                <p class="text-gray-600 mb-4">${message}</p>
                <button onclick="location.reload()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                    Recargar página
                </button>
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
        const { isValid, errors } = validateForm(form, {
            email: {
                required: true,
                pattern: VALIDATION.email.pattern,
                message: VALIDATION.email.message
            },
            password: {
                required: true,
                minLength: 1,
                message: 'La contraseña es obligatoria'
            }
        });
        
        if (!isValid) {
            showToast('Por favor, corrija los errores en el formulario', 'error');
            return;
        }
        
        // Obtener datos del formulario
        const formData = getFormData(form);
        const { email, password } = formData;
        
        // Deshabilitar botón y mostrar loading
        loginButton.disabled = true;
        buttonText.textContent = 'Iniciando sesión...';
        buttonSpinner.classList.remove('hidden');
        
        // Intentar login
        const result = await signInWithPassword(email, password);
        
        if (DEBUG.enabled) console.log('✅ Login exitoso:', email);
        
        // Limpiar intentos fallidos
        loginState.loginAttempts = 0;
        localStorage.removeItem('login_attempts');
        updateAttemptsDisplay();
        
        // Mostrar mensaje de éxito
        showToast('Inicio de sesión exitoso', 'success');

        // Redirigir al inicio
        redirectToHome();

        } catch (error) {
        console.error('❌ Error en login:', error);
        
        // Incrementar intentos fallidos
        loginState.loginAttempts++;
        localStorage.setItem('login_attempts', loginState.loginAttempts.toString());
        
        // Verificar si se debe bloquear
        if (loginState.loginAttempts >= loginState.maxAttempts) {
            lockAccount();
            showToast(`Cuenta bloqueada por ${Math.ceil(loginState.lockoutTime / 60000)} minutos`, 'error');
        } else {
            // Mostrar error específico
            let errorMessage = 'Error al iniciar sesión';
            
            if (error.message?.includes('Invalid login credentials')) {
                errorMessage = 'Email o contraseña incorrectos';
            } else if (error.message?.includes('Email not confirmed')) {
                errorMessage = 'Debe confirmar su email antes de iniciar sesión';
            } else if (error.message?.includes('Too many requests')) {
                errorMessage = 'Demasiados intentos. Espere unos minutos e intente nuevamente';
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Error de conexión. Verifique su internet';
            }
            
            showToast(errorMessage, 'error');
            updateAttemptsDisplay();
        }
        
    } finally {
        // Restaurar estado del botón si el formulario sigue presente
        if (loginButton && buttonText && buttonSpinner && document.contains(loginButton)) {
            loginButton.disabled = loginState.isLocked;
            buttonText.textContent = 'Iniciar sesión';
            buttonSpinner.classList.add('hidden');
        }

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
    const toggleButton = document.getElementById('toggle-password');

    if (!passwordInput || !toggleButton) return;

    const showingPassword = passwordInput.type === 'text';
    passwordInput.type = showingPassword ? 'password' : 'text';

    const newLabel = showingPassword ? 'Mostrar contraseña' : 'Ocultar contraseña';
    toggleButton.setAttribute('aria-pressed', String(!showingPassword));
    toggleButton.setAttribute('aria-label', newLabel);
    toggleButton.setAttribute('title', newLabel);

    const iconName = showingPassword ? 'eye' : 'eye-off';
    toggleButton.innerHTML = `<i data-lucide="${iconName}" class="h-5 w-5 text-gray-400 hover:text-gray-600"></i>`;

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
        showToast('Ingrese un email válido', 'error');
        return;
    }
    
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/reset-password`
        });
        
        if (error) throw error;
        
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

/**
 * Esperar a que Supabase inicialice su estado de autenticación
 */
async function ensureAuthInitialized(timeout = 6000) {
    if (appState.initialized) return;

    let initError = null;
    const initialization = initSupabase().catch(error => {
        initError = error;
        return false;
    });

    if (timeout > 0) {
        await Promise.race([
            initialization,
            new Promise(resolve => setTimeout(resolve, timeout))
        ]);
    } else {
        await initialization;
    }

    if (initError) {
        if (DEBUG.enabled) {
            console.error('❌ No se pudo inicializar Supabase antes del login:', initError);
        }
        throw initError;
    }

    if (!appState.initialized && DEBUG.enabled) {
        console.warn('⚠️ Supabase aún no se inicializa después del tiempo de espera.');
    }
}

/**
 * Redirigir a la página inicial usando el router si está disponible
 */
function redirectToHome() {
    const role = appState.profile?.rol_principal;
    const targetRoute = role === 'DIRECTOR' ? '/panel-directivos' : '/';

    if (window.router?.navigateTo) {
        window.router.navigateTo(targetRoute, {}, true);
    } else {
        window.location.hash = `#${targetRoute}`;
    }
}
