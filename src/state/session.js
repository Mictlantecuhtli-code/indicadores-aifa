const SESSION_KEY = 'indicadores.session';

let currentUser = null;
let subscribers = new Set();

function notify() {
  for (const callback of subscribers) {
    callback(currentUser);
  }
}

export function getSession() {
  if (currentUser) return currentUser;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    currentUser = JSON.parse(raw);
    return currentUser;
  } catch (error) {
    console.warn('No se pudo leer la sesión almacenada', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
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
