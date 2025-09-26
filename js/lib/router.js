// =====================================================
// SISTEMA DE ENRUTAMIENTO HASH-BASED
// Gestiona navegación entre vistas con carga diferida.
// =====================================================

import { DEBUG } from '../config.js';
import { appState, isAuthenticated } from './supa.js';
import { showToast, showLoading, hideLoading, resetLoadingState } from './ui.js';

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

async function renderRoute(route, resolved) {
    const container = document.getElementById('app-container');
    if (!container) {
        throw new Error('Contenedor de la aplicación no encontrado');
    }

    try {
        resetLoadingState();
        showLoading('Cargando vista...');

        await cleanupActiveView();

        const viewModule = await resolved.definition.loader();
        if (!viewModule || typeof viewModule.render !== 'function') {
            throw new Error('La vista no expone una función render válida');
        }

        activeViewModule = viewModule;
        const teardown = await viewModule.render(container, resolved.params, route.query);
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
        console.error(`❌ Error al renderizar la ruta ${route.path}:`, error);
        showErrorPage('Error al cargar la vista', error.message || 'Ocurrió un problema al renderizar la vista.');
    }
}

function showErrorPage(title, message) {
    const container = document.getElementById('app-container');
    if (!container) return;

    container.innerHTML = `
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
// CONTROLADOR PRINCIPAL DE RUTA
// =====================================================

async function handleRouteChange(route) {
    if (routerState.isNavigating) {
        return;
    }

    routerState.isNavigating = true;

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

        await renderRoute(route, resolved);
        updateActiveNavigation(definition);
        updateBreadcrumb(definition, params);
        updateDocumentTitle(definition, params);

        if (DEBUG.enabled) {
            console.log('📍 Ruta actualizada:', {
                path: route.path,
                params,
                query: route.query
            });
        }
    } catch (error) {
        console.error('❌ Error al cambiar de ruta:', error);
        showToast('Error de navegación', 'error');
        showErrorPage('Error de navegación', error.message || 'No fue posible completar la navegación.');
    } finally {
        routerState.isNavigating = false;
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
