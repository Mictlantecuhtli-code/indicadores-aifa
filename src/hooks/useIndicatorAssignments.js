import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  INDICATOR_SECTIONS,
  buildIndicatorOptions,
  normalizeText
} from '../config/dashboardConfig.js';
import { getIndicators } from '../lib/supabaseClient.js';

export function useIndicatorAssignments() {
  const indicatorsQuery = useQuery({ queryKey: ['indicators'], queryFn: getIndicators });

  const indicatorsIndex = useMemo(() => {
    return (indicatorsQuery.data ?? []).map(record => ({
      record,
      normalizedName: normalizeText(record.nombre),
      normalizedDescription: normalizeText(record.descripcion),
      normalizedArea: normalizeText(record.area_nombre ?? record.area)
    }));
  }, [indicatorsQuery.data]);

  const sections = useMemo(() => {
    return INDICATOR_SECTIONS.map(section => ({
      ...section,
      categories: section.categories.map(category => {
        const options = buildIndicatorOptions(category).map(option => {
          const normalizedOption = normalizeText(option.label);
          const indicatorMatch = indicatorsIndex.find(entry => {
            if (!entry.normalizedName && !entry.normalizedDescription) return false;
            const haystacks = [entry.normalizedName, entry.normalizedDescription].filter(Boolean);
            const sectionName = normalizeText(category.label);
            const areaName = entry.normalizedArea;
            const optionWords = normalizedOption.split(' ').filter(Boolean);
            return haystacks.some(text => {
              if (text.includes(normalizedOption)) return true;
              const containsAllWords = optionWords.every(part => text.includes(part));
              if (containsAllWords && sectionName && text.includes(sectionName)) {
                return true;
              }
              if (containsAllWords && areaName && text.includes(areaName)) {
                return true;
              }
              return false;
            });
          });

          const indicator = indicatorMatch?.record ?? null;

          return {
            ...option,
            templateLabel: option.label,
            label: indicator?.nombre ?? option.label,
            subtitle: indicator?.descripcion ?? option.label,
            indicator
          };
        });

        const assignedOptions = options.filter(item => item.indicator);

        if (!assignedOptions.length) {
          return null;
        }

        return {
          ...category,
          options: assignedOptions
        };
      })
        .filter(Boolean)
    }))
      .filter(section => section.categories.length);
  }, [indicatorsIndex]);

  const optionIndex = useMemo(() => {
    const map = new Map();
    sections.forEach(section => {
      section.categories.forEach(category => {
        category.options.forEach(option => {
          map.set(option.id, {
            section,
            category,
            option
          });
        });
      });
    });
    return map;
  }, [sections]);

  return {
    sections,
    optionIndex,
    indicatorsQuery
  };
}
