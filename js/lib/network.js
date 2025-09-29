// =====================================================
// GESTIÓN CENTRALIZADA DE SOLICITUDES Y RETRIES SEGUROS
// =====================================================
// Provee safeFetch con reintentos, timeouts y registro de AbortControllers
// para poder cancelar solicitudes desde el router o por pérdida de foco.
// =====================================================

import { DEBUG } from '../config.js';

let requestCounter = 0;
const inflightRequests = new Map();

function createRequestId(context = 'global') {
    requestCounter += 1;
    return `${context}:${Date.now()}:${requestCounter}`;
}

function linkSignals(externalSignal, controller) {
    if (!externalSignal) {
        return;
    }

    if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
        return;
    }

    const abortHandler = () => {
        const reason = externalSignal.reason || new DOMException('External abort', 'AbortError');
        controller.abort(reason);
    };

    externalSignal.addEventListener('abort', abortHandler, { once: true });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function safeFetch(url, options = {}, retries = 3, retryDelay = 400) {
    const { timeoutMs = 30000, signal } = options;

    const attempt = async (remaining, delay) => {
        let timeoutId = null;

        try {
            const controller = new AbortController();
            linkSignals(signal, controller);

            const finalOptions = {
                ...options,
                signal: controller.signal
            };

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
                    reject(new DOMException('Request timed out', 'TimeoutError'));
                }, timeoutMs);
            });

            const response = await Promise.race([
                fetch(url, finalOptions),
                timeoutPromise
            ]);

            if (!response) {
                throw new Error('Empty response');
            }

            return response;
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const isAbort = error?.name === 'AbortError' || error instanceof DOMException && error.name === 'AbortError';
            const isTimeout = error?.name === 'TimeoutError';

            if (isAbort) {
                if (DEBUG.enabled) {
                    console.warn('⏹️ Fetch abortado:', url, error?.message);
                }
                throw error;
            }

            if (isTimeout && DEBUG.enabled) {
                console.warn('⏳ Timeout en fetch:', url);
            }

            if (remaining <= 0) {
                throw error;
            }

            const jitter = Math.random() * 100;
            await wait(delay + jitter);
            return attempt(remaining - 1, delay * 1.5);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    };

    return attempt(retries, retryDelay);
}

export function registerRequest(context, controller, metadata = {}) {
    if (!controller) return null;
    const id = createRequestId(context);
    inflightRequests.set(id, { controller, context, metadata });
    return id;
}

export function releaseRequest(id) {
    if (!id) return;
    inflightRequests.delete(id);
}

export function abortRequestsByContext(context = null, reason = 'abort:manual') {
    const targets = [];

    inflightRequests.forEach((entry, id) => {
        if (!context || entry.context === context) {
            targets.push([id, entry]);
        }
    });

    targets.forEach(([id, entry]) => {
        try {
            entry.controller.abort(reason);
        } catch (error) {
            console.warn('⚠️ Error al abortar request:', error);
        } finally {
            inflightRequests.delete(id);
        }
    });

    if (DEBUG.enabled && targets.length > 0) {
        console.log(`⏹️ ${targets.length} request(s) canceladas (${context || 'todos'})`);
    }
}

export function createTrackedFetch({ context = 'global', defaultRetries = 3, timeoutMs = 30000 } = {}) {
    return async (url, options = {}) => {
        const controller = new AbortController();
        linkSignals(options.signal, controller);

        const requestId = registerRequest(context, controller, {
            url,
            method: options.method || 'GET'
        });

        try {
            const response = await safeFetch(url, {
                ...options,
                signal: controller.signal,
                timeoutMs
            }, options.retries ?? defaultRetries);

            return response;
        } finally {
            releaseRequest(requestId);
        }
    };
}

export function getInflightRequests() {
    return Array.from(inflightRequests.entries()).map(([id, entry]) => ({ id, ...entry }));
}
