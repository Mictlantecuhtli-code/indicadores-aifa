// =====================================================
// HERRAMIENTAS ASÍNCRONAS PARA VISTAS CON CANCELACIÓN
// =====================================================
// Facilita ejecutar promesas respetando AbortSignal, detectar
// errores de cancelación y registrar tareas de limpieza comunes
// entre las vistas de la SPA.
// =====================================================

export function isAbortError(error) {
    if (!error) {
        return false;
    }

    if (error.name === 'AbortError') {
        return true;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }

    const reason = typeof error === 'string'
        ? error
        : typeof error?.reason === 'string'
            ? error.reason
            : '';

    const message = typeof error?.message === 'string' ? error.message : '';
    const combined = `${reason} ${message}`.toLowerCase();

    return combined.includes('navigation:')
        || combined.includes('visibility:')
        || combined.includes('abort');
}

export function throwIfAborted(signal, message = 'Operation aborted') {
    if (!signal) {
        return;
    }

    if (signal.aborted) {
        const reason = signal.reason || new DOMException(message, 'AbortError');
        throw reason instanceof Error ? reason : new DOMException(String(reason), 'AbortError');
    }
}

export function withAbortSignal(promise, signal, message = 'Operation aborted') {
    if (!signal) {
        return Promise.resolve(promise);
    }

    if (signal.aborted) {
        const reason = signal.reason || new DOMException(message, 'AbortError');
        return Promise.reject(reason);
    }

    return new Promise((resolve, reject) => {
        const abortHandler = () => {
            signal.removeEventListener('abort', abortHandler);
            reject(signal.reason || new DOMException(message, 'AbortError'));
        };

        signal.addEventListener('abort', abortHandler, { once: true });

        Promise.resolve(promise)
            .then(value => {
                signal.removeEventListener('abort', abortHandler);
                resolve(value);
            })
            .catch(error => {
                signal.removeEventListener('abort', abortHandler);
                reject(error);
            });
    });
}

export function createCleanupBag() {
    const cleanups = new Set();

    return {
        register(fn) {
            if (typeof fn === 'function') {
                cleanups.add(fn);
            }
        },
        run() {
            cleanups.forEach(fn => {
                try {
                    fn();
                } catch (error) {
                    console.warn('⚠️ Error al ejecutar cleanup:', error);
                }
            });
            cleanups.clear();
        }
    };
}
