import { BUNPRO_CREDENTIAL_HEADER, BUNPRO_CREDENTIAL_STORAGE_KEY } from "./credential";

function savedCredential(): string | null {
  try { return window.localStorage.getItem(BUNPRO_CREDENTIAL_STORAGE_KEY); }
  catch { return null; }
}

export async function bunpro<T>(query: string, options?: RequestInit): Promise<T> {
  const credential = savedCredential();
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (credential) headers.set(BUNPRO_CREDENTIAL_HEADER, credential);
  const response = await fetch(`/api/bunpro${query ? `?${query}` : ""}`, { ...options, cache: "no-store", headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Bunpro request failed.");
  try {
    // Explicit saves/disconnects take priority over automatic cookie migration.
    // Ignore stale connection checks after another tab changes the saved key.
    if (options?.method === "POST" || options?.method === "DELETE" || savedCredential() === credential) {
      if (options?.method === "DELETE") window.localStorage.removeItem(BUNPRO_CREDENTIAL_STORAGE_KEY);
      else {
        const nextCredential = response.headers.get(BUNPRO_CREDENTIAL_HEADER);
        if (nextCredential) window.localStorage.setItem(BUNPRO_CREDENTIAL_STORAGE_KEY, nextCredential);
      }
    }
  } catch { /* The HttpOnly cookie still works when browser storage is unavailable. */ }
  return data as T;
}
