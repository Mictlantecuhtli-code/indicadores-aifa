import { DEBUG } from '../../config.js';
import { appState, getCurrentSession, redirectToLogin } from '../../lib/supa.js';

const INTERVAL_KEYS = [
    'autoRefreshInterval',
    'homeRefreshInterval',
    'areaRefreshInterval',
    'visualizacionRefreshInterval',
    'tokenHealthCheckInterval'
];

let monitoringConfigured = false;

export function clearAppIntervals() {
    INTERVAL_KEYS.forEach(key => {
        const intervalId = window[key];
        if (intervalId) {
            clearInterval(intervalId);
            window[key] = null;
        }
    });
}

function saveLastActivity() {
    if (appState.session) {
        sessionStorage.setItem('aifa-last-activity', Date.now().toString());
    }
}

function handleBeforeUnload() {
    clearAppIntervals();
    saveLastActivity();
}

function handlePageHide() {
    clearAppIntervals();
}

async function handleStorageEvent(event) {
    if (event.storageArea !== localStorage) return;
    if (event.key !== 'supabase.auth.token') return;
    if (event.newValue || !appState.session) return;

    if (DEBUG?.enabled) {
        console.warn('⚠️ Sesión posiblemente cerrada en otra pestaña');
    }

    try {
        const session = await getCurrentSession({ allowRefresh: true, silent: true });
        if (session) {
            return;
        }
    } catch (error) {
        if (DEBUG?.enabled) {
            console.warn('⚠️ Error al confirmar cierre de sesión desde storage event:', error);
        }
    }

    appState.session = null;
    appState.user = null;
    appState.profile = null;

    redirectToLogin({
        message: 'Sesión cerrada en otra ventana',
        type: 'info'
    }, true);
}

export function initSessionMonitoring() {
    if (monitoringConfigured) {
        return;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('storage', handleStorageEvent);

    monitoringConfigured = true;
}
