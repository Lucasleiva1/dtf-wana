# Instrucciones para agentes

## Alcance

DTF Pro Studio 0.4.5 es una aplicación React 19 + TypeScript + Tauri 2. El alcance documentado actualmente incluye Transparencias y Quitar fondo con IA local.

## Entorno de desarrollo de un clic

- Leer `DESARROLLO-UN-CLIC.md` antes de intentar abrir la aplicación.
- El usuario inicia Vite + Tauri con el acceso directo **DTF Pro Studio - Desarrollo**.
- Los agentes deben modificar, guardar y validar el proyecto, pero no abrir la GUI desde el escritorio aislado de Codex.
- El lanzador versionado es `scripts/start-dev.ps1`; `scripts/install-dev-shortcut.ps1` recrea el `.lnk`.
- La recarga de desarrollo usa `http://127.0.0.1:1420`.

## Referencia de interacción

- Photoshop e Illustrator son la referencia principal para herramientas, barras contextuales, cursores y atajos de edición.
- Las opciones esenciales de la herramienta activa deben aparecer en la franja superior sin retirar sus controles completos del inspector.
- Los gestos nuevos deben conservar las funciones existentes o documentar explícitamente el reemplazo.

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

## Publicación estable

Cuando el usuario pida un guardado para actualizar la aplicación instalable,
leer `RELEASING.md` y usar `scripts/publish-stable-release.ps1`. La clave y su
contraseña ya existen fuera del repositorio en AppData; no buscarlas de nuevo,
no imprimirlas y no reproducir manualmente el flujo si el script puede hacerlo.
