// =====================================================
// SISTEMA DE ENRUTAMIENTO HASH-BASED
// =====================================================

import { DEBUG } from '../config.js';
import { appState, getCurrentProfile, hasRoleLevel, isAuthenticated } from './supa.js';
import { showToast, showLoading, hideLoading } from './ui.js';

// Estado del router
export const routerState = {
    currentRoute: null,
    currentParams: {},
    currentQuery: {},
    history: [],
    isNavigating: false
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
    
    // Extraer parámetros de rutas dinámicas
    if (path.startsWith('/area/')) {
        const segments = path.split('/');
        if (segments[2]) {
            params.id = segments[2];
        }
    } else if (path.startsWith('/indicador/')) {
        const segments = path.split('/');
        if (segments[2]) {
            params.clave = segments[2];
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
 * Navegar a una ruta específica
 */
export function navigateTo(path, query = {}, replace = false) {
    if (routerState.isNavigating) return;
    
    try {
        routerState.isNavigating = true;
        
        // Construir URL completa
        let url = path;
        const queryString = new URLSearchParams(query).toString();
        if (queryString) {
            url += '?' + queryString;
        }
        
        // Actualizar URL
        if (replace) {
            window.location.replace('#' + url);
        } else {
            window.location.hash = url;
        }
        
        if (DEBUG.enabled) {
            console.log(`🧭 Navegando a: ${url}`);
        }
        
    } catch (error) {
        console.error('❌ Error al navegar:', error);
        showToast('Error de navegación', 'error');
    } finally {
        routerState.isNavigating = false;
    }
}

/**
 * Manejar cambio de ruta
 */
async function handleRouteChange(route) {
    try {
        if (DEBUG.enabled) {
            console.log(`🔄 Cambiando a ruta: ${route.path}`, route);
        }
        
        // Actualizar estado del router
        routerState.currentRoute = route;
        routerState.currentParams = route.params;
        routerState.currentQuery = route.query;
        
        // Verificar autenticación
        const authRequired = await checkAuthRequirement(route.path);
        
        if (authRequired && !isAuthenticated()) {
            if (DEBUG.enabled) {
                console.log('🚫 Ruta protegida, redirigiendo a login');
            }
            navigateTo('/login', {}, true);
            return;
        }
        
        // Si está en login y ya autenticado, redirigir a home
        if (route.path === '/login' && isAuthenticated()) {
            if (DEBUG.enabled) {
                console.log('👤 Usuario ya autenticado, redirigiendo a home');
            }
            navigateTo('/', {}, true);
            return;
        }
        
        // Renderizar vista
        await renderRoute(route);
        
        // Actualizar navegación activa
        updateActiveNavigation(route.path);
        
        // Actualizar breadcrumb
        updateBreadcrumb(route);
        
    } catch (error) {
        console.error('❌ Error al cambiar ruta:', error);
        showErrorPage('Error de navegación', error.message);
    }
}

/**
 * Verificar si una ruta requiere autenticación
 */
async function checkAuthRequirement(path) {
    const publicRoutes = ['/login'];
    return !publicRoutes.includes(path);
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
        showLoading('Cargando vista...');
        
        let viewModule;
        
        switch (route.path) {
            case '/login':
                viewModule = await import('../auth/login.js');
                break;
                
            case '/':
                viewModule = await import('../views/home.js');
                break;
                
            case '/visualizacion':
                viewModule = await import('../views/visualizacion.js');
                break;
                
            case '/admin':
                viewModule = await import('../views/admin.js');
                break;
                
            case '/captura':
                // Redirigir a home para mostrar áreas
                // navigateTo('/', {}, true);
                viewModule = await import('../views/home.js');
                break;

            case '/panel-directivos':
                viewModule = await import('../views/panel-directivos.js');
                break;

            case '/panel-directivos/analisis':
                viewModule = await import('../views/panel-analisis.js');
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
        
        // Renderizar vista
        if (viewModule && viewModule.render) {
            await viewModule.render(container, route.params, route.query);
        } else {
            throw new Error('Vista no tiene función render');
        }
        
        hideLoading();
        
        if (DEBUG.enabled) {
            console.log(`✅ Vista renderizada: ${route.path}`);
        }
        
    } catch (error) {
        hideLoading();
        console.error(`❌ Error al renderizar vista ${route.path}:`, error);
        showErrorPage('Error al cargar la vista', error.message);
    }
}

/**
 * Mostrar página de error
 */
function showErrorPage(title, message) {
    const container = document.getElementById('app-container');
    if (container) {
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
    // Limpiar navegación activa
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('text-aifa-blue', 'bg-blue-50');
        btn.classList.add('text-gray-600', 'bg-white');
    });
    
    // Marcar botón activo
    let activeButton = null;
    
    if (currentPath === '/') {
        activeButton = document.getElementById('nav-home');
    } else if (currentPath === '/visualizacion') {
        activeButton = document.getElementById('nav-visualizacion');
    } else if (currentPath === '/captura' || currentPath.startsWith('/area/')) {
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
            text: `Área ${areaId}`,
            path: `/area/${areaId}`,
            icon: 'folder'
        });
    } else if (route.path.startsWith('/indicador/')) {
        const indicadorClave = route.params.clave;
        breadcrumbs.push({
            text: `Indicador ${indicadorClave}`,
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
            <span class="flex items-center">
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
            </span>
        `;
    }).join('');
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =====================================================
// FUNCIONES AUXILIARES DE NAVEGACIÓN
// =====================================================

/**
 * Volver a la página anterior
 */
export function goBack() {
    window.history.back();
}

/**
 * Recargar la ruta actual
 */
export function reloadCurrentRoute() {
    const route = parseCurrentRoute();
    handleRouteChange(route);
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

/**
 * Configurar event listeners del router
 */
function setupRouterListeners() {
    // Listener para cambios de hash
    window.addEventListener('hashchange', () => {
        const route = parseCurrentRoute();
        handleRouteChange(route);
    });
    
    // Listener para carga inicial
    window.addEventListener('DOMContentLoaded', () => {
        const route = parseCurrentRoute();
        handleRouteChange(route);
    });
}

/**
 * Inicializar router
 */
export function initRouter() {
    if (DEBUG.enabled) {
        console.log('🧭 Inicializando router...');
    }
    
    setupRouterListeners();
    
    // Cargar ruta inicial
    const route = parseCurrentRoute();
    handleRouteChange(route);
    
    if (DEBUG.enabled) {
        console.log('✅ Router inicializado');
    }
}

// Auto-inicializar cuando se carga el módulo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
} else {
    initRouter();
}
