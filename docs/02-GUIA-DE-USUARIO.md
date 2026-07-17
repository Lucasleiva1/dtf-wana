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

## Límites visibles

- Durante el lote se bloquean apertura, eliminación y exportación individual.
- Pulido necesita alfa binario; active primero Transparencias si las entradas pueden contener semitransparencias.
- WebP y BMP convierten imágenes de 16 bits a 8 bits al exportar. PNG y TIFF conservan 16 bits.
- Sólo PNG guarda los PPP como metadato en la implementación actual.

