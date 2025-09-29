import { VALIDATION } from '../../config.js';
import { navigateTo, parseCurrentRoute } from '../../lib/router.js';
import { appState, changePassword, isAuthenticated, signOut, redirectToLogin } from '../../lib/supa.js';
import * as ui from '../../lib/ui.js';
import { clearAppIntervals } from './session.js';

const ROLE_NAMES = {
    ADMIN: 'Administrador',
    DIRECTOR: 'Director',
    SUBDIRECTOR: 'Subdirector',
    JEFE_AREA: 'Jefe de Área',
    CAPTURISTA: 'Capturista'
};

const ROLE_NAVIGATION_RULES = {
    DIRECTOR: new Set(['nav-visualizacion', 'nav-panel-directivos'])
};

const INTERVAL_STORAGE_KEYS = ['aifa-session-backup', 'aifa-last-activity'];

const headerElements = {
    navigation: null,
    userName: null,
    userRole: null,
    userMenuButton: null,
    userMenuContainer: null,
    userMenuDropdown: null,
    changePasswordButton: null,
    signOutButton: null
};

const navigationButtons = new Map();

let navigationBindings = new Map();
let routeDefinitions = [];

const userMenuState = {
    isOpen: false,
    outsideClickHandler: null,
    escapeHandler: null
};

function cacheHeaderElements() {
    headerElements.navigation = document.getElementById('main-nav');
    headerElements.userName = document.getElementById('user-name');
    headerElements.userRole = document.getElementById('user-role');
    headerElements.userMenuButton = document.getElementById('user-menu-button');
    headerElements.userMenuContainer = document.getElementById('user-menu-container');
    headerElements.userMenuDropdown = document.getElementById('user-menu-dropdown');
    headerElements.changePasswordButton = document.getElementById('user-menu-change-password');
    headerElements.signOutButton = document.getElementById('user-menu-signout');

    navigationButtons.clear();
    if (headerElements.navigation) {
        headerElements.navigation.querySelectorAll('[id^="nav-"]').forEach(button => {
            navigationButtons.set(button.id, button);
        });
    }
}

function getRoleLabel(role) {
    return ROLE_NAMES[role] || role || 'Sin rol';
}

function getUserMenuElements() {
    return {
        button: headerElements.userMenuButton,
        dropdown: headerElements.userMenuDropdown,
        container: headerElements.userMenuContainer
    };
}

function detachOutsideInteractions() {
    if (userMenuState.outsideClickHandler) {
        document.removeEventListener('mousedown', userMenuState.outsideClickHandler);
        document.removeEventListener('touchstart', userMenuState.outsideClickHandler);
        userMenuState.outsideClickHandler = null;
    }

    if (userMenuState.escapeHandler) {
        document.removeEventListener('keydown', userMenuState.escapeHandler);
        userMenuState.escapeHandler = null;
    }
}

function focusFirstMenuItem(dropdown) {
    const firstItem = dropdown?.querySelector('button, a, [tabindex="0"]');
    if (!firstItem) return;

    requestAnimationFrame(() => firstItem.focus());
}

function toggleMenuButtonAccessibility(isOpen) {
    const { button } = getUserMenuElements();
    if (!button) return;

    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function openUserMenuDropdown() {
    const { button, dropdown, container } = getUserMenuElements();
    if (!button || !dropdown || userMenuState.isOpen) {
        return;
    }

    if (!appState.user) {
        redirectToLogin({}, true);
        return;
    }

    dropdown.classList.remove('hidden');
    dropdown.setAttribute('aria-hidden', 'false');
    toggleMenuButtonAccessibility(true);
    userMenuState.isOpen = true;

    if (window.lucide) {
        window.lucide.createIcons();
    }

    focusFirstMenuItem(dropdown);

    userMenuState.outsideClickHandler = event => {
        if (container?.contains(event.target)) {
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

function closeUserMenuDropdown({ focusButton = false } = {}) {
    const { button, dropdown } = getUserMenuElements();
    if (!button || !dropdown) return;

    if (dropdown.classList.contains('hidden') && !userMenuState.isOpen) {
        return;
    }

    dropdown.classList.add('hidden');
    dropdown.setAttribute('aria-hidden', 'true');
    toggleMenuButtonAccessibility(false);
    detachOutsideInteractions();
    userMenuState.isOpen = false;

    if (focusButton) {
        button.focus();
    }
}

function toggleUserMenuDropdown() {
    if (!appState.session) {
        redirectToLogin({ message: 'Sesión expirada', type: 'warning' }, true);
        return;
    }

    if (userMenuState.isOpen) {
        closeUserMenuDropdown();
    } else {
        openUserMenuDropdown();
    }
}

function getPasswordRules() {
    return VALIDATION?.password || {};
}

function getInputValue(input) {
    return input?.value?.trim() || '';
}

function resetPasswordInputs(inputs) {
    const fields = Array.isArray(inputs) ? inputs : Object.values(inputs || {});
    fields.forEach(input => input?.classList?.remove('input-error'));
}

function showPasswordFeedback(element, message, type = 'info') {
    if (!element) return;

    element.textContent = message;
    element.classList.remove('hidden');
    element.classList.remove('text-green-600', 'text-red-600');
    element.classList.add(type === 'success' ? 'text-green-600' : 'text-red-600');
}

function togglePasswordButtonLoading(isLoading) {
    const submitButton = document.getElementById('change-password-submit');
    const content = document.getElementById('change-password-submit-content');
    const loading = document.getElementById('change-password-submit-loading');

    if (!submitButton || !content || !loading) return;

    submitButton.disabled = isLoading;
    submitButton.classList.toggle('btn-disabled', isLoading);
    content.classList.toggle('hidden', isLoading);
    loading.classList.toggle('hidden', !isLoading);
}

function validatePasswordPayload({ currentPassword, newPassword, confirmPassword }, inputs, feedback) {
    const rules = getPasswordRules();

    resetPasswordInputs(inputs);

    if (!currentPassword) {
        inputs.current?.classList.add('input-error');
        inputs.current?.focus();
        showPasswordFeedback(feedback, 'Ingresa tu contraseña actual.', 'error');
        return false;
    }

    if (!newPassword) {
        inputs.new?.classList.add('input-error');
        inputs.new?.focus();
        showPasswordFeedback(feedback, 'Ingresa una nueva contraseña.', 'error');
        return false;
    }

    if (rules.minLength && newPassword.length < rules.minLength) {
        inputs.new?.classList.add('input-error');
        inputs.new?.focus();
        showPasswordFeedback(
            feedback,
            rules.message || `La contraseña debe tener al menos ${rules.minLength} caracteres.`,
            'error'
        );
        return false;
    }

    if (rules.maxLength && newPassword.length > rules.maxLength) {
        inputs.new?.classList.add('input-error');
        inputs.new?.focus();
        showPasswordFeedback(feedback, `La contraseña no puede exceder ${rules.maxLength} caracteres.`, 'error');
        return false;
    }

    if (rules.pattern instanceof RegExp && !rules.pattern.test(newPassword)) {
        inputs.new?.classList.add('input-error');
        inputs.new?.focus();
        showPasswordFeedback(
            feedback,
            rules.message || 'La contraseña no cumple con los requisitos de seguridad.',
            'error'
        );
        return false;
    }

    if (newPassword === currentPassword) {
        inputs.new?.classList.add('input-error');
        inputs.new?.focus();
        showPasswordFeedback(feedback, 'La nueva contraseña debe ser diferente a la actual.', 'error');
        return false;
    }

    if (!confirmPassword) {
        inputs.confirm?.classList.add('input-error');
        inputs.confirm?.focus();
        showPasswordFeedback(feedback, 'Confirma tu nueva contraseña.', 'error');
        return false;
    }

    if (newPassword !== confirmPassword) {
        inputs.confirm?.classList.add('input-error');
        inputs.confirm?.focus();
        showPasswordFeedback(feedback, 'La confirmación no coincide con la nueva contraseña.', 'error');
        return false;
    }

    return true;
}

function buildPasswordFormContent() {
    const rules = getPasswordRules();
    const minLength = rules?.minLength || 8;
    const maxLengthAttr = rules?.maxLength ? ` maxlength="${rules.maxLength}"` : '';
    const requirements = rules?.message || 'La contraseña debe cumplir con los requisitos de seguridad.';

    return `
        <form id="change-password-form" class="space-y-3" novalidate>
            <div>
                <label for="current-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contraseña actual
                </label>
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
                <label for="new-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nueva contraseña
                </label>
                <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    autocomplete="new-password"
                    minlength="${minLength}"${maxLengthAttr}
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/20"
                    required
                />
            </div>
            <div>
                <label for="confirm-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Confirmar nueva contraseña
                </label>
                <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    minlength="${minLength}"${maxLengthAttr}
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/20"
                    required
                />
            </div>
            <p id="change-password-feedback" class="text-xs hidden"></p>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-xs leading-snug text-gray-500 sm:max-w-xs">
                    ${requirements}
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
    `;
}

function buildPasswordModalOptions() {
    return {
        title: 'Cambiar contraseña',
        content: buildPasswordFormContent(),
        actions: [
            {
                text: 'Cancelar',
                handler: () => true
            }
        ]
    };
}

function handlePasswordFormSubmission(form, modalId, { onSuccess, onCancel } = {}) {
    const feedback = document.getElementById('change-password-feedback');
    const inputs = {
        current: form.querySelector('#current-password'),
        new: form.querySelector('#new-password'),
        confirm: form.querySelector('#confirm-password')
    };

    const collectPayload = () => ({
        currentPassword: getInputValue(inputs.current),
        newPassword: getInputValue(inputs.new),
        confirmPassword: getInputValue(inputs.confirm)
    });

    const resetFeedback = () => {
        if (!feedback) return;
        feedback.textContent = '';
        feedback.classList.add('hidden');
        feedback.classList.remove('text-green-600', 'text-red-600');
    };

    Object.values(inputs).forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            resetFeedback();
        });
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const payload = collectPayload();
        resetFeedback();

        if (!validatePasswordPayload(payload, inputs, feedback)) {
            return;
        }

        try {
            togglePasswordButtonLoading(true);
            await changePassword(payload.currentPassword, payload.newPassword);
            showPasswordFeedback(feedback, 'Contraseña actualizada correctamente.', 'success');
            form.reset();
            resetPasswordInputs(inputs);
            ui.showToast('Contraseña actualizada correctamente', 'success');

            setTimeout(() => {
                ui.hideModal(modalId);
                onSuccess?.();
            }, 500);
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            const message = error?.message || 'No se pudo actualizar la contraseña.';
            showPasswordFeedback(feedback, message, 'error');
        } finally {
            togglePasswordButtonLoading(false);
        }
    });

}

function openChangePasswordModal({ onSuccess = null, onCancel = null } = {}) {
    const modalOptions = buildPasswordModalOptions();
    let wasSuccessful = false;

    const modalId = ui.showModal({
        ...modalOptions,
        onClose: () => {
            if (!wasSuccessful) {
                onCancel?.();
            }
        }
    });

    setTimeout(() => {
        const form = document.getElementById('change-password-form');
        if (!form) return;

        if (window.lucide) {
            window.lucide.createIcons();
        }

        handlePasswordFormSubmission(form, modalId, {
            onSuccess: () => {
                wasSuccessful = true;
                onSuccess?.();
            },
            onCancel
        });
    }, 50);
}

function bindChangePasswordAction() {
    const { changePasswordButton } = headerElements;
    if (!changePasswordButton || changePasswordButton.dataset.bound === 'true') {
        return;
    }

    changePasswordButton.dataset.bound = 'true';
    changePasswordButton.addEventListener('click', event => {
        event.preventDefault();
        closeUserMenuDropdown();
        setTimeout(() => openChangePasswordModal(), 40);
    });
}

function bindSignOutAction() {
    const { signOutButton } = headerElements;
    if (!signOutButton || signOutButton.dataset.bound === 'true') {
        return;
    }

    signOutButton.dataset.bound = 'true';
    signOutButton.addEventListener('click', async event => {
        event.preventDefault();
        closeUserMenuDropdown();

        const confirmed = await ui.showConfirmModal('¿Estás seguro de cerrar sesión?', {
            title: 'Confirmar cierre de sesión',
            confirmText: 'Cerrar sesión',
            cancelText: 'Cancelar',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            clearAppIntervals();
            INTERVAL_STORAGE_KEYS.forEach(key => sessionStorage.removeItem(key));

            await signOut();
            ui.showToast('Sesión cerrada correctamente', 'success');

            setTimeout(() => {
                redirectToLogin({}, true);

                window.location.reload();
            }, 300);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            ui.showToast('Error al cerrar sesión', 'error');
        }
    });
}

function bindUserMenuButton() {
    const { button } = getUserMenuElements();
    if (!button || button.dataset.bound === 'true') {
        return;
    }

    button.dataset.bound = 'true';

    button.addEventListener('click', event => {
        event.preventDefault();
        toggleUserMenuDropdown();
    });

    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            openUserMenuDropdown();
        }

        if (event.key === 'Escape' && userMenuState.isOpen) {
            event.preventDefault();
            closeUserMenuDropdown({ focusButton: true });
        }
    });
}

function bindNavigationButtons() {
    if (!(navigationBindings instanceof Map)) {
        navigationBindings = new Map();
    }

    navigationBindings.forEach((path, navId) => {
        const button = document.getElementById(navId);
        if (!button || button.dataset.navBound === 'true') {
            return;
        }

        button.dataset.navBound = 'true';
        button.addEventListener('click', event => {
            event.preventDefault();
            navigateTo(path);
        });
    });
}

function setTextContent(element, text) {
    if (!element) return;
    if (element.textContent !== text) {
        element.textContent = text;
    }
}

function applyRoleNavigationRestrictions() {
    const role = appState.profile?.rol_principal;
    const allowedNavIds = role ? ROLE_NAVIGATION_RULES[role] : null;

    navigationButtons.forEach((button, id) => {
        if (!allowedNavIds) {
            if (button.dataset.roleHidden) {
                button.classList.remove('hidden');
                delete button.dataset.roleHidden;
            }
            return;
        }

        const shouldHide = !allowedNavIds.has(id);
        if (shouldHide) {
            button.dataset.roleHidden = 'true';
            button.classList.add('hidden');
        } else if (button.dataset.roleHidden) {
            button.classList.remove('hidden');
            delete button.dataset.roleHidden;
        }
    });
}

function updateMenuButtonAccessibility() {
    const { userMenuButton } = headerElements;
    if (!userMenuButton) return;

    const { user, profile } = appState;
    const hasUser = Boolean(user && profile);

    userMenuButton.classList.remove('btn-disabled');
    userMenuButton.removeAttribute('disabled');

    const displayName = hasUser
        ? profile?.nombre_completo?.trim() || user?.email || 'Usuario'
        : 'Usuario';

    userMenuButton.setAttribute(
        'aria-label',
        hasUser ? `Menú de usuario ${displayName}` : 'Menú de usuario'
    );

    userMenuButton.setAttribute('aria-expanded', userMenuState.isOpen ? 'true' : 'false');
}

function updateUserHeader() {
    const { user, profile } = appState;
    const hasUser = Boolean(user && profile);

    const displayName = hasUser
        ? profile?.nombre_completo?.trim() || user?.email || 'Usuario'
        : 'Usuario';

    setTextContent(headerElements.userName, displayName);

    if (headerElements.userRole) {
        const roleLabel = hasUser && profile?.rol_principal ? getRoleLabel(profile.rol_principal) : '';
        setTextContent(headerElements.userRole, roleLabel);
        headerElements.userRole.classList.toggle('hidden', !roleLabel);
    }

    updateMenuButtonAccessibility();
    applyRoleNavigationRestrictions();
}

function isPublicRoute(path) {
    if (!Array.isArray(routeDefinitions)) {
        return false;
    }

    for (const candidate of routeDefinitions) {
        if (candidate?.path && candidate.path === path) {
            return candidate.requiresAuth === false;
        }

        if (candidate?.matcher instanceof RegExp && candidate.matcher.test(path)) {
            return candidate.requiresAuth === false;
        }
    }

    return false;
}

function toggleHeaderVisibility({ navigation, userMenuButton }, shouldShow) {
    const hidden = !shouldShow;

    [navigation, userMenuButton].forEach(element => {
        if (!element) return;
        element.hidden = hidden;
        element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        element.classList.toggle('invisible', hidden);
        element.classList.toggle('opacity-0', hidden);
        element.classList.toggle('pointer-events-none', hidden);
    });

    if (hidden) {
        closeUserMenuDropdown();
    }
}

function syncProtectedHeaderVisibility() {
    const navigation = headerElements.navigation;
    const userMenuButton = headerElements.userMenuButton;

    if (!navigation && !userMenuButton) {
        return;
    }

    let currentPath = '/';

    try {
        const { path } = parseCurrentRoute?.() || {};
        currentPath = path || '/';
    } catch (error) {
        console.warn('No se pudo determinar la ruta actual para la visibilidad del header:', error);
    }

    const hasUser = Boolean(appState.user && appState.profile);
    const shouldShowNav = Boolean(hasUser && isAuthenticated() && !isPublicRoute(currentPath));

    toggleHeaderVisibility({ navigation, userMenuButton }, shouldShowNav);

    if (!shouldShowNav) {
        updateMenuButtonAccessibility();
    }
}

function initHeaderModule({ routes = [], navigationMap = new Map() } = {}) {
    routeDefinitions = Array.isArray(routes) ? routes : [];
    navigationBindings = navigationMap instanceof Map ? navigationMap : new Map(navigationMap);

    cacheHeaderElements();
    bindNavigationButtons();
    bindUserMenuButton();
    bindChangePasswordAction();
    bindSignOutAction();
    updateUserHeader();
    syncProtectedHeaderVisibility();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

export {
    initHeaderModule,
    updateUserHeader,
    syncProtectedHeaderVisibility,
    closeUserMenuDropdown
};
