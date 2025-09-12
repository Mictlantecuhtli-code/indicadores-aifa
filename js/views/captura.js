// =====================================================
// VISTA DE CAPTURA DE DATOS
// =====================================================

import { DEBUG } from '../config.js';
import { getCurrentProfile, hasRoleLevel } from '../lib/supa.js';
import { showToast } from '../lib/ui.js';

/**
 * Renderizar vista de captura
 */
export async function render(container, params = {}, query = {}) {
    try {
        if (DEBUG.enabled) console.log('✍️ Renderizando vista captura', { params, query });

        // Verificar permisos del usuario
        const profile = await getCurrentProfile();
        if (!profile || !hasRoleLevel(profile.rol_principal, 'CAPTURADOR')) {
            showToast('No tienes permisos para capturar datos', 'error');
            container.innerHTML = `
                <div class="text-center py-12">
                    <i data-lucide="lock" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">Acceso restringido</h2>
                    <p class="text-gray-600">No cuentas con permisos de captura.</p>
                </div>
            `;
            if (window.lucide) {
                window.lucide.createIcons();
            }
            return;
        }

        // Contenido principal de captura (placeholder)
        container.innerHTML = `
            <div class="p-6 space-y-4">
                <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <i data-lucide="edit-3" class="w-6 h-6"></i>
                    Captura de indicadores
                </h1>
                <p class="text-gray-600">Seleccione un área para comenzar la captura de datos.</p>
            </div>
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }

    } catch (error) {
        console.error('❌ Error al renderizar captura:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">Error al cargar captura</h2>
                <p class="text-gray-600">${error.message}</p>
            </div>
        `;
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

