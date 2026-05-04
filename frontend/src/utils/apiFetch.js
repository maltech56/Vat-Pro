import { getToken, forceLogout } from "./session";

const API_BASE = "http://localhost:5000/api";

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    forceLogout(
      "Your session has expired or access is no longer valid. Please log in again."
    );
    return null;
  }

  return response;
}