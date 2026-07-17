# Instrucciones para agentes

## Alcance

DTF Pro Studio 0.4.2 es una aplicación React 19 + TypeScript + Tauri 2. El alcance documentado actualmente es Transparencias: alfa, residuos, pulido, lote y exportación.

## Leer antes de modificar

1. `docs/ai/APP_CONTEXT.md`
2. `docs/ai/PROCESSING_CONTRACTS.md`
3. `docs/07-MAPA-DEL-CODIGO.md`
4. `src/types/alpha.ts`, `src/types/residue.ts`, `src/types/batch.ts`
5. El componente y motor Rust afectados.

## Invariantes

- No alterar `source_bytes` ni `original`; los cambios van sobre `working`.
- Toda mutación debe respetar `expectedRevision` y volver a analizar.
- Pulido sólo acepta alfa binario: 0/máximo, sin valores intermedios.
- Exportar con alfa sólido debe bloquear semitransparencias y reabrir el resultado.
- En lote, procesar secuencialmente; retirar sólo los éxitos y conservar los errores.
- No sobrescribir salidas del lote: usar sufijo disponible.
- No afirmar que existe MCP: hoy sólo existe Tauri IPC y un bus interno parcial.
- No modificar algoritmos ni interfaz al actualizar documentación.

## Zonas sensibles

- `src-tauri/src/alpha_engine/mod.rs`
- `src-tauri/src/residue_engine/mod.rs`
- `src-tauri/src/edge_polish_engine/mod.rs`
- `src-tauri/src/image_engine/document.rs`
- `src/components/BatchPanel.tsx`
- `src/components/Inspector.tsx`

## Validación

```powershell
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

No hay script `lint`. Si cambian controles, valores, formatos, errores, pipeline, rutas o contratos, actualizar la sección correspondiente en `docs/`, `docs/ai/APP_SPEC.yaml`, tutoriales afectados y `CHANGELOG.md`. Los enlaces se resuelven desde el archivo Markdown que los contiene.

