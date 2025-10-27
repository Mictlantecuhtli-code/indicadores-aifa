# Componentes SMS Eliminados

**Fecha:** 2025-10-27
**Motivo:** Reconstrucción con cambios significativos

---

## Componentes Eliminados

### De `src/components/indicadores/`:

1. **SMSCapturaFaunaCard.jsx**
   - Indicador: SMS-01, SMS-02
   - Función: Mostrar capturas de fauna
   - Estado: Eliminado, pendiente reconstrucción

2. **SMSComparativoPCI.jsx**
   - Indicador: SMS-05A, SMS-05B
   - Función: Comparativo PCI entre pistas
   - Estado: Eliminado, pendiente reconstrucción

3. **SMSIluminacionModal.jsx**
   - Indicador: SMS-03, SMS-03A, SMS-03B, SMS-04
   - Función: Sistema de iluminación
   - Estado: Eliminado, pendiente reconstrucción

4. **SMSIndicatorCard.jsx**
   - Función: Tarjeta genérica para indicadores SMS
   - Estado: Eliminado, pendiente reconstrucción

---

## Componentes Mantenidos

### En `src/components/indicadores/`:

- ✅ IndicadorDetalle.jsx (funcional)
- ✅ IndicadorHeader.jsx (funcional)
- ✅ AreaSelector.jsx (funcional)

---

## Estado Actual del Sistema

### ✅ Funcionando:
- Sistema base
- Indicadores no-SMS
- Navegación
- Panel de directivos (con mensajes temporales)

### ⚠️ Temporalmente Deshabilitado:
- Todos los componentes SMS listados arriba
- Usuarios ven mensaje: "En construcción"

---

## Próximos Pasos

1. Reconstruir SMS-01/02 (Capturas de Fauna)
2. Reconstruir SMS-03/04 (Iluminación)
3. Reconstruir SMS-05A/B (PCI)
4. Reconstruir SMS-06 (Mantenimientos)
5. Reconstruir SMS-07 (Disponibilidad)
6. Implementar SMS-08 (Capacitaciones)
7. Implementar SMS-09 (Supervisiones)

---

## Cambios Significativos Planeados

- [ ] Nuevo diseño UI/UX
- [ ] Gráficos mejorados (Recharts más avanzado)
- [ ] Filtros y búsqueda avanzada
- [ ] Comparativas entre periodos
- [ ] Drill-down en datos
- [ ] Export mejorado (PDF + Excel)
- [ ] Anotaciones y comentarios
- [ ] Alertas y notificaciones
- [ ] Performance optimizado
- [ ] Responsive mejorado
