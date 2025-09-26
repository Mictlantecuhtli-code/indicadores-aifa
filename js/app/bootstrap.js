// =====================================================
// BOOTSTRAP DE LA APLICACIÓN
// Inicializa configuración, router, navegación y sesión.
// =====================================================

import { DEBUG, VALIDATION } from '../config.js';
import { routes, getNavigationBindings } from './routes.js';
import { initRouter, navigateTo, goBack, reloadCurrentRoute, parseCurrentRoute, getDefaultRouteForUser } from '../lib/router.js';
import * as ui from '../lib/ui.js';
import { initSupabase, appState, getCurrentProfile, onAuthStateChange, isAuthenticated, signOut, changePassword } from '../lib/supa.js';

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

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function updateNavigationVisibility() {
    const navigation = document.getElementById('main-nav') || document.querySelector('header nav');
    const navButtons = {
        home: document.getElementById('nav-home'),
        visualizacion: document.getElementById('nav-visualizacion'),
        captura: document.getElementById('nav-captura'),
        admin: document.getElementById('nav-admin'),
        panelDirectivos: document.getElementById('nav-panel-directivos')
    };

    const isAuthenticatedUser = Boolean(appState.user && appState.profile);

    if (document.body) {
        document.body.dataset.authenticated = isAuthenticatedUser ? 'true' : 'false';
    }

    if (!navigation) {
        return;
    }

    if (!isAuthenticatedUser) {
        navigation.style.display = 'none';
        return;
    }

    navigation.style.display = '';

    Object.values(navButtons).forEach(button => {
        if (button) {
            button.classList.remove('hidden');
        }
    });

    if (appState.profile?.rol_principal === 'DIRECTOR') {
        ['nav-home', 'nav-captura', 'nav-admin'].forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.classList.add('hidden');
            }
        });
    }
}

function updateUserHeader() {
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userMenuLabel = document.getElementById('user-menu-label');


    const { user, profile } = appState;
    const hasUser = Boolean(user && profile);

    if (user && profile) {
        const displayName = profile.nombre_completo?.trim()
            || appState.user?.user_metadata?.full_name
            || appState.user?.email
            || 'Usuario';

        if (userInfo) {
            userInfo.classList.remove('hidden');
        }
        if (userName) {
            userName.textContent = displayName;
        }
        if (userRole) {
            userRole.textContent = getRoleLabel(profile.rol_principal);
        }
        if (userMenuLabel) {
            userMenuLabel.textContent = displayName;
        }
    } else {
        if (userInfo) {
            userInfo.classList.add('hidden');
        }
    }
}

function syncProtectedHeaderVisibility() {
    const navigation = document.getElementById('main-nav');
    const userMenuButton = document.getElementById('user-menu-button');
    const { user, profile } = appState;

    let isPublicRoute = false;

    try {
        const { path } = parseCurrentRoute?.() || {};
        const currentPath = path || '/';

        for (const candidate of routes) {
            if (candidate?.path && candidate.path === currentPath) {
                isPublicRoute = candidate.requiresAuth === false;
                break;
            }

            if (candidate?.matcher instanceof RegExp && candidate.matcher.test(currentPath)) {
                isPublicRoute = candidate.requiresAuth === false;
                break;
            }
        }
    } catch (error) {
        console.warn('No se pudo determinar la ruta actual para la visibilidad del header:', error);
    }

    const hasUser = Boolean(user && profile);
    const shouldShowNav = Boolean(hasUser && isAuthenticated() && !isPublicRoute);

    if (navigation) {
        navigation.hidden = !shouldShowNav;
        navigation.setAttribute('aria-hidden', shouldShowNav ? 'false' : 'true');
    }

    if (userMenuButton) {
        userMenuButton.hidden = !shouldShowNav;
        userMenuButton.setAttribute('aria-hidden', shouldShowNav ? 'false' : 'true');

        if (!shouldShowNav || !hasUser) {
            userMenuButton.disabled = true;
            if (!userMenuButton.classList.contains('btn-disabled')) {
                userMenuButton.classList.add('btn-disabled');
            }
        } else {
            userMenuButton.disabled = false;
            userMenuButton.classList.remove('btn-disabled');
        }
        if (userMenuLabel) {
            userMenuLabel.textContent = 'Iniciar sesión';
        }

    }

    updateNavigationVisibility();
}

function updateNavigationVisibility() {
    const navigation = document.getElementById('main-nav');
    if (!navigation) return;

    const shouldShowNav = isAuthenticated();
    navigation.hidden = !shouldShowNav;
    navigation.setAttribute('aria-hidden', shouldShowNav ? 'false' : 'true');

}

async function openUserMenu() {
    if (!appState.user) {
        navigateTo('/login');
        return;
    }

    const profile = appState.profile || await getCurrentProfile();

    const displayName = escapeHTML(
        profile?.nombre_completo?.trim() ||
        appState.user?.user_metadata?.full_name ||
        appState.user.email ||
        'Mi cuenta'
    );

    const infoFields = [
        {
            label: 'Correo institucional',
            value: escapeHTML(appState.user.email)
        },
        {
            label: 'Rol principal',
            value: escapeHTML(getRoleLabel(profile?.rol_principal))
        }
    ];

    if (profile?.puesto) {
        infoFields.push({
            label: 'Puesto',
            value: escapeHTML(profile.puesto)
        });
    }

    if (profile?.telefono) {
        infoFields.push({
            label: 'Teléfono',
            value: escapeHTML(profile.telefono)
        });
    }

    const renderInfoField = ({ label, value }) => `
        <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">${label}</p>
            <p class="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">${value || 'Sin registro'}</p>
        </div>
    `;

    const passwordConfig = VALIDATION?.password || {};
    const passwordMinLength = passwordConfig?.minLength || 8;
    const passwordMaxLengthAttr = passwordConfig?.maxLength ? ` maxlength="${passwordConfig.maxLength}"` : '';
    const passwordRequirementsMessage = escapeHTML(
        passwordConfig?.message || 'La contraseña debe cumplir con los requisitos de seguridad.'
    );

    const modalId = ui.showModal({
        title: displayName,
        content: `
            <div class="space-y-6">
                <div class="grid gap-4">
                    ${infoFields.map(renderInfoField).join('')}
                </div>
                <div class="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-xs leading-snug text-gray-500">Gestiona tu sesión desde esta ventana.</p>
                    <div class="flex flex-wrap items-center gap-2">
                        <button id="change-password-btn" class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100">
                            <i data-lucide="key-round" class="w-4 h-4"></i>
                            Cambiar contraseña
                        </button>
                        <button id="logout-btn-modal" class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>

            </div>
        `,
        actions: [
            {
                text: 'Cerrar',
                handler: () => true
            }
        ]
    });

    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }

        const logoutButton = document.getElementById('logout-btn-modal');
        if (logoutButton) {
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
        }

        const changePasswordButton = document.getElementById('change-password-btn');
        if (changePasswordButton) {
            changePasswordButton.addEventListener('click', () => {
                ui.hideModal(modalId);
                openChangePasswordModal();
            });
        }
    }, 100);
}


function setupUserMenu() {
    const button = document.getElementById('user-menu-button');
    if (!button) return;

    button.addEventListener('click', openUserMenu);
}

function openChangePasswordModal() {
    let isSubmitting = false;

    const modalId = ui.showModal({
        title: 'Cambiar contraseña',
        content: `
            <form id="change-password-form" class="space-y-4">
                <div>
                    <label for="current-password" class="block text-sm font-medium text-gray-700">Contraseña actual</label>
                    <input id="current-password" type="password" autocomplete="current-password" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-1 focus:ring-aifa-blue" required>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="new-password" class="block text-sm font-medium text-gray-700">Nueva contraseña</label>
                        <input id="new-password" type="password" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-1 focus:ring-aifa-blue" required>
                    </div>
                    <div>
                        <label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
                        <input id="confirm-password" type="password" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-1 focus:ring-aifa-blue" required>
                    </div>
                </div>
                <div id="change-password-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"></div>
                <p class="text-xs text-gray-500">La nueva contraseña debe tener al menos 8 caracteres.</p>
            </form>
        `,
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            },
            {
                text: 'Actualizar contraseña',
                primary: true,
                handler: async () => {
                    if (isSubmitting) {
                        return false;
                    }

                    const errorContainer = document.getElementById('change-password-error');
                    const currentInput = document.getElementById('current-password');
                    const newInput = document.getElementById('new-password');
                    const confirmInput = document.getElementById('confirm-password');
                    const submitButton = document.getElementById('modal-action-1');

                    const clearError = () => {
                        if (errorContainer) {
                            errorContainer.textContent = '';
                            errorContainer.classList.add('hidden');
                        }
                    };

                    const showError = (message) => {
                        if (errorContainer) {
                            errorContainer.textContent = message;
                            errorContainer.classList.remove('hidden');
                        }
                    };

                    const resetFieldState = (field) => {
                        if (field) {
                            field.classList.remove('border-red-500', 'bg-red-50');
                        }
                    };

                    const markFieldError = (field) => {
                        if (field) {
                            field.classList.add('border-red-500', 'bg-red-50');
                        }
                    };

                    clearError();
                    [currentInput, newInput, confirmInput].forEach(resetFieldState);

                    const currentPassword = currentInput?.value?.trim() || '';
                    const newPassword = newInput?.value?.trim() || '';
                    const confirmPassword = confirmInput?.value?.trim() || '';

                    if (!currentPassword || !newPassword || !confirmPassword) {
                        showError('Completa todos los campos para continuar.');
                        [currentInput, newInput, confirmInput].forEach(markFieldError);
                        return false;
                    }

                    if (newPassword.length < 8) {
                        showError('La nueva contraseña debe tener al menos 8 caracteres.');
                        markFieldError(newInput);
                        markFieldError(confirmInput);
                        return false;
                    }

                    if (newPassword !== confirmPassword) {
                        showError('Las contraseñas nuevas no coinciden.');
                        markFieldError(newInput);
                        markFieldError(confirmInput);
                        return false;
                    }

                    if (currentPassword === newPassword) {
                        showError('La nueva contraseña debe ser diferente a la actual.');
                        markFieldError(newInput);
                        return false;
                    }

                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.dataset.originalText = submitButton.dataset.originalText || submitButton.textContent;
                        submitButton.textContent = 'Actualizando...';
                    }

                    isSubmitting = true;

                    try {
                        await changePassword(currentPassword, newPassword);
                        ui.showToast('Contraseña actualizada correctamente', 'success');
                        clearError();
                        return true;
                    } catch (error) {
                        console.error('Error al cambiar contraseña:', error);
                        const message = error?.message || 'No fue posible actualizar la contraseña.';
                        showError(message);

                        if (error?.code === 'INVALID_CREDENTIALS') {
                            markFieldError(currentInput);
                            currentInput?.focus();
                        }

                        ui.showToast(message, 'error');
                        return false;
                    } finally {
                        isSubmitting = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = submitButton.dataset.originalText || 'Actualizar contraseña';
                        }
                    }
                }
            }
        ]
    });

    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }

        const form = document.getElementById('change-password-form');
        if (form) {
            form.addEventListener('submit', event => {
                event.preventDefault();
                const submitButton = document.getElementById('modal-action-1');
                submitButton?.click();
            });
        }

        const currentInput = document.getElementById('current-password');
        currentInput?.focus();
    }, 100);

    return modalId;
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
        updateNavigationVisibility();

        if (window.lucide) {
            window.lucide.createIcons();
        }

        await initSupabase();
        updateUserHeader();
        syncProtectedHeaderVisibility();

        onAuthStateChange(({ event }) => {
            updateUserHeader();
            if (event === 'SESSION_EXPIRED') {
                ui.showToast('Tu sesión expiró por inactividad. Vuelve a iniciar sesión.', 'warning');

                setTimeout(() => {
                    const isOnLogin = window.location.hash?.includes('/login');
                    if (!isOnLogin) {
                        navigateTo('/login', {}, true);
                    }
                }, 250);
            }
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
