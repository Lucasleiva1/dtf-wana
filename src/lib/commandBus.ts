import { invoke } from "@tauri-apps/api/core";

export type CommandRequest<T> = {
  protocolVersion: 1;
  requestId: string;
  command: string;
  payload: T;
  expectedRevision?: number;
  dryRun?: boolean;
  client?: { id: string; name: string; transport: "tauri" | "stdio" | "http" };
};

export type CommandResult<T> = {
  protocolVersion: 1;
  requestId: string;
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
};

export type SystemCapabilities = {
  os: string;
  cpu: string;
  logicalCores: number;
  totalMemoryBytes: number;
  tauri: boolean;
};

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function dispatchCommand<TPayload, TResult>(command: string, payload: TPayload): Promise<CommandResult<TResult>> {
  const request: CommandRequest<TPayload> = {
    protocolVersion: 1,
    requestId: requestId(),
    command,
    payload,
    client: { id: "human-ui", name: "DTF Pro Studio", transport: "tauri" },
  };
  if (!window.__TAURI_INTERNALS__) {
    return {
      protocolVersion: 1,
      requestId: request.requestId,
      ok: true,
      data: { os: navigator.platform || "Web preview", cpu: "Vista previa", logicalCores: navigator.hardwareConcurrency || 1, totalMemoryBytes: 0, tauri: false } as TResult,
    };
  }
  return invoke<CommandResult<TResult>>("dispatch_command", { request });
}
