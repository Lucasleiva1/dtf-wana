# Modelos de IA

## BiRefNet Lite

Quitar fondo integra `onnx-community/BiRefNet_lite-ONNX` para crear una máscara de alfa local. El modelo tiene licencia MIT, pesa 224.005.088 bytes y recibe una imagen RGB normalizada a 1024 × 1024. La máscara resultante se redimensiona al tamaño original y no modifica `source_bytes` ni `original`.

La inferencia usa Microsoft ONNX Runtime 1.24.4. Con GPU seleccionada se intenta DirectML; si la sesión o la ejecución falla —por ejemplo, por memoria de video insuficiente— la operación se repite por CPU y se informa el proveedor efectivo. Tras un error de ejecución DirectML no se vuelve a intentar GPU durante esa sesión de la aplicación.

El modelo y las DLL son recursos binarios ignorados por Git. `scripts/install-birefnet-model.ps1` los descarga desde Hugging Face y NuGet, valida sus SHA-256 y los deja en `models/background-removal/`. El flujo de GitHub Release ejecuta el mismo instalador antes de empaquetar la aplicación.

El archivo rastreado `models/background-removal/model.json` fija revisión, dimensiones, normalización, versiones y sumas de comprobación.
