# Contratos de procesamiento

Los nombres JSON usan camelCase por serialización Tauri. Esta página documenta contratos internos comprobados; no son herramientas MCP disponibles.

## Documento e importación

### `upload_document_bytes`

- Entrada: cuerpo binario y cabecera `x-dtf-document-id`, 1..128 caracteres.
- Salida: `{ documentId, format, width, height, bitDepth, revision, sourceByteLength }`.
- Efecto: inserta `ImageDocument` en memoria; revisión inicial 0.
- Error: falta de identificador, cuerpo no binario o decodificación fallida.

### `scan_image_folder(path)`

- Entrada: ruta de carpeta.
- Salida ordenada: `{ path, name, parentPath, relativePath, sizeBytes }[]`.
- Reglas: recursiva; máximo 25.000; omite mayores a 512 MB y extensiones no admitidas.

## Análisis alfa

### `start_alpha_analysis_job(documentId)`

- Salida inmediata: `{ jobId }`.
- Resultado del job: `AlphaAnalysis` esquema 1.0.
- Campos críticos: `revision`, `bitDepth`, `maxAlpha`, recuentos, `regions`, `recommendation`, `verifiedSolidAlpha`.
- No muta píxeles.

## Preview y aplicación alfa

### `start_alpha_preview_job(documentId, treatment, expectedRevision)`

- Entrada `treatment`: acción `threshold`, `make_transparent` o `make_opaque` según `AlphaTreatment`.
- Resultado JSON: `TreatmentImpact`; resultado binario separado: RGBA8 de preview.
- No muta.

### `start_alpha_treatment_job(documentId, treatment, expectedRevision)`

- Resultado: `{ revision, impact, analysis }`.
- Mutación: cambia `working`, incrementa revisión, agrega historial, borra redo.
- Postcondición: si `pendingPixels == 0`, `analysis.verifiedSolidAlpha` debe ser verdadero.

Tratamiento `threshold`:

```json
{
  "action": "threshold",
  "threshold": 128,
  "reconstructRadius": 2,
  "reconstructionMode": "automatic",
  "protections": {
    "protectConnectedTexture": true,
    "protectFineLines": true,
    "protectGrunge": true,
    "onlyIsolatedParticles": false,
    "preservedRegionIds": []
  }
}
```

El umbral está en unidades reales de alfa, no porcentaje. El lote convierte porcentaje según `maxAlpha`.

## Residuos

### `start_residue_cleanup_job(documentId, options, expectedRevision)`

- Genera/actualiza máscara automática; no modifica píxeles.
- Resultado: `MaskSummary` con píxeles/regiones seleccionados y undo/redo.

### `edit_residue_mask(documentId, edit)`

- Acciones: `component`, `rectangle`, `lasso`, `brush`, `clear`, `select_all`, `invert`, `undo`, `redo`.
- Resultado: resumen y `dirtyRect` opcional.
- Sólo selecciona alfa no cero.

### `start_apply_residue_job(documentId, expectedRevision)`

- Precondición: máscara no vacía.
- Mutación: alfa 0 en seleccionados, nueva revisión, historial y reanálisis.
- Resultado: `{ revision, removedPixels, removedRegions, analysis }`.

## Pulido

### `start_edge_polish_preview_job(documentId, options, expectedRevision)`

- Precondición efectiva: alfa binario.
- No muta; devuelve `EdgePolishImpact` y preview binario.

### `start_edge_polish_apply_job(documentId, options, expectedRevision)`

- Precondición: análisis técnicamente sólido.
- Opciones: `intensity`, radio 1..3, `method`, dos protecciones.
- Resultado: `{ revision, impact, analysis }`.
- Postcondición: `analysis.verifiedSolidAlpha == true`.

## Trabajos

### `get_job_status(jobId)`

- Estados: `queued`, `running`, `completed`, `cancelled`, `failed`.
- Campos: operación, etapa, índice, porcentaje, unidades, tiempo, memoria, cancelable, resultado/error.
- Sondeo de la UI: 90 ms.

### `cancel_job(jobId)`

Marca la bandera de cancelación. La etapa debe observarla. Un job cancelado no contiene error de contenido.

## Exportación

### `start_export_job(documentId, path, format, dpi, requireSolidAlpha, avoidOverwrite)`

- Formatos backend: `png`, `webp`, `tiff`, `bmp`.
- PPP se limita a 1..2400.
- Si `avoidOverwrite=true`, el backend elige una ruta libre.
- Resultado: `ExportVerification` con ruta, formato, dimensiones, profundidad, PPP, tamaño, alfa y `reopenedAndVerified`.
- Falla segura: elimina la salida si no puede verificarla.

## Bus interno v1

Envelope:

```json
{
  "protocolVersion": 1,
  "requestId": "uuid",
  "command": "alpha.analyze",
  "payload": { "documentId": "id" },
  "expectedRevision": 0,
  "dryRun": false,
  "client": { "id": "agent", "name": "nombre", "transport": "stdio" }
}
```

El bus devuelve `{ protocolVersion, requestId, ok, data?, error? }`. Sólo `alpha.apply_treatment` interpreta `dryRun`; los metadatos de cliente no aplican todavía autorización efectiva. Esto debe corregirse antes de exponerlo fuera de Tauri.

