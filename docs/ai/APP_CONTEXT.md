# Contexto operativo para una IA

## Identidad y alcance

Aplicación: DTF Pro Studio 0.4.2, escritorio Windows, React 19 + TypeScript + Tauri 2 + Rust. Esta versión documental cubre Transparencias: importación, alfa, residuos, pulido, lote y exportación.

## Modelo mental

Una imagen abierta se convierte en `ImageDocument`: bytes originales, píxeles originales, píxeles de trabajo y revisión. Analizar no muta. Previsualizar no muta. Aplicar sí muta, incrementa revisión, registra un delta y vuelve a analizar. Exportar no muta el documento, pero escribe, reabre y verifica un archivo.

## Orden seguro

1. Importar y obtener `documentId`, profundidad y revisión.
2. Analizar alfa.
3. Si hay alfa parcial, previsualizar tratamiento con la revisión actual.
4. Pedir confirmación humana cuando la automatización no haya sido autorizada como lote.
5. Aplicar con `expectedRevision`.
6. Opcional: detectar/editar/aplicar residuos.
7. Opcional: pulir sólo si `verifiedSolidAlpha=true`.
8. Verificar de nuevo y exportar con alfa sólido requerido.
9. Conservar el resultado de verificación y cerrar el documento.

## Reglas de interpretación

- Alfa sólido significa sólo 0 y máximo: 255 en 8 bits, 65535 en 16 bits.
- `partialAlphaPixels > 0` impide pulido y la exportación segura.
- `pendingPixels > 0` significa que la configuración dejó zonas sin resolver.
- Rojo en preview: transparente. Cian: opaco. Magenta: protegido o pendiente.
- Una revisión distinta invalida previews y escrituras anteriores.
- Cancelación no equivale a error de contenido.

## Modo lote

El lote escanea recursivamente y procesa una sola imagen por vez con el mismo backend que el modo individual. Las etapas son independientes mediante `alphaEnabled`, `residueEnabled`, `polishEnabled`, pero residuos/pulido pueden exigir que el alfa ya sea binario. Los éxitos se retiran; errores quedan. No hay pausa, sólo cancelar/detener.

## Disponibilidad de automatización

Actualmente no hay servidor MCP. Hay dos superficies internas:

1. Comandos Tauri específicos de documentos y trabajos, usados por la UI.
2. `dispatch_command`, protocolo 1, con: `system.capabilities`, `alpha.analyze`, `alpha.apply_treatment`, `document.undo`, `document.redo`, `export.document`.

El bus parcial no abre archivos, no expone residuos/pulido/lote y `export.document` exporta PNG. Por eso una IA externa no puede operar la aplicación completa hasta implementar un adaptador MCP. No simular disponibilidad.

## Archivos fuente de verdad

- Contratos: [PROCESSING_CONTRACTS.md](PROCESSING_CONTRACTS.md)
- Especificación estructurada: [APP_SPEC.yaml](APP_SPEC.yaml)
- Mapa: [FILE_MAP.md](FILE_MAP.md)
- Motores: `src-tauri/src/*_engine/mod.rs`
- Orquestación de lote: `src/components/BatchPanel.tsx`
- Tipos: `src/types/alpha.ts`, `residue.ts`, `batch.ts`

## Criterio de finalización

No informar éxito sólo porque terminó un job. Exigir `status=completed`, revisar el resultado, confirmar `verifiedSolidAlpha` cuando corresponda y, para exportación, `reopenedAndVerified=true` con ruta, dimensiones y profundidad esperadas.

