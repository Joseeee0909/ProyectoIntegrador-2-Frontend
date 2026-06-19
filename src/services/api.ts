import { getApiBaseUrl } from "../config/env";

export type backendStatus = "loading" | "Conectado exitosamente" | "error";

export type BackendResult = {
  status: backendStatus;
  data?: unknown;
};

export async function ConnectToBackend( timeoutMs = 5000 ): Promise<BackendResult> { 
  const apiUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
   
    try {
    const res = await fetch(`${apiUrl}`, { method: 'GET', signal: controller.signal});

    const data = await res.text();

    return {
      status: res.ok ? "Conectado exitosamente" : "error",
      data,
    };

  } catch { return { status: "error" } } finally { clearTimeout(timeoutId) }
}   
