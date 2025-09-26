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

function updateUserHeader() {
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userMenuButton = document.getElementById('user-menu-button');

    const { user, profile } = appState;
    const hasUser = Boolean(user && profile);

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

        if (hasUser) {
            userMenuButton.disabled = false;
            userMenuButton.classList.remove('btn-disabled');
        } else {
            userMenuButton.disabled = true;
            if (!userMenuButton.classList.contains('btn-disabled')) {
                userMenuButton.classList.add('btn-disabled');
            }
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
                <section class="space-y-4 border-t border-gray-100 pt-4">
                    <div class="space-y-1">
                        <h4 class="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <i data-lucide="shield" class="h-4 w-4"></i>
                            Seguridad
                        </h4>
                        <p class="text-xs leading-snug text-gray-500">
                            Actualiza tu contraseña para mantener tu cuenta protegida.
                        </p>
                    </div>
                    <button
                        id="open-change-password"
                        type="button"
                        class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-aifa-blue/30 bg-white px-4 py-2 text-sm font-medium text-aifa-blue transition hover:bg-aifa-blue hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aifa-blue sm:w-auto"
                    >
                        <i data-lucide="key-round" class="h-4 w-4"></i>
                        Cambiar contraseña
                    </button>
                </section>
                <div class="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <p class="text-xs leading-snug text-gray-500">Gestiona tu sesión desde esta ventana.</p>
                    <button id="logout-btn-modal" class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        Cerrar sesión
                    </button>
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

        const changePasswordTrigger = document.getElementById('open-change-password');
        if (changePasswordTrigger) {
            changePasswordTrigger.addEventListener('click', () => {
                ui.hideModal(modalId);

                setTimeout(() => {
                    openChangePasswordModal({
                        onCancel: () => openUserMenu(),
                        onSuccess: () => openUserMenu()
                    });
                }, 120);
            });
        }
    }, 100);
}


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
        syncProtectedHeaderVisibility();

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
