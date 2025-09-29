// =====================================================
// CONTROL DE CICLO DE VIDA DE LA SPA
// =====================================================
// Escucha eventos emitidos por Supabase y el documento para cancelar
// navegaciones, rehidratar vistas y mantener el estado consistente
// cuando la pestaña cambia de visibilidad.
// =====================================================

import { DEBUG } from '../../config.js';
import { cancelActiveNavigation, reloadCurrentRoute } from '../../lib/router.js';
import { abortRequestsByContext } from '../../lib/network.js';
import { appStore } from '../../lib/supa.js';

let lifecycleInitialized = false;

function markHidden(detail) {
    appStore.setState(state => ({
        lifecycle: {
            ...state.lifecycle,
            lastHiddenAt: Date.now(),
            isRestoring: true
        }
    }));

    cancelActiveNavigation(detail?.reason || 'visibility:hidden');
    abortRequestsByContext(null, detail?.reason || 'visibility:hidden');

    if (DEBUG.enabled) {
        console.log('🔒 Aplicación pausada por pérdida de foco');
    }
}

async function markRestored(detail) {
    appStore.setState(state => ({
        lifecycle: {
            ...state.lifecycle,
            lastVisibleAt: Date.now(),
            isRestoring: false
        }
    }));

    if (detail?.sessionActive) {
        try {
            reloadCurrentRoute();
        } catch (error) {
            console.error('❌ Error al repintar vista activa tras rehidratación:', error);
        }
    }

    if (DEBUG.enabled) {
        console.log('🟢 Aplicación reactivada', detail);
    }
}

function handleSessionExpired(detail) {
    appStore.setState(state => ({
        lifecycle: {
            ...state.lifecycle,
            isRestoring: false
        }
    }));

    cancelActiveNavigation(detail?.reason || 'session:expired');
    abortRequestsByContext(null, detail?.reason || 'session:expired');

    if (DEBUG.enabled) {
        console.warn('⚠️ Sesión expirada durante inactividad', detail);
    }
}

export function initLifecycleModule() {
    if (lifecycleInitialized || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('app:visibility-hidden', (event) => {
        markHidden(event.detail || {});
    });

    window.addEventListener('app:visibility-restored', (event) => {
        markRestored(event.detail || {});
    });

    window.addEventListener('app:session-expired', (event) => {
        handleSessionExpired(event.detail || {});
    });

    lifecycleInitialized = true;

    if (DEBUG.enabled) {
        console.log('✅ Módulo de ciclo de vida inicializado');
    }
}
