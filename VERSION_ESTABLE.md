# Registro de versión estable

> **Punto de restauración vigente.** Este archivo registra la versión 0.4.5 preparada para publicación. Consultar `CHANGELOG.md` y los manifiestos antes de publicar un instalador posterior.

## Último punto de restauración

- Versión: `0.4.5`
- Etiqueta Git: `app-v0.4.5`
- Nombre: **IA local y herramientas contextuales**
- Fecha local: **2026-07-18**
- Rama: `main`
- Repositorio: `Lucasleiva1/dtf-wana`
- Estado: **punto de partida del código guardado en GitHub**

Para volver exactamente a este guardado:

```powershell
git fetch --tags origin
git switch --detach app-v0.4.5
```

## Contenido principal

- Módulo Transparencias con trabajos cancelables, verificación alfa binario e historial.
- Limpieza manual y automática de residuos mediante máscara binaria.
- Pulido de borde independiente, con previsualización, protecciones y Deshacer.
- Procesamiento secuencial por lote con errores conservados en la cola.
- Exportación sin sobrescritura, reapertura y verificación del resultado.
- Lienzo persistente con procesamiento optimizado y aceleración GPU.
- Reemplazo, arrastre y eliminación de imágenes sin borrar el archivo original.
- Interfaz responsive desde 560 × 480.
- Quitar fondo con BiRefNet Lite local, DirectML y retorno automático a CPU.
- Máscara no destructiva con selección acumulativa, protecciones y borrado repetido.
- Barra contextual tipo Photoshop/Illustrator para Varita y Pincel.
- Tamaño de pincel mediante `Alt + arrastre horizontal` y controles duplicados en el inspector.
- Acceso directo de desarrollo reproducible mediante scripts versionados.

## Assets requeridos

El release estable debe contener:

- Instalador NSIS `.exe`.
- Firma del instalador `.exe.sig`.
- Manifiesto del actualizador `latest.json`.

La clave privada de firma se conserva fuera del repositorio y nunca debe publicarse como asset.
