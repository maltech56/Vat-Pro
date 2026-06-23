import { getToken, forceLogout } from "./session";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    forceLogout();
    throw new Error("Session expired");
  }

  return res.json();
};