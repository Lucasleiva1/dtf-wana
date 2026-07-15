# Registro de versión estable

## Último punto de restauración

- Versión: `0.3.0`
- Etiqueta Git: `app-v0.3.0`
- Nombre: **Pulido de borde y gestión de imágenes**
- Fecha y hora local: **2026-07-15 20:52:15 -03:00**
- Fecha UTC: **2026-07-15T23:52:15Z**
- Rama: `main`
- Repositorio: `Lucasleiva1/dtf-wana`
- Estado: **versión estable firmada para GitHub Releases**

Para volver exactamente a este guardado:

```powershell
git fetch --tags origin
git switch --detach app-v0.3.0
```

## Contenido principal

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
