/**
 * Sistema de notificaciones Toast
 /**
 * ═══════════════════════════════════════════════════════════════════
 * SISTEMA DE NOTIFICACIONES TOAST
 * Notificaciones elegantes y no invasivas
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const TOAST_CONFIG = {
  duration: 3000, // Duración por defecto en ms
  maxToasts: 5,   // Máximo de toasts simultáneos
  position: 'top-right' // Posición: top-right, top-left, bottom-right, bottom-left
};

const TOAST_TYPES = {
  success: {
    bg: 'bg-green-500',
    icon: 'fa-circle-check',
    iconBg: 'bg-green-600'
  },
  error: {
    bg: 'bg-red-500',
    icon: 'fa-circle-exclamation',
    iconBg: 'bg-red-600'
  },
  warning: {
    bg: 'bg-orange-500',
    icon: 'fa-triangle-exclamation',
    iconBg: 'bg-orange-600'
  },
  info: {
    bg: 'bg-blue-500',
    icon: 'fa-circle-info',
    iconBg: 'bg-blue-600'
  }
};

// ═══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: showToast
// ═══════════════════════════════════════════════════════════════════

export function showToast(message, options = {}) {
  const {
    type = 'info',
    duration = TOAST_CONFIG.duration,
    position = TOAST_CONFIG.position,
    closable = true
  } = options;

  // Validar tipo
  const toastType = TOAST_TYPES[type] || TOAST_TYPES.info;

  // Obtener o crear contenedor
  const container = getOrCreateContainer(position);

  // Limitar número de toasts
  limitToasts(container);

  // Crear toast
  const toast = createToast(message, toastType, closable);

  // Agregar al contenedor
  container.appendChild(toast);

  // Animar entrada
  setTimeout(() => {
    toast.classList.remove('translate-x-full', 'translate-x-[-100%]', 'translate-y-full', 'translate-y-[-100%]');
    toast.classList.add('translate-x-0', 'translate-y-0');
  }, 10);

  // Auto-remover si tiene duración
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast, position);
    }, duration);
  }

  return toast;
}

// ═══════════════════════════════════════════════════════════════════
// OBTENER O CREAR CONTENEDOR
// ═══════════════════════════════════════════════════════════════════

function getOrCreateContainer(position) {
  const containerId = `toast-container-${position}`;
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = getContainerClasses(position);
    document.body.appendChild(container);
  }

  return container;
}

// ═══════════════════════════════════════════════════════════════════
// CLASES DEL CONTENEDOR SEGÚN POSICIÓN
// ═══════════════════════════════════════════════════════════════════

function getContainerClasses(position) {
  const baseClasses = 'fixed z-[9999] flex flex-col gap-3 pointer-events-none';
  
  const positions = {
    'top-right': `${baseClasses} top-4 right-4`,
    'top-left': `${baseClasses} top-4 left-4`,
    'bottom-right': `${baseClasses} bottom-4 right-4`,
    'bottom-left': `${baseClasses} bottom-4 left-4`,
    'top-center': `${baseClasses} top-4 left-1/2 -translate-x-1/2`,
    'bottom-center': `${baseClasses} bottom-4 left-1/2 -translate-x-1/2`
  };

  return positions[position] || positions['top-right'];
}

// ═══════════════════════════════════════════════════════════════════
// CREAR ELEMENTO TOAST
// ═══════════════════════════════════════════════════════════════════

function createToast(message, toastType, closable) {
  const toast = document.createElement('div');
  toast.className = `
    flex items-center gap-3 rounded-lg ${toastType.bg} px-4 py-3 text-white shadow-lg
    transition-all duration-300 transform translate-x-full opacity-100
    pointer-events-auto max-w-sm min-w-[280px]
  `;

  toast.innerHTML = `
    <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${toastType.iconBg}">
      <i class="fa-solid ${toastType.icon} text-sm"></i>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium break-words">${escapeHtml(message)}</p>
    </div>
    ${closable ? `
      <button 
        class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-white/20 transition"
        onclick="this.closest('div[class*=rounded-lg]').remove()"
        aria-label="Cerrar notificación"
      >
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    ` : ''}
  `;

  return toast;
}

// ═══════════════════════════════════════════════════════════════════
// REMOVER TOAST CON ANIMACIÓN
// ═══════════════════════════════════════════════════════════════════

function removeToast(toast, position) {
  // Animación de salida según posición
  if (position.includes('right')) {
    toast.style.transform = 'translateX(400px)';
  } else if (position.includes('left')) {
    toast.style.transform = 'translateX(-400px)';
  } else if (position.includes('top')) {
    toast.style.transform = 'translateY(-100px)';
  } else {
    toast.style.transform = 'translateY(100px)';
  }
  
  toast.style.opacity = '0';

  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════
// LIMITAR NÚMERO DE TOASTS
// ═══════════════════════════════════════════════════════════════════

function limitToasts(container) {
  const toasts = container.querySelectorAll('div[class*="rounded-lg"]');
  
  if (toasts.length >= TOAST_CONFIG.maxToasts) {
    // Remover el más antiguo
    const oldestToast = toasts[0];
    if (oldestToast) {
      removeToast(oldestToast, TOAST_CONFIG.position);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESCAPE HTML (Prevenir XSS)
// ═══════════════════════════════════════════════════════════════════

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE ATAJO
// ═══════════════════════════════════════════════════════════════════

export function showSuccess(message, options = {}) {
  return showToast(message, { ...options, type: 'success' });
}

export function showError(message, options = {}) {
  return showToast(message, { ...options, type: 'error' });
}

export function showWarning(message, options = {}) {
  return showToast(message, { ...options, type: 'warning' });
}

export function showInfo(message, options = {}) {
  return showToast(message, { ...options, type: 'info' });
}

// ═══════════════════════════════════════════════════════════════════
// LIMPIAR TODOS LOS TOASTS
// ═══════════════════════════════════════════════════════════════════

export function clearAllToasts() {
  const containers = document.querySelectorAll('[id^="toast-container-"]');
  containers.forEach(container => {
    const toasts = container.querySelectorAll('div[class*="rounded-lg"]');
    toasts.forEach(toast => toast.remove());
  });
}

// ═══════════════════════════════════════════════════════════════════
// TOAST CON ACCIÓN (Ejemplo: Deshacer)
// ═══════════════════════════════════════════════════════════════════

export function showToastWithAction(message, actionText, actionCallback, options = {}) {
  const {
    type = 'info',
    duration = 5000,
    position = TOAST_CONFIG.position
  } = options;

  const toastType = TOAST_TYPES[type] || TOAST_TYPES.info;
  const container = getOrCreateContainer(position);
  limitToasts(container);

  const toast = document.createElement('div');
  toast.className = `
    flex items-center gap-3 rounded-lg ${toastType.bg} px-4 py-3 text-white shadow-lg
    transition-all duration-300 transform translate-x-full opacity-100
    pointer-events-auto max-w-sm min-w-[280px]
  `;

  toast.innerHTML = `
    <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${toastType.iconBg}">
      <i class="fa-solid ${toastType.icon} text-sm"></i>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium break-words">${escapeHtml(message)}</p>
    </div>
    <button 
      class="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition"
      id="toast-action-btn"
    >
      ${escapeHtml(actionText)}
    </button>
    <button 
      class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-white/20 transition"
      onclick="this.closest('div[class*=rounded-lg]').remove()"
    >
      <i class="fa-solid fa-xmark text-sm"></i>
    </button>
  `;

  container.appendChild(toast);

  // Event listener para la acción
  const actionBtn = toast.querySelector('#toast-action-btn');
  if (actionBtn && actionCallback) {
    actionBtn.addEventListener('click', () => {
      actionCallback();
      toast.remove();
    });
  }

  setTimeout(() => {
    toast.classList.remove('translate-x-full');
    toast.classList.add('translate-x-0');
  }, 10);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast, position);
    }, duration);
  }

  return toast;
}
