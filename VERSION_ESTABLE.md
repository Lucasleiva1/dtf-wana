# Registro de versión estable

> **Punto de restauración histórico.** Este archivo registra el release estable 0.3.1; no define la versión actual del código, que es 0.4.2. Consultar `CHANGELOG.md` y los tres manifiestos de versión antes de publicar.

## Último punto de restauración

- Versión: `0.3.1`
- Etiqueta Git: `app-v0.3.1`
- Nombre: **Corrección del lienzo WebGL**
- Fecha y hora local: **2026-07-15 21:09:54 -03:00**
- Fecha UTC: **2026-07-16T00:09:54Z**
- Rama: `main`
- Repositorio: `Lucasleiva1/dtf-wana`
- Estado: **versión estable firmada para GitHub Releases**

Para volver exactamente a este guardado:

```powershell
git fetch --tags origin
git switch --detach app-v0.3.1
```

## Contenido principal

- Corrige la inicialización de WebGL en WebView2 para que Windows seleccione el adaptador gráfico compatible.
- Evita el lienzo transparente sin imagen al cargar documentos grandes como 4488 × 4488.
- Mantiene la aceleración por GPU y muestra el diagnóstico real si WebGL no puede iniciarse.
- Módulo Transparencias con trabajos cancelables, verificación alfa 0/255 e historial.
- Limpieza manual y automática de residuos mediante máscara binaria.
- Tercera etapa independiente **Pulido de borde**, con previsualización, protecciones y Deshacer.
- Lienzo persistente con procesamiento optimizado y aceleración GPU.
- Reemplazo, arrastre y eliminación de imágenes sin borrar el archivo original.
- Interfaz responsive desde 560 × 480.

## Assets requeridos

El release estable debe contener:

- Instalador NSIS `.exe`.
- Firma del instalador `.exe.sig`.
- Manifiesto del actualizador `latest.json`.

La clave privada de firma se conserva fuera del repositorio y nunca debe publicarse como asset.
