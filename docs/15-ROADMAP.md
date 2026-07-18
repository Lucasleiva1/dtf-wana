# Roadmap verificable

Este documento no promete fechas. Enumera brechas detectadas durante la auditoría.

## Prioridad alta

- Implementar un servidor/adaptador MCP real sobre contratos versionados.
- Exponer a automatización importación segura, jobs, residuos, pulido, lote y formatos; el bus actual sólo cubre una parte.
- Añadir permisos, raíces autorizadas, confirmaciones y registro de auditoría.
- Conciliar documentos históricos que mencionan versiones y formatos antiguos.

## Calidad

- Añadir script de lint y validación de enlaces en CI.
- Añadir pruebas end-to-end Tauri del flujo individual y lote.
- Probar cancelación durante escritura en entorno real Windows.
- Documentar y probar archivos corruptos, nombres Unicode y rutas largas.

## Experiencia operativa

- Evaluar persistencia optativa de configuración/cola.
- Evaluar conservación de estructura de subcarpetas en salida común.
- Definir si la exportación individual debe ofrecer los formatos ya soportados por backend.
- Resolver o retirar el control visible de Guardar proyecto.

## Módulos aún no documentados

- Fondo.
- Separar.
- Cualquier módulo nuevo deberá añadir su sección, contratos, tutoriales y entradas en `APP_SPEC.yaml` sin mezclar comportamientos no auditados.
