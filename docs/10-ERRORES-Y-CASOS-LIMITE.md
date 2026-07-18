# Errores y casos límite

| Código o mensaje | Causa | Acción |
|---|---|---|
| `DOCUMENT_REVISION_CONFLICT` | Escritura sobre revisión antigua | Releer análisis/revisión y reintentar conscientemente |
| `ALPHA_ZERO_VERIFICATION_FAILED` | El tratamiento debía dejar alfa sólido y no lo hizo | No exportar; revisar pendientes y configuración |
| `RESIDUE_MASK_EMPTY` | Se intentó aplicar sin selección | Detectar o seleccionar residuos |
| `EDGE_POLISH_REQUIRES_BINARY_ALPHA` | Hay alfa intermedio | Ejecutar tratamiento alfa primero |
| `EDGE_POLISH_REQUIRES_TECHNICAL_VERIFICATION` | No se verificó alfa sólido | Analizar/aplicar tratamiento antes de pulir |
| `EDGE_POLISH_BINARY_VERIFICATION_FAILED` | El pulido produjo alfa intermedio | Conservar imagen anterior e informar defecto |
| `EXPORT_BLOCKED_PARTIAL_ALPHA` | Exportación sólida con semitransparencias | Resolver alfa y volver a exportar |
| `EXPORT_DIMENSIONS_MISMATCH` | La reapertura cambió dimensiones | La salida se elimina |
| `EXPORT_DEPTH_MISMATCH` | Profundidad inesperada | La salida se elimina |
| `JOB_CANCELLED` | Usuario detuvo el trabajo | Conservar pendientes; no tratar como error de imagen |

## Límites

- Archivo desde ruta: 512 MB.
- Carpeta: 25.000 imágenes; superar el límite aborta el escaneo.
- Radio alfa manual: motor 1..16; automático 1..4 según dimensión.
- Radio de pulido: 1..3.
- Pincel: 1..500.
- Historial de ediciones de máscara: 50 entradas.
- PPP: 1..2400.

## Casos operativos

- JPG no tiene alfa útil normalmente; su análisis puede resultar ya sólido.
- Desactivar alfa y activar pulido en una imagen semitransparente produce error de lote.
- Dos archivos con igual nombre exportados a una carpeta común no se pisan; reciben sufijos.
- Cancelar durante escritura intenta eliminar el archivo incompleto.
