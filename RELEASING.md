# Publicación de DTF Pro Studio

Las versiones de escritorio se publican con una etiqueta `app-vX.Y.Z` y tres
artefactos mínimos para Windows: el instalador NSIS, su firma y `latest.json`.

La clave privada de firma no pertenece al repositorio. En esta estación de
trabajo se conserva fuera del proyecto, dentro de la carpeta privada de la
aplicación en AppData. El método preferido es firmar localmente y subir sólo el
instalador, su firma y `latest.json`. GitHub Actions es una alternativa cuando
sus secretos `TAURI_SIGNING_PRIVATE_KEY` y
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` corresponden a la misma clave pública
embebida en `tauri.conf.json`.

Para una versión futura:

1. actualizar el mismo número de versión en `package.json`, `Cargo.toml` y
   `tauri.conf.json`;
2. comprobar que la clave pública local coincide con `plugins.updater.pubkey`;
3. ejecutar typecheck, pruebas web, pruebas Rust y build;
4. compilar el instalador NSIS con la clave local cargada sólo en las variables
   de entorno del proceso;
5. generar `latest.json` UTF-8 sin BOM con `windows-x86_64-nsis` y
   `windows-x86_64`;
6. crear el commit y la etiqueta `app-vX.Y.Z`, y subir ambos;
7. publicar exactamente el `.exe`, `.exe.sig` y `latest.json` en GitHub
   Releases;
8. verificar `releases/latest/download/latest.json`, su versión y firma.

Como alternativa remota:

1. ejecutar las pruebas y crear la etiqueta `app-vX.Y.Z`;
2. subir el commit y la etiqueta;
3. ejecutar manualmente el workflow “Publicar versión de escritorio firmada”
   con esa etiqueta;
4. comprobar que `latest.json` y la firma se descargan desde el Release más
   reciente.

Nunca se debe copiar, imprimir ni versionar la clave privada o su contraseña.
