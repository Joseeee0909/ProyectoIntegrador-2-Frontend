export const AVATAR_PRESETS = ["avatar1", "avatar2", "avatar3", "avatar4", "avatar5", "avatar6"] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

const AVATAR_PRESET_SET = new Set<string>(AVATAR_PRESETS);

export function isAvatarPreset(value: string): value is AvatarPreset {
  return AVATAR_PRESET_SET.has(value);
}

export function isExternalAvatarUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function isValidAvatarInput(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return true;

  return isExternalAvatarUrl(trimmed)
    || isAvatarPreset(trimmed)
    || /^(?:\/avatars\/avatar[1-6]\.svg|(?:.*\/)?avatar[1-6]\.svg(?:\?.*)?)$/i.test(trimmed);
}

export function normalizeAvatarValue(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  if (isExternalAvatarUrl(trimmed)) return trimmed;
  if (isAvatarPreset(trimmed)) return trimmed;

  const match = trimmed.match(/(?:^|\/)(avatar[1-6])\.svg(?:\?.*)?$/i);
  if (match?.[1]) return match[1].toLowerCase();

  return trimmed;
}

export function resolveAvatarSrc(value?: string | null) {
  const normalized = normalizeAvatarValue(value);
  if (!normalized) return "";

  if (isExternalAvatarUrl(normalized)) return normalized;
  if (isAvatarPreset(normalized)) return `/avatars/${normalized}.svg`;

  if (normalized.startsWith("/avatars/")) return normalized;
  return "";
}

export function getAvatarPresetFromSeed(seed: string): AvatarPreset {
  let hash = 0;
  const normalizedSeed = seed.trim().toLowerCase();

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) >>> 0;
  }

  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length];
}

export function buildStoredAvatarValue(seed: string, avatar?: string) {
  const normalizedAvatar = normalizeAvatarValue(avatar);
  if (isExternalAvatarUrl(normalizedAvatar) || isAvatarPreset(normalizedAvatar)) {
    return normalizedAvatar;
  }

  return getAvatarPresetFromSeed(seed);
}
