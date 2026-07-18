# Estado y datos

## Documento en memoria

`ImageDocument` conserva:

- `source_bytes`: bytes importados, inmutables.
- `original`: RGBA inicial para comparación.
- `working`: RGBA sobre el que se aplican cambios.
- `revision`: entero monotónico; aumenta en cada mutación y deshacer/rehacer.
- `analysis`: resultado asociado a la revisión actual o `None`.
- `history` / `future`: deltas de píxeles.
- `residue_mask`: selección automática y manual.

## Estado de interfaz

Zustand guarda el documento visible, su mesa, elemento colocado, guías, análisis, trabajo activo, flujo, preview, cámara, máscara, revisión visual, dispositivo de render preferido y backend de render activo. Cambiar el documento reinicia estados derivados para evitar usar análisis de otra revisión.

## Persistencia

Se persisten en `localStorage` el orden/colapso de zonas del inspector (`dtf-pro-studio.inspector-layout.v1`), el dispositivo de render (`dtf-pro-studio.render-device.v1`) y las preferencias de reglas, guías, bloqueo, imán y guías inteligentes (`dtf.view.*`). La preferencia de render admite `gpu` o `cpu` y usa GPU ante un valor ausente o inválido. No se persisten imágenes, historial, cola, carpetas ni configuración de lote.

La mesa conserva ancho/alto enteros en píxeles, PPP y unidad preferida. El elemento colocado conserva además los PPP de origen. Su tamaño natural dentro de la mesa se calcula como `píxeles de origen × PPP de mesa ÷ PPP de origen`, preservando exactamente los centímetros y sin ajustarlo al artboard. X/Y/ancho/alto se expresan internamente en píxeles flotantes para evitar pérdida acumulada; la interfaz convierte a la unidad elegida. Cambiar PPP sin remuestrear sólo cambia la interpretación física, nunca `source_bytes`, `original` ni `working`. Quitar una imagen deja un documento vacío con la misma mesa y guías.

## Revisiones y consistencia

Las mutaciones reciben `expectedRevision`. Si el documento cambió, el backend devuelve `DOCUMENT_REVISION_CONFLICT`. Una IA debe volver a leer o analizar el documento y no repetir ciegamente la escritura.

## Trabajos

Estados: `queued`, `running`, `completed`, `cancelled`, `failed`. Los registros finalizados se retienen hasta cinco minutos y el gestor limita el mapa aproximadamente a 48 entradas. Las vistas previas binarias se consumen una vez mediante `get_job_binary`.
