// modalIndicadoresSMS.js - Modal para Indicadores SMS (Objetivo 2)
// Indicador 2.1: Porcentaje de disponibilidad del sistema de iluminación
// Indicador 2.2: Índice de confiabilidad del sistema de iluminación

export const SMS_PISTAS_MODAL_ID = 'modal-sms-pistas';

const MONTHS = [
  { value: 1, label: 'Enero', short: 'Ene' },
  { value: 2, label: 'Febrero', short: 'Feb' },
  { value: 3, label: 'Marzo', short: 'Mar' },
  { value: 4, label: 'Abril', short: 'Abr' },
  { value: 5, label: 'Mayo', short: 'May' },
  { value: 6, label: 'Junio', short: 'Jun' },
  { value: 7, label: 'Julio', short: 'Jul' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Septiembre', short: 'Sep' },
  { value: 10, label: 'Octubre', short: 'Oct' },
  { value: 11, label: 'Noviembre', short: 'Nov' },
  { value: 12, label: 'Diciembre', short: 'Dic' }
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPercentage(value) {
  if (value == null || isNaN(value)) return '-';
  return `${Number(value).toFixed(2)}%`;
}

/**
 * Construye el markup del modal de Indicadores SMS
 */
export function buildSmsPistasModalMarkup(indicatorId, indicatorName, indicatorSubtitle) {
  const indicatorType = indicatorId === 'sms-indicator-2-1' ? 'disponibilidad' : 'confiabilidad';
  const fieldName = indicatorId === 'sms-indicator-2-1' 
    ? 'Índice de Disponibilidad (%)' 
    : 'Índice de Confiabilidad (%)';

  return `
    <div
      id="${SMS_PISTAS_MODAL_ID}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200"
      style="display: none"
      data-modal-overlay
    >
      <div
        class="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[90vh] md:rounded-xl"
        data-modal-content
        role="dialog"
        aria-labelledby="modal-sms-pistas-title"
        aria-describedby="modal-sms-pistas-description"
      >
        <!-- Header -->
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div class="flex-1">
            <h2 id="modal-sms-pistas-title" class="text-2xl font-bold text-slate-900">
              ${escapeHtml(indicatorName)}
            </h2>
            <p id="modal-sms-pistas-description" class="mt-1 text-sm text-slate-600">
              ${escapeHtml(indicatorSubtitle)}
            </p>
          </div>
          <button
            type="button"
            class="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aifa-light"
            data-close-modal
            aria-label="Cerrar modal"
          >
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-6" data-modal-body>
          <div class="flex items-center justify-center py-8">
            <div class="flex items-center gap-2 text-slate-400">
              <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
              <span>Cargando datos...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Construye la vista de gráficas para los indicadores SMS
 */
export function buildSmsPistasChartView(data, chartType = 'bar', indicatorId = 'sms-indicator-2-1') {
  const indicatorType = indicatorId === 'sms-indicator-2-1' ? 'disponibilidad' : 'confiabilidad';
  const fieldName = indicatorId === 'sms-indicator-2-1' 
    ? 'Índice de Disponibilidad (%)' 
    : 'Índice de Confiabilidad (%)';
  const alertLevel1 = 80;
  const alertLevel2 = 83;

  return `
    <div class="space-y-6">
      <!-- Controles -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-700">Tipo de gráfica:</span>
          <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group">
            <button
              type="button"
              data-chart-type="bar"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition ${
                chartType === 'bar'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }"
            >
              <i class="fa-solid fa-chart-column mr-1.5"></i>
              Barras
            </button>
            <button
              type="button"
              data-chart-type="line"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition ${
                chartType === 'line'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }"
            >
              <i class="fa-solid fa-chart-line mr-1.5"></i>
              Líneas
            </button>
          </div>
        </div>

        <!-- Leyenda de niveles de alerta -->
        <div class="flex items-center gap-4 text-xs">
          <div class="flex items-center gap-2">
            <div class="h-3 w-8 border border-rose-400 bg-rose-100"></div>
            <span class="text-slate-600">Nivel de alerta 3: &lt;${alertLevel1}%</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-3 w-8 border border-amber-400 bg-amber-100"></div>
            <span class="text-slate-600">Nivel de alerta 2: ${alertLevel1}%-${alertLevel2}%</span>
          </div>
        </div>
      </div>

      <!-- Gráfica -->
      <div class="rounded-lg border border-slate-200 bg-white p-6">
        <div style="height: 400px; position: relative;">
          <canvas id="sms-pistas-chart" data-sms-pistas-chart></canvas>
        </div>
      </div>

      <!-- Tabla de datos -->
      <div class="rounded-lg border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-6 py-4">
          <h3 class="text-lg font-semibold text-slate-900">Detalle por pista y mes</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pista</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-slate-700">Mes</th>
                <th class="px-4 py-3 text-right text-sm font-semibold text-slate-700">${escapeHtml(fieldName)}</th>
              </tr>
            </thead>
            <tbody data-table-body>
              ${buildSmsPistasTableBody(data, fieldName)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Construye el cuerpo de la tabla de datos
 */
function buildSmsPistasTableBody(data, fieldName) {
  if (!data || !data.length) {
    return `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-slate-400">
          No hay datos disponibles
        </td>
      </tr>
    `;
  }

  // Ordenar por año, mes y pista
  const sortedData = [...data].sort((a, b) => {
    if (a.anio !== b.anio) return b.anio - a.anio;
    if (a.mes !== b.mes) return a.mes - b.mes;
    return (a.pista || '').localeCompare(b.pista || '');
  });

  return sortedData
    .map(row => {
      const month = MONTHS.find(m => m.value === row.mes);
      const monthLabel = month ? `${month.label} ${row.anio}` : `Mes ${row.mes} ${row.anio}`;
      const value = row[fieldName];
      const valueNum = Number(value);
      
      // Determinar color según nivel de alerta
      let bgClass = '';
      let textClass = 'text-slate-900';
      if (!isNaN(valueNum)) {
        if (valueNum < 80) {
          bgClass = 'bg-rose-50';
          textClass = 'text-rose-900 font-semibold';
        } else if (valueNum < 83) {
          bgClass = 'bg-amber-50';
          textClass = 'text-amber-900 font-semibold';
        }
      }

      return `
        <tr class="border-b border-slate-100 ${bgClass} transition hover:bg-slate-50">
          <td class="px-4 py-3 text-sm ${textClass}">${escapeHtml(row.pista || '-')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(monthLabel)}</td>
          <td class="px-4 py-3 text-right text-sm ${textClass}">${formatPercentage(value)}</td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Construye la configuración de Chart.js para las gráficas de pistas
 */
export function buildSmsPistasChartConfig(data, chartType = 'bar', indicatorId = 'sms-indicator-2-1') {
  const fieldName = indicatorId === 'sms-indicator-2-1' 
    ? 'Índice de Disponibilidad (%)' 
    : 'Índice de Confiabilidad (%)';

  if (!data || !data.length) {
    return {
      type: chartType,
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    };
  }

  // Obtener el año más reciente
  const latestYear = Math.max(...data.map(d => d.anio));
  const latestYearData = data.filter(d => d.anio === latestYear);

  // Obtener pistas únicas
  const pistas = [...new Set(latestYearData.map(d => d.pista))].sort();
  
  // Obtener meses únicos y ordenarlos
  const meses = [...new Set(latestYearData.map(d => d.mes))].sort((a, b) => a - b);
  
  // Crear labels para el eje X (solo los nombres de los meses)
  const labels = meses.map(mesNum => {
    const month = MONTHS.find(m => m.value === mesNum);
    return month ? month.label : `Mes ${mesNum}`;
  });

  // Colores para cada pista
  const pistaColors = [
    { 
      bg: 'rgba(59, 130, 246, 0.8)',    // Azul para primera pista
      border: 'rgba(59, 130, 246, 1)'
    },
    { 
      bg: 'rgba(251, 146, 60, 0.8)',    // Naranja para segunda pista
      border: 'rgba(251, 146, 60, 1)'
    },
    { 
      bg: 'rgba(34, 197, 94, 0.8)',     // Verde para tercera pista (si existe)
      border: 'rgba(34, 197, 94, 1)'
    },
    { 
      bg: 'rgba(168, 85, 247, 0.8)',    // Morado para cuarta pista (si existe)
      border: 'rgba(168, 85, 247, 1)'
    }
  ];

  // Crear datasets, uno por cada pista
  const datasets = pistas.map((pista, pistaIndex) => {
    const values = meses.map(mesNum => {
      const record = latestYearData.find(d => d.pista === pista && d.mes === mesNum);
      return record ? Number(record[fieldName]) || 0 : 0;
    });

    const colorSet = pistaColors[pistaIndex % pistaColors.length];

    return {
      label: pista,
      data: values,
      backgroundColor: colorSet.bg,
      borderColor: colorSet.border,
      borderWidth: 2,
      tension: chartType === 'line' ? 0.4 : 0,
      fill: chartType === 'line',
      pointBackgroundColor: colorSet.border,
      pointBorderColor: colorSet.border,
      pointRadius: chartType === 'line' ? 4 : 0,
      pointHoverRadius: chartType === 'line' ? 6 : 0
    };
  });

  const config = {
    type: chartType,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y.toFixed(2) + '%';
              
              // Agregar nivel de alerta
              const value = context.parsed.y;
              if (value < 80) {
                label += ' (Nivel de alerta 3)';
              } else if (value < 83) {
                label += ' (Nivel de alerta 2)';
              }
              
              return label;
            }
          }
        },
        // Líneas de referencia para niveles de alerta
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: 80,
              yMax: 80,
              borderColor: 'rgba(239, 68, 68, 0.5)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: 'Nivel de alerta 3: 80%',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: 'white',
                font: {
                  size: 10
                }
              }
            },
            line2: {
              type: 'line',
              yMin: 83,
              yMax: 83,
              borderColor: 'rgba(251, 191, 36, 0.5)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: 'Nivel de alerta 2: 83%',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(251, 191, 36, 0.8)',
                color: 'white',
                font: {
                  size: 10
                }
              }
            }
          }
        }
      }
    }
  };

  return config;
}

/**
 * Construye un resumen de los datos
 */
export function buildSmsPistasSummary(data, indicatorId) {
  const fieldName = indicatorId === 'sms-indicator-2-1' 
    ? 'Índice de Disponibilidad (%)' 
    : 'Índice de Confiabilidad (%)';

  if (!data || !data.length) {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p class="text-sm text-slate-500">No hay datos disponibles para mostrar un resumen.</p>
      </div>
    `;
  }

  // Calcular estadísticas
  const latestYear = Math.max(...data.map(d => d.anio));
  const latestYearData = data.filter(d => d.anio === latestYear);
  
  const values = latestYearData
    .map(d => Number(d[fieldName]))
    .filter(v => !isNaN(v));

  if (values.length === 0) {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p class="text-sm text-slate-500">No hay datos numéricos disponibles.</p>
      </div>
    `;
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const belowAlert3 = values.filter(v => v < 80).length;
  const belowAlert2 = values.filter(v => v >= 80 && v < 83).length;

  return `
    <div class="rounded-lg border border-slate-200 bg-white p-6">
      <h3 class="mb-4 text-lg font-semibold text-slate-900">Resumen ${latestYear}</h3>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div class="rounded-lg bg-slate-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Promedio</div>
          <div class="mt-1 text-2xl font-bold text-slate-900">${formatPercentage(avg)}</div>
        </div>
        <div class="rounded-lg bg-slate-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Mínimo</div>
          <div class="mt-1 text-2xl font-bold text-slate-900">${formatPercentage(min)}</div>
        </div>
        <div class="rounded-lg bg-slate-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Máximo</div>
          <div class="mt-1 text-2xl font-bold text-slate-900">${formatPercentage(max)}</div>
        </div>
        <div class="rounded-lg bg-rose-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-rose-700">Alerta 3 (&lt;80%)</div>
          <div class="mt-1 text-2xl font-bold text-rose-900">${belowAlert3}</div>
        </div>
        <div class="rounded-lg bg-amber-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-amber-700">Alerta 2 (80-83%)</div>
          <div class="mt-1 text-2xl font-bold text-amber-900">${belowAlert2}</div>
        </div>
      </div>
    </div>
  `;
}
