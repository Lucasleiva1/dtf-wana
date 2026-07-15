# Publicación de DTF Pro Studio

Las versiones de escritorio se publican con una etiqueta `app-vX.Y.Z` y tres
artefactos mínimos para Windows: el instalador NSIS, su firma y `latest.json`.

La clave privada de firma no pertenece al repositorio. En esta estación de
trabajo se conserva fuera del proyecto, dentro de la carpeta privada de la
aplicación en AppData. GitHub Actions recibe la clave y su contraseña mediante
los secretos `TAURI_SIGNING_PRIVATE_KEY` y
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

Para una versión futura:

1. actualizar el mismo número de versión en `package.json`, `Cargo.toml` y
   `tauri.conf.json`;
2. ejecutar las pruebas y compilar el instalador firmado;
3. crear la etiqueta `app-vX.Y.Z`;
4. ejecutar manualmente el workflow “Publicar versión de escritorio firmada”
   con esa etiqueta;
5. comprobar que `latest.json` y la firma se descargan desde el Release más
   reciente.

Nunca se debe copiar, imprimir ni versionar la clave privada o su contraseña.
