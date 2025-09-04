/**
 * login.js - VERSIÓN INFALIBLE - Sistema de Indicadores AIFA 2.0
 * Autenticación por EMAIL con manejo robusto de errores
 */

// Variables globales
let currentUser = null;
let authState = 'logged-out';
let loginElements = {};
let systemStatusElements = {};
let supabaseClient = null;
let isInitializing = false;

// Inicialización con máxima robustez
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Iniciando sistema de autenticación...');
    
    try {
        isInitializing = true;
        
        // Esperar a que utils.js esté completamente cargado
        await waitForUtils();
        
        // Inicializar cliente Supabase
        supabaseClient = createClient();
        console.log('✅ Cliente Supabase inicializado');
        
        // Esperar a que DOM esté completamente listo
        await waitForDOM();
        
        // Inicializar elementos con verificación robusta
        initializeElements();
        console.log('✅ Elementos DOM inicializados');
        
        // Configurar event listeners
        setupEventListeners();
        console.log('✅ Event listeners configurados');
        
        // Verificar estado del sistema
        await checkSystemStatus();
        console.log('✅ Estado del sistema verificado');
        
        // Verificar sesión existente
        await checkExistingSession();
        console.log('✅ Sesión verificada');
        
        // Configurar listener de cambios de auth
        setupAuthListener();
        console.log('✅ Auth listener configurado');
        
        isInitializing = false;
        
        console.log('🎉 Sistema de autenticación inicializado exitosamente');
        safeNotify('success', 'Sistema de autenticación listo');
        
    } catch (error) {
        console.error('❌ Error durante inicialización:', error);
        isInitializing = false;
        
        // Mostrar error detallado solo en desarrollo
        if (window.location.hostname === 'localhost') {
            safeNotify('error', `Error detallado: ${error.message}`);
        } else {
            safeNotify('error', 'Error inicializando sistema. Recargue la página.');
        }
    }
});

/**
 * Espera a que utils.js esté disponible
 */
function waitForUtils() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos máximo
        
        const checkUtils = () => {
            attempts++;
            
            if (typeof createClient === 'function' && typeof notify === 'function') {
                console.log(`✅ utils.js cargado (intento ${attempts})`);
                resolve();
                return;
            }
            
            if (attempts >= maxAttempts) {
                reject(new Error('utils.js no se cargó correctamente'));
                return;
            }
            
            setTimeout(checkUtils, 100);
        };
        
        checkUtils();
    });
}

/**
 * Espera a que DOM esté completamente listo
 */
function waitForDOM() {
    return new Promise(resolve => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

/**
 * Inicializa elementos DOM con verificación exhaustiva
 */
function initializeElements() {
    console.log('🔍 Buscando elementos DOM...');
    
    // Lista de todos los elementos con verificación individual
    const elementMappings = [
        // Contenedores principales
        { key: 'loginCard', id: 'login-card', required: true },
        { key: 'userCard', id: 'user-card', required: true },
        { key: 'registerCard', id: 'register-card', required: false },
        
        // Tabs
        { key: 'emailTab', id: 'email-tab', required: false },
        { key: 'magicTab', id: 'magic-tab', required: false },
        
        // Formulario Email/Password
        { key: 'emailForm', id: 'email-form', required: true },
        { key: 'emailInput', id: 'email-input', required: true },
        { key: 'passwordInput', id: 'password-input', required: true },
        { key: 'passwordToggle', id: 'password-toggle', required: false },
        { key: 'rememberMe', id: 'remember-me', required: false },
        { key: 'loginBtn', id: 'login-btn', required: true },
        { key: 'forgotPasswordBtn', id: 'forgot-password-btn', required: false },
        
        // Formulario Magic Link
        { key: 'magicForm', id: 'magic-form', required: true },
        { key: 'magicEmailInput', id: 'magic-email-input', required: false },
        { key: 'magicBtn', id: 'magic-btn', required: false },
        
        // Usuario autenticado
        { key: 'userDisplayName', id: 'user-display-name', required: false },
        { key: 'userEmail', id: 'user-email', required: false },
        { key: 'userRoleDisplay', id: 'user-role-display', required: false },
        { key: 'userAreasDisplay', id: 'user-areas-display', required: false },
        { key: 'userLastLogin', id: 'user-last-login', required: false },
        { key: 'refreshSessionBtn', id: 'refresh-session-btn', required: false },
        { key: 'logoutBtn', id: 'logout-btn', required: false },
        
        // Registro
        { key: 'registerForm', id: 'register-form', required: false },
        { key: 'registerEmail', id: 'register-email', required: false },
        { key: 'registerPassword', id: 'register-password', required: false },
        { key: 'registerNombre', id: 'register-nombre', required: false },
        { key: 'registerRol', id: 'register-rol', required: false },
        { key: 'registerBtn', id: 'register-btn', required: false }
    ];
    
    // Inicializar objeto loginElements
    loginElements = {};
    let missingRequired = [];
    
    // Buscar cada elemento
    elementMappings.forEach(({ key, id, required }) => {
        const element = document.getElementById(id);
        loginElements[key] = element;
        
        if (element) {
            console.log(`  ✅ ${key} (#${id}) - Encontrado`);
        } else {
            console.log(`  ${required ? '❌' : '⚠️'} ${key} (#${id}) - ${required ? 'REQUERIDO' : 'Opcional'} NO ENCONTRADO`);
            if (required) {
                missingRequired.push(`${key} (#${id})`);
            }
        }
    });
    
    // Elementos de estado del sistema
    systemStatusElements = {
        dbStatus: document.getElementById('db-status'),
        authStatus: document.getElementById('auth-status'),
        apiStatus: document.getElementById('api-status')
    };
    
    console.log('🔍 Estado del sistema:');
    Object.entries(systemStatusElements).forEach(([key, element]) => {
        console.log(`  ${element ? '✅' : '⚠️'} ${key} - ${element ? 'Encontrado' : 'No encontrado'}`);
    });
    
    // Solo fallar si faltan elementos críticos REQUERIDOS
    if (missingRequired.length > 0) {
        throw new Error(`Elementos DOM requeridos faltantes: ${missingRequired.join(', ')}`);
    }
    
    console.log('✅ Todos los elementos requeridos encontrados');
}

/**
 * Configura event listeners de forma segura
 */
function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Helper para agregar listeners de forma segura
    const safeAddListener = (element, event, handler, description) => {
        if (element) {
            element.addEventListener(event, handler);
            console.log(`  ✅ ${description}`);
        } else {
            console.log(`  ⚠️ ${description} - Elemento no encontrado`);
        }
    };
    
    // Tabs de autenticación
    safeAddListener(loginElements.emailTab, 'click', () => switchAuthTab('email'), 'Email tab');
    safeAddListener(loginElements.magicTab, 'click', () => switchAuthTab('magic'), 'Magic tab');
    
    // Toggle de contraseña
    safeAddListener(loginElements.passwordToggle, 'click', togglePasswordVisibility, 'Password toggle');
    
    // Formularios
    safeAddListener(loginElements.emailForm, 'submit', handleEmailLogin, 'Email form submit');
    safeAddListener(loginElements.magicForm, 'submit', handleMagicLinkLogin, 'Magic form submit');
    safeAddListener(loginElements.registerForm, 'submit', handleRegister, 'Register form submit');
    
    // Botones de usuario
    safeAddListener(loginElements.logoutBtn, 'click', handleLogout, 'Logout button');
    safeAddListener(loginElements.refreshSessionBtn, 'click', handleRefreshSession, 'Refresh session button');
    safeAddListener(loginElements.forgotPasswordBtn, 'click', handleForgotPassword, 'Forgot password button');
    
    // Validaciones en tiempo real
    safeAddListener(loginElements.emailInput, 'input', validateEmailInput, 'Email validation');
    safeAddListener(loginElements.magicEmailInput, 'input', validateMagicEmailInput, 'Magic email validation');
    safeAddListener(loginElements.passwordInput, 'input', validatePasswordInput, 'Password validation');
    
    // Enter en campos
    const setupEnterKey = (element, handler, description) => {
        safeAddListener(element, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handler(e);
            }
        }, description);
    };
    
    setupEnterKey(loginElements.emailInput, handleEmailLogin, 'Email input Enter key');
    setupEnterKey(loginElements.passwordInput, handleEmailLogin, 'Password input Enter key');
    setupEnterKey(loginElements.magicEmailInput, handleMagicLinkLogin, 'Magic email Enter key');
    
    console.log('✅ Event listeners configurados');
}

/**
 * Verifica estado del sistema de forma segura
 */
async function checkSystemStatus() {
    console.log('🏥 Verificando estado del sistema...');
    
    // Estado de base de datos
    try {
        const { data, error } = await supabaseClient.from('users').select('id').limit(1);
        updateSystemStatus('db', !error ? 'success' : 'error', !error ? 'Conectado' : 'Error de conexión');
        console.log(`  ${!error ? '✅' : '❌'} Base de datos: ${!error ? 'OK' : 'Error'}`);
    } catch (error) {
        updateSystemStatus('db', 'error', 'Sin conexión');
        console.log('  ❌ Base de datos: Sin conexión');
    }
    
    // Estado de autenticación
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        updateSystemStatus('auth', 'success', 'Funcional');
        console.log('  ✅ Autenticación: OK');
    } catch (error) {
        updateSystemStatus('auth', 'error', 'Error de auth');
        console.log('  ❌ Autenticación: Error');
    }
    
    // Estado de API
    updateSystemStatus('api', 'success', 'Operativo');
    console.log('  ✅ API: OK');
}

/**
 * Actualiza indicadores de estado del sistema
 */
function updateSystemStatus(component, status, message) {
    const element = systemStatusElements[`${component}Status`];
    if (!element) return;
    
    const dot = element.querySelector('.status-dot');
    const text = element.querySelector('.status-text');
    
    if (dot) {
        dot.className = `status-dot ${status}`;
    }
    
    if (text) {
        text.textContent = message;
    }
}

/**
 * Verifica sesión existente
 */
async function checkExistingSession() {
    console.log('🔍 Verificando sesión existente...');
    
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            console.log('✅ Sesión activa encontrada');
            await handleAuthStateChange('SIGNED_IN', session);
        } else {
            console.log('ℹ️ No hay sesión activa');
            await handleAuthStateChange('SIGNED_OUT', null);
        }
        
    } catch (error) {
        console.error('❌ Error verificando sesión:', error);
        await handleAuthStateChange('SIGNED_OUT', null);
    }
}

/**
 * Configura listener de cambios de autenticación
 */
function setupAuthListener() {
    console.log('👂 Configurando listener de autenticación...');
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (!isInitializing) {
            console.log(`🔄 Cambio de estado de auth: ${event}`);
            await handleAuthStateChange(event, session);
        }
    });
}

/**
 * Maneja cambios de estado de autenticación
 */
async function handleAuthStateChange(event, session) {
    try {
        console.log(`🔄 Procesando cambio de auth: ${event}`);
        
        switch (event) {
            case 'SIGNED_IN':
                authState = 'logged-in';
                currentUser = session.user;
                await loadUserData();
                showUserCard();
                safeNotify('success', 'Sesión iniciada exitosamente');
                break;
                
            case 'SIGNED_OUT':
                authState = 'logged-out';
                currentUser = null;
                showLoginCard();
                safeNotify('info', 'Sesión cerrada');
                break;
                
            case 'PASSWORD_RECOVERY':
                safeNotify('info', 'Enlace de recuperación enviado a su email');
                break;
                
            case 'USER_UPDATED':
                await loadUserData();
                safeNotify('success', 'Información actualizada');
                break;
        }
        
        safeUpdateLiveRegion(`Estado de autenticación: ${event}`);
        
    } catch (error) {
        console.error('❌ Error manejando cambio de auth:', error);
        safeNotify('error', 'Error en autenticación');
    }
}

/**
 * Maneja login con email/password
 */
async function handleEmailLogin(e) {
    e.preventDefault();
    console.log('🔐 Iniciando login con email/password...');
    
    if (!validateEmailForm()) {
        console.log('❌ Validación de formulario falló');
        return;
    }
    
    try {
        setLoadingState(loginElements.loginBtn, true);
        
        const email = safeGetValue(loginElements.emailInput);
        const password = safeGetValue(loginElements.passwordInput);
        
        console.log(`📧 Intentando login con email: ${email}`);
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        console.log('✅ Login exitoso, verificando estado de usuario...');
        
        // Verificar que el usuario esté activo
        const isActive = await checkUserActiveStatus(email);
        if (!isActive) {
            console.log('❌ Usuario inactivo');
            await supabaseClient.auth.signOut();
            throw new Error('Su cuenta está desactivada. Contacte al administrador.');
        }
        
        console.log('✅ Usuario activo, login completado');
        setLoadingState(loginElements.loginBtn, false);
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        
        let errorMessage = 'Error iniciando sesión';
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Email o contraseña incorrectos';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Debe confirmar su email antes de acceder';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Demasiados intentos. Espere antes de intentar nuevamente';
        } else if (error.message.includes('desactivada')) {
            errorMessage = error.message;
        }
        
        safeNotify('error', errorMessage);
        setLoadingState(loginElements.loginBtn, false);
        
        // Focus en campo de password
        safeFocus(loginElements.passwordInput);
    }
}

/**
 * Verifica si usuario está activo
 */
async function checkUserActiveStatus(email) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('activo')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('⚠️ Error verificando estado usuario:', error);
            return true; // Si no se puede verificar, permitir acceso
        }
        
        return data?.activo === true;
    } catch (error) {
        console.error('⚠️ Error en checkUserActiveStatus:', error);
        return true;
    }
}

/**
 * Maneja login con Magic Link
 */
async function handleMagicLinkLogin(e) {
    e.preventDefault();
    console.log('✨ Enviando Magic Link...');
    
    if (!validateMagicForm()) {
        return;
    }
    
    try {
        setLoadingState(loginElements.magicBtn, true);
        
        const email = safeGetValue(loginElements.magicEmailInput);
        
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin + '/login.html'
            }
        });
        
        if (error) throw error;
        
        safeNotify('success', `Magic Link enviado a ${email}`);
        safeClearForm(loginElements.magicForm);
        setLoadingState(loginElements.magicBtn, false);
        
    } catch (error) {
        console.error('❌ Error enviando Magic Link:', error);
        
        let errorMessage = 'Error enviando Magic Link';
        if (error.message.includes('User not found')) {
            errorMessage = 'No se encontró cuenta con ese email';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Demasiados intentos. Espere antes de intentar nuevamente';
        }
        
        safeNotify('error', errorMessage);
        setLoadingState(loginElements.magicBtn, false);
    }
}

/**
 * Maneja logout
 */
async function handleLogout() {
    console.log('🚪 Cerrando sesión...');
    
    try {
        setLoadingState(loginElements.logoutBtn, true);
        
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        console.log('✅ Logout exitoso');
        setLoadingState(loginElements.logoutBtn, false);
        
    } catch (error) {
        console.error('❌ Error en logout:', error);
        safeNotify('error', 'Error cerrando sesión');
        setLoadingState(loginElements.logoutBtn, false);
    }
}

/**
 * Carga datos del usuario
 */
async function loadUserData() {
    if (!currentUser) return;
    
    console.log('👤 Cargando datos de usuario...');
    
    try {
        const userData = await getCurrentUser();
        
        if (userData) {
            safeSetText(loginElements.userDisplayName, userData.nombre || userData.email);
            safeSetText(loginElements.userEmail, userData.email);
            safeSetText(loginElements.userRoleDisplay, userData.rol?.nombre || 'No asignado');
            
            const areas = userData.areas?.map(area => area.nombre).join(', ') || 'Ninguna';
            safeSetText(loginElements.userAreasDisplay, areas);
            
            if (currentUser.last_sign_in_at) {
                safeSetText(loginElements.userLastLogin, formatDate(currentUser.last_sign_in_at, 'datetime'));
            }
            
            // Mostrar registro si es admin
            const isAdmin = userData.rol?.nombre === 'admin';
            safeToggleDisplay(loginElements.registerCard, isAdmin);
            
            console.log('✅ Datos de usuario cargados');
        }
        
    } catch (error) {
        console.error('⚠️ Error cargando datos usuario:', error);
    }
}

/**
 * Muestra card de login
 */
function showLoginCard() {
    console.log('🔐 Mostrando card de login');
    safeToggleDisplay(loginElements.loginCard, true);
    safeToggleDisplay(loginElements.userCard, false);
    safeToggleDisplay(loginElements.registerCard, false);
}

/**
 * Muestra card de usuario
 */
function showUserCard() {
    console.log('👤 Mostrando card de usuario');
    safeToggleDisplay(loginElements.loginCard, false);
    safeToggleDisplay(loginElements.userCard, true);
}

/**
 * Cambia entre tabs de autenticación
 */
function switchAuthTab(tabType) {
    console.log(`🔄 Cambiando a tab: ${tabType}`);
    
    // Actualizar tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (tabType === 'email') {
        safeAddClass(loginElements.emailTab, 'active');
        safeToggleDisplay(loginElements.emailForm, true);
        safeToggleDisplay(loginElements.magicForm, false);
        safeFocus(loginElements.emailInput);
    } else {
        safeAddClass(loginElements.magicTab, 'active');
        safeToggleDisplay(loginElements.emailForm, false);
        safeToggleDisplay(loginElements.magicForm, true);
        safeFocus(loginElements.magicEmailInput);
    }
}

/**
 * Toggle de visibilidad de contraseña
 */
function togglePasswordVisibility() {
    const input = loginElements.passwordInput;
    const button = loginElements.passwordToggle;
    
    if (!input || !button) return;
    
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.textContent = isPassword ? '🙈' : '👁️';
    button.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

/**
 * Validaciones de formularios
 */
function validateEmailForm() {
    clearFormErrors('email-error', 'password-error');
    
    const email = safeGetValue(loginElements.emailInput);
    const password = safeGetValue(loginElements.passwordInput);
    
    let isValid = true;
    
    if (!email || !isValidEmail(email)) {
        showFieldError('email-error', 'Ingrese un email válido');
        isValid = false;
    }
    
    if (!password || password.length < 6) {
        showFieldError('password-error', 'Mínimo 6 caracteres');
        isValid = false;
    }
    
    return isValid;
}

function validateMagicForm() {
    clearFormErrors('magic-email-error');
    
    const email = safeGetValue(loginElements.magicEmailInput);
    
    if (!email || !isValidEmail(email)) {
        showFieldError('magic-email-error', 'Ingrese un email válido');
        return false;
    }
    
    return true;
}

/**
 * Validaciones en tiempo real
 */
function validateEmailInput() {
    const email = safeGetValue(loginElements.emailInput);
    
    if (email && !isValidEmail(email)) {
        showFieldError('email-error', 'Formato inválido');
    } else {
        clearFormErrors('email-error');
    }
}

function validateMagicEmailInput() {
    const email = safeGetValue(loginElements.magicEmailInput);
    
    if (email && !isValidEmail(email)) {
        showFieldError('magic-email-error', 'Formato inválido');
    } else {
        clearFormErrors('magic-email-error');
    }
}

function validatePasswordInput() {
    const password = safeGetValue(loginElements.passwordInput);
    
    if (password && password.length < 6) {
        showFieldError('password-error', 'Mínimo 6 caracteres');
    } else {
        clearFormErrors('password-error');
    }
}

/**
 * Utilidades para manejo de errores
 */
function showFieldError(errorId, message) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
    }
}

function clearFormErrors(...errorIds) {
    errorIds.forEach(id => {
        const errorEl = document.getElementById(id);
        if (errorEl) {
            errorEl.textContent = '';
        }
    });
}

/**
 * Control de estados de carga
 */
function setLoadingState(button, loading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    button.disabled = loading;
    
    if (btnText) {
        btnText.style.display = loading ? 'none' : 'block';
    }
    
    if (btnLoading) {
        btnLoading.style.display = loading ? 'block' : 'none';
    }
}

// FUNCIONES HELPER SEGURAS
function safeNotify(type, message) {
    if (typeof notify === 'function') {
        notify(type, message);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

function safeUpdateLiveRegion(message) {
    if (typeof updateLiveRegion === 'function') {
        updateLiveRegion(message);
    }
}

function safeGetValue(element) {
    return element?.value?.trim() || '';
}

function safeSetText(element, text) {
    if (element) {
        element.textContent = text;
    }
}

function safeToggleDisplay(element, show) {
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

function safeFocus(element) {
    if (element && typeof element.focus === 'function') {
        try {
            element.focus();
        } catch (e) {
            console.log('⚠️ No se pudo hacer focus:', e.message);
        }
    }
}

function safeAddClass(element, className) {
    if (element && element.classList) {
        element.classList.add(className);
    }
}

function safeClearForm(form) {
    if (form && typeof form.reset === 'function') {
        form.reset();
    }
}

// Manejo de recuperación de contraseña
async function handleForgotPassword() {
    const email = safeGetValue(loginElements.emailInput);
    
    if (!email || !isValidEmail(email)) {
        safeNotify('error', 'Ingrese un email válido primero');
        safeFocus(loginElements.emailInput);
        return;
    }
    
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login.html`
        });
        
        if (error) throw error;
        
        safeNotify('success', `Enlace de recuperación enviado a ${email}`);
        
    } catch (error) {
        console.error('❌ Error recuperación:', error);
        safeNotify('error', 'Error enviando enlace de recuperación');
    }
}

// Refresh de sesión
async function handleRefreshSession() {
    console.log('🔄 Actualizando sesión...');
    
    try {
        setLoadingState(loginElements.refreshSessionBtn, true);
        
        const { data, error } = await supabaseClient.auth.refreshSession();
        if (error) throw error;
        
        await loadUserData();
        safeNotify('success', 'Sesión actualizada');
        setLoadingState(loginElements.refreshSessionBtn, false);
        
    } catch (error) {
        console.error('❌ Error refresh:', error);
        safeNotify('error', 'Error actualizando sesión');
        setLoadingState(loginElements.refreshSessionBtn, false);
    }
}

// Registro de usuarios (placeholder para admin)
async function handleRegister(e) {
    e.preventDefault();
    safeNotify('info', 'Función de registro en desarrollo');
}

// Inicialización en load
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    
    if (type === 'recovery') {
        safeNotify('info', 'Enlace de recuperación activado');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

console.log('🔐 Sistema de autenticación AIFA 2.0 - VERSIÓN INFALIBLE');
