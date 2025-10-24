import { getSession } from '../state/session.js';
import { getUserRole } from '../state/session.js';

function getFilteredNavItems() {
  const userRole = getUserRole();
  if (!userRole) return NAV_ITEMS; // Si no hay rol, mostrar todo (fallback)
  
  return NAV_ITEMS.filter(item => item.roles.includes(userRole));
}
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Panel Directivos',
    icon: 'fa-chart-line',
    roles: ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN']
  },
  {
    id: 'visualizacion',
    label: 'Visualización de Indicadores',
    icon: 'fa-chart-area',
    roles: ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'] // Todos pueden ver
  },
  {
    id: 'airport-info',
    label: 'Información Técnica AIFA',
    icon: 'fa-plane-departure',
    roles: ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN']
  },
  {
    id: 'indicators',
    label: 'Consulta de Indicadores',
    icon: 'fa-table',
    roles: ['SUBDIRECTOR', 'ADMIN'] // Director y capturista NO pueden ver
  },
  {
    id: 'capture',
    label: 'Captura de Indicadores',
    icon: 'fa-pen-to-square',
    roles: ['SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'] // Director NO puede ver
  },
  { 
    id: 'users', 
    label: 'Administración de Usuarios', 
    icon: 'fa-users-gear',
    roles: ['ADMIN'] // Solo admin puede ver
  }
];

export function renderLayout(content) {
  const user = getSession();
  const profile = user?.perfil ?? {};
  const accountEmail = profile.email ?? user?.user?.email ?? '';
  const accountName = profile.nombre_completo ?? profile.nombre ?? accountEmail ?? 'Sesión no iniciada';
  const accountRole =
    profile.rol_principal ??
    user?.rol ??
    'AIFA';
  return `
    <div class="min-h-screen bg-slate-100">
      <header class="relative z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div class="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div class="flex items-center gap-4">
            <img src="./assets/AIFA_logo.png" alt="Logotipo AIFA" class="h-12 w-auto" />
            <div class="hidden sm:block">
              <p class="text-xs font-semibold uppercase tracking-[0.4em] text-primary-700">AIFA</p>
              <h1 class="text-sm font-semibold text-slate-700">Sistema de Indicadores</h1>
            </div>
          </div>
          <nav class="hidden items-center gap-2 lg:flex" id="main-menu">
            ${getFilteredNavItems().map(
              item => `
                <a
                  href="#${item.id}"
                  data-route="${item.id}"
                  class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <i class="fa-solid ${item.icon}"></i>
                  </span>
                  ${item.label}
                </a>
              `
            ).join('')}
          </nav>
          <div class="flex items-center gap-3">
            <div class="relative" id="account-menu-container">
              <button
                id="account-menu-toggle"
                type="button"
                class="inline-flex items-center gap-3 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-primary-500 hover:text-primary-600"
                aria-haspopup="menu"
                aria-expanded="false"
              >
                <span class="truncate text-xs font-semibold text-slate-800 sm:text-sm">${accountName || 'Sesión no iniciada'}</span>
                <i class="fa-solid fa-chevron-down text-xs transition-transform" id="account-menu-chevron"></i>
              </button>
              <div
                id="account-menu"
                class="absolute right-0 z-50 mt-2 hidden w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                role="menu"
                aria-labelledby="account-menu-toggle"
              >
                <div class="border-b border-slate-100 px-4 py-3 text-sm">
                  <p class="font-semibold text-slate-800">${accountName || 'Usuario'}</p>
                  <p class="mt-1 text-xs uppercase tracking-widest text-slate-400">${accountRole || '—'}</p>
                  <p class="mt-1 break-all text-xs text-slate-500">${accountEmail || ''}</p>
                </div>
                <div class="flex flex-col py-1 text-sm text-slate-600">
                  <button
                    type="button"
                    class="flex items-center gap-2 px-4 py-2 text-left transition hover:bg-emerald-50 hover:text-emerald-700"
                    data-action="open-change-password"
                  >
                    <i class="fa-solid fa-key"></i>
                    Cambiar contraseña
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-2 px-4 py-2 text-left transition hover:bg-rose-50 hover:text-rose-600"
                    data-action="sign-out"
                  >
                    <i class="fa-solid fa-right-from-bracket"></i>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
            <button
              id="mobile-menu-toggle"
              class="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-primary-500 hover:text-primary-600 lg:hidden"
              aria-label="Abrir menú"
            >
              <i class="fa-solid fa-bars"></i>
            </button>
          </div>
        </div>
        <div class="border-t border-slate-200 bg-white px-4 py-3 shadow-inner lg:hidden" id="mobile-menu" hidden>
          <nav class="flex flex-col gap-2">
            ${getFilteredNavItems().map(
              item => `
                <a
                  href="#${item.id}"
                  data-route="${item.id}"
                  class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <i class="fa-solid ${item.icon}"></i>
                  </span>
                  ${item.label}
                </a>
              `
            ).join('')}
          </nav>
          <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Cuenta</p>
            <p class="mt-1 font-semibold text-slate-800">${accountName || 'Usuario'}</p>
            <p class="mt-1 break-all text-xs text-slate-500">${accountEmail || ''}</p>
            <div class="mt-3 flex flex-col gap-2">
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                data-action="open-change-password"
              >
                <i class="fa-solid fa-key"></i>
                Cambiar contraseña
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                data-action="sign-out"
              >
                <i class="fa-solid fa-right-from-bracket"></i>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-6 text-sm uppercase tracking-[0.4em] text-slate-400" id="active-section">Panel Directivos</div>
        <div class="min-h-[60vh] rounded-[32px] border border-slate-200/70 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur" id="content">
          ${content}
        </div>
      </main>
      <div
        id="change-password-modal"
        class="fixed inset-0 z-40 hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div class="absolute inset-0 bg-slate-900/60" data-action="close-change-password"></div>
        <div class="relative z-10 flex min-h-full items-center justify-center px-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 id="change-password-title" class="text-lg font-semibold text-slate-800">Cambiar contraseña</h2>
                <p class="text-xs text-slate-500">
                  La contraseña debe tener al menos 8 caracteres e incluir letras mayúsculas, minúsculas, números y símbolos.
                </p>
              </div>
              <button
                type="button"
                class="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                data-action="close-change-password"
                aria-label="Cerrar"
              >
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form id="change-password-form" class="space-y-4">
              <div>
                <label class="text-sm font-medium text-slate-700" for="current-password">Contraseña anterior</label>
                <div class="relative mt-1">
                  <input
                    id="current-password"
                    name="current-password"
                    type="password"
                    autocomplete="current-password"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    required
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    data-toggle-password="current-password"
                    aria-label="Mostrar contraseña"
                  >
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
                <div class="mt-1 hidden text-xs text-rose-600" id="error-current-password"></div>
              </div>

              <div>
                <label class="text-sm font-medium text-slate-700" for="new-password">Nueva contraseña</label>
                <div class="relative mt-1">
                  <input
                    id="new-password"
                    name="new-password"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    required
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    data-toggle-password="new-password"
                    aria-label="Mostrar contraseña"
                  >
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
                <div class="mt-2 hidden text-xs text-rose-600" id="error-new-password"></div>
              </div>

              <div>
                <label class="text-sm font-medium text-slate-700" for="confirm-password">Confirmar nueva contraseña</label>
                <div class="relative mt-1">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    required
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    data-toggle-password="confirm-password"
                    aria-label="Mostrar contraseña"
                  >
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
                <div class="mt-1 hidden text-xs text-rose-600" id="error-confirm-password"></div>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  class="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                  data-default-text="Guardar nueva contraseña"
                  data-loading-text="Guardando..."
                >
                  Guardar nueva contraseña
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  data-action="close-change-password"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function highlightActiveRoute(routeId) {
  const desktopLinks = document.querySelectorAll('#main-menu a[data-route]');
  const mobileLinks = document.querySelectorAll('#mobile-menu a[data-route]');
  const activeLabel = NAV_ITEMS.find(item => item.id === routeId)?.label ?? 'Panel Directivos';
  const sectionLabel = document.getElementById('active-section');

  if (sectionLabel) {
    sectionLabel.textContent = activeLabel;
  }

  desktopLinks.forEach(link => {
    const iconWrapper = link.querySelector('span');
    if (link.dataset.route === routeId) {
      link.classList.add('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
      link.classList.remove('text-slate-600');
      if (iconWrapper) {
        iconWrapper.classList.remove('bg-slate-100', 'text-slate-500');
        iconWrapper.classList.add('bg-white/20', 'text-white');
      }
    } else {
      link.classList.remove('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
      link.classList.add('text-slate-600');
      if (iconWrapper) {
        iconWrapper.classList.add('bg-slate-100', 'text-slate-500');
        iconWrapper.classList.remove('bg-white/20', 'text-white');
      }
    }
  });

  mobileLinks.forEach(link => {
    if (link.dataset.route === routeId) {
      link.classList.add('bg-primary-600', 'text-white', 'shadow');
      link.classList.remove('text-slate-600');
    } else {
      link.classList.remove('bg-primary-600', 'text-white', 'shadow');
      link.classList.add('text-slate-600');
    }
  });

  const toggle = document.getElementById('mobile-menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    menu.hidden = true;
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (toggle && menu && !toggle.dataset.bound) {
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }
}
