// =====================================================
// SISTEMA DE ENRUTAMIENTO HASH-BASED
// Gestiona navegación entre vistas con carga diferida.
// =====================================================

import { DEBUG } from '../config.js';
import { appState, isAuthenticated } from './supa.js';
import { showToast, showLoading, hideLoading, resetLoadingState } from './ui.js';
import { renderTemplate } from '../core/dom.js';

export const routerState = {
    currentRoute: null,
    currentParams: {},
    currentQuery: {},
    currentDefinition: null,
    history: [],
    isNavigating: false,
    initialized: false
};

let routeDefinitions = [];
let activeViewModule = null;
let teardownActiveView = null;
let navigationTimeout = null;
let activeNavigationController = null;
let activeNavigationId = 0;

function beginNavigation() {
    if (activeNavigationController) {
        activeNavigationController.abort('navigation:replaced');
    }

    activeNavigationController = new AbortController();
    activeNavigationId += 1;

    return {
        controller: activeNavigationController,
        id: activeNavigationId
    };
}

function isActiveNavigation(id) {
    return id === activeNavigationId;
}

function finalizeNavigation(controller, id) {
    if (controller && controller === activeNavigationController && id === activeNavigationId) {
        activeNavigationController = null;
    }
}

export function cancelActiveNavigation(reason = 'navigation:cancelled') {
    if (activeNavigationController) {
        activeNavigationController.abort(reason);
        activeNavigationController = null;
    }
}

// =====================================================
// CONFIGURACIÓN
// =====================================================

export function configureRoutes(routes = []) {
    routeDefinitions = Array.isArray(routes) ? routes : [];
}

// =====================================================
// PARSEO DE HASH
// =====================================================

export function parseCurrentRoute() {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    const [path, queryString] = hash.split('?');

    const params = {};
    const query = {};

    if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams.entries()) {
            query[key] = value;
        }
    }

    return {
        path,
        params,
        query,
        fullPath: hash
    };
}

function resolveDefinition(path) {
    for (const definition of routeDefinitions) {
        if (definition?.path && definition.path === path) {
            return { definition, params: {} };
        }

        if (definition?.matcher instanceof RegExp) {
            const match = path.match(definition.matcher);
            if (match) {
                const params = match.groups ? { ...match.groups } : {};
                return { definition, params };
            }
        }
    }

    return null;
}

function getTitleForRoute(definition, params) {
    if (!definition?.title) return 'Sistema de Indicadores AIFA';
    if (typeof definition.title === 'function') {
        try {
            return definition.title(params);
        } catch (error) {
            console.error('❌ Error al generar título de la ruta:', error);
            return 'Sistema de Indicadores AIFA';
        }
    }
    return definition.title;
}

function getBreadcrumbsForRoute(definition, params) {
    if (!definition?.breadcrumbs) {
        return [
            { label: 'Inicio', path: '/', icon: 'home' }
        ];
    }

    try {
        const crumbs = definition.breadcrumbs(params) || [];
        if (!Array.isArray(crumbs)) {
            return [
                { label: 'Inicio', path: '/', icon: 'home' }
            ];
        }

        // Garantizar que siempre esté Inicio al principio
        const hasHome = crumbs.some(crumb => crumb.path === '/' || crumb.icon === 'home');
        if (hasHome) {
            return crumbs;
        }

        return [
            { label: 'Inicio', path: '/', icon: 'home' },
            ...crumbs
        ];
    } catch (error) {
        console.error('❌ Error al generar breadcrumbs:', error);
        return [
            { label: 'Inicio', path: '/', icon: 'home' }
        ];
    }
}

// =====================================================
// NAVEGACIÓN
// =====================================================

export function navigateTo(path, query = {}, replace = false) {
    if (!path) return;

    const queryString = new URLSearchParams(query).toString();
    const url = queryString ? `${path}?${queryString}` : path;

    if (replace) {
        window.location.replace(`#${url}`);
    } else {
        window.location.hash = url;
    }
}

export function goBack() {
    window.history.back();
}

export function reloadCurrentRoute() {
    const route = parseCurrentRoute();
    handleRouteChange(route).catch(error => {
        console.error('❌ Error al recargar la ruta:', error);
    });
}

export function getDefaultRouteForUser(profile = appState.profile) {
    if (!profile) {
        const defaultRoute = routeDefinitions.find(route => route.default);
        return defaultRoute?.path || '/';

    }

    const role = profile?.rol_principal;
    if (role) {
        const roleRoute = routeDefinitions.find(route => Array.isArray(route.defaultForRoles) && route.defaultForRoles.includes(role));
        if (roleRoute) {
            return roleRoute.path;
        }
    }

    const fallbackRoute = routeDefinitions.find(route => route.default);
    return fallbackRoute?.path || '/';
}

// =====================================================
// RENDERIZADO DE VISTAS
// =====================================================

async function cleanupActiveView() {
    if (typeof teardownActiveView === 'function') {
        try {
            await teardownActiveView();
        } catch (error) {
            console.warn('⚠️ Error al ejecutar teardown de la vista previa:', error);
        }
    }

    if (activeViewModule && typeof activeViewModule.destroy === 'function') {
        try {
            await activeViewModule.destroy();
        } catch (error) {
            console.warn('⚠️ Error al destruir la vista previa:', error);
        }
    }

    teardownActiveView = null;
    activeViewModule = null;
}

async function renderRoute(route, resolved, navigationContext = {}) {
    const container = document.getElementById('app-container');
    if (!container) {
        throw new Error('Contenedor de la aplicación no encontrado');
    }

    const signal = navigationContext.controller?.signal || navigationContext.signal || null;

    try {
        resetLoadingState();
        showLoading('Cargando vista...');

        await cleanupActiveView();

        if (signal?.aborted) {
            if (DEBUG.enabled) {
                console.log('⏹️ Render cancelado antes de cargar vista activa');
            }
            return;
        }

        const viewModule = await resolved.definition.loader();

        if (signal?.aborted) {
            if (DEBUG.enabled) {
                console.log('⏹️ Render cancelado tras cargar módulo de vista');
            }
            return;
        }

        if (!viewModule || typeof viewModule.render !== 'function') {
            throw new Error('La vista no expone una función render válida');
        }

        activeViewModule = viewModule;

        const renderPromise = Promise.resolve(
            viewModule.render(container, resolved.params, route.query, { signal })
        );

        const renderTimeoutMs = typeof resolved.definition.renderTimeout === 'number'
            ? resolved.definition.renderTimeout
            : 20000;
        const timeoutErrorMessage = resolved.definition.renderTimeoutMessage
            || 'Timeout al renderizar vista';

        let renderTimeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
            const timeoutError = new Error(timeoutErrorMessage);
            timeoutError.name = 'RenderTimeoutError';

            renderTimeoutId = setTimeout(
                () => reject(timeoutError),
                renderTimeoutMs
            );
        });

        const abortPromise = signal
            ? new Promise((_, reject) => {
                if (signal.aborted) {
                    reject(signal.reason || new DOMException('Navigation aborted', 'AbortError'));
                } else {
                    signal.addEventListener('abort', () => {
                        reject(signal.reason || new DOMException('Navigation aborted', 'AbortError'));
                    }, { once: true });
                }
            })
            : null;

        const promises = [renderPromise, timeoutPromise];
        if (abortPromise) {
            promises.push(abortPromise);
        }

        const teardown = await Promise.race(promises).finally(() => {
            if (renderTimeoutId) {
                clearTimeout(renderTimeoutId);
            }
        });

        if (signal?.aborted) {
            if (typeof teardown === 'function') {
                try {
                    teardown();
                } catch (error) {
                    console.warn('⚠️ Error al ejecutar teardown tras abortar navegación:', error);
                }
            }
            return;
        }

        teardownActiveView = typeof teardown === 'function' ? teardown : null;

        // Recrear iconos después de renderizar
        if (window.lucide) {
            window.lucide.createIcons();
        }

        hideLoading();

        if (DEBUG.enabled) {
            console.log(`✅ Vista renderizada: ${route.path}`);
        }
    } catch (error) {
        hideLoading();
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
            if (DEBUG.enabled) {
                console.log(`⏹️ Render abortado para ${route.path}:`, error.message || error.name);
            }
            return;
        }
        console.error(`❌ Error al renderizar la ruta ${route.path}:`, error);
        showErrorPage('Error al cargar la vista', error.message || 'Ocurrió un problema al renderizar la vista.');
        throw error; // Re-lanzar el error para que lo capture handleRouteChange
    }
}

function showErrorPage(title, message) {
    const container = document.getElementById('app-container');
    if (!container) return;

    const template = `
        <div class="text-center py-12">
            <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">${title}</h2>
            <p class="text-gray-600 mb-4">${message}</p>
            <div class="space-x-3">
                <button onclick="window.router.goBack()" class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                    Volver
                </button>
                <button onclick="window.router.navigateTo('/')" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                    Ir al inicio
                </button>
            </div>
        </div>
    `;

    renderTemplate(container, template);

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =====================================================
// ACTUALIZACIÓN DE UI
// =====================================================

function updateActiveNavigation(definition) {
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.remove('text-aifa-blue', 'bg-blue-50');
        button.classList.add('text-gray-600', 'bg-white');
    });

    if (definition?.navId) {
        const activeButton = document.getElementById(definition.navId);
        if (activeButton) {
            activeButton.classList.remove('text-gray-600', 'bg-white');
            activeButton.classList.add('text-aifa-blue', 'bg-blue-50');
        }
    }
}

function updateBreadcrumb(definition, params) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    const breadcrumbs = getBreadcrumbsForRoute(definition, params);
    breadcrumbContainer.innerHTML = breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const icon = crumb.icon ? `<i data-lucide="${crumb.icon}" class="w-4 h-4 mr-1"></i>` : '';
        const separator = index > 0 ? '<i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-2"></i>' : '';

        if (isLast) {
            return `
                <span class="flex items-center">
                    ${separator}
                    <span class="text-aifa-blue font-medium flex items-center">
                        ${icon}${crumb.label}
                    </span>
                </span>
            `;
        }

        return `
            <span class="flex items-center">
                ${separator}
                <a href="#${crumb.path}" class="text-gray-600 hover:text-aifa-blue flex items-center transition-colors">
                    ${icon}${crumb.label}
                </a>
            </span>
        `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function updateDocumentTitle(definition, params) {
    const title = getTitleForRoute(definition, params);
    document.title = title ? `${title} · Sistema de Indicadores AIFA` : 'Sistema de Indicadores AIFA';
}

// =====================================================
// RESET DE EMERGENCIA
// =====================================================

function forceResetRouter() {
    if (DEBUG.enabled) {
        console.warn('🔄 Forzando reset del router');
    }

    cancelActiveNavigation('navigation:forced-reset');

    routerState.isNavigating = false;

    if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
    }
    
    // Limpiar también el estado de loading
    resetLoadingState();
    hideLoading();
    
    // Limpiar vista activa si existe
    if (activeViewModule && typeof activeViewModule.destroy === 'function') {
        try {
            activeViewModule.destroy();
        } catch (error) {
            console.warn('⚠️ Error al limpiar vista activa:', error);
        }
    }
    
    activeViewModule = null;
    teardownActiveView = null;
}

// Exportar para uso externo si es necesario
export { forceResetRouter };

// =====================================================
// CONTROLADOR PRINCIPAL DE RUTA
// =====================================================
async function handleRouteChange(route) {
    // Si ya hay una navegación en progreso, esperar un momento
    if (routerState.isNavigating) {
        if (DEBUG.enabled) {
            console.warn('⚠️ Navegación en progreso, esperando...');
        }
        
        // Esperar máximo 5 segundos, luego forzar reset
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Si después de 5 segundos sigue bloqueado, forzar reset
        if (routerState.isNavigating) {
            console.error('❌ Navegación bloqueada, forzando reset');
            forceResetRouter();
        }
    }

    routerState.isNavigating = true;

    const navigationContext = beginNavigation();
    const { controller, id } = navigationContext;
    const signal = controller.signal;

    // Timeout de seguridad: si no termina en 30 segundos, forzar reset
    if (navigationTimeout) {
        clearTimeout(navigationTimeout);
    }

    navigationTimeout = setTimeout(() => {
        console.error('❌ Timeout de navegación alcanzado, forzando reset');
        cancelActiveNavigation('navigation:timeout');
        forceResetRouter();
        hideLoading();
    }, 30000); // 30 segundos

    try {
        const resolved = resolveDefinition(route.path);
        if (!resolved) {
            showErrorPage('Ruta no encontrada', `No existe una vista configurada para ${route.path}`);
            return;
        }

        const { definition, params } = resolved;

        if (definition.requiresAuth !== false && !isAuthenticated()) {
            if (DEBUG.enabled) {
                console.log('🚫 Ruta protegida, redirigiendo a login');
            }
            navigateTo('/login', {}, true);
            return;
        }

        if (definition.path === '/login' && isAuthenticated()) {
            const targetRoute = getDefaultRouteForUser();
            navigateTo(targetRoute, {}, true);
            return;
        }

        routerState.currentRoute = route;
        routerState.currentParams = params;
        routerState.currentQuery = route.query;
        routerState.currentDefinition = definition;
        routerState.history.push(route.fullPath);

        await renderRoute(route, resolved, navigationContext);

        if (signal.aborted) {
            return;
        }

        updateActiveNavigation(definition);
        updateBreadcrumb(definition, params);
        updateDocumentTitle(definition, params);

        window.dispatchEvent(new CustomEvent('router:route-changed', {
            detail: {
                route,
                definition,
                params,
                query: route.query
            }
        }));

        if (DEBUG.enabled) {
            console.log('📍 Ruta actualizada:', {
                path: route.path,
                params,
                query: route.query
            });
        }
    } catch (error) {
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
            if (DEBUG.enabled) {
                console.log('⏹️ Navegación abortada:', error.message || error.name);
            }
        } else if (error?.name === 'RenderTimeoutError' || error?.message?.toLowerCase?.().includes('timeout')) {
            console.error(`❌ La vista tardó demasiado en cargar (${route.path}):`, error);
            showToast('La vista está tardando más de lo esperado', 'warning');
            showErrorPage('Tiempo de espera agotado', error.message || 'La vista tardó demasiado en responder.');
        } else {
            console.error('❌ Error al cambiar de ruta:', error);
            showToast('Error de navegación', 'error');
            showErrorPage('Error de navegación', error.message || 'No fue posible completar la navegación.');
        }
    } finally {
        // CRÍTICO: Siempre limpiar el estado
        if (isActiveNavigation(id)) {
            if (navigationTimeout) {
                clearTimeout(navigationTimeout);
                navigationTimeout = null;
            }
            routerState.isNavigating = false;
            hideLoading();
        }

        finalizeNavigation(controller, id);

        if (DEBUG.enabled) {
            console.log('✅ Navegación completada, estado limpio');
        }
    }
}
// =====================================================
// INICIALIZACIÓN
// =====================================================

function setupRouterListeners() {
    window.addEventListener('hashchange', () => {
        const route = parseCurrentRoute();
        handleRouteChange(route).catch(error => console.error('❌ Error en hashchange:', error));
    });

    window.addEventListener('DOMContentLoaded', () => {
        const route = parseCurrentRoute();
        handleRouteChange(route).catch(error => console.error('❌ Error al cargar ruta inicial:', error));
    });
}

export function initRouter({ routes = [] } = {}) {
    if (routerState.initialized) {
        return;
    }

    configureRoutes(routes);
    setupRouterListeners();

    const initialRoute = parseCurrentRoute();
    handleRouteChange(initialRoute).catch(error => console.error('❌ Error en ruta inicial:', error));

    routerState.initialized = true;

    if (DEBUG.enabled) {
        console.log('✅ Router inicializado');
    }
}
