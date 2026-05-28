export function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) {
    throw new Error("Missing VITE_API_URL. Define it in the project .env file.");
  }

  return baseUrl.trim().replace(/\/$/, "");
}
