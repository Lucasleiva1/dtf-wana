# Deploy y distribución

La aplicación usa Tauri 2, genera instalador NSIS para Windows y artefactos del actualizador. `src-tauri/tauri.conf.json` define versión 0.4.2, ventana 1280 × 800 y mínimo 560 × 480.

## Build local

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm tauri build
```

## Publicación

`.github/workflows/release.yml` ejecuta un workflow manual en Windows, instala Node 22 y Rust estable, construye con `tauri-apps/tauri-action` y publica instalador y `latest.json`. Requiere secretos de firma del actualizador.

Consultar `RELEASING.md` para la operación completa. Antes de publicar, sincronizar las tres versiones y actualizar `CHANGELOG.md`. `VERSION_ESTABLE.md` está desactualizado respecto de 0.4.2.
