/**
 * Indicadores 2.0 - AIFA
 * Módulo de interfaz de usuario
 * Maneja navbar, toasts, modales, menús y elementos de UI comunes
 */

/**
 * Mostrar/ocultar spinner de carga
 * @param {boolean} show - true para mostrar, false para ocultar
 * @param {string} message - Mensaje opcional a mostrar
 */
function toggleSpinner(show = true, message = 'Cargando...') {
    let spinner = document.getElementById('global-spinner');
    
    if (!spinner) {
        // Crear spinner si no existe
        spinner = document.createElement('div');
        spinner.id = 'global-spinner';
        spinner.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        spinner.innerHTML = `
            <div class="bg-white rounded-lg p-6 flex items-center space-x-3 shadow-lg">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span class="text-gray-700" id="spinner-message">${message}</span>
            </div>
        `;
        document.body.appendChild(spinner);
    }
    
    const messageEl = document.getElementById('spinner-message');
    if (messageEl) {
        messageEl.textContent = message;
    }
    
    spinner.style.display = show ? 'flex' : 'none';
}

/**
 * Mostrar toast de notificación
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en milisegundos
 */
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    const toastId = 'toast-' + Date.now();
    toast.id = toastId;
    
    // Clases según el tipo
    let bgClass, iconClass, icon;
    switch (type) {
        case 'success':
            bgClass = 'bg-green-500';
            iconClass = 'text-white';
            icon = '✓';
            break;
        case 'error':
            bgClass = 'bg-red-500';
            iconClass = 'text-white';
            icon = '✕';
            break;
        case 'warning':
            bgClass = 'bg-yellow-500';
            iconClass = 'text-white';
            icon = '⚠';
            break;
        default:
            bgClass = 'bg-blue-500';
            iconClass = 'text-white';
            icon = 'ℹ';
    }
    
    toast.className = `fixed top-4 right-4 ${bgClass} text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-3 transform translate-x-full transition-transform duration-300`;
    toast.innerHTML = `
        <span class="${iconClass} font-bold text-lg">${icon}</span>
        <span class="font-medium">${message}</span>
        <button onclick="removeToast('${toastId}')" class="ml-4 text-white hover:text-gray-200 font-bold text-xl leading-none">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 100);
    
    // Auto-remover después del tiempo especificado
    setTimeout(() => {
        removeToast(toastId);
    }, duration);
}

/**
 * Remover toast específico
 * @param {string} toastId - ID del toast a remover
 */
function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

/**
 * Generar y mostrar navbar
 * @param {Object} user - Información del usuario
 * @param {Object} profile - Perfil del usuario con rol
 */
async function renderNavbar(user, profile) {
    const navbarContainer = document.getElementById('navbar');
    if (!navbarContainer) return;
    
    // Validar que tenemos los datos necesarios
    if (!profile || !profile.roles || !profile.roles.nombre) {
        console.error('Datos de perfil inválidos:', profile);
        return;
    }
    
    const currentPage = getCurrentPageName();
    
    navbarContainer.innerHTML = `
        <nav class="bg-white shadow-lg border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <!-- Logo y marca -->
                    <div class="flex items-center">
                        <img src="assets/AIFA_Logo.png" alt="AIFA" class="h-10 w-auto">
                        <div class="ml-3">
                            <div class="text-lg font-bold text-gray-900">Indicadores 2.0</div>
                            <div class="text-sm text-gray-500">AIFA</div>
                        </div>
                    </div>
                    
                    <!-- Menú de navegación -->
                    <div class="hidden md:block">
                        <div class="ml-10 flex items-baseline space-x-4">
                            <a href="index.html" class="nav-link ${currentPage === 'index' ? 'active' : ''}">
                                <span class="material-icons text-sm mr-1">dashboard</span>
                                Dashboard
                            </a>
                            <a href="captura.html" class="nav-link ${currentPage === 'captura' ? 'active' : ''}">
                                <span class="material-icons text-sm mr-1">add_circle</span>
                                Captura
                            </a>
                            <a href="consulta.html" class="nav-link ${currentPage === 'consulta' ? 'active' : ''}">
                                <span class="material-icons text-sm mr-1">search</span>
                                Consulta
                            </a>
                            ${profile.roles.nombre.toLowerCase() === 'admin' ? `
                            <a href="admin.html" class="nav-link ${currentPage === 'admin' ? 'active' : ''}">
                                <span class="material-icons text-sm mr-1">admin_panel_settings</span>
                                Admin
                            </a>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Información del usuario -->
                    <div class="flex items-center">
                        <div class="relative">
                            <button onclick="toggleUserMenu()" class="flex items-center space-x-3 text-gray-700 hover:text-gray-900 focus:outline-none">
                                <div class="text-right">
                                   <div class="font-medium">${profile.nombre || user.email.split('@')[0]}</div>
                                    <div class="text-xs text-gray-500 capitalize">${profile.roles.nombre}</div>
                                </div>
                                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">
                                       ${(profile.nombre || user.email).charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span class="material-icons text-lg">arrow_drop_down</span>
                            </button>
                            
                            <!-- Menú desplegable del usuario -->
                            <div id="user-menu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                <div class="px-4 py-2 text-sm text-gray-700 border-b">
                                    <div class="text-sm font-medium">${profile.nombre || user.email.split('@')[0]}</div>
                                    <div class="text-xs text-gray-500 capitalize">${profile.roles.nombre}</div>
                                </div>
                                <button onclick="logout()" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <span class="material-icons text-sm mr-2">logout</span>
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Botón menú móvil -->
                    <div class="md:hidden">
                        <button onclick="toggleMobileMenu()" class="text-gray-700 hover:text-gray-900 focus:outline-none">
                            <span class="material-icons">menu</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Menú móvil -->
            <div id="mobile-menu" class="hidden md:hidden">
                <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
                    <a href="index.html" class="mobile-nav-link ${currentPage === 'index' ? 'active' : ''}">Dashboard</a>
                    <a href="captura.html" class="mobile-nav-link ${currentPage === 'captura' ? 'active' : ''}">Captura</a>
                    <a href="consulta.html" class="mobile-nav-link ${currentPage === 'consulta' ? 'active' : ''}">Consulta</a>
                    ${profile.roles.nombre.toLowerCase() === 'admin' ? `
                    <a href="admin.html" class="mobile-nav-link ${currentPage === 'admin' ? 'active' : ''}">Admin</a>
                    ` : ''}
                </div>
            </div>
        </nav>
    `;
    
    // Agregar estilos para la navegación
    addNavbarStyles();
}

/**
 * Agregar estilos CSS para la navbar
 */
function addNavbarStyles() {
    let styleEl = document.getElementById('navbar-styles');
    if (styleEl) return; // Ya existen los estilos
    
    styleEl = document.createElement('style');
    styleEl.id = 'navbar-styles';
    styleEl.textContent = `
        .nav-link {
            display: inline-flex;
            align-items: center;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            text-sm;
            font-medium;
            text-gray-600;
            text-decoration: none;
            transition: all 0.2s;
        }
        .nav-link:hover {
            text-gray-900;
            background-color: rgb(243 244 246);
        }
        .nav-link.active {
            background-color: rgb(37 99 235);
            color: white;
        }
        .mobile-nav-link {
            display: block;
            padding: 0.75rem 1rem;
            border-radius: 0.375rem;
            text-sm;
            font-medium;
            text-gray-600;
            text-decoration: none;
            transition: all 0.2s;
        }
        .mobile-nav-link:hover {
            text-gray-900;
            background-color: rgb(243 244 246);
        }
        .mobile-nav-link.active {
            background-color: rgb(37 99 235);
            color: white;
        }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal;
            font-style: normal;
            font-size: 24px;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
        }
    `;
    document.head.appendChild(styleEl);
}

/**
 * Obtener nombre de la página actual
 * @returns {string} - Nombre de la página sin extensión
 */
function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');
    return page || 'index';
}

/**
 * Toggle del menú de usuario
 */
function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
    
    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', function closeUserMenu(e) {
        const menu = document.getElementById('user-menu');
        const button = e.target.closest('button');
        
        if (menu && !menu.contains(e.target) && !button?.onclick?.toString().includes('toggleUserMenu')) {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeUserMenu);
        }
    });
}

/**
 * Toggle del menú móvil
 */
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

/**
 * Función de logout
 */
async function logout() {
    try {
        toggleSpinner(true, 'Cerrando sesión...');
        
        const result = await window.auth.signOut();
        
        if (result.success) {
            showToast('Sesión cerrada correctamente', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } else {
            showToast(result.message || 'Error al cerrar sesión', 'error');
        }
        
    } catch (error) {
        console.error('Error en logout:', error);
        showToast('Error inesperado al cerrar sesión', 'error');
    } finally {
        toggleSpinner(false);
    }
}

/**
 * Crear modal genérico
 * @param {string} id - ID del modal
 * @param {string} title - Título del modal
 * @param {string} content - Contenido HTML del modal
 * @param {Array} actions - Array de botones [{text, class, onclick}]
 */
function createModal(id, title, content, actions = []) {
    // Remover modal existente si lo hay
    const existingModal = document.getElementById(id);
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    const actionsHTML = actions.map(action => 
        `<button onclick="${action.onclick}" class="${action.class || 'px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400'}">${action.text}</button>`
    ).join('');
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-screen overflow-y-auto">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
                <button onclick="closeModal('${id}')" class="text-gray-400 hover:text-gray-600">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="p-6">
                ${content}
            </div>
            ${actions.length > 0 ? `
            <div class="flex justify-end space-x-3 p-6 border-t bg-gray-50">
                ${actionsHTML}
            </div>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(id);
        }
    });
    
    // Cerrar modal con Escape
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            closeModal(id);
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

/**
 * Cerrar modal específico
 * @param {string} modalId - ID del modal a cerrar
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

/**
 * Mostrar modal de confirmación
 * @param {string} message - Mensaje de confirmación
 * @param {Function} onConfirm - Función a ejecutar si confirma
 * @param {Function} onCancel - Función a ejecutar si cancela
 */
function showConfirmModal(message, onConfirm, onCancel = null) {
    const modalId = 'confirm-modal-' + Date.now();
    
    createModal(
        modalId,
        'Confirmación',
        `<p class="text-gray-700">${message}</p>`,
        [
            {
                text: 'Cancelar',
                class: 'px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400',
                onclick: `closeModal('${modalId}'); ${onCancel ? 'window.tempOnCancel && window.tempOnCancel()' : ''}`
            },
            {
                text: 'Confirmar',
                class: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700',
                onclick: `closeModal('${modalId}'); window.tempOnConfirm && window.tempOnConfirm()`
            }
        ]
    );
    
    // Almacenar temporalmente las funciones
    window.tempOnConfirm = onConfirm;
    if (onCancel) window.tempOnCancel = onCancel;
    
    // Limpiar funciones temporales después de un tiempo
    setTimeout(() => {
        delete window.tempOnConfirm;
        delete window.tempOnCancel;
    }, 30000);
}

/**
 * Inicializar la interfaz de usuario
 */
async function initUI() {
    try {
        // Cargar iconos de Material Icons si no están cargados
        if (!document.querySelector('link[href*="material-icons"]')) {
            const link = document.createElement('link');
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        
        // Inicializar navbar si el usuario está autenticado
        const authState = await window.auth.checkAuthState();
        if (authState.isValid) {
            await renderNavbar(authState.user, authState.profile);
        }
        
        console.log('UI inicializada correctamente');
        
    } catch (error) {
        console.error('Error inicializando UI:', error);
    }
}

// Auto-inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    initUI();
});

// Exportar funciones para uso global
window.ui = {
    toggleSpinner,
    showToast,
    removeToast,
    renderNavbar,
    getCurrentPageName,
    toggleUserMenu,
    toggleMobileMenu,
    logout,
    createModal,
    closeModal,
    showConfirmModal,
    initUI
};
