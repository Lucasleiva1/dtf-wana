# Plan maestro de implementación

Cada etapa termina con tests verdes, documentación y commit. No se inicia la siguiente si la puerta de salida falla.

## Etapa 0 — Fundaciones

- Estructura Tauri 2 + React + TypeScript + Vite.
- Scripts de prerrequisitos y desarrollo.
- Contratos de comando, errores tipados y logging local sin datos sensibles.
- CI básico preparado, sin instalador ni updater todavía.

**Salida:** ventana nativa abre, hot reload funciona y frontend/Rust compilan.

## Etapa 1 — Base común

- Interfaz profesional compacta, tres módulos separados y tema oscuro cálido.
- Layout responsive para resoluciones y alturas bajas.
- Documento/artboard/cámara separados; workspace infinito.
- Importación inicial PNG/JPG/WebP/TIFF/BMP.
- Zoom 2–6400 %, paneo libre, fit artboard/content, 100 %, fondos de revisión y transformación no destructiva.
- Estado, historial base, proyecto y export settings modelados.

**Salida:** una imagen real se abre sin modificar el original, se inspecciona en una ventana Tauri y la cámara se restaura.

## Etapa 2 — Transparencias (bloqueante)

- Lectura exacta 8/16 bits sin degradar profundidad.
- Conteos, extremos, porcentaje, histograma y componentes conectados.
- Overlay magenta, rangos, navegación anterior/siguiente y zoom a región.
- Conversión transparente/opaca/umbral/por rangos.
- Limpieza controlada y reconstrucción de color interior con preservación de líneas finas.
- Verificación técnica y checklist visual independientes.

**Salida:** tests exhaustivos verdes; no se avanza con diferencias de conteo, histogramas o bordes.

## Etapa 3 — Exportación verificada

- PNG RGBA 8/16 bits desde buffer original.
- sRGB, dimensiones y PPP; nunca desde canvas.
- Modo “exigir cero semitransparencias”.
- Reapertura del archivo exportado y segunda lectura completa del alfa.

**Salida:** sólo se informa éxito tras verificar archivo, tamaño, profundidad y alfa binario.

## Alcance consolidado de la versión 0.4.2

- Análisis y tratamiento de alfa de 8 y 16 bits.
- Limpieza automática y manual de residuos.
- Pulido de contorno sobre alfa binario.
- Procesamiento secuencial por lote, conservando los errores en la cola.
- Exportación sin sobrescritura, con reapertura y verificación.
- Documentación operativa y contratos internos sincronizados con la implementación.

Este documento termina en el alcance consolidado. Cualquier módulo adicional requiere una nueva decisión de producto, contratos propios y un plan separado.
