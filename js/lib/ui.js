// =====================================================
// UTILIDADES DE INTERFAZ DE USUARIO
// =====================================================

import { NOTIFICATIONS, APP_CONFIG, DEBUG } from '../config.js';

// Estado global de la UI
export const uiState = {
    toasts: [],
    modals: [],
    loading: false,
    loadingStack: 0
};

// =====================================================
// SISTEMA DE NOTIFICACIONES (TOASTS)
// =====================================================

/**
 * Mostrar notificación toast
 */
export function showToast(message, type = 'info', duration = null) {
    const toastDuration = duration || NOTIFICATIONS.duration;
    const toastConfig = NOTIFICATIONS.types[type] || NOTIFICATIONS.types.info;
    
    // Crear elemento toast
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const toast = {
        id: toastId,
        message,
        type,
        timestamp: Date.now()
    };
    
    // Agregar al estado
    uiState.toasts.push(toast);
    
    // Crear HTML del toast
    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = `toast ${toastConfig.bgColor} border border-gray-200 rounded-lg shadow-lg p-4 mb-3 max-w-sm`;
    toastElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <i data-lucide="${toastConfig.icon}" class="w-5 h-5 ${toastConfig.iconColor}"></i>
            </div>
            <div class="ml-3 flex-1">
                <p class="text-sm font-medium ${toastConfig.textColor}">${message}</p>
            </div>
            <div class="ml-4 flex-shrink-0">
                <button class="inline-flex ${toastConfig.textColor} hover:opacity-75 focus:outline-none" 
                        onclick="window.ui.hideToast('${toastId}')">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
    
    // Obtener contenedor de toasts
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('⚠️ Contenedor de toasts no encontrado');
        return;
    }
    
    // Agregar al DOM
    container.appendChild(toastElement);
    
    // Recrear iconos
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Animar entrada
    setTimeout(() => {
        toastElement.classList.add('show');
    }, 10);
    
    // Auto-ocultar después del tiempo especificado
    setTimeout(() => {
        hideToast(toastId);
    }, toastDuration);
    
    // Limpiar toasts antiguos si hay demasiados
    if (uiState.toasts.length > NOTIFICATIONS.maxVisible) {
        const oldestToast = uiState.toasts[0];
        hideToast(oldestToast.id);
    }
    
    if (DEBUG.enabled) console.log(`🔔 Toast mostrado: ${type} - ${message}`);
    
    return toastId;
}

/**
 * Ocultar notificación toast específica
 */
export function hideToast(toastId) {
    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        // Animar salida
        toastElement.classList.remove('show');
        
        // Remover del DOM después de la animación
        setTimeout(() => {
            toastElement.remove();
        }, 300);
    }
    
    // Remover del estado
    uiState.toasts = uiState.toasts.filter(toast => toast.id !== toastId);
}

/**
 * Limpiar todas las notificaciones
 */
export function clearAllToasts() {
    uiState.toasts.forEach(toast => hideToast(toast.id));
    uiState.toasts = [];
}

// =====================================================
// SISTEMA DE LOADING/SPINNER
// =====================================================

/**
 * Mostrar indicador de carga
 */
export function showLoading(message = 'Cargando...') {
    uiState.loadingStack++;
    
    if (uiState.loadingStack === 1) {
        uiState.loading = true;
        
        const loadingContainer = document.getElementById('loading-container');
        if (loadingContainer) {
            loadingContainer.querySelector('span').textContent = message;
            loadingContainer.classList.remove('hidden');
        }
        
        // Deshabilitar interacciones principales
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.pointerEvents = 'none';
            appContainer.style.opacity = '0.7';
        }
    }
}

/**
 * Ocultar indicador de carga
 */
export function hideLoading() {
    uiState.loadingStack = Math.max(0, uiState.loadingStack - 1);

    if (uiState.loadingStack === 0) {
        uiState.loading = false;

        const loadingContainer = document.getElementById('loading-container');
        if (loadingContainer) {
            loadingContainer.classList.add('hidden');
        }

        // Restaurar interacciones
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.pointerEvents = '';
            appContainer.style.opacity = '';
        }
    }
}

/**
 * Reiniciar el estado del indicador de carga
 */
export function resetLoadingState() {
    uiState.loadingStack = 0;
    uiState.loading = false;

    const loadingContainer = document.getElementById('loading-container');
    if (loadingContainer) {
        loadingContainer.classList.add('hidden');
    }

    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.pointerEvents = '';
        appContainer.style.opacity = '';
    }
}

/**
 * Ejecutar función con loading automático
 */
export async function withLoading(asyncFunction, message = 'Cargando...') {
    try {
        showLoading(message);
        const result = await asyncFunction();
        return result;
    } finally {
        hideLoading();
    }
}

// =====================================================
// SISTEMA DE MODALES
// =====================================================

/**
 * Mostrar modal genérico
 */
export function showModal(options = {}) {
    const {
        title = 'Modal',
        content = '',
        actions = [],
        size = 'md',
        closable = true,
        onClose = null
    } = options;
    
    const modalId = 'modal-' + Date.now();
    const modal = {
        id: modalId,
        title,
        content,
        actions,
        onClose
    };
    
    uiState.modals.push(modal);
    
    // Configurar elementos del modal
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalActions = document.getElementById('modal-actions');
    
    if (!overlay || !modalTitle || !modalContent || !modalActions) {
        console.error('❌ Elementos del modal no encontrados');
        return null;
    }
    
    // Configurar contenido
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    
    // Configurar acciones
    modalActions.innerHTML = actions.map((action, index) => {
        const buttonClass = action.primary ? 
            'bg-aifa-blue text-white hover:bg-aifa-dark' : 
            'bg-gray-300 text-gray-700 hover:bg-gray-400';
        
        return `
            <button 
                id="modal-action-${index}"
                class="px-4 py-2 rounded-lg font-medium transition-colors ${buttonClass}"
                ${action.disabled ? 'disabled' : ''}
            >
                ${action.text}
            </button>
        `;
    }).join('');
    
    // Configurar event listeners para acciones
    actions.forEach((action, index) => {
        const button = document.getElementById(`modal-action-${index}`);
        if (button && action.handler) {
            button.addEventListener('click', async () => {
                try {
                    const result = await action.handler();
                    if (result !== false) { // Solo cerrar si no retorna false explícitamente
                        hideModal(modalId);
                    }
                } catch (error) {
                    console.error('❌ Error en acción del modal:', error);
                    showToast('Error al ejecutar la acción', 'error');
                }
            });
        }
    });
    
    // Mostrar modal
    overlay.classList.remove('hidden');
    
    // Configurar cierre con ESC
    if (closable) {
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                hideModal(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Configurar cierre con click en overlay
        const clickHandler = (e) => {
            if (e.target === overlay) {
                hideModal(modalId);
                overlay.removeEventListener('click', clickHandler);
            }
        };
        overlay.addEventListener('click', clickHandler);
    }
    
    return modalId;
}

/**
 * Ocultar modal específico
 */
export function hideModal(modalId) {
    const modal = uiState.modals.find(m => m.id === modalId);
    if (modal && modal.onClose) {
        modal.onClose();
    }
    
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    
    // Limpiar contenido
    const modalContent = document.getElementById('modal-content');
    const modalActions = document.getElementById('modal-actions');
    if (modalContent) modalContent.innerHTML = '';
    if (modalActions) modalActions.innerHTML = '';
    
    // Remover del estado
    uiState.modals = uiState.modals.filter(m => m.id !== modalId);
}

/**
 * Modal de confirmación
 */
export function showConfirmModal(message, options = {}) {
    const {
        title = 'Confirmar acción',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        type = 'warning'
    } = options;
    
    return new Promise((resolve) => {
        const iconMap = {
            warning: 'alert-triangle',
            danger: 'alert-circle',
            info: 'info',
            success: 'check-circle'
        };
        
        const colorMap = {
            warning: 'text-yellow-600',
            danger: 'text-red-600',
            info: 'text-blue-600',
            success: 'text-green-600'
        };
        
        showModal({
            title,
            content: `
                <div class="flex items-center space-x-3">
                    <i data-lucide="${iconMap[type]}" class="w-8 h-8 ${colorMap[type]}"></i>
                    <p class="text-gray-700">${message}</p>
                </div>
            `,
            actions: [
                {
                    text: cancelText,
                    handler: () => {
                        resolve(false);
                    }
                },
                {
                    text: confirmText,
                    primary: true,
                    handler: () => {
                        resolve(true);
                    }
                }
            ]
        });
        
        // Recrear iconos
        setTimeout(() => {
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }, 10);
    });
}

// =====================================================
// UTILIDADES DE FORMULARIOS
// =====================================================

/**
 * Validar formulario
 */
export function validateForm(formElement, rules = {}) {
    const errors = {};
    let isValid = true;
    
    // Limpiar errores previos
    formElement.querySelectorAll('.error-message').forEach(el => el.remove());
    formElement.querySelectorAll('.border-red-500').forEach(el => {
        el.classList.remove('border-red-500');
        el.classList.add('border-gray-300');
    });
    
    // Validar cada campo
    Object.entries(rules).forEach(([fieldName, fieldRules]) => {
        const field = formElement.querySelector(`[name="${fieldName}"]`);
        if (!field) return;
        
        const value = field.value.trim();
        const fieldErrors = [];
        
        // Validar requerido
        if (fieldRules.required && !value) {
            fieldErrors.push('Este campo es obligatorio');
        }
        
        // Validar longitud mínima
        if (fieldRules.minLength && value.length < fieldRules.minLength) {
            fieldErrors.push(`Mínimo ${fieldRules.minLength} caracteres`);
        }
        
        // Validar longitud máxima
        if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
            fieldErrors.push(`Máximo ${fieldRules.maxLength} caracteres`);
        }
        
        // Validar patrón
        if (fieldRules.pattern && value && !fieldRules.pattern.test(value)) {
            fieldErrors.push(fieldRules.message || 'Formato no válido');
        }
        
        // Validar función personalizada
        if (fieldRules.custom && value) {
            const customError = fieldRules.custom(value);
            if (customError) {
                fieldErrors.push(customError);
            }
        }
        
        // Mostrar errores en el campo
        if (fieldErrors.length > 0) {
            isValid = false;
            errors[fieldName] = fieldErrors;
            
            // Cambiar estilo del campo
            field.classList.remove('border-gray-300');
            field.classList.add('border-red-500');
            
            // Mostrar mensaje de error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message text-red-500 text-sm mt-1';
            errorDiv.textContent = fieldErrors[0];
            field.parentNode.appendChild(errorDiv);
        }
    });
    
    return { isValid, errors };
}

/**
 * Obtener datos del formulario
 */
export function getFormData(formElement) {
    const formData = new FormData(formElement);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        // Manejar checkboxes múltiples
        if (data[key]) {
            if (Array.isArray(data[key])) {
                data[key].push(value);
            } else {
                data[key] = [data[key], value];
            }
        } else {
            data[key] = value;
        }
    }
    
    return data;
}

/**
 * Llenar formulario con datos
 */
export function fillForm(formElement, data) {
    Object.entries(data).forEach(([key, value]) => {
        const field = formElement.querySelector(`[name="${key}"]`);
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = !!value;
            } else if (field.type === 'radio') {
                if (field.value === value) {
                    field.checked = true;
                }
            } else {
                field.value = value || '';
            }
        }
    });
}

// =====================================================
// UTILIDADES DE TABLAS
// =====================================================

/**
 * Crear tabla responsive
 */
export function createTable(data, columns, options = {}) {
    const {
        sortable = true,
        searchable = false,
        paginated = false,
        pageSize = 20,
        emptyMessage = 'No hay datos disponibles',
        className = 'min-w-full divide-y divide-gray-200'
    } = options;
    
    if (!data || data.length === 0) {
        return `
            <div class="text-center py-8">
                <i data-lucide="file-x" class="w-12 h-12 text-gray-400 mx-auto mb-3"></i>
                <p class="text-gray-500">${emptyMessage}</p>
            </div>
        `;
    }
    
    const tableId = 'table-' + Date.now();
    
    // Crear HTML de la tabla
    const tableHTML = `
        <div class="overflow-x-auto">
            <table id="${tableId}" class="${className}">
                <thead class="bg-gray-50">
                    <tr>
                        ${columns.map(col => `
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''}" 
                                ${sortable ? `data-sort="${col.key}"` : ''}>
                                <div class="flex items-center space-x-1">
                                    <span>${col.label}</span>
                                    ${sortable ? '<i data-lucide="arrow-up-down" class="w-4 h-4"></i>' : ''}
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${data.map((row, index) => `
                        <tr class="hover:bg-gray-50">
                            ${columns.map(col => `
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${col.render ? col.render(row[col.key], row, index) : (row[col.key] || '-')}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return tableHTML;
}

// =====================================================
// UTILIDADES DE FORMATEO
// =====================================================

/**
 * Formatear número
 */
export function formatNumber(value, decimals = 2, locale = 'es-MX') {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Formatear porcentaje
 */
export function formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    return new Intl.NumberFormat('es-MX', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value / 100);
}

/**
 * Formatear fecha
 */
export function formatDate(date, format = 'short') {
    if (!date) return '-';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const options = {
        short: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric' },
        time: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    
    return new Intl.DateTimeFormat('es-MX', options[format] || options.short).format(dateObj);
}

/**
 * Formatear texto para mostrar
 */
export function formatText(text, maxLength = null) {
    if (!text) return '-';
    
    if (maxLength && text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    
    return text;
}

// =====================================================
// UTILIDADES DE EXPORTACIÓN
// =====================================================

/**
 * Exportar datos a CSV
 */
export function exportToCSV(data, filename = 'export.csv', columns = null) {
    if (!data || data.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    // Usar columnas especificadas o todas las claves del primer objeto
    const cols = columns || Object.keys(data[0]);
    
    // Crear CSV
    const csvContent = [
        // Header
        cols.join(','),
        // Data
        ...data.map(row => 
            cols.map(col => {
                const value = row[col];
                // Escapar valores que contengan comas, comillas o saltos de línea
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        )
    ].join('\n');
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Archivo exportado correctamente', 'success');
}

// =====================================================
// INICIALIZACIÓN Y CONFIGURACIÓN GLOBAL
// =====================================================

/**
 * Inicializar utilidades de UI
 */
export function initUI() {
    // Exponer funciones globalmente para uso en HTML
    window.ui = {
        showToast,
        hideToast,
        clearAllToasts,
        showLoading,
        hideLoading,
        withLoading,
        showModal,
        hideModal,
        showConfirmModal,
        validateForm,
        getFormData,
        fillForm,
        createTable,
        formatNumber,
        formatPercentage,
        formatDate,
        formatText,
        exportToCSV
    };
    
    // Configurar cierre de modal con botón X
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            const overlay = document.getElementById('modal-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        });
    }
    
    if (DEBUG.enabled) console.log('✅ Utilidades de UI inicializadas');
}

// Auto-inicializar cuando se carga el módulo
initUI();
