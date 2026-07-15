# Desarrollo en Windows

Requisitos: Windows 10/11 x64, Git, Node LTS, pnpm, Rust stable MSVC, Visual Studio Build Tools 2022 con “Desktop development with C++”, Windows SDK y WebView2 Runtime. Python 3.11 y `uv` se agregan antes de los módulos IA.

Flujo de desarrollo previsto:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm tauri dev
```

No se genera instalador durante las primeras revisiones. `tauri dev` abre una ventana nativa de Windows con recarga de desarrollo.
