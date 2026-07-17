# Exportar resultados

## Individual

La interfaz individual ofrece PNG. Antes de habilitar **Exportar** deben existir análisis, alfa binario y revisión visual. El archivo conserva 8 o 16 bits, incluye PPP y se reabre para comprobar dimensiones, profundidad y alfa.

## Lote

- PNG: 8/16 bits y PPP explícito.
- WebP sin pérdida: 8 bits.
- TIFF: 8/16 bits.
- BMP: 8 bits.

El nombre base termina en `_dtf`. Si ya existe, la aplicación crea otro nombre y no sobrescribe. Sin carpeta de salida, usa la carpeta del original. Con una carpeta común, no replica subcarpetas.

Una exportación sólo se considera correcta si el resultado informa `reopenedAndVerified=true`.

[CAPTURA PENDIENTE: selector de formato/PPP del lote y diálogo Guardar PNG individual]

