import { getApiBaseUrl } from "../config/env";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface FetchMessagesOptions {
  limit?: number;
  before?: string; // message ID cursor for loading older messages
}

function getAuthHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeDate(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record._seconds === "number") {
      return new Date(record._seconds * 1000).toISOString();
    }
    if (typeof record.seconds === "number") {
      return new Date(record.seconds * 1000).toISOString();
    }
  }

  return new Date().toISOString();
}

export function normalizeMessage(raw: unknown): ChatMessage | null {
  if (typeof raw !== "object" || raw === null) return null;

  const msg = raw as Record<string, unknown>;
  const id = (msg.id ?? msg._id ?? "") as string;
  const roomId = (msg.roomId ?? "") as string;
  const senderId = (msg.senderId ?? msg.userId ?? "") as string;
  const content = (msg.content ?? msg.text ?? "") as string;
  const createdAt = normalizeDate(msg.createdAt ?? msg.created_at ?? msg.timestamp);

  if (!id || !content) return null;

  return { id, roomId, senderId, content, createdAt };
}

export async function fetchRoomMessages(
  roomId: string,
  accessToken: string,
  options: FetchMessagesOptions = {}
): Promise<ChatMessage[]> {
  const baseUrl = getApiBaseUrl();
  const encodedRoomId = encodeURIComponent(roomId);

  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.before) params.set("before", options.before);

  const queryString = params.toString();
  const url = `${baseUrl}/api/rooms/${encodedRoomId}/messages${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error("No pudimos cargar los mensajes de esta sala.");
  }

  const body = await response.json();
  const raw = Array.isArray(body) ? body : (body.messages ?? body.data ?? []);

  return (raw as unknown[])
    .map(normalizeMessage)
    .filter((m): m is ChatMessage => m !== null);
}
