import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X, CheckCircle2, Circle } from 'lucide-react';
import { useAreaHierarchy } from '../hooks/useAreaHierarchy.js';
import { ROLE_LABELS, isAreaValidForRole } from '../lib/permissions.js';

/**
 * Componente selector de áreas con vista jerárquica
 * Permite selección simple o múltiple con permisos
 */
export default function AreaSelector({
  // Configuración de selección
  value = null, // ID del área seleccionada (modo simple)
  values = [], // IDs de áreas seleccionadas (modo múltiple)
  onChange, // Callback cuando cambia la selección
  multiple = false, // Permitir selección múltiple
  
  // Filtros
  filterByRole = null, // Filtrar áreas por rol
  filterByIds = null, // Mostrar solo áreas específicas
  disabledIds = [], // IDs de áreas deshabilitadas
  
  // Validación
  validateArea = null, // Función custom de validación (area) => boolean
  showValidation = false, // Mostrar iconos de validación
  
  // UI
  placeholder = 'Seleccionar área...',
  emptyMessage = 'No hay áreas disponibles',
  searchPlaceholder = 'Buscar área...',
  showSearch = true,
  showBreadcrumb = true,
  maxHeight = '400px',
  
  // Estado
  disabled = false,
  error = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    searchedTree,
    selectedAreaId,
    selectArea,
    clearSelection,
    searchTerm,
    updateSearch,
    clearSearch,
    isExpanded,
    toggleExpanded,
    expandToArea,
    getAreaById,
    selectedAreaPath,
    isLoading
  } = useAreaHierarchy({
    filterByRole,
    filterByIds,
    initialSelectedId: multiple ? null : value,
    enableSearch: showSearch
  });

  // Áreas seleccionadas en modo múltiple
  const selectedIds = useMemo(() => {
    return new Set(multiple ? values : (value ? [value] : []));
  }, [multiple, values, value]);

  // Obtener área seleccionada para display
  const displayArea = useMemo(() => {
    if (multiple) {
      if (selectedIds.size === 0) return null;
      if (selectedIds.size === 1) {
        return getAreaById(Array.from(selectedIds)[0]);
      }
      return { nombre: `${selectedIds.size} áreas seleccionadas` };
    }
    return value ? getAreaById(value) : null;
  }, [multiple, selectedIds, value, getAreaById]);

  // Verificar si un área está deshabilitada
  const isAreaDisabled = (area) => {
    if (!area) return true;
    if (disabledIds.includes(area.id)) return true;
    if (validateArea && !validateArea(area)) return true;
    if (filterByRole && !isAreaValidForRole(area, filterByRole)) return true;
    return false;
  };

  // Manejar selección de área
  const handleSelectArea = (area) => {
    if (isAreaDisabled(area)) return;

    if (multiple) {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(area.id)) {
        newSelection.delete(area.id);
      } else {
        newSelection.add(area.id);
      }
      onChange?.(Array.from(newSelection));
    } else {
      onChange?.(area.id);
      setIsOpen(false);
      clearSearch();
    }
  };

  // Limpiar selección
  const handleClear = (e) => {
    e.stopPropagation();
    if (multiple) {
      onChange?.([]);
    } else {
      onChange?.(null);
    }
    clearSelection();
  };

  // Renderizar nodo del árbol
  const renderTreeNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const expanded = isExpanded(node.id);
    const selected = selectedIds.has(node.id);
    const isDisabled = isAreaDisabled(node);

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => handleSelectArea(node)}
          disabled={isDisabled}
          className={`
            group flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
            ${selected ? 'bg-aifa-blue/10 text-aifa-blue font-medium' : 'text-slate-700 hover:bg-slate-50'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
        >
          {/* Icono de expansión */}
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="flex-shrink-0 p-0.5 hover:bg-slate-200 rounded"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>
          )}
          
          {/* Espacio si no tiene hijos */}
          {!hasChildren && <span className="w-5" />}

          {/* Checkbox o radio */}
          {multiple ? (
            selected ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-aifa-blue" />
            ) : (
              <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" />
            )
          ) : (
            selected && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-aifa-blue" />
          )}

          {/* Badge de clave */}
          {node.clave && (
            <span
              className="flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: node.color_hex || '#64748b',
                color: '#ffffff'
              }}
            >
              {node.clave}
            </span>
          )}

          {/* Nombre del área */}
          <span className="flex-1 truncate">{node.nombre}</span>

          {/* Nivel del área */}
          <span className="flex-shrink-0 text-xs text-slate-400">
            Nivel {node.nivel}
          </span>

          {/* Validación */}
          {showValidation && !isDisabled && (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
          )}
        </button>

        {/* Hijos */}
        {hasChildren && expanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ... (todo el código anterior se mantiene)

  return (
    <div className="relative">
      {/* Input/Button que abre el selector */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm
          transition-colors focus:outline-none focus:ring-2 focus:ring-aifa-blue/30
          ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white hover:border-aifa-blue'}
          ${error ? 'border-red-300' : 'border-slate-200'}
        `}
      >
        <span className="flex-1 truncate">
          {displayArea?.nombre || placeholder}
        </span>
        
        <div className="flex items-center gap-1">
          {displayArea && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-slate-100"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* Breadcrumb */}
      {showBreadcrumb && displayArea && selectedAreaPath.length > 0 && !multiple && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {selectedAreaPath.map((area, index) => (
            <span key={area.id} className="flex items-center">
              {index > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
              {area.nombre}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Overlay para cerrar al hacer clic afuera */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel del selector */}
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            {/* Barra de búsqueda */}
            {showSearch && (
              <div className="border-b border-slate-100 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => updateSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
                
                {/* Info sobre filtro de rol */}
                {filterByRole && (
                  <p className="mt-2 text-xs text-slate-500">
                    Mostrando áreas válidas para: <span className="font-semibold">{ROLE_LABELS[filterByRole]}</span>
                  </p>
                )}
              </div>
            )}

            {/* Lista del árbol */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-aifa-blue" />
                    <p className="text-sm text-slate-500">Cargando áreas...</p>
                  </div>
                </div>
              ) : searchedTree.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">
                    {searchTerm ? 'No se encontraron áreas' : emptyMessage}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {searchedTree.map(node => renderTreeNode(node, 0))}
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            {multiple && selectedIds.size > 0 && (
              <div className="border-t border-slate-100 px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {selectedIds.size} área{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-aifa-blue hover:underline"
                  >
                    Limpiar selección
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Variante compacta del selector para formularios
 */
export function AreaSelectorCompact({
  value,
  onChange,
  filterByRole = null,
  disabled = false,
  error = null,
  placeholder = 'Seleccionar área...'
}) {
  const { areas, isLoading } = useAreaHierarchy({ filterByRole });
  const selectedArea = areas.find(a => a.id === value);

  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value || null)}
        disabled={disabled || isLoading}
        className={`
          w-full rounded-lg border px-3 py-2 text-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30
          ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'bg-white'}
          ${error ? 'border-red-300' : 'border-slate-200'}
        `}
      >
        <option value="">{isLoading ? 'Cargando...' : placeholder}</option>
        {areas.map(area => (
          <option key={area.id} value={area.id}>
            {area.clave ? `[${area.clave}] ` : ''}{area.nombre} (Nivel {area.nivel})
          </option>
        ))}
      </select>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      
      {selectedArea?.descripcion && (
        <p className="mt-1 text-xs text-slate-500">{selectedArea.descripcion}</p>
      )}
    </div>
  );
}

/**
 * Selector de áreas con permisos para asignación
 */
export function AreaSelectorWithPermissions({
  value,
  onChange,
  userRole,
  permissions = { puede_capturar: false, puede_editar: false, puede_eliminar: false },
  onPermissionsChange,
  disabled = false,
  error = null
}) {
  const [localPermissions, setLocalPermissions] = useState(permissions);

  const handlePermissionChange = (key, checked) => {
    const updated = { ...localPermissions, [key]: checked };
    setLocalPermissions(updated);
    onPermissionsChange?.(updated);
  };

  return (
    <div className="space-y-4">
      {/* Selector de área */}
      <AreaSelector
        value={value}
        onChange={onChange}
        filterByRole={userRole}
        disabled={disabled}
        error={error}
        placeholder="Seleccionar área para asignar..."
      />

      {/* Permisos */}
      {value && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Permisos en esta área:</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={localPermissions.puede_capturar}
                onChange={(e) => handlePermissionChange('puede_capturar', e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-aifa-blue focus:ring-aifa-blue"
              />
              <span className="text-slate-700">Puede capturar indicadores</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={localPermissions.puede_editar}
                onChange={(e) => handlePermissionChange('puede_editar', e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-aifa-blue focus:ring-aifa-blue"
              />
              <span className="text-slate-700">Puede editar indicadores</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={localPermissions.puede_eliminar}
                onChange={(e) => handlePermissionChange('puede_eliminar', e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-aifa-blue focus:ring-aifa-blue"
              />
              <span className="text-slate-700">Puede eliminar indicadores</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
