# Funcionalidades confirmadas

| Área | Comportamiento | Implementación principal |
|---|---|---|
| Importación | Archivo individual, reemplazo, arrastre y lectura segura | `src/app/importImage.ts`, `commands/document.rs` |
| Canvas | Zoom, ajuste, paneo y modos de previsualización | `src/components/StudioCanvas.tsx`, `src/canvas/camera.ts` |
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

