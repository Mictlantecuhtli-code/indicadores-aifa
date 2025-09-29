// =====================================================
// SISTEMA GLOBAL DE CACHE EN MEMORIA
// Gestiona caché en memoria con soporte para TTL, etiquetas y
// revalidación para toda la aplicación.
// =====================================================

const DEFAULT_TTL = 60 * 1000; // 1 minuto por defecto

const cacheStore = new Map();
const inFlightRequests = new Map();
const tagIndex = new Map();

function now() {
    return Date.now();
}

function toKey(rawKey) {
    if (typeof rawKey === 'string') {
        return rawKey;
    }

    try {
        return JSON.stringify(rawKey, (_, value) => {
            if (value instanceof Map) {
                return Array.from(value.entries());
            }
            if (value instanceof Set) {
                return Array.from(value.values());
            }
            if (typeof value === 'object' && value !== null) {
                return Object.keys(value)
                    .sort()
                    .reduce((acc, key) => {
                        acc[key] = value[key];
                        return acc;
                    }, {});
            }
            return value;
        });
    } catch (error) {
        console.warn('⚠️ No se pudo serializar la llave de caché, usando fallback:', error);
        return String(rawKey);
    }
}

function removeKey(key) {
    const entry = cacheStore.get(key);
    cacheStore.delete(key);

    if (!entry?.tags) {
        return;
    }

    entry.tags.forEach(tag => {
        const keysForTag = tagIndex.get(tag);
        if (!keysForTag) return;

        keysForTag.delete(key);
        if (keysForTag.size === 0) {
            tagIndex.delete(tag);
        }
    });
}

function registerTags(key, tags) {
    if (!tags || tags.length === 0) {
        return;
    }

    tags.forEach(tag => {
        if (!tag) return;
        if (!tagIndex.has(tag)) {
            tagIndex.set(tag, new Set());
        }
        tagIndex.get(tag).add(key);
    });
}

function setCacheEntry(key, value, ttl, tags) {
    const expires = now() + ttl;
    const entry = { value, expires, tags: tags ? Array.from(new Set(tags)) : [] };
    cacheStore.set(key, entry);
    registerTags(key, entry.tags);
    return entry.value;
}

function isExpired(entry) {
    return !entry || entry.expires <= now();
}

export function getCache(key) {
    const cacheKey = toKey(key);
    const entry = cacheStore.get(cacheKey);

    if (!entry) {
        return { hit: false, value: undefined };
    }

    if (isExpired(entry)) {
        removeKey(cacheKey);
        return { hit: false, value: undefined };
    }

    return { hit: true, value: entry.value };
}

export function setCache(key, value, { ttl = DEFAULT_TTL, tags = [] } = {}) {
    if (ttl <= 0) {
        return value;
    }

    const cacheKey = toKey(key);
    return setCacheEntry(cacheKey, value, ttl, tags);
}

export function hasCache(key) {
    const cacheKey = toKey(key);
    return cacheStore.has(cacheKey);
}

export function invalidateCache(key) {
    const cacheKey = toKey(key);
    removeKey(cacheKey);
}

export function invalidateByTags(tags = []) {
    const uniqueTags = Array.from(new Set(tags.filter(Boolean)));

    uniqueTags.forEach(tag => {
        const keysForTag = tagIndex.get(tag);
        if (!keysForTag) return;

        keysForTag.forEach(key => {
            cacheStore.delete(key);
        });

        tagIndex.delete(tag);
    });
}

export function clearCache() {
    cacheStore.clear();
    inFlightRequests.clear();
    tagIndex.clear();
}

function scheduleBackgroundRefresh(key, fetcher, options) {
    if (inFlightRequests.has(key)) {
        return;
    }

    const promise = fetcher()
        .then(result => {
            setCacheEntry(key, result, options.ttl, options.tags);
            return result;
        })
        .catch(error => {
            if (options?.onError) {
                options.onError(error);
            }
            return undefined;
        })
        .finally(() => {
            inFlightRequests.delete(key);
        });

    inFlightRequests.set(key, promise);
}

export async function withCache(key, fetcher, options = {}) {
    const {
        ttl = DEFAULT_TTL,
        tags = [],
        forceRefresh = false,
        staleWhileRevalidate = 0,
        onError = null
    } = options;

    const cacheKey = toKey(key);

    if (forceRefresh || ttl <= 0) {
        const result = await fetcher();
        if (ttl > 0) {
            setCacheEntry(cacheKey, result, ttl, tags);
        }
        return result;
    }

    const entry = cacheStore.get(cacheKey);

    if (entry && !isExpired(entry)) {
        return entry.value;
    }

    if (entry && staleWhileRevalidate > 0) {
        const maxStale = entry.expires + staleWhileRevalidate;
        if (maxStale > now()) {
            scheduleBackgroundRefresh(cacheKey, fetcher, { ttl, tags, onError });
            return entry.value;
        }
    }

    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey);
    }

    const promise = Promise.resolve()
        .then(() => fetcher())
        .then(result => {
            setCacheEntry(cacheKey, result, ttl, tags);
            return result;
        })
        .catch(error => {
            if (onError) {
                onError(error);
            }
            throw error;
        })
        .finally(() => {
            inFlightRequests.delete(cacheKey);
        });

    inFlightRequests.set(cacheKey, promise);
    return promise;
}

export function getCacheSnapshot() {
    const snapshot = [];
    cacheStore.forEach((value, key) => {
        snapshot.push({
            key,
            expiresIn: value.expires - now(),
            tags: value.tags || []
        });
    });
    return snapshot;
}
