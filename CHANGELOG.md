# Registro de cambios

Este archivo registra cambios confirmados en el repositorio. Para publicar una versión también deben actualizarse `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.

## [0.4.3] - 2026-07-18

### Documentos, medidas y mesa de trabajo

- Se añadió una pantalla de inicio con creación de documentos físicos y preajuste DTF de 38 × 38 cm a 300 PPP (4488 × 4488 px).
- El documento admite px, cm, mm, in, pt y pc, perfil de color, profundidad, fondo de mesa y estimación de memoria antes de crear.
- La imagen importada queda como elemento colocado, con X, Y, ancho, alto, proporción y rotación editables; puede moverse fuera de la mesa sin alterar los píxeles originales.
- Se incorporaron propiedades por pestañas con dimensiones físicas, píxeles, PPP, color, contenido, origen y condiciones de exportación.
- Se añadieron reglas superior y lateral de origen central con numeración continua, guías violetas arrastrables, posiciones numéricas, imán al cero e indicadores inteligentes cortos y temporales. La regla superior crea horizontales y la lateral crea verticales; pueden ocultarse, bloquearse o eliminarse devolviéndolas a su regla, con Supr/Retroceso o desde el menú contextual.
- La imagen ahora exige selección para transformar o procesar, se mueve libremente fuera de la mesa y ofrece ocho tiradores cuadrados de escala siempre proporcional, propiedades contextuales y Deshacer/Rehacer de transformaciones.
- La colocación respeta centímetros reales según los PPP de origen; conserva la mesa al reemplazar, nunca encaja automáticamente la imagen a 38 × 38 y muestra píxeles, PPP y tamaño físico en Propiedades.
- Propiedades avisa si la imagen no coincide con los 300 PPP de la mesa y permite convertirla explícitamente sin inventar ni remuestrear píxeles; cuando faltan metadatos, no confirma centímetros hasta asignar 300 PPP.
- **Quitar imagen** conserva la mesa, sus PPP y guías, y ofrece abrir otra imagen sin regresar al inicio.
- El movimiento y escalado se sincronizan con cada cuadro de pantalla para evitar saltos por eventos de puntero redundantes; el imán inteligente se redujo a una tolerancia visual de 5 px.
- PNG `pHYs` y JPEG JFIF aportan sus PPP cuando existen; en ausencia de metadatos se asumen 300 PPP y la interfaz lo declara.

### Rendimiento e interfaz

- Se añadió en Ajustes la selección persistente entre GPU y CPU para el renderizado del lienzo y las máscaras.
- GPU es la opción predeterminada y solicita WebGL de alto rendimiento; CPU utiliza Canvas 2D como modo de compatibilidad.
- La barra de estado y el panel de Ajustes muestran el backend realmente activo y el nombre informado por el renderizador.

## [0.4.2] - 2026-07-16

### Documentación

- Se documentó de forma modular el módulo Transparencias.
- Se añadieron manuales técnico, operativo, de usuario y para agentes de IA.
- Se registraron contratos de alfa, residuos, pulido, lote y exportación.
- Se aclaró que el bus interno de comandos no equivale a un servidor MCP disponible.
- Se corrigió documentalmente la matriz de exportación: el lote admite PNG, WebP sin pérdida, TIFF y BMP; la exportación individual visible admite PNG.
- Se retiraron del punto de partida las referencias a enfoques y módulos experimentales descartados.

### Funcionalidad confirmada en 0.4.2

- Análisis exacto de alfa RGBA de 8 y 16 bits.
- Tratamiento por umbral con previsualización, protecciones y reconstrucción de color.
- Limpieza automática y manual de residuos con máscara reversible antes de aplicar.
- Pulido de contorno que exige alfa binario.
- Procesamiento secuencial por lote con cola visual y cancelación.
- Exportación con reapertura y verificación del archivo generado.

## Historial anterior

No existía un `CHANGELOG.md` verificable al iniciar esta auditoría. Consultar el historial Git y las publicaciones de GitHub para reconstruir versiones anteriores.
