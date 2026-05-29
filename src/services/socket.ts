import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "../config/env";

let socket: Socket | null = null;

export function initSocket(token?: string) {
  if (socket && socket.connected) return socket;

  const defaultUrl = getApiBaseUrl();
  const socketUrl = (import.meta.env.VITE_SOCKET_URL as string) || defaultUrl || "https://backend-realtime-j6a0.onrender.com";

  socket = io(socketUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: token ? { token } : undefined,
    autoConnect: true,
  });

  socket.on("connect", () => console.debug("[socket] connected", socket?.id));
  socket.on("disconnect", (reason) => console.debug("[socket] disconnected", reason));
  socket.on("connect_error", (err) => console.error("[socket] connect_error", err));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

export function on(event: string, cb: (...args: any[]) => void) {
  if (!socket) initSocket();
  socket?.on(event, cb);
}

export function off(event: string, cb?: (...args: any[]) => void) {
  socket?.off(event, cb);
}

export function emit(event: string, ...args: any[]) {
  socket?.emit(event, ...args);
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  on,
  off,
  emit,
};
