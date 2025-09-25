// =====================================================
// BOOTSTRAP DE LA APLICACIÓN
// Inicializa configuración, router, navegación y sesión.
// =====================================================

import { DEBUG } from '../config.js';
import { routes, getNavigationBindings } from './routes.js';
import { initRouter, navigateTo, goBack, reloadCurrentRoute, parseCurrentRoute, getDefaultRouteForUser } from '../lib/router.js';
import * as ui from '../lib/ui.js';
import { initSupabase, appState, getCurrentProfile, onAuthStateChange, isAuthenticated, signOut } from '../lib/supa.js';

// =====================================================
// UTILIDADES
// =====================================================

const ROLE_NAMES = {
    ADMIN: 'Administrador',
    DIRECTOR: 'Director',
    SUBDIRECTOR: 'Subdirector',
    JEFE_AREA: 'Jefe de Área',
    CAPTURISTA: 'Capturista'
};

function getRoleLabel(role) {
    return ROLE_NAMES[role] || role || 'Sin rol';
}

function exposeGlobals() {
    window.ui = ui;
    window.router = {
        navigateTo,
        goBack,
        reloadCurrentRoute,
        parseCurrentRoute,
        getDefaultRouteForUser
    };
}

function setupGlobalErrorHandlers() {
    window.addEventListener('error', event => {
        console.error('❌ Error global capturado:', event.error);
        if (window.ui?.showToast) {
            window.ui.showToast('Ha ocurrido un error inesperado', 'error');
        }
    });

    window.addEventListener('unhandledrejection', event => {
        console.error('❌ Promise rechazada:', event.reason);
        if (window.ui?.showToast) {
            window.ui.showToast('Error de conexión o procesamiento', 'error');
        }
    });
}

function setupNavigation() {
    const bindings = getNavigationBindings();
    bindings.forEach((path, navId) => {
        const button = document.getElementById(navId);
        if (!button) return;

        button.addEventListener('click', event => {
            event.preventDefault();
            navigateTo(path);
        });
    });
}

function updateUserHeader() {
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');

    const { user, profile } = appState;

    if (user && profile) {
        if (userInfo) {
            userInfo.classList.remove('hidden');
        }
        if (userName) {
            userName.textContent = profile.nombre_completo || user.email || 'Usuario';
        }
        if (userRole) {
            userRole.textContent = getRoleLabel(profile.rol_principal);
        }
    } else {
        if (userInfo) {
            userInfo.classList.add('hidden');
        }
        if (userName) {
            userName.textContent = 'Usuario';
        }
        if (userRole) {
            userRole.textContent = '';
        }
    }
}

async function openUserMenu() {
    if (!appState.user) {
        navigateTo('/login');
        return;
    }

    const profile = appState.profile || await getCurrentProfile();

    const modalId = ui.showModal({
        title: 'Mi Cuenta',
        content: `
            <div class="space-y-4">
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                            <i data-lucide="user" class="w-6 h-6 text-white"></i>
                        </div>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-900">${profile?.nombre_completo || 'Usuario'}</p>
                            <p class="text-sm text-gray-600">${appState.user.email}</p>
                        </div>
                    </div>
                    <div class="bg-white/50 rounded px-3 py-2">
                        <p class="text-xs text-gray-500">Rol actual</p>
                        <p class="font-medium text-blue-700">${getRoleLabel(profile?.rol_principal)}</p>
                    </div>
                </div>

                <button id="logout-btn-modal" class="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                    <span>Cerrar sesión</span>
                </button>
            </div>
        `,
        actions: [
            {
                text: 'Cerrar',
                handler: () => {
                    ui.hideModal(modalId);
                    return true;
                }
            }
        ]
    });

    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }

        const logoutButton = document.getElementById('logout-btn-modal');
        if (!logoutButton) return;

        logoutButton.addEventListener('click', async () => {
            try {
                const confirmed = await ui.showConfirmModal('¿Estás seguro de cerrar sesión?', {
                    title: 'Confirmar cierre de sesión',
                    confirmText: 'Cerrar sesión',
                    cancelText: 'Cancelar',
                    type: 'warning'
                });

                if (!confirmed) return;

                ui.hideModal(modalId);
                await signOut();
                ui.showToast('Sesión cerrada correctamente', 'success');

                setTimeout(() => {
                    navigateTo('/login', {}, true);
                    window.location.reload();
                }, 300);
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                ui.showToast('Error al cerrar sesión', 'error');
            }
        });
    }, 100);
}

function setupUserMenu() {
    const button = document.getElementById('user-menu-button');
    if (!button) return;

    button.addEventListener('click', openUserMenu);
}

// =====================================================
// BOOTSTRAP PRINCIPAL
// =====================================================

async function bootstrap() {
    try {
        exposeGlobals();
        setupGlobalErrorHandlers();
        setupNavigation();
        setupUserMenu();

        if (window.lucide) {
            window.lucide.createIcons();
        }

        await initSupabase();
        updateUserHeader();

        onAuthStateChange(() => {
            updateUserHeader();
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
