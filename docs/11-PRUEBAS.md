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
- Vitest: 7 archivos, 16 pruebas aprobadas.
- Rust: 32 pruebas aprobadas, 0 fallidas y 1 ignorada.
- Vite producción: correcto, 2.521 módulos transformados.
- Prueba ignorada: `real_fixture_edge_polish_stays_binary`; requiere `DTF_POLISH_FIXTURE` con una imagen real.
- Lint: no ejecutado porque el repositorio no define script ni configuración de lint.

## Cobertura automatizada relevante

- TypeScript: normalización de umbral 8/16 bits, rutas de lote, formatos aceptados, cámara, estado de overlay, inspector, conversiones físicas, preajuste 38 cm = 4488 px, lectura PPP PNG/JPEG y persistencia segura del selector GPU/CPU.
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
7. Cambio GPU → CPU → GPU desde Ajustes, comprobando reinicialización del lienzo, persistencia y backend activo en la barra inferior.
8. Creación de 38 × 38 cm a 300 PPP y comprobación de 4488 × 4488 px sin bitmap blanco implícito.
9. Arrastre de imagen más allá de la mesa, edición exacta de X/Y/W/H y verificación de que el original no cambia.
10. Regla superior → guía horizontal; regla lateral → vertical; numeración continua con cero central y signos a ambos lados.
11. Eliminación de guías al devolverlas a la regla, con Supr/Retroceso y mediante menú contextual; bloqueo, ocultación e imán al cero.
12. Selección obligatoria para procesar; movimiento fuera de la mesa; ocho tiradores con proporción constante y Deshacer/Rehacer de transformaciones.
13. Indicadores inteligentes temporales, cortos y sólidos al alinear centro y bordes de la imagen con la mesa.
14. Colocación a tamaño físico de origen según PPP, sin encajar ni estirar al tamaño de la mesa.
15. Reemplazo de imagen conservando la mesa; quitar imagen conserva dimensiones, PPP y guías y permite abrir otra.
16. Arrastre sincronizado por cuadro de pantalla, sin procesar eventos de puntero redundantes, y magnetismo sutil de 5 px visibles.
17. Aviso de discrepancia entre PPP de origen y los 300 PPP de la mesa; conversión explícita sin cambiar la cantidad de píxeles.
18. Archivo sin metadatos PPP: no se declara tamaño físico real hasta que el usuario asigne 300 PPP.

[CAPTURA PENDIENTE: comparación al 100 % o más de un borde antes y después del pulido]
