# Troubleshooting

## La imagen abre pero no puedo exportar

Pulse **Analizar alfa**, aplique el tratamiento si quedan semitransparencias y complete la revisión visual. La exportación individual exige esos estados.

## Pulido está bloqueado

Pulido requiere alfa exclusivamente 0/255 u 0/65535. Analice y resuelva semitransparencias primero.

## Una imagen del lote no desaparece

Los éxitos se retiran. Si permanece, revise el mensaje: probablemente está en error. Corrija la configuración y use reintento.

## Elegí una carpeta y aparecen imágenes de subcarpetas

Es correcto: el escaneo es recursivo.

## No encuentro las subcarpetas en la salida elegida

La salida común actual es plana. Los nombres duplicados se protegen con sufijos.

## Detener no continúa desde el mismo punto

No hay pausa/reanudación. Detener cancela el trabajo activo; lo pendiente queda disponible para iniciar otra ejecución.

## Error WebGL `unsafe-eval`

La aplicación debe usar el módulo de compatibilidad `pixi.js/unsafe-eval` con la política CSP de Tauri. Si reaparece, comprobar el punto de entrada y no relajar toda la CSP.

## El borde muestra líneas o restos

Verifique que no sea el contorno visual del canvas. Compare original/resultado y use Limpieza de residuos o Pulido sólo después de alfa binario.
