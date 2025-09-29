// =====================================================
// BOOTSTRAP DE LA APLICACIÓN
// Inicializa configuración, router, navegación y sesión.
// =====================================================

import { DEBUG, VALIDATION } from '../config.js';
import { routes, getNavigationBindings } from './routes.js';
import { initRouter, navigateTo, goBack, reloadCurrentRoute, parseCurrentRoute, getDefaultRouteForUser } from '../lib/router.js';
import * as ui from '../lib/ui.js';
import { initSupabase, appState, onAuthStateChange, isAuthenticated, signOut, changePassword, getCurrentSession } from '../lib/supa.js';

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
    // Manejar errores no capturados
    window.addEventListener('error', (event) => {
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
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userMenuButton = document.getElementById('user-menu-button');

    const { user, profile } = appState;
    const hasUser = Boolean(user && profile);

    if (!hasUser) {
        closeUserMenuDropdown();
    }

    const displayName = hasUser
        ? (profile?.nombre_completo?.trim() || user?.email || 'Usuario')
        : 'Usuario';

    const roleLabel = hasUser && profile?.rol_principal
        ? getRoleLabel(profile.rol_principal)
        : '';

    if (userName) {
        userName.textContent = displayName;
    }

    if (userRole) {
        if (roleLabel) {
            userRole.textContent = roleLabel;
            userRole.classList.remove('hidden');
        } else {
            userRole.textContent = '';
            if (!userRole.classList.contains('hidden')) {
                userRole.classList.add('hidden');
            }
        }
    }

    if (userMenuButton) {
        userMenuButton.setAttribute(
            'aria-label',
            hasUser ? `Menú de usuario ${displayName}` : 'Menú de usuario'
        );

        userMenuButton.setAttribute('aria-expanded', userMenuState.isOpen ? 'true' : 'false');
        userMenuButton.classList.remove('btn-disabled');
        userMenuButton.removeAttribute('disabled');
    }

    applyRoleNavigationRestrictions();
}

const ROLE_NAVIGATION_RULES = {
    DIRECTOR: new Set(['nav-visualizacion', 'nav-panel-directivos'])
};

let sessionMonitoringConfigured = false;

function applyRoleNavigationRestrictions() {
    const navigation = document.getElementById('main-nav');
    if (!navigation) return;

    const allowedNavIds = ROLE_NAVIGATION_RULES[appState.profile?.rol_principal] || null;

    const navButtons = navigation.querySelectorAll('[id^="nav-"]');
    navButtons.forEach(button => {
        const shouldHideForRole = allowedNavIds ? !allowedNavIds.has(button.id) : false;

        if (shouldHideForRole) {
            if (!button.dataset.roleHidden) {
                button.dataset.roleHidden = 'true';
            }
            if (!button.classList.contains('hidden')) {
                button.classList.add('hidden');
            }
        } else if (button.dataset.roleHidden) {
            button.classList.remove('hidden');
            delete button.dataset.roleHidden;
        }
    });
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
        navigation.classList.toggle('invisible', !shouldShowNav);
        navigation.classList.toggle('opacity-0', !shouldShowNav);
        navigation.classList.toggle('pointer-events-none', !shouldShowNav);
    }

    if (userMenuButton) {
        userMenuButton.hidden = !shouldShowNav;
        userMenuButton.setAttribute('aria-hidden', shouldShowNav ? 'false' : 'true');
        userMenuButton.classList.toggle('invisible', !shouldShowNav);
        userMenuButton.classList.toggle('opacity-0', !shouldShowNav);
        userMenuButton.classList.toggle('pointer-events-none', !shouldShowNav);

        if (!shouldShowNav || !hasUser) {
            closeUserMenuDropdown();
            userMenuButton.classList.remove('btn-disabled');
            userMenuButton.removeAttribute('disabled');
        } else {
            userMenuButton.classList.remove('btn-disabled');
            userMenuButton.removeAttribute('disabled');
        }

        const displayName = hasUser
            ? (profile?.nombre_completo?.trim() || user?.email || 'Usuario')
            : 'Usuario';

        userMenuButton.setAttribute(
            'aria-label',
            hasUser ? `Menú de usuario ${displayName}` : 'Menú de usuario'
        );
    }
}

function updateNavigationVisibility() {
    const navigation = document.getElementById('main-nav');
    if (!navigation) return;

    const shouldShowNav = isAuthenticated();
    navigation.hidden = !shouldShowNav;
    navigation.setAttribute('aria-hidden', shouldShowNav ? 'false' : 'true');

}

const userMenuState = {
    isOpen: false,
    outsideClickHandler: null,
    escapeHandler: null
};

function getUserMenuElements() {
    const container = document.getElementById('user-menu-container');
    const button = document.getElementById('user-menu-button');
    const dropdown = document.getElementById('user-menu-dropdown');

    return { container, button, dropdown };
}

function closeUserMenuDropdown({ focusButton = false } = {}) {
    const { button, dropdown } = getUserMenuElements();
    if (!button || !dropdown) return;

    if (dropdown.classList.contains('hidden') && !userMenuState.isOpen) {
        return;
    }

    dropdown.classList.add('hidden');
    dropdown.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');

    if (userMenuState.outsideClickHandler) {
        document.removeEventListener('mousedown', userMenuState.outsideClickHandler);
        document.removeEventListener('touchstart', userMenuState.outsideClickHandler);
        userMenuState.outsideClickHandler = null;
    }

    if (userMenuState.escapeHandler) {
        document.removeEventListener('keydown', userMenuState.escapeHandler);
        userMenuState.escapeHandler = null;
    }

    userMenuState.isOpen = false;

    if (focusButton) {
        button.focus();
    }
}

function openUserMenuDropdown() {
    if (!appState.user) {
        navigateTo('/login');
        return;
    }

    const { container, button, dropdown } = getUserMenuElements();
    if (!button || !dropdown) return;

    if (userMenuState.isOpen) {
        return;
    }

    dropdown.classList.remove('hidden');
    dropdown.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');

    if (window.lucide) {
        window.lucide.createIcons();
    }

    userMenuState.isOpen = true;

    const menuContainer = container;

    setTimeout(() => {
        const firstMenuItem = dropdown.querySelector('button, a, [tabindex="0"]');
        if (firstMenuItem) {
            firstMenuItem.focus();
        }
    }, 0);

    userMenuState.outsideClickHandler = event => {
        if (menuContainer && menuContainer.contains(event.target)) {
            return;
        }

        closeUserMenuDropdown();
    };

    userMenuState.escapeHandler = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeUserMenuDropdown({ focusButton: true });
        }
    };

    document.addEventListener('mousedown', userMenuState.outsideClickHandler);
    document.addEventListener('touchstart', userMenuState.outsideClickHandler);
    document.addEventListener('keydown', userMenuState.escapeHandler);
}

/**
 * Toggle del menú de usuario con verificación de sesión
 */
function toggleUserMenuDropdown() {
    if (!appState.session) {
        navigateTo('/login', { message: 'Sesión expirada', type: 'warning' }, true);
        return;
    }
    
    if (userMenuState.isOpen) {
        closeUserMenuDropdown();
    } else {
        openUserMenuDropdown();
    }
}
/*
function toggleUserMenuDropdown() {
    if (userMenuState.isOpen) {
        closeUserMenuDropdown();
    } else {
        openUserMenuDropdown();
    }
}*/


function openChangePasswordModal({ onSuccess = null, onCancel = null } = {}) {
    const passwordRules = VALIDATION?.password || {};
    const passwordMinLength = passwordRules?.minLength || 8;
    const passwordMaxLengthAttr = passwordRules?.maxLength ? ` maxlength="${passwordRules.maxLength}"` : '';
    const passwordRequirementsMessage = escapeHTML(
        passwordRules?.message || 'La contraseña debe cumplir con los requisitos de seguridad.'
    );

    let wasSuccessful = false;

    const modalId = ui.showModal({
        title: 'Cambiar contraseña',
        content: `
            <form id="change-password-form" class="space-y-3" novalidate>
                <div>
                    <label for="current-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contraseña actual</label>
                    <input
                        id="current-password"
                        name="currentPassword"
                        type="password"
                        autocomplete="current-password"
                        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/20"
                        required
                    />
                </div>
                <div>
                    <label for="new-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nueva contraseña</label>
                    <input
                        id="new-password"
                        name="newPassword"
                        type="password"
                        autocomplete="new-password"
                        minlength="${passwordMinLength}"${passwordMaxLengthAttr}
                        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/20"
                        required
                    />
                </div>
                <div>
                    <label for="confirm-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Confirmar nueva contraseña</label>
                    <input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        autocomplete="new-password"
                        minlength="${passwordMinLength}"${passwordMaxLengthAttr}
                        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/20"
                        required
                    />
                </div>
                <p id="change-password-feedback" class="text-xs hidden"></p>
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-xs leading-snug text-gray-500 sm:max-w-xs">
                        ${passwordRequirementsMessage}
                    </p>
                    <button
                        id="change-password-submit"
                        type="submit"
                        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-aifa-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aifa-blue sm:w-auto"
                    >
                        <span id="change-password-submit-content" class="inline-flex items-center gap-2">
                            <i data-lucide="key-round" class="h-4 w-4"></i>
                            Actualizar contraseña
                        </span>
                        <span id="change-password-submit-loading" class="hidden items-center gap-2">
                            <i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i>
                            Guardando...
                        </span>
                    </button>
                </div>
            </form>
        `,
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            }
        ],
        onClose: () => {
            if (!wasSuccessful && typeof onCancel === 'function') {
                setTimeout(() => onCancel(), 0);
            }
        }
    });

    setTimeout(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }

        const changePasswordForm = document.getElementById('change-password-form');
        const changePasswordButton = document.getElementById('change-password-submit');
        const changePasswordFeedback = document.getElementById('change-password-feedback');
        const changePasswordButtonContent = document.getElementById('change-password-submit-content');
        const changePasswordButtonLoading = document.getElementById('change-password-submit-loading');
        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');

        if (
            changePasswordForm &&
            changePasswordButton &&
            changePasswordFeedback &&
            changePasswordButtonContent &&
            changePasswordButtonLoading &&
            currentPasswordInput &&
            newPasswordInput &&
            confirmPasswordInput
        ) {
            const inputs = [currentPasswordInput, newPasswordInput, confirmPasswordInput];

            const clearFeedback = () => {
                changePasswordFeedback.textContent = '';
                changePasswordFeedback.classList.add('hidden');
                changePasswordFeedback.classList.remove('text-red-600', 'text-green-600');
            };

            const showFeedback = (message, type = 'error') => {
                changePasswordFeedback.textContent = message;
                changePasswordFeedback.classList.remove('hidden');
                changePasswordFeedback.classList.remove('text-red-600', 'text-green-600');
                changePasswordFeedback.classList.add(type === 'success' ? 'text-green-600' : 'text-red-600');
            };

            const toggleButtonLoading = (isLoading) => {
                changePasswordButton.disabled = isLoading;
                changePasswordButton.classList.toggle('btn-disabled', isLoading);
                if (isLoading) {
                    changePasswordButtonContent.classList.add('hidden');
                    changePasswordButtonLoading.classList.remove('hidden');
                } else {
                    changePasswordButtonContent.classList.remove('hidden');
                    changePasswordButtonLoading.classList.add('hidden');
                }
            };

            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    input.classList.remove('input-error');
                    if (!changePasswordFeedback.classList.contains('hidden')) {
                        clearFeedback();
                    }
                });
            });

            changePasswordForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                inputs.forEach(input => input.classList.remove('input-error'));
                clearFeedback();

                const currentPassword = currentPasswordInput.value;
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (!currentPassword.trim()) {
                    currentPasswordInput.classList.add('input-error');
                    currentPasswordInput.focus();
                    showFeedback('Ingresa tu contraseña actual.', 'error');
                    return;
                }

                if (!newPassword.trim()) {
                    newPasswordInput.classList.add('input-error');
                    newPasswordInput.focus();
                    showFeedback('Ingresa una nueva contraseña.', 'error');
                    return;
                }

                if (passwordRules.minLength && newPassword.length < passwordRules.minLength) {
                    newPasswordInput.classList.add('input-error');
                    newPasswordInput.focus();
                    showFeedback(passwordRules.message || `La contraseña debe tener al menos ${passwordRules.minLength} caracteres.`, 'error');
                    return;
                }

                if (passwordRules.maxLength && newPassword.length > passwordRules.maxLength) {
                    newPasswordInput.classList.add('input-error');
                    newPasswordInput.focus();
                    showFeedback(`La contraseña no puede exceder ${passwordRules.maxLength} caracteres.`, 'error');
                    return;
                }

                if (passwordRules.pattern instanceof RegExp && !passwordRules.pattern.test(newPassword)) {
                    newPasswordInput.classList.add('input-error');
                    newPasswordInput.focus();
                    showFeedback(passwordRules.message || 'La contraseña no cumple con los requisitos de seguridad.', 'error');
                    return;
                }

                if (newPassword === currentPassword) {
                    newPasswordInput.classList.add('input-error');
                    newPasswordInput.focus();
                    showFeedback('La nueva contraseña debe ser diferente a la actual.', 'error');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    confirmPasswordInput.classList.add('input-error');
                    confirmPasswordInput.focus();
                    showFeedback('La confirmación no coincide con la nueva contraseña.', 'error');
                    return;
                }

                try {
                    toggleButtonLoading(true);
                    await changePassword(currentPassword, newPassword);
                    showFeedback('Contraseña actualizada correctamente.', 'success');
                    changePasswordForm.reset();
                    inputs.forEach(input => input.classList.remove('input-error'));
                    ui.showToast('Contraseña actualizada correctamente', 'success');

                    wasSuccessful = true;
                    setTimeout(() => {
                        ui.hideModal(modalId);
                        if (typeof onSuccess === 'function') {
                            onSuccess();
                        }
                    }, 600);
                } catch (error) {
                    console.error('Error al cambiar contraseña:', error);
                    const message = error?.message || 'No se pudo actualizar la contraseña.';
                    showFeedback(message, 'error');
                } finally {
                    toggleButtonLoading(false);
                }
            });
        }
    }, 100);
}
function setupUserMenu() {
    const { button } = getUserMenuElements();
    if (!button) return;

    button.addEventListener('click', event => {
        event.preventDefault();
        
        // Verificar que la sesión siga activa antes de abrir el menú
        if (!appState.session) {
            navigateTo('/login', { message: 'Sesión expirada', type: 'warning' }, true);
            return;
        }
        
        toggleUserMenuDropdown();
    });

    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            
            // Verificar sesión antes de abrir
            if (!appState.session) {
                navigateTo('/login', { message: 'Sesión expirada', type: 'warning' }, true);
                return;
            }
            
            openUserMenuDropdown();
        }

        if (event.key === 'Escape' && userMenuState.isOpen) {
            event.preventDefault();
            closeUserMenuDropdown({ focusButton: true });
        }
    });

    const changePasswordButton = document.getElementById('user-menu-change-password');
    if (changePasswordButton) {
        changePasswordButton.addEventListener('click', event => {
            event.preventDefault();
            closeUserMenuDropdown();

            setTimeout(() => {
                openChangePasswordModal();
            }, 50);
        });
    }

    const signOutButton = document.getElementById('user-menu-signout');
    if (signOutButton) {
        signOutButton.addEventListener('click', async event => {
            event.preventDefault();
            closeUserMenuDropdown();

            try {
                const confirmed = await ui.showConfirmModal('¿Estás seguro de cerrar sesión?', {
                    title: 'Confirmar cierre de sesión',
                    confirmText: 'Cerrar sesión',
                    cancelText: 'Cancelar',
                    type: 'warning'
                });

                if (!confirmed) {
                    return;
                }

                // Limpiar todos los intervals antes de cerrar sesión
                if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
                if (window.homeRefreshInterval) clearInterval(window.homeRefreshInterval);
                if (window.areaRefreshInterval) clearInterval(window.areaRefreshInterval);
                
                // Limpiar sessionStorage
                sessionStorage.removeItem('aifa-session-backup');
                sessionStorage.removeItem('aifa-last-activity');

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
        setupSessionMonitoring();

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
/**
 * Manejar antes de cerrar ventana
 */
function handleBeforeUnload(event) {
    // Guardar estado actual si hay sesión
    if (appState.session) {
        sessionStorage.setItem('aifa-last-activity', Date.now().toString());
    }
}

/**
 * Manejar cuando se oculta la página
 */
function handlePageHide(event) {
    // Limpiar intervals al salir
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
    }
}

async function handleStorageEvent(event) {
    if (event.storageArea !== localStorage) return;
    if (event.key !== 'supabase.auth.token') return;
    if (event.newValue || !appState.session) return;

    if (DEBUG.enabled) {
        console.warn('⚠️ Sesión posiblemente cerrada en otra pestaña');
    }

    try {
        const session = await getCurrentSession({ allowRefresh: true, silent: true });
        if (session) {
            return;
        }
    } catch (error) {
        if (DEBUG.enabled) {
            console.warn('⚠️ Error al confirmar cierre de sesión desde storage event:', error);
        }
    }

    appState.session = null;
    appState.user = null;
    appState.profile = null;


    navigateTo('/login', {
        message: 'Sesión cerrada en otra ventana',
        type: 'info'
    }, true);
}
/**
 * Configurar monitoreo de sesión
 */
function setupSessionMonitoring() {
    if (sessionMonitoringConfigured) {
        return;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('storage', handleStorageEvent);

    sessionMonitoringConfigured = true;
}
/**
 * Limpiar recursos al cerrar/recargar la página
 */
window.addEventListener('beforeunload', () => {
    // Limpiar todos los intervals
    if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
    if (window.homeRefreshInterval) clearInterval(window.homeRefreshInterval);
    if (window.areaRefreshInterval) clearInterval(window.areaRefreshInterval);
    if (window.visualizacionRefreshInterval) clearInterval(window.visualizacionRefreshInterval);
    
    // Guardar timestamp de última actividad
    if (appState.session) {
        sessionStorage.setItem('aifa-last-activity', Date.now().toString());
    }
});
