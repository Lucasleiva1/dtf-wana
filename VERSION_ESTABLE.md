# Registro de versión estable

> **Punto de partida vigente.** Este archivo registra la base 0.4.2 de Transparencias. Consultar `CHANGELOG.md` y los tres manifiestos de versión antes de publicar un instalador.

## Último punto de restauración

- Versión: `0.4.2`
- Etiqueta Git: `app-v0.4.2`
- Nombre: **Base consolidada de Transparencias**
- Fecha local: **2026-07-17**
- Rama: `main`
- Repositorio: `Lucasleiva1/dtf-wana`
- Estado: **punto de partida del código guardado en GitHub**

Para volver exactamente a este guardado:

```powershell
git fetch --tags origin
git switch --detach app-v0.4.2
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

## Assets requeridos

El release estable debe contener:

- Instalador NSIS `.exe`.
- Firma del instalador `.exe.sig`.
- Manifiesto del actualizador `latest.json`.

La clave privada de firma se conserva fuera del repositorio y nunca debe publicarse como asset.
