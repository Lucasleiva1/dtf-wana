# Desarrollo en Windows

Requisitos: Windows 10/11 x64, Git, Node LTS, pnpm, Rust stable MSVC, Visual Studio Build Tools 2022 con “Desktop development with C++”, Windows SDK y WebView2 Runtime. Python 3.11 y `uv` se agregan antes de los módulos IA.

Flujo de desarrollo previsto:

```powershell
corepack pnpm install --frozen-lockfile
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1
```

El acceso directo **DTF Pro Studio - Desarrollo** del Escritorio ejecuta el mismo script con doble clic. Abre una consola de control, inicia Vite en `http://127.0.0.1:1420` y abre una ventana nativa de Windows con recarga de desarrollo. Cerrar la aplicación o presionar `Ctrl+C` detiene la sesión. El lanzador bloquea un segundo arranque simultáneo y conserva la consola abierta si ocurre un error.

El uso diario y la regla para agentes están documentados en [DESARROLLO-UN-CLIC.md](../DESARROLLO-UN-CLIC.md). Si se pierde el acceso directo, `scripts/install-dev-shortcut.ps1` lo recrea en el Escritorio.

No se genera un instalador durante este flujo. Tauri usa los binarios locales de `node_modules`; la instalación de dependencias sólo es necesaria cuando cambian el manifiesto o el lockfile.
