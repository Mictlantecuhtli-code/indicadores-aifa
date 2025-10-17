import { renderDashboard } from './views/dashboard.js';
import { renderIndicators } from './views/indicators.js';
import { renderCapture } from './views/capture.js';
import { renderVisualizationReact } from './views/visualizationReact.js';
import { renderUsers } from './views/users.js';
import { renderLogin } from './views/login.js';
import { renderAirportInfo } from './views/airportInfo.js';
import { getSession, setSession, subscribe } from './state/session.js';
import { renderLayout, highlightActiveRoute } from './ui/layout.js';
import { supabase, signOut } from './services/supabaseClient.js';
import { showToast } from './ui/feedback.js';
import { getRoutesForRole, getDefaultRouteForRole } from './constants/legacyAccess.js';

const routes = {
  login: renderLogin,
  dashboard: renderDashboard,
  visualizacion: renderVisualizationReact,
  'airport-info': renderAirportInfo,
  indicators: renderIndicators,
  capture: renderCapture,
  users: renderUsers
};

function getRouteFromHash() {
  const currentHash = (window.location.hash || '').replace('#', '');

  if (currentHash) {
    return currentHash;
  }

  const role = getUserRole();
  return getDefaultRouteForRole(role);
}

import { getUserRole } from './state/session.js';

async function ensureAuthenticated(routeId) {
  const session = getSession();
  if (!session && routeId !== 'login') {
    window.location.hash = '#login';
    return false;
  }
  if (session && routeId === 'login') {
    window.location.hash = '#dashboard';
    return false;
  }
  
  // Validar permisos por rol
  if (session) {
    const userRole = getUserRole();
    const allowedRoutes = getRoutesForRole(userRole);

    if (!allowedRoutes.includes(routeId)) {
      const fallbackRoute = getDefaultRouteForRole(userRole);

      if (routeId !== fallbackRoute) {
        showToast('No tienes permisos para acceder a esta sección', { type: 'error' });
      }

      window.location.hash = `#${fallbackRoute}`;
      return false;
    }
  }
  
  return true;
}

function bindLayoutActions() {
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

  const closeMobileMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.hidden = true;
    if (mobileMenuToggle) {
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
  };

  if (mobileMenu) {
    mobileMenu.querySelectorAll('a[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });
  }

  const accountMenuContainer = document.getElementById('account-menu-container');
  const accountMenuToggle = document.getElementById('account-menu-toggle');
  const accountMenu = document.getElementById('account-menu');
  const accountChevron = document.getElementById('account-menu-chevron');
  let isAccountMenuOpen = false;

  const handleAccountClickOutside = event => {
    if (!accountMenuContainer) return;
    if (!accountMenuContainer.contains(event.target)) {
      closeAccountMenu();
    }
  };

  const handleAccountEscape = event => {
    if (event.key === 'Escape') {
      closeAccountMenu();
    }
  };

  function openAccountMenu() {
    if (!accountMenu) return;
    accountMenu.classList.remove('hidden');
    isAccountMenuOpen = true;
    accountMenuToggle?.setAttribute('aria-expanded', 'true');
    accountChevron?.classList.add('rotate-180', 'text-primary-600');
    document.addEventListener('mousedown', handleAccountClickOutside);
    document.addEventListener('keydown', handleAccountEscape);
  }

  function closeAccountMenu() {
    if (!accountMenu) return;
    accountMenu.classList.add('hidden');
    isAccountMenuOpen = false;
    accountMenuToggle?.setAttribute('aria-expanded', 'false');
    accountChevron?.classList.remove('rotate-180', 'text-primary-600');
    document.removeEventListener('mousedown', handleAccountClickOutside);
    document.removeEventListener('keydown', handleAccountEscape);
  }

  if (accountMenuToggle && accountMenu) {
    accountMenuToggle.addEventListener('click', event => {
      event.preventDefault();
      if (isAccountMenuOpen) {
        closeAccountMenu();
      } else {
        openAccountMenu();
      }
    });
  }

  const signOutButtons = document.querySelectorAll('[data-action="sign-out"]');
  let signingOut = false;

  async function handleSignOut(event) {
    event.preventDefault();
    if (signingOut) return;
    signingOut = true;
    closeAccountMenu();
    closeMobileMenu();
    signOutButtons.forEach(button => {
      button.disabled = true;
      button.classList.add('opacity-70');
    });

    try {
      await signOut();
    } catch (error) {
      console.error(error);
    } finally {
      signingOut = false;
      signOutButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-70');
      });
    }

    setSession(null);
    showToast('Sesión cerrada correctamente', { type: 'success' });
    window.location.hash = '#login';
  }

  signOutButtons.forEach(button => {
    button.addEventListener('click', handleSignOut);
  });

  const changePasswordModal = document.getElementById('change-password-modal');
  const changePasswordForm = document.getElementById('change-password-form');
  const changePasswordButtons = document.querySelectorAll('[data-action="open-change-password"]');
  const changePasswordCloseElements = changePasswordModal
    ? changePasswordModal.querySelectorAll('[data-action="close-change-password"]')
    : [];
  const passwordToggleButtons = changePasswordModal
    ? changePasswordModal.querySelectorAll('[data-toggle-password]')
    : [];
  const submitButton = changePasswordForm?.querySelector('button[type="submit"]');

  const fieldConfig = changePasswordForm
    ? {
        current: {
          input: changePasswordForm.querySelector('input[name="current-password"]'),
          error: document.getElementById('error-current-password')
        },
        new: {
          input: changePasswordForm.querySelector('input[name="new-password"]'),
          error: document.getElementById('error-new-password')
        },
        confirm: {
          input: changePasswordForm.querySelector('input[name="confirm-password"]'),
          error: document.getElementById('error-confirm-password')
        }
      }
    : {};

  const renderFieldError = (field, messages) => {
    const config = fieldConfig[field];
    if (!config) return;
    const { input, error } = config;
    if (!input || !error) return;

    input.classList.remove('border-rose-400');
    error.classList.add('hidden');
    error.innerHTML = '';

    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      return;
    }

    input.classList.add('border-rose-400');
    error.classList.remove('hidden');

    if (Array.isArray(messages)) {
      const list = document.createElement('ul');
      list.className = 'space-y-1';
      messages.forEach(message => {
        const item = document.createElement('li');
        item.className = 'flex items-start gap-2';
        const bullet = document.createElement('span');
        bullet.className = 'mt-1 block h-1.5 w-1.5 rounded-full bg-rose-500';
        const text = document.createElement('span');
        text.textContent = message;
        item.appendChild(bullet);
        item.appendChild(text);
        list.appendChild(item);
      });
      error.appendChild(list);
    } else {
      const text = document.createElement('span');
      text.textContent = messages;
      error.appendChild(text);
    }
  };

  const resetChangePasswordForm = () => {
    if (!changePasswordForm) return;
    changePasswordForm.reset();
    Object.keys(fieldConfig).forEach(field => renderFieldError(field, null));
    passwordToggleButtons.forEach(button => {
      const target = button.getAttribute('data-toggle-password');
      if (!target) return;
      const input = changePasswordForm.querySelector(`input[name="${target}"]`);
      if (input) {
        input.type = 'password';
      }
      const icon = button.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
      button.setAttribute('aria-label', 'Mostrar contraseña');
    });
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitButton.dataset.defaultText ?? 'Guardar nueva contraseña';
    }
  };

  const handleModalEscape = event => {
    if (event.key === 'Escape') {
      closeChangePasswordModal();
    }
  };

  const openChangePasswordModal = event => {
    event?.preventDefault();
    if (!changePasswordModal) return;
    resetChangePasswordForm();
    closeAccountMenu();
    closeMobileMenu();
    changePasswordModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleModalEscape);
    const firstInput = changePasswordForm?.querySelector('input[name="current-password"]');
    if (firstInput) {
      firstInput.focus();
      firstInput.setSelectionRange(firstInput.value.length, firstInput.value.length);
    }
  };

  const closeChangePasswordModal = () => {
    if (!changePasswordModal) return;
    changePasswordModal.classList.add('hidden');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalEscape);
  };

  changePasswordButtons.forEach(button => {
    button.addEventListener('click', openChangePasswordModal);
  });

  changePasswordCloseElements.forEach(element => {
    element.addEventListener('click', event => {
      event.preventDefault();
      closeChangePasswordModal();
      resetChangePasswordForm();
    });
  });

  passwordToggleButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const target = button.getAttribute('data-toggle-password');
      if (!target || !changePasswordForm) return;
      const input = changePasswordForm.querySelector(`input[name="${target}"]`);
      if (!input) return;
      const icon = button.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        }
        button.setAttribute('aria-label', 'Ocultar contraseña');
      } else {
        input.type = 'password';
        if (icon) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
        button.setAttribute('aria-label', 'Mostrar contraseña');
      }
    });
  });

  const validatePasswordForm = (currentPassword, newPassword, confirmPassword) => {
    const errors = {};

    if (!currentPassword) {
      errors.current = 'Capture la contraseña anterior.';
    }

    if (!newPassword) {
      errors.new = ['Capture la nueva contraseña.'];
    } else {
      const newPasswordErrors = [];
      if (newPassword === currentPassword) {
        newPasswordErrors.push('La nueva contraseña debe ser diferente a la anterior.');
      }

      const requirements = [
        { test: newPassword.length >= 8, message: 'Debe tener al menos 8 caracteres.' },
        { test: /[A-Z]/.test(newPassword), message: 'Debe incluir al menos una letra mayúscula.' },
        { test: /[a-z]/.test(newPassword), message: 'Debe incluir al menos una letra minúscula.' },
        { test: /[0-9]/.test(newPassword), message: 'Debe incluir al menos un número.' },
        { test: /[^A-Za-z0-9]/.test(newPassword), message: 'Debe incluir al menos un carácter especial.' }
      ];

      requirements
        .filter(requirement => !requirement.test)
        .forEach(requirement => newPasswordErrors.push(requirement.message));

      if (newPasswordErrors.length) {
        errors.new = newPasswordErrors;
      }
    }

    if (!confirmPassword) {
      errors.confirm = 'Confirme la nueva contraseña.';
    } else if (newPassword !== confirmPassword) {
      errors.confirm = 'Las contraseñas no coinciden.';
    }

    return errors;
  };

  const handleChangePasswordSubmit = async event => {
    event.preventDefault();
    if (!changePasswordForm) return;

    const formData = new FormData(changePasswordForm);
    const currentPassword = (formData.get('current-password') ?? '').toString().trim();
    const newPassword = (formData.get('new-password') ?? '').toString();
    const confirmPassword = (formData.get('confirm-password') ?? '').toString();

    const errors = validatePasswordForm(currentPassword, newPassword, confirmPassword);

    ['current', 'new', 'confirm'].forEach(field => {
      renderFieldError(field, errors[field] ?? null);
    });

    if (Object.keys(errors).length) {
      return;
    }

    const session = getSession();
    const email = (session?.perfil?.email ?? session?.user?.email ?? '').trim().toLowerCase();

    if (!email) {
      showToast('No se pudo identificar el correo de la cuenta.', { type: 'error' });
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = submitButton.dataset.loadingText ?? 'Guardando...';
    }

    try {
      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (verificationError) {
        renderFieldError('current', 'La contraseña anterior no es correcta.');
        showToast('La contraseña anterior no es correcta.', { type: 'error' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        throw updateError;
      }

      showToast('Contraseña actualizada correctamente.');
      closeChangePasswordModal();
      resetChangePasswordForm();
    } catch (error) {
      console.error('No fue posible actualizar la contraseña', error);
      showToast('No fue posible actualizar la contraseña. Intente nuevamente.', { type: 'error' });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.defaultText ?? 'Guardar nueva contraseña';
      }
    }
  };

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', handleChangePasswordSubmit);
  }
}

export async function renderRoute() {
  const app = document.getElementById('app');
  const routeId = getRouteFromHash();
  const handler = routes[routeId] ?? renderDashboard;

  const allowed = await ensureAuthenticated(routeId);
  if (!allowed) return;

  if (routeId === 'login') {
    handler(app);
    return;
  }

  app.innerHTML = renderLayout('<div></div>');
  highlightActiveRoute(routeId);
  const content = document.getElementById('content');
  await handler(content);
  bindLayoutActions();
}

export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  subscribe(() => renderRoute());
  renderRoute();
}
