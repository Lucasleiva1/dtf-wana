# DTF Pro Studio

DTF Pro Studio es una aplicación de escritorio para Windows orientada al análisis y procesamiento de imágenes con transparencia. La versión auditada es **0.4.2**.

Esta entrega documental cubre únicamente el módulo **Transparencias**: análisis del canal alfa, resolución de semitransparencias, limpieza de residuos, pulido de borde, modo lote y exportación verificada. Las pestañas Fondo y Separar no forman parte de este alcance.

## Documentación

- [Índice general](docs/INDEX.md)
- [Guía de usuario](docs/02-GUIA-DE-USUARIO.md)
- [Pipeline real](docs/04-PIPELINE-DE-PROCESAMIENTO.md)
- [Modo lote](docs/05-MODO-LOTE.md)
- [Contexto para agentes de IA](docs/ai/APP_CONTEXT.md)
- [Contratos de procesamiento](docs/ai/PROCESSING_CONTRACTS.md)
- [Inicio rápido](docs/tutorial/01-INICIO-RAPIDO.md)

## Desarrollo

Requisitos comprobados: Node.js, pnpm, Rust estable y los prerrequisitos de Tauri 2 para Windows.

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm tauri dev
```

No existe un script `lint` en `package.json`. El backend se valida con:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

## Nota sobre MCP

El repositorio contiene un bus de comandos Tauri con protocolo interno v1, pero **no contiene todavía un servidor MCP ni un transporte externo instalado**. La documentación para IA describe los contratos disponibles y la integración que falta, sin presentar el MCP como funcional.

