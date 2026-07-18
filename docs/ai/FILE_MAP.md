# Mapa de archivos para IA

## Ruta de lectura mínima

1. `AGENTS.md`
2. `docs/ai/APP_CONTEXT.md`
3. `docs/ai/APP_SPEC.yaml`
4. Este mapa.
5. El contrato y fuente específica que se vaya a cambiar.

## Por intención

| Intención | Frontend | Backend | Tipos/pruebas |
|---|---|---|---|
| Abrir imagen | `app/importImage.ts`, `TopBar.tsx` | `commands/document.rs`, `image_engine/document.rs` | `importImage.test.ts` |
| Analizar alfa | `Inspector.tsx`, `alphaService.ts` | `alpha_engine/mod.rs`, `commands/jobs.rs` | tests del motor alfa/documento |
| Cambiar umbral/protecciones | `Inspector.tsx` | `AlphaTreatment`, `plan_treatment_with_progress` | `types/alpha.ts` |
| Limpiar residuos | `ResidueCleanup.tsx`, `residueService.ts` | `residue_engine/mod.rs`, `commands/residue.rs` | tests de residuos |
| Pulir borde | `EdgePolish.tsx` | `edge_polish_engine/mod.rs` | tests de pulido |
| Procesar lote | `BatchPanel.tsx`, `batchService.ts` | comandos de documento/jobs existentes | `batchService.test.ts` |
| Exportar | `TopBar.tsx`, `alphaService.ts` | `export_verified_as_with_progress`, `start_export_job` | tests de exportación |
| Elegir GPU/CPU | `UpdatePanel.tsx`, `CanvasWorkspace.tsx`, `StatusBar.tsx` | No aplica; selección del renderizador Pixi | `renderDevice.test.ts`, `types/document.ts` |
| Crear documento físico | `StartScreen.tsx`, `NewDocumentDialog.tsx`, `createDocument.ts` | No se crea documento Rust hasta colocar imagen | `measurements.test.ts` |
| Medir y alinear | `CanvasControls.tsx`, `PrecisionOverlay.tsx`, `DocumentPropertiesDialog.tsx` | No aplica; transformaciones y guías de interfaz | `measurements.test.ts` |
| Trabajos/cancelación | `jobService.ts` | `application/jobs.rs` | test de cancelación |
| Revisiones | `studioStore.ts` | `application/revisions.rs` | tests de store/revisión |
| Automatización | `commandBus.ts` | `application/command_bus.rs`, `commands/dispatcher.rs` | test de protocolo |
| Distribuir | `package.json`, `tauri.conf.json` | `Cargo.toml` | `.github/workflows/release.yml` |

## Regla de fuente de verdad

Los valores funcionales provienen del código en ejecución; `APP_SPEC.yaml` debe reflejarlos. Si difieren, detener la automatización, registrar la contradicción y actualizar la documentación sólo después de decidir cuál comportamiento es intencional.
