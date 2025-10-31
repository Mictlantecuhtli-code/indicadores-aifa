const SESSION_KEY = 'indicadores.session';
const SESSION_DURATION_MS = 30 * 60 * 1000;

let currentUser = null;
let subscribers = new Set();
let expirationTimeoutId = null;

function notify() {
  for (const callback of subscribers) {
    callback(currentUser);
  }
}

function dispatchSessionExpiredEvent() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('session-expired'));
  }
}

function clearSessionTimeout() {
  if (expirationTimeoutId) {
    clearTimeout(expirationTimeoutId);
    expirationTimeoutId = null;
  }
}

function scheduleSessionTimeout(expiresAt) {
  clearSessionTimeout();
  if (!Number.isFinite(expiresAt)) {
    return;
  }

  const delay = Math.max(expiresAt - Date.now(), 0);

  if (delay <= 0) {
    dispatchSessionExpiredEvent();
    setSession(null);
    return;
  }

  expirationTimeoutId = setTimeout(() => {
    dispatchSessionExpiredEvent();
    setSession(null);
  }, delay);
}

function persistSession(user, expiresAt) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  const payload = {
    user,
    expiresAt
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function restorePersistedSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && 'user' in parsed) {
      return {
        user: parsed.user,
        expiresAt: parsed.expiresAt
      };
    }

    // Formato anterior: se almacenaba directamente el usuario sin metadatos.
    return {
      user: parsed,
      expiresAt: null
    };
  } catch (error) {
    console.warn('No se pudo leer la sesión almacenada', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getSession() {
  if (currentUser) return currentUser;

  const restored = restorePersistedSession();
  if (!restored) return null;

  const { user, expiresAt } = restored;
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  const normalizedExpiresAt = Number(expiresAt);

  if (Number.isFinite(normalizedExpiresAt)) {
    if (Date.now() >= normalizedExpiresAt) {
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
      dispatchSessionExpiredEvent();
      setTimeout(() => notify(), 0);
      return null;
    }

    currentUser = user;
    scheduleSessionTimeout(normalizedExpiresAt);
    return currentUser;
  }

  // Migrar sesiones antiguas que no tenían fecha de expiración definida.
  const newExpiresAt = Date.now() + SESSION_DURATION_MS;
  currentUser = user;
  persistSession(currentUser, newExpiresAt);
  scheduleSessionTimeout(newExpiresAt);
  return currentUser;
}

export function setSession(user) {
  currentUser = user ?? null;

  if (user) {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    persistSession(user, expiresAt);
    scheduleSessionTimeout(expiresAt);
  } else {
    persistSession(null, null);
    clearSessionTimeout();
  }

  notify();
}

// Función para obtener el rol del usuario actual
export function getUserRole() {
  const session = getSession();
  return session?.perfil?.rol_principal || null;
}

// Función para verificar si el usuario tiene un rol específico
export function hasRole(role) {
  const userRole = getUserRole();
  return userRole === role;
}

// Función para verificar si es director
export function isDirector() {
  return hasRole('DIRECTOR');
}

// Función para verificar si es subdirector
export function isSubdirector() {
  return hasRole('SUBDIRECTOR');
}

// Función para verificar si es admin
export function isAdmin() {
  return hasRole('ADMIN');
}

// Función para verificar si es capturista
export function isCapturista() {
  return hasRole('CAPTURISTA');
}

// Función para obtener permisos del usuario
export function getUserPermissions() {
  const session = getSession();
  return session?.permisos || {
    puede_capturar: false,
    puede_editar: false,
    puede_eliminar: false
  };
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
