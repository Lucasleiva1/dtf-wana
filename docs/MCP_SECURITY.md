# Seguridad MCP

## Denegar por defecto

- Servidor desactivable; HTTP desactivado y lectura/asistencia supervisada como base.
- Autenticación local, tokens rotables/expirables, sesiones revocables y rate limits.
- JSON Schema estricto, límites de tamaño/tiempo y protección contra replay por `requestId`.
- Allowlist de carpetas; sin shell ni filesystem arbitrario.
- Tokens truncados en logs, secretos fuera del repositorio y recursos temporales con expiración/checksum.
- Ninguna escucha en `0.0.0.0`; remoto sólo con una etapa futura explícita de HTTPS/autenticación fuerte.

## Consistencia

- `expectedRevision` en toda escritura.
- Mutex lógico por documento; las operaciones incompatibles reciben error recuperable.
- Una confirmación se invalida si cambia la revisión.
- Toda acción visible de agente entra en historial, undo/redo y auditoría con cliente y `operationId`.

## Archivos pesados

Imágenes y máscaras no viajan como Base64 ordinario. Se usan recursos/URIs de sesión o streams, con MIME, dimensiones, checksum, expiración y confinamiento de ruta.

