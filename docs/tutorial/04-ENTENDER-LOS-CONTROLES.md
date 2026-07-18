# Entender los controles

## Tratamiento de transparencias

- **Umbral**: valores inferiores se vuelven transparentes; los demás, opacos.
- **Reconstrucción automática/manual**: decide el radio usado para buscar color interior.
- **Textura conectada**: protege píxeles de borde unidos a opacos.
- **Líneas finas**: protege componentes estrechos o pequeños.
- **Grunge**: protege componentes pequeños y dispersos.
- **Sólo partículas aisladas**: deja otras regiones pendientes.

## Limpieza de residuos

- **Partículas aisladas**: componentes no principales dentro del tamaño máximo.
- **Restos exteriores**: componentes cercanos al límite del diseño principal.
- **Conexiones débiles**: fragmentos con pocos vecinos, según sensibilidad.
- Herramientas: componente, rectángulo, lazo, pincel; modo sumar o restar.
- La máscara roja no modifica hasta aplicar. `[` y `]` cambian el pincel; Supr/Retroceso aplica la selección.

## Pulido de borde

- Intensidad: suave, media o fuerte; controla iteraciones/criterios.
- Radio: 1..3.
- Métodos: suavizado binario, filtro de mayoría y redondeo de picos.
- Protecciones: detalle fino y textura conectada.

## Canvas

Puede ajustar, ampliar, reducir y desplazarse. En modo lote, la cola se navega de forma independiente bajo el canvas.

En **Ajustes → Renderizador de imagen**, **GPU** usa WebGL de alto rendimiento y es el valor predeterminado; **CPU** usa Canvas 2D para compatibilidad. El cambio es inmediato, persiste al reiniciar y no altera la imagen ni su revisión.

## Medidas, reglas y guías

La barra contextual y la zona **Propiedades de imagen** muestran X, Y, W, H y rotación sólo cuando el elemento está seleccionado. La unidad se toma de la mesa y puede cambiarse entre px, cm, mm, in, pt y pc. La proporción está bloqueada siempre: los ocho tiradores cuadrados y los campos de ancho o alto nunca deforman la imagen.

Arrastrar desde la regla superior crea una guía horizontal; arrastrar desde la regla lateral crea una vertical. El cero está en el centro exacto de la mesa y la numeración continúa en ambos sentidos hasta el final visible. **Propiedades → Contenido** permite escribir cada posición con tres decimales. Para eliminar una guía, devuélvala a su regla, selecciónela y pulse Supr/Retroceso, o use su menú contextual. **Ajustes → Precisión y ayudas visuales** controla reglas, guías, bloqueo, imán y guías inteligentes.

No hay una cruz central permanente. El centro sólo se indica de forma temporal: la guía manual muestra **0 · centro** al imantarse y, al mover la imagen, aparece una marca violeta corta, sólida y nítida. La herramienta Mano o Espacio desplaza la vista; Selección mueve el elemento, que puede salir de la mesa.

[CAPTURA PENDIENTE: primer plano de cada bloque con los controles etiquetados]
