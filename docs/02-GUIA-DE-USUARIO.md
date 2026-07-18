# Guía de usuario: Transparencias

## Procesamiento individual

1. Pulse **Abrir** o **Abrir una imagen**, o arrastre un archivo compatible al canvas.
2. En **Tratamiento de transparencias**, pulse **Analizar alfa**.
3. Revise el recuento de píxeles semitransparentes, las regiones y la recomendación.
4. Elija un preajuste o configure umbral, reconstrucción y protecciones.
5. Espere la previsualización de impacto. Rojo será transparente; cian será opaco; magenta queda protegido o pendiente.
6. Pulse **Aplicar tratamiento**. La aplicación vuelve a analizar el resultado.
7. Si hace falta, abra **Limpieza de residuos**, detecte o seleccione zonas y aplique la máscara.
8. Con alfa binario verificado, abra **Pulido de borde**, previsualice y aplique.
9. Compare antes/después. Marque la revisión visual cuando la interfaz la solicite.
10. Pulse **Exportar** y elija un PNG.

[CAPTURA PENDIENTE: vista completa del módulo Transparencias con una imagen abierta y el botón Analizar alfa]

## Modo lote

1. Pulse **Por lote**. El fondo del módulo cambia a violeta.
2. Elija **Carpeta de entrada**; la búsqueda incluye subcarpetas.
3. Elija una **Carpeta de salida** o deje la misma carpeta de cada original.
4. Configure formato y, para PNG, PPP.
5. Active o desactive Transparencias, Limpieza de residuos y Pulido de borde con sus controles **SÍ/NO**.
6. Configure una sola vez las etapas activas.
7. Revise las miniaturas de la cola bajo el canvas. Puede arrastrar el carrusel o usar las flechas.
8. Inicie el lote. Se procesa una imagen por vez, se exporta y desaparece de la cola si termina correctamente.
9. Use **Detener lote** para cancelar el trabajo activo y conservar lo pendiente.
10. Los errores permanecen en la cola y pueden reintentarse.

[CAPTURA PENDIENTE: modo lote violeta mostrando bloque de carpetas, etapas SÍ/NO y cola horizontal bajo el canvas]

## Crear un documento con medidas reales

1. En la pantalla de inicio pulse **Nuevo documento**.
2. Elija un preajuste o indique ancho, alto, unidad, PPP, profundidad, perfil y fondo.
3. El valor inicial DTF es **38 × 38 cm a 300 PPP**, equivalente a **4488 × 4488 px**.
4. Revise los píxeles y la memoria estimada antes de crear.

Las unidades disponibles son px, cm, mm, pulgadas, puntos y picas. Un documento nuevo crea una mesa vacía; no crea una imagen blanca. Al abrir una imagen sobre esa mesa, queda colocada en el centro con su tamaño físico real: `píxeles ÷ PPP de origen × 2,54` centímetros. Nunca se agranda para llenar la mesa. Si el archivo no declara PPP, se usa y se informa el respaldo de 300 PPP. La imagen puede moverse incluso fuera de los límites y los campos X, Y, W, H y rotación permiten introducir valores exactos.

Si los PPP detectados no coinciden con los 300 PPP de la mesa, **Propiedades de imagen** muestra ambos valores y ofrece **Convertir a 300 PPP**. La acción es explícita y no remuestrea: conserva exactamente los píxeles originales y recalcula el tamaño impreso en centímetros. Si el archivo no informa PPP, la aplicación no afirma un tamaño real; muestra **PPP de origen no informados** hasta que se pulse **Asignar 300 PPP**.

**Quitar imagen** retira solamente el elemento colocado. La mesa actual, sus dimensiones, PPP y guías permanecen visibles, con un botón **Abrir otra imagen** para continuar sin volver al inicio.

## Usar reglas y guías

- Arrastre desde la regla superior para crear una guía horizontal.
- Arrastre desde la regla lateral para crear una guía vertical.
- Arrastre una guía para moverla. Para eliminarla, devuélvala a su regla, selecciónela y pulse Supr/Retroceso, o use **Eliminar guía** en el menú contextual.
- Abra **Propiedades → Contenido** para escribir su posición exacta en la unidad del documento.
- El cero de ambas reglas está en el centro matemático de la mesa; los valores son negativos hacia la izquierda/arriba y positivos hacia la derecha/abajo.
- Al acercar una guía al cero, se pega suavemente y muestra **0 · centro**. Al mover una imagen cerca de los centros o bordes, aparecen indicadores violetas cortos y nítidos sólo durante el gesto.
- En **Ajustes → Precisión y ayudas visuales** puede ocultar reglas o guías, bloquear guías y activar o desactivar el imán y las guías inteligentes.

La herramienta **Selección** permite elegir y mover la imagen libremente, incluso fuera de la mesa. Sus ocho tiradores cuadrados cambian el tamaño siempre en proporción. La herramienta **Mano**, el botón central o mantener Espacio desplazan la vista sin mover la imagen. Si no hay una imagen seleccionada, Propiedades no muestra medidas del elemento y las operaciones de procesamiento piden seleccionarla.

Estas ayudas sólo existen en el editor: nunca se incluyen en la exportación.

## Consultar propiedades

El botón **Propiedades** muestra origen, formato, píxeles, tamaño físico, PPP, perfil, profundidad, contenido colocado, guías y condiciones de exportación. Si PNG o JPEG no contiene PPP confiables, se asumen 300 y se muestra la advertencia. Cambiar los PPP desde Propiedades no remuestrea ni modifica píxeles.

## Elegir GPU o CPU

1. Pulse **Ajustes** en la esquina superior derecha.
2. En **Renderizador de imagen**, elija **GPU** para WebGL de alto rendimiento o **CPU** para Canvas 2D.
3. El cambio se aplica inmediatamente y queda guardado para el próximo inicio.
4. Revise **En uso** o la barra inferior para confirmar el backend realmente activo. Si WebGL no está disponible, la aplicación puede usar CPU como respaldo.

GPU es la opción predeterminada y recomendada para que el zoom, el desplazamiento y las máscaras sean más fluidos. Este ajuste controla el lienzo; el procesamiento técnico de alfa, residuos, pulido y exportación continúa en el motor Rust de CPU.

## Límites visibles

- Durante el lote se bloquean apertura, eliminación y exportación individual.
- Pulido necesita alfa binario; active primero Transparencias si las entradas pueden contener semitransparencias.
- WebP y BMP convierten imágenes de 16 bits a 8 bits al exportar. PNG y TIFF conservan 16 bits.
- Sólo PNG guarda los PPP como metadato en la implementación actual.
