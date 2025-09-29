import { DEBUG } from '../../config.js';

let swRegistered = false;

export function registerServiceWorker() {
    if (swRegistered || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            swRegistered = true;
            if (DEBUG.enabled) {
                console.log('✅ Service worker registrado', registration.scope);
            }
        }).catch(error => {
            if (DEBUG.enabled) {
                console.warn('⚠️ No se pudo registrar el service worker:', error);
            }
        });
    });
}
