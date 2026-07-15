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

## Etapa 4 — Quitar fondo manual

- Máscaras compartidas, pincel/borrador conservar/eliminar.
- Varita CIELAB/Delta E, flood fill 4/8, tolerancia, contigüidad y protección de borde.
- Partículas, agujeros, contracción/expansión, halos e historial.

**Salida:** fixtures de fondos/halos/pelo/líneas finas y exportación pasan.

## Etapa 5 — Quitar fondo IA

- BiRefNet Lite ONNX, CPU y DirectML si corresponde.
- Preflight, progreso, cancelación y refinamiento clásico posterior.

**Salida:** funciona desconectado tras descargar el modelo y nunca congela la UI.

## Etapa 6 — Separar elementos

- Worker Python empaquetable y SAM 2.1 Tiny primero.
- Automatic Mask Generator, deduplicación, jerarquía, fondo probable y capas.
- Transformaciones no destructivas y exportación individual.
- Modelos Small/Base+/Large sólo después, con advertencias y límites.

**Salida:** regiones independientes editables/exportables; memoria insuficiente y cancelación probadas.

## Etapa 7 — Formatos avanzados y proyecto

- PSD fusionado/una capa, diálogo de advertencia multicapa.
- SVG rasterizado a tamaño/PPP elegidos.
- `.dtfproject`, autoguardado y recuperación.

## Etapa 8 — MCP, CI, updater e instalador

- Adaptador MCP sobre el command bus existente: STDIO predeterminado y HTTP local opcional sólo en `127.0.0.1`.
- Catálogo generado desde definiciones reales, recursos/prompts versionados, jobs, revisiones, idempotencia, auditoría y permisos.
- Perfiles: lectura, asistencia supervisada predeterminada y control avanzado granular/revocable.
- IPC autenticado por Named Pipe entre el proceso MCP y la app; ninguna herramienta genérica de shell o filesystem.
- GitHub Actions, releases borrador, hashes, updater firmado.
- NSIS sólo después de la revisión en ventana de desarrollo.
