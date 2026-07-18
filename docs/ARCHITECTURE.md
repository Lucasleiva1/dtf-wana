# DTF Pro Studio — arquitectura maestra

> **Documento de visión histórica.** Incluye componentes futuros y no debe interpretarse como inventario implementado de 0.4.2. La arquitectura auditada está en [06-ARQUITECTURA.md](06-ARQUITECTURA.md).

## Principios innegociables

- Aplicación de escritorio Windows construida con Tauri 2, React y TypeScript.
- El original es inmutable. La vista puede usar proxies; el motor y la exportación usan el buffer original.
- Documento, artboard, contenido, transformaciones y cámara son estados separados.
- Las máscaras y operaciones son no destructivas y reversibles.
- Ninguna imagen sale del equipo. La IA será local y opcional.
- El alcance consolidado se entrega por puertas de calidad: Base → Transparencias → residuos → pulido → lote → exportación verificada.

## Capas

1. **Shell Tauri**: ventana nativa, diálogos de archivo, permisos mínimos, ciclo de vida y updater futuro.
2. **UI React**: chrome de aplicación, herramientas, paneles, accesibilidad, atajos y diseño responsive.
3. **Canvas**: cámara y render de preview. Nunca es la fuente de exportación.
4. **Estado de documento**: metadatos, artboard, transformaciones, máscaras, historial y export settings.
5. **Application Command Bus (Rust)**: contratos versionados invocados por Tauri. MCP usa el mismo bus; React nunca contiene la única implementación de una operación de dominio.
6. **Core Rust**: importación, buffers, alfa, máscaras, componentes conectados, bordes, exportación y verificación.
7. **Worker IA**: proceso aislado, un modelo por vez, JSON por stdin/stdout, cancelación y liberación explícita de memoria.

## Modelo interno

```text
Document
├─ id, source_path, source_format, source_fingerprint
├─ width, height, bit_depth, color_space, icc_profile
├─ original_pixel_buffer, original_alpha_buffer
├─ artboard
├─ content_transform
├─ masks
├─ extracted_elements
├─ operation_history
└─ export_settings

ViewState
├─ camera { x, y, zoom, focus }
├─ preview_background
├─ overlay_mode
└─ active_module / active_tool
```

`ViewState` jamás modifica `Document`. Los deltas del historial referencian operaciones y máscaras; no duplican imágenes completas salvo checkpoints controlados.

## Command bus preparado para MCP

Todos los comandos de dominio usan un sobre estable:

```ts
type CommandRequest<T> = {
  protocolVersion: 1;
  requestId: string;
  command: string;
  payload: T;
  expectedRevision?: number;
  dryRun?: boolean;
  client?: { id: string; name: string; transport: "tauri" | "stdio" | "http" };
};

type CommandResult<T> = {
  protocolVersion: 1;
  requestId: string;
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
};
```

La UI llama adaptadores locales; Rust contiene la lógica. MCP será otro adaptador y no una segunda implementación del motor.

Las herramientas usan identificadores estables en inglés. Toda escritura exige control de revisión, idempotencia por `requestId`, permiso, auditoría, exclusión de escritura por documento y, cuando corresponda, confirmación visible en la UI confiable.

## Rendimiento y memoria

- Preview multirresolución: proxy lejano, nivel intermedio y tiles originales en inspección cercana.
- Procesamiento pesado en tareas Rust/worker cancelables, nunca en el hilo de UI.
- RGBA recto en el core. Se detecta y corrige entrada premultiplicada antes de reconstruir colores.
- 8 y 16 bits conservados en análisis y exportación cuando el formato lo permite.
- Un solo modelo IA residente; preflight de RAM/VRAM y fallback CPU.

## Responsive

- `>= 1200 px`: herramientas, lienzo y panel derecho visibles.
- `900–1199 px`: panel derecho compacto y barras reducibles.
- `640–899 px`: panel derecho como inspector superpuesto, barra de herramientas desplazable.
- `< 640 px` o baja altura: controles esenciales, paneles tipo drawer, densidad compacta y lienzo prioritario.
- Se prueba por ancho **y por altura** (600, 720, 768, 900 y 1080 px). No se asume Full HD.

## Seguridad de actualización

El updater se agrega al final: releases firmadas, clave privada sólo en GitHub Secrets, bloqueo si hay cambios sin guardar o trabajos activos, y datos del usuario fuera del directorio reemplazado por la actualización.
