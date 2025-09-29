// =====================================================
// ESTADO CENTRALIZADO REACTIVO CON PERSISTENCIA SEGURA
// =====================================================
// Este store ligero provee un estado compartido para toda la SPA,
// soporta suscriptores, persistencia en sessionStorage y control de
// rehidratación siguiendo lineamientos OWASP/NIST (no se guardan
// secretos, solo metadatos necesarios para UI).
// =====================================================

const DEFAULT_OPTIONS = {
    key: null,
    storage: null,
    version: 1,
    sanitize: null
};

function safeClone(value) {
    try {
        return structuredClone(value);
    } catch (_) {
        return JSON.parse(JSON.stringify(value));
    }
}

function createPersistor(options, getState) {
    const { key, storage, version, sanitize } = options;

    if (!key || !storage) {
        return { persist: () => {}, clear: () => {} };
    }

    const persist = () => {
        try {
            const rawState = getState();
            const snapshot = sanitize ? sanitize(rawState) : rawState;
            const payload = {
                v: version,
                ts: Date.now(),
                state: snapshot
            };
            storage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('⚠️ No se pudo persistir el estado en storage:', error);
        }
    };

    const clear = () => {
        try {
            storage.removeItem(key);
        } catch (error) {
            console.warn('⚠️ No se pudo limpiar el estado persistido:', error);
        }
    };

    return { persist, clear };
}

function readPersistedState(options) {
    const { key, storage, version } = options;

    if (!key || !storage) {
        return null;
    }

    try {
        const raw = storage.getItem(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== version) {
            storage.removeItem(key);
            return null;
        }

        return parsed.state || null;
    } catch (error) {
        console.warn('⚠️ No se pudo leer el estado persistido:', error);
        return null;
    }
}

function createDeepProxy(target, notify) {
    const proxyCache = new WeakMap();

    const wrap = (value) => {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (proxyCache.has(value)) {
            return proxyCache.get(value);
        }

        const proxy = new Proxy(value, {
            get(obj, prop) {
                if (prop === '__raw__') {
                    return obj;
                }
                return wrap(obj[prop]);
            },
            set(obj, prop, newValue) {
                const current = obj[prop];
                if (current === newValue) {
                    return true;
                }
                obj[prop] = newValue;
                notify();
                return true;
            },
            deleteProperty(obj, prop) {
                if (prop in obj) {
                    delete obj[prop];
                    notify();
                }
                return true;
            }
        });

        proxyCache.set(value, proxy);
        return proxy;
    };

    return wrap(target);
}

export function createStore(config = {}) {
    const options = { ...DEFAULT_OPTIONS, ...config };
    const listeners = new Set();
    const { key, storage, version } = options;

    const baseState = options.initialState ? safeClone(options.initialState) : {};
    const persisted = readPersistedState({ key, storage, version });

    if (persisted && typeof persisted === 'object') {
        Object.assign(baseState, persisted);
    }

    let isNotifying = false;

    const notify = () => {
        if (isNotifying) return;
        isNotifying = true;
        try {
            persistor.persist();
            listeners.forEach(listener => {
                try {
                    listener(proxyState);
                } catch (error) {
                    console.error('⚠️ Error en listener de store:', error);
                }
            });
        } finally {
            isNotifying = false;
        }
    };

    const proxyState = createDeepProxy(baseState, notify);
    const persistor = createPersistor(options, () => proxyState);

    const setState = (updater, { replace = false, silent = false } = {}) => {
        const currentState = proxyState;
        const nextState = typeof updater === 'function' ? updater(currentState) : updater;

        if (!nextState || typeof nextState !== 'object') {
            return;
        }

        if (replace) {
            Object.keys(currentState).forEach(key => {
                delete currentState[key];
            });
            Object.assign(currentState, nextState);
        } else {
            Object.assign(currentState, nextState);
        }

        if (!silent) {
            notify();
        } else {
            persistor.persist();
        }
    };

    const reset = ({ silent = false } = {}) => {
        const initial = options.initialState ? safeClone(options.initialState) : {};
        Object.keys(proxyState).forEach(key => {
            delete proxyState[key];
        });
        Object.assign(proxyState, initial);
        if (silent) {
            persistor.persist();
        } else {
            notify();
        }
    };

    const subscribe = (listener) => {
        if (typeof listener !== 'function') {
            return () => {};
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return {
        state: proxyState,
        getState: () => proxyState,
        setState,
        reset,
        subscribe,
        persist: persistor.persist,
        clear: persistor.clear
    };
}

export const memoryStore = (initialState = {}) =>
    createStore({ initialState, storage: null, key: null });
