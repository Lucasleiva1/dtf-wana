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

[CAPTURA PENDIENTE: primer plano de cada bloque con los controles etiquetados]
