# Funcionalidades confirmadas

| Área | Comportamiento | Implementación principal |
|---|---|---|
| Importación | Archivo individual, reemplazo, arrastre y lectura segura | `src/app/importImage.ts`, `commands/document.rs` |
| Canvas | Zoom, ajuste, paneo, modos de previsualización y selector GPU/WebGL o CPU/Canvas 2D | `src/canvas/CanvasWorkspace.tsx`, `src/components/UpdatePanel.tsx`, `src/canvas/camera.ts` |
| Documentos físicos | Nuevo documento en seis unidades, preajustes, PPP, perfil, fondo y estimación de memoria | `src/components/NewDocumentDialog.tsx`, `src/app/createDocument.ts`, `src/lib/measurements.ts` |
| Mesa y precisión | Artboard independiente, selección y escala proporcional con ocho tiradores, reglas de origen central, guías manuales e inteligentes | `src/canvas/CanvasWorkspace.tsx`, `src/canvas/PrecisionOverlay.tsx`, `src/components/CanvasControls.tsx` |
| Propiedades | Zona contextual de imagen seleccionada y diálogo general de tamaño, color, contenido, guías y exportación | `src/components/Inspector.tsx`, `src/components/DocumentPropertiesDialog.tsx` |
| Análisis alfa | Histograma exacto, regiones de 8 vecinos, recomendación y verificación | `alpha_engine/mod.rs` |
| Tratamiento | Umbral, hacer transparente/opaco, protecciones y reconstrucción | `alpha_engine/mod.rs` |
| Residuos | Clasificación automática y máscara manual editable | `residue_engine/mod.rs`, `ResidueCleanup.tsx` |
| Pulido | Suavizado binario, mayoría o redondeo de picos | `edge_polish_engine/mod.rs`, `EdgePolish.tsx` |
| Historial | Deshacer/rehacer por deltas de píxeles | `image_engine/document.rs`, `historyService.ts` |
| Lote | Escaneo recursivo, cola visual, etapas opcionales y proceso secuencial | `BatchPanel.tsx`, `batchService.ts` |
| Exportación | Validar, codificar, escribir, reabrir y verificar | `image_engine/document.rs`, `jobs.rs` |
| Trabajos | Progreso, cancelación, resultado JSON o binario | `application/jobs.rs`, `jobService.ts` |

## No confirmado o no disponible

- MCP externo: planificado, no implementado.
- Pausa/reanudación: no existe; sólo detención/cancelación.
- Persistencia de la cola y configuración de lote tras reiniciar: no existe.
- Exportación individual a formatos distintos de PNG: no aparece en la interfaz auditada.
- Procesamiento en workers web: no se usa; el trabajo pesado se ejecuta en tareas bloqueantes de Tauri/Rust.
- Cómputo GPU para alfa, residuos, pulido o exportación: no existe; el selector GPU/CPU corresponde al renderizado visual.
