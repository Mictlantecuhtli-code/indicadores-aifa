import React from 'react';
import { createRoot } from 'react-dom/client';
import AdvancedVisualization from '../pages/AdvancedVisualization.jsx';

let root = null;

export function renderVisualizationReact(container) {
  // Limpiar contenedor
  container.innerHTML = '<div id="react-visualization-root"></div>';
  
  const reactRoot = document.getElementById('react-visualization-root');
  
  if (!reactRoot) {
    console.error('No se encontró el contenedor de React');
    return;
  }

  // Crear o reutilizar root de React
  if (root) {
    root.unmount();
  }
  
  root = createRoot(reactRoot);
  
  // Renderizar componente React
  root.render(
    <React.StrictMode>
      <AdvancedVisualization />
    </React.StrictMode>
  );
}
