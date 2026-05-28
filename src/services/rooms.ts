import { getApiBaseUrl } from "../config/env";

export interface StudyRoom {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  name: string;
}

export interface UpdateRoomInput {
  name: string;
}

type BackendRoomsResponse = {
  rooms?: unknown;
  room?: unknown;
  data?: unknown;
  message?: string;
  error?: string;
};

const ROOMS_PATH = "/api/rooms";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sanitizeRoomName(name: string) {
  return name.trim().replace(/\s+/g, " ").replace(/[<>]/g, "");
}

function validateRoomName(name: string) {
  const normalized = sanitizeRoomName(name);
  if (!normalized) {
    throw new Error("Ingresa un nombre para la sala.");
  }

  if (normalized.length < 3) {
    throw new Error("El nombre de la sala debe tener al menos 3 caracteres.");
  }

  if (normalized.length > 80) {
    throw new Error("El nombre de la sala no puede superar 80 caracteres.");
  }

  return normalized;
}

function normalizeRoom(room: unknown): StudyRoom | null {
  if (!isRecord(room)) {
    return null;
  }

  const id = asString(room.id);
  const name = asString(room.name);
  const ownerId = asString(room.ownerId ?? room.creatorId);
  const ownerUsername = asString(room.ownerUsername ?? room.creatorUsername);
  const createdAt = asString(room.createdAt);
  const updatedAt = asString(room.updatedAt ?? room.modifiedAt ?? room.createdAt);

  if (!id || !name || !ownerId || !ownerUsername || !createdAt) {
    return null;
  }

  return {
    id,
    name,
    ownerId,
    ownerUsername,
    createdAt,
    updatedAt: updatedAt || createdAt,
  };
}

function extractRooms(body: BackendRoomsResponse) {
  const candidate = body.rooms ?? body.data ?? body.room ?? body;
  if (Array.isArray(candidate)) {
    return candidate.map(normalizeRoom).filter((room): room is StudyRoom => Boolean(room));
  }

  const singleRoom = normalizeRoom(candidate);
  return singleRoom ? [singleRoom] : [];
}

function getAuthHeaders(accessToken?: string) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as BackendRoomsResponse;
  }

  const text = await response.text();
  return text ? ({ message: text } satisfies BackendRoomsResponse) : {};
}

async function requestJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init);
  const body = await readResponseBody(response);

  if (!response.ok) {
    const message = body.error || body.message || "No pudimos completar la operación con la sala.";
    throw new Error(message);
  }

  return body;
}

export async function listRooms(accessToken: string) {
  const body = await requestJson(ROOMS_PATH, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });

  return extractRooms(body);
}

export async function getRoomById(roomId: string, accessToken: string) {
  const encodedRoomId = encodeURIComponent(roomId);
  const body = await requestJson(`${ROOMS_PATH}/${encodedRoomId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });

  return extractRooms(body)[0] ?? null;
}

export async function createRoom(input: CreateRoomInput, accessToken: string) {
  const name = validateRoomName(input.name);
  const body = await requestJson(ROOMS_PATH, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ name }),
  });

  const room = extractRooms(body)[0];
  if (!room) {
    throw new Error("El backend no devolvió la sala creada.");
  }

  return room;
}

export async function updateRoom(roomId: string, input: UpdateRoomInput, accessToken: string) {
  const name = validateRoomName(input.name);
  const encodedRoomId = encodeURIComponent(roomId);
  const body = await requestJson(`${ROOMS_PATH}/${encodedRoomId}`, {
    method: "PATCH",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ name }),
  });

  const room = extractRooms(body)[0];
  if (!room) {
    throw new Error("El backend no devolvió la sala actualizada.");
  }

  return room;
}

export async function deleteRoom(roomId: string, accessToken: string) {
  const encodedRoomId = encodeURIComponent(roomId);
  await requestJson(`${ROOMS_PATH}/${encodedRoomId}`, {
    method: "DELETE",
    headers: getAuthHeaders(accessToken),
  });
}