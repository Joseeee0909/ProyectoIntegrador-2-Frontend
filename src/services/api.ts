export type backendStatus = "loading" | "Conectado exitosamente" | "error";

export type BackendResult = {
  status: backendStatus;
  data?: unknown;
};

const API_URL = import.meta.env.VITE_API_URL?.trim();

export async function ConnectToBackend( timeoutMs = 5000 ): Promise<BackendResult> { 
    if (!API_URL) return { status: "error" }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
   
    try {
    const res = await fetch(`${API_URL}`, { method: 'GET', signal: controller.signal});

    const data = await res.text();

    return {
      status: res.ok ? "Conectado exitosamente" : "error",
      data,
    };

} catch (error) { return { status: "error" } } finally { clearTimeout(timeoutId) }
}   
