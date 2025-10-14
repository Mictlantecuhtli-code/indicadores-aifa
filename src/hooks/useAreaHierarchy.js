import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAreaHierarchy } from '../lib/supabaseClient.js';
import {
  buildAreaTree,
  flattenAreaTree,
  findAreaInTree,
  getAreaDescendants,
  getAreaPath,
  formatAreaFullName,
  filterAreasByRole
} from '../lib/permissions.js';

/**
 * Hook para gestionar la jerarquía de áreas
 * Proporciona funciones para manipular y consultar el árbol de áreas
 */
export function useAreaHierarchy(options = {}) {
  const {
    filterByRole = null,
    filterByIds = null,
    initialSelectedId = null,
    enableSearch = true
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState(initialSelectedId);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Cargar todas las áreas
  const areasQuery = useQuery({
    queryKey: ['areas-hierarchy'],
    queryFn: getAreaHierarchy,
    staleTime: 10 * 60 * 1000 // 10 minutos
  });

  // Áreas planas (lista)
  const flatAreas = useMemo(() => {
    return areasQuery.data || [];
  }, [areasQuery.data]);

  // Filtrar áreas por rol si se especifica
  const filteredByRole = useMemo(() => {
    if (!filterByRole) return flatAreas;
    return filterAreasByRole(flatAreas, filterByRole);
  }, [flatAreas, filterByRole]);

  // Filtrar áreas por IDs si se especifica
  const filteredByIds = useMemo(() => {
    if (!filterByIds || !Array.isArray(filterByIds)) return filteredByRole;
    const idsSet = new Set(filterByIds);
    return filteredByRole.filter(area => idsSet.has(area.id));
  }, [filteredByRole, filterByIds]);

  // Construir árbol jerárquico
  const areaTree = useMemo(() => {
    return buildAreaTree(filteredByIds);
  }, [filteredByIds]);

  // Filtrar árbol por término de búsqueda
  const searchedTree = useMemo(() => {
    if (!enableSearch || !searchTerm.trim()) return areaTree;

    const term = searchTerm.toLowerCase().trim();
    const matchingAreas = filteredByIds.filter(area => {
      return (
        area.nombre?.toLowerCase().includes(term) ||
        area.clave?.toLowerCase().includes(term)
      );
    });

    if (matchingAreas.length === 0) return [];

    // Incluir también los ancestros de las áreas que coinciden
    const matchingIds = new Set(matchingAreas.map(a => a.id));
    const ancestorIds = new Set();

    matchingAreas.forEach(area => {
      // Usar el path para encontrar ancestros
      if (area.path) {
        const pathParts = area.path.split('.');
        pathParts.forEach(id => ancestorIds.add(id));
      }
    });

    const relevantAreas = filteredByIds.filter(area => 
      matchingIds.has(area.id) || ancestorIds.has(area.id)
    );

    return buildAreaTree(relevantAreas);
  }, [areaTree, searchTerm, enableSearch, filteredByIds]);

  // Área seleccionada actualmente
  const selectedArea = useMemo(() => {
    if (!selectedAreaId) return null;
    return findAreaInTree(areaTree, selectedAreaId);
  }, [areaTree, selectedAreaId]);

  // Ruta (breadcrumb) del área seleccionada
  const selectedAreaPath = useMemo(() => {
    if (!selectedAreaId) return [];
    return getAreaPath(areaTree, selectedAreaId);
  }, [areaTree, selectedAreaId]);

  // Nombre completo del área seleccionada
  const selectedAreaFullName = useMemo(() => {
    if (!selectedAreaId) return '';
    return formatAreaFullName(areaTree, selectedAreaId);
  }, [areaTree, selectedAreaId]);

  // Descendientes del área seleccionada
  const selectedAreaDescendants = useMemo(() => {
    if (!selectedAreaId) return [];
    return getAreaDescendants(areaTree, selectedAreaId);
  }, [areaTree, selectedAreaId]);

  /**
   * Busca un área por ID en las áreas planas
   */
  const getAreaById = useCallback((areaId) => {
    if (!areaId) return null;
    return flatAreas.find(area => area.id === areaId) || null;
  }, [flatAreas]);

  /**
   * Busca áreas por nivel
   */
  const getAreasByLevel = useCallback((level) => {
    return flatAreas.filter(area => area.nivel === level);
  }, [flatAreas]);

  /**
   * Obtiene todas las áreas raíz (nivel 1)
   */
  const getRootAreas = useCallback(() => {
    return getAreasByLevel(1);
  }, [getAreasByLevel]);

  /**
   * Obtiene los hijos directos de un área
   */
  const getAreaChildren = useCallback((areaId) => {
    if (!areaId) return [];
    return flatAreas.filter(area => area.parent_area_id === areaId);
  }, [flatAreas]);

  /**
   * Verifica si un área tiene hijos
   */
  const hasChildren = useCallback((areaId) => {
    if (!areaId) return false;
    return flatAreas.some(area => area.parent_area_id === areaId);
  }, [flatAreas]);

  /**
   * Expande o colapsa un nodo del árbol
   */
  const toggleExpanded = useCallback((areaId) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(areaId)) {
        newSet.delete(areaId);
      } else {
        newSet.add(areaId);
      }
      return newSet;
    });
  }, []);

  /**
   * Verifica si un nodo está expandido
   */
  const isExpanded = useCallback((areaId) => {
    return expandedIds.has(areaId);
  }, [expandedIds]);

  /**
   * Expande todos los nodos del árbol
   */
  const expandAll = useCallback(() => {
    const allIds = new Set(flatAreas.map(area => area.id));
    setExpandedIds(allIds);
  }, [flatAreas]);

  /**
   * Colapsa todos los nodos del árbol
   */
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /**
   * Expande la ruta hasta un área específica
   */
  const expandToArea = useCallback((areaId) => {
    const path = getAreaPath(areaTree, areaId);
    const idsToExpand = new Set(expandedIds);
    
    path.forEach(area => {
      idsToExpand.add(area.id);
    });
    
    setExpandedIds(idsToExpand);
  }, [areaTree, expandedIds]);

  /**
   * Selecciona un área y expande su ruta
   */
  const selectArea = useCallback((areaId) => {
    setSelectedAreaId(areaId);
    if (areaId) {
      expandToArea(areaId);
    }
  }, [expandToArea]);

  /**
   * Limpia la selección
   */
  const clearSelection = useCallback(() => {
    setSelectedAreaId(null);
  }, []);

  /**
   * Actualiza el término de búsqueda
   */
  const updateSearch = useCallback((term) => {
    setSearchTerm(term);
    // Si hay término de búsqueda, expandir todos los nodos
    if (term.trim()) {
      expandAll();
    }
  }, [expandAll]);

  /**
   * Limpia la búsqueda
   */
  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  /**
   * Obtiene un resumen de estadísticas
   */
  const stats = useMemo(() => {
    return {
      total: flatAreas.length,
      filtered: filteredByIds.length,
      roots: areaTree.length,
      selected: selectedAreaId ? 1 : 0,
      expanded: expandedIds.size
    };
  }, [flatAreas, filteredByIds, areaTree, selectedAreaId, expandedIds]);

  return {
    // Datos
    flatAreas,
    areaTree,
    searchedTree,
    filteredAreas: filteredByIds,

    // Área seleccionada
    selectedAreaId,
    selectedArea,
    selectedAreaPath,
    selectedAreaFullName,
    selectedAreaDescendants,

    // Búsqueda
    searchTerm,
    updateSearch,
    clearSearch,

    // Expansión
    expandedIds,
    isExpanded,
    toggleExpanded,
    expandAll,
    collapseAll,
    expandToArea,

    // Selección
    selectArea,
    clearSelection,

    // Consultas
    getAreaById,
    getAreasByLevel,
    getRootAreas,
    getAreaChildren,
    hasChildren,

    // Estadísticas
    stats,

    // Estados de carga
    isLoading: areasQuery.isLoading,
    isError: areasQuery.isError,
    error: areasQuery.error,
    refetch: areasQuery.refetch
  };
}

/**
 * Hook simplificado para solo obtener áreas sin funcionalidad de árbol
 */
export function useAreas(options = {}) {
  const { filterByRole = null } = options;

  const areasQuery = useQuery({
    queryKey: ['areas-flat'],
    queryFn: getAreaHierarchy,
    staleTime: 10 * 60 * 1000
  });

  const areas = useMemo(() => {
    const flatAreas = areasQuery.data || [];
    if (!filterByRole) return flatAreas;
    return filterAreasByRole(flatAreas, filterByRole);
  }, [areasQuery.data, filterByRole]);

  return {
    areas,
    isLoading: areasQuery.isLoading,
    isError: areasQuery.isError,
    error: areasQuery.error,
    refetch: areasQuery.refetch
  };
}
