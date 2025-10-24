import { createRoot } from 'react-dom/client';

let root = null;

export async function renderVisualizationReact(container) {
  container.innerHTML = '<div id="react-visualization-root"></div>';
  
  const reactRoot = document.getElementById('react-visualization-root');
  
  if (!reactRoot) {
    console.error('No se encontró el contenedor de React');
    return;
  }

  try {
    // Importar React y el componente
    const React = await import('react');
    const { default: AdvancedVisualization } = await import('../pages/AdvancedVisualization.js');

    // Limpiar root anterior
    if (root) {
      root.unmount();
    }
    
    // Crear y renderizar
    root = createRoot(reactRoot);
    
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(AdvancedVisualization)
      )
    );
    
  } catch (error) {
    console.error('Error cargando componente React:', error);
    container.innerHTML = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
        <h3 class="mt-4 text-lg font-semibold text-red-900">Error al cargar la visualización</h3>
        <p class="mt-2 text-sm text-red-600">${error.message}</p>
        <button 
          onclick="location.reload()"
          class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    `;
  }
}
