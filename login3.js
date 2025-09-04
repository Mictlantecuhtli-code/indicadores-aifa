/**
 * login.js - Lógica de Autenticación
 * Sistema de Indicadores AIFA 2.0
 *
 * Maneja el proceso de login con usuario+contraseña
 * Utiliza RPC auth_email_by_username para obtener email del username
 */

// Variables globales
let isLoading = false;

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  initializeLoginForm();
  setupEventListeners();
});

/**
 * Inicializar el formulario de login
 */
function initializeLoginForm() {
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Enfocar el campo de usuario al cargar
  usernameInput.focus();

  // Limpiar campos si hay datos previos
  usernameInput.value = '';
  passwordInput.value = '';

  // Resetear estado visual
  resetLoginButton();
  hideMessage();
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
  // Formulario de login
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', handleLogin);

  // Toggle de contraseña
  const togglePassword = document.getElementById('togglePassword');
  togglePassword.addEventListener('click', togglePasswordVisibility);

  // Enter en campos de input
  document.getElementById('username').addEventListener('keypress', handleKeyPress);
  document.getElementById('password').addEventListener('keypress', handleKeyPress);

  // Validación en tiempo real
  document.getElementById('username').addEventListener('input', validateForm);
  document.getElementById('password').addEventListener('input', validateForm);
}

/**
 * Manejar envío del formulario de login
 */
async function handleLogin(event) {
  event.preventDefault();
  if (isLoading) return;

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  // Validaciones básicas
  if (!validateLoginForm(username, password)) {
    return;
  }

  try {
    setLoadingState(true);
    hideMessage();

    // Paso 1: Obtener email del username usando RPC
    const email = await getEmailFromUsername(username);
    if (!email) {
      showMessage('Usuario no encontrado. Verifique su nombre de usuario.', 'error');
      return;
    }

    // Paso 2: Autenticarse con Supabase usando email y contraseña
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      handleAuthError(error);
      return;
    }

    // Paso 3: Verificar que el usuario esté activo
    const userActive = await checkUserActiveStatus(data.user.email);
    if (!userActive) {
      await supabase.auth.signOut();
      showMessage('Su cuenta está desactivada. Contacte al administrador.', 'error');
      return;
    }

    // Login exitoso
    showMessage('Inicio de sesión exitoso. Redirigiendo...', 'success');
    // Redirigir al dashboard después de un breve delay
    setTimeout(() => {
      location.href = './index.html';
    }, 1500);

  } catch (error) {
    console.error('Error en login:', error);
    showMessage('Error interno del sistema. Intente nuevamente.', 'error');
  } finally {
    setLoadingState(false);
  }
}

/**
 * Obtener email del username usando RPC
 */
async function getEmailFromUsername(username) {
  try {
    const { data, error } = await supabase.rpc('auth_email_by_username', { p_username: username });
    if (error) {
      console.error('Error en RPC auth_email_by_username:', error);
      return null;
    }

    // Normalizar la salida para siempre devolver un string
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      const first = data[0];
      if (typeof first === 'string') return first;
      if (first && typeof first.email === 'string') return first.email;
      if (first && typeof first.auth_email === 'string') return first.auth_email;
      return null;
    }

    if (data && typeof data.email === 'string') {
      return data.email;
    }
    if (data && typeof data.auth_email === 'string') {
      return data.auth_email;
    }

    return null;
  } catch (error) {
    console.error('Error obteniendo email del username:', error);
    return null;
  }
}

/**
 * Verificar estado activo del usuario
 */
async function checkUserActiveStatus(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('activo')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error verificando estado del usuario:', error);
      return false;
    }
    return data?.activo === true;
  } catch (error) {
    console.error('Error en checkUserActiveStatus:', error);
    return false;
  }
}

/**
 * Validar formulario de login
 */
function validateLoginForm(username, password) {
  if (!username) {
    showMessage('Por favor ingrese su nombre de usuario.', 'error');
    document.getElementById('username').focus();
    return false;
  }
  if (username.length < 3) {
    showMessage('El nombre de usuario debe tener al menos 3 caracteres.', 'error');
    document.getElementById('username').focus();
    return false;
  }
  if (!password) {
    showMessage('Por favor ingrese su contraseña.', 'error');
    document.getElementById('password').focus();
    return false;
  }
  if (password.length < 6) {
    showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
    document.getElementById('password').focus();
    return false;
  }
  return true;
}

/**
 * Manejar errores de autenticación
 */
function handleAuthError(error) {
  console.error('Error de autenticación:', error);
  let message = 'Error al iniciar sesión. ';
  switch (error.message) {
    case 'Invalid login credentials':
    case 'Email not confirmed':
      message += 'Usuario o contraseña incorrectos.';
      break;
    case 'Too many requests':
      message += 'Demasiados intentos. Espere unos minutos antes de intentar nuevamente.';
      break;
    case 'User not found':
      message += 'Usuario no encontrado.';
      break;
    default:
      message += 'Verifique sus credenciales e intente nuevamente.';
  }
  showMessage(message, 'error');
}

/**
 * Establecer estado de carga
 */
function setLoadingState(loading) {
  isLoading = loading;
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const form = document.getElementById('loginForm');

  if (loading) {
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    loginBtnText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';
    form.classList.add('form-loading');
  } else {
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    loginBtnText.style.display = 'inline';
    loginSpinner.style.display = 'none';
    form.classList.remove('form-loading');
  }
}

/**
 * Resetear botón de login
 */
function resetLoginButton() {
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');

  loginBtn.disabled = false;
  loginBtn.classList.remove('loading');
  loginBtnText.style.display = 'inline';
  loginSpinner.style.display = 'none';

  isLoading = false;
}

/**
 * Mostrar/ocultar contraseña
 */
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('togglePasswordIcon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.classList.remove('fa-eye');
    toggleIcon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    toggleIcon.classList.remove('fa-eye-slash');
    toggleIcon.classList.add('fa-eye');
  }
}

/**
 * Manejar tecla Enter en inputs
 */
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (event.target.id === 'username') {
      // Si está en username, pasar al password
      document.getElementById('password').focus();
    } else if (event.target.id === 'password') {
      // Si está en password, hacer submit
      document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    }
  }
}

/**
 * Validar formulario en tiempo real
 */
function validateForm() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');

  // Habilitar/deshabilitar botón según validez de campos
  if (username.length >= 3 && password.length >= 6) {
    loginBtn.classList.remove('btn-disabled');
  } else {
    loginBtn.classList.add('btn-disabled');
  }
}

/**
 * Mostrar mensaje al usuario
 */
function showMessage(message, type = 'info') {
  const messageDiv = document.getElementById('loginMessage');
  messageDiv.textContent = message;
  messageDiv.className = `login-message ${type}`;
  messageDiv.style.display = 'block';

  // Auto-scroll al mensaje si está fuera de vista
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Ocultar mensaje
 */
function hideMessage() {
  const messageDiv = document.getElementById('loginMessage');
  messageDiv.style.display = 'none';
  messageDiv.textContent = '';
  messageDiv.className = 'login-message';
}

/**
 * Limpiar formulario
 */
function clearForm() {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  hideMessage();
  resetLoginButton();

  // Resetear tipo de password por si estaba visible
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('togglePasswordIcon');
  passwordInput.type = 'password';
  toggleIcon.classList.remove('fa-eye-slash');
  toggleIcon.classList.add('fa-eye');
}

/**
 * Función de utilidad para debugging (solo en desarrollo)
 */
function debugLogin(username, email) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Debug Login Info:', { username: username, email: email, timestamp: new Date().toISOString() });
  }
}

/**
 * Manejar estado offline/online
 */
window.addEventListener('online', () => {
  hideMessage();
  showMessage('Conexión restaurada. Puede intentar iniciar sesión.', 'success');
  setTimeout(hideMessage, 3000);
});

window.addEventListener('offline', () => {
  showMessage('Sin conexión a internet. Verifique su conexión.', 'error');
});

/**
 * Manejar errores globales no capturados
 */
window.addEventListener('error', (event) => {
  console.error('Error global capturado:', event.error);
  if (isLoading) {
    setLoadingState(false);
    showMessage('Error inesperado. Por favor recargue la página e intente nuevamente.', 'error');
  }
});

/**
 * Manejar promesas rechazadas no capturadas
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rechazada no capturada:', event.reason);
  if (isLoading) {
    setLoadingState(false);
    showMessage('Error de conexión. Verifique su conexión e intente nuevamente.', 'error');
  }
});

/**
 * Limpiar recursos al descargar la página
 */
window.addEventListener('beforeunload', () => {
  clearForm();
});

/**
 * Función para pruebas automatizadas (solo desarrollo)
 */
window.testLogin = async function(username, password) {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('testLogin solo disponible en desarrollo');
    return;
  }
  document.getElementById('username').value = username;
  document.getElementById('password').value = password;
  const form = document.getElementById('loginForm');
  form.dispatchEvent(new Event('submit'));
};

/**
 * Validar configuración de Supabase al cargar
 */
(function validateSupabaseConfig() {
  if (!window.supabase) {
    console.error('Supabase no está cargado correctamente');
    showMessage('Error de configuración del sistema. Contacte al administrador.', 'error');
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Configuración de Supabase incompleta');
    showMessage('Error de configuración del sistema. Contacte al administrador.', 'error');
    return;
  }
})();

// Exportar funciones para testing si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateLoginForm, getEmailFromUsername, checkUserActiveStatus, handleAuthError };
}
