# Registro de cambios

Este archivo registra cambios confirmados en el repositorio. Para publicar una versión también deben actualizarse `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.

## [0.4.2] - 2026-07-16

### Documentación

- Se documentó de forma modular el módulo Transparencias.
- Se añadieron manuales técnico, operativo, de usuario y para agentes de IA.
- Se registraron contratos de alfa, residuos, pulido, lote y exportación.
- Se aclaró que el bus interno de comandos no equivale a un servidor MCP disponible.
- Se corrigió documentalmente la matriz de exportación: el lote admite PNG, WebP sin pérdida, TIFF y BMP; la exportación individual visible admite PNG.

### Funcionalidad confirmada en 0.4.2

- Análisis exacto de alfa RGBA de 8 y 16 bits.
- Tratamiento por umbral con previsualización, protecciones y reconstrucción de color.
- Limpieza automática y manual de residuos con máscara reversible antes de aplicar.
- Pulido de contorno que exige alfa binario.
- Procesamiento secuencial por lote con cola visual y cancelación.
- Exportación con reapertura y verificación del archivo generado.

## Historial anterior

No existía un `CHANGELOG.md` verificable al iniciar esta auditoría. Consultar el historial Git y las publicaciones de GitHub para reconstruir versiones anteriores. `VERSION_ESTABLE.md` todavía menciona 0.3.1 y se conserva como registro histórico pendiente de conciliación.

