// =====================================================
// SISTEMA DE ENRUTAMIENTO HASH-BASED
// =====================================================

import { ROUTES, DEBUG, ROLES } from '../config.js';
import { appState, getCurrentProfile, hasRoleLevel } from './supa.js';
import { showToast, showLoading, hideLoading } from './ui.js';

// Estado del router
export const routerState = {
    currentRoute: null,
    currentParams: {},
    currentQuery: {},
    history: [],
    guards: {},
    beforeRouteChange: null,
    afterRouteChange: null
};

// =====================================================
// FUNCIONES PRINCIPALES DEL ROUTER
// =====================================================

/**
 * Parsear la URL hash actual
 */
export function parseCurrentRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    const params = {};
    const query = {};
    
    // Parsear query string
    if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams) {
            query[key] = value;
        }
    }
    
    // Extraer parámetros de la ruta
    const routePattern = findMatchingRoute(path);
    if (routePattern) {
        const paramNames = routePattern.match(/:(\w+)/g);
        const pathSegments = path.split('/');
        const patternSegments = routePattern.split('/');
        
        if (paramNames) {
            paramNames.forEach(paramName => {
                const paramKey = paramName.slice(1);
                const paramIndex = patternSegments.findIndex(segment => segment === paramName);
                if (paramIndex !== -1 && pathSegments[paramIndex]) {
                    params[paramKey] = decodeURIComponent(pathSegments[paramIndex]);
                }
            });
        }
    }
    
    return {
        path,
        params,
        query,
        fullPath: hash
    };
}

/**
 * Encontrar ruta que coincida con el path
 */
function findMatchingRoute(path) {
    const routes = Object.values(ROUTES.protected);
    
    for (const route of routes) {
        if (route === path) return route;
        
        // Verificar rutas con parámetros
        const routeRegex = route.replace(/:(\w+)/g, '([^/]+)');
        const regex = new RegExp(`^${routeRegex}$`);
        if (regex.test(path)) return route;
    }
    
    return null;
}

/**
 * Navegar a una ruta específica
 */
export function navigateTo(path, query = {}, replace = false) {
    try {
        let fullPath = path;
        
        // Agregar query string si existe
        const queryString = new URLSearchParams(query).toString();
        if (queryString) {
            fullPath += `?${queryString}`;
        }
        
        if (DEBUG.enabled) console.log(`🧭 Navegando a: ${fullPath}`);
        
        // Actualizar URL
        if (replace) {
            window.location.replace(`#${fullPath}`);
        } else {
            window.location.hash = fullPath;
        }
        
    } catch (error) {
        console.error('❌ Error al navegar:', error);
        showToast('Error al navegar a la página solicitada', 'error');
    }
}

/**
 * Navegar hacia atrás en el historial
 */
export function goBack() {
    if (routerState.history.length > 1) {
        routerState.history.pop(); // Remover ruta actual
        const previousRoute = routerState.history[routerState.history.length - 1];
        navigateTo(previousRoute.path, previousRoute.query, true);
    } else {
        navigateTo('/');
    }
}

/**
 * Recargar la ruta actual
 */
export function reloadCurrentRoute() {
    const current = parseCurrentRoute();
    handleRouteChange(current, true);
}

// =====================================================
// GUARDS DE AUTENTICACIÓN Y AUTORIZACIÓN
// =====================================================

/**
 * Guard de autenticación
 */
async function authGuard(route) {
    if (!appState.session || !appState.user) {
        if (DEBUG.enabled) console.log('🔒 Guard: Usuario no autenticado');
        navigateTo('/login', {}, true);
        return false;
    }
    return true;
}

/**
 * Guard de autorización por rol
 */
async function roleGuard(route) {
    const minRole = ROUTES.roleRequirements[route.path];
    if (!minRole) return true;
    
    const profile = appState.profile || await getCurrentProfile();
    if (!profile) {
        navigateTo('/login', {}, true);
        return false;
    }
    
    const hasAccess = hasRoleLevel(profile.rol_principal, minRole);
    if (!hasAccess) {
        if (DEBUG.enabled) console.log(`🔒 Guard: Acceso denegado. Rol requerido: ${minRole}, Rol actual: ${profile.rol_principal}`);
        showToast('No tiene permisos para acceder a esta sección', 'error');
        navigateTo('/', {}, true);
        return false;
    }
    
    return true;
}

/**
 * Guard para rutas públicas (redirigir si ya está autenticado)
 */
async function publicGuard(route) {
    if (appState.session && appState.user && route.path === '/login') {
        if (DEBUG.enabled) console.log('🔒 Guard: Usuario ya autenticado, redirigiendo');
        navigateTo('/', {}, true);
        return false;
    }
    return true;
}

// =====================================================
// MANEJO DE CAMBIOS DE RUTA
// =====================================================

/**
 * Manejar cambio de ruta
 */
async function handleRouteChange(route, forceReload = false) {
    try {
        showLoading();
        
        // Verificar si la ruta cambió realmente
        if (!forceReload && 
            routerState.currentRoute?.path === route.path && 
            JSON.stringify(routerState.currentRoute?.params) === JSON.stringify(route.params) &&
            JSON.stringify(routerState.currentRoute?.query) === JSON.stringify(route.query)) {
            hideLoading();
            return;
        }
        
        if (DEBUG.enabled) console.log('🧭 Procesando cambio de ruta:', route);
        
        // Hook antes del cambio de ruta
        if (routerState.beforeRouteChange) {
            const canProceed = await routerState.beforeRouteChange(route, routerState.currentRoute);
            if (!canProceed) {
                hideLoading();
                return;
            }
        }
        
        // Ejecutar guards
        const isPublicRoute = Object.values(ROUTES.public).includes(route.path);
        
        if (isPublicRoute) {
            if (!(await publicGuard(route))) {
                hideLoading();
                return;
            }
        } else {
            if (!(await authGuard(route))) {
                hideLoading();
                return;
            }
            
            if (!(await roleGuard(route))) {
                hideLoading();
                return;
            }
        }
        
        // Actualizar estado del router
        const previousRoute = routerState.currentRoute;
        routerState.currentRoute = route;
        routerState.currentParams = route.params;
        routerState.currentQuery = route.query;
        
        // Agregar al historial
        if (!forceReload) {
            routerState.history.push(route);
            // Limitar historial a 50 entradas
            if (routerState.history.length > 50) {
                routerState.history.shift();
            }
        }
        
        // Renderizar la vista correspondiente
        await renderRoute(route);
        
        // Actualizar navegación activa
        updateActiveNavigation(route.path);
        
        // Actualizar breadcrumb
        updateBreadcrumb(route);
        
        // Hook después del cambio de ruta
        if (routerState.afterRouteChange) {
            await routerState.afterRouteChange(route, previousRoute);
        }
        
        hideLoading();
        
        if (DEBUG.enabled) console.log('✅ Ruta cargada exitosamente:', route.path);
        
    } catch (error) {
        console.error('❌ Error al manejar cambio de ruta:', error);
        hideLoading();
        
        // Mostrar página de error
        document.getElementById('app-container').innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar la página</h2>
                <p class="text-gray-600 mb-4">Ha ocurrido un error al cargar el contenido solicitado.</p>
                <div class="space-x-3">
                    <button onclick="location.reload()" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Recargar página
                    </button>
                    <button onclick="window.router.navigateTo('/')" class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600">
                        Ir al inicio
                    </button>
                </div>
            </div>
        `;
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Renderizar la vista correspondiente a la ruta
 */
async function renderRoute(route) {
    const container = document.getElementById('app-container');
    if (!container) {
        throw new Error('Contenedor de la aplicación no encontrado');
    }
    
    try {
        let viewModule;
        
        switch (route.path) {
            case '/login':
                viewModule = await import('../auth/login.js');
                break;
                
            case '/':
                viewModule = await import('../views/home.js');
                break;
                
            case '/areas':
                navigateTo('/', {}, true); // Redirigir a home
                return;
                
            case '/visualizacion':
                viewModule = await import('../views/visualizacion.js');
                break;
                
            case '/captura':
                viewModule = await import('../views/home.js'); // Usar home para mostrar áreas
                break;
                
            case '/admin':
                viewModule = await import('../views/admin.js');
                break;
                
            default:
                // Rutas con parámetros
                if (route.path.startsWith('/area/')) {
                    viewModule = await import('../views/area.js');
                } else if (route.path.startsWith('/indicador/')) {
                    viewModule = await import('../views/indicador.js');
                } else {
                    throw new Error(`Ruta no encontrada: ${route.path}`);
                }
        }
        
        // Renderizar la vista
        if (viewModule && viewModule.render) {
            await viewModule.render(container, route.params, route.query);
        } else {
            throw new Error('Módulo de vista no válido');
        }
        
    } catch (error) {
        console.error('❌ Error al renderizar vista:', error);
        
        // Mostrar página 404
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="file-question" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Página no encontrada</h2>
                <p class="text-gray-600 mb-4">La página que está buscando no existe o no está disponible.</p>
                <button onclick="window.router.navigateTo('/')" class="bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                    Volver al inicio
                </button>
            </div>
        `;
        
        // Recrear iconos
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Actualizar navegación activa
 */
function updateActiveNavigation(currentPath) {
    // Remover clases activas
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('text-aifa-blue', 'bg-blue-50');
        btn.classList.add('text-gray-600', 'bg-white');
    });
    
    // Activar botón correspondiente
    let activeButton = null;
    
    if (currentPath === '/' || currentPath.startsWith('/area/')) {
        activeButton = document.getElementById('nav-home');
    } else if (currentPath === '/visualizacion') {
        activeButton = document.getElementById('nav-visualizacion');
    } else if (currentPath === '/captura') {
        activeButton = document.getElementById('nav-captura');
    } else if (currentPath === '/admin') {
        activeButton = document.getElementById('nav-admin');
    }
    
    if (activeButton) {
        activeButton.classList.remove('text-gray-600', 'bg-white');
        activeButton.classList.add('text-aifa-blue', 'bg-blue-50');
    }
}

/**
 * Actualizar breadcrumb
 */
function updateBreadcrumb(route) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;
    
    const breadcrumbs = [];
    
    // Siempre incluir inicio
    breadcrumbs.push({
        text: 'Inicio',
        path: '/',
        icon: 'home'
    });
    
    // Agregar elementos según la ruta
    if (route.path.startsWith('/area/')) {
        const areaId = route.params.id;
        breadcrumbs.push({
            text: 'Área', // Se actualizará con el nombre real
            path: `/area/${areaId}`,
            icon: 'folder'
        });
    } else if (route.path.startsWith('/indicador/')) {
        const indicadorClave = route.params.clave;
        breadcrumbs.push({
            text: 'Indicador', // Se actualizará con el nombre real
            path: `/indicador/${indicadorClave}`,
            icon: 'bar-chart'
        });
    } else if (route.path === '/visualizacion') {
        breadcrumbs.push({
            text: 'Visualización',
            path: '/visualizacion',
            icon: 'bar-chart-3'
        });
    } else if (route.path === '/admin') {
        breadcrumbs.push({
            text: 'Administración',
            path: '/admin',
            icon: 'settings'
        });
    }
    
    // Renderizar breadcrumb
    breadcrumbContainer.innerHTML = breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return `
            <li class="flex items-center">
                ${index > 0 ? '<i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-2"></i>' : ''}
                ${isLast ? 
                    `<span class="text-aifa-blue font-medium flex items-center">
                        <i data-lucide="${crumb.icon}" class="w-4 h-4 mr-1"></i>
                        ${crumb.text}
                    </span>` :
                    `<a href="#${crumb.path}" class="text-gray-600 hover:text-aifa-blue flex items-center transition-colors">
                        <i data-lucide="${crumb.icon}" class="w-4 h-4 mr-1"></i>
                        ${crumb.text}
                    </a>`
                }
            </li>
        `;
    }).join('');
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =====================================================
// CONFIGURACIÓN DE EVENTOS
// =====================================================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Listener para cambios de hash
    window.addEventListener('hashchange', () => {
        const route = parseCurrentRoute();
        handleRouteChange(route);
    });
    
    // Listener para navegación con botones
    document.getElementById('nav-home')?.addEventListener('click', () => navigateTo('/'));
    document.getElementById('nav-visualizacion')?.addEventListener('click', () => navigateTo('/visualizacion'));
    document.getElementById('nav-captura')?.addEventListener('click', () => navigateTo('/'));
    document.getElementById('nav-admin')?.addEventListener('click', () => navigateTo('/admin'));
    
    // Listener para logout
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const { signOut } = await import('./supa.js');
            await signOut();
            showToast('Sesión cerrada correctamente', 'success');
            navigateTo('/login', {}, true);
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
            showToast('Error al cerrar sesión', 'error');
        }
    });
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

/**
 * Inicializar el router
 */
export async function initRouter() {
    try {
        if (DEBUG.enabled) console.log('🧭 Inicializando router...');
        
        // Configurar event listeners
        setupEventListeners();
        
        // Exponer router globalmente para debugging
        window.router = {
            navigateTo,
            goBack,
            reloadCurrentRoute,
            parseCurrentRoute,
            state: routerState
        };
        
        // Procesar ruta inicial
        const initialRoute = parseCurrentRoute();
        await handleRouteChange(initialRoute, true);
        
        if (DEBUG.enabled) console.log('✅ Router inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar router:', error);
        throw error;
    }
}

window.router = {
  navigateTo,
  goBack,
  reloadCurrentRoute,
  parseCurrentRoute
};
