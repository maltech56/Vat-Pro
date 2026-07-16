import { getToken, forceLogout } from "./session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });

  // Authentication failures
  if (response.status === 401 || response.status === 403) {
    forceLogout();
    throw new Error("Session expired");
  }

  // No Content
  if (response.status === 204) {
    return null;
  }

  // Determine response type
  const contentType = response.headers.get("content-type") || "";

  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  // HTTP errors
  if (!response.ok) {
    if (typeof data === "object" && data?.error) {
      throw new Error(data.error);
    }

    if (typeof data === "string" && data.trim()) {
      throw new Error(data);
    }

    throw new Error(
      `Request failed (${response.status} ${response.statusText})`
    );
  }

  return data;
};