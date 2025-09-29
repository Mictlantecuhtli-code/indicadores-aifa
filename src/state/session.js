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

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
