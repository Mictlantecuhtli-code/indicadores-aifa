import { createRoot } from 'react-dom/client';

let root = null;

export async function renderVisualizationReact(container) {
  // Limpiar contenedor
  container.innerHTML = '<div id="react-visualization-root"></div>';
  
  const reactRoot = document.getElementById('react-visualization-root');
  
  if (!reactRoot) {
    console.error('No se encontró el contenedor de React');
    return;
  }

  try {
    // Importar dinámicamente el componente React
    const { default: AdvancedVisualization } = await import('../pages/AdvancedVisualization.jsx');
    const React = await import('react');

    // Limpiar root anterior si existe
    if (root) {
      root.unmount();
    }
    
    // Crear nuevo root y renderizar
    root = createRoot(reactRoot);
    
    // Usar React.createElement en lugar de JSX
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
      </div>
    `;
  }
}
