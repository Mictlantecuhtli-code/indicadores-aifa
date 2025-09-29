// =====================================================
// BOOTSTRAP DE LA APLICACIÓN
// Inicializa configuración, router, navegación y sesión.
// =====================================================

import { DEBUG } from '../config.js';
import { routes, getNavigationBindings } from './routes.js';
import {
    initRouter,
    navigateTo,
    goBack,
    reloadCurrentRoute,
    parseCurrentRoute,
    getDefaultRouteForUser,
    cancelActiveNavigation
} from '../lib/router.js';
import * as ui from '../lib/ui.js';
import {
    initSupabase,
    appState,
    onAuthStateChange,
    isAuthenticated
} from '../lib/supa.js';
import {
    initHeaderModule,
    updateUserHeader,
    syncProtectedHeaderVisibility,
    closeUserMenuDropdown
} from './modules/header.js';
import { initSessionMonitoring } from './modules/session.js';
import { initGlobalErrorHandlers } from './modules/errors.js';

function exposeGlobals() {
    window.ui = ui;
    window.router = {
        navigateTo,
        goBack,
        reloadCurrentRoute,
        parseCurrentRoute,
        getDefaultRouteForUser,
        cancelActiveNavigation
    };
}

async function bootstrap() {
    try {
        exposeGlobals();
        initGlobalErrorHandlers();
        initSessionMonitoring();

        const navigationBindings = getNavigationBindings();
        initHeaderModule({ routes, navigationMap: navigationBindings });

        if (window.lucide) {
            window.lucide.createIcons();
        }

        await initSupabase();

        updateUserHeader();
        syncProtectedHeaderVisibility();

        window.addEventListener('router:route-changed', () => {
            syncProtectedHeaderVisibility();
            closeUserMenuDropdown();
        });

        onAuthStateChange(() => {
            updateUserHeader();
            syncProtectedHeaderVisibility();
        });

        if (!window.location.hash) {
            const defaultRoute = isAuthenticated()
                ? getDefaultRouteForUser(appState.profile)
                : '/';
            navigateTo(defaultRoute, {}, true);
        }

        initRouter({ routes });

        if (DEBUG?.enabled) {
            console.log('✅ Aplicación inicializada correctamente');
        }
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);

        const container = document.getElementById('app-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar la aplicación</h2>
                    <p class="text-gray-600 mb-4">Ha ocurrido un error al inicializar el sistema.</p>
                    <div class="space-y-2 text-sm text-gray-500 max-w-md mx-auto">
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>Verifique la configuración y que todos los archivos estén presentes.</p>
                    </div>
                    <button onclick="location.reload()" class="mt-6 bg-aifa-blue text-white px-6 py-2 rounded-lg hover:bg-aifa-dark">
                        Recargar página
                    </button>
                </div>
            `;

            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
