export class BunproClientError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "BunproClientError";
  }
}

export async function bunpro<T>(query: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bunpro${query ? `?${query}` : ""}`, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BunproClientError(typeof data?.error === "string" && data.error ? data.error : "Bunpro request failed.", response.status);
  }
  return response.json() as Promise<T>;
}
