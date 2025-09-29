import * as ui from '../../lib/ui.js';

let handlersRegistered = false;

function handleGlobalError(event) {
    console.error('❌ Error global capturado:', event.error);
    ui.showToast?.('Ha ocurrido un error inesperado', 'error');
}

function handleUnhandledRejection(event) {
    console.error('❌ Promise rechazada:', event.reason);
    ui.showToast?.('Error de conexión o procesamiento', 'error');
}

export function initGlobalErrorHandlers() {
    if (handlersRegistered) {
        return;
    }

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    handlersRegistered = true;
}
