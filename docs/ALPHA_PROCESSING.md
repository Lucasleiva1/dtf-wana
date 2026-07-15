# Procesamiento de alfa

## Clasificación exacta

- 8 bits: transparente `0`, parcial `1..254`, opaco `255`.
- 16 bits: transparente `0`, parcial `1..65534`, opaco `65535`.
- El lector conserva la profundidad. Nunca cuantiza 16 bits antes de analizar.

El análisis retorna dimensiones, profundidad, conteos exactos, alfa parcial mínimo/máximo, porcentaje, histograma y bounding boxes de componentes conectados.

## Tratamientos

Todas las operaciones producen una máscara/delta reversible:

- parcial → 0;
- parcial → máximo;
- umbral binario;
- reglas por rangos;
- operaciones limitadas a selección/región.

## Reconstrucción de borde

Para un píxel parcial que se vuelve opaco:

1. clasificar contaminación blanca, negra o cromática;
2. descartar candidatos transparentes o premultiplicados no confiables;
3. buscar color interior por radios crecientes con pesos por distancia y conectividad;
4. preservar componentes y líneas de un píxel;
5. propagar RGB robusto sin cambiar geometría fuera de la máscara;
6. marcar como pendiente lo que no tenga evidencia suficiente.

La verificación técnica confirma alfa. La visual informa halos, regiones pendientes y zonas marcadas. Una no sustituye a la otra.

## Verificación posterior a exportación

El archivo guardado se reabre con un decoder independiente del canvas. Se comprueban firma/formato, dimensiones, profundidad y conjunto de valores alfa. En modo sólido, cualquier valor intermedio invalida la exportación.

