# Producto: módulo Transparencias

DTF Pro Studio procesa imágenes localmente en una aplicación Windows. El módulo Transparencias busca detectar valores alfa intermedios, convertirlos en una máscara binaria verificable, limpiar restos y pulir el contorno antes de exportar.

## Usuarios y objetivo

El flujo está orientado a quien prepara imágenes y necesita repetir una configuración sobre una imagen o una carpeta. La aplicación muestra la imagen en un canvas, los controles en el inspector derecho y, en modo lote, una cola horizontal debajo del canvas.

## Alcance confirmado

- Apertura individual y arrastre de PNG, JPG/JPEG, WebP, TIFF y BMP.
- Análisis de alfa de 8 y 16 bits.
- Umbral binario, protecciones y reconstrucción de RGB en píxeles convertidos a opacos.
- Limpieza de residuos con detección y edición de máscara.
- Pulido de borde sobre alfa ya binario.
- Comparación antes/después y deshacer/rehacer.
- Lote recursivo, secuencial, cancelable y con exportación automática.
- Verificación técnica de la salida mediante reapertura.

## Fuera de alcance de esta entrega

- Las pestañas Fondo y Separar.
- Un servidor MCP operativo.
- Guardado de proyectos: el control visible `Guardar` no tiene flujo implementado comprobado.
- Procesamiento paralelo de múltiples imágenes.

## Principio de seguridad funcional

El archivo de origen se conserva en memoria como bytes y píxeles originales. Las operaciones trabajan sobre una copia `working`; la exportación escribe un archivo nuevo y el lote evita sobrescribir nombres existentes.

