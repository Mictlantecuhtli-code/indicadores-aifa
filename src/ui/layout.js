import { getSession } from '../state/session.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel Directivos', icon: 'fa-chart-line' },
  { id: 'indicators', label: 'Consulta de Indicadores', icon: 'fa-table' },
  { id: 'capture', label: 'Captura de Indicadores', icon: 'fa-pen-to-square' }
];

export function renderLayout(content) {
  const user = getSession();
  return `
    <div class="min-h-screen grid lg:grid-cols-[20rem_1fr]">
      <aside class="bg-slate-900 text-white hidden lg:flex flex-col">
        <div class="px-6 py-5 border-b border-slate-800">
          <h1 class="text-lg font-semibold">Indicadores AIFA</h1>
          <p class="text-sm text-slate-400">Dirección Estratégica</p>
        </div>
        <nav class="flex-1 overflow-y-auto">
          <ul class="py-4 space-y-1" id="main-menu">
            ${NAV_ITEMS.map(
              (item) => `
                <li>
                  <a href="#${item.id}" data-route="${item.id}" class="flex items-center gap-3 px-6 py-3 text-sm hover:bg-slate-800 transition">
                    <i class="fa-solid ${item.icon} w-5"></i>
                    <span>${item.label}</span>
                  </a>
                </li>
              `
            ).join('')}
          </ul>
        </nav>
        <div class="px-6 py-4 border-t border-slate-800 text-sm">
          <p class="font-medium">${user?.user?.email ?? 'Sesión no iniciada'}</p>
          <button id="sign-out" class="mt-3 inline-flex items-center gap-2 text-slate-300 hover:text-white">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main class="bg-slate-50 min-h-screen">
        <header class="lg:hidden bg-slate-900 text-white px-4 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-lg font-semibold">Indicadores AIFA</h1>
            <p class="text-sm text-slate-400">Dirección Estratégica</p>
          </div>
          <button id="mobile-menu" class="p-2 rounded bg-white/10">
            <i class="fa-solid fa-bars"></i>
          </button>
        </header>
        <div class="max-w-6xl mx-auto px-4 py-6" id="content">
          ${content}
        </div>
      </main>
    </div>
  `;
}

export function highlightActiveRoute(routeId) {
  const links = document.querySelectorAll('#main-menu a[data-route]');
  links.forEach((link) => {
    if (link.dataset.route === routeId) {
      link.classList.add('bg-slate-800', 'text-white');
    } else {
      link.classList.remove('bg-slate-800', 'text-white');
    }
  });
}
