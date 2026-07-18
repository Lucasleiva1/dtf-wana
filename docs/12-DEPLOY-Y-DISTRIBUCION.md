# Deploy y distribución

La aplicación usa Tauri 2, genera instalador NSIS para Windows y artefactos del actualizador. `src-tauri/tauri.conf.json` define versión 0.4.5, ventana 1280 × 800 y mínimo 560 × 480.

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

El método preferido firma localmente con la clave privada conservada fuera del repositorio y publica sólo el instalador NSIS, su `.sig` y `latest.json`. `.github/workflows/release.yml` queda como alternativa manual en Windows mediante `tauri-apps/tauri-action`; requiere que los secretos del actualizador correspondan a la clave pública embebida.

Consultar `RELEASING.md` para la operación completa. Antes de publicar, sincronizar las versiones, actualizar `CHANGELOG.md` y comprobar los tres assets del updater. `VERSION_ESTABLE.md` registra el último punto de restauración publicado.
