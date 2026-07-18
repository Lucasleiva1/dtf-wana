# Abrir DTF Pro Studio en desarrollo

## Regla para el usuario y los agentes

El acceso directo **DTF Pro Studio - Desarrollo** abre el entorno completo de desarrollo con doble clic:

1. inicia Vite en `http://127.0.0.1:1420`;
2. compila los cambios nativos necesarios con Tauri/Cargo;
3. abre DTF Pro Studio como ventana nativa de Windows;
4. mantiene una consola visible para detener la sesión con `Ctrl+C` o leer un error.

El usuario abre y cierra esta sesión desde el acceso directo. Cuando un agente modifica el proyecto, debe guardar y validar los cambios, pero **no debe intentar abrir la ventana gráfica desde el escritorio aislado de Codex**. La aplicación abierta por el usuario recibe la recarga de desarrollo.

## Archivos

- Acceso directo del usuario: `C:\Users\jaell\Desktop\DTF Pro Studio - Desarrollo.lnk`
- Lanzador versionado: `scripts/start-dev.ps1`
- Instalador del acceso directo: `scripts/install-dev-shortcut.ps1`
- Puerto fijo de Vite: `1420`

El archivo `.lnk` puede moverse a otra carpeta y seguirá apuntando al lanzador del proyecto.

## Recrear el acceso directo

Si el acceso directo se pierde, ejecutar una vez desde la raíz del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-dev-shortcut.ps1
```

No hace falta reinstalar dependencias para cada arranque. Sólo se requiere `corepack pnpm install --frozen-lockfile` cuando cambian `package.json` o `pnpm-lock.yaml`.
