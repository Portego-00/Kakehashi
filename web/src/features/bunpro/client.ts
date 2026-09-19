export async function bunpro<T>(query: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bunpro${query ? `?${query}` : ""}`, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Bunpro request failed.");
  return data as T;
}
