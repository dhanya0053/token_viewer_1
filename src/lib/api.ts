const API_BASE = "http://localhost:3000/api/v1";

export async function api<T>(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || "API error");
  return json.data as T;
}

// Fetch live queue status with optional filters
type QueueStatusParams = {
  department?: string;
  doctorid?: string;
};

export async function fetchQueueStatus(params: QueueStatusParams = {}) {
  const query = new URLSearchParams(
    Object.entries(params).reduce(
      (acc, [k, v]) => {
        if (v) acc[k] = v;
        return acc;
      },
      {} as Record<string, string>,
    ),
  ).toString();
  return api<any>(`/queue${query ? `?${query}` : ""}`);
}

export async function updateTokenStatus(tokenId: string, status: string, doctorId?: string) {
  console.log("Updating token status for tokenId:", tokenId);
  
  return api<any>(`/tokens`, {
    method: 'PUT',
    body: JSON.stringify({ tokenId, status, doctorId }),
  });
}
