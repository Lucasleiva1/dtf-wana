# Registro de cambios

Este archivo registra cambios confirmados en el repositorio. Para publicar una versión también deben actualizarse `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.

## [Sin publicar]

### Desarrollo

- Se incorporó un comando único y documentado para validar, firmar, publicar y
  verificar futuras versiones estables usando la clave local ya instalada.

## [0.4.5] - 2026-07-18

### Interfaz

- Quitar fondo incorpora una barra superior contextual inspirada en Photoshop/Illustrator: la Varita muestra modo, tolerancia y continuidad; los pinceles muestran herramienta, tamaño y opacidad sin retirar los controles del inspector.
- Con un pincel activo, `Alt + arrastre horizontal` modifica el diámetro en vivo —derecha agranda, izquierda reduce— respetando el zoom; `Alt + clic` conserva el borrado puntual de marcas.

### Desarrollo

- Se añadió un lanzador de doble clic para Windows que inicia Vite y la ventana nativa de Tauri sin reinstalar dependencias, evita sesiones duplicadas y mantiene visibles los errores de arranque.

### Quitar fondo con IA local

- BiRefNet Lite se ejecuta localmente mediante ONNX Runtime; la máscara de alfa se conserva como una edición no destructiva compatible con Deshacer/Rehacer y con los retoques manuales posteriores.
- El botón **Quitar con IA local** usa la preferencia GPU/CPU de Ajustes. DirectML se intenta cuando está seleccionada GPU y, si el controlador no dispone de memoria suficiente, la misma operación continúa automáticamente por CPU sin cerrar la aplicación.
- El modelo, ONNX Runtime y DirectML se verifican por SHA-256 y se incorporan como recursos de la aplicación. El flujo de publicación los descarga de fuentes oficiales antes de generar el instalador.

## [0.4.4] - 2026-07-18

### Interfaz

- Los avisos ahora aparecen centrados en la parte inferior del área de imagen, conservan el cierre manual y desaparecen automáticamente después de 10 segundos.
- Las cifras de la regla horizontal se muestran completas dentro de la franja superior, sin recortes verticales.
- Quitar fondo muestra la selección con un borde blanco/negro fino y animado tipo Photoshop, sin overlay de color predeterminado; la animación se pausa cuando la ventana pierde el foco.
- La selección puede convertirse repetidamente en transparencia con el botón **Borrar fondo seleccionado** o Supr/Retroceso; Ctrl+D deselecciona y Deshacer/Rehacer conserva cada borrado como un delta independiente.
- La vista Resultado oculta la textura original y deja que el alfa eliminado revele el damero real del lienzo; ya no dibuja un patrón gris reducido que simulaba una capa detrás de la imagen.

### Rendimiento

- La detección desde bordes procesa las cuatro esquinas en una sola operación, convierte CIELAB una sola vez, paraleliza la conversión y evita asignaciones por píxel durante el crecimiento. CIEDE2000 queda como precisión máxima opcional y el modo rápido es el predeterminado.

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
