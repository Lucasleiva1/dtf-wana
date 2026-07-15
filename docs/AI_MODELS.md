# Modelos de IA

La IA no participa en la detección de semitransparencias.

## Quitar fondo

BiRefNet Lite en ONNX cuando sea viable. Orden de dispositivo: proveedor compatible con memoria suficiente → DirectML → CPU. El refinamiento de borde sigue siendo clásico y verificable.

## Separar elementos

SAM 2.1 en worker aislado: Tiny primero; Small, Base Plus y Large sólo después. Se carga un modelo, procesa, devuelve resultado, libera memoria y limpia caché.

`models-manifest.json` registrará id, versión, URL oficial, SHA-256, tamaño, licencia, versión mínima de app/worker y dispositivo recomendado. Los modelos viven en datos de aplicación y sobreviven actualizaciones.

