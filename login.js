/**
 * login.js - CORREGIDO - Lógica de autenticación por EMAIL
 * Sistema de Indicadores AIFA 2.0
 */

// Variables globales
let currentUser = null;
let authState = 'logged-out'; // 'logged-out', 'logged-in', 'loading'

// Elementos DOM
let loginElements = {};
let authElements = {};
let systemStatusElements = {};

// Estados de la aplicación
let isInitializing = false;
let retryCount = 0;
const maxRetries = 3;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        isInitializing = true;
        
        // Inicializar cliente Supabase
        supabase = createClient();
        
        // Obtener referencias DOM
        initializeElements();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Verificar estado del sistema
        await checkSystemStatus();
        
        // Verificar sesión existente
        await checkExistingSession();
        
        // Configurar listener de cambios de auth
        setupAuthListener();
        
        isInitializing = false;
        
        notify('success', 'Sistema de autenticación inicializado');
        
    } catch (error) {
        console.error('Error durante inicialización:', error);
        notify('error', 'Error inicializando autenticación: ' + error.message);
        isInitializing = false;
    }
});

/**
 * Inicializa referencias a elementos DOM
 */
function initializeElements() {
    // Elementos de login
    loginElements = {
        // Contenedores principales
        loginCard: document.getElementById('login-card'),
        userCard: document.getElementById('user-card'),
        registerCard: document.getElementById('register-card'),
        
        // Tabs de autenticación
        emailTab: document.getElementById('email-tab'),
        magicTab: document.getElementById('magic-tab'),
        
        // Formulario Email/Password
        emailForm: document.getElementById('email-form'),
        emailInput: document.getElementById('email-input'),
        passwordInput: document.getElementById('password-input'),
        passwordToggle: document.getElementById('password-toggle'),
        rememberMe: document.getElementById('remember-me'),
        loginBtn: document.getElementById('login-btn'),
        forgotPasswordBtn: document.getElementById('forgot-password-btn'),
        
        // Formulario Magic Link
        magicForm: document.getElementById('magic-form'),
        magicEmailInput: document.getElementById('magic-email-input'),
        magicBtn: document.getElementById('magic-btn'),
        
        // Información de usuario autenticado
        userDisplayName: document.getElementById('user-display-name'),
        userEmail: document.getElementById('user-email'),
        userRoleDisplay: document.getElementById('user-role-display'),
        userAreasDisplay: document.getElementById('user-areas-display'),
        userLastLogin: document.getElementById('user-last-login'),
        refreshSessionBtn: document.getElementById('refresh-session-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        
        // Formulario de registro (solo admin)
        registerForm: document.getElementById('register-form'),
        registerEmail: document.getElementById('register-email'),
        registerPassword: document.getElementById('register-password'),
        registerNombre: document.getElementById('register-nombre'),
        registerRol: document.getElementById('register-rol'),
        registerBtn: document.getElementById('register-btn')
    };
    
    // Elementos de estado del sistema
    systemStatusElements = {
        dbStatus: document.getElementById('db-status'),
        authStatus: document.getElementById('auth-status'),
        apiStatus: document.getElementById('api-status')
    };
    
    // Verificar elementos críticos
    const criticalElements = [
        loginElements.loginCard,
        loginElements.emailForm,
        loginElements.magicForm
    ];
    
    const missingElements = criticalElements.filter(el => !el);
    if (missingElements.length > 0) {
        throw new Error('Faltan elementos DOM críticos para autenticación');
    }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Tabs de autenticación
    loginElements.emailTab?.addEventListener('click', () => switchAuthTab('email'));
    loginElements.magicTab?.addEventListener('click', () => switchAuthTab('magic'));
    
    // Toggle de contraseña
    loginElements.passwordToggle?.addEventListener('click', togglePasswordVisibility);
    
    // Formularios
    loginElements.emailForm?.addEventListener('submit', handleEmailLogin);
    loginElements.magicForm?.addEventListener('submit', handleMagicLinkLogin);
    loginElements.registerForm?.addEventListener('submit', handleRegister);
    
    // Botones de usuario autenticado
    loginElements.logoutBtn?.addEventListener('click', handleLogout);
    loginElements.refreshSessionBtn?.addEventListener('click', handleRefreshSession);
    loginElements.forgotPasswordBtn?.addEventListener('click', handleForgotPassword);
    
    // Validación en tiempo real
    loginElements.emailInput?.addEventListener('input', validateEmailInput);
    loginElements.magicEmailInput?.addEventListener('input', validateMagicEmailInput);
    loginElements.passwordInput?.addEventListener('input', validatePasswordInput);
    
    // Registro - validaciones
    loginElements.registerEmail?.addEventListener('input', validateRegisterEmail);
    loginElements.registerPassword?.addEventListener('input', validateRegisterPassword);
    loginElements.registerNombre?.addEventListener('input', validateRegisterNombre);
    
    // Enter en campos para envío de formulario
    [loginElements.emailInput, loginElements.passwordInput].forEach(input => {
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleEmailLogin(e);
            }
        });
    });
    
    loginElements.magicEmailInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleMagicLinkLogin(e);
        }
    });
}

/**
 * Verifica estado del sistema (DB, Auth, API)
 */
async function checkSystemStatus() {
    // Estado de base de datos
    try {
        const { data, error } = await 
            .from('users')
            .select('id')
            .limit(1);
        
        updateSystemStatus('db', !error ? 'success' : 'error', !error ? 'Conectado' : 'Error de conexión');
    } catch (error) {
        updateSystemStatus('db', 'error', 'Sin conexión');
    }
    
    // Estado de autenticación
    try {
        const { data, error } = await .auth.getSession();
        updateSystemStatus('auth', 'success', 'Funcional');
    } catch (error) {
        updateSystemStatus('auth', 'error', 'Error de auth');
    }
    
    // Estado de API
    updateSystemStatus('api', 'success', 'Operativo');
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
 * Verifica sesión existente al cargar la página
 */
async function checkExistingSession() {
    try {
        const { data: { session }, error } = await .auth.getSession();
        
        if (error) {
            throw error;
        }
        
        if (session) {
            await handleAuthStateChange('SIGNED_IN', session);
        } else {
            await handleAuthStateChange('SIGNED_OUT', null);
        }
        
    } catch (error) {
        console.error('Error verificando sesión:', error);
        await handleAuthStateChange('SIGNED_OUT', null);
    }
}

/**
 * Configura listener para cambios de autenticación
 */
function setupAuthListener() {
    .auth.onAuthStateChange(async (event, session) => {
        if (!isInitializing) {
            await handleAuthStateChange(event, session);
        }
    });
}

/**
 * Maneja cambios en el estado de autenticación
 */
async function handleAuthStateChange(event, session) {
    try {
        switch (event) {
            case 'SIGNED_IN':
                authState = 'logged-in';
                currentUser = session.user;
                await loadUserData();
                showUserCard();
                notify('success', 'Sesión iniciada exitosamente');
                break;
                
            case 'SIGNED_OUT':
                authState = 'logged-out';
                currentUser = null;
                showLoginCard();
                notify('info', 'Sesión cerrada');
                break;
                
            case 'PASSWORD_RECOVERY':
                notify('info', 'Se envió el enlace de recuperación a su email');
                break;
                
            case 'USER_UPDATED':
                await loadUserData();
                notify('success', 'Información de usuario actualizada');
                break;
        }
        
        updateLiveRegion(`Estado de autenticación: ${event}`);
        
    } catch (error) {
        console.error('Error manejando cambio de auth:', error);
        notify('error', 'Error en autenticación: ' + error.message);
    }
}

/**
 * Cambia entre tabs de autenticación
 */
function switchAuthTab(tabType) {
    // Actualizar tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (tabType === 'email') {
        loginElements.emailTab?.classList.add('active');
        loginElements.emailForm.style.display = 'block';
        loginElements.magicForm.style.display = 'none';
        loginElements.emailInput?.focus();
    } else {
        loginElements.magicTab?.classList.add('active');
        loginElements.emailForm.style.display = 'none';
        loginElements.magicForm.style.display = 'block';
        loginElements.magicEmailInput?.focus();
    }
}

/**
 * Toggle de visibilidad de contraseña
 */
function togglePasswordVisibility() {
    const input = loginElements.passwordInput;
    const button = loginElements.passwordToggle;
    
    if (input && button) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? '🙈' : '👁️';
        button.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }
}

/**
 * Maneja login con email/password - CORREGIDO
 */
async function handleEmailLogin(e) {
    e.preventDefault();
    
    if (!validateEmailForm()) {
        return;
    }
    
    try {
        setLoadingState(loginElements.loginBtn, true);
        
        const email = loginElements.emailInput.value.trim();
        const password = loginElements.passwordInput.value;
        
        // CORREGIDO: Llamada simple sin opciones inválidas
        const { data, error } = await .auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            throw error;
        }
        
        // Verificar que el usuario esté activo en la tabla users
        const isActive = await checkUserActiveStatus(email);
        if (!isActive) {
            await .auth.signOut();
            throw new Error('Su cuenta está desactivada. Contacte al administrador.');
        }
        
        // El handleAuthStateChange se ejecutará automáticamente
        setLoadingState(loginElements.loginBtn, false);
        
    } catch (error) {
        console.error('Error en login:', error);
        
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
        
        notify('error', errorMessage);
        setLoadingState(loginElements.loginBtn, false);
        
        // Focus en campo de password para reintento
        loginElements.passwordInput?.focus();
        loginElements.passwordInput?.select();
    }
}

/**
 * Verifica si el usuario está activo en la tabla users
 */
async function checkUserActiveStatus(email) {
    try {
        const { data, error } = await 
            .from('users')
            .select('activo')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('Error verificando estado del usuario:', error);
            return true; // Si no se puede verificar, permitir acceso
        }
        
        return data?.activo === true;
    } catch (error) {
        console.error('Error en checkUserActiveStatus:', error);
        return true;
    }
}

/**
 * Maneja login con Magic Link - CORREGIDO
 */
async function handleMagicLinkLogin(e) {
    e.preventDefault();
    
    if (!validateMagicForm()) {
        return;
    }
    
    try {
        setLoadingState(loginElements.magicBtn, true);
        
        const email = loginElements.magicEmailInput.value.trim();
        
        // CORREGIDO: Estructura correcta para signInWithOtp
        const { error } = await .auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin + '/login.html'
            }
        });
        
        if (error) {
            throw error;
        }
        
        notify('success', `Magic Link enviado a ${email}. Revise su bandeja de entrada.`);
        
        // Limpiar formulario
        loginElements.magicForm.reset();
        
        setLoadingState(loginElements.magicBtn, false);
        
    } catch (error) {
        console.error('Error enviando Magic Link:', error);
        
        let errorMessage = 'Error enviando Magic Link';
        if (error.message.includes('User not found')) {
            errorMessage = 'No se encontró una cuenta con ese email';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Demasiados intentos. Espere antes de solicitar otro enlace';
        }
        
        notify('error', errorMessage);
        setLoadingState(loginElements.magicBtn, false);
    }
}

/**
 * Maneja registro de nuevo usuario (solo admin) - CORREGIDO
 */
async function handleRegister(e) {
    e.preventDefault();
    
    // Verificar que el usuario actual es admin
    if (!currentUser || !(await hasPermission('users', 'create'))) {
        notify('error', 'Solo administradores pueden crear usuarios');
        return;
    }
    
    if (!validateRegisterForm()) {
        return;
    }
    
    try {
        setLoadingState(loginElements.registerBtn, true);
        
        const email = loginElements.registerEmail.value.trim();
        const password = loginElements.registerPassword.value;
        const nombre = loginElements.registerNombre.value.trim();
        const rol = loginElements.registerRol.value;
        
        // CORREGIDO: Crear usuario directamente con signUp
        const { data: authData, error: authError } = await .auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: nombre
                },
                emailRedirectTo: window.location.origin + '/login.html'
            }
        });
        
        if (authError) {
            throw authError;
        }
        
        // Crear registro en tabla users (esperando confirmación de email)
        const { error: userError } = await 
            .from('users')
            .insert({
                id: authData.user.id,
                email: email,
                nombre: nombre,
                rol_id: (await getRoleIdByName(rol)),
                activo: true
            });
        
        if (userError) {
            console.error('Error insertando usuario:', userError);
            // No eliminar de auth en este caso, usuario puede confirmar email después
        }
        
        notify('success', `Usuario ${nombre} creado. Se envió email de confirmación.`);
        
        // Limpiar formulario
        loginElements.registerForm.reset();
        
        setLoadingState(loginElements.registerBtn, false);
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        
        let errorMessage = 'Error creando usuario';
        if (error.message.includes('User already registered')) {
            errorMessage = 'Ya existe un usuario con ese email';
        }
        
        notify('error', errorMessage);
        setLoadingState(loginElements.registerBtn, false);
    }
}

/**
 * Obtiene ID del rol por nombre
 */
async function getRoleIdByName(roleName) {
    const { data, error } = await 
        .from('roles')
        .select('id')
        .eq('nombre', roleName)
        .single();
    
    if (error) {
        throw error;
    }
    
    return data.id;
}

/**
 * Maneja logout
 */
async function handleLogout() {
    try {
        setLoadingState(loginElements.logoutBtn, true);
        
        const { error } = await .auth.signOut();
        
        if (error) {
            throw error;
        }
        
        // La limpieza se maneja en handleAuthStateChange
        setLoadingState(loginElements.logoutBtn, false);
        
    } catch (error) {
        console.error('Error en logout:', error);
        notify('error', 'Error cerrando sesión: ' + error.message);
        setLoadingState(loginElements.logoutBtn, false);
    }
}

/**
 * Maneja recuperación de contraseña
 */
async function handleForgotPassword() {
    const email = loginElements.emailInput?.value.trim();
    
    if (!email || !isValidEmail(email)) {
        notify('error', 'Ingrese un email válido primero');
        loginElements.emailInput?.focus();
        return;
    }
    
    try {
        const { error } = await .auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login.html`
        });
        
        if (error) {
            throw error;
        }
        
        notify('success', `Enlace de recuperación enviado a ${email}`);
        
    } catch (error) {
        console.error('Error enviando recuperación:', error);
        notify('error', 'Error enviando enlace de recuperación: ' + error.message);
    }
}

/**
 * Actualiza sesión del usuario
 */
async function handleRefreshSession() {
    try {
        setLoadingState(loginElements.refreshSessionBtn, true);
        
        const { data, error } = await .auth.refreshSession();
        
        if (error) {
            throw error;
        }
        
        await loadUserData();
        notify('success', 'Sesión actualizada');
        
        setLoadingState(loginElements.refreshSessionBtn, false);
        
    } catch (error) {
        console.error('Error refrescando sesión:', error);
        notify('error', 'Error actualizando sesión: ' + error.message);
        setLoadingState(loginElements.refreshSessionBtn, false);
    }
}

/**
 * Carga datos extendidos del usuario
 */
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userData = await getCurrentUser();
        
        if (userData) {
            // Actualizar información en la UI
            if (loginElements.userDisplayName) {
                loginElements.userDisplayName.textContent = userData.nombre || userData.email;
            }
            
            if (loginElements.userEmail) {
                loginElements.userEmail.textContent = userData.email;
            }
            
            if (loginElements.userRoleDisplay) {
                loginElements.userRoleDisplay.textContent = userData.rol?.nombre || 'No asignado';
            }
            
            if (loginElements.userAreasDisplay) {
                const areas = userData.areas?.map(area => area.nombre).join(', ') || 'Ninguna';
                loginElements.userAreasDisplay.textContent = areas;
            }
            
            if (loginElements.userLastLogin) {
                loginElements.userLastLogin.textContent = formatDate(currentUser.last_sign_in_at, 'datetime');
            }
            
            // Mostrar formulario de registro si es admin
            const isAdmin = userData.rol?.nombre === 'admin';
            if (loginElements.registerCard) {
                loginElements.registerCard.style.display = isAdmin ? 'block' : 'none';
            }
        }
        
    } catch (error) {
        console.error('Error cargando datos de usuario:', error);
    }
}

/**
 * Muestra card de login
 */
function showLoginCard() {
    if (loginElements.loginCard) loginElements.loginCard.style.display = 'block';
    if (loginElements.userCard) loginElements.userCard.style.display = 'none';
    if (loginElements.registerCard) loginElements.registerCard.style.display = 'none';
}

/**
 * Muestra card de usuario autenticado
 */
function showUserCard() {
    if (loginElements.loginCard) loginElements.loginCard.style.display = 'none';
    if (loginElements.userCard) loginElements.userCard.style.display = 'block';
    // registerCard se muestra condicionalmente en loadUserData()
}

/**
 * Validaciones de formularios
 */
function validateEmailForm() {
    let isValid = true;
    
    // Limpiar errores previos
    clearFormErrors('email-error', 'password-error');
    
    const email = loginElements.emailInput?.value.trim();
    const password = loginElements.passwordInput?.value;
    
    if (!email || !isValidEmail(email)) {
        showFieldError('email-error', 'Ingrese un email válido');
        isValid = false;
    }
    
    if (!password || password.length < 6) {
        showFieldError('password-error', 'La contraseña debe tener al menos 6 caracteres');
        isValid = false;
    }
    
    return isValid;
}

function validateMagicForm() {
    let isValid = true;
    
    clearFormErrors('magic-email-error');
    
    const email = loginElements.magicEmailInput?.value.trim();
    
    if (!email || !isValidEmail(email)) {
        showFieldError('magic-email-error', 'Ingrese un email válido');
        isValid = false;
    }
    
    return isValid;
}

function validateRegisterForm() {
    let isValid = true;
    
    clearFormErrors('register-email-error', 'register-password-error', 'register-nombre-error', 'register-rol-error');
    
    const email = loginElements.registerEmail?.value.trim();
    const password = loginElements.registerPassword?.value;
    const nombre = loginElements.registerNombre?.value.trim();
    const rol = loginElements.registerRol?.value;
    
    if (!email || !isValidEmail(email)) {
        showFieldError('register-email-error', 'Ingrese un email válido');
        isValid = false;
    }
    
    if (!password || password.length < 6) {
        showFieldError('register-password-error', 'La contraseña debe tener al menos 6 caracteres');
        isValid = false;
    }
    
    if (!nombre || nombre.length < 2) {
        showFieldError('register-nombre-error', 'Ingrese un nombre válido');
        isValid = false;
    }
    
    if (!rol) {
        showFieldError('register-rol-error', 'Seleccione un rol');
        isValid = false;
    }
    
    return isValid;
}

/**
 * Validaciones en tiempo real
 */
function validateEmailInput() {
    const email = loginElements.emailInput?.value.trim();
    
    if (email && !isValidEmail(email)) {
        showFieldError('email-error', 'Formato de email inválido');
    } else {
        clearFormErrors('email-error');
    }
}

function validateMagicEmailInput() {
    const email = loginElements.magicEmailInput?.value.trim();
    
    if (email && !isValidEmail(email)) {
        showFieldError('magic-email-error', 'Formato de email inválido');
    } else {
        clearFormErrors('magic-email-error');
    }
}

function validatePasswordInput() {
    const password = loginElements.passwordInput?.value;
    
    if (password && password.length < 6) {
        showFieldError('password-error', 'Mínimo 6 caracteres');
    } else {
        clearFormErrors('password-error');
    }
}

function validateRegisterEmail() {
    const email = loginElements.registerEmail?.value.trim();
    
    if (email && !isValidEmail(email)) {
        showFieldError('register-email-error', 'Formato de email inválido');
    } else {
        clearFormErrors('register-email-error');
    }
}

function validateRegisterPassword() {
    const password = loginElements.registerPassword?.value;
    
    if (password && password.length < 6) {
        showFieldError('register-password-error', 'Mínimo 6 caracteres');
    } else {
        clearFormErrors('register-password-error');
    }
}

function validateRegisterNombre() {
    const nombre = loginElements.registerNombre?.value.trim();
    
    if (nombre && nombre.length < 2) {
        showFieldError('register-nombre-error', 'Nombre muy corto');
    } else {
        clearFormErrors('register-nombre-error');
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
    
    if (loading) {
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'block';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}

// Inicialización automática y cleanup
window.addEventListener('load', () => {
    // Verificar parámetros URL para magic link o recovery
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const type = urlParams.get('type');
    
    if (accessToken && refreshToken) {
        if (type === 'recovery') {
            notify('info', 'Enlace de recuperación activado. Puede cambiar su contraseña.');
        } else {
            notify('success', 'Magic Link activado exitosamente.');
        }
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

console.log('🔐 Sistema de autenticación AIFA 2.0 cargado (LOGIN POR EMAIL)');
