# Soporte de formatos

> **Documento histórico anterior a 0.4.2.** Su tabla de exportación ya no representa toda la aplicación. La matriz auditada vigente está en [09-FORMATOS-Y-EXPORTACION.md](09-FORMATOS-Y-EXPORTACION.md): el modo lote exporta PNG, WebP sin pérdida, TIFF y BMP; la interfaz individual exporta PNG.

| Formato | Importación | Profundidad | Exportación v1 | Notas |
|---|---:|---:|---:|---|
| PNG | Sí | RGBA 8/16 | Sí | Formato DTF principal |
| JPG/JPEG | Sí | RGB 8 | No | Se agrega alfa interno opaco |
| WebP | Sí | RGB/RGBA | No | Se conserva original |
| TIFF | Sí | RGB/RGBA 8/16 según decoder | No | Validar variantes |
| BMP | Sí | RGB/RGBA | No | Validar orientación |
| PSD | Etapa 7 | RGB/RGBA fusionado | No | Sin edición de capas |
| SVG | Etapa 7 | Vector → raster | No | Diálogo de tamaño y 300 PPP |

La exportación nunca sobrescribe el original por defecto.
