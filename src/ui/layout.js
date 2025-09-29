import { getSession } from '../state/session.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel Directivos', icon: 'fa-chart-line' },
  { id: 'indicators', label: 'Consulta de Indicadores', icon: 'fa-table' },
  { id: 'capture', label: 'Captura de Indicadores', icon: 'fa-pen-to-square' }
];

export function renderLayout(content) {
  const user = getSession();
  return `
    <div class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100">
      <div class="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside class="hidden w-full max-w-xs flex-col rounded-3xl bg-white/95 p-6 text-slate-600 shadow-xl shadow-slate-900/5 backdrop-blur lg:flex">
          <div class="flex items-center gap-3 border-b border-slate-200 pb-5">
            <img src="./assets/logo-aifa.svg" alt="Logotipo AIFA" class="h-12 w-auto" />
            <div>
              <p class="text-[11px] uppercase tracking-[0.35em] text-slate-400">Indicadores</p>
              <p class="text-base font-semibold text-slate-800">Panel AIFA</p>
            </div>
          </div>
          <nav class="mt-6 flex-1 overflow-y-auto">
            <ul class="space-y-1" id="main-menu">
              ${NAV_ITEMS.map(
                (item) => `
                  <li>
                    <a
                      href="#${item.id}"
                      data-route="${item.id}"
                      class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <span class="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <i class="fa-solid ${item.icon}"></i>
                      </span>
                      <span>${item.label}</span>
                    </a>
                  </li>
                `
              ).join('')}
            </ul>
          </nav>
          <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
            <p class="font-semibold text-slate-700">${user?.user?.email ?? 'Sesión no iniciada'}</p>
            <p class="mt-1 text-xs text-slate-400">Dirección Estratégica</p>
            <button
              id="sign-out"
              class="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-primary-500/30 transition hover:bg-primary-700"
            >
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
              Cerrar sesión
            </button>
          </div>
        </aside>
        <main class="flex-1 py-10 lg:pl-10">
          <div class="mx-auto flex h-full w-full max-w-4xl flex-col rounded-[32px] border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-900/5 backdrop-blur">
            <header class="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-4">
                <img src="./assets/logo-aifa.svg" alt="Logotipo AIFA" class="h-12 w-auto" />
                <div>
                  <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Sistema de Indicadores</p>
                  <h1 class="text-lg font-semibold text-slate-800">Aeropuerto Internacional Felipe Ángeles</h1>
                </div>
              </div>
              <div class="flex flex-col items-start gap-4 sm:items-end">
                <span class="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-700">
                  <i class="fa-solid fa-gauge-high"></i>
                  Gestión Estratégica
                </span>
                <div class="flex flex-wrap gap-2 sm:hidden" id="mobile-menu">
                  ${NAV_ITEMS.map(
                    (item) => `
                      <a
                        href="#${item.id}"
                        data-route="${item.id}"
                        class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500"
                      >
                        <i class="fa-solid ${item.icon}"></i>
                        ${item.label}
                      </a>
                    `
                  ).join('')}
                </div>
              </div>
            </header>
            <div class="flex-1 overflow-y-auto px-6 py-8" id="content">
              ${content}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

export function highlightActiveRoute(routeId) {
  const desktopLinks = document.querySelectorAll('#main-menu a[data-route]');
  const mobileLinks = document.querySelectorAll('#mobile-menu a[data-route]');

  desktopLinks.forEach((link) => {
    const icon = link.querySelector('span');
    if (link.dataset.route === routeId) {
      link.classList.add('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
      link.classList.remove('text-slate-500');
      if (icon) {
        icon.classList.remove('bg-slate-100', 'text-slate-500');
        icon.classList.add('bg-white/20', 'text-white');
      }
    } else {
      link.classList.remove('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
      link.classList.add('text-slate-500');
      if (icon) {
        icon.classList.add('bg-slate-100', 'text-slate-500');
        icon.classList.remove('bg-white/20', 'text-white');
      }
    }
  });

  mobileLinks.forEach((link) => {
    if (link.dataset.route === routeId) {
      link.classList.add('border-transparent', 'bg-primary-600', 'text-white', 'shadow');
      link.classList.remove('border-slate-200', 'text-slate-500');
    } else {
      link.classList.remove('border-transparent', 'bg-primary-600', 'text-white', 'shadow');
      link.classList.add('border-slate-200', 'text-slate-500');
    }
  });
}
