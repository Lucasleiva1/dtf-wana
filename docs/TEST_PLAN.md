# Plan de pruebas

## Pirámide

- **Unitarias Rust:** clasificación, histogramas, componentes, rangos, umbrales, morfología, reconstrucción y metadatos PNG.
- **Propiedades:** conteos conservan `width × height`; binarizar es idempotente; ningún alfa intermedio sobrevive al modo sólido.
- **Golden images:** halos blanco/negro/cromático, premultiplicado, pelo, tipografía pequeña y línea de un píxel.
- **Integración:** importar → operar → exportar → reabrir → verificar.
- **UI:** comandos, historial, navegación de zonas, atajos y estados de trabajo.
- **Desktop/E2E:** Tauri en 640×600, 800×600, 1024×768, 1366×768, 1920×1080 y escalado de Windows.

## Fixtures obligatorios alfa

- 8 bits: los 256 valores; conteo e histograma exactos.
- 16 bits: 0, 1, 2, 32767, 32768, 65533, 65534, 65535 sin paso por 8 bits.
- Archivos opacos, transparentes, parcialmente transparentes y corruptos.

## Puerta Transparencias

1. Todas las pruebas unitarias y de propiedades verdes.
2. Exportación/reapertura confirma cero intermedios.
3. Golden images dentro de tolerancias documentadas.
4. Navegación visita todas las regiones una sola vez y restaura cámara.
5. Original bit a bit intacto.
6. Sin bloqueo perceptible de UI en fixture grande.

