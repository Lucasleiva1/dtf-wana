# Pruebas

## Comandos

```powershell
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

No existe un comando `lint` configurado.

## Resultado de la auditoría 2026-07-16

- TypeScript `tsc -b`: correcto.
- Vitest: 6 archivos, 13 pruebas aprobadas.
- Rust: 32 pruebas aprobadas, 0 fallidas y 1 ignorada.
- Vite producción: correcto, 2.521 módulos transformados.
- Prueba ignorada: `real_fixture_edge_polish_stays_binary`; requiere `DTF_POLISH_FIXTURE` con una imagen real.
- Lint: no ejecutado porque el repositorio no define script ni configuración de lint.

## Cobertura automatizada relevante

- TypeScript: normalización de umbral 8/16 bits, rutas de lote, formatos aceptados, cámara, estado de overlay e inspector.
- Rust alfa: todos los valores de 8 bits, valores críticos de 16 bits, regiones, protecciones, reconstrucción y cancelación.
- Rust documento: decodificación real, conservación de origen, exportación por formato, profundidad, bloqueo de alfa parcial, residuos, pulido e historial.
- Rust residuos: clasificación, máscara manual e historial.
- Rust pulido: binariedad, métodos y protecciones.
- Infraestructura: revisión, gestor de trabajos, límite de estado, escaneo recursivo y no sobrescritura.

## Pruebas manuales recomendadas

1. PNG RGBA8 y RGBA16 con valores alfa 0, intermedios y máximo.
2. Detalle fino conectado, grunge y partículas aisladas.
3. Antes/después de residuos y pulido al máximo zoom.
4. Lote mixto con subcarpetas, nombres duplicados y un archivo corrupto.
5. Cancelación durante análisis, aplicación y exportación.
6. Reapertura externa de cada formato exportado.

[CAPTURA PENDIENTE: comparación al 100 % o más de un borde antes y después del pulido]
