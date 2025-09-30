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
    roles: ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'] // Todos pueden ver
  },
  { 
    id: 'visualizacion', 
    label: 'Visualización de Indicadores', 
    icon: 'fa-chart-area',
    roles: ['DIRECTOR', 'SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'] // Todos pueden ver
  },
  { 
    id: 'indicators', 
    label: 'Consulta de Indicadores', 
    icon: 'fa-table',
    roles: ['SUBDIRECTOR', 'ADMIN', 'CAPTURISTA'] // Director NO puede ver
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
  return `
    <div class="min-h-screen bg-slate-100">
      <header class="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
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
            <div class="hidden text-right text-xs sm:block">
              <p class="font-semibold text-slate-800">${user?.user?.email ?? 'Sesión no iniciada'}</p>
              <p class="text-[11px] uppercase tracking-[0.4em] text-slate-400">${user?.rol ?? 'AIFA'}</p>
            </div>
            <button
              id="sign-out"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-primary-500 hover:text-primary-600"
            >
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
              <span class="hidden sm:inline">Cerrar sesión</span>
            </button>
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
        </div>
      </header>
      <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-6 text-sm uppercase tracking-[0.4em] text-slate-400" id="active-section">Panel Directivos</div>
        <div class="min-h-[60vh] rounded-[32px] border border-slate-200/70 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur" id="content">
          ${content}
        </div>
      </main>
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
