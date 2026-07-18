import type { RenderDevice } from "../types/document";

export const renderDeviceStorageKey = "dtf-pro-studio.render-device.v1";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function loadRenderDevice(storage?: ReadableStorage): RenderDevice {
  if (!storage) return "gpu";
  try {
    return storage.getItem(renderDeviceStorageKey) === "cpu" ? "cpu" : "gpu";
  } catch {
    return "gpu";
  }
}

export function persistRenderDevice(device: RenderDevice, storage?: WritableStorage) {
  if (!storage) return;
  try {
    storage.setItem(renderDeviceStorageKey, device);
  } catch {
    // El renderizador cambia igualmente aunque el almacenamiento esté bloqueado.
  }
}
