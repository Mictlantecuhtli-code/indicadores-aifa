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

const ALERT_LINE_CONFIGS = [
  {
    value: 80,
    label: 'Nivel de alerta 3: 80%',
    color: 'rgb(239, 68, 68)',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-900 font-semibold'
  },
  {
    value: 83,
    label: 'Nivel de alerta 2: 83%',
    color: 'rgb(249, 115, 22)',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-900 font-semibold'
  },
  {
    value: 87,
    label: 'Nivel de alerta 1: 87%',
    color: 'rgb(234, 179, 8)',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-900 font-semibold'
  },
  {
    value: 90,
    label: 'Objetivo: 90%',
    color: 'rgb(34, 197, 94)',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-900'
  }
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
  const tableSections = buildSmsPistasTableSections(data, fieldName);
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
              ${tableSections.header}
            </thead>
            <tbody data-table-body>
              ${tableSections.body}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Determina las clases de estilo para una celda según el nivel de alerta
 */
function getAlertCellClasses(valueNum) {
  if (valueNum == null || isNaN(valueNum)) {
    return {
      bgClass: '',
      textClass: 'text-slate-500'
    };
  }

  if (valueNum < ALERT_LINE_CONFIGS[0].value) {
    return {
      bgClass: ALERT_LINE_CONFIGS[0].bgClass,
      textClass: ALERT_LINE_CONFIGS[0].textClass
    };
  }

  if (valueNum < ALERT_LINE_CONFIGS[1].value) {
    return {
      bgClass: ALERT_LINE_CONFIGS[1].bgClass,
      textClass: ALERT_LINE_CONFIGS[1].textClass
    };
  }

  if (valueNum < ALERT_LINE_CONFIGS[2].value) {
    return {
      bgClass: ALERT_LINE_CONFIGS[2].bgClass,
      textClass: ALERT_LINE_CONFIGS[2].textClass
    };
  }

  if (valueNum < ALERT_LINE_CONFIGS[3].value) {
    return {
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-900 font-semibold'
    };
  }

  return {
    bgClass: ALERT_LINE_CONFIGS[3].bgClass,
    textClass: ALERT_LINE_CONFIGS[3].textClass
  };
}

/**
 * Construye los encabezados y filas de la tabla "Detalle por pista y mes"
 */
function buildSmsPistasTableSections(data, fieldName) {
  if (!data || !data.length) {
    return {
      header: `
        <tr>
          <th class="px-4 py-3 text-left text-sm font-semibold text-slate-700">Mes</th>
        </tr>
      `,
      body: `
        <tr>
          <td class="px-4 py-6 text-center text-slate-400">No hay datos disponibles</td>
        </tr>
      `
    };
  }

  const pistas = [...new Set(data.map(row => row.pista).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const headerCells = [
    '<th class="px-4 py-3 text-left text-sm font-semibold text-slate-700">Mes</th>',
    ...pistas.map(pista => `
      <th class="px-4 py-3 text-right text-sm font-semibold text-slate-700">
        <span class="block">${escapeHtml(pista)}</span>
        <span class="block text-xs font-normal text-slate-500">${escapeHtml(fieldName)}</span>
      </th>
    `)
  ].join('');

  const monthYearPairs = [...new Map(data.map(row => {
    const key = `${row.anio}-${String(row.mes).padStart(2, '0')}`;
    return [key, { year: row.anio, month: row.mes }];
  })).values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.month - b.month;
  });

  const bodyRows = monthYearPairs.map(({ year, month }) => {
    const monthInfo = MONTHS.find(m => m.value === month);
    const monthLabel = monthInfo ? `${monthInfo.label} ${year}` : `Mes ${month} ${year}`;

    const cells = pistas.map(pista => {
      const record = data.find(row => row.anio === year && row.mes === month && row.pista === pista);
      const value = record ? record[fieldName] : null;
      const numericValue = Number(value);
      const { bgClass, textClass } = getAlertCellClasses(numericValue);

      return `
        <td class="px-4 py-3 text-right text-sm ${bgClass} ${textClass}">${formatPercentage(value)}</td>
      `;
    }).join('');

    return `
      <tr class="border-b border-slate-100 transition hover:bg-slate-50">
        <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(monthLabel)}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  return {
    header: `<tr>${headerCells}</tr>`,
    body: bodyRows
  };
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
    
    // Para líneas: usar colores muy transparentes para el relleno
    const fillColor = chartType === 'line' 
      ? colorSet.bg.replace('0.8', '0.15')  // Relleno muy transparente
      : colorSet.bg;

    return {
      label: pista,
      data: values,
      backgroundColor: fillColor,
      borderColor: colorSet.border,
      borderWidth: chartType === 'line' ? 3 : 2,
      tension: chartType === 'line' ? 0.4 : 0,
      fill: true,  // Siempre con relleno
      pointBackgroundColor: colorSet.border,
      pointBorderColor: '#fff',
      pointBorderWidth: chartType === 'line' ? 2 : 0,
      pointRadius: chartType === 'line' ? 5 : 0,
      pointHoverRadius: chartType === 'line' ? 7 : 0,
      pointHoverBackgroundColor: colorSet.border,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2
    };
  });

  const thresholdDatasets = ALERT_LINE_CONFIGS.map((lineConfig, index) => ({
    label: lineConfig.label,
    data: labels.map(() => lineConfig.value),
    type: 'line',
    borderColor: lineConfig.color,
    borderWidth: 2,
    borderDash: index === ALERT_LINE_CONFIGS.length - 1 ? [] : [6, 6],
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: 0,
    tension: 0,
    order: 99,
    isThreshold: true
  }));

  const config = {
    type: chartType,
    data: {
      labels,
      datasets: [...datasets, ...thresholdDatasets]
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
              if (context.dataset?.isThreshold) {
                return context.dataset.label;
              }

              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y.toFixed(2) + '%';

              // Agregar nivel según el valor
              const value = context.parsed.y;
              if (value < ALERT_LINE_CONFIGS[0].value) {
                label += ' (Nivel de alerta 3)';
              } else if (value < ALERT_LINE_CONFIGS[1].value) {
                label += ' (Nivel de alerta 2)';
              } else if (value < ALERT_LINE_CONFIGS[2].value) {
                label += ' (Nivel de alerta 1)';
              } else if (value < ALERT_LINE_CONFIGS[3].value) {
                label += ' (Por debajo del objetivo)';
              } else {
                label += ' (Objetivo alcanzado)';
              }
              
              return label;
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

  return `
    <div class="rounded-lg border border-slate-200 bg-white p-6">
      <h3 class="mb-4 text-lg font-semibold text-slate-900">Resumen ${latestYear}</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      </div>
    </div>
  `;
}
