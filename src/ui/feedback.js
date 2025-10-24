export function showToast(message, { type = 'success', timeout = 4000 } = {}) {
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'fixed top-4 right-4 space-y-2 z-50';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-lg shadow bg-white border-l-4 transition-opacity duration-300 ${
    type === 'error'
      ? 'border-red-500 text-red-700'
      : type === 'warning'
      ? 'border-amber-500 text-amber-700'
      : 'border-emerald-500 text-emerald-700'
  }`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

export function renderLoading(target, message = 'Cargando información...') {
  target.innerHTML = `
    <div class="flex items-center justify-center py-12 text-slate-500">
      <svg class="animate-spin h-6 w-6 mr-3 text-primary-600" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      <span>${message}</span>
    </div>
  `;
}

export function renderError(target, error) {
  target.innerHTML = `
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
      <h3 class="font-semibold mb-2">Ocurrió un error</h3>
      <p>${error?.message ?? error ?? 'No fue posible completar la operación.'}</p>
    </div>
  `;
}
