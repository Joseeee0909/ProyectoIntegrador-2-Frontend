import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketUrl(): string {
  return (import.meta.env.VITE_SOCKET_URL as string) || "http://localhost:4000";
}

export function initSocket(token?: string): Socket {
  if (socket) return socket;

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
    autoConnect: true,
  });

  socket.on("connect", () => console.debug("[socket] connected", socket?.id));
  socket.on("disconnect", (reason) => console.debug("[socket] disconnected", reason));
  socket.on("connect_error", (err) => console.error("[socket] connect_error", err.message));

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

export function joinRoom(roomId: string, username?: string) {
  if (!socket) return;
  socket.emit("join-room", { roomId, username: username || "Anónimo" });
}

export function leaveSocketRoom(roomId: string) {
  if (!socket) return;
  socket.emit("leave-room", roomId);
}

export function sendMessage(roomId: string, content: string, token: string) {
  if (!socket) return;
  socket.emit("send-message", { roomId, content, token });
}

export function onNewMessage(cb: (message: unknown) => void) {
  if (!socket) return;
  socket.on("new-message", cb);
}

export function offNewMessage(cb: (message: unknown) => void) {
  if (!socket) return;
  socket.off("new-message", cb);
}

export function onMessageError(cb: (error: { message: string }) => void) {
  if (!socket) return;
  socket.on("message-error", cb);
}

export function offMessageError(cb: (error: { message: string }) => void) {
  if (!socket) return;
  socket.off("message-error", cb);
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  joinRoom,
  leaveSocketRoom,
  sendMessage,
  onNewMessage,
  offNewMessage,
  onMessageError,
  offMessageError,
};
