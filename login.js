/**
 * login.js - Lógica de Autenticación (corrigido)
 * - Reusa window.supabase (ya inicializado en tu app)
 * - Acepta "usuario" o "correo"
 * - Si es usuario, resuelve email con RPC auth_email_by_username
 * - Corrige el error "cannot unmarshal array..." garantizando strings
 * - Verifica 'activo' en public.users
 */

let supabase;
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  // Usa el cliente YA creado por tu app
  supabase = window.supabase;

  initializeLoginForm();
  setupEventListeners();
  validateSupabaseConfig();
});

/* ============== Boot / UI ============== */
function initializeLoginForm() {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  usernameInput?.focus();
  if (usernameInput) usernameInput.value = "";
  if (passwordInput) passwordInput.value = "";

  resetLoginButton();
  hideMessage();
}

function setupEventListeners() {
  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", handleLogin);

  const togglePassword = document.getElementById("togglePassword");
  togglePassword?.addEventListener("click", togglePasswordVisibility);

  document.getElementById("username")?.addEventListener("keypress", handleKeyPress);
  document.getElementById("password")?.addEventListener("keypress", handleKeyPress);

  document.getElementById("username")?.addEventListener("input", validateForm);
  document.getElementById("password")?.addEventListener("input", validateForm);
}

/* ============== Handler principal ============== */
async function handleLogin(event) {
  event.preventDefault();
  if (isLoading) return;

  const usernameOrEmail = (document.getElementById("username")?.value || "").trim();
  let password = document.getElementById("password")?.value;

  if (!validateLoginForm(usernameOrEmail, password)) return;

  try {
    setLoadingState(true);
    hideMessage();

    // 1) Si ya viene correo, úsalo; si no, resolver por RPC
    let emailStr = "";
    if (usernameOrEmail.includes("@")) {
      emailStr = usernameOrEmail;
    } else {
      emailStr = await getEmailFromUsername(usernameOrEmail);
      if (!emailStr) {
        showMessage("Usuario no encontrado. Verifique su nombre de usuario.", "error");
        return;
      }
    }

    // 2) Autenticación (FORZAR STRING evita el 400 "unmarshal array")
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(emailStr).trim(),
      password: String(password)
    });

    if (error) {
      handleAuthError(error);
      return;
    }

    // 3) Validar 'activo' en public.users
    const emailForCheck = data?.user?.email || emailStr;
    const userActive = await checkUserActiveStatus(emailForCheck);
    if (!userActive) {
      await supabase.auth.signOut();
      showMessage("Su cuenta está desactivada. Contacte al administrador.", "error");
      return;
    }

    // 4) OK → redirigir
    showMessage("Inicio de sesión exitoso. Redirigiendo…", "success");
    setTimeout(() => (location.href = "./index.html"), 1200);
  } catch (err) {
    console.error("Error en login:", err);
    showMessage("Error interno del sistema. Intente nuevamente.", "error");
  } finally {
    setLoadingState(false);
  }
}

/* ============== RPC username -> email (robusto) ============== */
async function getEmailFromUsername(username) {
  try {
    const { data, error } = await supabase.rpc("auth_email_by_username", {
      p_username: String(username)
    });
    if (error) {
      console.error("Error en RPC auth_email_by_username:", error);
      return null;
    }

    // data puede ser: [{ email:"..." }]  |  "..."  |  { email:"..." }
    if (Array.isArray(data)) return data[0]?.email ?? null;
    if (data && typeof data === "object" && "email" in data) return data.email;
    if (typeof data === "string") return data;
    return null;
  } catch (e) {
    console.error("Error obteniendo email del username:", e);
    return null;
  }
}

/* ============== Verificar 'activo' en public.users ============== */
async function checkUserActiveStatus(email) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("activo")
      .eq("email", String(email))
      .single();

    if (error) {
      console.error("Error verificando estado del usuario:", error);
      return false;
    }
    return data?.activo === true;
  } catch (e) {
    console.error("Error en checkUserActiveStatus:", e);
    return false;
  }
}

/* ============== Validaciones / UX ============== */
function validateLoginForm(username, password) {
  if (!username) {
    showMessage("Por favor ingrese su nombre de usuario o correo.", "error");
    document.getElementById("username")?.focus();
    return false;
  }
  if (username.length < 3 && !username.includes("@")) {
    showMessage("El nombre de usuario debe tener al menos 3 caracteres.", "error");
    document.getElementById("username")?.focus();
    return false;
  }
  if (!password) {
    showMessage("Por favor ingrese su contraseña.", "error");
    document.getElementById("password")?.focus();
    return false;
  }
  if (password.length < 6) {
    showMessage("La contraseña debe tener al menos 6 caracteres.", "error");
    document.getElementById("password")?.focus();
    return false;
  }
  return true;
}

function handleAuthError(error) {
  console.error("Error de autenticación:", error);
  let message = "Error al iniciar sesión. ";

  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid_grant")) {
    message += "Usuario o contraseña incorrectos.";
  } else if (msg.includes("email not confirmed")) {
    message += "Email no confirmado. Revise su correo.";
  } else if (msg.includes("too many requests")) {
    message += "Demasiados intentos. Espere unos minutos y reintente.";
  } else {
    message += "Verifique sus credenciales e intente nuevamente.";
  }
  showMessage(message, "error");
}

function setLoadingState(loading) {
  isLoading = loading;
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnText = document.getElementById("loginBtnText");
  const loginSpinner = document.getElementById("loginSpinner");
  const form = document.getElementById("loginForm");

  if (loading) {
    loginBtn && (loginBtn.disabled = true);
    loginBtn?.classList.add("loading");
    if (loginBtnText) loginBtnText.style.display = "none";
    if (loginSpinner) loginSpinner.style.display = "inline-block";
    form?.classList.add("form-loading");
  } else {
    loginBtn && (loginBtn.disabled = false);
    loginBtn?.classList.remove("loading");
    if (loginBtnText) loginBtnText.style.display = "inline";
    if (loginSpinner) loginSpinner.style.display = "none";
    form?.classList.remove("form-loading");
  }
}

function resetLoginButton() {
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnText = document.getElementById("loginBtnText");
  const loginSpinner = document.getElementById("loginSpinner");

  loginBtn && (loginBtn.disabled = false);
  loginBtn?.classList.remove("loading");
  if (loginBtnText) loginBtnText.style.display = "inline";
  if (loginSpinner) loginSpinner.style.display = "none";
  isLoading = false;
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById("password");
  const toggleIcon = document.getElementById("togglePasswordIcon");

  if (!passwordInput) return;
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleIcon?.classList.remove("fa-eye");
    toggleIcon?.classList.add("fa-eye-slash");
  } else {
    passwordInput.type = "password";
    toggleIcon?.classList.remove("fa-eye-slash");
    toggleIcon?.classList.add("fa-eye");
  }
}

function handleKeyPress(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (event.target.id === "username") {
      document.getElementById("password")?.focus();
    } else if (event.target.id === "password") {
      document.getElementById("loginForm")?.dispatchEvent(new Event("submit"));
    }
  }
}

function validateForm() {
  const username = (document.getElementById("username")?.value || "").trim();
  const password = document.getElementById("password")?.value || "";
  const loginBtn = document.getElementById("loginBtn");

  if ((username.includes("@") || username.length >= 3) && password.length >= 6) {
    loginBtn?.classList.remove("btn-disabled");
  } else {
    loginBtn?.classList.add("btn-disabled");
  }
}

function showMessage(message, type = "info") {
  const messageDiv = document.getElementById("loginMessage");
  if (!messageDiv) return;

  messageDiv.textContent = message;
  messageDiv.className = `login-message ${type}`;
  messageDiv.style.display = "block";
  messageDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideMessage() {
  const messageDiv = document.getElementById("loginMessage");
  if (!messageDiv) return;

  messageDiv.style.display = "none";
  messageDiv.textContent = "";
  messageDiv.className = "login-message";
}

function clearForm() {
  const u = document.getElementById("username");
  const p = document.getElementById("password");
  u && (u.value = "");
  p && (p.value = "");
  hideMessage();
  resetLoginButton();

  const toggleIcon = document.getElementById("togglePasswordIcon");
  if (p) p.type = "password";
  toggleIcon?.classList.remove("fa-eye-slash");
  toggleIcon?.classList.add("fa-eye");
}

/* ============== Config guard ============== */
function validateSupabaseConfig() {
  if (typeof window.supabase === "undefined" || !window.supabase) {
    console.error("Supabase no está inicializado (window.supabase es undefined).");
    showMessage("Error de configuración del sistema. Contacte al administrador.", "error");
  }
  // NOTA: No uso SUPABASE_URL / SUPABASE_ANON_KEY aquí para evitar colisiones.
}
