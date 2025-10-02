/**
 * Sistema de notificaciones Toast
 */

export function showToast(message, options = {}) {
  const { type = 'info', duration = 3000 } = options;
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-orange-500',
    info: 'bg-blue-500'
  };
  
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  // Crear contenedor si no existe
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
    document.body.appendChild(container);
  }

  // Crear toast
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 rounded-lg ${colors[type]} px-4 py-3 text-white shadow-lg transition-all duration-300 transform translate-x-0 opacity-100`;
  
  toast.innerHTML = `
    <i class="fa-solid ${icons[type]} text-lg"></i>
    <span class="text-sm font-medium">${message}</span>
    <button class="ml-2 hover:opacity-75" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  // Auto-remover
  setTimeout(() => {
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
