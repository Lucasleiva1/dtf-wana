# Seguridad y privacidad

## Datos

El procesamiento auditado es local. No se encontró carga de imágenes a servicios remotos. Los bytes y píxeles viven en memoria del proceso y la salida se escribe sólo en la ruta elegida.

## Tauri

La CSP no habilita globalmente `unsafe-eval`. PixiJS usa su módulo de compatibilidad específico. Las capacidades declaradas incluyen diálogo de abrir/guardar, actualizador y reinicio del proceso.

## Sistema de archivos

- Las lecturas por ruta validan extensión, tipo de archivo y límite de 512 MB.
- El escaneo sólo incluye extensiones admitidas y limita la cantidad.
- El lote evita sobrescrituras.
- La exportación elimina el archivo si falla la verificación.

## Automatización futura

Un MCP deberá aplicar permisos por herramienta y raíz, validar rutas canónicas, impedir traversal, exigir revisión esperada para mutaciones y registrar auditoría sin guardar píxeles ni secretos. No debe exponer directamente todos los comandos Tauri.

## Actualizaciones

El cliente consulta artefactos firmados mediante el actualizador Tauri. Las claves privadas de firma sólo deben existir como secretos de CI; no deben entrar al repositorio.
