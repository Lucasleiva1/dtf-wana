# Mapa del código

| Ruta | Responsabilidad en Transparencias |
|---|---|
| `src/app/App.tsx` | Modo normal/lote y composición general |
| `src/app/importImage.ts` | Validación de archivo, carga y reemplazo |
| `src/components/Inspector.tsx` | Análisis y tratamiento alfa individual |
| `src/components/ResidueCleanup.tsx` | Controles de residuos y máscara manual |
| `src/components/EdgePolish.tsx` | Controles y comparación de pulido |
| `src/components/BatchPanel.tsx` | Configuración, cola y orquestación secuencial |
| `src/components/TopBar.tsx` | Apertura, modo lote y exportación individual |
| `src/stores/studioStore.ts` | Documento, revisión, análisis, trabajo y vistas |
| `src/lib/alphaService.ts` | IPC alfa, previews y exportación |
| `src/lib/residueService.ts` | IPC de máscara y limpieza |
| `src/lib/jobService.ts` | Inicio, sondeo y cancelación de trabajos |
| `src/lib/batchService.ts` | Predeterminados, umbral y ruta de salida |
| `src/types/*.ts` | Contratos TypeScript |
| `src-tauri/src/alpha_engine/mod.rs` | Histograma, regiones, recomendación y tratamiento |
| `src-tauri/src/residue_engine/mod.rs` | Clasificación y edición de máscara |
| `src-tauri/src/edge_polish_engine/mod.rs` | Máscara binaria, pulido y reconstrucción |
| `src-tauri/src/image_engine/document.rs` | Documento, historial, aplicación y exportación |
| `src-tauri/src/commands/jobs.rs` | Trabajos de procesamiento y exportación |
| `src-tauri/src/commands/document.rs` | Importación por ruta, carpetas y miniaturas |
| `src-tauri/src/application/jobs.rs` | Estado, progreso y cancelación |
| `src-tauri/src/application/command_bus.rs` | Protocolo interno parcial para automatización |
| `src-tauri/capabilities/default.json` | Permisos Tauri declarados |

Para contratos función por función, consultar [PROCESSING_CONTRACTS.md](ai/PROCESSING_CONTRACTS.md).
