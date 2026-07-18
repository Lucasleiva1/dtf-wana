# Integración MCP

> **Diseño futuro, no implementación disponible.** A 0.4.2 no existen `dtf-pro-mcp.exe`, transportes MCP, recursos `dtf://` ni el directorio `src-tauri/src/mcp`. Para el estado comprobado consultar [APP_CONTEXT.md](ai/APP_CONTEXT.md) y [PROCESSING_CONTRACTS.md](ai/PROCESSING_CONTRACTS.md).

## Objetivo

DTF Pro Studio será operable por cualquier cliente compatible con Model Context Protocol sin automatización visual. La aplicación funciona completa sin IA y no incluye chat en la primera versión.

```text
React ──Tauri IPC──┐
                  ├─ Application Command Bus ─ servicios ─ motores
MCP ──adaptador────┘
```

La UI humana, un futuro asistente interno y MCP atraviesan validación, permisos, concurrencia, historial, auditoría, cancelación y confirmaciones comunes.

## Transportes

- **STDIO:** predeterminado mediante `dtf-pro-mcp.exe` o modo separado. `stdout` contiene exclusivamente mensajes MCP; logs van a `stderr`/registro.
- **Streamable HTTP local:** opcional, desactivado, sólo `127.0.0.1`, puerto configurable/dinámico, token de sesión, validación Origin, límites y revocación.
- **Remoto:** arquitectura preparada, no activada. Nunca se abre un puerto público automáticamente.

El proceso MCP separado se enlaza a la app mediante Named Pipe autenticado, token efímero y ACL del usuario actual. Si la app no está abierta devuelve `APP_NOT_RUNNING`.

## Recursos estables

El catálogo incluirá recursos estructurados/versionados `dtf://app/*`, `dtf://system/capabilities`, `dtf://document/current/*`, `dtf://jobs/active`, `dtf://models/installed` y `dtf://settings/export`. No se exponen rutas originales completas sin permiso.

## Clases de herramientas

- Información: lectura de aplicación, sistema, documento, alfa, elementos, modelos, jobs, historial y export settings.
- Vista: módulo, fondo de preview, zoom, fit, foco, overlays y pixel grid; nunca ensucian el proyecto.
- Análisis: alfa, fondo, máscara, elementos, bordes, requisitos y validación de exportación. Lo largo retorna `jobId`.
- Modificación: alfa, regiones, bordes, máscaras, elementos, restauración, undo/redo.
- Archivos/proyectos: abrir, guardar, exportar y cancelar dentro de rutas autorizadas.
- Modelos: listar, comprobar, instalar, seleccionar, verificar y eliminar con autorización.

No existen herramientas genéricas para shell ni para leer/escribir cualquier archivo.

## Contrato de escritura

```json
{
  "documentId": "doc_01",
  "expectedRevision": 18,
  "requestId": "req_unique_01",
  "dryRun": true
}
```

- `expectedRevision` evita escribir sobre un estado obsoleto.
- `requestId` vuelve idempotentes reintentos.
- `dryRun` informa impacto y necesidad de confirmación sin cambiar estado.
- Sólo una escritura por documento; lecturas y cancelación siguen disponibles.

## Permisos

Perfiles: sólo lectura, asistencia supervisada (predeterminado) y control avanzado granular/revocable. Scopes mínimos: `app.read`, `system.read`, `document.read`, `view.control`, `document.analyze`, `document.modify`, `elements.modify`, `project.open`, `project.write`, `export.write`, `models.read`, `models.manage`, `updates.read`, `updates.install`.

Las confirmaciones sensibles se muestran dentro de DTF Pro Studio con cliente, acción, documento, impacto y alcance temporal. Un texto enviado por el agente nunca cuenta como autorización.

## Entregables finales

- `src-tauri/src/application/*` y `src-tauri/src/mcp/*`.
- UI `src/features/ai-integration/*`.
- Manifests y JSON Schemas generados desde definiciones reales.
- Guías de seguridad, operación, clientes, catálogo y versionado.
- Pruebas de descubrimiento, permisos, revisión, concurrencia, jobs, seguridad, auditoría y clientes compatibles.
