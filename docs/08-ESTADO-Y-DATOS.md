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

Zustand guarda el documento visible, análisis, trabajo activo, flujo, preview, cámara, máscara y revisión visual. Cambiar el documento reinicia estados derivados para evitar usar análisis de otra revisión.

## Persistencia

Sólo el orden y colapso de zonas del inspector se persisten en `localStorage` con la clave `dtf-pro-studio.inspector-layout.v1`. No se persisten imágenes, historial, cola, carpetas ni configuración de lote.

## Revisiones y consistencia

Las mutaciones reciben `expectedRevision`. Si el documento cambió, el backend devuelve `DOCUMENT_REVISION_CONFLICT`. Una IA debe volver a leer o analizar el documento y no repetir ciegamente la escritura.

## Trabajos

Estados: `queued`, `running`, `completed`, `cancelled`, `failed`. Los registros finalizados se retienen hasta cinco minutos y el gestor limita el mapa aproximadamente a 48 entradas. Las vistas previas binarias se consumen una vez mediante `get_job_binary`.
