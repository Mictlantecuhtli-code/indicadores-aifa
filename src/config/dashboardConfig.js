export const INDICATOR_OPTION_TEMPLATES = [
  {
    id: 'mensual_vs_anterior',
    icon: 'calendar-month',
    template:
      'Cantidad de {{subject}} real mensual del año en curso respecto al mismo periodo del año anterior'
  },
  {
    id: 'trimestral_vs_anterior',
    icon: 'calendar-quarter',
    template:
      'Cantidad de {{subject}} real trimestral del año en curso respecto al mismo periodo del año anterior'
  },
  {
    id: 'anual_vs_anterior',
    icon: 'calendar-year',
    template:
      'Cantidad de {{subject}} real anual del año en curso respecto al mismo periodo del año anterior'
  },
  {
    id: 'escenario_bajo',
    icon: 'target-low',
    template:
      'Cantidad de {{subject}} real del año en curso respecto a la proyección de meta escenario Bajo'
  },
  {
    id: 'escenario_medio',
    icon: 'target-mid',
    template:
      'Cantidad de {{subject}} real del año en curso respecto a la proyección de meta escenario Medio'
  },
  {
    id: 'escenario_alto',
    icon: 'target-high',
    template:
      'Cantidad de {{subject}} real del año en curso respecto a la proyección de meta escenario Alto'
  }
];

export const INDICATOR_SECTIONS = [
  {
    id: 'operativos',
    title: 'Indicadores Operativos',
    description: 'Aviación Comercial y Aviación Carga.',
    accent: 'indigo',
    categories: [
      {
        id: 'aviacion-comercial-operaciones',
        label: 'Aviación Comercial Operaciones',
        subject: 'Aviación Comercial Operaciones',
        palette: 'indigo',
        icon: 'plane-operations'
      },
      {
        id: 'aviacion-comercial-pasajeros',
        label: 'Aviación Comercial Pasajeros',
        subject: 'Aviación Comercial Pasajeros',
        palette: 'blue',
        icon: 'plane-passengers'
      },
      {
        id: 'aviacion-carga-operaciones',
        label: 'Aviación Carga Operaciones',
        subject: 'Aviación Carga Operaciones',
        palette: 'amber',
        icon: 'cargo-operations'
      },
      {
        id: 'aviacion-carga-toneladas',
        label: 'Aviación Carga Toneladas',
        subject: 'Aviación Carga Toneladas',
        palette: 'orange',
        icon: 'cargo-weight'
      }
    ]
  },
  {
    id: 'fbo',
    title: 'Indicadores FBO (Aviación General)',
    description: 'Tráfico de aviación general y ejecutiva.',
    accent: 'emerald',
    categories: [
      {
        id: 'aviacion-general-operaciones',
        label: 'Aviación General Operaciones',
        subject: 'Aviación General Operaciones',
        palette: 'emerald',
        icon: 'fbo-operations'
      },
      {
        id: 'aviacion-general-pasajeros',
        label: 'Aviación General Pasajeros',
        subject: 'Aviación General Pasajeros',
        palette: 'teal',
        icon: 'fbo-passengers'
      }
    ]
  }
];

export const DIRECTION_FALLBACKS = [
  {
    id: 'direccion-operacion',
    name: 'Dirección de Operación',
    code: 'DO',
    palette: 'indigo'
  },
  {
    id: 'direccion-planeacion-estrategica',
    name: 'Dirección de Planeación Estratégica',
    code: 'DPE',
    palette: 'violet'
  },
  {
    id: 'direccion-comercial-servicios',
    name: 'Dirección Comercial y de Servicios',
    code: 'DCS',
    palette: 'amber'
  },
  {
    id: 'direccion-administracion',
    name: 'Dirección de Administración',
    code: 'DA',
    palette: 'sky'
  },
  {
    id: 'direccion-juridica',
    name: 'Dirección Jurídica',
    code: 'DJ',
    palette: 'emerald'
  }
];

export function buildIndicatorOptions(category) {
  return INDICATOR_OPTION_TEMPLATES.map(template => ({
    id: `${category.id}__${template.id}`,
    templateId: template.id,
    icon: template.icon,
    label: template.template.replace(/\{\{subject\}\}/gi, category.subject)
  }));
}

export function normalizeText(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCodeFromName(name) {
  if (!name) return '';
  const matches = name.match(/[A-ZÁÉÍÓÚÜÑ]/g);
  if (matches?.length) {
    return matches.join('');
  }
  return name
    .split(/\s+/)
    .slice(0, 3)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}
