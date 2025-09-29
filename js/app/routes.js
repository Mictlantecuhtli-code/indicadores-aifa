// =====================================================
// DEFINICIÓN CENTRALIZADA DE RUTAS DEL SISTEMA
// Cada entrada describe la vista asociada, requisitos de
// autenticación, enlaces de navegación y breadcrumbs.
// =====================================================

export const routes = [
    {
        path: '/login',
        name: 'login',
        loader: () => import('../auth/login.js'),
        requiresAuth: false,
        title: 'Iniciar sesión',
        breadcrumbs: () => []
    },
    {
        path: '/',
        name: 'home',
        loader: () => import('../views/home.js'),
        requiresAuth: true,
        title: 'Inicio',
        default: true,
        breadcrumbs: () => [
            { label: 'Inicio', path: '/', icon: 'home' }
        ]
    },
    {
        path: '/visualizacion',
        name: 'visualizacion',
        loader: () => import('../views/visualizacion.js'),
        requiresAuth: true,
        navId: 'nav-visualizacion',
        title: 'Visualización',
        breadcrumbs: () => [
            { label: 'Visualización', path: '/visualizacion', icon: 'bar-chart-3' }
        ]
    },
    {
        path: '/captura',
        name: 'captura',
        loader: () => import('../views/captura.js'),
        requiresAuth: true,
        navId: 'nav-captura',
        title: 'Captura de indicadores',
        breadcrumbs: () => [
            { label: 'Captura', path: '/captura', icon: 'edit-3' }
        ]
    },
    {
        path: '/admin',
        name: 'admin',
        loader: () => import('../views/admin.js'),
        requiresAuth: true,
        navId: 'nav-admin',
        title: 'Administración',
        breadcrumbs: () => [
            { label: 'Administración', path: '/admin', icon: 'settings' }
        ]
    },
    {
        path: '/panel-directivos',
        name: 'panel-directivos',
        loader: () => import('../views/panel-directivos.js'),
        requiresAuth: true,
        navId: 'nav-panel-directivos',
        title: 'Panel directivos',
        defaultForRoles: ['DIRECTOR'],
        breadcrumbs: () => [
            { label: 'Panel Directivos', path: '/panel-directivos', icon: 'trending-up' }
        ]
    },
    {
        path: '/panel-directivos/analisis',
        name: 'panel-analisis',
        loader: () => import('../views/panel-analisis.js'),
        requiresAuth: true,
        navId: 'nav-panel-directivos',
        title: 'Análisis de indicador',
        breadcrumbs: () => [
            { label: 'Panel Directivos', path: '/panel-directivos', icon: 'trending-up' },
            { label: 'Análisis', path: '/panel-directivos/analisis', icon: 'pie-chart' }
        ]
    },
    {
        matcher: /^\/area\/(?<id>[^/]+)$/,
        name: 'area-detalle',
        loader: () => import('../views/area.js'),
        requiresAuth: true,
        navId: 'nav-captura',
        title: params => `Área ${params.id}`,
        breadcrumbs: params => [
            { label: 'Captura', path: '/captura', icon: 'edit-3' },
            { label: `Área ${params.id}`, path: `/area/${params.id}`, icon: 'folder' }
        ]
    },
    {
        matcher: /^\/indicador\/(?<clave>[^/]+)$/,
        name: 'indicador-detalle',
        loader: () => import('../views/indicador.js'),
        requiresAuth: true,
        navId: 'nav-visualizacion',
        title: params => `Indicador ${params.clave}`,
        breadcrumbs: params => [
            { label: 'Visualización', path: '/visualizacion', icon: 'bar-chart-3' },
            { label: `Indicador ${params.clave}`, path: `/indicador/${params.clave}`, icon: 'activity' }
        ]
    }
];

/**
 * Obtener lista única de IDs de navegación usados por las rutas
 * para reutilizarla en la configuración del header.
 */
export function getNavigationBindings() {
    const bindings = new Map();

    for (const route of routes) {
        if (route.navId && route.path && !bindings.has(route.navId)) {
            bindings.set(route.navId, route.path);
        }
    }

    return bindings;
}
